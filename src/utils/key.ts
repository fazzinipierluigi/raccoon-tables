/**
 * Keyboard key constants used in Raccoon Tables key navigation and editing.
 */
export const KEY = {
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
  HOME: 'Home',
  END: 'End',
  DELETE: 'Delete',
  BACKSPACE: 'Backspace',
  C: 'c',
  V: 'v',
  A: 'a',
} as const;

/** Returns true if the key is a printable character (would start editing). */
export function isPrintableKey(e: KeyboardEvent): boolean {
  return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
}
