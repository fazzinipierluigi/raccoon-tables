/**
 * Raccoon Tables - RaccoonGrid
 *
 * Main grid class. Composes all mixins and exposes the full public API.
 *
 * Architecture:
 *   - Store: all data operations (sort/filter/group/edit)
 *   - Scroller: virtual scroll geometry
 *   - ServerAdapter: AJAX mode
 *   - Mixins: domain-specific DOM + interaction logic
 *     (Body, Header, Sort, Filter, Column, Edit, Selection, KeyNavigation,
 *      Scroll, RowGroup, RowGroupBar, ColumnDrag)
 *
 * DOM structure produced by render():
 *   <div class="rt-wrap">
 *     [<div class="rt-search-bar">]           optional global search
 *     [<div class="rt-row-group-bar">]         optional row group bar
 *     <div class="rt-header">
 *       [<div class="rt-header-group-row">]    optional column groups
 *       <div class="rt-header-row">
 *         <div class="rt-header-cell"> ... </div> ...
 *       </div>
 *       [<div class="rt-filter-bar-row">]      optional filter bar
 *     </div>
 *     <div class="rt-body">
 *       <div class="rt-fake-scroll">           sets total scroll height
 *       <div class="rt-row"> ... </div> ...    absolutely positioned rows
 *     </div>
 *     [<div class="rt-pagination">]            optional pagination
 *     [<div class="rt-loading">]               server-mode loading overlay
 *   </div>
 */

import type {
  GridConfig,
  RowData,
  GridItem,
  ColumnDef,
  SortDir,
  FilterSign,
  ServerResponse,
  GridLayout,
  GridColumnLayout,
  ThemeVars,
  RaccoonEventMap,
} from './types.js';
import { Store } from './core/Store.js';
import { Scroller } from './core/Scroller.js';
import { ServerAdapter } from './core/ServerAdapter.js';
import { cls } from './utils/cls.js';
import { div } from './utils/dom.js';
import { svg } from './utils/svg.js';
import { debounce } from './utils/debounce.js';
import { getLocale, formatPageInfo, type RaccoonLocale } from './utils/i18n.js';

import { BodyMixin } from './mixins/Body.js';
import { HeaderMixin } from './mixins/Header.js';
import { SortMixin } from './mixins/Sort.js';
import { FilterMixin } from './mixins/Filter.js';
import { ColumnMixin } from './mixins/Column.js';
import { SelectionMixin, type CellRange, type ActiveCell } from './mixins/Selection.js';
import { KeyNavigationMixin } from './mixins/KeyNavigation.js';
import { ScrollMixin } from './mixins/Scroll.js';
import { RowGroupMixin } from './mixins/RowGroup.js';
import { RowGroupBarMixin } from './mixins/RowGroupBar.js';
import { ColumnDragMixin } from './mixins/ColumnDrag.js';

// Re-export so mixin files can refer to RaccoonGrid type without circular import
export type { CellRange, ActiveCell };

// ---------------------------------------------------------------------------
// RaccoonGrid class
// ---------------------------------------------------------------------------

export class RaccoonGrid<T extends RowData = RowData> {
  // ---- config ----
  config: GridConfig<T>;

  // ---- DOM refs ----
  el: HTMLElement | null = null;
  headerEl: HTMLElement | null = null;
  headerRowEl: HTMLElement | null = null;
  filterBarRowEl: HTMLElement | null = null;
  bodyEl: HTMLElement | null = null;
  fakeScrollEl: HTMLElement | null = null;
  rowGroupBarEl: HTMLElement | null = null;
  paginationEl: HTMLElement | null = null;
  loadingEl: HTMLElement | null = null;
  searchBarEl: HTMLElement | null = null;

  // ---- core ----
  store: Store;
  scroller: Scroller;
  serverAdapter: ServerAdapter | null = null;

  // ---- column state ----
  allColumns: ColumnDef[] = [];
  visibleColumns: ColumnDef[] = [];
  columnsById: Record<string, ColumnDef> = {};

  // ---- selection state ----
  selectionMap: Set<string> = new Set();
  selectionRange: CellRange | undefined;
  activeCell: ActiveCell | undefined;
  selectAllCheckbox: HTMLInputElement | undefined;

  // ---- resize state ----
  _resizeStartX = 0;
  _resizeStartWidth = 0;
  _resizeCol: ColumnDef | undefined;
  _resizeHeaderCell: HTMLElement | undefined;

  // ---- menu/list state ----
  _activeHeaderMenu: HTMLElement | undefined;
  _activeFilterSignList: HTMLElement | undefined;

  // ---- pagination state ----
  _currentPage = 1;
  _pageSize: number;
  _groupPageOffset = 0;

  // ---- touch state ----
  _touchStartY = 0;
  _touchStartX = 0;
  _touchLastY = 0;
  _touchLastX = 0;
  _touchVelocityY = 0;
  _touchVelocityX = 0;
  _touchAnimFrame = 0;

  // ---- search state ----
  _globalSearch: string | undefined;

  // ---- localisation ----
  _locale: RaccoonLocale;

  // ---- page-scroll mode ----
  /** True when no `height` config — grid scrolls with the page instead of internally. */
  _pageScrollMode = false;
  _windowScrollHandler: (() => void) | undefined;
  _windowResizeHandler: (() => void) | undefined;

