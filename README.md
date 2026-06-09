# Raccoon Tables

High-performance TypeScript data grid with virtual scrolling, client-side and server-side data modes, inline editing, row grouping, and full jQuery support.

## Features

- Virtual scrolling — only visible rows in DOM, constant memory regardless of dataset size
- Client-side mode: sort, filter, group, paginate in-memory (TypedArray-accelerated sort)
- Server-side mode: all interactions via AJAX with debounced requests and AbortController cancellation
- Inline cell editing (string, number, date, boolean, custom editor component)
- Cell range selection, clipboard copy/paste (Ctrl+C / Ctrl+V)
- Multi-column sort (Ctrl+click header)
- 15 filter operators per column
- Row grouping with nested levels, expand/collapse, aggregations (sum/avg/min/max/custom)
- Global search bar
- Pagination (client and server)
- Column resize, drag-reorder, show/hide via context menu
- Column groups (multi-level header)
- Row checkbox selection
- Keyboard navigation (arrow keys, Page Up/Down, Home/End, Ctrl+A, Delete)
- Touch scroll with inertia
- Flash animation on cell value change
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
  height: 400,
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
      total: raw.totalCount as number,
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
| `demo/editing.html` | Inline editing, clipboard, custom editor |
| `demo/selection.html` | Row checkbox + cell range selection |
| `demo/column-features.html` | Column resize, drag, hide, column groups |

## License

MIT
