/**
 * Raccoon Tables - Body mixin
 *
 * Responsible for creating and managing the DOM elements for data rows and cells.
 * Uses virtual scrolling — only rows within [startRow, endRow] are in the DOM.
 * Each row is absolutely positioned via CSS transform: translateY(Y px).
 *
 * Row types:
 *   - Normal data row: renderRow()
 *   - Group header row: renderRowGroup()  ($isGroupRow === true)
 *
 * Cell update modes:
 *   - Full re-render: renderVisibleRows() tears down and rebuilds all visible rows
 *   - Positional update: updateCellPositions() only adjusts translateY without re-rendering
 */

import type { RaccoonGrid } from '../RaccoonGrid.js';
import type { GridItem, ColumnDef, CellParams } from '../types.js';
import { cls } from '../utils/cls.js';
import { div } from '../utils/dom.js';
import { svg } from '../utils/svg.js';
import { formatCurrency, formatDate, formatNumber } from '../utils/format.js';
import { renderBoolean, renderOrder } from '../utils/render.js';

type Grid = RaccoonGrid<Record<string, unknown>>;

function getTotalColumnsWidth(visibleColumns: ColumnDef[], checkboxCol: boolean, defaultW: number): number {
  const colsW = visibleColumns.reduce((s, c) => s + (c.width ?? defaultW), 0);
  return checkboxCol ? colsW + 40 : colsW;
}

