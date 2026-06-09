/**
 * Raccoon Tables - Scroller
 *
 * Virtual scroll engine. Only DOM rows within the visible viewport + buffer
 * are ever rendered. Translates rows via CSS `transform: translateY()` rather
 * than top/margin to avoid layout thrashing.
 *
 * Coordinate system:
 *   scrollTop        — current Y scroll offset (pixels)
 *   rowHeight        — fixed height of every data row (px)
 *   headerHeight     — total height of header rows (px)
 *   viewHeight       — visible body height (px, changes on resize)
 *   totalRows        — total number of data rows
 *   bufferRows       — extra rows rendered above/below viewport (default 10)
 *
 * The engine exposes:
 *   - calcVisibleRows(): compute [startRow, endRow] from scrollTop
 *   - getColumnsViewRange(): compute [startCol, endCol] for horizontal virtual
 *   - scrollTo(rowIndex): programmatically scroll to a row
 *   - calcScrollBarWidth(): measure native scrollbar width (once, cached)
 */

import type { GridConfig, ColumnDef } from '../types.js';

export interface ScrollRange {
  start: number;
  end: number;
}

export interface ScrollerOptions {
  rowHeight: number;
  headerHeight: number;
  bufferRows?: number;
  defaultColumnWidth?: number;
}

export class Scroller {
  el: HTMLElement | null = null;
  bodyEl: HTMLElement | null = null;
  headerEl: HTMLElement | null = null;

  scrollTop = 0;
  scrollLeft = 0;

  rowHeight: number;
  headerHeight: number;
  bufferRows: number;
  defaultColumnWidth: number;

  viewHeight = 0;
  viewWidth = 0;
  totalRows = 0;
  scrollBarWidth = 0;

  startRow = 0;
  endRow = 0;

  columns: ColumnDef[] = [];
  startCol = 0;
  endCol = 0;

  private _resizeObserver: ResizeObserver | null = null;
  private _onResize?: () => void;
  private _animFrameId: number | null = null;

  constructor(opts: ScrollerOptions) {
    this.rowHeight = opts.rowHeight;
    this.headerHeight = opts.headerHeight;
    this.bufferRows = opts.bufferRows ?? 10;
    this.defaultColumnWidth = opts.defaultColumnWidth ?? 100;
    this.scrollBarWidth = Scroller.measureScrollBarWidth();
  }

  // -------------------------------------------------------------------------
  // Attach
  // -------------------------------------------------------------------------

