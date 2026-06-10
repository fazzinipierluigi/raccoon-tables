/**
 * Raccoon Tables - KeyNavigation mixin
 *
 * Keyboard interactions when the grid body is focused:
 *   Arrow keys      — move active cell
 *   Page Up/Down    — jump by page
 *   Home/End        — first/last row
 *   Escape          — clear cell selection
 *   Ctrl+A          — select all cells in range
 */

import type { RaccoonGrid } from '../RaccoonGrid.js';
import { KEY } from '../utils/key.js';

type Grid = RaccoonGrid<Record<string, unknown>>;

export const KeyNavigationMixin = {
  initKeyNavigation(this: Grid): void {
    if (!this.bodyEl) return;

    this.bodyEl.setAttribute('tabindex', '0');
    this.bodyEl.addEventListener('keydown', (e) => this._onBodyKeyDown(e));
  },

  _onBodyKeyDown(this: Grid, e: KeyboardEvent): void {
    const page = Math.floor((this.scroller.viewHeight) / (this.config.rowHeight ?? 32));

    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case KEY.A:
          e.preventDefault();
          if (this.activeCell) {
            this.selectionRange = {
              startRow: 0,
              endRow: this.store.getDisplayedDataTotal() - 1,
              startCol: 0,
              endCol: this.visibleColumns.length - 1,
            };
            this._renderSelectionRange();
          }
          return;
      }
    }

    if (!this.activeCell) return;

    const { rowIndex, colIndex } = this.activeCell;

    switch (e.key) {
      case KEY.ARROW_UP:
        e.preventDefault();
        this._navigateTo(rowIndex - 1, colIndex);
        break;

      case KEY.ARROW_DOWN:
        e.preventDefault();
        this._navigateTo(rowIndex + 1, colIndex);
        break;

      case KEY.ARROW_LEFT:
        e.preventDefault();
        this._navigateTo(rowIndex, colIndex - 1);
        break;

      case KEY.ARROW_RIGHT:
        e.preventDefault();
        this._navigateTo(rowIndex, colIndex + 1);
        break;

      case KEY.PAGE_UP:
        e.preventDefault();
        this._navigateTo(Math.max(0, rowIndex - page), colIndex);
        break;

      case KEY.PAGE_DOWN:
        e.preventDefault();
        this._navigateTo(Math.min(this.store.getDisplayedDataTotal() - 1, rowIndex + page), colIndex);
        break;

      case KEY.HOME:
        e.preventDefault();
        this._navigateTo(e.ctrlKey ? 0 : rowIndex, 0);
        break;

      case KEY.END:
        e.preventDefault();
        this._navigateTo(
          e.ctrlKey ? this.store.getDisplayedDataTotal() - 1 : rowIndex,
          this.visibleColumns.length - 1
        );
        break;

      case KEY.ESCAPE:
        e.preventDefault();
        this.clearCellSelection();
        break;

      default:
        break;
    }
  },

  _navigateTo(this: Grid, rowIndex: number, colIndex: number): void {
    const maxRow = this.store.getDisplayedDataTotal() - 1;
    const maxCol = this.visibleColumns.length - 1;

    const ri = Math.max(0, Math.min(maxRow, rowIndex));
    const ci = Math.max(0, Math.min(maxCol, colIndex));

    this.setActiveCell(ri, ci);
  },
};
