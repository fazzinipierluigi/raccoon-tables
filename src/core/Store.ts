/**
 * Raccoon Tables - Store
 *
 * The Store manages all data operations: sorting, filtering, row grouping,
 * selection, and add/remove. It is the single source of truth for grid data.
 *
 * Design decisions:
 * - Uses typed arrays (Int32Array, Uint32Array) for numeric sorting — 2–5x faster
 *   than JS Array.sort for large datasets.
 * - Filtering is applied in-order, so each filter pass operates on the smallest
 *   possible subset. The result is stored in `filteredData`.
 * - `displayedData` is always the currently visible ordered subset (filtered+sorted+grouped).
 * - Row grouping uses `Object.groupBy` (ES2024) with a polyfill fallback.
 */

import type {
  GridItem,
  RowData,
  ColumnDef,
  SortDir,
  FilterSign,
  AggregationFn,
  RowGroupSort,
} from '../types.js';

// ---- polyfill Object.groupBy if not available ----
if (typeof (Object as unknown as Record<string, unknown>).groupBy !== 'function') {
  (Object as unknown as Record<string, unknown>).groupBy = function <T>(
    iterable: T[],
    keyFn: (item: T) => string
  ): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const item of iterable) {
      const key = keyFn(item);
      (result[key] = result[key] ?? []).push(item);
    }
    return result;
  };
}

// Augment Object type for groupBy
declare global {
  interface ObjectConstructor {
    groupBy<T>(iterable: T[], keyFn: (item: T) => string): Record<string, T[]>;
  }
}

// Signs that carry no value — the sign itself IS the full filter condition.
function isValuelessSign(sign: FilterSign): boolean {
  return sign === 'T' || sign === 'F' || sign === 'empty' || sign === '!empty' || sign === '+' || sign === '-';
}

// ---------------------------------------------------------------------------
// Store interfaces
// ---------------------------------------------------------------------------

export interface Sorter {
  column: ColumnDef;
  dir: SortDir;
}

export interface Filter {
  column: ColumnDef;
  value: unknown;
  sign: FilterSign;
}

export interface Aggregation {
  index: string;
  fn: AggregationFn;
}

export interface GroupDetails {
  $rowGroupValue: string;
  $rowDisplayGroupValue: string;
  $groupLevel: number;
  $isGroupRow: true;
  $hasChildrenGroups: boolean;
  id: string;
  childrenAmount: number;
  amount: number;
  expanded: boolean;
  $agValues: Record<string, unknown>;
  $selected?: boolean;
  selectedStatus?: 'full' | 'partly' | false;
}

export interface StoreConfig {
  data?: GridItem[];
  rowGroups?: string[];
  rowGroupExpanded?: string[] | boolean | ((group: string) => boolean);
  aggregations?: Aggregation[];
  defaultRowGroupSort?: RowGroupSort;
  onChange?: (params: { value: unknown; oldValue: unknown; item: GridItem; column: ColumnDef }) => void;
  dataIndexes?: Record<string, Record<string, string[]>>;
  serverMode?: boolean;
  serverTotal?: number;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export class Store {
  data: GridItem[] = [];
  sortedData: GridItem[] | undefined;
  filteredData: GridItem[] | undefined;
  displayedData: GridItem[] | undefined;

  sorters: Sorter[] = [];
  filters: Filter[] = [];
  rowGroups: string[] = [];
  rowGroupExpanded: string[] | boolean | ((g: string) => boolean) = [];
  aggregations: Aggregation[] = [];

  idRowIndexesMap: Map<string, number> = new Map();
  idItemMap: Record<string, GridItem> = {};
  selectedItemsMap: Map<string, GridItem> = new Map();
  selectedRowGroupsChildren: Record<string, boolean> = {};

  groupDetails: Record<string, GroupDetails> = {};
  groupDetailsForFiltering?: Record<string, GroupDetails>;
  groupsChildren: Record<string, GridItem[]> = {};
  groupsChildrenForFiltering?: Record<string, GridItem[]>;
  levelsWithGroups: Array<[Record<string, string[]>]> = [];
  levelsWithGroupsForFiltering?: Array<[Record<string, string[]>]>;
  expandedGroups: Record<string, boolean> = {};
  expandedGroupsWithDataChildren: Record<string, boolean> = {};
  expandedGroupsWithDataChildrenForFiltering?: Record<string, boolean>;
  displayedGroupsForFiltering?: Record<string, boolean>;

  defaultRowGroupSort: RowGroupSort = 'desc-amount';
  prevAction = '';
  prevFilterColumn?: ColumnDef;
  prevIdRowIndexesMap?: Map<string, number>;

  dataIndexes?: Record<string, Record<string, string[]>>;

  /** Server mode: total rows on server (for pagination). */
  serverTotal = 0;
  /** Server mode: skip client-side sort/filter operations. */
  serverMode = false;

  private idSeed = 0;
  private $isOriginalDataIndexesSet = false;

  onChange?: (params: { value: unknown; oldValue: unknown; item: GridItem; column: ColumnDef }) => void;

  constructor(config: StoreConfig) {
    this.data = config.data ?? [];
    this.rowGroups = config.rowGroups ?? [];
    this.rowGroupExpanded = config.rowGroupExpanded ?? [];
    this.aggregations = config.aggregations ?? [];
    this.defaultRowGroupSort = config.defaultRowGroupSort ?? 'desc-amount';
    this.selectedItemsMap = new Map();
    this.selectedRowGroupsChildren = {};
    this.groupDetails = {};
    this.onChange = config.onChange;
    this.serverMode = config.serverMode ?? false;
    this.serverTotal = config.serverTotal ?? 0;

    if (config.dataIndexes) this.dataIndexes = config.dataIndexes;

    if (this.data.length && this.rowGroups.length) {
      this.lightSetIds();
      this.rowGroupData();
      this.setIndexAndItemsMaps();
    } else {
      this.setIds();
    }
  }

  // -------------------------------------------------------------------------
  // ID management
  // -------------------------------------------------------------------------

  generateId(): string {
    return String(this.idSeed++);
  }

  lightSetIds(): void {
    this.idSeed = 0;
    for (const item of this.data) {
      if (item.id === undefined) {
        item.id = this.generateId();
      } else {
        item.id = String(item.id);
      }
    }
  }

  setIds(): void {
    this.idRowIndexesMap = new Map();
    this.idItemMap = {};
    this.idSeed = 0;

    if (this.dataIndexes) {
      for (const p in this.dataIndexes) {
        this.dataIndexes[p] = {};
      }
    }

    for (let i = 0; i < this.data.length; i++) {
      const item = this.data[i];

      if (item.id === undefined) {
        item.id = String(this.idSeed++);
        item.originalRowIndex = i;
      } else {
        item.id = String(item.id);
      }

      if (this.dataIndexes) {
        for (const p in this.dataIndexes) {
          const v = String(item[p] ?? '');
          if (!this.dataIndexes[p][v]) this.dataIndexes[p][v] = [];
          this.dataIndexes[p][v].push(item.id);
        }
      }

      this.idRowIndexesMap.set(item.id, i);
      this.idItemMap[item.id] = item;
    }
  }

  setIndexAndItemsMaps(): void {
    if (!this.idItemMap) this.idItemMap = {};
    this.updateIndexes();
  }

  updateIndexes(): void {
    const data = this.displayedData ?? this.data;

    if (!this.$isOriginalDataIndexesSet) {
      for (let i = 0; i < this.data.length; i++) {
        const item = this.data[i];
        item.originalRowIndex = i;
        this.idItemMap[item.id] = item;
      }
      this.$isOriginalDataIndexesSet = true;
    }

    this.idRowIndexesMap = new Map();
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      this.idRowIndexesMap.set(item.id, i);
      this.idItemMap[item.id] = item;
      item.rowIndex = i;
      item.originalRowIndex = i;
    }
  }

