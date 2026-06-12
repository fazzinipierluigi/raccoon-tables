/**
 * Miscellaneous utility functions for Raccoon Tables.
 */

/** Capitalize the first letter of a string. */
export function capitalizeFirstLetter(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Convert a string to camelCase. E.g. "not-contains" -> "notContains". */
export function toCamelCase(str: string): string {
  return str.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
}

/** Deep clone a plain object/array (does not handle class instances or functions). */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return (obj as unknown[]).map(deepClone) as unknown as T;

  const clone: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clone[key] = deepClone((obj as Record<string, unknown>)[key]);
    }
  }
  return clone as T;
}

/** Determine the type of a value with extended support for arrays, dates, etc. */
export type ExtendedType =
  | 'null'
  | 'undefined'
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'function'
  | 'date'
  | 'regexp';

export function typeOf(value: unknown): ExtendedType {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'function') return t;
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (value instanceof RegExp) return 'regexp';
  return 'object';
}

/** Copy text to the system clipboard. */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for older browsers
  const textarea = document.createElement('textarea');
  textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

/** Generate a unique string ID. */
let _idSeed = 0;
export function generateUID(prefix = 'rt'): string {
  return `${prefix}-${Date.now()}-${_idSeed++}`;
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Map sign text labels to internal sign codes. */
export const TEXT_TO_SIGN: Record<string, string> = {
  'Clear': '=',
  'List': 'in',
  'Contains': '=',
  'Not Contains': '!=',
  'Equals': '==',
  'Not Equals': '!==',
  'Empty': 'empty',
  'Not Empty': '!empty',
  'Starts with': 'a_',
  'Ends with': '_a',
  'Regex': 'regex',
  'Greater Than': '>',
  'Less Than': '<',
  'Greater or Equal': '>=',
  'Less or Equal': '<=',
  'Positive': '+',
  'Negative': '-',
  'T': 'T',
  'F': 'F',
  // Date-specific labels (map to same sign codes)
  'After': '>',
  'Before': '<',
  'After or Equal': '>=',
  'Before or Equal': '<=',
};

export const SIGN_TO_TEXT: Record<string, string> = {
  '=': 'Contains',
  'in': 'List',
  '!=': 'Not Contains',
  '==': 'Equals',
  '!==': 'Not Equals',
  'empty': 'Empty',
  '!empty': 'Not Empty',
  'a_': 'Starts with',
  '_a': 'Ends with',
  'regex': 'Regex',
  '>': 'Greater Than',
  '<': 'Less Than',
  '>=': 'Greater or Equal',
  '<=': 'Less or Equal',
  '+': 'Positive',
  '-': 'Negative',
  'T': 'True',
  'F': 'False',
};
