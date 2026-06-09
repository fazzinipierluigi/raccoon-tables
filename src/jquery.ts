/**
 * Raccoon Tables - jQuery plugin wrapper
 *
 * Registers `$.fn.raccoonGrid(config)` on the global jQuery object.
 *
 * Usage:
 *   import 'raccoon-tables/jquery';
 *   // or via CDN:
 *   // <script src="raccoon-tables.jquery.iife.js"></script>
 *
 *   $('#my-grid').raccoonGrid({ columns: [...], data: [...] });
 *
 * The plugin stores the RaccoonGrid instance on the element via jQuery.data()
 * so it can be retrieved later:
 *
 *   const grid = $('#my-grid').data('raccoonGrid');
 *   grid.setData([...]);
 *
 * Chaining: the plugin returns the jQuery object for chaining.
 *
 * Method shorthand: pass a string to call a public method:
 *   $('#my-grid').raccoonGrid('setData', newData);
 *   $('#my-grid').raccoonGrid('destroy');
 */

import $ from 'jquery';
import { RaccoonGrid } from './RaccoonGrid.js';
import type { GridConfig, RowData } from './types.js';

declare global {
  interface JQuery {
    raccoonGrid<T extends RowData = RowData>(
      configOrMethod: GridConfig<T> | string,
      ...args: unknown[]
    ): JQuery | unknown;
  }
}

const PLUGIN_KEY = 'raccoonGrid';

$.fn.raccoonGrid = function raccoonGrid<T extends RowData = RowData>(
  this: JQuery,
  configOrMethod: GridConfig<T> | string,
  ...args: unknown[]
): JQuery | unknown {
  // Method call mode
  if (typeof configOrMethod === 'string') {
    const methodName = configOrMethod as keyof RaccoonGrid<T>;
    let returnValue: unknown;
    this.each(function (this: HTMLElement) {
      const grid = $.data(this, PLUGIN_KEY) as RaccoonGrid<T> | undefined;
      if (!grid) {
        console.warn(`[raccoonGrid] No grid instance on element — call init first`);
        return;
      }
      const method = grid[methodName];
      if (typeof method === 'function') {
        returnValue = (method as (...a: unknown[]) => unknown).apply(grid, args);
      } else {
        console.warn(`[raccoonGrid] Unknown method: ${String(methodName)}`);
      }
    });
    // Return value for single-element selections, jQuery object for chaining when no return value
    return returnValue !== undefined ? returnValue : this;
  }

  // Init mode
  this.each(function (this: HTMLElement) {
    if ($.data(this, PLUGIN_KEY)) return; // already initialized

    const grid = new RaccoonGrid<T>(configOrMethod);
    grid.render(this);
    $.data(this, PLUGIN_KEY, grid);
  });

  return this;
};

// Expose the class on the jQuery namespace for advanced use
($ as unknown as Record<string, unknown>).RaccoonGrid = RaccoonGrid;

export { RaccoonGrid };
export type { GridConfig, RowData };