  // -------------------------------------------------------------------------
  // Data access
  // -------------------------------------------------------------------------

  getDataTotal(): number {
    if (this.serverMode) return this.serverTotal;
    return this.data.length;
  }

  getDisplayedDataTotal(): number {
    if (this.serverMode) return this.serverTotal;
    if (this.displayedData !== undefined) return this.displayedData.length;
    return this.getDataTotal();
  }

  getItemByRowIndex(rowIndex: number): GridItem | undefined {
    // displayedData is set by pagination, sort, filter, or grouping.
    // Whenever it exists it IS the source of truth for what is rendered.
    if (this.displayedData !== undefined) {
      return this.displayedData[rowIndex];
    }
    return this.data[rowIndex];
  }

  memorizePrevRowIndexesMap(): void {
    this.prevIdRowIndexesMap = this.idRowIndexesMap;
  }

  getPrevVisibleRowIndex(rowIndex: number): number | undefined {
    const data = this.displayedData ?? this.data;
    for (let i = rowIndex - 1; i >= 0; i--) {
      if (data[i].$isGroupRow !== true) return i;
    }
    return undefined;
  }

  getNextVisibleRowIndex(rowIndex: number): number | undefined {
    const total = this.getDisplayedDataTotal();
    const data = this.displayedData ?? this.data;
    for (let i = rowIndex + 1; i < total; i++) {
      if (data[i].$isGroupRow !== true) return i;
    }
    return undefined;
  }

  getPrevPageVisibleRowIndex(rowIndex: number, pageRows: number): number | undefined {
    const data = this.displayedData ?? this.data;
    let rowI: number | undefined;
    for (let i = rowIndex - 1; i >= 0; i--) {
      if (data[i].$isGroupRow !== true) {
        rowI = i;
        pageRows--;
      }
      if (pageRows === 0) return rowI;
    }
    return rowI;
  }

  getNextPageVisibleRowIndex(rowIndex: number, pageRows: number): number | undefined {
    const total = this.getDisplayedDataTotal();
    const data = this.displayedData ?? this.data;
    let rowI: number | undefined;
    for (let i = rowIndex + 1; i < total; i++) {
      if (data[i].$isGroupRow !== true) {
        rowI = i;
        pageRows--;
      }
      if (pageRows === 0) return rowI;
    }
    return rowI;
  }

  // -------------------------------------------------------------------------
  // setData
  // -------------------------------------------------------------------------

  setData(data: GridItem[]): void {
    this.sortedData = undefined;
    this.filteredData = undefined;
    this.data = data;
    this.selectedItemsMap = new Map();
    this.selectedRowGroupsChildren = {};
    this.$isOriginalDataIndexesSet = false;

    if (this.data.length && this.rowGroups.length) {
      this.lightSetIds();
      if (this.filters.length) this.reFilter();
      this.rowGroupData();
      this.setIndexAndItemsMaps();
    } else {
      this.setIds();
      if (this.filters.length) this.reFilter(false);
      if (this.sorters.length) this.reSort();
    }
  }

  // -------------------------------------------------------------------------
  // Sorting
  // -------------------------------------------------------------------------

  sort(column: ColumnDef, dir: SortDir = 'ASC', multi = false): void {
    if (this.serverMode) return;

    let data: GridItem[];
    let useDataIndex = false;

    if (this.prevAction === 'sort' && this.sortedData) {
      if (column.dataIndex && !multi && !this.rowGroups.length && !this.filters.length) {
        useDataIndex = true;
      } else {
        data = this.sortedData.slice();
      }
    } else if (this.filteredData) {
      data = this.filteredData.slice();
    } else {
      if (column.dataIndex && !multi && !this.rowGroups.length) {
        useDataIndex = true;
      } else {
        data = this.data.slice();
      }
    }

    if (!this.prevIdRowIndexesMap) this.prevIdRowIndexesMap = this.idRowIndexesMap;

    if (!multi) {
      this.sorters = [];
    } else {
      this.sorters = this.sorters.filter(s => s.column.id !== column.id);
    }
    this.sorters.push({ column, dir });

    if (this.rowGroups.length) {
      this.sortedData = this.filters.length
        ? this.sortGroupDataForFiltering(column, dir)
        : this.sortGroupData(column, dir);
    } else if (useDataIndex) {
      this.sortedData = this.sortDataByDataIndex(column, dir);
    } else {
      this.sortedData = this.sortData(data!, column, dir);
    }

    this.idRowIndexesMap = new Map();
    for (let i = 0; i < this.sortedData.length; i++) {
      const item = this.sortedData[i];
      this.idRowIndexesMap.set(item.id, i);
      item.rowIndex = i;
    }

    this.displayedData = this.sortedData;
    this.prevAction = 'sort';
  }

  reSort(): void {
    if (this.serverMode) return;

    let data = this.filteredData ? this.filteredData.slice() : this.data.slice();
    for (const sorter of this.sorters) {
      data = this.sortData(data, sorter.column, sorter.dir);
    }

    this.sortedData = data;
    this.idRowIndexesMap = new Map();
    for (let i = 0; i < this.sortedData.length; i++) {
      const item = this.sortedData[i];
      this.idRowIndexesMap.set(item.id, i);
      item.rowIndex = i;
    }
    this.displayedData = this.sortedData;
  }

  clearSort(column?: ColumnDef, multi = false): void {
    if (this.serverMode) return;

    this.sortedData = [];

    if (column && multi) {
      this.sorters = this.sorters.filter(s => s.column.id !== column.id);
    } else {
      this.sorters = [];
    }

    if (!this.rowGroups.length) this.idRowIndexesMap = new Map();

    if (this.sorters.length) {
      if (this.rowGroups.length) {
        this.sortedData = this.filters.length
          ? this.sortGroupDataForFiltering(this.sorters[0].column, this.sorters[0].dir)
          : this.sortGroupData(this.sorters[0].column, this.sorters[0].dir);
        this.idRowIndexesMap = new Map();
        for (let i = 0; i < this.sortedData.length; i++) {
          const item = this.sortedData[i];
          this.idRowIndexesMap.set(item.id, i);
          item.rowIndex = i;
        }
        this.displayedData = this.sortedData;
        this.prevAction = 'sort';
      } else {
        this.reSort();
      }
    } else if (this.filters.length) {
      if (this.rowGroups.length) {
        this.rowGroupDataForFiltering();
        this.sortGroupsForFiltering();
        this.generateDisplayedGroupedDataForFiltering(true);
        this.updateIndexes();
        this.prevAction = 'filter';
      } else {
        if (!this.filteredData) this.reFilter(false);
        for (let i = 0; i < this.filteredData!.length; i++) {
          const item = this.filteredData![i];
          this.idRowIndexesMap.set(item.id, i);
          item.rowIndex = i;
        }
        this.displayedData = this.filteredData;
      }
    } else {
      if (this.rowGroups.length) {
        this.sortGroups();
        this.simpleReGenerateDisplayedGroupedData();
        this.updateIndexes();
      } else {
        for (let i = 0; i < this.data.length; i++) {
          const item = this.data[i];
          this.idRowIndexesMap.set(item.id, i);
          item.rowIndex = i;
        }
        // No sorters, no filters, no groups: reset displayedData so data[] order is used
        this.displayedData = undefined;
      }
    }

    if (this.sorters.length === 0) this.sortedData = undefined;
  }

