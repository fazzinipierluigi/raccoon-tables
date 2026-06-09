/**
 * DOM utility helpers for Raccoon Tables.
 * Provides fast, typed element creation and DOM manipulation functions.
 */

type StyleMap = Partial<CSSStyleDeclaration> & Record<string, string | undefined>;

/**
 * Create and configure a DOM element with optional CSS classes and inline styles.
 * This is the primary element factory used throughout Raccoon Tables.
 *
 * @param tag - HTML tag name
 * @param cls - string, string[], or empty for no class
 * @param style - optional inline style properties
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string | string[] = [],
  style: StyleMap = {}
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (Array.isArray(cls)) {
    if (cls.length) element.classList.add(...cls.filter(Boolean));
  } else if (cls) {
    element.classList.add(cls);
  }

  for (const key in style) {
    const val = style[key];
    if (val !== undefined) {
      (element.style as unknown as Record<string, string>)[key] = val;
    }
  }

  return element;
}

/** Create a div element. */
export const div = (cls: string | string[] = [], style: StyleMap = {}) => el('div', cls, style);
/** Create a span element. */
export const span = (cls: string | string[] = [], style: StyleMap = {}) => el('span', cls, style);
/** Create an input element. */
export const input = (cls: string | string[] = [], style: StyleMap = {}) => el('input', cls, style);

/**
 * Extract the translateY value from an element's CSS transform.
 * Used for virtual scrolling row position tracking.
 */
export function getTranslateY(element: HTMLElement): number {
  const transform = element.style.transform || getComputedStyle(element).transform;
  if (!transform || transform === 'none') return 0;
  const match = transform.match(/translateY\(([^)]+)px\)/);
  if (match) return parseFloat(match[1]);
  // fallback: matrix(a,b,c,d,tx,ty)
  const matrixMatch = transform.match(/matrix.*\((.+)\)/);
  if (!matrixMatch) return 0;
  const parts = matrixMatch[1].split(',').map(parseFloat);
  return parts.length === 6 ? parts[5] : 0;
}

/**
 * Detect the native scrollbar width of the current browser/OS.
 * Returns a cached value after first call.
 */
let _cachedScrollbarWidth: number | null = null;
export function getScrollbarWidth(): number {
  if (_cachedScrollbarWidth !== null) return _cachedScrollbarWidth;

  const outer = div([], { width: '100px', height: '100px', overflow: 'scroll', position: 'absolute', opacity: '0' });
  document.body.appendChild(outer);
  const width = outer.offsetWidth - outer.clientWidth;
  document.body.removeChild(outer);

  _cachedScrollbarWidth = width === 0 ? 16 : width;
  return _cachedScrollbarWidth;
}

/**
 * Detect touch device.
 */
export const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
