/**
 * Built-in value formatters for Raccoon Tables columns.
 */
import type { CellParams } from '../types.js';

/** Format a number as currency. Respects column.currency, column.minDecimal, column.maxDecimal. */
export function formatCurrency(params: CellParams): string {
  const { value, currency = 'USD', minDecimal = 2, maxDecimal = 2 } = params;
  const numVal = Number(value);

  if (isNaN(numVal)) return String(value ?? '');

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: minDecimal,
      maximumFractionDigits: maxDecimal,
    }).format(numVal);
  } catch {
    return numVal.toFixed(maxDecimal);
  }
}

/** Format a value as a fixed-decimal number. */
export function formatNumber(value: unknown, decimals = 0): string {
  const numVal = Number(value);
  if (isNaN(numVal)) return '';
  return numVal.toFixed(decimals);
}

/** Format a Date or ISO string as a locale date string. */
export function formatDate(value: unknown, locale?: string): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(locale);
}