  /**
   * Core sort algorithm. Uses TypedArrays for numeric sorting (2–5x faster).
   */
  sortData(data: GridItem[], column: ColumnDef, dir: SortDir): GridItem[] {
    const N = data.length;
    if (N === 0) return data;

    const type = column.type ?? 'string';

    switch (type) {
      case 'number': {
        const vals = new Float64Array(N);
        for (let i = 0; i < N; i++) {
          let v = column.getter ? Number(column.getter({ item: data[i], column })) : Number(data[i][column.index!]);
          if (!isFinite(v)) v = Number.MIN_SAFE_INTEGER;
          vals[i] = v;
        }
        const order = new Uint32Array(N);
        for (let i = 0; i < N; i++) order[i] = i;
        order.sort((a, b) => dir === 'ASC' ? vals[a] - vals[b] : vals[b] - vals[a]);
        const out = new Array<GridItem>(N);
        for (let i = 0; i < N; i++) out[i] = data[order[i]];
        return out;
      }

      case 'boolean': {
        const vals = new Uint8Array(N);
        for (let i = 0; i < N; i++) {
          const v = column.getter ? column.getter({ item: data[i], column }) : data[i][column.index!];
          vals[i] = v === true ? 1 : 0;
        }
        const order = new Uint32Array(N);
        for (let i = 0; i < N; i++) order[i] = i;
        order.sort((a, b) => dir === 'ASC' ? vals[a] - vals[b] : vals[b] - vals[a]);
        const out = new Array<GridItem>(N);
        for (let i = 0; i < N; i++) out[i] = data[order[i]];
        return out;
      }

      default: /* string */ {
        return data.slice().sort((a, b) => {
          let va = String(column.getter ? column.getter({ item: a, column }) : (a[column.index!] ?? ''));
          let vb = String(column.getter ? column.getter({ item: b, column }) : (b[column.index!] ?? ''));
          return dir === 'ASC' ? va.localeCompare(vb) : vb.localeCompare(va);
        });
      }
    }
  }

  sortDataByDataIndex(column: ColumnDef, dir: SortDir): GridItem[] {
    const index = column.index!;
    const values = Object.keys(this.dataIndexes![index]).sort((a, b) =>
      dir === 'ASC' ? a.localeCompare(b) : b.localeCompare(a)
    );
    const out: GridItem[] = [];
    for (const v of values) {
      for (const id of this.dataIndexes![index][v]) {
        out.push(this.idItemMap[id]);
      }
    }
    return out;
  }

  sortPieceOfData(data: GridItem[]): GridItem[] {
    for (const sorter of this.sorters) {
      data = this.sortData(data, sorter.column, sorter.dir);
    }
    return data;
  }

  sortGroupData(column: ColumnDef, dir: SortDir): GridItem[] {
    const sortedData = (this.displayedData ?? []).slice();
    for (const group in this.expandedGroupsWithDataChildren) {
      if (this.isParentCollapsed(group)) continue;
      const groupData = this.groupsChildren[group].slice();
      const gd = this.groupDetails[group];
      const rowIndex = this.idRowIndexesMap.get(gd.id)!;
      let sorted = groupData;
      if (this.sorters.length) {
        for (const s of this.sorters) sorted = this.sortData(sorted, s.column, s.dir);
      } else {
        sorted = this.sortData(groupData, column, dir);
      }
      this.spliceToData(rowIndex, sorted.length, sortedData, sorted);
    }
    return sortedData;
  }

  sortGroupDataForFiltering(column: ColumnDef, dir: SortDir): GridItem[] {
    const sortedData = (this.displayedData ?? []).slice();
    if (!this.expandedGroupsWithDataChildrenForFiltering) return sortedData;
    for (const group in this.expandedGroupsWithDataChildrenForFiltering) {
      if (this.isParentCollapsed(group)) continue;
      const groupData = (this.groupsChildrenForFiltering?.[group] ?? []).slice();
      const gd = (this.groupDetailsForFiltering ?? {})[group];
      if (!gd) continue;
      const rowIndex = this.idRowIndexesMap.get(gd.id)!;
      let sorted = groupData;
      if (this.sorters.length) {
        for (const s of this.sorters) sorted = this.sortData(sorted, s.column, s.dir);
      } else {
        sorted = this.sortData(groupData, column, dir);
      }
      this.spliceToData(rowIndex, sorted.length, sortedData, sorted);
    }
    return sortedData;
  }

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  filter(column: ColumnDef, value: unknown, sign: FilterSign = '=', oneFilterPerColumn = false): void {
    if (this.serverMode) return;

    let data: GridItem[];
    let totalReFilterRequired = false;

    if (this.prevAction === 'sort' && this.sortedData) {
      data = this.sortedData.slice();
    } else if (this.prevAction === 'filter' && this.prevFilterColumn?.id !== column.id && this.filteredData) {
      data = this.filteredData.slice();
    } else if (this.prevAction === 'filter' && this.prevFilterColumn?.id === column.id) {
      totalReFilterRequired = true;
    } else {
      data = this.data.slice();
    }

    this.removeFilter(column, sign);
    if (oneFilterPerColumn) this.filters = this.filters.filter(f => f.column.id !== column.id);

    if (value !== null || isValuelessSign(sign)) this.filters.push({ column, value, sign });

    if (totalReFilterRequired) {
      this.reFilter();
      this.reSort();
      this.prevAction = 'filter';
      this.prevFilterColumn = column;
      return;
    }

    this.filteredData = this.filterData(data!, column, value, sign);
    this.displayedData = this.filteredData;
    this.updateIndexMapAfterFilter();

    this.prevAction = 'filter';
    this.prevFilterColumn = column;
  }

  filterForRowGrouping(column: ColumnDef, value: unknown, sign: FilterSign = '=', oneFilterPerColumn = false): void {
    if (this.serverMode) return;

    const data = this.data.slice();
    this.removeFilter(column, sign);
    if (oneFilterPerColumn) this.filters = this.filters.filter(f => f.column.id !== column.id);
    if (value !== null || isValuelessSign(sign)) this.filters.push({ column, value, sign });

    this.filteredData = this.filters.reduce((acc, f) => this.filterData(acc, f.column, f.value, f.sign), data);
    this.rowGroupDataForFiltering();
    this.sortGroupsForFiltering();
    this.generateDisplayedGroupedDataForFiltering();
    this.updateIndexes();

    this.prevAction = 'filter';
    this.prevFilterColumn = column;
  }

