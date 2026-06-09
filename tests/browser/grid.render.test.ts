import { describe, it, expect, afterEach } from 'vitest';
import { mountGrid, waitFor, getRows, getColumnTexts } from './helpers.js';

const COLS = [
  { id: 'name', text: 'Name', index: 'name' },
  { id: 'age',  text: 'Age',  index: 'age', type: 'number' as const },
];

const DATA = [
  { name: 'Alice',   age: 25 },
  { name: 'Bob',     age: 35 },
  { name: 'Charlie', age: 30 },
];

describe('grid: basic render', () => {
  let cleanup: () => void;

  afterEach(() => cleanup?.());

  it('renders one row per data item', async () => {
    const { container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length > 0);
    expect(getRows(container)).toHaveLength(3);
  });

  it('renders correct cell content', async () => {
    const { container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length > 0);
    const names = getColumnTexts(container, 'name');
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
    expect(names).toContain('Charlie');
  });

  it('renders header cells for each column', async () => {
    const { container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => container.querySelector('.rt-header-cell') !== null);
    const headerCells = container.querySelectorAll('.rt-header-cell');
    expect(headerCells.length).toBeGreaterThanOrEqual(2);
  });

  it('renders empty grid with no rows', async () => {
    const { container, cleanup: c } = mountGrid({ columns: COLS, data: [] });
    cleanup = c;

    // Wait a moment then check no rows
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    expect(getRows(container)).toHaveLength(0);
  });

  it('setData replaces rendered rows', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length === 3);

    grid.setData([{ name: 'X', age: 1 }, { name: 'Y', age: 2 }] as any);
    await waitFor(() => getRows(container).length === 2);

    const names = getColumnTexts(container, 'name');
    expect(names).toEqual(['X', 'Y']);
  });

  it('setData from larger to smaller dataset shows correct count', async () => {
    const large = Array.from({ length: 8 }, (_, i) => ({ name: `Item${i}`, age: i }));
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: large });
    cleanup = c;

    await waitFor(() => getRows(container).length === 8);

    grid.setData([{ name: 'Solo', age: 0 }] as any);
    await waitFor(() => getRows(container).length === 1);
    expect(getColumnTexts(container, 'name')).toEqual(['Solo']);
  });
});

describe('grid: checkbox column', () => {
  let cleanup: () => void;

  afterEach(() => cleanup?.());

  it('renders header checkbox cell when checkboxColumn: true', async () => {
    const { container, cleanup: c } = mountGrid({
      columns: COLS,
      data: DATA,
      checkboxColumn: true,
    });
    cleanup = c;

    await waitFor(() => container.querySelector('.rt-header-cell') !== null);
    // Checkbox column adds a checkbox cell in the header row
    const headerCheckbox = container.querySelector<HTMLInputElement>('.rt-header input[type="checkbox"]');
    expect(headerCheckbox).not.toBeNull();
  });
});

describe('grid: row height', () => {
  let cleanup: () => void;

  afterEach(() => cleanup?.());

  it('applies custom rowHeight to rows', async () => {
    const { container, cleanup: c } = mountGrid({
      columns: COLS,
      data: DATA,
      rowHeight: 48,
    });
    cleanup = c;

    await waitFor(() => getRows(container).length > 0);
    const firstRow = getRows(container)[0];
    expect(firstRow.style.height).toBe('48px');
  });
});
