import { describe, it, expect, afterEach } from 'vitest';
import { mountGrid, waitFor, getRows, getColumnTexts } from './helpers.js';
import type { ColumnDef } from '../../src/types.js';

const COLS: ColumnDef[] = [
  { id: 'name', text: 'Name',  index: 'name', type: 'string', sortable: true } as ColumnDef,
  { id: 'age',  text: 'Age',   index: 'age',  type: 'number', sortable: true } as ColumnDef,
];

const DATA = [
  { name: 'Charlie', age: 30 },
  { name: 'Alice',   age: 25 },
  { name: 'Bob',     age: 35 },
];

describe('grid: sort', () => {
  let cleanup: () => void;

  afterEach(() => cleanup?.());

  it('sort() ASC string: rows in alphabetical order', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length > 0);

    grid.sort(COLS[0], 'ASC');
    await waitFor(() => {
      const names = getColumnTexts(container, 'name');
      return names[0] === 'Alice';
    });

    const names = getColumnTexts(container, 'name');
    expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('sort() DESC string: rows in reverse alphabetical order', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length > 0);

    grid.sort(COLS[0], 'DESC');
    await waitFor(() => {
      const names = getColumnTexts(container, 'name');
      return names[0] === 'Charlie';
    });

    const names = getColumnTexts(container, 'name');
    expect(names).toEqual(['Charlie', 'Bob', 'Alice']);
  });

  it('sort() ASC number: rows in numeric order', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length > 0);

    grid.sort(COLS[1], 'ASC');
    await waitFor(() => {
      const names = getColumnTexts(container, 'name');
      return names[0] === 'Alice';
    });

    const names = getColumnTexts(container, 'name');
    expect(names).toEqual(['Alice', 'Charlie', 'Bob']);
  });

  it('clearSort() restores unsorted visual order', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length > 0);

    grid.sort(COLS[0], 'ASC');
    await waitFor(() => getColumnTexts(container, 'name')[0] === 'Alice');

    grid.clearSort();
    await waitFor(() => {
      const names = getColumnTexts(container, 'name');
      return names[0] === 'Charlie';
    });

    expect(getColumnTexts(container, 'name')[0]).toBe('Charlie');
  });

  it('sort preserves row count', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length === 3);
    grid.sort(COLS[0], 'ASC');
    await waitFor(() => getColumnTexts(container, 'name')[0] === 'Alice');
    expect(getRows(container)).toHaveLength(3);
  });

  it('sort header cell click toggles sort', async () => {
    const { container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length > 0);

    const headerCells = container.querySelectorAll<HTMLElement>('.rt-header-cell');
    // Click first header cell (Name)
    const nameHeader = Array.from(headerCells).find(c => c.textContent?.includes('Name'));
    expect(nameHeader).toBeDefined();
    nameHeader!.click();

    await waitFor(() => getColumnTexts(container, 'name')[0] === 'Alice');
    expect(getColumnTexts(container, 'name')[0]).toBe('Alice');
  });
});
