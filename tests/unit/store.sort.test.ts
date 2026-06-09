import { describe, it, expect } from 'vitest';
import { Store } from '../../src/core/Store.js';
import type { ColumnDef } from '../../src/types.js';

// Minimal ColumnDef factory
const col = (id: string, index: string, type: ColumnDef['type'] = 'string'): ColumnDef =>
  ({ id, index, type, text: id } as ColumnDef);

const strCol  = col('name', 'name', 'string');
const numCol  = col('age',  'age',  'number');
const boolCol = col('active', 'active', 'boolean');

const PEOPLE = [
  { name: 'Charlie', age: 30, active: true  },
  { name: 'Alice',   age: 25, active: false },
  { name: 'Bob',     age: 35, active: true  },
  { name: 'Diana',   age: 28, active: false },
];

function store(data = PEOPLE) {
  return new Store({ data: structuredClone(data) as any });
}

// ---- String sort ----
describe('sort: string', () => {
  it('ASC alphabetical', () => {
    const s = store();
    s.sort(strCol, 'ASC');
    expect(s.displayedData!.map(r => r['name'])).toEqual(['Alice', 'Bob', 'Charlie', 'Diana']);
  });

  it('DESC alphabetical', () => {
    const s = store();
    s.sort(strCol, 'DESC');
    expect(s.displayedData!.map(r => r['name'])).toEqual(['Diana', 'Charlie', 'Bob', 'Alice']);
  });

  it('sets idRowIndexesMap correctly', () => {
    const s = store();
    s.sort(strCol, 'ASC');
    const aliceIdx = s.idRowIndexesMap.get(s.displayedData!.find(r => r['name'] === 'Alice')!.id);
    expect(aliceIdx).toBe(0);
  });
});

// ---- Number sort (TypedArray path) ----
describe('sort: number', () => {
  it('ASC numeric', () => {
    const s = store();
    s.sort(numCol, 'ASC');
    expect(s.displayedData!.map(r => r['age'])).toEqual([25, 28, 30, 35]);
  });

  it('DESC numeric', () => {
    const s = store();
    s.sort(numCol, 'DESC');
    expect(s.displayedData!.map(r => r['age'])).toEqual([35, 30, 28, 25]);
  });

  it('handles non-finite values', () => {
    const s = new Store({ data: [
      { name: 'A', score: NaN  } as any,
      { name: 'B', score: 10   } as any,
      { name: 'C', score: null } as any,
    ] });
    const scoreCol = col('score', 'score', 'number');
    s.sort(scoreCol, 'ASC');
    // non-finite mapped to MIN_SAFE_INTEGER → sort first in ASC
    const scores = s.displayedData!.map(r => r['score']);
    // B should be last in ASC (finite > non-finite)
    expect(scores[scores.length - 1]).toBe(10);
  });
});

// ---- Boolean sort (TypedArray path) ----
describe('sort: boolean', () => {
  it('ASC: false first', () => {
    const s = store();
    s.sort(boolCol, 'ASC');
    expect(s.displayedData![0]['active']).toBe(false);
    expect(s.displayedData![1]['active']).toBe(false);
    expect(s.displayedData![2]['active']).toBe(true);
    expect(s.displayedData![3]['active']).toBe(true);
  });

  it('DESC: true first', () => {
    const s = store();
    s.sort(boolCol, 'DESC');
    expect(s.displayedData![0]['active']).toBe(true);
    expect(s.displayedData![1]['active']).toBe(true);
  });
});

// ---- Multi-sort ----
describe('sort: multi-sort', () => {
  it('second sort() with multi=true re-sorts already-sorted data', () => {
    const s = new Store({ data: [
      { active: true,  age: 30 } as any,
      { active: false, age: 25 } as any,
      { active: true,  age: 20 } as any,
    ] });
    s.sort(boolCol, 'DESC'); // true first: [30t, 20t, 25f]
    s.sort(numCol,  'ASC',  true); // re-sort that result by age ASC
    const rows = s.displayedData!;
    // plain ASC sort on [30t, 20t, 25f] by age → [20t, 25f, 30t]
    expect(rows.map(r => r['age'])).toEqual([20, 25, 30]);
  });

  it('multi sorters accumulate in sorters array', () => {
    const s = new Store({ data: [{ active: true, age: 30 }] as any });
    s.sort(boolCol, 'DESC');
    s.sort(numCol,  'ASC', true);
    expect(s.sorters).toHaveLength(2);
  });
});

// ---- clearSort ----
describe('sort: clearSort', () => {
  it('resets displayedData and restores data[] insertion order', () => {
    const s = store();
    s.sort(strCol, 'ASC');
    expect(s.getItemByRowIndex(0)['name']).toBe('Alice');
    s.clearSort();
    expect(s.displayedData).toBeUndefined();
    expect(s.getItemByRowIndex(0)['name']).toBe('Charlie'); // original order
  });

  it('sortedData is undefined after clearSort', () => {
    const s = store();
    s.sort(strCol, 'ASC');
    s.clearSort();
    expect(s.sortedData).toBeUndefined();
    expect(s.sorters).toHaveLength(0);
  });
});

// ---- sortData directly ----
describe('Store.sortData', () => {
  it('returns same array when empty', () => {
    const s = store([]);
    const result = s.sortData([], strCol, 'ASC');
    expect(result).toEqual([]);
  });
});
