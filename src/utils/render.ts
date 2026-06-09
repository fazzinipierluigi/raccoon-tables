/**
 * Built-in cell renderers for Raccoon Tables.
 */
import type { CellParams } from '../types.js';

/** Render a boolean column as a checkbox (read-only or editable). */
export function renderBoolean(params: CellParams): string {
  const { value, column } = params;
  const checked = value === true || value === 'true' || value === 1 ? 'checked' : '';
  const disabled = column.editable ? '' : 'disabled';

  return `<input type="checkbox" class="rt-input-checkbox" ${checked} ${disabled} data-rt-bool>`;
}

/** Render a row-order cell with the 1-based row index. */
export function renderOrder(params: CellParams): string {
  return `<span class="rt-cell-order">${params.rowIndex + 1}</span>`;
}
