// ============================================================================
// Raccoon Tables - Core Type Definitions
// ============================================================================

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** A single row of data (arbitrary key-value pairs). */
export type RowData = Record<string, unknown>;

/** Internal item: raw row data + internal bookkeeping fields prefixed `$`. */
export interface GridItem extends RowData {
  id: string;
  rowIndex?: number;
  originalRowIndex?: number;
  $rowGroupValue?: string;
  $rowDisplayGroupValue?: string;
  $groupLevel?: number;
  $isGroupRow?: boolean;
  $hasChildrenGroups?: boolean;
  $selected?: boolean;
  $agValues?: Record<string, unknown>;
  amount?: number;
  childrenAmount?: number;
  expanded?: boolean;
  selectedStatus?: 'full' | 'partly' | false;
}

// ---------------------------------------------------------------------------
// Column types
// ---------------------------------------------------------------------------

/** Column value type. Controls sort algorithm, filter operators, and default render. */
export type ColumnType = 'string' | 'number' | 'boolean' | 'currency' | 'date' | 'order';

/** Sort direction. */
export type SortDir = 'ASC' | 'DESC';

/** Filter operator. 15 supported operators. */
export type FilterSign =
  | '='      // contains (default)
  | '!='     // not contains
  | '=='     // equals (strict)
  | '!=='    // not equals (strict)
  | '>'      // greater than
  | '<'      // less than
  | 'a_'     // starts with
  | '_a'     // ends with
  | 'regex'  // regular expression
  | 'empty'  // value is empty/null/undefined
  | '!empty' // value is not empty
  | '+'      // positive number
  | '-'      // negative number
  | 'in'     // value is in list
  | 'T'      // boolean true
  | 'F';     // boolean false

/** Aggregation function for row grouping. */
export type AggregationFn = 'sum' | 'avg' | 'min' | 'max' | ((values: number[]) => number);

/** A single option in a lookup (dropdown) filter. */
export interface LookupOption {
  value: unknown;
  name: string;
}

/**
 * Lookup (dropdown) filter configuration for a column.
 * When set, the filter bar shows a `<select>` instead of a text input.
 * The filter always uses exact-match (`==`) comparison.
 *
 * Supply either `options` (static array) or `url` (AJAX).
 */
export interface LookupConfig {
  /** Static list of options. Mutually exclusive with `url`. */
  options?: LookupOption[];
  /**
   * AJAX URL. The response must be either:
   *   - `Array<{value, name}>` — a flat array
   *   - `{data: Array<{value, name}>}` — wrapped in a `data` key
   *   - `{data: Array<{[valueField], [nameField]}>}` — custom field names
   */
  url?: string;
  /** Property name on each AJAX record to use as the filter value. Default: `"value"`. */
  valueField?: string;
  /** Property name on each AJAX record to use as the display label. Default: `"name"`. */
  nameField?: string;
  /** Extra query params appended to the AJAX URL. */
  params?: Record<string, string>;
}

/** Row group sort order. */
export type RowGroupSort = 'asc-string' | 'desc-string' | 'asc-amount' | 'desc-amount';

// ---------------------------------------------------------------------------
// Callback parameter types
// ---------------------------------------------------------------------------

/** Parameters passed to cell render/format/style/cls callbacks. */
export interface CellParams<T extends RowData = RowData> {
  value: unknown;
  item: GridItem & Partial<T>;
  column: ColumnDef<T>;
  rowIndex: number;
  grid?: RaccoonGrid<T>;
  currency?: string;
  minDecimal?: number;
  maxDecimal?: number;
}

/** Parameters for row-level style/cls callbacks. */
export interface RowParams<T extends RowData = RowData> {
  rowIndex: number;
  item: GridItem & Partial<T>;
}

/** Parameters for row click/dblclick callbacks. */
export interface RowClickParams<T extends RowData = RowData> {
  event: MouseEvent;
  item: GridItem & Partial<T>;
  rowIndex: number;
  grid: RaccoonGrid<T>;
}

/** Parameters for cell click callback. */
export interface CellClickParams<T extends RowData = RowData> {
  event: MouseEvent;
  item: GridItem & Partial<T>;
  column: ColumnDef<T>;
  rowIndex: number;
  grid: RaccoonGrid<T>;
}

