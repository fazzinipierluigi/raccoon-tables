<p align="center">
  <img src="raccoon_tables_logo.png" alt="Raccoon Tables" width="120">
</p>

# Raccoon Tables

High-performance TypeScript data grid with virtual scrolling, client-side and server-side data modes, row grouping, and full jQuery support.

## Features

- **Page-scroll mode by default** — the grid grows with its data; the user scrolls the page; the header sticks to the viewport; set `height: N` to get an internal-scroll container instead
- Virtual scrolling — only visible rows in DOM, constant memory regardless of dataset size
- Client-side mode: sort, filter, group, paginate in-memory (TypedArray-accelerated sort)
- Server-side mode: all interactions via AJAX with debounced requests and AbortController cancellation
- Cell range selection (click-drag)
- Multi-column sort (Ctrl+click header)
- 15 filter operators per column; boolean columns use a dropdown select automatically; foreign-key columns support a **lookup (dropdown) filter** loaded from a static array or AJAX endpoint
- Row grouping with nested levels, expand/collapse, aggregations (sum/avg/min/max/custom)
- Global search bar
- Pagination (client and server) — works in both page-scroll and fixed-height mode
- Column resize, drag-reorder, show/hide via context menu
- Column groups (multi-level header)
- Row checkbox selection
- Keyboard navigation (arrow keys, Page Up/Down, Home/End, Ctrl+A)
- Touch scroll with inertia (with synchronized header)
- Boolean columns auto-render as a checkbox — no custom `render` callback needed
- `cellOverflow: true` on a column allows cell content to escape cell boundaries (e.g. action dropdowns)
- 4 built-in themes: **Raccoon** (default) · **Material Design** · **Microsoft Fluent** · **Tabler**; each has light/dark variants and respects `prefers-color-scheme`
- `themeVars` config option — override individual CSS tokens to extend a theme or build a fully custom one; `setThemeVars()` for runtime updates
- CSS custom properties for full theming, dark mode via `prefers-color-scheme`
- Zero runtime dependencies
- jQuery plugin (`$.fn.raccoonGrid`) included as separate bundle
- Full TypeScript generics (`RaccoonGrid<T>`)

## Output formats

| File | Format | Use case |
|------|--------|---------|
| `raccoon-tables.esm.js` | ES module | Vite, webpack, Rollup |
| `raccoon-tables.cjs.js` | CommonJS | Node.js, Jest |
| `raccoon-tables.iife.js` | IIFE | `<script>` tag, CDN |
| `raccoon-tables.min.iife.js` | IIFE minified | Production CDN |
| `raccoon-tables.jquery.*.js` | ESM/CJS/IIFE | jQuery projects |
| `*.d.ts` / `*.d.cts` | TypeScript declarations | TypeScript projects |

## Installation

```bash
npm install raccoon-tables
```

## Quick start

```typescript
import { RaccoonGrid } from 'raccoon-tables';
import 'raccoon-tables/styles/raccoon-tables.css';

interface Employee {
  id: number;
  name: string;
  department: string;
  salary: number;
}

const grid = new RaccoonGrid<Employee>({
  columns: [
    { id: 'name',       index: 'name',       text: 'Name',       type: 'string', flex: 1 },
    { id: 'department', index: 'department', text: 'Department', type: 'string' },
    { id: 'salary',     index: 'salary',     text: 'Salary',     type: 'currency', currency: 'EUR' },
  ],
  data: [
    { id: 1, name: 'Alice', department: 'Engineering', salary: 95000 },
    { id: 2, name: 'Bob',   department: 'Marketing',   salary: 72000 },
  ],
  // No `height` → page-scroll mode (user scrolls the page, header sticks to top).
  // Pass `height: 400` to get a fixed-height container with an internal scrollbar instead.
  filterBar: true,
  pagination: { enabled: true, pageSize: 25, pageSizeOptions: [10, 25, 50, 100] },
});

grid.render('#my-grid');
```

## Server-side mode

```typescript
const grid = new RaccoonGrid({
  columns: [...],
  height: 500,
  serverAdapter: {
    url: '/api/data',
    method: 'POST',
    prepareRequest: (params) => ({
      // rename fields to match your API
      offset: params.start,
      count: params.limit,
      sortBy: params.sort?.[0]?.index,
      sortDir: params.sort?.[0]?.dir,
    }),
    parseResponse: (raw) => ({
      data: raw.items as RowData[],
      total: raw.totalCount as number,  // omit if your API has no total count
    }),
  },
  pagination: { enabled: true, pageSize: 50 },
});

grid.render('#my-grid');
```

