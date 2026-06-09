import { describe, it, expect } from 'vitest';
import { Store } from '../../src/core/Store.js';
import type { ColumnDef } from '../../src/types.js';

const col = (id: string, index: string): ColumnDef =>
  ({ id, index, type: 'string', text: id } as ColumnDef);

const nameCol = col('name', 'name');

const DATA = [
  { name: 'A' },
  { name: 'B' },
  { name: 'C' },
  { name: 'D' },
  { name: 'E' },
];

function store() {
  return new Store({ data: structuredClone(DATA) as any });
}

// ---- getItemByRowIndex ----
describe('getItemByRowIndex', () => {
  it('falls back to data[] when displayedData is undefined', () => {
    const s = store();
    expect(s.displayedData).toBeUndefined();
    expect(s.getItemByRowIndex(0)!['name']).toBe('A');
    expect(s.getItemByRowIndex(4)!['name']).toBe('E');
  });

  it('uses displayedData when set', () => {
    const s = store();
    s.sort(nameCol, 'DESC');
    expect(s.displayedData).toBeDefined();
    expect(s.getItemByRowIndex(0)!['name']).toBe('E'); // DESC: E first
  });

  it('displayedData slice (pagination simulation)', () => {
    const s = store();
    // simulate pagination: show only rows 1-2
    s.displayedData = [s.data[1], s.data[2]] as any;
    expect(s.getItemByRowIndex(0)!['name']).toBe('B');
    expect(s.getItemByRowIndex(1)!['name']).toBe('C');
    expect(s.getItemByRowIndex(2)).toBeUndefined();
  });

  it('returns undefined for out-of-range index', () => {
    const s = store();
    expect(s.getItemByRowIndex(999)).toBeUndefined();
  });
});

// ---- getDisplayedDataTotal ----
describe('getDisplayedDataTotal', () => {
  it('returns data.length when no displayedData', () => {
    const s = store();
    expect(s.getDisplayedDataTotal()).toBe(5);
  });

  it('returns displayedData.length when set', () => {
    const s = store();
    s.displayedData = [s.data[0], s.data[1]] as any;
    expect(s.getDisplayedDataTotal()).toBe(2);
  });

  it('returns serverTotal in server mode', () => {
    const s = new Store({ data: [], serverMode: true, serverTotal: 1000 });
    expect(s.getDisplayedDataTotal()).toBe(1000);
  });
});

// ---- setData ----
describe('setData', () => {
  it('replaces data and re-applies active sorters', () => {
    const s = store();
    s.sort(nameCol, 'DESC');

    const newData = [{ name: 'X' }, { name: 'Y' }] as any;
    s.setData(newData);
    expect(s.data).toHaveLength(2);
    // filteredData is always cleared by setData
    expect(s.filteredData).toBeUndefined();
    // sorters persist — reSort() is called → sortedData re-applied on new data
    expect(s.sortedData).toBeDefined();
  });

  it('assigns ids to new items', () => {
    const s = store();
    s.setData([{ name: 'New' }] as any);
    expect(s.data[0].id).toBeDefined();
    expect(typeof s.data[0].id).toBe('string');
  });
});

// ---- add / remove ----
describe('add', () => {
  it('adds item to end', () => {
    const s = store();
    s.add({ name: 'F' } as any);
    expect(s.data).toHaveLength(6);
    expect(s.data[5]['name']).toBe('F');
  });

  it('adds item at position', () => {
    const s = store();
    s.add({ name: 'X' } as any, 0);
    expect(s.data[0]['name']).toBe('X');
  });

  it('assigns id', () => {
    const s = store();
    s.add({ name: 'Z' } as any);
    const last = s.data[s.data.length - 1];
    expect(last.id).toBeDefined();
  });
});

describe('removeItemById', () => {
  it('removes item from idItemMap', () => {
    const s = store();
    const item = s.data[0];
    const id = item.id;
    s.removeItemById(id);
    expect(s.idItemMap[id]).toBeUndefined();
  });
});

// ---- setById ----
describe('setById', () => {
  it('updates item value', () => {
    const s = store();
    const id = s.data[0].id;
    s.setById(id, 'name', 'Updated');
    expect(s.data[0]['name']).toBe('Updated');
  });

  it('calls onChange callback', () => {
    let called = false;
    const s = new Store({
      data: [{ name: 'A' }] as any,
      onChange: () => { called = true; },
    });
    s.setById(s.data[0].id, 'name', 'B');
    expect(called).toBe(true);
  });
});

// ---- idRowIndexesMap ----
describe('idRowIndexesMap', () => {
  it('maps each id to its row index', () => {
    const s = store();
    for (let i = 0; i < s.data.length; i++) {
      expect(s.idRowIndexesMap.get(s.data[i].id)).toBe(i);
    }
  });
});

// ---- pagination simulation ----
describe('pagination (_applyPagination simulation)', () => {
  it('page 1 slice', () => {
    const s = new Store({ data: Array.from({ length: 20 }, (_, i) => ({ n: i })) as any });
    const PAGE = 5;
    s.displayedData = s.data.slice(0, PAGE) as any;
    expect(s.getDisplayedDataTotal()).toBe(PAGE);
    expect(s.getItemByRowIndex(0)!['n']).toBe(0);
    expect(s.getItemByRowIndex(4)!['n']).toBe(4);
    expect(s.getItemByRowIndex(5)).toBeUndefined();
  });

  it('page 2 slice', () => {
    const s = new Store({ data: Array.from({ length: 20 }, (_, i) => ({ n: i })) as any });
    const PAGE = 5;
    s.displayedData = s.data.slice(PAGE, PAGE * 2) as any;
    expect(s.getItemByRowIndex(0)!['n']).toBe(5);
    expect(s.getItemByRowIndex(4)!['n']).toBe(9);
  });
});