/** Parameters for row selection change callback. */
export interface RowSelectionChangeParams<T extends RowData = RowData> {
  selected: Array<GridItem & Partial<T>>;
  deselected: Array<GridItem & Partial<T>>;
  all: Array<GridItem & Partial<T>>;
}

/** Parameters for column show/hide/reorder callback. */
export interface ColumnChangeParams<T extends RowData = RowData> {
  columns: ColumnDef<T>[];
}

/** Parameters for column resize callback. */
export interface ColumnResizeParams<T extends RowData = RowData> {
  column: ColumnDef<T>;
  width: number;
}

// ---------------------------------------------------------------------------
// Column definition
// ---------------------------------------------------------------------------

/** Multi-level column group (spans several columns). */
export interface ColumnGroup {
  /** Group header label. */
  text?: string;
  /** Column IDs that belong to this group. */
  columns: string[];
  /** Extra CSS class on the group header cell. */
  cls?: string;
}

/** Per-column aggregation config. */
export interface Aggregation {
  /** Column data index. */
  index: string;
  /** Aggregation function. */
  fn: AggregationFn;
}

/**
 * Column definition. Generic over row data type T.
 * All fields are optional; at minimum you need `index` or `render`.
 */
export interface ColumnDef<T extends RowData = RowData> {
  // ---- Identity ----
  /** Unique column ID. Auto-generated if omitted. */
  id: string;
  /** Data property key. Maps to `item[index]`. */
  index?: string;
  /** Header display text. Falls back to capitalized `index`. */
  text?: string;
  /** Alias for `text`. */
  title?: string;

  // ---- Type ----
  /** Value type. Drives sort algorithm and default cell renderer. */
  type?: ColumnType;

  // ---- Size ----
  /** Column width in pixels. */
  width?: number;
  /** Minimum column width during resize. Default: 20. */
  minWidth?: number;
  /**
   * Flex grow value. When set, column claims proportional share of remaining width.
   * `flex: 1` and `flex: 2` give 1:2 ratio.
   */
  flex?: number | true;

  // ---- Visibility ----
  /** Start hidden. */
  hidden?: boolean;
  /** Pin column to left or right edge. Pinned-left columns are sorted first; pinned-right last. */
  pinned?: 'left' | 'right';

  // ---- Behaviour ----
  /** Allow sort by clicking header. Default: true. */
  sortable?: boolean;
  /** Allow filter field in filter bar. Default: true. */
  filterable?: boolean;
  /** Allow column resize handle. Default: true. */
  resizable?: boolean;
  /** Allow column drag-reorder. Default: true. */
  draggable?: boolean;
  /** Show column header context menu. Default: true. Pass `false` to disable. */
  menuItems?: boolean;
  // ---- Style ----
  /** Extra CSS class(es) on the header cell. */
  cls?: string;
  /** Cell horizontal text alignment. */
  align?: 'left' | 'center' | 'right';

  // ---- Currency ----
  /** ISO currency code (for type='currency'). */
  currency?: string;
  /** Minimum fraction digits (for type='currency' and format). */
  minDecimal?: number;
  /** Maximum fraction digits. */
  maxDecimal?: number;

  // ---- Filter ----
  /** Input placeholder in filter bar. */
  filterPlaceholder?: string;
  /**
   * Lookup (dropdown) filter. Replaces the text input with a `<select>`.
   * Useful for foreign-key columns: lets users pick a related record by name
   * while filtering by the stored ID value.
   * Always performs exact-match (`==`) comparison.
   */
  filterLookup?: LookupConfig;

  // ---- Row grouping ----
  /** Mark this column as a row group column. */
  rowGroup?: boolean;
  /** Use a pre-built data index for faster string sorting. */
  dataIndex?: boolean;

  // ---- Callbacks ----
  /** Custom cell renderer. Returns an HTML string. */
  render?: (params: CellParams<T>) => string;
  /** Value formatter (used as display value; overrides default type formatting). */
  format?: (params: CellParams<T>) => string;
  /** Custom summary/aggregation renderer for group rows. */
  summaryRenderer?: (params: CellParams<T>) => string;
  /** Custom value getter. Return the raw value used for sorting, filtering, and display. */
  getter?: (params: Pick<CellParams<T>, 'item' | 'column'>) => unknown;
  /** Custom value setter. Called on cell edit commit. */
  setter?: (params: Pick<CellParams<T>, 'item' | 'column'> & { value: unknown }) => void;
  /** Dynamic cell CSS class string. */
  cellCls?: (params: CellParams<T>) => string;
  /** Conditional cell CSS classes. Key=className, value=predicate. */
  cellClsRules?: Record<string, (params: CellParams<T>) => boolean>;
  /** Dynamic cell inline style. */
  cellStyle?: (params: CellParams<T>) => Record<string, string>;
  /** Allow cell content to overflow its boundaries (e.g. for action dropdowns). */
  cellOverflow?: boolean;