  // ---- debounced server request (created per-instance) ----
  _triggerServerRequest: () => void;

  constructor(config: GridConfig<T>) {
    this.config = config;
    this._pageSize = config.pagination?.pageSize ?? 50;
    const base = getLocale(config.locale);
    this._locale = config.localeOverride ? { ...base, ...config.localeOverride } : base;

    // Server adapter
    if (config.serverAdapter) {
      this.serverAdapter = new ServerAdapter(config.serverAdapter);
    }

    // Store
    this.store = new Store({
      data: (config.data as GridItem[] | undefined) ?? [],
      rowGroups: config.rowGroups ?? [],
      rowGroupExpanded: config.rowGroupExpanded ?? [],
      aggregations: config.aggregations,
      defaultRowGroupSort: config.defaultRowGroupSort,
      serverMode: !!config.serverAdapter,
      serverTotal: 0,
    });

    // Page-scroll mode: active when no fixed height is configured
    this._pageScrollMode = !config.height;

    // Scroller
    this.scroller = new Scroller({
      rowHeight: config.rowHeight ?? 32,
      headerHeight: this._calcHeaderHeight(),
      bufferRows: config.bufferRows ?? 10,
      defaultColumnWidth: config.defaultColumnWidth ?? 100,
    });
    this.scroller.pageScrollMode = this._pageScrollMode;
    this.scroller.totalRows = this.store.getDisplayedDataTotal();

    // Per-instance debounced server request (avoids prototype-shared debounce)
    this._triggerServerRequest = debounce(() => {
      this._doServerRequest();
    }, 0);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  render(containerEl: HTMLElement | string): this {
    const container = typeof containerEl === 'string'
      ? document.querySelector<HTMLElement>(containerEl)
      : containerEl;

    if (!container) throw new Error(`[RaccoonGrid] Container "${containerEl}" not found`);

    this.el = div(cls.wrap);
    if (this.config.cls) this.el.classList.add(...this.config.cls.split(' ').filter(Boolean));
    if (this.config.style) Object.assign(this.el.style, this.config.style);

    if (this.config.theme === 'material') this.el.classList.add('rt-theme-material');
    else if (this.config.theme === 'fluent') this.el.classList.add('rt-theme-fluent');
    else if (this.config.theme === 'tabler') this.el.classList.add('rt-theme-tabler');
    if (this.config.dark === true) this.el.classList.add('rt-dark');
    else if (this.config.dark === false) this.el.classList.add('rt-light');
    if (this._pageScrollMode) this.el.classList.add(cls.pageScroll);
    if (this.config.themeVars) {
      for (const [key, val] of Object.entries(this.config.themeVars)) {
        if (val !== undefined) this.el.style.setProperty(key, val);
      }
    }

    // Global search bar
    if (this.config.searchBar) {
      this.searchBarEl = this._createSearchBar();
      this.el.appendChild(this.searchBarEl);
    }

    // Row group bar
    if (this.config.rowGroupBar) {
      this.rowGroupBarEl = div(cls.rowGroupBar);
      this.el.appendChild(this.rowGroupBarEl);
    }

    // Header
    this.headerEl = div(cls.header);
    this.el.appendChild(this.headerEl);

    // Height on wrapper (fixed mode only; page-scroll mode has no fixed height)
    if (!this._pageScrollMode && this.config.height) this.el.style.height = `${this.config.height}px`;
    if (this.config.width) this.el.style.width = `${this.config.width}px`;

    // Body
    this.bodyEl = div(cls.body);
    this.el.appendChild(this.bodyEl);

    // Fake scroll spacer (sets total scrollable height for virtual scroll)
    this.fakeScrollEl = div(cls.fakeScroll);
    this.bodyEl.appendChild(this.fakeScrollEl);

    // Loading overlay
    this.loadingEl = div(cls.loading);
    this.loadingEl.innerHTML = svg.loading;
    this.loadingEl.style.display = 'none';
    this.el.appendChild(this.loadingEl);

    // Pagination
    if (this.config.pagination?.enabled) {
      this.paginationEl = div(cls.pagination);
      this.el.appendChild(this.paginationEl);
    }

    container.appendChild(this.el);

    // Prepare columns
    this.prepareColumns();
    this.applyFlexColumns();

    // Attach scroller (starts ResizeObserver)
    // Do NOT reset scroller.totalRows here — it's already set correctly by the
    // last data operation (pagination/_applyPagination sets page-size, not full count).
    this.scroller.attach(this.el, this.bodyEl, this.headerEl, () => {
      if (this._pageScrollMode) this.scroller.viewHeight = window.innerHeight;
      this.applyFlexColumns();
      this.renderVisibleRows();
    });

    // In page-scroll mode seed the initial viewHeight from the window
    if (this._pageScrollMode) {
      this.scroller.viewHeight = window.innerHeight;
    }

    // Wire up event listeners
    this.initScrollListeners();
    this.initKeyNavigation();
    this.initColumnDrag();

    // Window resize: redistribute flex columns and redraw visible rows
    this._windowResizeHandler = () => {
      if (this._pageScrollMode) this.scroller.viewHeight = window.innerHeight;
      this.applyFlexColumns();
      this.renderVisibleRows();
    };
    window.addEventListener('resize', this._windowResizeHandler);

    // Initial render
    this.renderHeader();

    if (this.config.rowGroupBar) {
      this.renderRowGroupBar();
    }

    if (this.config.serverAdapter) {
      this._doServerRequest();
    } else if (this.config.pagination?.enabled) {
      // Apply initial pagination slice before first render
      this._currentPage = this.config.pagination.page ?? 1;
      this._applyPagination();
    } else {
      this.scroller.totalRows = this.store.getDisplayedDataTotal();
      this.renderVisibleRows();
    }

    if (this.config.pagination?.enabled) {
      this._renderPagination();
    }

    this.config.onReady?.(this as unknown as Parameters<NonNullable<GridConfig<T>['onReady']>>[0]);
    this._emit('raccoon:ready', { grid: this });
    return this;
  }

  // -------------------------------------------------------------------------
  // Event dispatch
  // -------------------------------------------------------------------------

  _emit<K extends keyof RaccoonEventMap>(type: K, detail: RaccoonEventMap[K]): boolean {
    if (!this.el) return true;
    const ev = new CustomEvent<RaccoonEventMap[K]>(type, {
      detail,
      bubbles: true,
      cancelable: type.startsWith('raccoon:before'),
    });
    this.el.dispatchEvent(ev);
    return !ev.defaultPrevented;
  }

  // -------------------------------------------------------------------------
  // Public data API
  // -------------------------------------------------------------------------

  setData(data: T[]): void {
    this.store.setData(data as unknown as GridItem[]);
    this.scroller.scrollTo(0);
    // New data gets fresh sequential IDs that may collide with old row element data-id values.
    // Force-clear existing rows so renderVisibleRows() always creates fresh elements.
    this.clearRows();
    this.renderHeader();
    if (this.config.pagination?.enabled) {
      this._currentPage = 1;
      this._applyPagination();
      this._renderPagination();
    } else {
      this.scroller.totalRows = this.store.getDisplayedDataTotal();
      this.renderVisibleRows();
    }
    this._emit('raccoon:dataLoaded', { grid: this, total: this.store.data.length, source: 'client' });
  }

  getData(): T[] {
    return this.store.data as unknown as T[];
  }

  add(data: T | T[], rowIndex?: number): void {
    const items = (Array.isArray(data) ? data : [data]) as unknown as GridItem[];
    this.store.add(items, rowIndex);
    this.scroller.totalRows = this.store.getDisplayedDataTotal();
    this.renderVisibleRows();
  }

  remove(id: string | string[]): void {
    const ids = Array.isArray(id) ? id : [id];
    for (const i of ids) {
      const item = this.store.removeItemById(i);
      if (!item) continue;
      const idx = this.store.data.indexOf(item);
      if (idx !== -1) this.store.data.splice(idx, 1);
    }
    this.store.setIds();
    this.scroller.totalRows = this.store.getDisplayedDataTotal();
    this.renderVisibleRows();
  }

  setById(id: string, index: string, value: unknown): void {
    this.store.setById(id, index, value);

    const rowIndex = this.store.idRowIndexesMap.get(id);
    if (rowIndex === undefined || !this.bodyEl) return;

    const item = this.store.idItemMap[id];
    const col = this.allColumns.find(c => c.index === index);
    if (!col || !item) return;

    const rowEl = this.bodyEl.querySelector<HTMLElement>(`[data-id="${id}"]`);
    const cellEl = rowEl?.querySelector<HTMLElement>(`[data-col-id="${col.id}"]`);
    if (!cellEl) return;

    const rawValue = col.getter ? col.getter({ item, column: col }) : item[col.index!];
    const params = {
      value: rawValue, item, column: col, rowIndex,
      grid: this as unknown as typeof this,
      currency: col.currency, minDecimal: col.minDecimal, maxDecimal: col.maxDecimal,
    };
    cellEl.innerHTML = col.render ? col.render(params) : this.getCellDisplayValue(params);
  }

  getById(id: string): T | undefined {
    return this.store.idItemMap[id] as unknown as T;
  }

  refresh(): void {
    if (this.config.serverAdapter) {
      this._doServerRequest();
    } else {
      this.renderVisibleRows();
    }
    this._emit('raccoon:refresh', { grid: this });
  }

  setTheme(theme: 'raccoon' | 'material' | 'fluent' | 'tabler', dark?: boolean): void {
    if (!this.el) return;
    this.el.classList.remove('rt-theme-material', 'rt-theme-fluent', 'rt-theme-tabler', 'rt-dark', 'rt-light');
    if (theme === 'material') this.el.classList.add('rt-theme-material');
    else if (theme === 'fluent') this.el.classList.add('rt-theme-fluent');
    else if (theme === 'tabler') this.el.classList.add('rt-theme-tabler');
    if (dark === true) this.el.classList.add('rt-dark');
    else if (dark === false) this.el.classList.add('rt-light');
    this.config.theme = theme;
    this.config.dark = dark;
  }

  setThemeVars(vars: ThemeVars | undefined): void {
    if (!this.el) return;
    if (this.config.themeVars) {
      for (const key of Object.keys(this.config.themeVars)) {
        this.el.style.removeProperty(key);
      }
    }
    this.config.themeVars = vars;
    if (vars) {
      for (const [key, val] of Object.entries(vars)) {
        if (val !== undefined) this.el.style.setProperty(key, val);
      }
    }
  }

  _propagateTheme(target: HTMLElement): void {
    if (!this.el) return;
    const THEME_CLASSES = ['rt-theme-material', 'rt-theme-fluent', 'rt-theme-tabler', 'rt-dark', 'rt-light'] as const;
    for (const c of THEME_CLASSES) {
      if (this.el.classList.contains(c)) target.classList.add(c);
    }
    if (this.config.themeVars) {
      for (const [key, val] of Object.entries(this.config.themeVars)) {
        if (val !== undefined) target.style.setProperty(key, val);
      }
    }
  }

  destroy(): void {
    if (this._windowScrollHandler) {
      window.removeEventListener('scroll', this._windowScrollHandler);
      this._windowScrollHandler = undefined;
    }
    if (this._windowResizeHandler) {
      window.removeEventListener('resize', this._windowResizeHandler);
      this._windowResizeHandler = undefined;
    }
    this.scroller.detach();
    this.serverAdapter?.cancel();
    this.el?.remove();
    this.el = null;
    this.headerEl = null;
    this.headerRowEl = null;
    this.filterBarRowEl = null;
    this.bodyEl = null;
    this.fakeScrollEl = null;
  }

  // -------------------------------------------------------------------------
  // Layout API
  // -------------------------------------------------------------------------

  getLayout(): GridLayout {
    const seen = new Set<string>();
    const layoutCols: GridColumnLayout[] = [];

    for (const col of this.visibleColumns) {
      seen.add(col.id);
      layoutCols.push({ id: col.id, hidden: false, width: col.width, pinned: col.pinned });
    }
    for (const col of this.allColumns) {
      if (!seen.has(col.id)) {
        layoutCols.push({ id: col.id, hidden: true, width: col.width, pinned: col.pinned });
      }
    }

    return {
      columns: layoutCols,
      sort: this.store.sorters.length
        ? this.store.sorters.map(s => ({ columnId: s.column.id, dir: s.dir }))
        : undefined,
      filters: this.store.filters.length
        ? this.store.filters.map(f => ({ columnId: f.column.id, value: f.value, sign: f.sign }))
        : undefined,
      pagination: this.config.pagination?.enabled
        ? { page: this._currentPage, pageSize: this._pageSize }
        : undefined,
      rowGroups: this.store.rowGroups.length ? [...this.store.rowGroups] : undefined,
    };
  }

  setLayout(layout: GridLayout): void {
    // 1. Apply per-column width / hidden / pinned
    for (const lc of layout.columns) {
      const col = this.columnsById[lc.id];
      if (!col) continue;
      if (lc.width !== undefined) col.width = lc.width;
      col.pinned = lc.pinned;
      col.hidden = lc.hidden ?? false;
    }

    // 2. Reorder allColumns to match layout column order
    const orderMap = new Map(layout.columns.map((lc, i) => [lc.id, i]));
    this.allColumns.sort((a, b) => {
      const ai = orderMap.get(a.id) ?? this.allColumns.length;
      const bi = orderMap.get(b.id) ?? this.allColumns.length;
      return ai - bi;
    });

    // 3. Rebuild visibleColumns, preserving pin ordering within the ordered set
    this.visibleColumns = this.allColumns.filter(c => !c.hidden);
    const pinOrder = (c: ColumnDef): number =>
      c.pinned === 'left' ? 0 : c.pinned === 'right' ? 2 : 1;
    this.visibleColumns.sort((a, b) => pinOrder(a) - pinOrder(b));
    this.scroller.setColumns(this.visibleColumns);

    // 4. Reset data transforms
    this.store.sorters = [];
    this.store.filters = [];
    this.store.sortedData = undefined;
    this.store.filteredData = undefined;

    // 5. Apply sort
    if (layout.sort?.length && !this.store.serverMode) {
      for (const s of layout.sort) {
        const col = this.columnsById[s.columnId];
        if (col) this.store.sorters.push({ column: col, dir: s.dir });
      }
      this.store.reSort();
      this.store.prevAction = 'sort';
    }

    // 6. Apply filters
    if (layout.filters?.length && !this.store.serverMode) {
      for (const f of layout.filters) {
        const col = this.columnsById[f.columnId];
        if (col) this.store.filters.push({ column: col, value: f.value, sign: f.sign });
      }
      this.store.reFilter();
    }

    // 7. Apply row groups
    if (layout.rowGroups !== undefined && !this.store.serverMode) {
      this.store.reConfigRowGroups(layout.rowGroups);
    } else if (!layout.sort?.length && !layout.filters?.length) {
      this.store.displayedData = undefined;
      this.store.updateIndexes();
    }

    // 8. Apply pagination
    if (layout.pagination && this.config.pagination?.enabled) {
      this._pageSize = layout.pagination.pageSize;
      this._currentPage = layout.pagination.page;
    }

    // 9. Re-render
    this.clearRows();
    this.renderHeader();
    if (this.config.filterBar) this.updateFilterBarCells();

    if (this.config.pagination?.enabled) {
      this._applyPagination();
      this._renderPagination();
    } else {
      this.scroller.totalRows = this.store.getDisplayedDataTotal();
      this.renderVisibleRows();
    }

    if (this.config.rowGroupBar) this.renderRowGroupBar();
  }

  // -------------------------------------------------------------------------
  // Global search bar
  // -------------------------------------------------------------------------

  _createSearchBar(): HTMLElement {
    const bar = div(cls.searchBar);
    const icon = div(cls.searchBarIcon);
    icon.innerHTML = svg.search;
    bar.appendChild(icon);

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.classList.add(cls.searchBarInput);
    inp.placeholder = this.config.searchBarPlaceholder ?? this._locale.searchPlaceholder;

    const doSearch = debounce((value: string) => {
      this._globalSearch = value || undefined;
      if (this.config.serverAdapter) {
        this._triggerServerRequest();
      } else {
        this._applyGlobalSearch(value);
      }
    }, this.config.searchDebounceMs ?? 300);

    inp.addEventListener('input', () => doSearch(inp.value));
    bar.appendChild(inp);

    return bar;
  }

  _applyGlobalSearch(value: string): void {
    if (!value) {
      // Restore data without global filter
      this.store.filteredData = undefined;
      if (this.store.filters.length) {
        this.store.reFilter(false);
      } else {
        this.store.displayedData = undefined;
      }
    } else {
      // Multi-column text match
      this.store.filteredData = this.store.data.filter(item =>
        this.visibleColumns.some(col => {
          const v = col.getter ? col.getter({ item, column: col }) : item[col.index!];
          return String(v ?? '').toLocaleLowerCase().includes(value.toLocaleLowerCase());
        })
      );
      this.store.displayedData = this.store.filteredData;
      this.store.updateIndexMapAfterFilter();
    }

    this.scroller.totalRows = this.store.getDisplayedDataTotal();
    this.scroller.scrollTo(0);
    this.renderVisibleRows();
  }

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  /**
   * Total rows BEFORE pagination slice.
   * Returns -1 when the server did not supply a total (hasKnownLastPage = false).
   */
  _getPaginationTotal(): number {
    if (this.config.serverAdapter) return this.store.serverTotal;
    if (this.store.rowGroups.length) return this.store.getDisplayedDataTotal();
    return this.store.filteredData?.length ?? this.store.sortedData?.length ?? this.store.data.length;
  }

  /**
   * Builds the sliding-window page button sequence.
   * Returns a mix of page numbers (1-based) and 'ellipsis' sentinels.
   * Always includes page 1 and totalPages; shows a window of 4 around current page.
   */
  _buildPageWindow(page: number, totalPages: number): Array<number | 'ellipsis'> {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const WINDOW = 4;
    const startWin = Math.max(2, Math.min(totalPages - WINDOW, page - 1));
    const endWin = startWin + WINDOW - 1;
    const result: Array<number | 'ellipsis'> = [1];
    if (startWin > 2) result.push('ellipsis');
    for (let i = startWin; i <= endWin; i++) result.push(i);
    if (endWin < totalPages - 1) result.push('ellipsis');
    result.push(totalPages);
    return result;
  }

  _renderPagination(): void {
    if (!this.paginationEl) return;
    const pagination = this.config.pagination!;
    const total = this._getPaginationTotal();
    const hasKnownTotal = total >= 0;
    const pageSize = this._pageSize;
    const totalPages = hasKnownTotal ? Math.max(1, Math.ceil(total / pageSize)) : null;
    const page = this._currentPage;

    this.paginationEl.innerHTML = '';
    const wrap = div(cls.paginationInner);

    // Page size selector
    if (pagination.pageSizeOptions?.length) {
      const sizeWrap = div(cls.paginationSizeWrap);
      const sizeLabel = document.createElement('span');
      sizeLabel.textContent = this._locale.rowsPerPage;
      sizeWrap.appendChild(sizeLabel);

      const sel = document.createElement('select');
      sel.classList.add(cls.paginationSizeSelect);
      for (const size of pagination.pageSizeOptions) {
        const opt = document.createElement('option');
        opt.value = String(size);
        opt.textContent = String(size);
        if (size === pageSize) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => {
        this._pageSize = Number(sel.value);
        this._currentPage = 1;
        if (!this.config.serverAdapter) this._applyPagination();
        else this._doServerRequest();
        this._renderPagination();
      });
      sizeWrap.appendChild(sel);
      wrap.appendChild(sizeWrap);
    }

    // Info text
    const info = document.createElement('span');
    info.classList.add(cls.paginationInfo);
    if (!hasKnownTotal || total > 0) {
      const start = (page - 1) * pageSize + 1;
      const end = hasKnownTotal ? Math.min(page * pageSize, total) : page * pageSize;
      info.textContent = hasKnownTotal
        ? formatPageInfo(this._locale.pageInfo, start, end, total)
        : formatPageInfo(this._locale.pageInfoUnknownTotal, start, end);
    } else {
      info.textContent = this._locale.zeroItems;
    }
    wrap.appendChild(info);

    // Navigation
    const navWrap = div(cls.paginationNav);

    // First + Prev (always)
    navWrap.appendChild(this._createPageBtn(svg.pageFirst, () => this._goToPage(1), page === 1));
    navWrap.appendChild(this._createPageBtn(svg.pagePrev, () => this._goToPage(page - 1), page === 1));

    if (hasKnownTotal && totalPages !== null) {
      // Sliding window numbered buttons
      for (const p of this._buildPageWindow(page, totalPages)) {
        if (p === 'ellipsis') {
          const el = document.createElement('span');
          el.className = cls.paginationEllipsis;
          el.textContent = '…';
          navWrap.appendChild(el);
        } else {
          const pNum = p;
          const btn = this._createPageBtn(String(pNum), () => this._goToPage(pNum), false);
          btn.classList.add(cls.paginationPageNum);
          if (pNum === page) {
            btn.classList.add(cls.paginationPageActive);
            btn.disabled = true;
          }
          navWrap.appendChild(btn);
        }
      }
    } else {
      // Unknown total: show current page badge only
      const badge = document.createElement('span');
      badge.className = `${cls.paginationPageNum} ${cls.paginationPageActive}`;
      badge.textContent = String(page);
      navWrap.appendChild(badge);
    }

    // Next + Last
    const nextDisabled = hasKnownTotal && totalPages !== null && page === totalPages;
    navWrap.appendChild(this._createPageBtn(svg.pageNext, () => this._goToPage(page + 1), nextDisabled));
    if (hasKnownTotal && totalPages !== null) {
      navWrap.appendChild(this._createPageBtn(svg.pageLast, () => this._goToPage(totalPages), page === totalPages));
    }

    wrap.appendChild(navWrap);
    this.paginationEl.appendChild(wrap);
  }

  _createPageBtn(iconHtml: string, onClick: () => void, disabled: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.classList.add(cls.paginationBtn);
    btn.innerHTML = iconHtml;
    btn.disabled = disabled;
    if (!disabled) btn.addEventListener('click', onClick);
    return btn;
  }

  _goToPage(page: number): void {
    const total = this._getPaginationTotal();
    const hasKnownTotal = total >= 0;
    const totalPages = hasKnownTotal ? Math.max(1, Math.ceil(total / this._pageSize)) : Infinity;
    const targetPage = Math.max(1, hasKnownTotal ? Math.min(totalPages, page) : page);

    if (!this._emit('raccoon:beforePageChange', {
      grid: this, page: targetPage, pageSize: this._pageSize, currentPage: this._currentPage,
    })) return;

    this._currentPage = targetPage;

    if (this.config.serverAdapter) {
      this._doServerRequest();
    } else {
      this._applyPagination();
    }

    this._renderPagination();
    this._emit('raccoon:pageChange', { grid: this, page: this._currentPage, pageSize: this._pageSize });
  }

  _applyPagination(): void {
    this._groupPageOffset = 0;
    if (this.store.rowGroups.length) {
      // displayedData is the full flat group tree (group headers + expanded data rows).
      // Paginate by rendering a window into this list via _groupPageOffset.
      // This matches DevExtreme DataGrid: page count = ceil(displayedRows / pageSize),
      // expanding a group grows the total and may add pages.
      const total = this.store.getDisplayedDataTotal();
      const start = (this._currentPage - 1) * this._pageSize;
      this._groupPageOffset = start;
      this.scroller.totalRows = Math.max(0, Math.min(this._pageSize, total - start));
      this.scroller.scrollTo(0);
      this.clearRows();
      this.renderVisibleRows();
      return;
    }
    const all = this.store.filteredData ?? this.store.sortedData ?? this.store.data;
    const start = (this._currentPage - 1) * this._pageSize;
    this.store.displayedData = all.slice(start, start + this._pageSize);
    this.store.updateIndexes();
    this.scroller.totalRows = this.store.displayedData.length;
    this.scroller.scrollTo(0);
    this.renderVisibleRows();
  }

  // -------------------------------------------------------------------------
  // Server mode
  // -------------------------------------------------------------------------

  _doServerRequest(): void {
    if (!this.serverAdapter) return;

    const page = this._currentPage;
    const pageSize = this._pageSize;
    const start = (page - 1) * pageSize;

    const params = ServerAdapter.buildParams({
      start,
      limit: pageSize,
      page,
      pageSize,
      sorters: this.store.sorters,
      filters: this.store.filters,
      rowGroups: this.store.rowGroups,
      globalSearch: this._globalSearch,
    });

    this._showLoading();

    this.serverAdapter.requestImmediate(params, (resp: ServerResponse) => {
      this._hideLoading();
      this.store.data = resp.data as GridItem[];
      // -1 sentinel = server did not return a total (hasKnownLastPage = false)
      this.store.serverTotal = (resp.total !== undefined && resp.total >= 0) ? resp.total : -1;
      this.store.setIds();
      this.scroller.totalRows = resp.data.length; // visible rows = page of data
      this.clearRows(); // setIds resets idSeed to 0 → new items get same IDs as old DOM rows → must purge stale elements
      this.renderVisibleRows();
      if (this.config.pagination?.enabled) this._renderPagination();
      this.config.onServerResponse?.(resp);
      this._emit('raccoon:dataLoaded', { grid: this, total: resp.total ?? -1, source: 'server' });
    });
  }

  _showLoading(): void {
    if (this.loadingEl) this.loadingEl.style.display = 'flex';
  }

  _hideLoading(): void {
    if (this.loadingEl) this.loadingEl.style.display = 'none';
  }

  // -------------------------------------------------------------------------
  // Misc helpers
  // -------------------------------------------------------------------------

  _calcHeaderHeight(): number {
    let h = 32;
    if (this.config.columnGroups?.length) h += 32;
    if (this.config.filterBar) h += 32;
    return h;
  }

  // ---- mixin stubs (TypeScript satisfaction — real implementations come from mixins) ----
  // These declarations exist only so TypeScript resolves them via the prototype merger below.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  clearRows(): void { throw new Error('mixin not applied'); }
  renderVisibleRows(): void { throw new Error('mixin not applied'); }
  renderVisibleRowsAfterSort(): void { throw new Error('mixin not applied'); }
  renderVisibleRowsAfterFilter(): void { throw new Error('mixin not applied'); }
  renderRow(_item: GridItem, _rowIndex: number): HTMLElement { throw new Error('mixin not applied'); }
  renderRowGroup(_item: GridItem, _rowIndex: number): HTMLElement { throw new Error('mixin not applied'); }
  createCell(_item: GridItem, _col: ColumnDef, _rowIndex: number): HTMLElement { throw new Error('mixin not applied'); }
  getCellDisplayValue(_params: unknown): string { throw new Error('mixin not applied'); }
  updateCellPositions(): void { throw new Error('mixin not applied'); }
  updateFakeScroller(): void { throw new Error('mixin not applied'); }
  getColumnLeft(_col: ColumnDef): number { throw new Error('mixin not applied'); }
  onRowGroupExpanderClick(_item: GridItem): void { throw new Error('mixin not applied'); }
  _afterGroupChange(): void { throw new Error('mixin not applied'); }

  renderHeader(): void { throw new Error('mixin not applied'); }
  renderGroupHeader(): void { throw new Error('mixin not applied'); }
  renderFilterBar(): HTMLElement { throw new Error('mixin not applied'); }
  createHeaderCell(_col: ColumnDef): HTMLElement { throw new Error('mixin not applied'); }
  createFilterBarCell(_col: ColumnDef): HTMLElement { throw new Error('mixin not applied'); }
  createFilterField(_col: ColumnDef, _container: HTMLElement): HTMLElement { throw new Error('mixin not applied'); }
  updateFilterBarCells(): void { throw new Error('mixin not applied'); }
  _updateFilterActiveIndicators(): void { throw new Error('mixin not applied'); }
  // _propagateTheme is a real method defined above (not a mixin stub)
  showHeaderCellMenuList(_e: MouseEvent, _col: ColumnDef, _cell: HTMLElement): void { throw new Error('mixin not applied'); }
  closeHeaderCellMenu(): void { throw new Error('mixin not applied'); }
  onHeaderCellClick(_e: MouseEvent, _col: ColumnDef): void { throw new Error('mixin not applied'); }
  onResizeMouseDown(_e: MouseEvent, _col: ColumnDef, _cell: HTMLElement): void { throw new Error('mixin not applied'); }
  onResizeMouseMove(_e: MouseEvent): void { throw new Error('mixin not applied'); }
  onResizeMouseUp(): void { throw new Error('mixin not applied'); }

  sort(_column: ColumnDef, _dir?: SortDir, _multi?: boolean): void { throw new Error('mixin not applied'); }
  clearSort(_column?: ColumnDef, _multi?: boolean): void { throw new Error('mixin not applied'); }

  filter(_column: ColumnDef, _value: unknown, _sign?: FilterSign, _onePerColumn?: boolean): void { throw new Error('mixin not applied'); }
  clearFilter(_column?: ColumnDef, _sign?: FilterSign): void { throw new Error('mixin not applied'); }
  showFilterSignList(_col: ColumnDef, _btn: HTMLElement, _cb: (sign: FilterSign) => void): void { throw new Error('mixin not applied'); }
  _createBooleanFilterSelect(_col: ColumnDef): HTMLElement { throw new Error('mixin not applied'); }
  _createLookupFilterSelect(_col: ColumnDef): HTMLElement { throw new Error('mixin not applied'); }
  _createDateFilterField(_col: ColumnDef): HTMLElement { throw new Error('mixin not applied'); }

  prepareColumns(): void { throw new Error('mixin not applied'); }
  prepareColumn(_col: ColumnDef): ColumnDef { throw new Error('mixin not applied'); }
  generateColumnIds(): void { throw new Error('mixin not applied'); }
  setColumns(_columns: ColumnDef[]): void { throw new Error('mixin not applied'); }
  showColumn(_colId: string): void { throw new Error('mixin not applied'); }
  hideColumn(_colId: string): void { throw new Error('mixin not applied'); }
  moveColumn(_fromColId: string, _toColId: string): void { throw new Error('mixin not applied'); }
  setColumnWidth(_colId: string, _width: number): void { throw new Error('mixin not applied'); }
  applyFlexColumns(): void { throw new Error('mixin not applied'); }
  pinColumn(_colId: string, _pin: 'left' | 'right' | false): void { throw new Error('mixin not applied'); }

  selectRow(_item: GridItem, _selected: boolean): void { throw new Error('mixin not applied'); }
  selectAll(_selected: boolean): void { throw new Error('mixin not applied'); }
  getSelectedRows(): T[] { throw new Error('mixin not applied'); }
  onCellMouseDown(_e: MouseEvent, _item: GridItem, _col: ColumnDef, _rowIndex: number, _cellEl: HTMLElement): void { throw new Error('mixin not applied'); }
  setActiveCell(_rowIndex: number, _colIndex: number): void { throw new Error('mixin not applied'); }
  clearCellSelection(): void { throw new Error('mixin not applied'); }
  _renderSelectionRange(): void { throw new Error('mixin not applied'); }
  _clearSelectionClasses(): void { throw new Error('mixin not applied'); }

  initKeyNavigation(): void { throw new Error('mixin not applied'); }
  initScrollListeners(): void { throw new Error('mixin not applied'); }

  expand(_group: string): void { throw new Error('mixin not applied'); }
  collapse(_group: string): void { throw new Error('mixin not applied'); }
  expandAll(): void { throw new Error('mixin not applied'); }
  collapseAll(): void { throw new Error('mixin not applied'); }
  reConfigRowGroups(_groups: string[]): void { throw new Error('mixin not applied'); }
  addGroupToBar(_index: string): void { throw new Error('mixin not applied'); }
  removeGroupFromBar(_index: string): void { throw new Error('mixin not applied'); }

  renderRowGroupBar(): void { throw new Error('mixin not applied'); }
  changeRowGroupBarItemOrder(_from: string, _to: string): void { throw new Error('mixin not applied'); }
  createRowGroupBarChip(_label: string, _index: string): HTMLElement { throw new Error('mixin not applied'); }

  initColumnDrag(): void { throw new Error('mixin not applied'); }

  // ---- internal mixin helpers (called across mixin boundaries) ----
  onRowClick(_e: MouseEvent, _item: GridItem, _rowIndex: number, _rowEl: HTMLElement): void { throw new Error('mixin not applied'); }
  onRowDblClick(_e: MouseEvent, _item: GridItem, _rowIndex: number, _rowEl: HTMLElement): void { throw new Error('mixin not applied'); }
  onGroupRowCheckboxChange(_item: GridItem, _checked: boolean): void { throw new Error('mixin not applied'); }
  _onColumnDragStart(_e: MouseEvent, _col: ColumnDef, _headerCell: HTMLElement): void { throw new Error('mixin not applied'); }
  _createDragColumnGhost(_headerCell: HTMLElement, _col: ColumnDef): HTMLElement { throw new Error('mixin not applied'); }
  _getSignsForColumn(_col: ColumnDef): Array<{ text: string; sign: FilterSign }> { throw new Error('mixin not applied'); }
  createHeaderCheckboxCell(): HTMLElement { throw new Error('mixin not applied'); }
  _onBodyKeyDown(_e: KeyboardEvent): void { throw new Error('mixin not applied'); }
  _navigateTo(_rowIndex: number, _colIndex: number): void { throw new Error('mixin not applied'); }
  _syncHeaderScroll(): void { throw new Error('mixin not applied'); }
  _updateStickyColumns(): void { throw new Error('mixin not applied'); }
  _onNativeScroll(): void { throw new Error('mixin not applied'); }
  _onMouseWheel(_e: WheelEvent): void { throw new Error('mixin not applied'); }
  _onMouseWheelHorizontal(_e: WheelEvent): void { throw new Error('mixin not applied'); }
  _onWindowScroll(): void { throw new Error('mixin not applied'); }
  _onTouchStart(_e: TouchEvent): void { throw new Error('mixin not applied'); }
  _onTouchMove(_e: TouchEvent): void { throw new Error('mixin not applied'); }
  _onTouchMoveHorizontal(_e: TouchEvent): void { throw new Error('mixin not applied'); }
  _onTouchEnd(): void { throw new Error('mixin not applied'); }
  _updateRowSelectedClass(_item: GridItem): void { throw new Error('mixin not applied'); }
  _updateSelectAllCheckbox(): void { throw new Error('mixin not applied'); }
  _onSelectionMouseMove(_e: MouseEvent, _anchorRow: number, _anchorCol: number): void { throw new Error('mixin not applied'); }
  _serverSort(_column: ColumnDef, _dir: SortDir, _multi: boolean): void { throw new Error('mixin not applied'); }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}

// ---------------------------------------------------------------------------
// Apply all mixins to the prototype
// ---------------------------------------------------------------------------

const MIXINS = [
  BodyMixin,
  HeaderMixin,
  SortMixin,
  FilterMixin,
  ColumnMixin,
  SelectionMixin,
  KeyNavigationMixin,
  ScrollMixin,
  RowGroupMixin,
  RowGroupBarMixin,
  ColumnDragMixin,
];

for (const mixin of MIXINS) {
  for (const key of Object.keys(mixin)) {
    Object.defineProperty(
      RaccoonGrid.prototype,
      key,
      Object.getOwnPropertyDescriptor(mixin, key)!
    );
  }
}
