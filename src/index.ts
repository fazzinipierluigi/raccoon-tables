/**
 * Raccoon Tables - Main entry point
 *
 * Exports:
 *   RaccoonGrid          — main class
 *   All public types     — for TypeScript consumers
 *   Utility formatters   — for use in custom renderers
 */

export { RaccoonGrid } from './RaccoonGrid.js';

// Types
export type {
  RowData,
  GridItem,
  ColumnDef,
  ColumnGroup,
  GridConfig,
  CellParams,
  FilterSign,
  SortDir,
  AggregationFn,
  RowGroupSort,
  ServerAdapterConfig,
  ServerRequestParams,
  ServerResponse,
  PaginationConfig,
  GridColumnLayout,
  GridLayout,
  RaccoonGridPublicAPI,
  RowClickParams,
  CellClickParams,
  RowSelectionChangeParams,
  ColumnChangeParams,
  ThemeVars,
  RaccoonEventMap,
} from './types.js';

// Formatters (useful in custom render callbacks)
export { formatCurrency, formatDate, formatNumber } from './utils/format.js';
export { renderBoolean, renderOrder } from './utils/render.js';

// Localisation
export type { RaccoonLocale } from './utils/i18n.js';
export { getLocale } from './utils/i18n.js';