  // ---- Internal (do not set) ----
  sort?: SortDir;
}

// ---------------------------------------------------------------------------
// Layout snapshot
// ---------------------------------------------------------------------------

/** Per-column state captured in a layout snapshot. */
export interface GridColumnLayout {
  id: string;
  hidden?: boolean;
  width?: number;
  pinned?: 'left' | 'right';
}

/** Serializable snapshot of the full grid layout. Use with getLayout() / setLayout(). */
export interface GridLayout {
  /** Column order, visibility, width, and pin state. Columns appear in display order. */
  columns: GridColumnLayout[];
  /** Active sort configuration. Undefined = no active sort. */
  sort?: Array<{ columnId: string; dir: SortDir }>;
  /** Active filters. Undefined = no active filters. */
  filters?: Array<{ columnId: string; value: unknown; sign: FilterSign }>;
  /** Pagination state (only meaningful when pagination is enabled). */
  pagination?: { page: number; pageSize: number };
  /** Active row groups (column indexes). Undefined = no grouping. */
  rowGroups?: string[];
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationConfig {
  enabled: boolean;
  /** Rows per page. Default: 50. */
  pageSize?: number;
  /** Available page size options shown in the selector. */
  pageSizeOptions?: number[];
  /** Initial page (1-based). Default: 1. */
  page?: number;
  /** Position of the pagination bar. Default: 'bottom'. */
  position?: 'bottom' | 'top' | 'both';
}

// ---------------------------------------------------------------------------
// Server-side adapter
// ---------------------------------------------------------------------------

/**
 * Normalized parameters sent to the server on every interaction.
 * All paging/sort/filter/group state is captured here.
 */
export interface ServerRequestParams {
  /** Offset of the first row (0-based). */
  start: number;
  /** Number of rows to fetch. */
  limit: number;
  /** Current page number (1-based). */
  page?: number;
  /** Rows per page. */
  pageSize?: number;
  /** Active sort columns. */
  sort?: Array<{ index: string; dir: SortDir }>;
  /** Active filters. */
  filters?: Array<{ index: string; value: unknown; sign: FilterSign }>;
  /** Active row groups (column indexes). */
  rowGroups?: string[];
  /** Global search string. */
  globalSearch?: string;
}

/** Expected shape of a server response. */
export interface ServerResponse {
  /** Page of data rows. */
  data: RowData[];
  /** Total rows matching current filters (used for pagination). */
  total: number;
  /** Optional server-computed group summaries. */
  groups?: Record<string, { amount: number; agValues?: Record<string, unknown> }>;
}

/** Configuration for the built-in AJAX adapter. */
export interface ServerAdapterConfig {
  /** Endpoint URL. */
  url: string;
  /** HTTP method. Default: 'POST'. */
  method?: 'GET' | 'POST';
  /** Fixed HTTP headers merged into every request. */
  headers?: Record<string, string>;
  /**
   * Transform outgoing params before they are sent.
   * Useful for renaming fields to match your API schema.
   */
  prepareRequest?: (params: ServerRequestParams) => Record<string, unknown>;
  /**
   * Transform raw response into `ServerResponse`.
   * Useful when your API returns data in a non-standard shape.
   */
  parseResponse?: (raw: Record<string, unknown>) => ServerResponse;
  /** Debounce delay in ms before firing after user input. Default: 300. */
  debounceMs?: number;
  /** Fetch credentials mode. Default: 'same-origin'. */
  credentials?: RequestCredentials;
  /** Error handler. */
  onError?: (err: Error) => void;
}

// ---------------------------------------------------------------------------
// Theme customisation
// ---------------------------------------------------------------------------

/**
 * CSS custom property overrides for the grid.
 *
 * Keys are exact CSS variable names (`--rt-*`). Any key supplied here is
 * applied as an inline style on the root `.rt-wrap` element, so it wins over
 * both `:root` defaults and the active theme block.
 *
 * Use this to extend an existing theme (override just a few tokens) or to
 * build a fully custom theme (override all tokens while omitting `config.theme`).
 *
 * The index signature `[key: string]` allows arbitrary CSS custom properties
 * beyond the known `--rt-*` set — useful for referencing grid variables from
 * your own CSS.
 */
export interface ThemeVars {
  '--rt-font-family'?: string;
  '--rt-font-size'?: string;
  '--rt-line-height'?: string;
  '--rt-color-bg'?: string;
  '--rt-color-bg-alt'?: string;
  '--rt-color-bg-header'?: string;
  '--rt-color-bg-group'?: string;
  '--rt-color-bg-selected'?: string;
  '--rt-color-bg-hover'?: string;
  '--rt-color-bg-menu'?: string;
  '--rt-color-border'?: string;
  '--rt-color-border-focus'?: string;
  '--rt-color-text'?: string;
  '--rt-color-text-secondary'?: string;
  '--rt-color-text-header'?: string;
  '--rt-color-text-group'?: string;
  '--rt-color-primary'?: string;
  '--rt-color-primary-hover'?: string;
  '--rt-color-danger'?: string;
  '--rt-row-height'?: string;
  '--rt-header-height'?: string;
  '--rt-border-radius'?: string;
  '--rt-transition'?: string;
  '--rt-scrollbar-width'?: string;
  '--rt-shadow-menu'?: string;
  '--rt-sort-indicator-color'?: string;
  '--rt-filter-active-color'?: string;
  '--rt-cell-selected-bg'?: string;
  '--rt-cell-selected-border'?: string;
  '--rt-loading-overlay-bg'?: string;
  [key: string]: string | undefined;
}

// ---------------------------------------------------------------------------
// Grid configuration
// ---------------------------------------------------------------------------

/**
 * Top-level configuration object passed to `new RaccoonGrid(config)`.
 * Generic over row data shape T.
 */
export interface GridConfig<T extends RowData = RowData> {
  // ---- Data ----
  /** Initial client-side data. Ignored in server mode. */
  data?: T[];
  /** Column definitions. Required. */
  columns: ColumnDef<T>[];

