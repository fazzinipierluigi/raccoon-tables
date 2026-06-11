/**
 * Raccoon Tables - Sort mixin
 *
 * Exposes grid-level sort/clearSort that delegate to the Store,
 * then re-render with optional row animation.
 *
 * In server mode the mixin builds a ServerRequestParams and fires
 * the ServerAdapter instead of touching the local store.
 */

import type { RaccoonGrid } from '../RaccoonGrid.js';
import type { ColumnDef, SortDir } from '../types.js';
import { ServerAdapter } from '../core/ServerAdapter.js';

type Grid = RaccoonGrid<Record<string, unknown>>;

export const SortMixin = {
  sort(this: Grid, column: ColumnDef, dir: SortDir = 'ASC', multi = false): void {
    if (!this._emit('raccoon:beforeSort', { grid: this, columnId: column.id, dir, multi })) return;

    if (this.config.serverAdapter) {
      this._serverSort(column, dir, multi);
      this._emit('raccoon:sort', { grid: this, sorters: this.store.sorters.map(s => ({ columnId: s.column.id, dir: s.dir })) });
      return;
    }

    this.store.memorizePrevRowIndexesMap();

    if (this.store.rowGroups.length) {
      this.store.sort(column, dir, multi);
      this.renderVisibleRows();
    } else {
      this.store.sort(column, dir, multi);
      this.renderVisibleRowsAfterSort();
    }

    this.renderHeader();
    this._emit('raccoon:sort', { grid: this, sorters: this.store.sorters.map(s => ({ columnId: s.column.id, dir: s.dir })) });
  },

  clearSort(this: Grid, column?: ColumnDef, multi = false): void {
    if (this.config.serverAdapter) {
      if (column && multi) {
        this.store.sorters = this.store.sorters.filter(s => s.column.id !== column.id);
      } else {
        this.store.sorters = [];
      }
      this._triggerServerRequest();
      this._emit('raccoon:sort', { grid: this, sorters: [] });
      return;
    }

    this.store.clearSort(column, multi);
    this.scroller.totalRows = this.store.getDisplayedDataTotal();
    this.renderVisibleRows();
    this.renderHeader();
    this._emit('raccoon:sort', { grid: this, sorters: this.store.sorters.map(s => ({ columnId: s.column.id, dir: s.dir })) });
  },

  _serverSort(this: Grid, column: ColumnDef, dir: SortDir, multi: boolean): void {
    if (!multi) {
      this.store.sorters = [];
    } else {
      this.store.sorters = this.store.sorters.filter(s => s.column.id !== column.id);
    }
    this.store.sorters.push({ column, dir });
    this._triggerServerRequest();
    this.renderHeader();
  },
};
