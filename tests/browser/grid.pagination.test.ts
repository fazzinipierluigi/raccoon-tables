import { describe, it, expect, afterEach } from 'vitest';
import { mountGrid, waitFor, getRows, getColumnTexts } from './helpers.js';

const COLS = [
  { id: 'name', text: 'Name', index: 'name' },
  { id: 'n',    text: 'N',    index: 'n', type: 'number' as const },
];

// 12 items, page size 5
const DATA = Array.from({ length: 12 }, (_, i) => ({ name: `Item${i}`, n: i }));

describe('grid: pagination', () => {
  let cleanup: () => void;

  afterEach(() => cleanup?.());

  it('page 1 shows first 5 items', async () => {
    const { container, cleanup: c } = mountGrid({
      columns: COLS,
      data: DATA,
      pagination: { enabled: true, pageSize: 5 },
    });
    cleanup = c;

    await waitFor(() => getRows(container).length > 0);
    expect(getRows(container)).toHaveLength(5);
    const names = getColumnTexts(container, 'name');
    expect(names[0]).toBe('Item0');
    expect(names[4]).toBe('Item4');
  });

  it('page 2 shows next 5 items', async () => {
    const { grid, container, cleanup: c } = mountGrid({
      columns: COLS,
      data: DATA,
      pagination: { enabled: true, pageSize: 5 },
    });
    cleanup = c;

    await waitFor(() => getRows(container).length === 5);

    grid['_goToPage'](2);
    await waitFor(() => {
      const names = getColumnTexts(container, 'name');
      return names[0] === 'Item5';
    });

    const names = getColumnTexts(container, 'name');
    expect(names[0]).toBe('Item5');
    expect(names[4]).toBe('Item9');
    expect(getRows(container)).toHaveLength(5);
  });

  it('last page shows remaining items', async () => {
    const { grid, container, cleanup: c } = mountGrid({
      columns: COLS,
      data: DATA,
      pagination: { enabled: true, pageSize: 5 },
    });
    cleanup = c;

    await waitFor(() => getRows(container).length === 5);

    grid['_goToPage'](3); // items 10, 11
    await waitFor(() => getRows(container).length === 2);

    const names = getColumnTexts(container, 'name');
    expect(names).toEqual(['Item10', 'Item11']);
  });

  it('page 1 and page 2 show different items', async () => {
    const { grid, container, cleanup: c } = mountGrid({
      columns: COLS,
      data: DATA,
      pagination: { enabled: true, pageSize: 5 },
    });
    cleanup = c;

    await waitFor(() => getRows(container).length === 5);
    const page1Names = [...getColumnTexts(container, 'name')];

    grid['_goToPage'](2);
    await waitFor(() => {
      const n = getColumnTexts(container, 'name');
      return n[0] !== page1Names[0];
    });
    const page2Names = getColumnTexts(container, 'name');

    expect(page1Names).not.toEqual(page2Names);
    expect(new Set([...page1Names, ...page2Names]).size).toBe(10); // no duplicates
  });

  it('renders pagination controls when enabled', async () => {
    const { container, cleanup: c } = mountGrid({
      columns: COLS,
      data: DATA,
      pagination: { enabled: true, pageSize: 5 },
    });
    cleanup = c;

    await waitFor(() => container.querySelector('.rt-pagination') !== null);
    const pagination = container.querySelector('.rt-pagination');
    expect(pagination).not.toBeNull();
  });

  it('pagination total correct after setData', async () => {
    const { grid, container, cleanup: c } = mountGrid({
      columns: COLS,
      data: DATA,
      pagination: { enabled: true, pageSize: 5 },
    });
    cleanup = c;

    await waitFor(() => getRows(container).length === 5);

    // Set 3-item dataset
    grid.setData([{ name: 'X', n: 0 }, { name: 'Y', n: 1 }, { name: 'Z', n: 2 }] as any);
    await waitFor(() => getRows(container).length === 3);

    expect(getColumnTexts(container, 'name')).toEqual(['X', 'Y', 'Z']);
  });
});
