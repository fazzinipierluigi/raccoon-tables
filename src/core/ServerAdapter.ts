/**
 * Raccoon Tables - ServerAdapter
 *
 * Handles all server-side communication for server mode.
 * Debounces requests, serializes grid state (sort/filter/pagination/groups/search)
 * into a single request body, and normalizes the server response.
 *
 * Contract (request):
 *   POST <url> with body: ServerRequestParams
 *
 * Contract (response):
 *   { data: RowData[], total: number, groups?: GroupResponse[] }
 *
 * The adapter is stateless between requests — all state lives in the grid.
 */

import type {
  ServerAdapterConfig,
  ServerRequestParams,
  ServerResponse,
  GridItem,
} from '../types.js';
import type { Sorter, Filter } from './Store.js';
import { debounce } from '../utils/debounce.js';

export class ServerAdapter {
  private config: ServerAdapterConfig;
  private abortController: AbortController | null = null;

  // Debounced fetch — created in constructor with the configured delay
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _debouncedFetch: ((...args: any[]) => void) & { cancel: () => void };

  loading = false;

  constructor(config: ServerAdapterConfig) {
    this.config = config;
    this._debouncedFetch = debounce(
      (params: ServerRequestParams, callback: (resp: ServerResponse) => void) =>
        void this._doFetch(params, callback),
      config.debounceMs ?? 300
    );
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Trigger a debounced server request.
   * @param params - Current grid state to send to the server
   * @param callback - Called with normalized server response
   */
  request(params: ServerRequestParams, callback: (resp: ServerResponse) => void): void {
    this._debouncedFetch(params, callback);
  }

  /**
   * Trigger an immediate (non-debounced) server request.
   * Used for initial data load and programmatic refreshes.
   */
  requestImmediate(params: ServerRequestParams, callback: (resp: ServerResponse) => void): void {
    this._debouncedFetch.cancel();
    this._doFetch(params, callback);
  }

  cancel(): void {
    this._debouncedFetch.cancel();
    this.abortController?.abort();
    this.abortController = null;
    this.loading = false;
  }

  // -------------------------------------------------------------------------
  // Core fetch
  // -------------------------------------------------------------------------

  private async _doFetch(params: ServerRequestParams, callback: (resp: ServerResponse) => void): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    this.loading = true;

    const cfg = this.config;

    // Allow caller to transform the outgoing params
    const finalParams: Record<string, unknown> = cfg.prepareRequest
      ? cfg.prepareRequest(params)
      : (params as unknown as Record<string, unknown>);

    try {
      const method = cfg.method ?? 'POST';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...cfg.headers,
      };

      let url = cfg.url;
      let body: string | undefined;

      if (method === 'GET') {
        const query = this._paramsToQueryString(finalParams as unknown as ServerRequestParams);
        url = `${cfg.url}?${query}`;
      } else {
        body = JSON.stringify(finalParams);
      }

      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: this.abortController.signal,
        credentials: cfg.credentials ?? 'same-origin',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const raw = await response.json();

      // Allow caller to transform the raw response
      const normalized: ServerResponse = cfg.parseResponse
        ? cfg.parseResponse(raw)
        : this._normalizeResponse(raw);

      this.loading = false;
      this.abortController = null;
      callback(normalized);

    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // cancelled, not an error
      this.loading = false;
      this.abortController = null;
      cfg.onError?.(err as Error);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private _normalizeResponse(raw: Record<string, unknown>): ServerResponse {
    // Support common response shapes
    return {
      data: (raw['data'] ?? raw['rows'] ?? raw['items'] ?? []) as GridItem[],
      total: (raw['total'] ?? raw['count'] ?? raw['totalCount'] ?? 0) as number,
      groups: raw['groups'] as ServerResponse['groups'],
    };
  }

  private _paramsToQueryString(params: ServerRequestParams): string {
    const flat: Record<string, string> = {};
    flat['start'] = String(params.start ?? 0);
    flat['limit'] = String(params.limit ?? 50);
    if (params.page !== undefined) flat['page'] = String(params.page);
    if (params.pageSize !== undefined) flat['pageSize'] = String(params.pageSize);
    if (params.globalSearch) flat['search'] = params.globalSearch;

    if (params.sort?.length) flat['sort'] = JSON.stringify(params.sort);
    if (params.filters?.length) flat['filters'] = JSON.stringify(params.filters);
    if (params.rowGroups?.length) flat['rowGroups'] = JSON.stringify(params.rowGroups);

    return new URLSearchParams(flat).toString();
  }

  /**
   * Build a ServerRequestParams from current grid state.
   * Called by the grid when any interaction triggers a server request.
   */
  static buildParams(opts: {
    start: number;
    limit: number;
    page?: number;
    pageSize?: number;
    sorters?: Sorter[];
    filters?: Filter[];
    rowGroups?: string[];
    globalSearch?: string;
  }): ServerRequestParams {
    return {
      start: opts.start,
      limit: opts.limit,
      page: opts.page,
      pageSize: opts.pageSize,
      globalSearch: opts.globalSearch,
      sort: opts.sorters?.map(s => ({
        index: s.column.index!,
        dir: s.dir,
      })),
      filters: opts.filters?.map(f => ({
        index: f.column.index!,
        value: f.value,
        sign: f.sign,
      })),
      rowGroups: opts.rowGroups,
    };
  }
}
