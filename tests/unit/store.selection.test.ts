import { describe, it, expect } from 'vitest';
import { Store } from '../../src/core/Store.js';

const DATA = [
  { name: 'Alice' },
  { name: 'Bob'   },
  { name: 'Charlie' },
];

function store() {
  return new Store({ data: structuredClone(DATA) as any });
}

describe('selectRowItem', () => {
  it('marks item selected and adds to map', () => {
    const s = store();
    const item = s.data[0];
    s.selectRowItem(item, true);
    expect(item.$selected).toBe(true);
    expect(s.selectedItemsMap.has(item.id)).toBe(true);
  });

  it('unmarks item and removes from map', () => {
    const s = store();
    const item = s.data[0];
    s.selectRowItem(item, true);
    s.selectRowItem(item, false);
    expect(item.$selected).toBe(false);
    expect(s.selectedItemsMap.has(item.id)).toBe(false);
  });
});

describe('selectAll', () => {
  it('selects all items', () => {
    const s = store();
    s.selectAll(true);
    expect(s.selectedItemsMap.size).toBe(3);
    for (const item of s.data) expect(item.$selected).toBe(true);
  });

  it('deselects all items', () => {
    const s = store();
    s.selectAll(true);
    s.selectAll(false);
    expect(s.selectedItemsMap.size).toBe(0);
    for (const item of s.data) expect(item.$selected).toBe(false);
  });
});

describe('selectGroupRowItems', () => {
  it('selects group and all its leaf children', () => {
    const s = new Store({
      data: [
        { name: 'Alice', dept: 'Eng' } as any,
        { name: 'Bob',   dept: 'Eng' } as any,
      ],
      rowGroups: ['dept'],
    });

    const groupItem = s.displayedData!.find(r => r.$isGroupRow)!;
    s.selectGroupRowItems(groupItem, true);

    const leafItems = s.data.filter(r => !r.$isGroupRow);
    for (const item of leafItems) {
      expect(item.$selected).toBe(true);
    }
  });
});

describe('selectedItemsMap size tracking', () => {
  it('tracks count correctly after mixed operations', () => {
    const s = store();
    s.selectRowItem(s.data[0], true);
    s.selectRowItem(s.data[1], true);
    s.selectRowItem(s.data[0], false);
    expect(s.selectedItemsMap.size).toBe(1);
    expect(s.selectedItemsMap.has(s.data[1].id)).toBe(true);
  });
});
