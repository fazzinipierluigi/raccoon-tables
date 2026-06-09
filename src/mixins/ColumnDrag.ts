/**
 * Raccoon Tables - ColumnDrag mixin
 *
 * Drag-to-reorder column headers.
 * Shows a floating clone of the dragged header cell as ghost,
 * highlights the drop target column, and calls moveColumn() on drop.
 */

import type { RaccoonGrid } from '../RaccoonGrid.js';
import type { ColumnDef } from '../types.js';
import { cls } from '../utils/cls.js';
import { div } from '../utils/dom.js';

type Grid = RaccoonGrid<Record<string, unknown>>;

export const ColumnDragMixin = {
  initColumnDrag(this: Grid): void {
    if (!this.headerEl || this.config.columnDrag === false) return;

    this.headerEl.addEventListener('mousedown', (e) => {
      if ((e as MouseEvent).button !== 0) return;
      const target = e.target as HTMLElement;
      const headerCell = target.closest<HTMLElement>(`.${cls.headerCell}`);
      if (!headerCell || target.closest(`.${cls.headerCellResizeHandle}`) || target.closest(`.${cls.headerCellMenuBtn}`)) return;

      const colId = headerCell.dataset['colId'];
      if (!colId) return;
      const col = this.columnsById[colId];
      if (!col || col.draggable === false) return;

      this._onColumnDragStart(e, col, headerCell);
    });
  },

  _onColumnDragStart(this: Grid, e: MouseEvent, col: ColumnDef, headerCell: HTMLElement): void {
    e.preventDefault();

    const startX = e.clientX;
    let dragging = false;
    let ghostEl: HTMLElement | null = null;
    let dropTargetId: string | null = null;

    const onMove = (ev: MouseEvent) => {
      if (!dragging && Math.abs(ev.clientX - startX) > 5) {
        dragging = true;
        ghostEl = this._createDragColumnGhost(headerCell, col);
        document.body.appendChild(ghostEl!);
        headerCell.classList.add(cls.headerCellDragging);
        document.body.classList.add(cls.columnDragging);
      }

      if (!dragging || !ghostEl) return;

      ghostEl.style.left = `${ev.clientX + 8}px`;
      ghostEl.style.top = `${ev.clientY + 8}px`;

      // Find drop target
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const targetCell = el?.closest<HTMLElement>(`.${cls.headerCell}`);
      const newDropId = targetCell?.dataset['colId'] ?? null;

      if (newDropId !== dropTargetId) {
        if (dropTargetId) {
          this.headerEl?.querySelector<HTMLElement>(`[data-col-id="${dropTargetId}"]`)
            ?.classList.remove(cls.headerCellDropTarget);
        }
        dropTargetId = newDropId;
        if (dropTargetId && dropTargetId !== col.id) {
          targetCell?.classList.add(cls.headerCellDropTarget);
        }
      }

      // Also check if over row group bar
      if (this.rowGroupBarEl) {
        const barRect = this.rowGroupBarEl.getBoundingClientRect();
        const overBar = ev.clientX >= barRect.left && ev.clientX <= barRect.right
          && ev.clientY >= barRect.top && ev.clientY <= barRect.bottom;
        this.rowGroupBarEl.classList.toggle(cls.rowGroupBarDragOver, overBar);
      }
    };

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      ghostEl?.remove();
      headerCell.classList.remove(cls.headerCellDragging);
      document.body.classList.remove(cls.columnDragging);

      if (dropTargetId) {
        this.headerEl?.querySelector<HTMLElement>(`[data-col-id="${dropTargetId}"]`)
          ?.classList.remove(cls.headerCellDropTarget);
      }

      this.rowGroupBarEl?.classList.remove(cls.rowGroupBarDragOver);

      if (!dragging) return;

      // Drop on row group bar
      if (this.rowGroupBarEl) {
        const barRect = this.rowGroupBarEl.getBoundingClientRect();
        const overBar = ev.clientX >= barRect.left && ev.clientX <= barRect.right
          && ev.clientY >= barRect.top && ev.clientY <= barRect.bottom;
        if (overBar && col.index) {
          this.addGroupToBar(col.index);
          return;
        }
      }

      // Drop on another column
      if (dropTargetId && dropTargetId !== col.id) {
        this.moveColumn(col.id, dropTargetId);
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  },

  _createDragColumnGhost(this: Grid, headerCell: HTMLElement, col: ColumnDef): HTMLElement {
    const ghost = div(cls.columnDragGhost);
    ghost.textContent = col.text ?? col.index ?? '';
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '99999';
    ghost.style.width = `${col.width ?? this.config.defaultColumnWidth ?? 100}px`;
    ghost.style.opacity = '0.8';
    return ghost;
  },
};
