import type { GridConfig, RowData } from '../../src/types.js';
import { RaccoonGrid } from '../../src/RaccoonGrid.js';

/** Mount a grid in a fixed-size container appended to document.body. */
export function mountGrid<T extends RowData>(config: GridConfig<T>): {
  grid: RaccoonGrid<T>;
  container: HTMLElement;
  cleanup: () => void;
} {
  const container = document.createElement('div');
  container.style.width  = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);

  const grid = new RaccoonGrid({ height: 500, ...config });
  grid.render(container);

  return {
    grid,
    container,
    cleanup: () => {
      grid.destroy();
      container.remove();
    },
  };
}

/** Wait until predicate returns true or timeout. */
export async function waitFor(predicate: () => boolean, timeout = 2000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeout) return reject(new Error('waitFor timeout'));
      requestAnimationFrame(check);
    };
    check();
  });
}

/** Return all visible row elements sorted by data-row-index (visual order, not DOM order). */
export function getRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-row-index]'))
    .filter(el => !el.classList.contains('rt-row-group'))
    .sort((a, b) => Number(a.dataset['rowIndex']) - Number(b.dataset['rowIndex']));
}

/** Return text content of all cells for a specific column index (data field). */
export function getColumnTexts(container: HTMLElement, colIndex: string): string[] {
  const rows = getRows(container);
  return rows.map(row => {
    const cell = row.querySelector<HTMLElement>(`[data-index="${colIndex}"]`);
    return cell?.textContent?.trim() ?? '';
  });
}

/** Return left pixel positions of cells in a given column. */
export function getCellLeftValues(container: HTMLElement, colIndex: string): number[] {
  const rows = getRows(container);
  return rows.map(row => {
    const cell = row.querySelector<HTMLElement>(`[data-index="${colIndex}"]`);
    return parseInt(cell?.style.left ?? '0', 10);
  });
}
