/**
 * Raccoon Tables — i18n
 *
 * Provides localized strings for all built-in UI text.
 * Pass `locale` in GridConfig to activate a language other than 'en'.
 *
 * Supported locales: en, it, es, fr, de
 *
 * To add a new locale, add an entry to LOCALES below following the same
 * shape as the 'en' entry. Every key must be present.
 */

export interface RaccoonLocale {
  // Pagination
  rowsPerPage: string;
  /** E.g. "{start}–{end} of {total}" — use literal {start}, {end}, {total} */
  pageInfo: string;
  zeroItems: string;
  prevPage: string;
  nextPage: string;

  // Search
  searchPlaceholder: string;

  // Filter
  filterTrue: string;
  filterFalse: string;
  filterClear: string;
  filterAll: string;
  filterLoading: string;
  filterError: string;

  // Column menu
  sortAsc: string;
  sortDesc: string;
  clearSort: string;
  hideColumn: string;
  showColumn: string;
  groupBy: string;
  removeGroup: string;
  pinLeft: string;
  pinRight: string;
  unpin: string;

  // Row group bar
  rowGroupBarEmpty: string;
}

const LOCALES: Record<string, RaccoonLocale> = {
  en: {
    rowsPerPage: 'Rows per page: ',
    pageInfo: '{start}–{end} of {total}',
    zeroItems: '0 items',
    prevPage: '‹',
    nextPage: '›',
    searchPlaceholder: 'Search…',
    filterTrue: 'True',
    filterFalse: 'False',
    filterClear: 'Clear',
    filterAll: '— All —',
    filterLoading: 'Loading…',
    filterError: 'Error loading',
    sortAsc: 'Sort ASC',
    sortDesc: 'Sort DESC',
    clearSort: 'Clear Sort',
    hideColumn: 'Hide Column',
    showColumn: 'Show: ',
    groupBy: 'Group by this',
    removeGroup: 'Remove Group',
    pinLeft: 'Pin Left',
    pinRight: 'Pin Right',
    unpin: 'Unpin',
    rowGroupBarEmpty: 'Drag a column header here to group by it',
  },
  it: {
    rowsPerPage: 'Righe per pagina: ',
    pageInfo: '{start}–{end} di {total}',
    zeroItems: '0 elementi',
    prevPage: '‹',
    nextPage: '›',
    searchPlaceholder: 'Cerca…',
    filterTrue: 'Vero',
    filterFalse: 'Falso',
    filterClear: 'Cancella',
    filterAll: '— Tutti —',
    filterLoading: 'Caricamento…',
    filterError: 'Errore di caricamento',
    sortAsc: 'Ordina ASC',
    sortDesc: 'Ordina DESC',
    clearSort: 'Rimuovi ordinamento',
    hideColumn: 'Nascondi colonna',
    showColumn: 'Mostra: ',
    groupBy: 'Raggruppa per questo',
    removeGroup: 'Rimuovi gruppo',
    pinLeft: 'Fissa a sinistra',
    pinRight: 'Fissa a destra',
    unpin: 'Sblocca',
    rowGroupBarEmpty: 'Trascina un\'intestazione di colonna qui per raggrupparla',
  },
  es: {
    rowsPerPage: 'Filas por página: ',
    pageInfo: '{start}–{end} de {total}',
    zeroItems: '0 elementos',
    prevPage: '‹',
    nextPage: '›',
    searchPlaceholder: 'Buscar…',
    filterTrue: 'Verdadero',
    filterFalse: 'Falso',
    filterClear: 'Limpiar',
    filterAll: '— Todos —',
    filterLoading: 'Cargando…',
    filterError: 'Error al cargar',
    sortAsc: 'Ordenar ASC',
    sortDesc: 'Ordenar DESC',
    clearSort: 'Quitar orden',
    hideColumn: 'Ocultar columna',
    showColumn: 'Mostrar: ',
    groupBy: 'Agrupar por esto',
    removeGroup: 'Quitar grupo',
    pinLeft: 'Fijar izquierda',
    pinRight: 'Fijar derecha',
    unpin: 'Desanclar',
    rowGroupBarEmpty: 'Arrastra un encabezado de columna aquí para agrupar',
  },
  fr: {
    rowsPerPage: 'Lignes par page : ',
    pageInfo: '{start}–{end} sur {total}',
    zeroItems: '0 élément',
    prevPage: '‹',
    nextPage: '›',
    searchPlaceholder: 'Rechercher…',
    filterTrue: 'Vrai',
    filterFalse: 'Faux',
    filterClear: 'Effacer',
    filterAll: '— Tous —',
    filterLoading: 'Chargement…',
    filterError: 'Erreur de chargement',
    sortAsc: 'Trier ASC',
    sortDesc: 'Trier DESC',
    clearSort: 'Supprimer le tri',
    hideColumn: 'Masquer la colonne',
    showColumn: 'Afficher : ',
    groupBy: 'Regrouper par ceci',
    removeGroup: 'Supprimer le groupe',
    pinLeft: 'Épingler à gauche',
    pinRight: 'Épingler à droite',
    unpin: 'Désépingler',
    rowGroupBarEmpty: 'Faites glisser un en-tête de colonne ici pour regrouper',
  },
  de: {
    rowsPerPage: 'Zeilen pro Seite: ',
    pageInfo: '{start}–{end} von {total}',
    zeroItems: '0 Einträge',
    prevPage: '‹',
    nextPage: '›',
    searchPlaceholder: 'Suchen…',
    filterTrue: 'Wahr',
    filterFalse: 'Falsch',
    filterClear: 'Löschen',
    filterAll: '— Alle —',
    filterLoading: 'Laden…',
    filterError: 'Ladefehler',
    sortAsc: 'Aufsteigend',
    sortDesc: 'Absteigend',
    clearSort: 'Sortierung aufheben',
    hideColumn: 'Spalte ausblenden',
    showColumn: 'Anzeigen: ',
    groupBy: 'Hiernach gruppieren',
    removeGroup: 'Gruppe entfernen',
    pinLeft: 'Links anheften',
    pinRight: 'Rechts anheften',
    unpin: 'Lösen',
    rowGroupBarEmpty: 'Spaltenüberschrift hierher ziehen, um zu gruppieren',
  },
};

export function getLocale(locale?: string): RaccoonLocale {
  if (!locale) return LOCALES['en'];
  return LOCALES[locale] ?? LOCALES['en'];
}

export function formatPageInfo(pattern: string, start: number, end: number, total: number): string {
  return pattern
    .replace('{start}', String(start))
    .replace('{end}', String(end))
    .replace('{total}', String(total));
}