  // ---- Dimensions ----
  /** Grid height in pixels. */
  height?: number;
  /** Grid width in pixels. */
  width?: number;
  /** Body row height in pixels. Default: 32. */
  rowHeight?: number;
  /** Default column width in pixels. Default: 100. */
  defaultColumnWidth?: number;

  // ---- Appearance ----
  /** Visual theme. Default: 'raccoon'. */
  theme?: 'raccoon' | 'material' | 'fluent' | 'tabler';
  /**
   * Color scheme. `true` = dark, `false` = light, `undefined` = follow OS preference.
   * Default: undefined (auto).
   */
  dark?: boolean;
  /** Extra CSS class(es) on the root element. */
  cls?: string;
  /** Inline style applied to the root element. */
  style?: Record<string, string>;
  /**
   * CSS custom property overrides. Applied as inline styles on `.rt-wrap`,
   * so they win over any theme. Override a handful of tokens to extend a
   * theme, or set all of them to build a fully custom theme.
   * See `ThemeVars` for the full list of known token names.
   */
  themeVars?: ThemeVars;

  // ---- Header ----
  /** Multi-level column group spans shown above the header row. */
  columnGroups?: ColumnGroup[];
  /** Show filter input row below the header. Default: false. */
  filterBar?: boolean;
  /** Debounce ms for filter bar typing. Default: 300. */
  filterDebounceMs?: number;

  // ---- Row grouping ----
  /** Column indexes to group by initially. */
  rowGroups?: string[];
  /** Expanded groups. Pass `true` to expand all. */
  rowGroupExpanded?: string[] | boolean | ((group: string) => boolean);
  /** Default group sort. Default: 'desc-amount'. */
  defaultRowGroupSort?: RowGroupSort;
  /** Show the drag-to-group bar above the header. Default: false. */
  rowGroupBar?: boolean;
  /** Empty row group bar placeholder text. */
  rowGroupBarText?: string;
  /** Aggregation definitions for row group rows. */
  aggregations?: Aggregation[];

