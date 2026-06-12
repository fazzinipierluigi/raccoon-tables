/**
 * Raccoon Tables - Filter mixin
 *
 * Grid-level filter/clearFilter that delegate to the Store,
 * then re-render. Also creates FilterField components for the filter bar row.
 *
 * In server mode, any filter change is forwarded to ServerAdapter.
 */

import type { RaccoonGrid } from '../RaccoonGrid.js';
import type { ColumnDef, FilterSign } from '../types.js';
import { cls } from '../utils/cls.js';
import { div, input } from '../utils/dom.js';
import { TEXT_TO_SIGN, SIGN_TO_TEXT } from '../utils/misc.js';
import { svg, FILTER_SIGN_ICONS } from '../utils/svg.js';
import { debounce } from '../utils/debounce.js';
import { createDatePicker } from '../utils/datepicker.js';

type Grid = RaccoonGrid<Record<string, unknown>>;

export const FilterMixin = {
  filter(this: Grid, column: ColumnDef, value: unknown, sign: FilterSign = '=', onePerColumn = false): void {
    if (!this._emit('raccoon:beforeFilter', { grid: this, columnId: column.id, value, sign })) return;

    if (this.config.serverAdapter) {
      if (!column.id) return;
      const existing = this.store.filters.find(f => f.column.id === column.id && (onePerColumn || f.sign === sign));
      if (existing) {
        existing.value = value;
        existing.sign = sign;
      } else {
        if (onePerColumn) this.store.filters = this.store.filters.filter(f => f.column.id !== column.id);
        const _isValueless = sign === 'T' || sign === 'F' || sign === 'empty' || sign === '!empty' || sign === '+' || sign === '-';
        if (value !== null && value !== '' || _isValueless) this.store.filters.push({ column, value, sign });
      }
      this._triggerServerRequest();
      this.renderHeader();
      this._emit('raccoon:filter', { grid: this, filters: this.store.filters.map(f => ({ columnId: f.column.id, value: f.value, sign: f.sign })) });
      return;
    }

    if (this.store.rowGroups.length) {
      this.store.filterForRowGrouping(column, value, sign, onePerColumn);
    } else {
      this.store.filter(column, value, sign, onePerColumn);
    }

    this.scroller.totalRows = this.store.getDisplayedDataTotal();
    this.scroller.scrollTo(0);
    this.renderVisibleRows();
    this._updateFilterActiveIndicators();
    this._emit('raccoon:filter', { grid: this, filters: this.store.filters.map(f => ({ columnId: f.column.id, value: f.value, sign: f.sign })) });
  },

  clearFilter(this: Grid, column?: ColumnDef, sign?: FilterSign): void {
    if (this.config.serverAdapter) {
      if (column) {
        this.store.filters = sign
          ? this.store.filters.filter(f => !(f.column.id === column.id && f.sign === sign))
          : this.store.filters.filter(f => f.column.id !== column.id);
      } else {
        this.store.filters = [];
      }
      this._triggerServerRequest();
      this.renderHeader();
      this.updateFilterBarCells();
      this._emit('raccoon:filter', { grid: this, filters: this.store.filters.map(f => ({ columnId: f.column.id, value: f.value, sign: f.sign })) });
      return;
    }

    if (this.store.rowGroups.length) {
      this.store.clearFilterForGrouping(column, sign);
    } else {
      this.store.clearFilter(column, sign);
    }

    this.scroller.totalRows = this.store.getDisplayedDataTotal();
    this.scroller.scrollTo(0);
    this.renderVisibleRows();
    this.renderHeader();
    this.updateFilterBarCells();
    this._emit('raccoon:filter', { grid: this, filters: this.store.filters.map(f => ({ columnId: f.column.id, value: f.value, sign: f.sign })) });
  },

  // -------------------------------------------------------------------------
  // FilterField factory (used by Header.renderFilterBar)
  // -------------------------------------------------------------------------

  createFilterField(this: Grid, col: ColumnDef, container: HTMLElement): HTMLElement {
    // Boolean columns → dedicated select (True / False / Null / All)
    if (col.type === 'boolean') {
      return this._createBooleanFilterSelect(col);
    }

    // Lookup columns → select driven by static options or AJAX
    if (col.filterLookup) {
      return this._createLookupFilterSelect(col);
    }

    // Date / Datetime columns → sign picker + calendar date picker
    if (col.type === 'date' || col.type === 'datetime') {
      return this._createDateFilterField(col);
    }

    // ---- Standard: sign picker + text input ----
    const wrapper = div(cls.filterFieldWrap);

    // Sign picker button
    const signBtn = div(cls.filterFieldSign);
    const activeFilter = this.store.filters.find(f => f.column.id === col.id);
    const activeSign: FilterSign = activeFilter?.sign ?? '=';
    signBtn.title = SIGN_TO_TEXT[activeSign] ?? 'Contains';
    signBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="${FILTER_SIGN_ICONS[signBtn.title] ?? ''}"/></svg>`;

    let currentSign: FilterSign = activeSign;

    signBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showFilterSignList(col, signBtn, (sign) => {
        currentSign = sign;
        const text = SIGN_TO_TEXT[sign] ?? 'Contains';
        signBtn.title = text;
        signBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="${FILTER_SIGN_ICONS[text] ?? ''}"/></svg>`;
        const val = filterInput.value.trim();
        if (val || sign === 'empty' || sign === '!empty' || sign === 'T' || sign === 'F' || sign === '+' || sign === '-') {
          this.filter(col, val || null, sign, true);
        }
      });
    });

    wrapper.appendChild(signBtn);

    // Text input
    const filterInput = input(cls.filterFieldInput);
    filterInput.placeholder = col.filterPlaceholder ?? '';
    if (activeFilter) filterInput.value = String(activeFilter.value ?? '');

    const debouncedFilter = debounce((value: string) => {
      if (value === '' && currentSign !== 'empty' && currentSign !== '!empty' && currentSign !== 'T' && currentSign !== 'F' && currentSign !== '+' && currentSign !== '-') {
        this.clearFilter(col);
      } else {
        this.filter(col, value || null, currentSign, true);
      }
    }, this.config.filterDebounceMs ?? 300);

    filterInput.addEventListener('input', () => {
      debouncedFilter(filterInput.value);
    });

    filterInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        debouncedFilter.cancel();
        const val = filterInput.value.trim();
        if (val || currentSign === 'empty' || currentSign === '!empty' || currentSign === 'T' || currentSign === 'F') {
          this.filter(col, val || null, currentSign, true);
        } else {
          this.clearFilter(col);
        }
      }
    });

    wrapper.appendChild(filterInput);

    return wrapper;
  },

  _createBooleanFilterSelect(this: Grid, col: ColumnDef): HTMLElement {
    const wrapper = div(cls.filterFieldWrap);
    const sel = document.createElement('select');
    sel.className = cls.filterFieldSelect;

    const loc = this._locale;
    const OPTIONS: Array<{ label: string; sign: FilterSign | '' }> = [
      { label: loc.filterAll,   sign: '' },
      { label: loc.filterTrue,  sign: 'T' },
      { label: loc.filterFalse, sign: 'F' },
      { label: 'Null / Empty',  sign: 'empty' },
    ];

    for (const opt of OPTIONS) {
      const el = document.createElement('option');
      el.value = opt.sign;
      el.textContent = opt.label;
      sel.appendChild(el);
    }

    const activeFilter = this.store.filters.find(f => f.column.id === col.id);
    if (activeFilter) sel.value = activeFilter.sign as string;

    sel.addEventListener('change', () => {
      const sign = sel.value as FilterSign | '';
      if (!sign) {
        this.clearFilter(col);
      } else {
        this.filter(col, null, sign as FilterSign, true);
      }
    });

    wrapper.appendChild(sel);
    return wrapper;
  },

  _createLookupFilterSelect(this: Grid, col: ColumnDef): HTMLElement {
    const wrapper = div(cls.filterFieldWrap);
    const sel = document.createElement('select');
    sel.className = cls.filterFieldSelect;

    const activeFilter = this.store.filters.find(f => f.column.id === col.id);
    const activeValue = activeFilter ? String(activeFilter.value ?? '') : '';

    const addAllOption = () => {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = col.filterPlaceholder ?? this._locale.filterAll;
      sel.appendChild(opt);
    };

    const addOptions = (options: Array<{ value: unknown; name: string }>) => {
      sel.innerHTML = '';
      addAllOption();
      for (const item of options) {
        const opt = document.createElement('option');
        opt.value = String(item.value ?? '');
        opt.textContent = item.name;
        if (String(item.value ?? '') === activeValue) opt.selected = true;
        sel.appendChild(opt);
      }
      if (!activeValue) sel.value = '';
    };

    const lookup = col.filterLookup!;

    if (lookup.options) {
      addOptions(lookup.options);
    } else if (lookup.url) {
      // Show placeholder while loading
      addAllOption();
      const loading = document.createElement('option');
      loading.disabled = true;
      loading.textContent = this._locale.filterLoading;
      sel.appendChild(loading);
      sel.disabled = true;

      const vf = lookup.valueField ?? 'value';
      const nf = lookup.nameField ?? 'name';

      let url = lookup.url;
      if (lookup.params) {
        const q = new URLSearchParams(lookup.params as Record<string, string>).toString();
        url += (url.includes('?') ? '&' : '?') + q;
      }

      fetch(url)
        .then(r => r.json())
        .then((data: unknown) => {
          const rows: unknown[] = Array.isArray(data) ? data : ((data as Record<string, unknown>).data as unknown[] ?? []);
          const options = rows.map(r => ({
            value: (r as Record<string, unknown>)[vf],
            name: String((r as Record<string, unknown>)[nf] ?? ''),
          }));
          addOptions(options);
          sel.disabled = false;
        })
        .catch(() => {
          sel.disabled = false;
          loading.textContent = this._locale.filterError;
        });
    } else {
      addAllOption();
    }

    sel.addEventListener('change', () => {
      const val = sel.value;
      if (!val) {
        this.clearFilter(col);
      } else {
        this.filter(col, val, '==', true);
      }
    });

    wrapper.appendChild(sel);
    return wrapper;
  },

  showFilterSignList(this: Grid, col: ColumnDef, signBtn: HTMLElement, onSelect: (sign: FilterSign) => void): void {
    // Close any open sign list
    this._activeFilterSignList?.remove();

    const list = div(cls.filterSignList);
    this._propagateTheme(list);
    document.body.appendChild(list);

    const signs = this._getSignsForColumn(col);

    for (const { text, sign } of signs) {
      const item = div(cls.filterSignItem);
      const iconPath = FILTER_SIGN_ICONS[text] ?? '';
      item.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="${iconPath}"/></svg><span>${text}</span>`;
      item.addEventListener('click', () => {
        onSelect(sign);
        list.remove();
        this._activeFilterSignList = undefined;
      });
      list.appendChild(item);
    }

    // Position — clamp right edge to viewport
    const rect = signBtn.getBoundingClientRect();
    list.style.position = 'fixed';
    list.style.top = `${rect.bottom}px`;
    list.style.zIndex = '9999';
    const listW = list.offsetWidth;
    const clampedLeft = Math.max(0, Math.min(rect.left, window.innerWidth - listW - 4));
    list.style.left = `${clampedLeft}px`;

    this._activeFilterSignList = list;

    const closeHandler = (ev: MouseEvent) => {
      if (!list.contains(ev.target as Node) && ev.target !== signBtn) {
        list.remove();
        this._activeFilterSignList = undefined;
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
  },

  _createDateFilterField(this: Grid, col: ColumnDef): HTMLElement {
    const DATE_SIGNS: Array<{ text: string; sign: FilterSign }> = [
      { text: 'Equals',         sign: '==' },
      { text: 'Not Equals',     sign: '!==' },
      { text: 'After',          sign: '>' },
      { text: 'Before',         sign: '<' },
      { text: 'After or Equal', sign: '>=' },
      { text: 'Before or Equal',sign: '<=' },
      { text: 'Empty',          sign: 'empty' },
      { text: 'Not Empty',      sign: '!empty' },
    ];
    const VALUELESS: FilterSign[] = ['empty', '!empty'];

    const wrapper = div(cls.filterFieldWrap);

    const activeFilter = this.store.filters.find(f => f.column.id === col.id);
    let currentSign: FilterSign = (activeFilter?.sign ?? '==') as FilterSign;
    const activeValue = (activeFilter && !VALUELESS.includes(activeFilter.sign))
      ? String(activeFilter.value ?? '') : null;

    // Sign button
    const signBtn = div(cls.filterFieldSign);
    const activeText = DATE_SIGNS.find(s => s.sign === currentSign)?.text ?? 'Equals';
    signBtn.title = activeText;
    signBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="${FILTER_SIGN_ICONS[activeText] ?? ''}"/></svg>`;

    // Track picker value locally for sign changes
    let pickerValue: string | null = activeValue;

    // Date / datetime picker
    const picker = createDatePicker({
      value: activeValue,
      type: col.type as 'date' | 'datetime',
      placeholder: col.filterPlaceholder ?? '',
      locale: this.config.locale,
      weekStart: 1,
      propagateTheme: (el) => this._propagateTheme(el),
      todayLabel: this._locale.datepickerToday ?? 'Today',
      confirmLabel: this._locale.datepickerConfirm ?? 'Confirm',
      onChange: (iso) => {
        pickerValue = iso;
        if (iso) {
          this.filter(col, iso, currentSign, true);
        } else {
          this.clearFilter(col);
        }
      },
    });

    const isValueless = VALUELESS.includes(currentSign);
    picker.style.display = isValueless ? 'none' : '';

    signBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Build sign list in-place using showFilterSignList override
      const list = div(cls.filterSignList);
      this._propagateTheme(list);
      document.body.appendChild(list);

      for (const { text, sign } of DATE_SIGNS) {
        const item = div(cls.filterSignItem);
        const iconPath = FILTER_SIGN_ICONS[text] ?? '';
        item.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="${iconPath}"/></svg><span>${text}</span>`;
        item.addEventListener('click', () => {
          currentSign = sign;
          signBtn.title = text;
          signBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="${FILTER_SIGN_ICONS[text] ?? ''}"/></svg>`;
          list.remove();
          document.removeEventListener('mousedown', closeList);
          this._activeFilterSignList = undefined;

          const valueless = VALUELESS.includes(sign);
          picker.style.display = valueless ? 'none' : '';
          if (valueless) {
            this.filter(col, null, sign, true);
          } else {
            if (pickerValue) this.filter(col, pickerValue, sign, true);
            else this.clearFilter(col);
          }
        });
        list.appendChild(item);
      }

      const rect = signBtn.getBoundingClientRect();
      list.style.position = 'fixed';
      list.style.top = `${rect.bottom}px`;
      list.style.zIndex = '9999';
      const lw = list.offsetWidth;
      list.style.left = `${Math.max(0, Math.min(rect.left, window.innerWidth - lw - 4))}px`;

      this._activeFilterSignList = list;

      const closeList = (ev: MouseEvent) => {
        if (!list.contains(ev.target as Node) && ev.target !== signBtn) {
          list.remove();
          this._activeFilterSignList = undefined;
          document.removeEventListener('mousedown', closeList);
        }
      };
      setTimeout(() => document.addEventListener('mousedown', closeList), 0);
    });

    wrapper.appendChild(signBtn);
    wrapper.appendChild(picker);
    return wrapper;
  },

  _getSignsForColumn(this: Grid, col: ColumnDef): Array<{ text: string; sign: FilterSign }> {
    const type = col.type ?? 'string';

    if (type === 'boolean') {
      return [
        { text: 'True', sign: 'T' },
        { text: 'False', sign: 'F' },
        { text: 'Clear', sign: '=' },
      ];
    }

    if (type === 'date' || type === 'datetime') {
      return [
        { text: 'Equals',          sign: '==' },
        { text: 'Not Equals',      sign: '!==' },
        { text: 'After',           sign: '>' },
        { text: 'Before',          sign: '<' },
        { text: 'After or Equal',  sign: '>=' },
        { text: 'Before or Equal', sign: '<=' },
        { text: 'Empty',           sign: 'empty' },
        { text: 'Not Empty',       sign: '!empty' },
      ];
    }

    if (type === 'number' || type === 'currency') {
      return [
        { text: 'Contains', sign: '=' },
        { text: 'Equals', sign: '==' },
        { text: 'Not Equals', sign: '!==' },
        { text: 'Greater Than', sign: '>' },
        { text: 'Less Than', sign: '<' },
        { text: 'Positive', sign: '+' },
        { text: 'Negative', sign: '-' },
        { text: 'Empty', sign: 'empty' },
        { text: 'Not Empty', sign: '!empty' },
      ];
    }

    return [
      { text: 'Contains', sign: '=' },
      { text: 'Not Contains', sign: '!=' },
      { text: 'Equals', sign: '==' },
      { text: 'Not Equals', sign: '!==' },
      { text: 'Starts with', sign: 'a_' },
      { text: 'Ends with', sign: '_a' },
      { text: 'Regex', sign: 'regex' },
      { text: 'Empty', sign: 'empty' },
      { text: 'Not Empty', sign: '!empty' },
    ];
  },
};