export const BodyMixin = {
  // -------------------------------------------------------------------------
  // Row rendering
  // -------------------------------------------------------------------------

  renderVisibleRows(this: Grid): void {
    if (!this.bodyEl) return;

    const { start, end } = this.scroller.calcVisibleRows();
    const rowHeight = this.config.rowHeight ?? 32;

    // Remove rows outside new range
    const existing = new Map<number, HTMLElement>();
    const children = this.bodyEl.querySelectorAll<HTMLElement>(`[data-row-index]`);
    for (const el of children) {
      const ri = Number(el.dataset['rowIndex']);
      if (ri < start || ri > end) {
        el.remove();
      } else {
        existing.set(ri, el);
      }
    }

    // Build fragment for new rows
    const frag = document.createDocumentFragment();
    for (let i = start; i <= end; i++) {
      const item = this.store.getItemByRowIndex(i);
      if (!item) continue;

      const existingEl = existing.get(i);
      if (existingEl) {
        // Reuse only if same data item at this position (same id).
        // After a page change / sort / filter the item at row-index i is different —
        // the element must be re-created, not just repositioned.
        if (existingEl.dataset['id'] === item.id) {
          existingEl.style.transform = `translateY(${i * rowHeight}px)`;
          continue;
        }
        existingEl.remove();
      }

      const rowEl = item.$isGroupRow
        ? this.renderRowGroup(item, i)
        : this.renderRow(item, i);

      rowEl.style.transform = `translateY(${i * rowHeight}px)`;
      frag.appendChild(rowEl);
    }

    this.bodyEl.appendChild(frag);
    this.updateFakeScroller();
  },

  renderRow(this: Grid, item: GridItem, rowIndex: number): HTMLElement {
    const rowEl = div(cls.row);
    rowEl.dataset['rowIndex'] = String(rowIndex);
    rowEl.dataset['id'] = item.id;

    const selectedCls = item.$selected ? ` ${cls.rowSelected}` : '';
    if (selectedCls) rowEl.classList.add(cls.rowSelected);

    // Apply row-level class callbacks
    const rowCls = this.config.rowCls?.(item) ?? '';
    if (rowCls) rowEl.classList.add(...rowCls.split(' ').filter(Boolean));

    // Apply row-level style callbacks
    const rowStyle = this.config.rowStyle?.(item);
    if (rowStyle) Object.assign(rowEl.style, rowStyle);

    const rowHeight = this.config.rowHeight ?? 32;
    const totalW = getTotalColumnsWidth(this.visibleColumns, !!this.config.checkboxColumn, this.config.defaultColumnWidth ?? 100);
    rowEl.style.height = `${rowHeight}px`;
    rowEl.style.position = 'absolute';
    rowEl.style.width = `${totalW}px`;

    for (const col of this.visibleColumns) {
      const cellEl = this.createCell(item, col, rowIndex);
      rowEl.appendChild(cellEl);
    }

    // Row click
    rowEl.addEventListener('click', (e) => {
      this.onRowClick(e, item, rowIndex, rowEl);
    });

    // Row dblclick for editing
    rowEl.addEventListener('dblclick', (e) => {
      this.onRowDblClick(e, item, rowIndex, rowEl);
    });

    return rowEl;
  },

  renderRowGroup(this: Grid, item: GridItem, rowIndex: number): HTMLElement {
    const rowEl = div(cls.rowGroup);
    rowEl.dataset['rowIndex'] = String(rowIndex);
    rowEl.dataset['id'] = item.id;
    rowEl.dataset['group'] = item.$rowGroupValue!;

    const rowHeight = this.config.rowHeight ?? 32;
    rowEl.style.height = `${rowHeight}px`;
    rowEl.style.position = 'absolute';
    const totalW = getTotalColumnsWidth(this.visibleColumns, !!this.config.checkboxColumn, this.config.defaultColumnWidth ?? 100);
    rowEl.style.width = `${totalW}px`;

    const indent = (item.$groupLevel ?? 0) * 16;
    rowEl.style.paddingLeft = `${indent}px`;

    // Expander icon
    const expanderEl = div(cls.rowGroupExpander);
    expanderEl.innerHTML = item.expanded
      ? svg.sortDesc
      : svg.chevronRight;
    expanderEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onRowGroupExpanderClick(item);
    });
    rowEl.appendChild(expanderEl);

    // Group label
    const labelEl = div(cls.rowGroupLabel);
    labelEl.textContent = item.$rowDisplayGroupValue ?? item.$rowGroupValue ?? '';
    rowEl.appendChild(labelEl);

    // Amount badge
    const amountEl = div(cls.rowGroupAmount);
    amountEl.textContent = String(item.amount ?? item.childrenAmount ?? 0);
    rowEl.appendChild(amountEl);

    // Aggregation cells
    for (const col of this.visibleColumns) {
      if (col.summaryRenderer && item.$agValues?.[col.index!] !== undefined) {
        const agEl = div(cls.cellGroupAg);
        agEl.style.left = `${this.getColumnLeft(col)}px`;
        agEl.style.width = `${col.width ?? this.config.defaultColumnWidth ?? 100}px`;
        const agParams: CellParams = {
          value: item.$agValues[col.index!],
          item,
          column: col,
          rowIndex,
          grid: this as unknown as Grid,
          currency: col.currency,
          minDecimal: col.minDecimal,
          maxDecimal: col.maxDecimal,
        };
        agEl.innerHTML = col.summaryRenderer(agParams);
        rowEl.appendChild(agEl);
      }
    }

    // Checkbox selection for group rows
    if (this.config.checkboxColumn) {
      const checkEl = div(cls.cellCheckbox);
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = item.$selected === true || item.selectedStatus === 'full';
      input.indeterminate = item.selectedStatus === 'partly';
      input.addEventListener('change', () => {
        this.onGroupRowCheckboxChange(item, input.checked);
      });
      checkEl.appendChild(input);
      rowEl.prepend(checkEl);
    }

    // Selected state
    if (item.$selected) rowEl.classList.add(cls.rowSelected);

    rowEl.addEventListener('click', () => {
      this.onRowGroupExpanderClick(item);
    });

    return rowEl;
  },

  // -------------------------------------------------------------------------
  // Cell rendering
  // -------------------------------------------------------------------------

  createCell(this: Grid, item: GridItem, col: ColumnDef, rowIndex: number): HTMLElement {
    const cellEl = div(cls.cell);
    cellEl.dataset['index'] = col.index ?? '';
    cellEl.dataset['colId'] = col.id;

    const colWidth = col.width ?? this.config.defaultColumnWidth ?? 100;
    cellEl.style.width = `${colWidth}px`;
    cellEl.style.left = `${this.getColumnLeft(col)}px`;

    if (col.pinned) {
      const colIdx = this.visibleColumns.indexOf(col);
      if (col.pinned === 'left') {
        cellEl.classList.add(cls.cellPinnedLeft);
        if (this.visibleColumns[colIdx + 1]?.pinned !== 'left') {
          cellEl.classList.add(cls.cellPinnedLeftBoundary);
        }
      } else {
        cellEl.classList.add(cls.cellPinnedRight);
        if (this.visibleColumns[colIdx - 1]?.pinned !== 'right') {
          cellEl.classList.add(cls.cellPinnedRightBoundary);
        }
      }
    }

    const rawValue = col.getter
      ? col.getter({ item, column: col })
      : item[col.index!];

    const params: CellParams = {
      value: rawValue,
      item,
      column: col,
      rowIndex,
      grid: this as unknown as Grid,
      currency: col.currency,
      minDecimal: col.minDecimal,
      maxDecimal: col.maxDecimal,
    };

    // Custom renderer takes priority
    if (col.render) {
      cellEl.innerHTML = col.render(params);
    } else {
      cellEl.innerHTML = this.getCellDisplayValue(params);
    }

    // Cell-level cls
    if (col.cellCls) {
      const extra = col.cellCls(params);
      if (extra) cellEl.classList.add(...extra.split(' ').filter(Boolean));
    }

    // Cell-level cls rules
    if (col.cellClsRules) {
      for (const [clsName, condition] of Object.entries(col.cellClsRules)) {
        const active = typeof condition === 'function' ? condition(params) : !!condition;
        if (active) cellEl.classList.add(clsName);
      }
    }

    // Cell-level style
    if (col.cellStyle) {
      const style = col.cellStyle(params);
      if (style) Object.assign(cellEl.style, style);
    }

    // Flash animation class
    if (item.$flashColumns?.has(col.index!)) {
      cellEl.classList.add(cls.cellFlash);
      item.$flashColumns.delete(col.index!);
    }

    // Selection
    if (this.selectionMap?.has(`${rowIndex}_${col.id}`)) {
      cellEl.classList.add(cls.cellSelected);
    }

    // Editable indicator
    if (col.editable) {
      cellEl.classList.add(cls.cellEditable);
    }

    // Events
    cellEl.addEventListener('mousedown', (e) => {
      this.onCellMouseDown(e, item, col, rowIndex, cellEl);
    });

    if (col.editable) {
      cellEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.openEditorForCell(item, col, rowIndex, cellEl);
      });
    }

    return cellEl;
  },

  getCellDisplayValue(this: Grid, params: CellParams): string {
    const { value, column } = params;

    if (column.format) return column.format(params);

    switch (column.type) {
      case 'currency': return formatCurrency(params);
      case 'number': return String(value == null ? '' : formatNumber(value, params.maxDecimal ?? 0));
      case 'boolean': return renderBoolean(params);
      case 'date': return formatDate(value);
      case 'order': return renderOrder(params);
      default: return String(value ?? '');
    }
  },

  // -------------------------------------------------------------------------
  // Update helpers
  // -------------------------------------------------------------------------

  clearRows(this: Grid): void {
    if (!this.bodyEl) return;
    this.bodyEl.querySelectorAll('[data-row-index]').forEach(r => r.remove());
  },

  updateCellPositions(this: Grid): void {
    if (!this.bodyEl) return;
    const rowHeight = this.config.rowHeight ?? 32;
    const rows = this.bodyEl.querySelectorAll<HTMLElement>(`[data-row-index]`);
    for (const rowEl of rows) {
      const ri = Number(rowEl.dataset['rowIndex']);
      rowEl.style.transform = `translateY(${ri * rowHeight}px)`;
    }
  },

  updateFakeScroller(this: Grid): void {
    if (!this.fakeScrollEl) return;
    const total = this.store.getDisplayedDataTotal();
    const rowHeight = this.config.rowHeight ?? 32;
    this.fakeScrollEl.style.height = `${total * rowHeight}px`;
    const totalW = getTotalColumnsWidth(this.visibleColumns, !!this.config.checkboxColumn, this.config.defaultColumnWidth ?? 100);
    this.fakeScrollEl.style.width = `${totalW}px`;
  },

  getColumnLeft(this: Grid, col: ColumnDef): number {
    const defaultW = this.config.defaultColumnWidth ?? 100;
    let left = 0;
    for (const c of this.visibleColumns) {
      if (c.id === col.id) break;
      left += c.width ?? defaultW;
    }
    return left;
  },

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  onRowGroupExpanderClick(this: Grid, item: GridItem): void {
    const group = item.$rowGroupValue!;
    if (this.store.filters.length) {
      item.expanded
        ? this.store.collapseForFiltering(group)
        : this.store.expandForFiltering(group);
    } else {
      item.expanded
        ? this.store.collapse(group)
        : this.store.expand(group);
    }
    item.expanded = !item.expanded;
    this.scroller.totalRows = this.store.getDisplayedDataTotal();
    this.renderVisibleRows();
  },

  onRowClick(this: Grid, e: MouseEvent, item: GridItem, rowIndex: number, rowEl: HTMLElement): void {
    if (this.config.onRowClick) {
      this.config.onRowClick({ event: e, item, rowIndex, grid: this as unknown as Grid });
    }
  },

  onRowDblClick(this: Grid, e: MouseEvent, item: GridItem, rowIndex: number, rowEl: HTMLElement): void {
    if (this.config.onRowDblClick) {
      this.config.onRowDblClick({ event: e, item, rowIndex, grid: this as unknown as Grid });
    }
  },

  onGroupRowCheckboxChange(this: Grid, item: GridItem, checked: boolean): void {
    this.store.selectGroupRowItems(item, checked);
    this.renderVisibleRows();
  },

  // -------------------------------------------------------------------------
  // Row animation after sort/filter
  // -------------------------------------------------------------------------

  renderVisibleRowsAfterSort(this: Grid): void {
    const prevMap = this.store.prevIdRowIndexesMap;
    if (!prevMap || !this.bodyEl) {
      this.renderVisibleRows();
      return;
    }

    const rowHeight = this.config.rowHeight ?? 32;
    const { start, end } = this.scroller.calcVisibleRows();

    // Move existing rows to new positions using rAF for smooth animation
    const rowEls = this.bodyEl.querySelectorAll<HTMLElement>(`[data-row-index]`);
    for (const rowEl of rowEls) {
      rowEl.classList.add(cls.rowAnimation);
      const id = rowEl.dataset['id']!;
      const newIndex = this.store.idRowIndexesMap.get(id);
      if (newIndex !== undefined) {
        rowEl.dataset['rowIndex'] = String(newIndex);
        rowEl.style.transform = `translateY(${newIndex * rowHeight}px)`;
      } else {
        rowEl.remove();
      }
    }

    // After animation completes, re-render to get correct start/end
    setTimeout(() => {
      const allRows = this.bodyEl?.querySelectorAll<HTMLElement>(`[data-row-index]`) ?? [];
      for (const rowEl of allRows) rowEl.classList.remove(cls.rowAnimation);
      this.renderVisibleRows();
    }, 300);
  },

  renderVisibleRowsAfterFilter(this: Grid): void {
    this.scroller.totalRows = this.store.getDisplayedDataTotal();
    this.scroller.scrollTo(0);
    this.renderVisibleRows();
  },

  flashCells(this: Grid, id: string, indexes: string[]): void {
    const rowIndex = this.store.idRowIndexesMap.get(id);
    if (rowIndex === undefined || !this.bodyEl) return;

    const rowEl = this.bodyEl.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (!rowEl) return;

    for (const index of indexes) {
      const cellEl = rowEl.querySelector<HTMLElement>(`[data-index="${index}"]`);
      if (!cellEl) continue;
      cellEl.classList.remove(cls.cellFlash);
      // Force reflow so animation restarts
      void cellEl.offsetWidth;
      cellEl.classList.add(cls.cellFlash);
    }
  },
};