  // ---- Global search ----
  /** Show global search bar above the header. Default: false. */
  searchBar?: boolean;
  /** Search input placeholder. Default: 'Search...'. */
  searchBarPlaceholder?: string;
  /** Debounce ms for global search. Default: 300. */
  searchDebounceMs?: number;

  // ---- Pagination ----
  /** Pagination config. Pass `true` for defaults. */
  pagination?: PaginationConfig;

  // ---- Server mode ----
  /** Server adapter config. When set, client-side sort/filter are disabled. */
  serverAdapter?: ServerAdapterConfig;

  // ---- Selection ----
  /** Show a leading checkbox column for row selection. Default: false. */
  checkboxColumn?: boolean;
  /** Enable cell range selection (click drag). Default: false. */
  cellSelection?: boolean;

  // ---- Column features ----
  /** Allow column resize. Default: true. */
  columnResize?: boolean;
  /** Allow column drag-reorder. Default: true. */
  columnDrag?: boolean;
  /** Allow column hide via header menu. Default: true. */
  columnHide?: boolean;

  // ---- Localisation ----
  /**
   * UI locale. Affects all built-in labels (pagination, filter menu, column menu, etc.).
   * Supported values: 'en' (default), 'it', 'es', 'fr', 'de'.
   * Pass a custom `RaccoonLocale` object via `localeOverride` to add your own language.
   */
  locale?: string;
  /** Override individual locale strings without replacing the whole locale. */
  localeOverride?: Partial<import('./utils/i18n.js').RaccoonLocale>;

  // ---- Virtual scroll tuning ----
  /** Extra rows rendered above/below viewport. Default: 10. */
  bufferRows?: number;

  // ---- Events / Callbacks ----
  onReady?: (grid: RaccoonGrid<T>) => void;
  onRowClick?: (params: RowClickParams<T>) => void;
  onRowDblClick?: (params: RowClickParams<T>) => void;
  onCellClick?: (params: CellClickParams<T>) => void;
  onRowSelectionChange?: (params: RowSelectionChangeParams<T>) => void;
  onColumnChange?: (params: ColumnChangeParams<T>) => void;
  onColumnResize?: (params: ColumnResizeParams<T>) => void;
  onServerResponse?: (resp: ServerResponse) => void;
  rowCls?: (item: GridItem & Partial<T>) => string;
  rowStyle?: (item: GridItem & Partial<T>) => Record<string, string>;
}

// ---------------------------------------------------------------------------
// DOM Event system
// ---------------------------------------------------------------------------

/**
 * Map of all CustomEvents dispatched on the grid's root element (grid.el).
 *
 * Subscribe via: grid.el.addEventListener('raccoon:ready', (e) => { ... })
 * Event detail is available as e.detail.
 * Events prefixed raccoon:before are cancellable via e.preventDefault().
 */
export interface RaccoonEventMap {
  /** Grid fully initialised and rendered. */
  'raccoon:ready':            { grid: object };
  /** Data has been loaded or replaced (setData / server response). */
  'raccoon:dataLoaded':       { grid: object; total: number; source: 'client' | 'server' };
  /** Grid refreshed (refresh() called). */
  'raccoon:refresh':          { grid: object };
  /** Fires before page changes. Call e.preventDefault() to cancel. */
  'raccoon:beforePageChange': { grid: object; page: number; pageSize: number; currentPage: number };
  /** Page has changed. */
  'raccoon:pageChange':       { grid: object; page: number; pageSize: number };
  /** Fires before a sort is applied. Call e.preventDefault() to cancel. */
  'raccoon:beforeSort':       { grid: object; columnId: string; dir: SortDir; multi: boolean };
  /** Sort has been applied (or cleared — sorters array will be empty). */
  'raccoon:sort':             { grid: object; sorters: Array<{ columnId: string; dir: SortDir }> };
  /** Fires before a filter is applied. Call e.preventDefault() to cancel. */
  'raccoon:beforeFilter':     { grid: object; columnId: string; value: unknown; sign: FilterSign };
  /** A filter has been applied or cleared. */
  'raccoon:filter':           { grid: object; filters: Array<{ columnId: string; value: unknown; sign: FilterSign }> };
  /** Row selection has changed. */
  'raccoon:selectionChange':  { grid: object; selected: object[]; deselected: object[]; all: object[] };
  /** A column has been resized (fires once on mouseup, not continuously). */
  'raccoon:columnResize':     { grid: object; columnId: string; width: number };
  /** A column has been drag-reordered. */
  'raccoon:columnMove':       { grid: object; columnId: string; fromIndex: number; toIndex: number };
  /** A column has been shown or hidden. */
  'raccoon:columnVisibility': { grid: object; columnId: string; hidden: boolean };
  /** A column has been pinned or unpinned. */
  'raccoon:columnPin':        { grid: object; columnId: string; pin: 'left' | 'right' | undefined };
  /** Row grouping configuration has changed. */
  'raccoon:rowGroupChange':   { grid: object; rowGroups: string[] };
}

// ---------------------------------------------------------------------------
// Public API interface
// ---------------------------------------------------------------------------

/** Public interface of a RaccoonGrid instance. */
export interface RaccoonGridPublicAPI<T extends RowData = RowData> {
  // Data
  setData(data: T[]): void;
  getData(): T[];
  add(data: T | T[], rowIndex?: number): void;
  remove(id: string | string[]): void;
  setById(id: string, index: string, value: unknown): void;
  getById(id: string): T | undefined;

