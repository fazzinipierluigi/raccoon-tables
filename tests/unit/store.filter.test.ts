import { describe, it, expect } from 'vitest';
import { Store } from '../../src/core/Store.js';
import type { ColumnDef, FilterSign } from '../../src/types.js';

const col = (id: string, index: string, type: ColumnDef['type'] = 'string'): ColumnDef =>
  ({ id, index, type, text: id } as ColumnDef);

const strCol = col('name', 'name', 'string');
const numCol = col('age',  'age',  'number');
const boolCol= col('ok',   'ok',   'boolean');

const DATA = [
  { name: 'Alice',   age: 25, ok: true,  tag: 'admin' },
  { name: 'Bob',     age: 35, ok: false, tag: 'user'  },
  { name: 'Charlie', age: 30, ok: true,  tag: 'user'  },
  { name: 'Alicia',  age: 22, ok: false, tag: 'admin' },
];

function store() {
  return new Store({ data: structuredClone(DATA) as any });
}

function names(s: Store) {
  return (s.displayedData ?? s.data).map(r => r['name']);
}

// ---- String operators ----
describe('filter =  (contains)', () => {
  it('case-insensitive contains', () => {
    const s = store();
    s.filter(strCol, 'ali');
    expect(names(s)).toEqual(['Alice', 'Alicia']);
  });

  it('no match → empty', () => {
    const s = store();
    s.filter(strCol, 'zzz');
    expect(names(s)).toHaveLength(0);
  });

  it('empty string → all rows', () => {
    const s = store();
    s.filter(strCol, '');
    expect(names(s)).toHaveLength(4);
  });
});

describe('filter == (equals)', () => {
  it('exact match', () => {
    const s = store();
    s.filter(strCol, 'Alice', '==');
    expect(names(s)).toEqual(['Alice']);
  });

  it('case-insensitive', () => {
    const s = store();
    s.filter(strCol, 'alice', '==');
    expect(names(s)).toEqual(['Alice']);
  });
});

describe('filter != (not contains)', () => {
  it('excludes matching rows', () => {
    const s = store();
    s.filter(strCol, 'ali', '!=');
    expect(names(s)).toEqual(['Bob', 'Charlie']);
  });
});

describe('filter !== (not equals)', () => {
  it('excludes exact match', () => {
    const s = store();
    s.filter(strCol, 'Alice', '!==');
    expect(names(s)).not.toContain('Alice');
    expect(names(s)).toHaveLength(3);
  });
});

// ---- Numeric operators ----
describe('filter > (greater)', () => {
  it('filters numeric greater', () => {
    const s = store();
    s.filter(numCol, 30, '>');
    expect(names(s)).toEqual(['Bob']);
  });
});

describe('filter < (less)', () => {
  it('filters numeric less', () => {
    const s = store();
    s.filter(numCol, 25, '<');
    expect(names(s)).toEqual(['Alicia']);
  });
});

// ---- String pattern operators ----
describe('filter a_ (starts with)', () => {
  it('starts with match', () => {
    const s = store();
    s.filter(strCol, 'Al', 'a_');
    expect(names(s)).toEqual(['Alice', 'Alicia']);
  });
});

describe('filter _a (ends with)', () => {
  it('ends with match', () => {
    const s = store();
    s.filter(strCol, 'e', '_a');
    expect(names(s)).toEqual(['Alice', 'Charlie']);
  });
});

describe('filter regex', () => {
  it('regex match', () => {
    const s = store();
    s.filter(strCol, '^(Alice|Bob)$', 'regex');
    expect(names(s)).toEqual(['Alice', 'Bob']);
  });

  it('invalid regex → no filtering', () => {
    const s = store();
    s.filter(strCol, '[invalid(', 'regex');
    expect(names(s)).toHaveLength(4);
  });
});

// ---- Empty / !empty ----
describe('filter empty', () => {
  it('matches null/undefined/empty string', () => {
    const s = new Store({ data: [
      { name: 'A', note: ''        } as any,
      { name: 'B', note: null      } as any,
      { name: 'C', note: undefined } as any,
      { name: 'D', note: 'filled'  } as any,
    ] });
    const noteCol = col('note', 'note');
    s.filter(noteCol, null, 'empty');
    expect(s.displayedData!.map(r => r['name'])).toEqual(['A', 'B', 'C']);
  });
});

describe('filter !empty', () => {
  it('matches non-empty values', () => {
    const s = new Store({ data: [
      { name: 'A', note: ''       } as any,
      { name: 'B', note: 'hello'  } as any,
      { name: 'C', note: 0        } as any,
    ] });
    const noteCol = col('note', 'note');
    s.filter(noteCol, null, '!empty');
    expect(s.displayedData!.map(r => r['name'])).toContain('B');
    expect(s.displayedData!.map(r => r['name'])).not.toContain('A');
  });
});

// ---- Numeric sign operators ----
describe('filter + (positive)', () => {
  it('keeps >= 0', () => {
    const s = new Store({ data: [
      { v: -5  } as any,
      { v:  0  } as any,
      { v: 10  } as any,
    ] });
    const vc = col('v', 'v', 'number');
    s.filter(vc, null, '+');
    expect(s.displayedData!.map(r => r['v'])).toEqual([0, 10]);
  });
});

describe('filter - (negative)', () => {
  it('keeps < 0', () => {
    const s = new Store({ data: [
      { v: -5  } as any,
      { v:  0  } as any,
      { v: 10  } as any,
    ] });
    const vc = col('v', 'v', 'number');
    s.filter(vc, null, '-');
    expect(s.displayedData!.map(r => r['v'])).toEqual([-5]);
  });
});

// ---- Boolean operators ----
describe('filter T (true)', () => {
  it('keeps truthy booleans', () => {
    const s = store();
    s.filter(boolCol, null, 'T');
    expect(names(s)).toEqual(['Alice', 'Charlie']);
  });
});

describe('filter F (false)', () => {
  it('keeps falsy booleans', () => {
    const s = store();
    s.filter(boolCol, null, 'F');
    expect(names(s)).toEqual(['Bob', 'Alicia']);
  });
});

// ---- Array (in) operator ----
describe('filter in (list)', () => {
  it('matches any value in list', () => {
    const s = store();
    s.filter(strCol, ['Alice', 'Bob'], 'in');
    expect(names(s)).toEqual(['Alice', 'Bob']);
  });

  it('empty array → all rows', () => {
    const s = store();
    s.filter(strCol, [], 'in');
    expect(names(s)).toHaveLength(4);
  });
});

// ---- clearFilter ----
describe('clearFilter', () => {
  it('removes specific filter, shows all rows', () => {
    const s = store();
    s.filter(strCol, 'ali');
    expect(names(s)).toHaveLength(2);
    s.clearFilter(strCol);
    expect(s.filters).toHaveLength(0);
  });
});

// ---- oneFilterPerColumn ----
describe('oneFilterPerColumn', () => {
  it('replaces previous filter on same column', () => {
    const s = store();
    s.filter(strCol, 'Alice', '=', true);
    s.filter(strCol, 'Bob',   '=', true);
    expect(names(s)).toEqual(['Bob']);
  });
});
