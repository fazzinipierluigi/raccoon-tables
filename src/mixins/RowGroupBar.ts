/**
 * Raccoon Tables - RowGroupBar mixin
 *
 * The row group bar is a drag-and-drop area above the grid header.
 * Users drag column headers into the bar to group data by that column.
 * Chips in the bar can be reordered by drag or removed with the × button.
 */

import type { RaccoonGrid } from '../RaccoonGrid.js';
import { cls } from '../utils/cls.js';
import { div, span } from '../utils/dom.js';
import { svg } from '../utils/svg.js';

type Grid = RaccoonGrid<Record<string, unknown>>;

export const RowGroupBarMixin = {
  renderRowGroupBar(this: Grid): void {
    if (!this.rowGroupBarEl) return;
    this.rowGroupBarEl.innerHTML = '';

    if (!this.store.rowGroups.length) {
      const emptyEl = div(cls.rowGroupBarEmpty);
      emptyEl.textContent = this.config.rowGroupBarText ?? 'Drag a column header here to group by it';
      this.rowGroupBarEl.appendChild(emptyEl);
    } else {
      for (const index of this.store.rowGroups) {
        const col = this.allColumns.find(c => c.index === index);
        const chip = this.createRowGroupBarChip(col?.text ?? index, index);
        this.rowGroupBarEl.appendChild(chip);
      }
    }

    // Drop zone
    this.rowGroupBarEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.rowGroupBarEl!.classList.add(cls.rowGroupBarDragOver);
    });

    this.rowGroupBarEl.addEventListener('dragleave', () => {
      this.rowGroupBarEl!.classList.remove(cls.rowGroupBarDragOver);
    });

    this.rowGroupBarEl.addEventListener('drop', (e) => {
      e.preventDefault();
      this.rowGroupBarEl!.classList.remove(cls.rowGroupBarDragOver);
      const index = e.dataTransfer?.getData('text/rt-column-index');
      if (index) this.addGroupToBar(index);
    });
  },

  createRowGroupBarChip(this: Grid, label: string, index: string): HTMLElement {
    const chip = div(cls.rowGroupBarChip);
    chip.draggable = true;
    chip.dataset['index'] = index;

    const dragHandle = span(cls.rowGroupBarChipDrag);
    dragHandle.innerHTML = svg.drag;
    chip.appendChild(dragHandle);

    const labelEl = span(cls.rowGroupBarChipLabel);
    labelEl.textContent = label;
    chip.appendChild(labelEl);

    const removeBtn = span(cls.rowGroupBarChipRemove);
    removeBtn.innerHTML = svg.remove;
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeGroupFromBar(index);
    });
    chip.appendChild(removeBtn);

    // Drag reorder
    chip.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/rt-group-index', index);
      chip.classList.add(cls.rowGroupBarChipDragging);
    });

    chip.addEventListener('dragend', () => {
      chip.classList.remove(cls.rowGroupBarChipDragging);
    });

    chip.addEventListener('dragover', (e) => {
      e.preventDefault();
      chip.classList.add(cls.rowGroupBarChipDragOver);
    });

    chip.addEventListener('dragleave', () => {
      chip.classList.remove(cls.rowGroupBarChipDragOver);
    });

    chip.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      chip.classList.remove(cls.rowGroupBarChipDragOver);
      const fromIndex = e.dataTransfer?.getData('text/rt-group-index');
      if (!fromIndex || fromIndex === index) return;
      this.changeRowGroupBarItemOrder(fromIndex, index);
    });

    return chip;
  },

  changeRowGroupBarItemOrder(this: Grid, fromIndex: string, toIndex: string): void {
    const groups = [...this.store.rowGroups];
    const from = groups.indexOf(fromIndex);
    const to = groups.indexOf(toIndex);
    if (from === -1 || to === -1 || from === to) return;

    groups.splice(from, 1);
    groups.splice(to, 0, fromIndex);
    this.reConfigRowGroups(groups);
  },
};