  // Sort
  sort(column: ColumnDef<T>, dir?: SortDir, multi?: boolean): void;
  clearSort(column?: ColumnDef<T>, multi?: boolean): void;

  // Filter
  filter(column: ColumnDef<T>, value: unknown, sign?: FilterSign, onePerColumn?: boolean): void;
  clearFilter(column?: ColumnDef<T>, sign?: FilterSign): void;

  // Columns
  showColumn(colId: string): void;
  hideColumn(colId: string): void;
  setColumns(columns: ColumnDef<T>[]): void;
  moveColumn(fromColId: string, toColId: string): void;

  // Selection
  selectRow(item: GridItem, selected: boolean): void;
  selectAll(selected: boolean): void;
  getSelectedRows(): T[];
  clearCellSelection(): void;

  // Row grouping
  expand(group: string): void;
  collapse(group: string): void;
  expandAll(): void;
  collapseAll(): void;
  reConfigRowGroups(groups: string[]): void;

  // Misc
  refresh(): void;
  destroy(): void;

  // Theme
  setTheme(theme: 'raccoon' | 'material' | 'fluent' | 'tabler', dark?: boolean): void;
  setThemeVars(vars: ThemeVars | undefined): void;

  // Layout
  pinColumn(colId: string, pin: 'left' | 'right' | false): void;
  getLayout(): GridLayout;
  setLayout(layout: GridLayout): void;
}

// Forward class declaration (used in GridConfig callbacks before RaccoonGrid.ts is parsed).
// The actual class is in RaccoonGrid.ts. This ensures no circular import issue.
export declare class RaccoonGrid<T extends RowData = RowData> implements RaccoonGridPublicAPI<T> {
  constructor(config: GridConfig<T>);
  render(containerEl: HTMLElement | string): this;
  setData(data: T[]): void;
  getData(): T[];
  add(data: T | T[], rowIndex?: number): void;
  remove(id: string | string[]): void;
  setById(id: string, index: string, value: unknown): void;
  getById(id: string): T | undefined;
  sort(column: ColumnDef<T>, dir?: SortDir, multi?: boolean): void;
  clearSort(column?: ColumnDef<T>, multi?: boolean): void;
  filter(column: ColumnDef<T>, value: unknown, sign?: FilterSign, onePerColumn?: boolean): void;
  clearFilter(column?: ColumnDef<T>, sign?: FilterSign): void;
  showColumn(colId: string): void;
  hideColumn(colId: string): void;
  setColumns(columns: ColumnDef<T>[]): void;
  moveColumn(fromColId: string, toColId: string): void;
  selectRow(item: GridItem, selected: boolean): void;
  selectAll(selected: boolean): void;
  getSelectedRows(): T[];
  clearCellSelection(): void;
  expand(group: string): void;
  collapse(group: string): void;
  expandAll(): void;
  collapseAll(): void;
  reConfigRowGroups(groups: string[]): void;
  refresh(): void;
  destroy(): void;
  setTheme(theme: 'raccoon' | 'material' | 'fluent' | 'tabler', dark?: boolean): void;
  setThemeVars(vars: ThemeVars | undefined): void;
  pinColumn(colId: string, pin: 'left' | 'right' | false): void;
  getLayout(): GridLayout;
  setLayout(layout: GridLayout): void;
}