## jQuery

```html
<script src="jquery.min.js"></script>
<script src="raccoon-tables.jquery.iife.js"></script>
<script>
  // Init
  $('#grid').raccoonGrid({ columns: [...], data: [...] });

  // Call method
  $('#grid').raccoonGrid('setData', newData);

  // Get instance
  const grid = $('#grid').data('raccoonGrid');
</script>
```

## Internationalisation (i18n)

Built-in translations for **English** (default), **Italian**, **Spanish**, **French**, and **German**.
Pass `locale` in the config:

```typescript
const grid = new RaccoonGrid({
  locale: 'it',   // 'en' | 'it' | 'es' | 'fr' | 'de'
  columns: [...],
});
```

Override individual strings without replacing the whole locale:

```typescript
const grid = new RaccoonGrid({
  locale: 'en',
  localeOverride: { rowsPerPage: 'Items per page: ' },
  columns: [...],
});
```

### Adding a new locale (contributor guide)

1. Open `src/utils/i18n.ts`.
2. Copy the `en` entry inside `LOCALES` and paste it with your locale code as the key (e.g. `'pt'`).
3. Translate every string value. **All keys must be present** — TypeScript will error if any are missing.
4. The `pageInfo` value uses `{start}`, `{end}`, and `{total}` as placeholders — keep them exactly as-is.
5. Update the JSDoc comment at the top of the file (`Supported locales: ...`).
6. Run `npm run typecheck && npm run build` — both must pass with zero errors.
7. Add a demo entry in `demo/i18n.html` and open a PR. 🎉

## DOM Events

Every significant action dispatches a `CustomEvent` on `grid.el`, enabling zero-config subscriptions from external JavaScript:

```javascript
const grid = new RaccoonGrid({ ... });
grid.render('#my-grid');

// Fired once the grid is fully initialised
grid.el.addEventListener('raccoon:ready', (e) => console.log('ready', e.detail));

// Fired after data is loaded (client setData or server response)
grid.el.addEventListener('raccoon:dataLoaded', (e) => {
  console.log(`Loaded ${e.detail.total} rows from ${e.detail.source}`);
});

// Cancel a page change (e.g. unsaved-changes guard)
grid.el.addEventListener('raccoon:beforePageChange', (e) => {
  if (hasUnsavedChanges()) e.preventDefault();
});
```

Events also **bubble** up the DOM so you can listen on any ancestor.

| Cancellable | Events |
|-------------|--------|
| No  | `raccoon:ready`, `raccoon:dataLoaded`, `raccoon:refresh`, `raccoon:pageChange`, `raccoon:sort`, `raccoon:filter`, `raccoon:selectionChange`, `raccoon:columnResize`, `raccoon:columnMove`, `raccoon:columnVisibility`, `raccoon:columnPin`, `raccoon:rowGroupChange` |
| **Yes** | `raccoon:beforePageChange`, `raccoon:beforeSort`, `raccoon:beforeFilter` |

Full event reference and TypeScript types in [DOCUMENTATION.md § 8b](./DOCUMENTATION.md).

## Build

```bash
npm run build        # full build → dist/
npm run build:watch  # watch mode
npm run typecheck    # tsc --noEmit
```

## Demo

Open `demo/index.html` in a browser (no server needed, uses IIFE build).  
See `demo/` for individual feature examples:

| File | What it demonstrates |
|------|---------------------|
| `demo/index.html` | Full-featured grid with all options |
| `demo/client-side.html` | Client-side data, sort, filter, pagination |
| `demo/server-side.html` | Server-side mode with mock fetch |
| `demo/row-grouping.html` | Row grouping, expand/collapse, aggregations |
| `demo/selection.html` | Row checkbox + cell range selection |
| `demo/column-features.html` | Column resize, drag, hide, column groups, action column |
| `demo/themes.html` | Theme switcher: Raccoon, Material, Fluent, Tabler; `themeVars` live customiser |
| `demo/i18n.html` | Internationalisation — switch locale at runtime |
| `demo/page-scroll.html` | Page-scroll mode (default) — no fixed height, page scrolls |

## License

MIT
