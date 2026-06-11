/**
 * CSS class name constants for Raccoon Tables.
 * All DOM class names centralized here — one place to rename/retheme.
 * Every value corresponds 1:1 to a rule in raccoon-tables.css.
 */
export const cls = {
  // Root
  wrap:                      'rt-wrap',
  pageScroll:                'rt-page-scroll',

  // Search bar
  searchBar:                 'rt-search-bar',
  searchBarIcon:             'rt-search-bar-icon',
  searchBarInput:            'rt-search-bar-input',

  // Row group bar
  rowGroupBar:               'rt-row-group-bar',
  rowGroupBarEmpty:          'rt-row-group-bar-empty',
  rowGroupBarDragOver:       'rt-row-group-bar-drag-over',
  rowGroupBarChip:           'rt-row-group-bar-chip',
  rowGroupBarChipDrag:       'rt-row-group-bar-chip-drag',
  rowGroupBarChipLabel:      'rt-row-group-bar-chip-label',
  rowGroupBarChipRemove:     'rt-row-group-bar-chip-remove',
  rowGroupBarChipDragging:   'rt-row-group-bar-chip-dragging',
  rowGroupBarChipDragOver:   'rt-row-group-bar-chip-drag-over',

  // Header
  header:                    'rt-header',
  headerGroupRow:            'rt-header-group-row',
  headerGroupCell:           'rt-header-group-cell',
  headerRow:                 'rt-header-row',
  headerCell:                'rt-header-cell',
  headerCellTitle:           'rt-header-cell-title',
  headerCellSort:            'rt-header-cell-sort',
  headerCellSortActive:      'rt-header-cell-sort-active',
  headerCellFilterActive:    'rt-header-cell-filter-active',
  headerCellMenuBtn:         'rt-header-cell-menu-btn',
  headerCellMenu:            'rt-header-cell-menu',
  headerCellMenuItem:        'rt-header-cell-menu-item',
  headerCellMenuItemDisabled:'rt-header-cell-menu-item-disabled',
  headerCellMenuSeparator:   'rt-header-cell-menu-separator',
  headerCellMenuItemShow:    'rt-header-cell-menu-item-show',
  headerCellResizeHandle:    'rt-header-cell-resize-handle',
  headerCellDragging:        'rt-header-cell-dragging',
  headerCellDropTarget:      'rt-header-cell-drop-target',
  headerCellCheckbox:        'rt-header-cell-checkbox',

  // Filter bar
  filterBarRow:              'rt-filter-bar-row',
  filterBarCell:             'rt-filter-bar-cell',
  filterFieldWrap:           'rt-filter-field-wrap',
  filterFieldSign:           'rt-filter-field-sign',
  filterFieldInput:          'rt-filter-field-input',
  filterFieldSelect:         'rt-filter-field-select',
  filterSignList:            'rt-filter-sign-list',
  filterSignItem:            'rt-filter-sign-item',

  // Body
  body:                      'rt-body',
  fakeScroll:                'rt-fake-scroll',

  // Rows
  row:                       'rt-row',
  rowSelected:               'rt-row-selected',
  rowAnimation:              'rt-row-animation',
  rowGroup:                  'rt-row-group',
  rowGroupExpander:          'rt-row-group-expander',
  rowGroupLabel:             'rt-row-group-label',
  rowGroupAmount:            'rt-row-group-amount',

  // Cells
  cell:                      'rt-cell',
  cellSelected:              'rt-cell-selected',
  cellCheckbox:              'rt-cell-checkbox',
  cellGroupAg:               'rt-cell-group-ag',
  cellOverflow:              'rt-cell-overflow',

  // Column drag
  columnDragGhost:           'rt-column-drag-ghost',
  columnDragging:            'rt-column-dragging',

  // Loading
  loading:                   'rt-loading',

  // Pagination
  pagination:                'rt-pagination',
  paginationInner:           'rt-pagination-inner',
  paginationSizeWrap:        'rt-pagination-size-wrap',
  paginationSizeSelect:      'rt-pagination-size-select',
  paginationInfo:            'rt-pagination-info',
  paginationNav:             'rt-pagination-nav',
  paginationBtn:             'rt-pagination-btn',
  paginationPageInput:       'rt-pagination-page-input',

  // Global body states
  resizing:                  'rt-resizing',

  // Pinned columns
  headerCellPinIcon:                'rt-header-cell-pin-icon',
  headerCellPinnedLeft:             'rt-header-cell-pinned-left',
  headerCellPinnedRight:            'rt-header-cell-pinned-right',
  headerCellPinnedLeftBoundary:     'rt-header-cell-pinned-left-boundary',
  headerCellPinnedRightBoundary:    'rt-header-cell-pinned-right-boundary',
  filterBarCellPinnedLeft:          'rt-filter-bar-cell-pinned-left',
  filterBarCellPinnedRight:         'rt-filter-bar-cell-pinned-right',
  filterBarCellPinnedLeftBoundary:  'rt-filter-bar-cell-pinned-left-boundary',
  filterBarCellPinnedRightBoundary: 'rt-filter-bar-cell-pinned-right-boundary',
  cellPinnedLeft:                   'rt-cell-pinned-left',
  cellPinnedRight:                  'rt-cell-pinned-right',
  cellPinnedLeftBoundary:           'rt-cell-pinned-left-boundary',
  cellPinnedRightBoundary:          'rt-cell-pinned-right-boundary',
} as const;

export type ClsKey = keyof typeof cls;
