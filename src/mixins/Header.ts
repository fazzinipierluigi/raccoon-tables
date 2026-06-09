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
      const input = cell.querySelector<HTMLInputElement>('input');
      if (input && activeFilter) {
        input.value = String(activeFilter.value ?? '');
      } else if (input) {
        input.value = '';
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
    this._resizeStartX = e.clientX;
    this._resizeStartWidth = col.width ?? this.config.defaultColumnWidth ?? 100;
    this._resizeCol = col;
    this._resizeHeaderCell = headerCell;

    const onMove = (ev: MouseEvent) => this.onResizeMouseMove(ev);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      this.onResizeMouseUp();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    document.body.classList.add(cls.resizing);
  },

  onResizeMouseMove(this: Grid, e: MouseEvent): void {
    if (!this._resizeCol) return;
    const diff = e.clientX - this._resizeStartX;
    const newWidth = Math.max(MIN_COL_WIDTH, this._resizeStartWidth + diff);
    this._resizeCol.width = newWidth;

    // Update header cell
    if (this._resizeHeaderCell) {
      this._resizeHeaderCell.style.width = `${newWidth}px`;
    }

    // Update body cells
    if (this.bodyEl) {
      const cells = this.bodyEl.querySelectorAll<HTMLElement>(`[data-index="${this._resizeCol.index}"]`);
      for (const cell of cells) {
        cell.style.width = `${newWidth}px`;
      }
    }

    // Update filter bar cell
    if (this.headerEl) {
      const filterCell = this.headerEl.querySelector<HTMLElement>(`.${cls.filterBarCell}[data-col-id="${this._resizeCol.id}"]`);
      if (filterCell) filterCell.style.width = `${newWidth}px`;
    }

    this.config.onColumnResize?.({ column: this._resizeCol, width: newWidth });
  },

  onResizeMouseUp(this: Grid): void {
    document.body.classList.remove(cls.resizing);
    this._resizeCol = undefined;
    this._resizeHeaderCell = undefined;
  },

  // -------------------------------------------------------------------------
  // Column menu
  // -------------------------------------------------------------------------

  showHeaderCellMenuList(this: Grid, e: MouseEvent, col: ColumnDef, headerCell: HTMLElement): void {
    // Remove any existing menu
    this.closeHeaderCellMenu();

    const menu = div(cls.headerCellMenu);
    document.body.appendChild(menu);

    const items: Array<{ text: string; action: () => void; disabled?: boolean }> = [];

    const sorter = this.store.sorters.find(s => s.column.id === col.id);

    if (col.sortable !== false) {
      items.push({
        text: 'Sort ASC',
        action: () => { this.sort(col, 'ASC'); this.closeHeaderCellMenu(); },
        disabled: sorter?.dir === 'ASC',
      });
      items.push({
        text: 'Sort DESC',
        action: () => { this.sort(col, 'DESC'); this.closeHeaderCellMenu(); },
        disabled: sorter?.dir === 'DESC',
      });
      if (sorter) {
        items.push({
          text: 'Clear Sort',
          action: () => { this.clearSort(col); this.closeHeaderCellMenu(); },
        });
      }
    }

    if (this.config.columnHide !== false) {
      items.push({
        text: 'Hide Column',
        action: () => { this.hideColumn(col.id); this.closeHeaderCellMenu(); },
      });
    }

    if (this.config.rowGroupBar) {
      const isGrouped = this.store.rowGroups.includes(col.index!);
      items.push({
        text: isGrouped ? 'Remove Group' : 'Group by this',
        action: () => {
          isGrouped ? this.removeGroupFromBar(col.index!) : this.addGroupToBar(col.index!);
          this.closeHeaderCellMenu();
        },
      });
    }

    // Pin options
    items.push({
      text: 'Pin Left',
      action: () => { this.pinColumn(col.id, 'left'); this.closeHeaderCellMenu(); },
      disabled: col.pinned === 'left',
    });
    items.push({
      text: 'Pin Right',
      action: () => { this.pinColumn(col.id, 'right'); this.closeHeaderCellMenu(); },
      disabled: col.pinned === 'right',
    });
    if (col.pinned) {
      items.push({
        text: 'Unpin',
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