  reFilter(useSortedData = true): void {
    if (this.serverMode) return;

    let data = (useSortedData && this.prevAction === 'sort' && this.sortedData)
      ? this.sortedData.slice()
      : this.data.slice();

    this.filteredData = this.filters.reduce((acc, f) => this.filterData(acc, f.column, f.value, f.sign), data);
    this.displayedData = this.filteredData;
    this.updateIndexMapAfterFilter();

    if (this.filters.length === 0) this.filteredData = undefined;
    this.prevAction = 'filter';
  }

  clearFilter(column?: ColumnDef, sign?: FilterSign): void {
    if (this.serverMode) return;

    this.removeFilter(column, sign);
    this.reFilter(false);
    this.reSort();

    if (!column || this.filters.length === 0) {
      this.prevAction = "";
      delete this.prevFilterColumn;
    }
  }

  clearFilterForGrouping(column?: ColumnDef, sign?: FilterSign): void {
    if (this.serverMode) return;

    const data = this.data.slice();
    this.removeFilter(column, sign);

    this.filteredData = this.filters.reduce((acc, f) => this.filterData(acc, f.column, f.value, f.sign), data);

    this.rowGroupDataForFiltering();
    this.sortGroupsForFiltering();
    this.generateDisplayedGroupedDataForFiltering();
    this.updateIndexes();

    if (this.filters.length === 0) this.filteredData = undefined;
    this.prevAction = 'filter';
  }

  removeFilter(column?: ColumnDef, sign?: FilterSign, removePrevFilterColumn = true): void {
    if (sign) {
      this.filters = this.filters.filter(f => !(f.column.id === column?.id && f.sign === sign));
    } else if (column) {
      this.filters = this.filters.filter(f => f.column.id !== column.id);
    } else {
      this.filters = [];
    }
    if (removePrevFilterColumn !== false) delete this.prevFilterColumn;
  }

  updateIndexMapAfterFilter(): void {
    this.memorizePrevRowIndexesMap();
    this.idRowIndexesMap = new Map();
    if (!this.filteredData) return;
    for (let i = 0; i < this.filteredData.length; i++) {
      const item = this.filteredData[i];
      this.idRowIndexesMap.set(item.id, i);
      item.rowIndex = i;
    }
  }

  /**
   * Core filter engine. Supports 15+ operators.
   * Handles string (case-insensitive), number, boolean, array (in) values.
   */
  filterData(data: GridItem[], column: ColumnDef, value: unknown, sign: FilterSign): GridItem[] {
    const getVal = (item: GridItem) =>
      column.getter ? column.getter({ item, column }) : item[column.index!];

    // Normalize value
    let normValue: string | string[];
    if (Array.isArray(value)) {
      normValue = value.map(v => String(v).toLocaleLowerCase());
    } else {
      normValue = String(value).toLocaleLowerCase();
    }

    switch (sign) {
      case '=': // contains or list
        if (Array.isArray(normValue)) {
          if (normValue.length === 0) return data;
          return data.filter(item => {
            const v = String(getVal(item) ?? '').toLocaleLowerCase();
            return (normValue as string[]).includes(v);
          });
        }
        return data.filter(item =>
          String(getVal(item) ?? '').toLocaleLowerCase().includes(normValue as string)
        );

      case 'in':
        if (Array.isArray(normValue)) {
          if (normValue.length === 0) return data;
          return data.filter(item => {
            const v = String(getVal(item) ?? '').toLocaleLowerCase();
            return (normValue as string[]).includes(v);
          });
        }
        return data;

      case '!=': // not contains
        return data.filter(item =>
          !String(getVal(item) ?? '').toLocaleLowerCase().includes(normValue as string)
        );

      case '==': // equals
        return data.filter(item =>
          String(getVal(item) ?? '').toLocaleLowerCase() === (normValue as string)
        );

      case '!==': // not equals
        return data.filter(item =>
          String(getVal(item) ?? '').toLocaleLowerCase() !== (normValue as string)
        );

      case '>': // greater than
        return data.filter(item => {
          const v = getVal(item);
          return v !== null && v !== undefined && Number(v) > Number(value);
        });

      case '<': // less than
        return data.filter(item => {
          const v = getVal(item);
          return v !== null && v !== undefined && Number(v) < Number(value);
        });

      case 'a_': // starts with
        return data.filter(item =>
          String(getVal(item) ?? '').toLocaleLowerCase().startsWith(normValue as string)
        );

      case '_a': // ends with
        return data.filter(item =>
          String(getVal(item) ?? '').toLocaleLowerCase().endsWith(normValue as string)
        );

      case 'regex': {
        let regex: RegExp;
        try { regex = new RegExp(normValue as string, 'i'); } catch { return data; }
        return data.filter(item => regex.test(String(getVal(item) ?? '')));
      }

      case 'empty':
        return data.filter(item => {
          const v = getVal(item);
          return v === undefined || v === null || v === '';
        });

      case '!empty':
        return data.filter(item => {
          const v = getVal(item);
          return v !== undefined && v !== null && v !== '';
        });

      case '+': // positive
        return data.filter(item => Number(getVal(item)) >= 0);

      case '-': // negative
        return data.filter(item => Number(getVal(item)) < 0);

      case 'T': // boolean true
        return data.filter(item => getVal(item) === true || getVal(item) === 1 || getVal(item) === 'true');

      case 'F': // boolean false
        return data.filter(item => !getVal(item) || getVal(item) === false || getVal(item) === 0 || getVal(item) === 'false');

      default:
        return data;
    }
  }

  // -------------------------------------------------------------------------
  // Add / Remove / Edit
  // -------------------------------------------------------------------------

  add(items: GridItem | GridItem[], position?: number): void {
    const arr = Array.isArray(items) ? items : [items];
    for (const item of arr) {
      if (item.id === undefined) item.id = this.generateId();
      else item.id = String(item.id);

      const idx = position !== undefined ? position : this.data.length;
      this.data.splice(idx, 0, item);
      this.idItemMap[item.id] = item;
    }
    this.$isOriginalDataIndexesSet = false;

    if (this.dataIndexes) this.updateDataIndexes(arr);
  }

  removeItemById(id: string): GridItem {
    const item = this.idItemMap[id];
    delete this.idItemMap[id];
    return item;
  }

  setById(id: string, index: string, value: unknown): void {
    const item = this.idItemMap[id];
    if (!item) return;
    const oldValue = item[index];
    item[index] = value;
    this.onChange?.({ value, oldValue, item, column: { index } as ColumnDef });
  }