  attach(el: HTMLElement, bodyEl: HTMLElement, headerEl: HTMLElement, onResize: () => void): void {
    this.el = el;
    this.bodyEl = bodyEl;
    this.headerEl = headerEl;
    this._onResize = onResize;

    this.viewHeight = bodyEl.clientHeight;
    this.viewWidth = bodyEl.clientWidth;

    this._resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const oldH = this.viewHeight;
        const oldW = this.viewWidth;
        this.viewHeight = height;
        this.viewWidth = width;
        if (oldH !== height || oldW !== width) this._onResize?.();
      }
    });
    this._resizeObserver.observe(bodyEl);
  }

  detach(): void {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    if (this._animFrameId !== null) cancelAnimationFrame(this._animFrameId);
    this._animFrameId = null;
  }

  // -------------------------------------------------------------------------
  // Row range
  // -------------------------------------------------------------------------

  calcVisibleRows(): ScrollRange {
    const rawStart = Math.floor(this.scrollTop / this.rowHeight) - this.bufferRows;
    const rawEnd = Math.ceil((this.scrollTop + this.viewHeight) / this.rowHeight) + this.bufferRows;

    this.startRow = Math.max(0, rawStart);
    this.endRow = Math.min(this.totalRows - 1, rawEnd);

    return { start: this.startRow, end: this.endRow };
  }

  getStartRow(): number {
    return this.startRow;
  }

  getEndRow(): number {
    return this.endRow;
  }

  generateNewRange(): ScrollRange | null {
    const newStart = Math.max(0, Math.floor(this.scrollTop / this.rowHeight) - this.bufferRows);
    const newEnd = Math.min(
      this.totalRows - 1,
      Math.ceil((this.scrollTop + this.viewHeight) / this.rowHeight) + this.bufferRows
    );

    if (newStart === this.startRow && newEnd === this.endRow) return null;

    this.startRow = newStart;
    this.endRow = newEnd;
    return { start: newStart, end: newEnd };
  }

  isRowVisible(rowIndex: number): boolean {
    const rowTop = rowIndex * this.rowHeight;
    return rowTop >= this.scrollTop && rowTop < this.scrollTop + this.viewHeight;
  }

  getRowTop(rowIndex: number): number {
    return rowIndex * this.rowHeight;
  }

  // -------------------------------------------------------------------------
  // Column range (horizontal virtual scrolling)
  // -------------------------------------------------------------------------

  setColumns(columns: ColumnDef[]): void {
    this.columns = columns;
  }

  getColumnsViewRange(): ScrollRange {
    let accWidth = 0;
    let start = -1;
    let end = -1;

    for (let i = 0; i < this.columns.length; i++) {
      const col = this.columns[i];
      const colWidth = col.width ?? this.defaultColumnWidth;

      if (start === -1 && accWidth + colWidth > this.scrollLeft) {
        start = Math.max(0, i - 1);
      }

      accWidth += colWidth;

      if (accWidth > this.scrollLeft + this.viewWidth) {
        end = Math.min(this.columns.length - 1, i + 1);
        break;
      }
    }

    if (start === -1) start = 0;
    if (end === -1) end = this.columns.length - 1;

    this.startCol = start;
    this.endCol = end;
    return { start, end };
  }

  getColumnLeft(colIndex: number): number {
    let left = 0;
    for (let i = 0; i < colIndex; i++) {
      left += this.columns[i]?.width ?? this.defaultColumnWidth;
    }
    return left;
  }

  getTotalColumnsWidth(): number {
    return this.columns.reduce((sum, c) => sum + (c.width ?? this.defaultColumnWidth), 0);
  }

  // -------------------------------------------------------------------------
  // Scroll
  // -------------------------------------------------------------------------

  onScroll(scrollTop: number, scrollLeft: number): boolean {
    const changed = scrollTop !== this.scrollTop || scrollLeft !== this.scrollLeft;
    this.scrollTop = scrollTop;
    this.scrollLeft = scrollLeft;
    return changed;
  }

  scrollTo(rowIndex: number, alignTop = true): void {
    const targetTop = rowIndex * this.rowHeight;
    if (alignTop) {
      this.scrollTop = targetTop;
    } else {
      const visibleBottom = this.scrollTop + this.viewHeight - this.rowHeight;
      if (targetTop < this.scrollTop) {
        this.scrollTop = targetTop;
      } else if (targetTop > visibleBottom) {
        this.scrollTop = targetTop - this.viewHeight + this.rowHeight;
      }
    }
    if (this.bodyEl) this.bodyEl.scrollTop = this.scrollTop;
  }

  scrollToColumn(colIndex: number): void {
    const colLeft = this.getColumnLeft(colIndex);
    const colWidth = this.columns[colIndex]?.width ?? this.defaultColumnWidth;
    if (colLeft < this.scrollLeft) {
      this.scrollLeft = colLeft;
    } else if (colLeft + colWidth > this.scrollLeft + this.viewWidth) {
      this.scrollLeft = colLeft + colWidth - this.viewWidth;
    }
    if (this.bodyEl) this.bodyEl.scrollLeft = this.scrollLeft;
  }

  // -------------------------------------------------------------------------
  // Delta helpers (used by mouse/touch scroll handlers)
  // -------------------------------------------------------------------------

  deltaChange(delta: number): boolean {
    const prevTop = this.scrollTop;
    const maxTop = Math.max(0, this.totalRows * this.rowHeight - this.viewHeight);
    this.scrollTop = Math.max(0, Math.min(maxTop, this.scrollTop + delta));
    if (this.bodyEl) this.bodyEl.scrollTop = this.scrollTop;
    return this.scrollTop !== prevTop;
  }

  horizontalDeltaChange(delta: number): boolean {
    const prevLeft = this.scrollLeft;
    const maxLeft = Math.max(0, this.getTotalColumnsWidth() - this.viewWidth);
    this.scrollLeft = Math.max(0, Math.min(maxLeft, this.scrollLeft + delta));
    if (this.bodyEl) this.bodyEl.scrollLeft = this.scrollLeft;
    return this.scrollLeft !== prevLeft;
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  getTotalBodyHeight(): number {
    return this.totalRows * this.rowHeight;
  }

  static measureScrollBarWidth(): number {
    if (typeof document === 'undefined') return 0;
    const outer = document.createElement('div');
    outer.style.cssText = 'overflow:scroll;position:absolute;visibility:hidden;width:100px;height:100px;top:-9999px';
    document.body.appendChild(outer);
    const width = outer.offsetWidth - outer.clientWidth;
    document.body.removeChild(outer);
    return width;
  }
}
