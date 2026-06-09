import { describe, it, expect, afterEach } from 'vitest';
import { mountGrid, waitFor, getRows, getColumnTexts } from './helpers.js';
import type { ColumnDef } from '../../src/types.js';

const COLS: ColumnDef[] = [
  { id: 'name', text: 'Name', index: 'name', type: 'string',  filterable: true } as ColumnDef,
  { id: 'age',  text: 'Age',  index: 'age',  type: 'number',  filterable: true } as ColumnDef,
  { id: 'ok',   text: 'OK',   index: 'ok',   type: 'boolean', filterable: true } as ColumnDef,
];

const DATA = [
  { name: 'Alice',   age: 25, ok: true  },
  { name: 'Bob',     age: 35, ok: false },
  { name: 'Charlie', age: 30, ok: true  },
  { name: 'Alicia',  age: 22, ok: false },
];

describe('grid: filter', () => {
  let cleanup: () => void;

  afterEach(() => cleanup?.());

  it('filter() contains reduces visible rows', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length === 4);

    grid.filter(COLS[0], 'ali');
    await waitFor(() => getRows(container).length === 2);

    const names = getColumnTexts(container, 'name');
    expect(names).toContain('Alice');
    expect(names).toContain('Alicia');
    expect(names).not.toContain('Bob');
  });

  it('filter() > reduces rows to those above threshold', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length === 4);

    grid.filter(COLS[1], 30, '>');
    await waitFor(() => getRows(container).length === 1);

    expect(getColumnTexts(container, 'name')).toEqual(['Bob']);
  });

  it('clearFilter() restores all rows', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length === 4);

    grid.filter(COLS[0], 'ali');
    await waitFor(() => getRows(container).length === 2);

    grid.clearFilter(COLS[0]);
    await waitFor(() => getRows(container).length === 4);
    expect(getRows(container)).toHaveLength(4);
  });

  it('filter then sort: correct order within filtered set', async () => {
    const { grid, container, cleanup: c } = mountGrid({ columns: COLS, data: DATA });
    cleanup = c;

    await waitFor(() => getRows(container).length === 4);

    grid.filter(COLS[0], 'ali');
    await waitFor(() => getRows(container).length === 2);

    grid.sort(COLS[0], 'DESC');
    await waitFor(() => {
      const names = getColumnTexts(container, 'name');
      return names[0] === 'Alicia';
    });

    expect(getColumnTexts(container, 'name')).toEqual(['Alicia', 'Alice']);
  });

  it('filter with pagination: shows correct subset', async () => {
    const manyData = Array.from({ length: 10 }, (_, i) => ({
      name: i % 2 === 0 ? `Alice${i}` : `Bob${i}`,
      age: i,
      ok: true,
    }));

    const { grid, container, cleanup: c } = mountGrid({
      columns: COLS,
      data: manyData,
      pagination: { enabled: true, pageSize: 5 },
    });
    cleanup = c;

    await waitFor(() => getRows(container).length === 5);

    grid.filter(COLS[0], 'Alice');
    await waitFor(() => getRows(container).length <= 5);

    const names = getColumnTexts(container, 'name');
    for (const name of names) {
      expect(name).toContain('Alice');
    }
  });
});
