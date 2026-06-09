/**
 * Raccoon Tables - Edit mixin
 *
 * Inline cell editing. Flow:
 *   1. dblclick on editable cell → openEditorForCell()
 *   2. Editor element overlaid on the cell
 *   3. Confirm: Enter / Tab / click outside → commitEdit()
 *   4. Cancel: Escape → cancelEdit()
 *
 * Supports column types: string, number, boolean, date.
 * Custom editors can be injected via col.editorComponent.
 *
 * After commit, the cell is updated in the store (setById),
 * flash animation is triggered, and onChange callback is called.
 * If col.setter is provided it is used instead of direct assignment.
 */

import type { RaccoonGrid } from '../RaccoonGrid.js';
import type { GridItem, ColumnDef } from '../types.js';
import { cls } from '../utils/cls.js';
import { div, input } from '../utils/dom.js';

type Grid = RaccoonGrid<Record<string, unknown>>;

export const EditMixin = {
  openEditorForCell(this: Grid, item: GridItem, col: ColumnDef, rowIndex: number, cellEl: HTMLElement): void {
    if (!col.editable) return;
    this.hideActiveEditor();

    const rawValue = col.getter ? col.getter({ item, column: col }) : item[col.index!];
    const cellRect = cellEl.getBoundingClientRect();
    const bodyRect = this.el!.getBoundingClientRect();

    const editorWrap = div(cls.editor);
    editorWrap.style.position = 'absolute';
    editorWrap.style.top = `${cellRect.top - bodyRect.top + this._calcHeaderHeight() + this.scroller.scrollTop}px`;
    editorWrap.style.left = `${cellRect.left - bodyRect.left + this.scroller.scrollLeft}px`;
    editorWrap.style.width = `${col.width ?? this.config.defaultColumnWidth ?? 100}px`;
    editorWrap.style.height = `${this.config.rowHeight ?? 32}px`;
    editorWrap.style.zIndex = '100';

    let editorEl: HTMLInputElement | HTMLElement;

    if (col.editorComponent) {
      editorEl = col.editorComponent({ item, column: col, value: rawValue, rowIndex, grid: this as unknown as Grid });
    } else {
      editorEl = this._createDefaultEditor(col, rawValue);
    }

    editorWrap.appendChild(editorEl);
    this.el!.appendChild(editorWrap);
    this._activeEditor = { editorWrap, editorEl, item, col, rowIndex, cellEl };

    if (editorEl instanceof HTMLInputElement) {
      editorEl.focus();
      editorEl.select();
    } else {
      (editorEl.querySelector('input') ?? editorEl as HTMLElement).focus();
    }

    // Keyboard events
    editorEl.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter') {
        ke.preventDefault();
        this.commitEdit();
      } else if (ke.key === 'Escape') {
        this.cancelEdit();
      } else if (ke.key === 'Tab') {
        ke.preventDefault();
        this.commitEdit();
        const dir = ke.shiftKey ? -1 : 1;
        this._moveEditToAdjacentCell(col, rowIndex, dir);
      }
    });

    // Close on outside click
    const outsideHandler = (ev: MouseEvent) => {
      if (!editorWrap.contains(ev.target as Node)) {
        this.commitEdit();
        document.removeEventListener('mousedown', outsideHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', outsideHandler), 0);
  },

  _createDefaultEditor(this: Grid, col: ColumnDef, value: unknown): HTMLInputElement {
    const inp = input(cls.editorInput);
    inp.type = col.type === 'number' || col.type === 'currency' ? 'number' : 'text';

    if (col.type === 'date') {
      inp.type = 'date';
      if (value instanceof Date) {
        inp.value = value.toISOString().slice(0, 10);
      } else if (typeof value === 'string') {
        inp.value = value.slice(0, 10);
      }
    } else if (col.type === 'boolean') {
      inp.type = 'checkbox';
      inp.checked = value === true || value === 1 || value === 'true';
    } else {
      inp.value = String(value ?? '');
    }

    if (col.editorOptions) {
      Object.assign(inp, col.editorOptions);
    }

    return inp;
  },

  commitEdit(this: Grid): void {
    if (!this._activeEditor) return;
    const { editorWrap, editorEl, item, col, rowIndex, cellEl } = this._activeEditor;

    let newValue: unknown;

    if (col.editorComponent && typeof (editorEl as unknown as { getValue?: () => unknown }).getValue === 'function') {
      newValue = (editorEl as unknown as { getValue: () => unknown }).getValue();
    } else {
      const inp = (editorEl instanceof HTMLInputElement ? editorEl : editorEl.querySelector('input')) as HTMLInputElement | null;
      if (!inp) {
        this.cancelEdit();
        return;
      }

      if (col.type === 'boolean') {
        newValue = inp.checked;
      } else if (col.type === 'number' || col.type === 'currency') {
        newValue = parseFloat(inp.value);
        if (isNaN(newValue as number)) newValue = null;
      } else {
        newValue = inp.value;
      }
    }

    const oldValue = col.getter ? col.getter({ item, column: col }) : item[col.index!];

    if (newValue !== oldValue) {
      if (col.setter) {
        col.setter({ item, column: col, value: newValue });
      } else {
        this.store.setById(item.id, col.index!, newValue);
      }

      // Flash the cell
      if (this.config.flashChanges !== false) {
        this.flashCells(item.id, [col.index!]);
      }

      this.config.onChange?.({ item, column: col, value: newValue, oldValue });

      // Re-render the single cell
      this._updateCellInRow(item, col, rowIndex, cellEl);
    }

    editorWrap.remove();
    this._activeEditor = undefined;
  },

  cancelEdit(this: Grid): void {
    if (!this._activeEditor) return;
    this._activeEditor.editorWrap.remove();
    this._activeEditor = undefined;
  },

  hideActiveEditor(this: Grid): void {
    this.cancelEdit();
  },

  _updateCellInRow(this: Grid, item: GridItem, col: ColumnDef, rowIndex: number, cellEl: HTMLElement): void {
    // Re-create cell content (not the container)
    const params = {
      value: col.getter ? col.getter({ item, column: col }) : item[col.index!],
      item,
      column: col,
      rowIndex,
      grid: this as unknown as Grid,
      currency: col.currency,
      minDecimal: col.minDecimal,
      maxDecimal: col.maxDecimal,
    };
    cellEl.innerHTML = col.render ? col.render(params) : this.getCellDisplayValue(params);
  },

  _moveEditToAdjacentCell(this: Grid, col: ColumnDef, rowIndex: number, dir: number): void {
    const colIdx = this.visibleColumns.findIndex(c => c.id === col.id);
    const nextColIdx = colIdx + dir;

    if (nextColIdx >= 0 && nextColIdx < this.visibleColumns.length) {
      const nextCol = this.visibleColumns[nextColIdx];
      if (!nextCol.editable) return;

      const item = this.store.getItemByRowIndex(rowIndex);
      if (!item) return;

      const rowEl = this.bodyEl?.querySelector<HTMLElement>(`[data-row-index="${rowIndex}"]`);
      const cellEl = rowEl?.querySelector<HTMLElement>(`[data-col-id="${nextCol.id}"]`);
      if (cellEl) this.openEditorForCell(item, nextCol, rowIndex, cellEl);
    }
  },

  // -------------------------------------------------------------------------
  // Clipboard (copy/paste for cell ranges)
  // -------------------------------------------------------------------------

  copySelectedCells(this: Grid): void {
    if (!this.selectionRange) return;
    const { startRow, endRow, startCol, endCol } = this.selectionRange;
    const lines: string[] = [];

    for (let ri = startRow; ri <= endRow; ri++) {
      const item = this.store.getItemByRowIndex(ri);
      if (!item) continue;
      const cells: string[] = [];
      for (let ci = startCol; ci <= endCol; ci++) {
        const col = this.visibleColumns[ci];
        if (!col) continue;
        const v = col.getter ? col.getter({ item, column: col }) : item[col.index!];
        cells.push(String(v ?? ''));
      }
      lines.push(cells.join('\t'));
    }

    const text = lines.join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => this._copyFallback(text));
    } else {
      this._copyFallback(text);
    }
  },

  _copyFallback(this: Grid, text: string): void {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  },

  insertCopiedCells(this: Grid, text: string): void {
    if (!this.activeCell || !text) return;
    const lines = text.split('\n');
    const { rowIndex: startRow, colIndex: startCol } = this.activeCell;

    for (let ri = 0; ri < lines.length; ri++) {
      const cells = lines[ri].split('\t');
      const item = this.store.getItemByRowIndex(startRow + ri);
      if (!item) continue;

      for (let ci = 0; ci < cells.length; ci++) {
        const col = this.visibleColumns[startCol + ci];
        if (!col?.editable) continue;
        const val = cells[ci];
        if (col.setter) {
          col.setter({ item, column: col, value: val });
        } else {
          this.store.setById(item.id, col.index!, val);
        }
      }

      if (this.config.flashChanges !== false) {
        for (let ci = 0; ci < cells.length; ci++) {
          const col = this.visibleColumns[startCol + ci];
          if (col?.index) this.flashCells(item.id, [col.index]);
        }
      }
    }

    this.renderVisibleRows();
  },

  setBlankForSelectedCells(this: Grid): void {
    if (!this.selectionRange) return;
    const { startRow, endRow, startCol, endCol } = this.selectionRange;

    for (let ri = startRow; ri <= endRow; ri++) {
      const item = this.store.getItemByRowIndex(ri);
      if (!item) continue;
      for (let ci = startCol; ci <= endCol; ci++) {
        const col = this.visibleColumns[ci];
        if (!col?.editable) continue;
        if (col.setter) {
          col.setter({ item, column: col, value: '' });
        } else {
          this.store.setById(item.id, col.index!, '');
        }
      }
    }

    this.renderVisibleRows();
  },
};
