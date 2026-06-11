<p align="center">
  <img src="raccoon_tables_logo.png" alt="Raccoon Tables" width="100">
</p>

# Raccoon Tables — Exhaustive AI Documentation

> **Purpose of this document**: Provide a complete, unambiguous description of the Raccoon Tables library for AI model consumption. Every public API, configuration option, internal algorithm, and architectural decision is described here. Where behavior is non-obvious, the reason is stated explicitly.

---

## Table of Contents

1. [Library Overview](#1-library-overview)
2. [Architecture](#2-architecture)
3. [File Structure](#3-file-structure)
4. [Build System](#4-build-system)
5. [Installation & Usage](#5-installation--usage)
6. [Configuration Reference (GridConfig)](#6-configuration-reference-gridconfig)
7. [Column Definition Reference (ColumnDef)](#7-column-definition-reference-columndef)
8. [Public API Reference](#8-public-api-reference)
9. [Server-Side Mode](#9-server-side-mode)
10. [Pagination](#10-pagination)
11. [Row Grouping](#11-row-grouping)
12. [Sorting](#12-sorting)
13. [Filtering](#13-filtering)
14. [Cell Selection](#14-cell-selection)
15. [Layout Persistence (getLayout / setLayout)](#15-layout-persistence-getlayout--setlayout)
16. [Virtual Scrolling (Scroller)](#16-virtual-scrolling-scroller)
17. [Store (Data Layer)](#17-store-data-layer)
18. [jQuery Plugin](#18-jquery-plugin)
19. [CSS & Theming](#19-css--theming)
20. [Type System](#20-type-system)
21. [Performance Notes](#21-performance-notes)
22. [Known Limitations & Edge Cases](#22-known-limitations--edge-cases)

---

## 1. Library Overview

**Raccoon Tables** is a zero-dependency TypeScript data grid library. It handles:

- Large datasets via virtual scrolling (only visible rows in the DOM)
- Client-side data: sort, filter, group, paginate in-memory
- Server-side data: all interactions delegated to an AJAX endpoint
- Cell range selection
- Column resize, drag-reorder, show/hide
- Multi-level column groups, row grouping (nested), aggregations
- Row checkbox selection, keyboard navigation
- Global search bar, filter bar
- Pagination (client-side and server-side)
- Full TypeScript generics (`RaccoonGrid<T>` where `T` is your row data type)
- jQuery plugin wrapper (`$.fn.raccoonGrid`)

**No runtime dependencies.** jQuery is a peer dependency — required only if using the jQuery plugin.

---

## 2. Architecture

### Class Composition via Mixins

`RaccoonGrid<T>` is the main class. It does NOT inherit from any base. Instead, a set of **mixin objects** (plain JS objects with method functions) is applied to `RaccoonGrid.prototype` at module load time:

```
RaccoonGrid.prototype ← BodyMixin
                      ← HeaderMixin
                      ← SortMixin
                      ← FilterMixin
                      ← ColumnMixin
                      ← SelectionMixin
                      ← KeyNavigationMixin
                      ← ScrollMixin
                      ← RowGroupMixin
                      ← RowGroupBarMixin
                      ← ColumnDragMixin
```

Each mixin file exports an object literal whose keys are method names. The mixin application loop in `RaccoonGrid.ts`:

```typescript
for (const mixin of MIXINS) {
  for (const key of Object.keys(mixin)) {
    Object.defineProperty(RaccoonGrid.prototype, key, Object.getOwnPropertyDescriptor(mixin, key)!);
  }
}
```

This preserves property descriptors (important for getters/setters if any are added later).

### Separation of Concerns

| Layer           | File(s)                          | Responsibility                                      |
|-----------------|----------------------------------|-----------------------------------------------------|
| Data            | `core/Store.ts`                  | Sort, filter, group, add/remove, selection          |
| Geometry        | `core/Scroller.ts`               | Virtual scroll math, column view range              |
| Server          | `core/ServerAdapter.ts`          | AJAX requests, debounce, normalize response         |
| Rendering       | `mixins/Body.ts`                 | Create/update row and cell DOM elements             |
| Header          | `mixins/Header.ts`               | Header rows, filter bar, resize, menu               |
| Sort            | `mixins/Sort.ts`                 | Grid-level sort API, delegates to Store             |
| Filter          | `mixins/Filter.ts`               | Grid-level filter API, FilterField factory          |
| Column          | `mixins/Column.ts`               | Column lifecycle: show/hide/move/flex               |
| Selection       | `mixins/Selection.ts`            | Row checkbox, cell range                            |
| KeyNav          | `mixins/KeyNavigation.ts`        | Keyboard navigation                                 |
| Scroll          | `mixins/Scroll.ts`               | Native scroll, wheel, touch events                  |
| RowGroup        | `mixins/RowGroup.ts`             | expand/collapse/reConfig                            |
| RowGroupBar     | `mixins/RowGroupBar.ts`          | Drag-to-group UI bar                                |
| ColumnDrag      | `mixins/ColumnDrag.ts`           | Column header drag-reorder                          |

### State Ownership

- **All data state** lives in `Store` (data array, sorters, filters, grouping, selection).
- **All geometry state** lives in `Scroller` (scrollTop, scrollLeft, viewHeight, row range).
- **The grid class** owns DOM refs and orchestrates Store → Scroller → render.

### Render Pipeline

Every user interaction ultimately calls:
```
store.operation()                  // mutate data state
scroller.totalRows = store.total   // update geometry
renderVisibleRows()                // update DOM
```

`renderVisibleRows()` (in `Body.ts`):
1. Calls `scroller.calcVisibleRows()` → `{ start, end }`
2. Removes DOM rows outside `[start, end]`
3. Creates new DOM rows for indices not yet rendered
4. Positions each row with `transform: translateY(rowIndex * rowHeight + "px")`

---

## 3. File Structure

```
raccoon-tables/
├── package.json            ESM/CJS/IIFE exports, peer deps, build scripts
├── tsconfig.json           TypeScript config (ES2023 target, strict mode)
├── tsup.config.ts          Build config: 3 bundles (core, minified IIFE, jQuery)
├── src/
│   ├── index.ts            Main entry — exports RaccoonGrid + all types
│   ├── jquery.ts           jQuery plugin entry (separate bundle)
│   ├── RaccoonGrid.ts      Main class + mixin application
│   ├── types.ts            All TypeScript types and interfaces
│   ├── core/
│   │   ├── Store.ts        Data layer
│   │   ├── Scroller.ts     Virtual scroll engine
│   │   └── ServerAdapter.ts AJAX adapter
│   ├── mixins/
│   │   ├── Body.ts         Row/cell rendering
│   │   ├── Header.ts       Header rendering, resize, menu
│   │   ├── Sort.ts         Sort API
│   │   ├── Filter.ts       Filter API + FilterField factory
│   │   ├── Column.ts       Column lifecycle
│   │   ├── Selection.ts    Row + cell selection
│   │   ├── KeyNavigation.ts Keyboard navigation
│   │   ├── Scroll.ts       Scroll event handling
│   │   ├── RowGroup.ts     Row grouping API
│   │   ├── RowGroupBar.ts  Row group bar UI
│   │   └── ColumnDrag.ts   Column drag-reorder
│   └── utils/
│       ├── cls.ts          CSS class name constants (all rt-* prefixed)
│       ├── dom.ts          DOM element factories (el, div, span, input)
│       ├── debounce.ts     Typed debounce with cancel()
│       ├── misc.ts         Utilities + TEXT_TO_SIGN / SIGN_TO_TEXT maps
│       ├── svg.ts          Inline SVG icon strings
│       ├── format.ts       formatCurrency, formatDate, formatNumber
│       ├── render.ts       renderBoolean, renderOrder
│       └── key.ts          KEY constants, isPrintableKey()
├── styles/
│   └── raccoon-tables.css  Complete CSS (CSS custom properties, dark mode)
└── docs/
    └── AI_DOCUMENTATION.md  This file
```

---

## 4. Build System

**Tool**: `tsup` v8 (wraps esbuild). Chosen over Vite for library builds because:
- esbuild is ~10–100x faster than Rollup/Webpack
- tsup auto-generates `.d.ts` declaration files
- Native ESM + CJS + IIFE in one config
- No complex Vite plugin setup needed for pure library output

**Three build targets** (defined in `tsup.config.ts`):

| Target | Entry | Formats | minify | dts |
|--------|-------|---------|--------|-----|
| core | `src/index.ts` | ESM, CJS, IIFE | no | yes |
| core-min | `src/index.ts` | IIFE | yes | no |
| jquery | `src/jquery.ts` | ESM, CJS, IIFE | no | yes |

**Output files** (in `dist/`):
- `raccoon-tables.esm.js` — ES module (import/export)
- `raccoon-tables.cjs.js` — CommonJS (require())
- `raccoon-tables.iife.js` — Browser global (`window.RaccoonTables`)
- `raccoon-tables.min.iife.js` — Minified browser global
- `raccoon-tables.jquery.esm.js` — jQuery plugin as ES module
- `raccoon-tables.jquery.cjs.js` — jQuery plugin as CJS
- `raccoon-tables.jquery.iife.js` — jQuery plugin as browser global
- `raccoon-tables.d.ts` / `.d.cts` — TypeScript declarations

**Build commands**:
```bash
npm run build        # full build
npm run build:watch  # watch mode
npm run typecheck    # tsc --noEmit (no emit, just type-check)
```

---

## 5. Installation & Usage

### npm

```bash
npm install raccoon-tables
```

### ES Module

```typescript
import { RaccoonGrid } from 'raccoon-tables';
import 'raccoon-tables/styles/raccoon-tables.css';

const grid = new RaccoonGrid({
  columns: [
    { id: 'name', index: 'name', text: 'Name', type: 'string' },
    { id: 'age',  index: 'age',  text: 'Age',  type: 'number' },
  ],
  data: [
    { name: 'Alice', age: 30 },
    { name: 'Bob',   age: 25 },
  ],
  height: 400,
});

grid.render('#my-grid');
```

### CDN (IIFE)

```html
<link rel="stylesheet" href="raccoon-tables.iife.js">
<script src="raccoon-tables.iife.js"></script>
<script>
  const grid = new RaccoonTables.RaccoonGrid({ ... });
  grid.render('#my-grid');
</script>
```

### jQuery

```html
<script src="jquery.min.js"></script>
<script src="raccoon-tables.jquery.iife.js"></script>
<script>
  $('#my-grid').raccoonGrid({ columns: [...], data: [...] });
</script>
```

### TypeScript with typed row data

```typescript
interface Employee {
  id: number;
  name: string;
  department: string;
  salary: number;
}

const grid = new RaccoonGrid<Employee>({
  columns: [
    { id: 'name',       index: 'name',       text: 'Name' },
    { id: 'department', index: 'department', text: 'Department' },
    { id: 'salary',     index: 'salary',     text: 'Salary', type: 'currency' },
  ],
  data: employeeArray,   // typed as Employee[]
  height: 500,
});

grid.render(document.getElementById('grid-container')!);
```

---

## 6. Configuration Reference (GridConfig)

All fields optional except `columns`.

### Data

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `data` | `T[]` | `[]` | Initial row data. Each element is typed as `T`. |
| `columns` | `ColumnDef<T>[]` | required | Column definitions array. |

### Dimensions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `height` | `number` | — | Fixed container height in pixels. **When omitted the grid enters page-scroll mode** (see below). |
| `width` | `number` | fills container | Grid width in pixels. |
| `rowHeight` | `number` | `32` | Height in pixels of every data row. Must be uniform (virtual scroll requirement). |
| `defaultColumnWidth` | `number` | `100` | Default column width when `width` and `flex` are not set. |

#### Page-scroll mode vs fixed-height mode

| Mode | When | Behaviour |
|------|------|-----------|
| **Page-scroll** (default) | `height` not set | The grid grows to its full data height. The user scrolls the **page**. The header sticks to the top of the viewport. Virtual scroll is active — only visible rows are in the DOM. |
| **Fixed-height** | `height: N` | Classic container scroll. The `.rt-wrap` element has a fixed pixel height, the body overflows with a scrollbar. |

```typescript
// Page-scroll (default) — no height needed
new RaccoonGrid({ columns: [...], data: rows }).render('#app');

// Fixed-height / internal scroll
new RaccoonGrid({ height: 500, columns: [...], data: rows }).render('#app');

// Page-scroll + pagination — body is pageSize × rowHeight tall; page changes scroll back to grid top
new RaccoonGrid({
  columns: [...],
  data: rows,
  pagination: { enabled: true, pageSize: 50, pageSizeOptions: [25, 50, 100] },
}).render('#app');
```

**Pagination in page-scroll mode** works without any special config. When `pagination` is enabled:
- The body height equals `currentPageSize × rowHeight` (e.g. 50 rows × 32 px = 1 600 px).
- Clicking "next page" scrolls the window back to the top of the grid and renders the new page.
- Content below the grid is immediately reachable below the pagination bar.
- Sort, filter, search, and row grouping all interact with pagination exactly as in fixed-height mode.

### Appearance

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cls` | `string` | — | Extra CSS class(es) on the root `rt-wrap` element. |
| `style` | `Record<string,string>` | — | Inline style object for the root element. |
| `columnGroups` | `ColumnGroup[]` | — | Multi-level header groups. Each spans named column IDs. |

### Header & Filter

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `filterBar` | `boolean` | `false` | Show a filter input row below the header. |
| `filterDebounceMs` | `number` | `300` | Debounce delay for filter bar typing. |

### Row Grouping

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `rowGroups` | `string[]` | `[]` | Column indexes to group by initially. Order matters (hierarchical). |
| `rowGroupExpanded` | `string[] \| boolean \| fn` | `[]` | Which groups start expanded. `true` = all expanded. `(group)=>boolean` = per-group. |
| `defaultRowGroupSort` | `RowGroupSort` | `'desc-amount'` | How group rows are sorted: by string value (`asc-string`, `desc-string`) or count (`asc-amount`, `desc-amount`). |
| `rowGroupBar` | `boolean` | `false` | Show the drag-to-group toolbar above the header. |
| `rowGroupBarText` | `string` | `'Drag a column...'` | Placeholder text in the empty row group bar. |
| `aggregations` | `Aggregation[]` | `[]` | Aggregation functions for each column in group rows. Each `{ index, fn }` where `fn` is `'sum' \| 'avg' \| 'min' \| 'max' \| (values)=>number`. |

### Global Search

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `searchBar` | `boolean` | `false` | Show a global search input above the header. |
| `searchBarPlaceholder` | `string` | `'Search...'` | Placeholder text. |
| `searchDebounceMs` | `number` | `300` | Debounce delay. |

### Pagination

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `pagination` | `PaginationConfig` | — | Pagination config. Pass `{ enabled: true }` for defaults. |

`PaginationConfig`:
```typescript
{
  enabled: boolean;          // required
  pageSize?: number;         // default 50
  pageSizeOptions?: number[];// e.g. [25, 50, 100, 200]
  page?: number;             // initial page, 1-based
  position?: 'bottom' | 'top' | 'both'; // default 'bottom'
}
```

### Server-Side Mode

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `serverAdapter` | `ServerAdapterConfig` | — | When set, all data fetching goes through AJAX. Local sort/filter are disabled. |

See [§9 Server-Side Mode](#9-server-side-mode) for full details.

### Selection

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `checkboxColumn` | `boolean` | `false` | Prepend a checkbox column for row selection. |
| `cellSelection` | `boolean` | `false` | Enable click-drag cell range selection. |

### Column Features

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `columnResize` | `boolean` | `true` | Allow drag-resize of column width. |
| `columnDrag` | `boolean` | `true` | Allow drag-reorder of column headers. |
| `columnHide` | `boolean` | `true` | Allow hiding columns via header context menu. |

### Localisation

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `locale` | `string` | `'en'` | Locale code for built-in UI labels. Supported: `'en'`, `'it'`, `'es'`, `'fr'`, `'de'`. |
| `localeOverride` | `Partial<RaccoonLocale>` | — | Override individual strings without replacing the full locale. Merged on top of the resolved `locale`. |

The following strings are localised: pagination labels ("Rows per page", page info, "0 items"), filter bar options ("All", "True", "False", "Loading…", "Error loading"), column context menu items (Sort ASC/DESC, Clear Sort, Hide Column, Group by, Pin Left/Right, Unpin), and the row group bar empty-state message.

### Virtual Scroll Tuning

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `bufferRows` | `number` | `10` | Extra rows rendered above and below the visible viewport. Higher = smoother scroll at cost of more DOM nodes. |

### Event Callbacks

| Field | Signature | Description |
|-------|-----------|-------------|
| `onReady` | `(grid) => void` | Called after first render completes. |
| `onRowClick` | `(params) => void` | Row click. `params.item`, `params.rowIndex`, `params.event`. |
| `onRowDblClick` | `(params) => void` | Row double-click. |
| `onCellClick` | `(params) => void` | Cell click. Adds `params.column`. |
| `onRowSelectionChange` | `(params) => void` | Checkbox selection changed. `params.selected`, `params.deselected`, `params.all`. |
| `onColumnChange` | `(params) => void` | Column visibility/order changed. `params.columns`. |
| `onColumnResize` | `(params) => void` | Column resized. `params.column`, `params.width`. |
| `onServerResponse` | `(resp) => void` | Server response received (server mode only). |
| `rowCls` | `(item) => string` | Dynamic CSS class for the row `rt-row` element. |
| `rowStyle` | `(item) => Record<string,string>` | Dynamic inline style for the row element. |

---

## 7. Column Definition Reference (ColumnDef)

### Identity

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | **Required internally** (auto-generated if omitted during prepareColumn). Unique within a grid. |
| `index` | `string` | Data key: `item[index]` is the cell value. Required for data display unless `render` is provided. |
| `text` | `string` | Header label. Falls back to capitalized `index`. |
| `title` | `string` | Alias for `text`. |

### Type

| Field | Type | Description |
|-------|------|-------------|
| `type` | `ColumnType` | `'string'` (default), `'number'`, `'boolean'`, `'currency'`, `'date'`, `'order'`. Drives sort algorithm, default cell renderer, and filter operator set. |

**Type behaviors**:
- `string`: locale-aware alphabetical sort; contains/equals/regex filter operators.
- `number`: `Float64Array` sort (fastest); numeric filter operators (`>`, `<`, `+`, `-`).
- `boolean`: `Uint8Array` sort; true/false filter buttons; automatically renders a disabled checkbox — no `render` callback needed.
- `currency`: same as `number` for sorting; rendered via `Intl.NumberFormat`.
- `date`: rendered via `Date.toLocaleDateString`; sorted as string.
- `order`: renders the 1-based row index; non-sortable.

### Size

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `width` | `number` | `defaultColumnWidth` | Fixed pixel width. |
| `minWidth` | `number` | `20` | Minimum width during resize. |
| `flex` | `number \| true` | — | Proportional width. `flex: 1` and `flex: 2` = 1:2 ratio of remaining space. Columns with `flex` ignore `width`. Applied by `applyFlexColumns()` on each resize. |

### Visibility

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `hidden` | `boolean` | `false` | Start column hidden. Can toggle with `showColumn(id)` / `hideColumn(id)`. |

### Behavior Flags

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sortable` | `boolean` | `true` | Click header to sort. |
| `filterable` | `boolean` | `true` | Show filter input in filter bar. |
| `resizable` | `boolean` | `true` | Drag resize handle. |
| `draggable` | `boolean` | `true` | Drag header to reorder. |
| `menuItems` | `boolean` | `true` | Show ⋮ menu button on header hover. |
| `dataIndex` | `boolean` | `false` | Use pre-built value index for O(1) sort (string columns only). |

### Currency / Number Formatting

| Field | Type | Description |
|-------|------|-------------|
| `currency` | `string` | ISO 4217 code (e.g. `'EUR'`). Used by `formatCurrency`. |
| `minDecimal` | `number` | Minimum fraction digits. |
| `maxDecimal` | `number` | Maximum fraction digits. |

### Filter Bar

| Field | Type | Description |
|-------|------|-------------|
| `filterPlaceholder` | `string` | Input placeholder in filter bar cell (also used as the "All" option label in boolean/lookup selects). |
| `filterLookup` | `LookupConfig` | Replaces the text input with a dropdown (`<select>`). Always performs exact-match (`==`) comparison. Ideal for foreign-key columns where the stored value is an ID but the user should see a label. See [Lookup Filter](#lookup-filter) below. |

### Lookup Filter

When `filterLookup` is set on a column, the filter bar shows a `<select>` dropdown instead of a text input. The filter always uses `==` (exact match).

```typescript
interface LookupConfig {
  options?: Array<{ value: unknown; name: string }>;
  url?: string;        // AJAX endpoint — response must return the array (see below)
  valueField?: string; // field name for the value. Default: "value"
  nameField?: string;  // field name for the label. Default: "name"
  params?: Record<string, string>; // extra query-string params appended to url
}
```

**Static options:**
```javascript
{ id: 'role_id', index: 'role_id', text: 'Role', type: 'number', width: 130,
  filterLookup: {
    options: [
      { value: 1, name: 'Admin' },
      { value: 2, name: 'Editor' },
      { value: 3, name: 'Viewer' },
    ]
  }
}
```

**AJAX options (server returns `{data:[…]}` or plain array):**
```javascript
{ id: 'dept_id', index: 'dept_id', text: 'Department', type: 'number', width: 140,
  filterLookup: {
    url: '/api/departments',
    valueField: 'id',    // matches item.dept_id
    nameField: 'label',  // displayed in dropdown
  }
}
```

AJAX response must be one of:
- Plain array: `[{ id: 1, label: "Engineering" }, …]`
- Wrapped array: `{ data: [{ id: 1, label: "Engineering" }, …] }`

The lookup dropdown always adds an "— All —" first option (customised via `filterPlaceholder`) that clears the filter when selected.

### Boolean Filter

Columns with `type: 'boolean'` automatically show a dropdown instead of a text input:

| Option | Filter applied |
|--------|---------------|
| — All — | filter cleared |
| True | `sign: 'T'` |
| False | `sign: 'F'` |
| Null / Empty | `sign: 'empty'` |

### Callbacks

| Field | Signature | Description |
|-------|-----------|-------------|
| `render` | `(params) => string` | Custom HTML string for the cell. Takes precedence over all type defaults. |
| `format` | `(params) => string` | Format the display value. Applied before render when `render` is not set. |
| `summaryRenderer` | `(params) => string` | Custom HTML for aggregation cell in group rows. |
| `getter` | `(params) => unknown` | Custom value extractor used for sort, filter, and display. |
| `setter` | `(params & {value}) => void` | Custom value writer called by `setById()`. If omitted, `store.setById()` sets the value directly. |
| `cellCls` | `(params) => string` | Dynamic CSS class string added to the cell element. |
| `cellClsRules` | `Record<string, (params) => boolean>` | Conditional classes: key = class name, value = predicate. |
| `cellStyle` | `(params) => Record<string,string>` | Dynamic inline style for the cell. |
| `cellOverflow` | `boolean` | `false` | Set to `true` to allow cell content to visually exceed cell boundaries (adds `rt-cell-overflow` CSS class: `overflow: visible; z-index: 10`). Use for action buttons that open dropdown menus — the menu itself should be appended to `document.body` so it isn't clipped by the scroll container. |

**CellParams** fields:

```typescript
{
  value: unknown;           // raw cell value (from getter or item[index])
  item: GridItem;           // the row data object (internal, with $ fields)
  column: ColumnDef;        // this column definition
  rowIndex: number;         // 0-based row position in displayed data
  grid?: RaccoonGrid;       // grid instance (for advanced callbacks)
  currency?: string;        // forwarded from column.currency
  minDecimal?: number;      // forwarded from column.minDecimal
  maxDecimal?: number;      // forwarded from column.maxDecimal
}
```

---

## 8. Public API Reference

All methods are on the `RaccoonGrid<T>` instance.

### Render

```typescript
grid.render(containerEl: HTMLElement | string): this
```
Mounts the grid into `containerEl`. Accepts a CSS selector string or DOM element. Returns `this` for chaining. Must be called exactly once per grid instance.

### Data

```typescript
grid.setData(data: T[]): void
```
Replace all data. Resets scroll to top, re-renders. Preserves current sort/filter.

```typescript
grid.getData(): T[]
```
Return the raw data array (unsorted/unfiltered original).

```typescript
grid.add(data: T | T[], rowIndex?: number): void
```
Insert one or more rows. `rowIndex` = position (default: end). Re-renders.

```typescript
grid.remove(id: string | string[]): void
```
Remove row(s) by internal `id` string. Re-renders.

```typescript
grid.setById(id: string, index: string, value: unknown): void
```
Update a single cell by row ID and column index. Re-renders only the affected cell.

```typescript
grid.getById(id: string): T | undefined
```
Return raw row data by internal ID.

```typescript
grid.refresh(): void
```
In server mode: re-fires current request. In client mode: re-renders visible rows.

### Sort

```typescript
grid.sort(column: ColumnDef, dir?: SortDir, multi?: boolean): void
```
- `dir`: `'ASC'` (default) or `'DESC'`
- `multi`: if `true`, adds to existing sort (multi-column). If `false` (default), replaces.
- In server mode: adds sorter to `store.sorters`, fires server request.

```typescript
grid.clearSort(column?: ColumnDef, multi?: boolean): void
```
Clear sort. Without args: clears all. With `column` + `multi=true`: removes that column from multi-sort.

### Filter

```typescript
grid.filter(column: ColumnDef, value: unknown, sign?: FilterSign, onePerColumn?: boolean): void
```
Apply filter. `onePerColumn = true` replaces any existing filter for that column.

**Filter sign operators**:

| Sign | Meaning | Applicable Types |
|------|---------|-----------------|
| `=` | Contains (case-insensitive) | string, number |
| `!=` | Not contains | string |
| `==` | Equals (strict) | string, number |
| `!==` | Not equals | string, number |
| `>` | Greater than | number, currency |
| `<` | Less than | number, currency |
| `a_` | Starts with | string |
| `_a` | Ends with | string |
| `regex` | Regular expression | string |
| `empty` | Is empty/null | all |
| `!empty` | Is not empty | all |
| `+` | Positive number | number, currency |
| `-` | Negative number | number, currency |
| `in` | Value in list array | all |
| `T` | Boolean true | boolean |
| `F` | Boolean false | boolean |

```typescript
grid.clearFilter(column?: ColumnDef, sign?: FilterSign): void
```
Clear filter. Without args: clears all filters. With `column`: clears all filters for that column. With both `column` + `sign`: clears only that specific filter.

### Columns

```typescript
grid.showColumn(colId: string): void
grid.hideColumn(colId: string): void
grid.setColumns(columns: ColumnDef[]): void   // full replace
grid.moveColumn(fromColId: string, toColId: string): void
grid.setColumnWidth(colId: string, width: number): void
```

### Selection

```typescript
grid.selectRow(item: GridItem, selected: boolean): void
grid.selectAll(selected: boolean): void
grid.getSelectedRows(): T[]
grid.clearCellSelection(): void
```

### Row Grouping

```typescript
grid.expand(group: string): void
grid.collapse(group: string): void
grid.expandAll(): void
grid.collapseAll(): void
grid.reConfigRowGroups(groups: string[]): void   // change which columns are grouped
grid.addGroupToBar(index: string): void           // add column to row group bar
grid.removeGroupFromBar(index: string): void      // remove from row group bar
```

### Lifecycle

```typescript
grid.render(el): this      // mount grid
grid.refresh(): void       // re-render / re-fetch
grid.destroy(): void       // disconnect ResizeObserver, cancel server requests, remove DOM
```

### Layout

```typescript
grid.getLayout(): GridLayout       // serialise full grid state to a plain object
grid.setLayout(layout: GridLayout) // restore state from a previously captured layout
```

See [Section 15](#15-layout-persistence-getlayout--setlayout) for the full `GridLayout` type and usage examples.

---

## 9. Server-Side Mode

When `serverAdapter` is configured, the grid operates in **server mode**:
- Initial data load fires on `render()`.
- Every sort/filter/pagination/grouping change fires a new AJAX request.
- Local Store sort/filter algorithms are **skipped**.
- `store.serverTotal` holds the total row count (for pagination).

### ServerAdapterConfig

```typescript
{
  url: string;              // required — endpoint URL
  method?: 'GET' | 'POST'; // default 'POST'
  headers?: Record<string, string>; // extra HTTP headers
  debounceMs?: number;      // debounce delay for triggered requests (default 300)
  credentials?: RequestCredentials; // fetch credentials mode (default 'same-origin')

  // Transform outgoing params before send (rename fields for your API)
  prepareRequest?: (params: ServerRequestParams) => Record<string, unknown>;

  // Transform raw response to ServerResponse shape
  parseResponse?: (raw: Record<string, unknown>) => ServerResponse;

  onError?: (err: Error) => void;
}
```

### Request Body (ServerRequestParams)

Sent on every interaction:

```typescript
{
  start: number;        // row offset (0-based): (page-1) * pageSize
  limit: number;        // rows requested: pageSize
  page?: number;        // current page (1-based)
  pageSize?: number;    // page size
  sort?: Array<{ index: string; dir: 'ASC' | 'DESC' }>;
  filters?: Array<{ index: string; value: unknown; sign: FilterSign }>;
  rowGroups?: string[]; // column indexes currently grouped by
  globalSearch?: string;// global search string
}
```

**GET requests**: all fields are JSON-encoded query parameters.
**POST requests**: body is `JSON.stringify(params)`.

### Expected Response (ServerResponse)

```typescript
{
  data: RowData[];     // the page of rows
  total: number;       // total matching rows (for pagination)
  groups?: Record<string, { amount: number; agValues?: Record<string, unknown> }>;
}
```

If your API returns a different shape, use `parseResponse` to normalize it.

**Fallback field names** (auto-tried without `parseResponse`):
- Data: `data` → `rows` → `items`
- Total: `total` → `count` → `totalCount`

---

## 10. Pagination

Client-side pagination slices the in-memory data array. Server-side pagination sends `start`/`limit` to the server.

### Enabling

```typescript
const grid = new RaccoonGrid({
  // ...
  pagination: {
    enabled: true,
    pageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
  },
});
```

### Programmatic navigation (via internal methods)

```typescript
grid._goToPage(3);          // go to page 3
grid._pageSize = 50;        // change page size
grid._currentPage;          // read current page
grid._renderPagination();   // re-render pagination bar
```

### Pagination bar DOM

```
rt-pagination
  rt-pagination-inner
    rt-pagination-size-wrap   (page size selector)
    rt-pagination-info        ("1–25 of 847")
    rt-pagination-nav
      rt-pagination-btn       (first/prev/next/last)
      rt-pagination-page-input
```

### Pagination with row groups

When both `pagination` and `rowGroups` are active, pagination operates on the **flat display list** (group header rows + expanded data rows). This matches DevExtreme DataGrid's default client-side behaviour:

- Pagination total = `store.getDisplayedDataTotal()` — the total number of currently visible rows (group headers + data rows of expanded groups).
- With all groups **collapsed**: only N group-header rows are in `displayedData`; pagination may show 1 page (e.g. 6 departments < 50 per page). This is correct — expand groups to show data rows and more pages.
- Expanding a group adds its data rows to the flat list, updating the page count automatically.
- The group badge shows the **total** item count for that group across all pages, not just the current page.
- `expand()` / `collapse()` / `expandAll()` / `collapseAll()` all work with pagination via `_afterGroupChange`, which recalculates total rows and re-renders the pagination bar.

---

## 11. Row Grouping

### How it works

1. `store.set$rowGroupValue()` concatenates the values of each grouped column per row into `item.$rowGroupValue = "valA/valB"` (slash-separated for nested groups).
2. `store.generateGroupDetails()` recursively builds `GroupDetails` objects and arranges them into `levelsWithGroups` (level-indexed arrays of parent→children maps).
3. `store.generateDisplayedGroupedData()` flattens the group tree into the `displayedData` array, inserting `GroupDetails` items (marked `$isGroupRow: true`) before their children.
4. Expanding/collapsing splices children into/out of `displayedData` in place using `store.spliceToData()`.

### Aggregations

Defined as:
```typescript
aggregations: [
  { index: 'salary', fn: 'sum' },
  { index: 'bonus', fn: (values) => Math.max(...values) * 1.1 },
]
```

Built-in `fn` values: `'sum'`, `'avg'`, `'min'`, `'max'`.

Aggregation results are stored in `groupDetails.$agValues[index]` and rendered in group rows by `col.summaryRenderer`.

### Group Row Fields (GroupDetails)

```typescript
{
  $isGroupRow: true;
  $rowGroupValue: string;          // "department/team" (full path)
  $rowDisplayGroupValue: string;   // "team" (last segment for display)
  $groupLevel: number;             // 0 = top level
  $hasChildrenGroups: boolean;     // true if sub-groups exist below
  id: string;                      // unique row ID
  childrenAmount: number;          // direct children count
  amount: number;                  // total leaf rows in subtree
  expanded: boolean;               // current expand state
  $agValues: Record<string, unknown>; // aggregation results
  $selected?: boolean;             // for checkbox selection
  selectedStatus?: 'full' | 'partly' | false;
}
```

---

## 12. Sorting

### Algorithm

- **String columns**: `Array.sort` with `localeCompare`.
- **Number/currency columns**: `Float64Array` + `Uint32Array` index array sort. 2–5x faster than `Array.sort` for large datasets because TypedArray sort is JIT-compiled to native code.
- **Boolean columns**: `Uint8Array` (0/1) + index sort.

### Multi-column sort

Click header with Ctrl/Meta held. Sort priority = order of clicks (shown as superscript number on sort indicator).

### Sort after filter

When both sort and filter are active, `store.reSort()` sorts the `filteredData` array (not the full data array). This preserves the filter — sorting never re-introduces filtered-out rows.

### TypedArray Sort Detail

```typescript
// For numeric columns (N rows):
const vals = new Float64Array(N);           // cell values
const order = new Uint32Array(N);           // index array [0,1,2,...,N-1]
for (let i = 0; i < N; i++) order[i] = i;
order.sort((a, b) => dir === 'ASC' ? vals[a] - vals[b] : vals[b] - vals[a]);
const out = new Array(N);
for (let i = 0; i < N; i++) out[i] = data[order[i]];
```

The `vals` TypedArray holds all numeric values contiguously in memory, enabling SIMD-friendly comparison. The `order` TypedArray is the permutation array sorted based on `vals`. The final step applies the permutation to produce the sorted `data` array.

---

## 13. Filtering

### Filter Pipeline

1. All active filters are stored in `store.filters: Filter[]`.
2. On each `filter()` call: the previous filtered result is used as input to the new filter (progressive narrowing). If the same column is re-filtered, the full dataset is re-scanned (`totalReFilterRequired = true`).
3. `store.filteredData` = result of all active filters applied in sequence.
4. `store.displayedData` = `filteredData` (or sorted filteredData).

### Row Grouping + Filter

When row groups are active, filtering uses a parallel set of data structures (`groupDetailsForFiltering`, `groupsChildrenForFiltering`) so that group rows reflect the filtered child count without destroying the unfiltered grouping state.

### Global Search

The global search bar (`config.searchBar = true`) applies a single in-memory pass across all visible columns — it does NOT add to `store.filters`. Instead it overwrites `store.filteredData` directly. This avoids interference with column-level filters.

---

## 14. Cell Selection

Activated by `config.cellSelection = true`.

### Range Selection

- Click a cell → sets `activeCell` + `selectionRange` of size 1×1.
- Shift+click → extends `selectionRange` from `activeCell` to clicked cell.
- Click-drag → extends range continuously via `_onSelectionMouseMove`.
- Ctrl+A → selects all cells in the entire grid.

### Selection state

```typescript
grid.activeCell = { rowIndex, colIndex, item, col };
grid.selectionRange = { startRow, endRow, startCol, endCol };
grid.selectionMap = Set<"rowIndex_colId">;  // fast lookup for cell class
```

### Keyboard with cell selection

| Key | Action |
|-----|--------|
| Arrow keys | Move `activeCell` |
| Page Up/Down | Jump by visible page height |
| Home/End | First/last column (End), first/last row (Ctrl+End) |
| Ctrl+A | Select all cells |

---

## 15. Layout Persistence (getLayout / setLayout)

The Layout API serialises the full visual state of a grid into a plain JSON object and restores it
later — useful for localStorage persistence, user-saved views, or URL-based presets.

### GridLayout type

```typescript
interface GridLayout {
  columns: GridColumnLayout[];
  sort?:       Array<{ columnId: string; dir: SortDir }>;
  filters?:    Array<{ columnId: string; value: unknown; sign: FilterSign }>;
  pagination?: { page: number; pageSize: number };
  rowGroups?:  string[];   // column indexes being grouped, in hierarchy order
}

interface GridColumnLayout {
  id:      string;
  hidden:  boolean;
  width?:  number;
  pinned?: 'left' | 'right' | undefined;
}
```

### getLayout()

```typescript
const layout: GridLayout = grid.getLayout();
```

Captures:
- **columns** — current order (visible first, then hidden), `hidden` flag, `width`, `pinned` side.
- **sort** — active sorters as `{ columnId, dir }` pairs. `undefined` when no sort is active.
- **filters** — active filter conditions as `{ columnId, value, sign }` triples. `undefined` when no filter is active.
- **pagination** — `{ page, pageSize }` when `config.pagination.enabled` is true. `undefined` otherwise.
- **rowGroups** — ordered array of column `index` values being grouped. `undefined` when none.

### setLayout(layout)

```typescript
grid.setLayout(layout);
```

Fully restores all captured state in one atomic operation:

1. Applies per-column `width`, `hidden`, `pinned` from `layout.columns`.
2. Reorders `allColumns` to match layout column order.
3. Rebuilds `visibleColumns` (filtered, pin-sorted).
4. Resets active sorters and filters.
5. Restores sort (calls `store.reSort()`).
6. Restores filters (calls `store.reFilter()`, which uses sorted data as input when sort is also active).
7. Restores row groups via `store.reConfigRowGroups()`.
8. Restores pagination page and page size.
9. Re-renders header (sort indicators, pin icons), filter bar, rows, and pagination bar.

### Saving to localStorage

```javascript
// Save
const layout = grid.getLayout();
localStorage.setItem('my-grid-layout', JSON.stringify(layout));

// Restore
const raw = localStorage.getItem('my-grid-layout');
if (raw) grid.setLayout(JSON.parse(raw));
```

### Preset layouts

```javascript
const PRESETS = {
  default: {
    columns: cols.map(c => ({ id: c.id, hidden: false, width: c.width })),
    pagination: { page: 1, pageSize: 25 },
  },
  sorted: {
    columns: cols.map(c => ({ id: c.id, hidden: false, width: c.width })),
    sort: [{ columnId: 'salary', dir: 'DESC' }],
    pagination: { page: 1, pageSize: 25 },
  },
};
grid.setLayout(PRESETS.sorted);
```

### Limitations

- `setLayout` is client-side only — server mode (`config.serverAdapter`) ignores sort/filter
  restoration since those are managed by the server.
- `rowGroups` uses column `index` values (the data property path), not column `id` values.
- Pagination state is only restored when `config.pagination.enabled` is `true`.

---

## 16. Virtual Scrolling (Scroller)

### Principle

Only rows in the visible viewport + `bufferRows` above/below are ever in the DOM. Each row is positioned with `transform: translateY(N px)` where N = `rowIndex × rowHeight`.

**Why `transform` not `top`?**  
`transform` does not trigger layout (reflow). Modifying `top` on hundreds of elements causes cascading reflow. `transform` is composited by the GPU with zero layout cost.

### Row Range Calculation

```
startRow = max(0, floor(scrollTop / rowHeight) - bufferRows)
endRow   = min(totalRows-1, ceil((scrollTop + viewHeight) / rowHeight) + bufferRows)
```

### `generateNewRange()`

Called on every scroll event. Returns `null` if range didn't change (avoids unnecessary re-render). Only returns a new `{start, end}` if at least one bound changed.

### Fake Scroller

A `div.rt-fake-scroll` with `height = totalRows × rowHeight` and `width = 1px` is placed inside the body. This gives the browser a correct total scroll height without rendering all rows. The native scrollbar reflects true data size.

### Column View Range

`getColumnsViewRange()` iterates visible columns and returns `{startCol, endCol}` — the subset of columns whose left edge overlaps the horizontal scroll viewport. Used for horizontal virtual scrolling (not yet wired to cell rendering in v1.0, but the geometry engine is ready).

---

## 17. Store (Data Layer)

### Internal ID Assignment

Every row gets a string `id` field (assigned by `setIds()`):
- If the row already has `id`, it is converted to string.
- If not, an auto-incrementing integer seed (`idSeed`) is used.

`idRowIndexesMap: Map<string, number>` — row ID → current `displayedData` position.  
`idItemMap: Record<string, GridItem>` — row ID → row object reference.

### Chunked Splice

Large data operations (>100,000 rows) use chunked splice to avoid stack overflow:

```typescript
spliceToData(rowIndex, removeCount, toData, data) {
  if (data.length > 100_000) {
    const CHUNK = 10_000;
    let pos = rowIndex + 1;
    if (removeCount > 0) toData.splice(pos, removeCount);
    for (let i = 0; i < data.length; i += CHUNK) {
      toData.splice(pos, 0, ...data.slice(i, i + CHUNK));
      pos += CHUNK;
    }
  } else {
    toData.splice(rowIndex + 1, removeCount, ...data);
  }
}
```

`Array.prototype.splice` with a very large spread hits the JS engine's call stack argument limit (~65,000 in V8). Chunking avoids this.

### Object.groupBy Polyfill

`Store.ts` polyfills `Object.groupBy` for environments that don't have ES2024:

```typescript
if (typeof Object.groupBy !== 'function') {
  Object.groupBy = (arr, fn) => {
    const result = {};
    for (const item of arr) {
      const key = fn(item);
      (result[key] = result[key] ?? []).push(item);
    }
    return result;
  };
}
```

---

## 18. jQuery Plugin

### Registration

The jQuery plugin file (`src/jquery.ts`) registers `$.fn.raccoonGrid` on import. It augments the global `JQuery` interface via `declare global`.

### Usage

**Initialize**:
```javascript
$('#grid').raccoonGrid({ columns: [...], data: [...] });
```

**Call a method**:
```javascript
$('#grid').raccoonGrid('setData', newData);
$('#grid').raccoonGrid('sort', col, 'ASC');
$('#grid').raccoonGrid('destroy');
```

**Get the instance**:
```javascript
const grid = $('#grid').data('raccoonGrid');
grid.addGroupToBar('department');
```

**Method return values**: For methods that return a value (e.g. `getSelectedRows()`), the plugin returns the value directly (not the jQuery object):
```javascript
const rows = $('#grid').raccoonGrid('getSelectedRows');
```

For methods that return `void`, the plugin returns the jQuery object for chaining.

---

## 19. CSS & Theming

### CSS Custom Properties (Design Tokens)

All visual values are CSS custom properties. The complete token set:

| Token | Default (Raccoon) | Role |
|-------|-------------------|------|
| `--rt-font-family` | system-ui stack | Font |
| `--rt-font-size` | `13px` | Base font size |
| `--rt-line-height` | `1.4` | Line height |
| `--rt-color-bg` | `#ffffff` | Row background |
| `--rt-color-bg-alt` | `#f7f8fa` | Alternating row |
| `--rt-color-bg-header` | `#f0f2f5` | Header background |
| `--rt-color-bg-group` | `#e8ecf0` | Group row background |
| `--rt-color-bg-selected` | `#e3f0ff` | Selected row background |
| `--rt-color-bg-hover` | `#f0f4ff` | Hovered row background |
| `--rt-color-bg-menu` | `#ffffff` | Dropdown menu background |
| `--rt-color-border` | `#d9dde3` | Grid lines / borders |
| `--rt-color-border-focus` | `#4a90e2` | Input focus ring |
| `--rt-color-text` | `#2c3e50` | Primary text |
| `--rt-color-text-secondary` | `#6b7d91` | Muted / secondary text |
| `--rt-color-text-header` | `#3a4a5c` | Header cell text |
| `--rt-color-text-group` | `#2c3e50` | Group row text |
| `--rt-color-primary` | `#4a90e2` | Accent (sort arrow, selection, focus) |
| `--rt-color-primary-hover` | `#357abd` | Accent hover |
| `--rt-color-danger` | `#e74c3c` | Danger color (chip remove hover) |
| `--rt-row-height` | `32px` | Data row height |
| `--rt-header-height` | `32px` | Header row height |
| `--rt-border-radius` | `4px` | Menus, inputs, grid corners |
| `--rt-transition` | `0.15s ease` | CSS transitions |
| `--rt-scrollbar-width` | `8px` | Scrollbar width |
| `--rt-shadow-menu` | `0 4px 16px …` | Dropdown shadow |
| `--rt-sort-indicator-color` | `var(--rt-color-primary)` | Sort arrow color |
| `--rt-filter-active-color` | `#f39c12` | Filter active icon color |
| `--rt-cell-selected-bg` | `rgba(74,144,226,.18)` | Cell range selection fill |
| `--rt-cell-selected-border` | `rgba(74,144,226,.6)` | Cell range selection border |
| `--rt-loading-overlay-bg` | `rgba(255,255,255,.6)` | Server-mode loading overlay |

### Built-in Themes

Four themes are included. Set via `config.theme` or `grid.setTheme(name, dark?)`:

| Theme | Class | Description |
|-------|-------|-------------|
| `'raccoon'` | (default, no extra class) | Clean blue-accent default |
| `'material'` | `rt-theme-material` | Material Design 3 — Roboto font, no vertical cell borders, elevated header |
| `'fluent'` | `rt-theme-fluent` | Microsoft WinUI/Fluent — Segoe UI Variable, 36px rows |
| `'tabler'` | `rt-theme-tabler` | Tabler-inspired — Inter font, uppercase headers, 36px rows |

Each theme supports `dark: true` / `dark: false` (explicit) or auto via `prefers-color-scheme`. The `rt-dark` / `rt-light` classes are added automatically.

```typescript
// Set theme in config
const grid = new RaccoonGrid({ theme: 'tabler', dark: false, ... });

// Change at runtime
grid.setTheme('material', true);  // material dark
grid.setTheme('raccoon');         // raccoon, follows OS preference
```

### Theme Customisation via `themeVars`

`config.themeVars` accepts a `ThemeVars` object — a map of CSS custom property names to string values.
The entries are applied as **inline styles** on the root `.rt-wrap` element, so they win over both
`:root` defaults and the active theme block. Floating elements (column menu, filter sign dropdown)
receive the same overrides automatically when opened.

**Extend a built-in theme** — override only what you need:

```typescript
import type { ThemeVars } from 'raccoon-tables';

const grid = new RaccoonGrid({
  theme: 'raccoon',
  themeVars: {
    '--rt-color-primary':        '#27ae60',
    '--rt-color-primary-hover':  '#219a52',
    '--rt-color-border-focus':   '#27ae60',
    '--rt-sort-indicator-color': '#27ae60',
    '--rt-color-bg-selected':    'rgba(39, 174, 96, 0.12)',
    '--rt-cell-selected-bg':     'rgba(39, 174, 96, 0.14)',
    '--rt-cell-selected-border': 'rgba(39, 174, 96, 0.50)',
  },
  columns: [...],
  data: [...],
});
```

**Fully custom theme** — omit `theme` and set all tokens yourself:

```typescript
const grid = new RaccoonGrid({
  // no `theme:` — falls back to Raccoon token values for anything not overridden
  themeVars: {
    '--rt-font-family':          '"JetBrains Mono", monospace',
    '--rt-font-size':            '12px',
    '--rt-color-bg':             '#0d1117',
    '--rt-color-bg-alt':         '#161b22',
    '--rt-color-bg-header':      '#21262d',
    '--rt-color-bg-group':       '#1c2128',
    '--rt-color-border':         '#30363d',
    '--rt-color-text':           '#e6edf3',
    '--rt-color-text-secondary': '#8b949e',
    '--rt-color-text-header':    '#8b949e',
    '--rt-color-primary':        '#58a6ff',
    '--rt-color-primary-hover':  '#388bfd',
    '--rt-color-bg-selected':    'rgba(88,166,255,.12)',
    '--rt-cell-selected-bg':     'rgba(88,166,255,.14)',
    '--rt-cell-selected-border': 'rgba(88,166,255,.50)',
    '--rt-border-radius':        '6px',
    '--rt-row-height':           '28px',
    '--rt-header-height':        '28px',
    '--rt-shadow-menu':          '0 8px 24px rgba(0,0,0,.45)',
    '--rt-loading-overlay-bg':   'rgba(13,17,23,.70)',
  },
  columns: [...],
  data: [...],
});
```

**Runtime update** with `grid.setThemeVars(vars)`:

```typescript
grid.setThemeVars({ '--rt-color-primary': '#e74c3c' }); // change accent
grid.setThemeVars(undefined);                           // remove all overrides
```

`setThemeVars` removes all previously applied inline vars before setting the new ones.
The active theme class is not affected.

**CSS-only alternative** — no JS needed; target the root element directly:

```css
/* Scope to a specific grid via config.cls */
.rt-wrap.my-grid {
  --rt-color-primary: #27ae60;
  --rt-border-radius: 0;
}
```

### Dark Mode

Applied automatically via `@media (prefers-color-scheme: dark)`. Force with `dark: true` / `dark: false` in config, or call `setTheme(theme, darkBool)`. `themeVars` inline overrides persist regardless of the dark-mode class.

### Key CSS Classes (from `cls.ts`)

| Class | Element |
|-------|---------|
| `rt-wrap` | Grid root |
| `rt-header` | Header area |
| `rt-header-row` | Single header row |
| `rt-header-cell` | Single header cell |
| `rt-filter-bar-row` | Filter inputs row |
| `rt-body` | Scrollable body |
| `rt-row` | Data row (absolutely positioned) |
| `rt-row-selected` | Selected row |
| `rt-row-animation` | Row during sort animation |
| `rt-row-group` | Group header row |
| `rt-cell` | Data cell (absolutely positioned) |
| `rt-cell-selected` | Cell in selection range |
| `rt-cell-overflow` | Cell with `cellOverflow: true` — `overflow: visible; z-index: 10` |
| `rt-pagination` | Pagination bar |
| `rt-search-bar` | Global search bar |
| `rt-row-group-bar` | Drag-to-group bar |
| `rt-loading` | Loading overlay (server mode) |

---

## 20. Type System

### Core Generic: `T extends RowData`

`RowData = Record<string, unknown>`. All user-facing types are generic over `T`:
- `GridConfig<T>` — config object
- `ColumnDef<T>` — column definition (callbacks receive typed `item: GridItem & Partial<T>`)
- `CellParams<T>` — callback parameters
- `RaccoonGrid<T>` — grid class

### Internal: `GridItem`

```typescript
interface GridItem extends RowData {
  id: string;              // auto-assigned unique ID
  rowIndex?: number;       // current position in displayedData
  originalRowIndex?: number; // original position in data
  $rowGroupValue?: string; // "valA/valB" path for grouped rows
  $rowDisplayGroupValue?: string; // display label (last segment)
  $groupLevel?: number;    // 0 = top level group
  $isGroupRow?: boolean;   // true for group header rows
  $hasChildrenGroups?: boolean;
  $selected?: boolean;     // for row/group checkbox selection
  $agValues?: Record<string, unknown>; // aggregation results
  amount?: number;         // total leaf rows in group subtree
  childrenAmount?: number; // direct children count
  expanded?: boolean;      // group expand state
  selectedStatus?: 'full' | 'partly' | false;
}
```

Fields prefixed `$` are internal. User data fields live alongside them (via `extends RowData`).

### Filter System Types

```typescript
type FilterSign = '=' | '!=' | '==' | '!==' | '>' | '<' | 'a_' | '_a' | 'regex' | 'empty' | '!empty' | '+' | '-' | 'in' | 'T' | 'F';

interface Filter {
  column: ColumnDef;
  value: unknown;
  sign: FilterSign;
}

interface Sorter {
  column: ColumnDef;
  dir: SortDir;  // 'ASC' | 'DESC'
}
```

### Forward Declaration in types.ts

`types.ts` contains `declare class RaccoonGrid<T>` — a forward declaration of the class for use in callback signatures (e.g. `onReady?: (grid: RaccoonGrid<T>) => void`). This avoids circular imports between `types.ts` and `RaccoonGrid.ts`.

---

## 21. Performance Notes

### Virtual DOM Avoidance

Raccoon Tables does NOT use a virtual DOM. It writes directly to real DOM using `document.createElement`. This is intentional: the overhead of virtual DOM diffing (VDOM create → diff → patch) is unnecessary for a grid where the rendering model is straightforward (fixed-height rows, known update targets).

### Memory

With 1,000,000 rows:
- Store data array: ~80 bytes per row reference = ~80 MB
- `idRowIndexesMap` Map: ~64 bytes per entry = ~64 MB
- `idItemMap` Record: ~40 bytes per entry = ~40 MB
- Virtual scroll: DOM nodes for only ~20–50 rows at any time

Total DOM footprint is constant regardless of dataset size.

### Render Optimization

`renderVisibleRows()` does NOT tear down and rebuild all visible rows on each call:
1. It queries existing `[data-row-index]` elements.
2. Removes only elements outside `[start, end]`.
3. Creates only elements not yet in the DOM.
4. Repositions retained elements via `transform` (no reflow).

### Sort Optimization

For columns with `dataIndex: true` (string columns with a pre-built value index), `sortDataByDataIndex()` uses the existing `dataIndexes` map (value → id list) to avoid scanning all rows — O(unique values) instead of O(N log N).

---

## 22. Known Limitations & Edge Cases

### Non-uniform Row Heights

The virtual scroll engine assumes all rows have the same `rowHeight`. If you need variable-height rows, you must implement a custom height estimation function and override `calcVisibleRows()` / `getRowTop()` in the Scroller.

### Horizontal Virtual Scrolling

The `getColumnsViewRange()` geometry engine is implemented but v1.0 does not wire it to cell rendering. All columns in `visibleColumns` are rendered regardless of horizontal scroll position. For grids with >50 columns, consider manually hiding off-screen columns via `hideColumn()`.

### Server-Side Row Grouping

In server mode with `rowGroups` configured, the server must return pre-grouped data in the expected `ServerResponse.groups` structure. The client-side grouping algorithm does not run in server mode.

### `Object.groupBy` Polyfill

The polyfill in `Store.ts` patches `Object.groupBy` globally. If your environment already has a native `Object.groupBy`, the polyfill branch is skipped (`typeof ... !== 'function'` check). There is no namespace collision risk.

### Column `id` Field

The `id` field in `ColumnDef` is typed as `string` but is auto-generated by `ColumnMixin.prepareColumn()` using `generateUID()` if omitted. Always provide an explicit `id` when you need to reference a column programmatically (e.g. `showColumn(id)`).

### Destroy

After `grid.destroy()`:
- The DOM is removed.
- `grid.el`, `grid.headerEl`, `grid.bodyEl` are set to `null`.
- The `ResizeObserver` is disconnected.
- Pending server requests are aborted.
- **The grid instance is not reusable.** Create a new instance to re-render.

---

## 23. Internationalisation (i18n)

### Overview

All built-in UI text is driven by the `RaccoonLocale` interface (exported from the package).
The active locale is resolved at construction time and stored on `grid._locale`.

### Usage

```typescript
import { RaccoonGrid } from 'raccoon-tables';

// Built-in locale
const grid = new RaccoonGrid({ locale: 'fr', columns: [...] });

// Partial override
const grid = new RaccoonGrid({
  locale: 'en',
  localeOverride: { rowsPerPage: 'Items per page: ' },
  columns: [...],
});

// Fully custom locale object (e.g. for Portuguese)
import type { RaccoonLocale } from 'raccoon-tables';
const ptLocale: RaccoonLocale = {
  rowsPerPage: 'Linhas por página: ',
  pageInfo: '{start}–{end} de {total}',
  zeroItems: '0 itens',
  prevPage: '‹',
  nextPage: '›',
  searchPlaceholder: 'Pesquisar…',
  filterTrue: 'Verdadeiro',
  filterFalse: 'Falso',
  filterClear: 'Limpar',
  filterAll: '— Todos —',
  filterLoading: 'Carregando…',
  filterError: 'Erro ao carregar',
  sortAsc: 'Ordenar ASC',
  sortDesc: 'Ordenar DESC',
  clearSort: 'Remover ordem',
  hideColumn: 'Ocultar coluna',
  groupBy: 'Agrupar por isto',
  removeGroup: 'Remover grupo',
  pinLeft: 'Fixar esquerda',
  pinRight: 'Fixar direita',
  unpin: 'Desafixar',
  rowGroupBarEmpty: 'Arraste um cabeçalho de coluna aqui para agrupar',
};

const grid = new RaccoonGrid({ localeOverride: ptLocale, columns: [...] });
```

### RaccoonLocale interface

| Key | Default (EN) | Description |
|-----|-------------|-------------|
| `rowsPerPage` | `'Rows per page: '` | Label before page size selector |
| `pageInfo` | `'{start}–{end} of {total}'` | Pagination info; uses `{start}`, `{end}`, `{total}` literals |
| `zeroItems` | `'0 items'` | Pagination info when no data |
| `prevPage` | `'‹'` | Prev-page button label |
| `nextPage` | `'›'` | Next-page button label |
| `searchPlaceholder` | `'Search…'` | Global search input placeholder |
| `filterTrue` | `'True'` | Boolean filter select option |
| `filterFalse` | `'False'` | Boolean filter select option |
| `filterClear` | `'Clear'` | Boolean filter sign clear option |
| `filterAll` | `'— All —'` | Lookup / boolean filter "show all" option |
| `filterLoading` | `'Loading…'` | AJAX lookup while loading |
| `filterError` | `'Error loading'` | AJAX lookup error state |
| `sortAsc` | `'Sort ASC'` | Column context menu item |
| `sortDesc` | `'Sort DESC'` | Column context menu item |
| `clearSort` | `'Clear Sort'` | Column context menu item |
| `hideColumn` | `'Hide Column'` | Column context menu item |
| `groupBy` | `'Group by this'` | Column context menu item |
| `removeGroup` | `'Remove Group'` | Column context menu item |
| `pinLeft` | `'Pin Left'` | Column context menu item |
| `pinRight` | `'Pin Right'` | Column context menu item |
| `unpin` | `'Unpin'` | Column context menu item |
| `rowGroupBarEmpty` | `'Drag a column header here to group by it'` | Row group bar placeholder |

### Adding a new built-in locale

1. Open `src/utils/i18n.ts`.
2. Copy the `en` entry in `LOCALES` and paste with your locale code as key (e.g. `'pt'`).
3. Translate all values. Every key must be present — TypeScript will error otherwise.
4. Keep `{start}`, `{end}`, `{total}` verbatim in `pageInfo`.
5. Update the JSDoc `Supported locales:` comment at the top.
6. `npm run typecheck && npm run build` — both must pass.
7. Add a flag button to `demo/i18n.html` and open a PR.
