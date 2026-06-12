/**
 * SVG icon definitions for Raccoon Tables.
 * All icons are inline SVG strings. This approach:
 * - Avoids external requests
 * - Allows CSS color inheritance via `fill: currentColor`
 * - Enables easy icon replacement/theming
 */
export const svg = {
  sortAsc: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M7 14l5-5 5 5z"/>
  </svg>`,

  sortDesc: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M7 10l5 5 5-5z"/>
  </svg>`,

  filter: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
    <path d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A.998.998 0 0 0 18.95 4H5.04a1 1 0 0 0-.79 1.61z"/>
  </svg>`,

  menu: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
  </svg>`,

  chevronRight: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
  </svg>`,

  group: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>
  </svg>`,

  groupCellDrag: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/>
  </svg>`,

  block: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 13H9V7h2v8zm4 0h-2V7h2v8z"/>
  </svg>`,

  remove: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>`,

  drag: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/>
  </svg>`,

  pageFirst: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z"/>
  </svg>`,

  pagePrev: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
  </svg>`,

  pageNext: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
  </svg>`,

  pageLast: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z"/>
  </svg>`,

  search: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
  </svg>`,

  loading: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" class="rt-spin">
    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
  </svg>`,

  pin: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
    <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/>
  </svg>`,

  calendar: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.89 3 3 3.9 3 5v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V8h14v11z"/>
  </svg>`,
} as const;

/** SVG icon paths for filter sign buttons in the FilterField dropdown. */
export const FILTER_SIGN_ICONS: Record<string, string> = {
  'Clear': 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  'Contains': 'M19,10H5V8H19V10M19,16H5V14H19V16Z',
  'Not Contains': 'M21,10H9V8H21V10M21,16H9V14H21V16M4,5H6V16H4V5M6,18V20H4V18H6Z',
  'Equals': 'M 10.56 10 L 1.508 10 L 1.508 8 L 10.56 8 L 10.56 10 M 10.56 16 L 1.508 16 L 1.508 14 L 10.56 14 L 10.56 16 Z M 22.009 10.01 L 12.984 10.01 L 12.984 8.01 L 22.009 8.01 L 22.009 10.01 M 22.009 16.01 L 12.984 16.01 L 12.984 14.01 L 22.009 14.01 L 22.009 16.01 Z',
  'Not Equals': 'M 12.368 10 L 5.449 10 L 5.449 8 L 12.368 8 L 12.368 10 M 12.368 16 L 5.449 16 L 5.449 14 L 12.368 14 L 12.368 16 Z M 23.009 10.01 L 15.05 10.01 L 15.05 8.01 L 23.009 8.01 L 23.009 10.01 M 23.009 16.01 L 15.05 16.01 L 15.05 14.01 L 23.009 14.01 L 23.009 16.01 Z M 2.585 4.076 L 2.575 13.265 L 0.54 13.277 L 0.55 4.087 L 2.585 4.076 Z M 2.569 15.074 L 2.559 17.22 L 0.524 17.223 L 0.534 15.077 L 2.569 15.074 Z',
  'Empty': 'M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z',
  'Not Empty': 'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z',
  'Starts with': 'M11.14 4L6.43 16H8.36L9.32 13.43H14.67L15.64 16H17.57L12.86 4M12 6.29L14.03 11.71H9.96M4 18V15H2V20H22V18Z',
  'Ends with': 'M11.14 4L6.43 16H8.36L9.32 13.43H14.67L15.64 16H17.57L12.86 4M12 6.29L14.03 11.71H9.96M20 14V18H2V20H22V14Z',
  'Regex': 'M16,16.92C15.67,16.97 15.34,17 15,17C14.66,17 14.33,16.97 14,16.92V13.41L11.5,15.89C11,15.5 10.5,15 10.11,14.5L12.59,12H9.08C9.03,11.67 9,11.34 9,11C9,10.66 9.03,10.33 9.08,10H12.59L10.11,7.5C10.3,7.25 10.5,7 10.76,6.76V6.76C11,6.5 11.25,6.3 11.5,6.11L14,8.59V5.08C14.33,5.03 14.66,5 15,5C15.34,5 15.67,5.03 16,5.08V8.59L18.5,6.11C19,6.5 19.5,7 19.89,7.5L17.41,10H20.92C20.97,10.33 21,10.66 21,11C21,11.34 20.97,11.67 20.92,12H17.41L19.89,14.5C19.7,14.75 19.5,15 19.24,15.24V15.24C19,15.5 18.75,15.7 18.5,15.89L16,13.41V16.92H16V16.92M5,19A2,2 0 0,1 7,17A2,2 0 0,1 9,19A2,2 0 0,1 7,21A2,2 0 0,1 5,19H5Z',
  'Greater Than': 'M5.5,4.14L4.5,5.86L15,12L4.5,18.14L5.5,19.86L19,12L5.5,4.14Z',
  'Less Than': 'M18.5,4.14L19.5,5.86L8.97,12L19.5,18.14L18.5,19.86L5,12L18.5,4.14Z',
  // >= / <= (chevron + underline)
  'Greater or Equal': 'M5.5,4.14L4.5,5.86L15,12L4.5,18.14L5.5,19.86L19,12L5.5,4.14Z M4,21H20V23H4Z',
  'Less or Equal': 'M18.5,4.14L19.5,5.86L8.97,12L19.5,18.14L18.5,19.86L5,12L18.5,4.14Z M4,21H20V23H4Z',
  // Date-specific aliases
  'After': 'M5.5,4.14L4.5,5.86L15,12L4.5,18.14L5.5,19.86L19,12L5.5,4.14Z',
  'Before': 'M18.5,4.14L19.5,5.86L8.97,12L19.5,18.14L18.5,19.86L5,12L18.5,4.14Z',
  'After or Equal': 'M5.5,4.14L4.5,5.86L15,12L4.5,18.14L5.5,19.86L19,12L5.5,4.14Z M4,21H20V23H4Z',
  'Before or Equal': 'M18.5,4.14L19.5,5.86L8.97,12L19.5,18.14L18.5,19.86L5,12L18.5,4.14Z M4,21H20V23H4Z',
};
