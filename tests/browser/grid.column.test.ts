import { describe, it, expect, afterEach } from 'vitest';
import { mountGrid, waitFor, getRows, getColumnTexts, getCellLeftValues } from './helpers.js';
import type { ColumnDef } from '../../src/types.js';

const COLS: ColumnDef[] = [
  { id: 'col-a', text: 'Column A', index: 'a', width: 150 } as ColumnDef,
  { id: 'col-b', text: 'Column B', index: 'b', width: 150 } as ColumnDef,
  { id: 'col-c', text: 'Column C', index: 'c', width: 150 } as ColumnDef,
];

const DATA = [
  { a: 'A1', b: 'B1', c: 'C1' },
  { a: 'A2', b: 'B2', c: 'C2' },
  { a: 'A3', b: 'B3', c: 'C3' },
];

describe('grid: column reorder (moveColumn)', () => {
  let cleanup: () => void;

  afterEach(() => cleanup?.());

  it('header shows new column order after moveColumn', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length > 0);

    // Move col-a after col-c (A becomes last)
    grid.moveColumn('col-a', 'col-c');
    await new Promise(r => requestAnimationFrame(r));

    const headerCells = Array.from(container.querySelectorAll<HTMLElement>('.rt-header-cell'));
    const texts = headerCells.map(c => c.textContent?.trim()).filter(Boolean);
    // col-b should now be first
    expect(texts[0]).toContain('Column B');
    expect(texts[texts.length - 1]).toContain('Column A');
  });

  it('data cells move with header after moveColumn', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length > 0);

    // Before: col-a (index=a) is leftmost → left=0
    const leftsBefore = getCellLeftValues(container, 'a');
    expect(leftsBefore[0]).toBe(0);

    // Move col-a to after col-c
    grid.moveColumn('col-a', 'col-c');
    await waitFor(() => {
      const lefts = getCellLeftValues(container, 'a');
      return lefts[0] !== 0;
    });

    // col-a cells should no longer be at left=0
    const leftsAfter = getCellLeftValues(container, 'a');
    expect(leftsAfter[0]).toBeGreaterThan(0);
  });

  it('all rows update cell positions consistently after moveColumn', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length === 3);

    grid.moveColumn('col-b', 'col-a');
    await new Promise(r => requestAnimationFrame(r));

    // col-b should now be at left=0 (swapped to first)
    const lefts = getCellLeftValues(container, 'b');
    // All rows should have same left for col-b
    expect(lefts[0]).toBe(lefts[1]);
    expect(lefts[0]).toBe(lefts[2]);
  });

  it('cell content is correct after column reorder', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length === 3);

    grid.moveColumn('col-a', 'col-c');
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));

    // col-a data should still show A1, A2, A3 (just moved, content unchanged)
    const aTexts = getColumnTexts(container, 'a');
    expect(aTexts).toEqual(['A1', 'A2', 'A3']);

    const bTexts = getColumnTexts(container, 'b');
    expect(bTexts).toEqual(['B1', 'B2', 'B3']);
  });
});

describe('grid: showColumn / hideColumn', () => {
  let cleanup: () => void;

  afterEach(() => cleanup?.());

  it('hideColumn removes cells from rows', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length > 0);

    grid.hideColumn('col-b');
    await new Promise(r => requestAnimationFrame(r));

    // col-b cells should be gone
    const row = getRows(container)[0];
    expect(row.querySelector('[data-col-id="col-b"]')).toBeNull();
  });

  it('showColumn restores cells after hide', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length > 0);

    grid.hideColumn('col-b');
    await new Promise(r => requestAnimationFrame(r));

    grid.showColumn('col-b');
    await waitFor(() => {
      const row = getRows(container)[0];
      return row.querySelector('[data-col-id="col-b"]') !== null;
    });

    const row = getRows(container)[0];
    expect(row.querySelector('[data-col-id="col-b"]')).not.toBeNull();
  });
});

describe('grid: setColumnWidth', () => {
  let cleanup: () => void;

  afterEach(() => cleanup?.());

  it('updates cell width after setColumnWidth', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length > 0);

    grid.setColumnWidth('col-a', 250);
    await new Promise(r => requestAnimationFrame(r));

    const row = getRows(container)[0];
    const cell = row.querySelector<HTMLElement>('[data-col-id="col-a"]');
    expect(cell?.style.width).toBe('250px');
  });

  it('adjacent column shifts left after setColumnWidth', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length > 0);

    const bLeftBefore = getCellLeftValues(container, 'b')[0];

    grid.setColumnWidth('col-a', 300); // was 150, now 300 → col-b shifts right by 150
    await waitFor(() => getCellLeftValues(container, 'b')[0] !== bLeftBefore);

    const bLeftAfter = getCellLeftValues(container, 'b')[0];
    expect(bLeftAfter).toBe(bLeftBefore + 150);
  });
});
