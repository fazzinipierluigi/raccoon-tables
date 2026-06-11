/**
 * Raccoon Tables - Header mixin
 *
 * Renders the column header(s), handles:
 *   - Single and multi-level column groups
 *   - Sort indicators (single and multi-column)
 *   - Column resize (mousedown on resize handle → mousemove → mouseup)
 *   - Column menu (sort, filter, hide/show, group by)
 *   - Filter bar row below the header
 */

import type { RaccoonGrid } from '../RaccoonGrid.js';
import type { ColumnDef, ColumnGroup } from '../types.js';
import { cls } from '../utils/cls.js';
import { div, span } from '../utils/dom.js';
import { svg } from '../utils/svg.js';

type Grid = RaccoonGrid<Record<string, unknown>>;

// Minimum column width in pixels
const MIN_COL_WIDTH = 20;

export const HeaderMixin = {
  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  renderHeader(this: Grid): void {
    if (!this.headerEl) return;
    this.headerEl.innerHTML = '';

    if (this.config.columnGroups?.length) {
      this.renderGroupHeader();
    }

    const row = div(cls.headerRow);

    if (this.config.checkboxColumn) {
      const checkCell = this.createHeaderCheckboxCell();
      row.appendChild(checkCell);
    }

    for (const col of this.visibleColumns) {
      const cell = this.createHeaderCell(col);
      row.appendChild(cell);
    }

    this.headerRowEl = row;
    this.headerEl.appendChild(row);

    if (this.config.filterBar) {
      const filterRow = this.renderFilterBar();
      this.filterBarRowEl = filterRow;
      this.headerEl.appendChild(filterRow);
    } else {
      this.filterBarRowEl = null;
    }

    // Re-apply scroll offset to the new header DOM — renderHeader wipes translateX.
    this._syncHeaderScroll();
    this._updateStickyColumns();
  },

  _syncHeaderScroll(this: Grid): void {
    if (!this.bodyEl) return;
    const x = this.bodyEl.scrollLeft;
    if (this.headerRowEl) this.headerRowEl.style.transform = `translateX(${-x}px)`;
    if (this.filterBarRowEl) this.filterBarRowEl.style.transform = `translateX(${-x}px)`;
  },

  renderGroupHeader(this: Grid): void {
    if (!this.headerEl || !this.config.columnGroups) return;

    const defaultW = this.config.defaultColumnWidth ?? 100;
    const row = div(cls.headerGroupRow);

    for (const group of this.config.columnGroups) {
      const groupEl = div(cls.headerGroupCell);
      const totalWidth = group.columns.reduce((sum: number, colId: string) => {
        const col = this.columnsById[colId];
        return sum + (col?.width ?? defaultW);
      }, 0);
      groupEl.style.width = `${totalWidth}px`;
      groupEl.textContent = group.text ?? '';

      if (group.cls) groupEl.classList.add(...group.cls.split(' ').filter(Boolean));

      row.appendChild(groupEl);
    }

    this.headerEl.appendChild(row);
  },

  createHeaderCell(this: Grid, col: ColumnDef): HTMLElement {
    const cell = div(cls.headerCell);
    cell.dataset['colId'] = col.id;
    const colWidth = col.width ?? this.config.defaultColumnWidth ?? 100;
    cell.style.width = `${colWidth}px`;

    if (col.cls) cell.classList.add(...col.cls.split(' ').filter(Boolean));

    // Pinned column indicator classes
    if (col.pinned) {
      const colIdx = this.visibleColumns.indexOf(col);
      if (col.pinned === 'left') {
        cell.classList.add(cls.headerCellPinnedLeft);
        if (this.visibleColumns[colIdx + 1]?.pinned !== 'left') {
          cell.classList.add(cls.headerCellPinnedLeftBoundary);
        }
      } else {
        cell.classList.add(cls.headerCellPinnedRight);
        if (this.visibleColumns[colIdx - 1]?.pinned !== 'right') {
          cell.classList.add(cls.headerCellPinnedRightBoundary);
        }
      }
    }

    // Title
    const titleEl = span(cls.headerCellTitle);
    titleEl.textContent = col.text ?? col.index ?? '';
    cell.appendChild(titleEl);

    // Pin icon for pinned columns
    if (col.pinned) {
      const pinIconEl = span(cls.headerCellPinIcon);
      pinIconEl.innerHTML = svg.pin;
      cell.appendChild(pinIconEl);
    }

    // Sort indicator
    const sortEl = div(cls.headerCellSort);
    const sorter = this.store.sorters.find(s => s.column.id === col.id);
    if (sorter) {
      sortEl.innerHTML = sorter.dir === 'ASC' ? svg.sortAsc : svg.sortDesc;
      sortEl.classList.add(cls.headerCellSortActive);
      if (this.store.sorters.length > 1) {
        const idx = this.store.sorters.findIndex(s => s.column.id === col.id);
        sortEl.setAttribute('data-sort-order', String(idx + 1));
      }
    }
    cell.appendChild(sortEl);

    // Filter active indicator
    if (this.store.filters.some(f => f.column.id === col.id)) {
      const filterIndicator = span(cls.headerCellFilterActive);
      filterIndicator.innerHTML = svg.filter;
      cell.appendChild(filterIndicator);
    }

    // Menu button
    if (col.menuItems !== false) {
      const menuBtn = div(cls.headerCellMenuBtn);
      menuBtn.innerHTML = svg.menu;
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showHeaderCellMenuList(e, col, cell);
      });
      cell.appendChild(menuBtn);

      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showHeaderCellMenuList(e as MouseEvent, col, cell);
      });
    }

    // Sort on click
    if (col.sortable !== false) {
      cell.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest(`.${cls.headerCellMenuBtn}`)) return;
        this.onHeaderCellClick(e, col);
      });
      cell.style.cursor = 'pointer';
    }

    // Resize handle
    if (col.resizable !== false && this.config.columnResize !== false) {
      const resizeHandle = div(cls.headerCellResizeHandle);
      resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.onResizeMouseDown(e, col, cell);
      });
      cell.appendChild(resizeHandle);
    }

    return cell;
  },

  createHeaderCheckboxCell(this: Grid): HTMLElement {
    const cell = div(cls.headerCell);
    cell.classList.add(cls.headerCellCheckbox);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.addEventListener('change', () => {
      this.selectAll(input.checked);
    });
    this.selectAllCheckbox = input;
    cell.appendChild(input);
    return cell;
  },

  // -------------------------------------------------------------------------
  // Filter bar
  // -------------------------------------------------------------------------

  renderFilterBar(this: Grid): HTMLElement {
    const row = div(cls.filterBarRow);

    if (this.config.checkboxColumn) {
      const emptyCell = div(cls.filterBarCell);
      emptyCell.classList.add(cls.headerCellCheckbox);
      row.appendChild(emptyCell);
    }

    for (const col of this.visibleColumns) {
      const cell = this.createFilterBarCell(col);
      row.appendChild(cell);
    }

    return row;
  },

  createFilterBarCell(this: Grid, col: ColumnDef): HTMLElement {
    const cell = div(cls.filterBarCell);
    cell.dataset['colId'] = col.id;
    const colWidth = col.width ?? this.config.defaultColumnWidth ?? 100;
    cell.style.width = `${colWidth}px`;

    if (col.pinned) {
      const colIdx = this.visibleColumns.indexOf(col);
      if (col.pinned === 'left') {
        cell.classList.add(cls.filterBarCellPinnedLeft);
        if (this.visibleColumns[colIdx + 1]?.pinned !== 'left') {
          cell.classList.add(cls.filterBarCellPinnedLeftBoundary);
        }
      } else {
        cell.classList.add(cls.filterBarCellPinnedRight);
        if (this.visibleColumns[colIdx - 1]?.pinned !== 'right') {
          cell.classList.add(cls.filterBarCellPinnedRightBoundary);
        }
      }
    }

    if (col.filterable === false) return cell;

    const filterField = this.createFilterField(col, cell);
    cell.appendChild(filterField);

    return cell;
  },

  updateFilterBarCells(this: Grid): void {
    if (!this.headerEl) return;
    const cells = this.headerEl.querySelectorAll<HTMLElement>(`.${cls.filterBarCell}`);
    for (const cell of cells) {
      const colId = cell.dataset['colId']!;
      const col = this.columnsById[colId];
      if (!col) continue;
      const activeFilter = this.store.filters.find(f => f.column.id === colId);

      const sel = cell.querySelector<HTMLSelectElement>('select');
      if (sel) {
        sel.value = activeFilter ? String(activeFilter.sign === 'T' || activeFilter.sign === 'F' || activeFilter.sign === 'empty'
          ? activeFilter.sign
          : activeFilter.value ?? '') : '';
        continue;
      }

      const inp = cell.querySelector<HTMLInputElement>('input');
      if (inp && activeFilter) {
        inp.value = String(activeFilter.value ?? '');
      } else if (inp) {
        inp.value = '';
      }
    }
  },

  // -------------------------------------------------------------------------
  // Sort handler
  // -------------------------------------------------------------------------

  onHeaderCellClick(this: Grid, e: MouseEvent, col: ColumnDef): void {
    const multi = e.ctrlKey || e.metaKey;
    const sorter = this.store.sorters.find(s => s.column.id === col.id);

    if (sorter) {
      if (sorter.dir === 'ASC') {
        this.sort(col, 'DESC', multi);
      } else {
        this.clearSort(col, multi);
      }
    } else {
      this.sort(col, 'ASC', multi);
    }
  },

  // -------------------------------------------------------------------------
  // Column resize
  // -------------------------------------------------------------------------

  onResizeMouseDown(this: Grid, e: MouseEvent, col: ColumnDef, headerCell: HTMLElement): void {
    e.preventDefault();
    // Freeze flex column into a fixed width so manual resize sticks
    if (col.flex) {
      col.width = col.width ?? this.config.defaultColumnWidth ?? 100;
      col.flex = undefined;
    }
    this._resizeStartX = e.clientX;
    this._resizeStartWidth = col.width ?? this.config.defaultColumnWidth ?? 100;
    this._resizeCol = col;
    this._resizeHeaderCell = headerCell;

    const onMove = (ev: MouseEvent) => this.onResizeMouseMove(ev);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // Absorb the synthetic click the browser fires after mouseup so it doesn't trigger a sort
      const absorbClick = (ev: Event) => {
        ev.stopPropagation();
        document.removeEventListener('click', absorbClick, true);
      };
      document.addEventListener('click', absorbClick, true);
      this.onResizeMouseUp();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    document.body.classList.add(cls.resizing);
  },

  onResizeMouseMove(this: Grid, e: MouseEvent): void {
    if (!this._resizeCol || !this.bodyEl) return;
    const diff = e.clientX - this._resizeStartX;
    const newWidth = Math.max(MIN_COL_WIDTH, this._resizeStartWidth + diff);
    this._resizeCol.width = newWidth;

    // Update resized header cell width
    if (this._resizeHeaderCell) {
      this._resizeHeaderCell.style.width = `${newWidth}px`;
    }

    // Update resized column body cells width
    const resizeColId = this._resizeCol.id;
    const cells = this.bodyEl.querySelectorAll<HTMLElement>(`[data-col-id="${resizeColId}"]`);
    for (const cell of cells) {
      cell.style.width = `${newWidth}px`;
    }

    // Update filter bar cell width
    if (this.headerEl) {
      const filterCell = this.headerEl.querySelector<HTMLElement>(`.${cls.filterBarCell}[data-col-id="${resizeColId}"]`);
      if (filterCell) filterCell.style.width = `${newWidth}px`;
    }

    // Shift left positions for all body cells in columns after the resized one
    // (header/filter cells are in flex rows — no left needed)
    const resizeIdx = this.visibleColumns.findIndex(c => c.id === resizeColId);
    for (let i = resizeIdx + 1; i < this.visibleColumns.length; i++) {
      const col = this.visibleColumns[i];
      const newLeft = this.getColumnLeft(col);
      const bodyCells = this.bodyEl.querySelectorAll<HTMLElement>(`[data-col-id="${col.id}"]`);
      for (const bc of bodyCells) bc.style.left = `${newLeft}px`;
    }

    this.config.onColumnResize?.({ column: this._resizeCol, width: newWidth });
  },

  onResizeMouseUp(this: Grid): void {
    document.body.classList.remove(cls.resizing);
    if (this._resizeCol) {
      this._emit('raccoon:columnResize', { grid: this, columnId: this._resizeCol.id, width: this._resizeCol.width ?? 0 });
    }
    this._resizeCol = undefined;
    this._resizeHeaderCell = undefined;
    // Re-distribute remaining flex columns and do a clean re-render
    this.applyFlexColumns();
    this.updateFakeScroller();
    this.clearRows();
    this.renderVisibleRows();
  },

  // -------------------------------------------------------------------------
  // Filter active indicators (lightweight — does NOT rebuild the filter bar)
  // -------------------------------------------------------------------------

  _updateFilterActiveIndicators(this: Grid): void {
    if (!this.headerEl) return;
    const cells = this.headerEl.querySelectorAll<HTMLElement>(`.${cls.headerCell}`);
    for (const cell of cells) {
      const colId = cell.dataset['colId'];
      if (!colId) continue;
      const hasFilter = this.store.filters.some(f => f.column.id === colId);
      const existing = cell.querySelector(`.${cls.headerCellFilterActive}`);
      if (hasFilter && !existing) {
        const ind = span(cls.headerCellFilterActive);
        ind.innerHTML = svg.filter;
        cell.appendChild(ind);
      } else if (!hasFilter && existing) {
        existing.remove();
      }
    }
  },

  // -------------------------------------------------------------------------
  // Column menu
  // -------------------------------------------------------------------------

  showHeaderCellMenuList(this: Grid, e: MouseEvent, col: ColumnDef, headerCell: HTMLElement): void {
    // Remove any existing menu
    this.closeHeaderCellMenu();

    const menu = div(cls.headerCellMenu);
    this._propagateTheme(menu);
    document.body.appendChild(menu);

    const items: Array<{ text: string; action: () => void; disabled?: boolean }> = [];

    const sorter = this.store.sorters.find(s => s.column.id === col.id);

    const loc = this._locale;

    if (col.sortable !== false) {
      items.push({
        text: loc.sortAsc,
        action: () => { this.sort(col, 'ASC'); this.closeHeaderCellMenu(); },
        disabled: sorter?.dir === 'ASC',
      });
      items.push({
        text: loc.sortDesc,
        action: () => { this.sort(col, 'DESC'); this.closeHeaderCellMenu(); },
        disabled: sorter?.dir === 'DESC',
      });
      if (sorter) {
        items.push({
          text: loc.clearSort,
          action: () => { this.clearSort(col); this.closeHeaderCellMenu(); },
        });
      }
    }

    if (this.config.columnHide !== false) {
      items.push({
        text: loc.hideColumn,
        action: () => { this.hideColumn(col.id); this.closeHeaderCellMenu(); },
      });
    }

    if (this.config.rowGroupBar) {
      const isGrouped = this.store.rowGroups.includes(col.index!);
      items.push({
        text: isGrouped ? loc.removeGroup : loc.groupBy,
        action: () => {
          isGrouped ? this.removeGroupFromBar(col.index!) : this.addGroupToBar(col.index!);
          this.closeHeaderCellMenu();
        },
      });
    }

    // Pin options
    items.push({
      text: loc.pinLeft,
      action: () => { this.pinColumn(col.id, 'left'); this.closeHeaderCellMenu(); },
      disabled: col.pinned === 'left',
    });
    items.push({
      text: loc.pinRight,
      action: () => { this.pinColumn(col.id, 'right'); this.closeHeaderCellMenu(); },
      disabled: col.pinned === 'right',
    });
    if (col.pinned) {
      items.push({
        text: loc.unpin,
        action: () => { this.pinColumn(col.id, false); this.closeHeaderCellMenu(); },
      });
    }

    for (const item of items) {
      const itemEl = div(cls.headerCellMenuItem);
      itemEl.textContent = item.text;
      if (item.disabled) itemEl.classList.add(cls.headerCellMenuItemDisabled);
      else itemEl.addEventListener('click', item.action);
      menu.appendChild(itemEl);
    }

    // Hidden columns — always show so they can be restored
    const hiddenCols = this.allColumns.filter(c => c.hidden);
    if (hiddenCols.length) {
      const sep = document.createElement('div');
      sep.classList.add(cls.headerCellMenuSeparator);
      menu.appendChild(sep);

      for (const hiddenCol of hiddenCols) {
        const showEl = div(cls.headerCellMenuItem);
        showEl.classList.add(cls.headerCellMenuItemShow);
        showEl.textContent = loc.showColumn + (hiddenCol.text ?? hiddenCol.id);
        showEl.addEventListener('click', () => {
          this.showColumn(hiddenCol.id);
          this.closeHeaderCellMenu();
        });
        menu.appendChild(showEl);
      }
    }

    // Position menu
    const rect = headerCell.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.zIndex = '9999';

    this._activeHeaderMenu = menu;

    // Close on outside click
    const closeHandler = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        this.closeHeaderCellMenu();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
  },

  closeHeaderCellMenu(this: Grid): void {
    this._activeHeaderMenu?.remove();
    this._activeHeaderMenu = undefined;
  },
};
