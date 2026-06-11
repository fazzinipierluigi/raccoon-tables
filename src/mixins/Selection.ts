/**
 * Raccoon Tables - Selection mixin
 *
 * Two selection models:
 *   1. Row checkbox selection  (config.checkboxColumn = true)
 *   2. Cell range selection    (click + shift-click / mousedown drag)
 *
 * Cell range selection tracks a CellRange { startRow, endRow, startCol, endCol }
 * and renders rt-cell-selected on all cells in the range.
 * Ctrl+C copies the selection, Delete/Backspace clears it.
 */

import type { RaccoonGrid } from '../RaccoonGrid.js';
import type { GridItem, ColumnDef } from '../types.js';
import { cls } from '../utils/cls.js';

type Grid = RaccoonGrid<Record<string, unknown>>;

export interface CellRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface ActiveCell {
  rowIndex: number;
  colIndex: number;
  item: GridItem;
  col: ColumnDef;
}

export const SelectionMixin = {
  // -------------------------------------------------------------------------
  // Row checkbox selection
  // -------------------------------------------------------------------------

  selectRow(this: Grid, item: GridItem, selected: boolean): void {
    this.store.selectRowItem(item, selected);
    this._updateRowSelectedClass(item);
    this._updateSelectAllCheckbox();
    const all = [...this.store.selectedItemsMap.values()];
    this.config.onRowSelectionChange?.({
      selected: selected ? [item] : [],
      deselected: selected ? [] : [item],
      all,
    });
    this._emit('raccoon:selectionChange', {
      grid: this,
      selected: selected ? [item] : [],
      deselected: selected ? [] : [item],
      all,
    });
  },

  selectAll(this: Grid, selected: boolean): void {
    this.store.selectAll(selected);
    this.renderVisibleRows();
    if (this.selectAllCheckbox) this.selectAllCheckbox.checked = selected;
    const all = [...this.store.selectedItemsMap.values()];
    this.config.onRowSelectionChange?.({
      selected: selected ? this.store.data : [],
      deselected: selected ? [] : this.store.data,
      all,
    });
    this._emit('raccoon:selectionChange', {
      grid: this,
      selected: selected ? this.store.data : [],
      deselected: selected ? [] : this.store.data,
      all,
    });
  },

  getSelectedRows(this: Grid): GridItem[] {
    return [...this.store.selectedItemsMap.values()];
  },

  _updateRowSelectedClass(this: Grid, item: GridItem): void {
    if (!this.bodyEl) return;
    const rowEl = this.bodyEl.querySelector<HTMLElement>(`[data-id="${item.id}"]`);
    if (!rowEl) return;
    rowEl.classList.toggle(cls.rowSelected, item.$selected === true);
    const checkInput = rowEl.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (checkInput) checkInput.checked = item.$selected === true;
  },

  _updateSelectAllCheckbox(this: Grid): void {
    if (!this.selectAllCheckbox) return;
    const total = this.store.getDataTotal();
    const selected = this.store.selectedItemsMap.size;
    this.selectAllCheckbox.checked = selected === total && total > 0;
    this.selectAllCheckbox.indeterminate = selected > 0 && selected < total;
  },

  // -------------------------------------------------------------------------
  // Cell range selection
  // -------------------------------------------------------------------------

  onCellMouseDown(this: Grid, e: MouseEvent, item: GridItem, col: ColumnDef, rowIndex: number, cellEl: HTMLElement): void {
    if (!this.config.cellSelection) return;

    const colIndex = this.visibleColumns.findIndex(c => c.id === col.id);

    if (e.shiftKey && this.activeCell) {
      // Extend range
      this.selectionRange = {
        startRow: Math.min(this.activeCell.rowIndex, rowIndex),
        endRow: Math.max(this.activeCell.rowIndex, rowIndex),
        startCol: Math.min(this.activeCell.colIndex, colIndex),
        endCol: Math.max(this.activeCell.colIndex, colIndex),
      };
      this._renderSelectionRange();
    } else {
      // Start new selection
      this.activeCell = { rowIndex, colIndex, item, col };
      this.selectionRange = {
        startRow: rowIndex,
        endRow: rowIndex,
        startCol: colIndex,
        endCol: colIndex,
      };
      this.selectionMap = new Set([`${rowIndex}_${col.id}`]);
      this._clearSelectionClasses();
      cellEl.classList.add(cls.cellSelected);

      // Begin drag selection
      const onMove = (ev: MouseEvent) => this._onSelectionMouseMove(ev, rowIndex, colIndex);
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    this.config.onCellClick?.({ event: e, item, column: col, rowIndex, grid: this as unknown as Grid });
  },

  _onSelectionMouseMove(this: Grid, e: MouseEvent, anchorRow: number, anchorCol: number): void {
    if (!this.bodyEl || !this.activeCell) return;

    const bodyRect = this.bodyEl.getBoundingClientRect();
    const relY = e.clientY - bodyRect.top + this.scroller.scrollTop;
    const relX = e.clientX - bodyRect.left + this.scroller.scrollLeft;

    const rowIndex = Math.max(0, Math.min(
      this.store.getDisplayedDataTotal() - 1,
      Math.floor(relY / (this.config.rowHeight ?? 32))
    ));

    let colIndex = 0;
    let accX = 0;
    for (let i = 0; i < this.visibleColumns.length; i++) {
      accX += this.visibleColumns[i].width ?? this.config.defaultColumnWidth ?? 100;
      if (accX > relX) { colIndex = i; break; }
      colIndex = i;
    }

    this.selectionRange = {
      startRow: Math.min(anchorRow, rowIndex),
      endRow: Math.max(anchorRow, rowIndex),
      startCol: Math.min(anchorCol, colIndex),
      endCol: Math.max(anchorCol, colIndex),
    };

    this._renderSelectionRange();
  },

  _renderSelectionRange(this: Grid): void {
    if (!this.selectionRange || !this.bodyEl) return;
    const { startRow, endRow, startCol, endCol } = this.selectionRange;

    this.selectionMap = new Set<string>();
    for (let ri = startRow; ri <= endRow; ri++) {
      for (let ci = startCol; ci <= endCol; ci++) {
        const col = this.visibleColumns[ci];
        if (col) this.selectionMap.add(`${ri}_${col.id}`);
      }
    }

    this._clearSelectionClasses();

    // Apply to visible rows
    const rows = this.bodyEl.querySelectorAll<HTMLElement>(`[data-row-index]`);
    for (const rowEl of rows) {
      const ri = Number(rowEl.dataset['rowIndex']);
      for (let ci = startCol; ci <= endCol; ci++) {
        const col = this.visibleColumns[ci];
        if (!col) continue;
        if (ri >= startRow && ri <= endRow) {
          const cellEl = rowEl.querySelector<HTMLElement>(`[data-col-id="${col.id}"]`);
          cellEl?.classList.add(cls.cellSelected);
        }
      }
    }
  },

  _clearSelectionClasses(this: Grid): void {
    if (!this.bodyEl) return;
    const cells = this.bodyEl.querySelectorAll<HTMLElement>(`.${cls.cellSelected}`);
    for (const c of cells) c.classList.remove(cls.cellSelected);
  },

  setActiveCell(this: Grid, rowIndex: number, colIndex: number): void {
    const item = this.store.getItemByRowIndex(rowIndex);
    const col = this.visibleColumns[colIndex];
    if (!item || !col) return;
    this.activeCell = { rowIndex, colIndex, item, col };
    this.selectionRange = { startRow: rowIndex, endRow: rowIndex, startCol: colIndex, endCol: colIndex };
    this._renderSelectionRange();
    this.scroller.scrollTo(rowIndex, false);
    this.scroller.scrollToColumn(colIndex);
    this.renderVisibleRows();
  },

  clearCellSelection(this: Grid): void {
    this.selectionRange = undefined;
    this.selectionMap = new Set();
    this._clearSelectionClasses();
  },
};
