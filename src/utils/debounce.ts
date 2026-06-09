/**
 * Creates a debounced version of a function.
 * The debounced function delays invoking `fn` until `delay` milliseconds
 * have elapsed since the last invocation.
 *
 * @param fn - The function to debounce.
 * @param delay - Delay in milliseconds.
 * @returns The debounced function with a `cancel()` method.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function debounced(...args: Parameters<T>) {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  }

  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}
