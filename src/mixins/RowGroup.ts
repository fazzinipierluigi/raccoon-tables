/**
 * Raccoon Tables - RowGroup mixin
 *
 * Grid-level row grouping API: expand, collapse, expandAll, collapseAll,
 * reConfigRowGroups (change which columns are grouped).
 * Delegates to Store for data manipulation, then re-renders.
 */

import type { RaccoonGrid } from '../RaccoonGrid.js';
import type { GridItem } from '../types.js';

type Grid = RaccoonGrid<Record<string, unknown>>;

export const RowGroupMixin = {
  expand(this: Grid, group: string): void {
    if (this.store.filters.length) {
      this.store.expandForFiltering(group);
    } else {
      this.store.expand(group);
    }
    this.scroller.totalRows = this.store.getDisplayedDataTotal();
    this.renderVisibleRows();
  },

  collapse(this: Grid, group: string): void {
    if (this.store.filters.length) {
      this.store.collapseForFiltering(group);
    } else {
      this.store.collapse(group);
    }
    this.scroller.totalRows = this.store.getDisplayedDataTotal();
    this.renderVisibleRows();
  },

  expandAll(this: Grid): void {
    this.store.expandAll();
    this.scroller.totalRows = this.store.getDisplayedDataTotal();
    this.renderVisibleRows();
  },

  collapseAll(this: Grid): void {
    this.store.collapseAll();
    this.scroller.totalRows = this.store.getDisplayedDataTotal();
    this.renderVisibleRows();
  },

  reConfigRowGroups(this: Grid, rowGroups: string[]): void {
    this.store.reConfigRowGroups(rowGroups);
    this.scroller.totalRows = this.store.getDisplayedDataTotal();
    this.scroller.scrollTo(0);
    this.renderHeader();
    this.renderVisibleRows();

    if (this.config.rowGroupBar) {
      this.renderRowGroupBar();
    }
  },

  addGroupToBar(this: Grid, index: string): void {
    if (this.store.rowGroups.includes(index)) return;
    const newGroups = [...this.store.rowGroups, index];
    this.reConfigRowGroups(newGroups);
  },

  removeGroupFromBar(this: Grid, index: string): void {
    const newGroups = this.store.rowGroups.filter(g => g !== index);
    this.reConfigRowGroups(newGroups);
  },
};