  updateDataIndexes(items: GridItem[]): void {
    if (!this.dataIndexes) return;
    const toUpdate: Record<string, unknown[]> = {};
    for (const p in this.dataIndexes) toUpdate[p] = [];

    for (const item of items) {
      for (const p in this.dataIndexes) {
        toUpdate[p].push(item[p]);
      }
    }

    for (const p in this.dataIndexes) {
      toUpdate[p] = [...new Set(toUpdate[p].map(String))];
    }

    for (const p in this.dataIndexes) {
      for (const v of toUpdate[p] as string[]) {
        this.dataIndexes[p][v] = [];
      }
    }

    for (const item of this.data) {
      for (const p in this.dataIndexes) {
        const v = String(item[p] ?? '');
        if (this.dataIndexes[p][v] !== undefined) {
          this.dataIndexes[p][v].push(item.id);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  selectRowItem(item: GridItem, selected: boolean): void {
    if (selected) {
      item.$selected = true;
      this.selectedItemsMap.set(item.id, item);
    } else {
      item.$selected = false;
      this.selectedItemsMap.delete(item.id);
    }
  }

  selectGroupRowItems(groupItem: GridItem, selected: boolean): void {
    const group = groupItem.$rowGroupValue!;
    const children = this.groupsChildren[group] ?? [];

    this.selectRowItem(groupItem, selected);

    for (const child of children) {
      if (child.$isGroupRow) {
        this.selectGroupRowItems(child, selected);
      } else {
        this.selectRowItem(child, selected);
      }
    }

    // update group selectedStatus
    this.updateGroupSelectedStatus(group);
  }

  updateGroupSelectedStatus(group: string): void {
    const gd = this.groupDetails[group];
    if (!gd) return;

    const children = this.groupsChildren[group] ?? [];
    let selectedCount = 0;
    let total = 0;

    for (const child of children) {
      if (!child.$isGroupRow) {
        total++;
        if (child.$selected) selectedCount++;
      }
    }

    if (total === 0) {
      gd.selectedStatus = false;
    } else if (selectedCount === total) {
      gd.selectedStatus = 'full';
      gd.$selected = true;
    } else if (selectedCount > 0) {
      gd.selectedStatus = 'partly';
      gd.$selected = false;
    } else {
      gd.selectedStatus = false;
      gd.$selected = false;
    }
  }

  selectAll(selected: boolean): void {
    for (const item of this.data) {
      this.selectRowItem(item, selected);
    }
  }

  isItemInCollapsedGroup(item: GridItem): boolean {
    const val = item.$rowGroupValue;
    if (!val) return false;
    const parts = val.split('/');
    const len = item.$isGroupRow ? parts.length - 1 : parts.length;

    for (let i = len; i >= 1; i--) {
      const name = parts.slice(0, i).join('/');
      if (!this.expandedGroups[name]) return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Row Grouping
  // -------------------------------------------------------------------------

  rowGroupData(): void {
    this.set$rowGroupValue();
    this.setExpandedGroups();
    this.generateGroupDetails();
    this.sortGroups();
    this.generateDisplayedGroupedData();
  }

  rowGroupDataForFiltering(): void {
    this.generateGroupDetailsForFiltering();
  }

  set$rowGroupValue(data?: GridItem[]): GridItem[] {
    const d = data ?? this.data;
    for (const row of d) {
      row.$rowGroupValue = this.rowGroups.map(g => String(row[g] ?? '')).join('/');
    }
    return d;
  }

  setExpandedGroups(): void {
    this.expandedGroups = {};
    const type = typeof this.rowGroupExpanded;

    if (type === 'function' || this.rowGroupExpanded === true) {
      const allGroupNames = Object.keys(
        Object.groupBy(this.data, row => row.$rowGroupValue!)
      );
      const parentGroups: Record<string, boolean> = {};
      for (const gn of allGroupNames) {
        const parts = gn.split('/');
        for (let i = 0; i < parts.length; i++) {
          parts.pop();
          parentGroups[parts.join('/')] = true;
        }
      }

      const all = [...allGroupNames, ...Object.keys(parentGroups)].sort();
      for (const g of all) {
        const expanded =
          this.rowGroupExpanded === true
            ? true
            : (this.rowGroupExpanded as (g: string) => boolean)(g);
        this.expandedGroups[g] = expanded;
      }
    } else if (this.rowGroupExpanded === false) {
      // collapse all — expandedGroups stays empty
    } else {
      for (const g of (this.rowGroupExpanded as string[]) ?? []) {
        this.expandedGroups[g] = true;
      }
    }

    this.rowGroupExpanded = [];
  }

  generateGroupDetails(groupNames?: string[], groupLevel?: number): void {
    if (groupNames === undefined) {
      this.groupsChildren = Object.groupBy(this.data, row => row.$rowGroupValue!);
      groupNames = Object.keys(this.groupsChildren);
      groupLevel = this.rowGroups.length - 1;
      this.groupDetails = {};
      this.levelsWithGroups = [{ 0: { root: [] } } as unknown as [Record<string, string[]>]];
      this.expandedGroupsWithDataChildren = {};
    }

    const parentGroups: Record<string, boolean> = {};
    const hasChildrenGroups = groupLevel! > 0;

    for (const groupName of groupNames) {
      const parts = groupName.split('/');
      const rowDisplayGroupValue = parts.pop()!;
      let parentGroupName = 'root';
      if (groupLevel !== 0) {
        parentGroupName = parts.join('/');
        parentGroups[parentGroupName] = true;
      }

      const parentGroup = parts.join('/');
      const expanded = this.expandedGroups[groupName] ?? false;

      this.groupsChildren[parentGroup] = this.groupsChildren[parentGroup] ?? [];

      if (!this.levelsWithGroups[groupLevel!]) {
        this.levelsWithGroups[groupLevel!] = { 0: {} } as unknown as [Record<string, string[]>];
      }
      const levelContainer = (this.levelsWithGroups[groupLevel!] as unknown as Record<string, Record<string, string[]>>)['0'];
      if (!levelContainer[parentGroupName]) levelContainer[parentGroupName] = [];
      levelContainer[parentGroupName].push(groupName);

      const gd: GroupDetails = {
        $rowGroupValue: groupName,
        $rowDisplayGroupValue: rowDisplayGroupValue,
        $groupLevel: groupLevel!,
        $isGroupRow: true,
        $hasChildrenGroups: hasChildrenGroups,
        id: this.generateId(),
        childrenAmount: this.groupsChildren[groupName]?.length ?? 0,
        amount: 0,
        expanded,
        $agValues: {},
      };

      if (!hasChildrenGroups) {
        for (const ag of this.aggregations) {
          const vals = (this.groupsChildren[groupName] ?? []).map(r => r[ag.index] as number);
          gd.$agValues[ag.index] = this.getAggregationResult(ag, vals);
        }
        gd.amount = gd.childrenAmount;
        if (gd.expanded) this.expandedGroupsWithDataChildren[groupName] = true;
      } else {
        for (const ag of this.aggregations) {
          const vals = (this.groupsChildren[groupName] ?? []).map(c => (c as GridItem).$agValues?.[ag.index] as number);
          gd.$agValues[ag.index] = this.getAggregationResult(ag, vals);
        }
        gd.amount = (this.groupsChildren[groupName] ?? []).reduce((s: number, c) => s + ((c as GridItem).amount ?? 0), 0);
      }

      this.groupDetails[groupName] = gd as unknown as GroupDetails;
      if (groupLevel !== 0) this.groupsChildren[parentGroup].push(gd as unknown as GridItem);
    }

    if (groupLevel !== 0) {
      this.generateGroupDetails(Object.keys(parentGroups), groupLevel! - 1);
    }
  }

  generateGroupDetailsForFiltering(groupNames?: string[], groupLevel?: number): void {
    if (!this.filteredData) return;

    if (groupNames === undefined) {
      this.groupsChildrenForFiltering = Object.groupBy(this.filteredData, row => row.$rowGroupValue!);
      groupNames = Object.keys(this.groupsChildrenForFiltering);
      groupLevel = this.rowGroups.length - 1;
      this.groupDetailsForFiltering = {};
      this.levelsWithGroupsForFiltering = [];
      this.expandedGroupsWithDataChildrenForFiltering = {};
    }

    const parentGroups: Record<string, boolean> = {};
    const hasChildrenGroups = groupLevel! > 0;

    for (const groupName of groupNames) {
      const gd = this.groupDetails[groupName];
      const parts = groupName.split('/');
      const rowDisplayGroupValue = parts.pop()!;
      let parentGroupName = 'root';
      if (groupLevel !== 0) {
        parentGroupName = parts.join('/');
        parentGroups[parentGroupName] = true;
      }

      const parentGroup = parts.join('/');
      const expanded = this.expandedGroups[groupName] ?? false;

      this.groupsChildrenForFiltering![parentGroup] = this.groupsChildrenForFiltering![parentGroup] ?? [];
      if (!this.levelsWithGroupsForFiltering![groupLevel!]) {
        this.levelsWithGroupsForFiltering![groupLevel!] = [{}] as unknown as [Record<string, string[]>];
      }
      const levelContainer = (this.levelsWithGroupsForFiltering![groupLevel!] as unknown as Record<string, Record<string, string[]>>)['0'];
      if (!levelContainer[parentGroupName]) levelContainer[parentGroupName] = [];
      levelContainer[parentGroupName].push(groupName);

      const gdForFilter: GroupDetails = {
        $rowGroupValue: groupName,
        $rowDisplayGroupValue: rowDisplayGroupValue,
        $groupLevel: groupLevel!,
        $isGroupRow: true,
        $hasChildrenGroups: hasChildrenGroups,
        id: gd?.id ?? this.generateId(),
        childrenAmount: this.groupsChildrenForFiltering![groupName]?.length ?? 0,
        amount: 0,
        expanded,
        $agValues: {},
      };

      if (!hasChildrenGroups) {
        for (const ag of this.aggregations) {
          const vals = (this.groupsChildrenForFiltering![groupName] ?? []).map(r => r[ag.index] as number);
          gdForFilter.$agValues[ag.index] = this.getAggregationResult(ag, vals);
        }
        gdForFilter.amount = gdForFilter.childrenAmount;
        if (gdForFilter.expanded) {
          this.expandedGroupsWithDataChildrenForFiltering![groupName] = true;
        }
      } else {
        for (const ag of this.aggregations) {
          const vals = (this.groupsChildrenForFiltering![groupName] ?? []).map(c => (c as GridItem).$agValues?.[ag.index] as number);
          gdForFilter.$agValues[ag.index] = this.getAggregationResult(ag, vals);
        }
        gdForFilter.amount = (this.groupsChildrenForFiltering![groupName] ?? []).reduce((s: number, c) => s + ((c as GridItem).amount ?? 0), 0);
      }

      this.groupDetailsForFiltering![groupName] = gdForFilter;
      if (groupLevel !== 0) {
        this.groupsChildrenForFiltering![parentGroup].push(gdForFilter as unknown as GridItem);
      }
    }

    if (groupLevel === 0) {
      this.generateDisplayedGroupsForFiltering(groupNames);
    } else {
      this.generateGroupDetailsForFiltering(Object.keys(parentGroups), groupLevel! - 1);
    }
  }

  generateDisplayedGroupedData(): void {
    const sorted = this.getSortedDisplayedGroups();
    const out: GridItem[] = [];

    for (const group of sorted) {
      const children = this.groupsChildren[group];
      const gd = this.groupDetails[group];
      out.push(gd as unknown as GridItem);
      if (!gd.$hasChildrenGroups && this.expandedGroups[group]) {
        for (const c of children) out.push(c);
      }
    }

    this.displayedData = out;
  }

  simpleReGenerateDisplayedGroupedData(): void {
    const grouped = (this.displayedData ?? []).slice();
    for (const group in this.expandedGroupsWithDataChildren) {
      if (this.isParentCollapsed(group)) continue;
      const groupData = this.groupsChildren[group].slice();
      const gd = this.groupDetails[group];
      const rowIndex = this.idRowIndexesMap.get(gd.id)!;
      this.spliceToData(rowIndex, groupData.length, grouped, groupData);
    }
    this.displayedData = grouped;
  }

  generateDisplayedGroupedDataForFiltering(doNotSort = false): void {
    if (!doNotSort) {
      const sorted = this.getSortedDisplayedGroupsForFiltering();
      const out: GridItem[] = [];
      for (const group of sorted) {
        const children = this.groupsChildrenForFiltering?.[group] ?? [];
        const gd = (this.groupDetailsForFiltering ?? {})[group];
        if (gd) {
          out.push(gd as unknown as GridItem);
          if (!gd.$hasChildrenGroups && this.expandedGroups[group]) {
            for (const c of children) out.push(c);
          }
        }
      }
      this.displayedData = out;
    } else {
      this.displayedData = this.getGroupDataForFiltering();
    }
  }

  generateDisplayedGroupsForFiltering(zeroLevelGroups: string[]): void {
    this.displayedGroupsForFiltering = {};
    for (const g of zeroLevelGroups) this.displayedGroupsForFiltering[g] = true;
    for (const g in this.expandedGroups) {
      const subs = this.groupsChildrenForFiltering?.[g] ?? [];
      for (const sub of subs) {
        if ((sub as GridItem).$rowGroupValue) {
          this.displayedGroupsForFiltering[(sub as GridItem).$rowGroupValue!] = true;
        }
      }
    }
  }

  sortGroups(): void {
    for (const level of this.levelsWithGroups ?? []) {
      const container = (level as unknown as Record<string, Record<string, string[]>>)['0'];
      for (const g in container) {
        container[g] = container[g].slice().sort((a: string, b: string) => this.compareGroups(a, b));
      }
    }
  }

  sortGroupsForFiltering(): void {
    this.levelsWithGroupsForFiltering = [];
    const lwg = this.levelsWithGroups ?? [];
    for (let lv = 0; lv < lwg.length; lv++) {
      const container = (lwg[lv] as unknown as Record<string, Record<string, string[]>>)['0'];
      const filtered: Record<string, string[]> = {};
      for (const g in container) {
        const subs = container[g].filter(v => this.displayedGroupsForFiltering?.[v]);
        if (this.displayedGroupsForFiltering?.[g] || lv === 0) {
          filtered[g] = subs;
        }
      }
      this.levelsWithGroupsForFiltering[lv] = [filtered] as unknown as [Record<string, string[]>];
    }
  }

  getSortedDisplayedGroups(): string[] {
    const out: string[] = [];

    const lwg = this.levelsWithGroups ?? [];
    const recurse = (levelGroups: string[], level: number) => {
      for (const g of levelGroups) {
        out.push(g);
        if (this.expandedGroups[g] && level < lwg.length - 1) {
          const nextContainer = (lwg[level + 1] as unknown as Record<string, Record<string, string[]>>)['0'];
          if (nextContainer?.[g]) recurse(nextContainer[g], level + 1);
        }
      }
    };

    const root = (lwg[0] as unknown as Record<string, Record<string, string[]>>)?.['0']?.root ?? [];
    recurse(root, 0);
    return out;
  }

  /** All groups in sorted order regardless of expand state — used for pagination-slice grouping. */
  getSortedGroupOrder(): string[] {
    const out: string[] = [];
    const lwg = this.levelsWithGroups ?? [];
    const recurse = (levelGroups: string[], level: number) => {
      for (const g of levelGroups) {
        out.push(g);
        if (level < lwg.length - 1) {
          const nextContainer = (lwg[level + 1] as unknown as Record<string, Record<string, string[]>>)['0'];
          if (nextContainer?.[g]) recurse(nextContainer[g], level + 1);
        }
      }
    };
    const root = (lwg[0] as unknown as Record<string, Record<string, string[]>>)?.['0']?.root ?? [];
    recurse(root, 0);
    return out;
  }

  getSortedDisplayedGroupsForFiltering(): string[] {
    if (!this.levelsWithGroupsForFiltering?.length) return [];
    const out: string[] = [];

    const recurse = (levelGroups: string[], level: number) => {
      for (const g of levelGroups) {
        out.push(g);
        if (this.expandedGroups[g] && level < this.levelsWithGroupsForFiltering!.length - 1) {
          const nextContainer = (this.levelsWithGroupsForFiltering![level + 1] as unknown as Record<string, Record<string, string[]>>)['0'];
          if (nextContainer?.[g]) recurse(nextContainer[g], level + 1);
        }
      }
    };

    const root = (this.levelsWithGroupsForFiltering[0] as unknown as Record<string, Record<string, string[]>>)['0']?.root ?? [];
    recurse(root, 0);
    return out;
  }

  compareGroups(a: string, b: string): number {
    const gdA = this.groupDetails[a];
    const gdB = this.groupDetails[b];
    switch (this.defaultRowGroupSort) {
      case 'asc-string': return gdA.$rowDisplayGroupValue.localeCompare(gdB.$rowDisplayGroupValue);
      case 'desc-string': return gdB.$rowDisplayGroupValue.localeCompare(gdA.$rowDisplayGroupValue);
      case 'asc-amount': return gdA.amount - gdB.amount;
      default: return gdB.amount - gdA.amount; // desc-amount
    }
  }

  getAggregationResult(ag: Aggregation, values: number[]): unknown {
    if (typeof ag.fn === 'function') return ag.fn(values);
    switch (ag.fn) {
      case 'sum': return values.reduce((s, v) => s + (v ?? 0), 0);
      case 'avg': {
        const sum = values.reduce((s, v) => s + (v ?? 0), 0);
        return parseFloat((sum / values.length).toFixed(2));
      }
      case 'min': return Math.min(...values.filter(v => v != null));
      case 'max': return Math.max(...values.filter(v => v != null));
    }
  }

  agGroupUpdateData(groupName: string, items: GridItem[], sign: '-' | '+' | 'update' = '-'): void {
    const gd = this.groupDetails[groupName];
    const gdFilter = this.groupDetailsForFiltering?.[groupName];
    if (!gd) return;

    const children = this.groupsChildren[groupName] ?? [];
    const childrenFilter = this.groupsChildrenForFiltering?.[groupName] ?? [];

    for (const ag of this.aggregations ?? []) {
      for (const item of items) {
        if (!item.$rowGroupValue?.includes(groupName)) continue;
        if (ag.fn === 'sum' && sign !== 'update') {
          gd.$agValues[ag.index] = (gd.$agValues[ag.index] as number ?? 0)
            + (sign === '+' ? 1 : -1) * (item[ag.index] as number ?? 0);
          if (gdFilter) {
            gdFilter.$agValues[ag.index] = (gdFilter.$agValues[ag.index] as number ?? 0)
              + (sign === '+' ? 1 : -1) * (item[ag.index] as number ?? 0);
          }
        } else {
          const vals = children.map(c => c.$agValues ? c.$agValues[ag.index] as number : c[ag.index] as number);
          gd.$agValues[ag.index] = this.getAggregationResult(ag, vals);
          if (gdFilter) {
            const valsF = childrenFilter.map(c => (c as GridItem).$agValues ? (c as GridItem).$agValues![ag.index] as number : c[ag.index] as number);
            gdFilter.$agValues[ag.index] = this.getAggregationResult(ag, valsF);
          }
        }
      }
    }
  }

  expand(group: string): void {
    const gd = this.groupDetails[group];
    const rowIndex = this.idRowIndexesMap.get(gd.id)!;

    gd.expanded = true;
    this.expandedGroups[group] = true;
    if (!gd.$hasChildrenGroups) this.expandedGroupsWithDataChildren[group] = true;

    const groupData = this.getGroupExpandedChildren(group);
    this.spliceToData(rowIndex, 0, this.displayedData!, groupData);
    this.updateIndexes();
  }

  expandForFiltering(group: string): void {
    const gd = (this.groupDetailsForFiltering ?? {})[group];
    const rowIndex = this.idRowIndexesMap.get(gd.id)!;

    gd.expanded = true;
    this.expandedGroups[group] = true;
    if (!gd.$hasChildrenGroups) {
      this.expandedGroupsWithDataChildren[group] = true;
      if (this.expandedGroupsWithDataChildrenForFiltering) {
        this.expandedGroupsWithDataChildrenForFiltering[group] = true;
      }
    }

    const groupData = this.getGroupExpandedChildrenForFiltering(group);
    this.spliceToData(rowIndex, 0, this.displayedData!, groupData);
    this.updateIndexes();
  }

  expandAll(): void {
    this.prevAction = '';
    for (const g in this.groupDetails) {
      const gd = this.groupDetails[g];
      this.expandedGroups[g] = true;
      gd.expanded = true;
      if (!gd.$hasChildrenGroups) this.expandedGroupsWithDataChildren[g] = true;
    }
    this.generateDisplayedGroupedData();
    this.setIndexAndItemsMaps();
  }

  collapse(group: string): void {
    const groupData = this.getGroupExpandedChildren(group);
    const gd = this.groupDetails[group];
    const rowIndex = this.idRowIndexesMap.get(gd.id)!;

    gd.expanded = false;
    delete this.expandedGroups[group];
    if (!gd.$hasChildrenGroups) delete this.expandedGroupsWithDataChildren[group];

    this.displayedData!.splice(rowIndex + 1, groupData.length);
    this.updateIndexes();
  }

  collapseForFiltering(group: string): void {
    const groupData = this.getGroupExpandedChildrenForFiltering(group);
    const gd = (this.groupDetailsForFiltering ?? {})[group];
    const rowIndex = this.idRowIndexesMap.get(gd.id)!;

    gd.expanded = false;
    delete this.expandedGroups[group];
    if (!gd.$hasChildrenGroups) {
      delete this.expandedGroupsWithDataChildren[group];
      if (this.expandedGroupsWithDataChildrenForFiltering) {
        delete this.expandedGroupsWithDataChildrenForFiltering[group];
      }
    }

    this.displayedData!.splice(rowIndex + 1, groupData.length);
    this.updateIndexes();
  }

  collapseAll(): void {
    this.prevAction = '';
    for (const g in this.groupDetails) {
      this.expandedGroups[g] = false;
      this.groupDetails[g].expanded = false;
    }
    this.generateDisplayedGroupedData();
    this.setIndexAndItemsMaps();
  }

  toggleExpand(group: string): void {
    const gd = this.groupDetails[group];
    gd.expanded ? this.collapse(group) : this.expand(group);
  }

  getGroupExpandedChildren(group: string, result: GridItem[] = []): GridItem[] {
    const gd = this.groupDetails[group];
    let children = (this.groupsChildren[group] ?? []).slice();
    if (!gd.$hasChildrenGroups && this.sorters.length) {
      children = this.sortPieceOfData(children);
    }
    for (const child of children) {
      result.push(child);
      if (child.$isGroupRow && child.expanded) {
        this.getGroupExpandedChildren(child.$rowGroupValue!, result);
      }
    }
    return result;
  }

  getGroupExpandedChildrenForFiltering(group: string, result: GridItem[] = []): GridItem[] {
    const gd = (this.groupDetailsForFiltering ?? {})[group];
    let children = (this.groupsChildrenForFiltering?.[group] ?? []).slice();
    if (!gd?.$hasChildrenGroups && this.sorters.length) {
      children = this.sortPieceOfData(children);
    }
    for (const child of children) {
      result.push(child);
      if (child.$isGroupRow && child.expanded) {
        this.getGroupExpandedChildrenForFiltering(child.$rowGroupValue!, result);
      }
    }
    return result;
  }

  getGroupDataForFiltering(): GridItem[] {
    const data = (this.displayedData ?? []).slice();
    for (const g in (this.expandedGroupsWithDataChildrenForFiltering ?? {})) {
      if (this.isParentCollapsed(g)) continue;
      const children = (this.groupsChildrenForFiltering?.[g] ?? []).slice();
      const gd = (this.groupDetailsForFiltering ?? {})[g];
      const rowIndex = this.idRowIndexesMap.get(gd.id)!;
      data.splice(rowIndex + 1, children.length, ...children);
    }
    return data;
  }

  reConfigRowGroups(rowGroups: string[]): void {
    this.rowGroups = rowGroups;
    this.prevAction = '';

    if (!this['$dontDropExpandedGroups' as keyof this]) {
      this.expandedGroups = {};
    }

    this.groupsChildren = {};

    if (rowGroups.length === 0) {
      this.clearGroups();
      if (!this.sorters.length && !this.filters.length) {
        this.displayedData = undefined;
      } else {
        if (this.filters.length) this.reFilter(false);
        if (this.sorters.length) this.reSort();
      }
    } else {
      if (this.filters.length) {
        this.set$rowGroupValue();
        this.generateGroupDetails();
        this.sortGroups();
        this.rowGroupDataForFiltering();
        this.sortGroupsForFiltering();
        this.generateDisplayedGroupedDataForFiltering();
        this.updateIndexes();
      } else {
        this.set$rowGroupValue();
        this.generateGroupDetails();
        this.sortGroups();
        this.generateDisplayedGroupedData();
      }
    }

    if (!this.filters.length || !rowGroups.length) this.setIndexAndItemsMaps();
  }

  clearGroup(group: string): void {
    if (this.groupsChildren) delete this.groupsChildren[group];
    if (this.groupsChildrenForFiltering) delete this.groupsChildrenForFiltering[group];
  }

  clearGroups(): void {
    this.groupsChildren = {};
    this.levelsWithGroups = [];
    this.expandedGroupsWithDataChildren = {};
    for (const row of this.data) delete row.$rowGroupValue;
  }

  addGroup(group: string): void {
    this.levelsWithGroups = this.levelsWithGroups ?? [{ 0: { root: [] } } as unknown as [Record<string, string[]>]];
    this.groupsChildren = this.groupsChildren ?? {};
    this.expandedGroupsWithDataChildren = this.expandedGroupsWithDataChildren ?? {};
    this.expandedGroups = this.expandedGroups ?? {};

    this.expandedGroupsWithDataChildren[group] = true;

    const parts = group.split('/');
    const toAdd: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      const name = parts.slice(0, parts.length - i).join('/');
      const level = name.split('/').length - 1;
      if (this.groupDetails[name]) break;

      const parentGroup = parts.slice(0, parts.length - i - 1).join('/');

      if (level === 0) {
        const root = (this.levelsWithGroups[0] as unknown as Record<string, Record<string, string[]>>)['0'].root;
        if (!root.includes(name)) root.push(name);
      } else {
        if (!this.levelsWithGroups[level]) {
          this.levelsWithGroups[level] = [{}] as unknown as [Record<string, string[]>];
        }
        const lc = (this.levelsWithGroups[level] as unknown as Record<string, Record<string, string[]>>)['0'];
        if (!lc[parentGroup]) lc[parentGroup] = [];
        lc[parentGroup].push(name);
      }

      this.expandedGroups[name] = true;
      this.groupsChildren[name] = [];
      this.groupDetails[name] = {
        $rowGroupValue: name,
        $rowDisplayGroupValue: parts[parts.length - i - 1],
        $groupLevel: level,
        $isGroupRow: true,
        $hasChildrenGroups: group !== name,
        id: this.generateId(),
        childrenAmount: 0,
        amount: 0,
        expanded: true,
        $agValues: {},
      };
      toAdd.push(name);
    }

    for (const g of toAdd) {
      const gParts = g.split('/');
      if (gParts.length === 1) continue;
      const parent = gParts.slice(0, gParts.length - 1).join('/');
      this.groupsChildren[parent] = this.groupsChildren[parent] ?? [];
      this.groupsChildren[parent].push(this.groupDetails[g] as unknown as GridItem);
    }
  }

  isParentCollapsed(group: string): boolean {
    const parts = group.split('/');
    for (let i = parts.length - 1; i >= 1; i--) {
      const parent = parts.slice(0, i).join('/');
      if (!this.expandedGroups[parent]) return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * High-performance splice for very large arrays.
   * Uses chunked insertion to avoid stack overflow on large datasets.
   */
  spliceToData(rowIndex: number, removeNumber: number, toData: GridItem[], data: GridItem[]): void {
    if (data.length > 100_000) {
      const CHUNK = 10_000;
      let pos = rowIndex + 1;
      if (removeNumber > 0) toData.splice(pos, removeNumber);
      for (let i = 0; i < data.length; i += CHUNK) {
        toData.splice(pos, 0, ...data.slice(i, i + CHUNK));
        pos += CHUNK;
      }
    } else {
      toData.splice(rowIndex + 1, removeNumber, ...data);
    }
  }
}
