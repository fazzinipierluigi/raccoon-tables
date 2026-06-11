/**
 * Raccoon Tables - Column mixin
 *
 * Column lifecycle: show/hide, reorder, width update, setColumns (full replace).
 * Keeps `visibleColumns` and `columnsById` in sync.
 */

import type { RaccoonGrid } from '../RaccoonGrid.js';
import type { ColumnDef } from '../types.js';
import { generateUID } from '../utils/misc.js';

type Grid = RaccoonGrid<Record<string, unknown>>;

let _colSeed = 0;

const pinOrder = (col: ColumnDef): number =>
  col.pinned === 'left' ? 0 : col.pinned === 'right' ? 2 : 1;

export const ColumnMixin = {
  prepareColumns(this: Grid): void {
    _colSeed = 0;
    this.columnsById = {};
    this.allColumns = [];
    this.visibleColumns = [];

    const defaultW = this.config.defaultColumnWidth ?? 100;

    for (const col of this.config.columns) {
      const prepared = this.prepareColumn(col);
      this.allColumns.push(prepared);
      this.columnsById[prepared.id] = prepared;
      if (!prepared.hidden) this.visibleColumns.push(prepared);
    }

    // Sort: left-pinned first, right-pinned last (stable sort preserves within-group order)
    this.visibleColumns.sort((a, b) => pinOrder(a) - pinOrder(b));

    this.scroller.setColumns(this.visibleColumns);
  },

  prepareColumn(this: Grid, col: ColumnDef): ColumnDef {
    const defaultW = this.config.defaultColumnWidth ?? 100;
    const prepared: ColumnDef = {
      ...col,
      id: col.id ?? generateUID(),
      width: col.width ?? (col.flex ? undefined : defaultW),
      type: col.type ?? 'string',
      sortable: col.sortable !== false,
      filterable: col.filterable !== false,
      resizable: col.resizable !== false,
    };

    // index is the data field key; text is the header label
    if (!prepared.index && !prepared.render) {
      prepared.index = String(col.index ?? col.text ?? '').toLowerCase();
    }

    return prepared;
  },

  generateColumnIds(this: Grid): void {
    // Re-assign IDs preserving original if set
    for (const col of this.allColumns) {
      if (!col.id) col.id = generateUID();
    }
  },

  setColumns(this: Grid, columns: ColumnDef[]): void {
    this.config.columns = columns;
    this.prepareColumns();
    this.clearRows();
    this.renderHeader();
    this.renderVisibleRows();
  },

  showColumn(this: Grid, colId: string): void {
    const col = this.columnsById[colId];
    if (!col || !col.hidden) return;
    col.hidden = false;

    // Insert into visibleColumns at correct position (preserve order)
    const allIdx = this.allColumns.indexOf(col);
    let insertAt = 0;
    for (let i = allIdx - 1; i >= 0; i--) {
      const c = this.allColumns[i];
      const visIdx = this.visibleColumns.indexOf(c);
      if (visIdx !== -1) {
        insertAt = visIdx + 1;
        break;
      }
    }
    this.visibleColumns.splice(insertAt, 0, col);
    this.visibleColumns.sort((a, b) => pinOrder(a) - pinOrder(b));
    this.scroller.setColumns(this.visibleColumns);

    this.clearRows();
    this.renderHeader();
    this.renderVisibleRows();
    this.config.onColumnChange?.({ columns: this.allColumns });
    this._emit('raccoon:columnVisibility', { grid: this, columnId: colId, hidden: false });
  },

  hideColumn(this: Grid, colId: string): void {
    const col = this.columnsById[colId];
    if (!col || col.hidden) return;
    col.hidden = true;

    const idx = this.visibleColumns.indexOf(col);
    if (idx !== -1) this.visibleColumns.splice(idx, 1);
    this.scroller.setColumns(this.visibleColumns);

    this.clearRows();
    this.renderHeader();
    this.renderVisibleRows();
    this.config.onColumnChange?.({ columns: this.allColumns });
    this._emit('raccoon:columnVisibility', { grid: this, columnId: colId, hidden: true });
  },

  moveColumn(this: Grid, fromColId: string, toColId: string): void {
    const fromIdx = this.visibleColumns.findIndex(c => c.id === fromColId);
    const toIdx = this.visibleColumns.findIndex(c => c.id === toColId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

    const [col] = this.visibleColumns.splice(fromIdx, 1);
    this.visibleColumns.splice(toIdx, 0, col);

    // Also reorder allColumns
    const allFrom = this.allColumns.findIndex(c => c.id === fromColId);
    const allTo = this.allColumns.findIndex(c => c.id === toColId);
    if (allFrom !== -1 && allTo !== -1) {
      const [ac] = this.allColumns.splice(allFrom, 1);
      this.allColumns.splice(allTo, 0, ac);
    }

    this.scroller.setColumns(this.visibleColumns);
    this.clearRows();
    this.renderHeader();
    this.renderVisibleRows();
    this.config.onColumnChange?.({ columns: this.allColumns });
    this._emit('raccoon:columnMove', { grid: this, columnId: fromColId, fromIndex: fromIdx, toIndex: toIdx });
  },

  setColumnWidth(this: Grid, colId: string, width: number): void {
    const col = this.columnsById[colId];
    if (!col) return;
    col.width = width;
    this.clearRows();
    this.renderHeader();
    this.renderVisibleRows();
  },

  pinColumn(this: Grid, colId: string, pin: 'left' | 'right' | false): void {
    const col = this.columnsById[colId];
    if (!col) return;
    col.pinned = pin === false ? undefined : pin;
    this.visibleColumns.sort((a, b) => pinOrder(a) - pinOrder(b));
    this.scroller.setColumns(this.visibleColumns);
    this.clearRows();
    this.renderHeader();
    this.renderVisibleRows();
    this._emit('raccoon:columnPin', { grid: this, columnId: colId, pin: col.pinned });
  },

  // Apply flex sizing to fill remaining space
  applyFlexColumns(this: Grid): void {
    if (!this.bodyEl) return;
    const totalWidth = this.bodyEl.clientWidth - (this.config.checkboxColumn ? 40 : 0);
    if (totalWidth <= 0) return;
    const defaultW = this.config.defaultColumnWidth ?? 100;
    const flexCols = this.visibleColumns.filter(c => c.flex);
    const fixedCols = this.visibleColumns.filter(c => !c.flex);
    const fixedWidth = fixedCols.reduce((s, c) => s + (c.width ?? defaultW), 0);

    if (flexCols.length) {
      const totalFlex = flexCols.reduce((s, c) => s + (typeof c.flex === 'number' ? c.flex : 1), 0);
      const remaining = Math.max(0, totalWidth - fixedWidth);
      for (const col of flexCols) {
        const flex = typeof col.flex === 'number' ? col.flex : 1;
        col.width = Math.max(20, Math.floor((remaining * flex) / totalFlex));
      }
    } else if (fixedWidth > 0 && fixedWidth < totalWidth && fixedCols.length > 0) {
      // No flex columns: scale all columns proportionally to fill the container
      const scale = totalWidth / fixedWidth;
      let remaining = totalWidth;
      for (let i = 0; i < fixedCols.length; i++) {
        const col = fixedCols[i];
        if (i === fixedCols.length - 1) {
          col.width = Math.max(20, remaining);
        } else {
          const newW = Math.max(20, Math.floor((col.width ?? defaultW) * scale));
          col.width = newW;
          remaining -= newW;
        }
      }
    }
  },
};
