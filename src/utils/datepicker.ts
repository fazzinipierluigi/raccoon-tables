/**
 * Raccoon Tables — DatePicker / DateTimePicker
 *
 * Fully custom calendar dropdown. No native <input type="date"> or <input type="time">.
 *
 * date mode     — value: "YYYY-MM-DD"       — click day → done
 * datetime mode — value: "YYYY-MM-DD HH:MM" — click day → pick time → Confirm
 */

import { cls } from './cls.js';

export interface DatePickerOptions {
  value: string | null;
  type?: 'date' | 'datetime';
  onChange: (value: string | null) => void;
  placeholder?: string;
  locale?: string;
  weekStart?: 0 | 1;
  propagateTheme?: (el: HTMLElement) => void;
  todayLabel?: string;
  confirmLabel?: string;
}

export function createDatePicker(opts: DatePickerOptions): HTMLElement {
  const isDatetime = opts.type === 'datetime';
  const weekStart = opts.weekStart ?? 1;
  const locale = opts.locale;
  const todayLabel = opts.todayLabel ?? 'Today';
  const confirmLabel = opts.confirmLabel ?? 'Confirm';

  // ---- state ----
  let currentValue: string | null = opts.value;

  const initDate = currentValue ? parseIsoPart(currentValue) : new Date();
  let viewYear = initDate.getFullYear();
  let viewMonth = initDate.getMonth();
  let focusedIso: string | null = getDatePart(currentValue);

  // datetime-specific: date selected in current popup session before Confirm
  let pendingDateIso: string | null = getDatePart(currentValue);
  let pendingHH = currentValue ? getTimePart(currentValue)[0] : 0;
  let pendingMM = currentValue ? getTimePart(currentValue)[1] : 0;

  let popupOpen = false;
  let popupEl: HTMLElement | null = null;

  // ---- wrapper ----
  const wrap = document.createElement('div');
  wrap.className = cls.datepickerWrap;

  // ---- display input (read-only) ----
  const inputEl = document.createElement('input');
  inputEl.className = cls.datepickerInput;
  inputEl.readOnly = true;
  inputEl.placeholder = opts.placeholder ?? '';
  if (currentValue) inputEl.value = formatDisplay(currentValue, isDatetime, locale);

  // ---- clear button ----
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = cls.datepickerClear;
  clearBtn.setAttribute('aria-label', 'Clear');
  clearBtn.innerHTML = '&times;';
  clearBtn.style.display = currentValue ? '' : 'none';
  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setValue(null);
    opts.onChange(null);
    closePopup();
  });

  wrap.appendChild(inputEl);
  wrap.appendChild(clearBtn);

  // ---- open / close ----
  function openPopup() {
    if (popupOpen) return;
    popupOpen = true;
    inputEl.classList.add(cls.datepickerInputOpen);

    if (currentValue) {
      const d = parseIsoPart(currentValue);
      viewYear = d.getFullYear();
      viewMonth = d.getMonth();
    }
    focusedIso = getDatePart(currentValue);
    pendingDateIso = getDatePart(currentValue);
    pendingHH = currentValue ? getTimePart(currentValue)[0] : 0;
    pendingMM = currentValue ? getTimePart(currentValue)[1] : 0;

    popupEl = buildPopup();
    opts.propagateTheme?.(popupEl);
    document.body.appendChild(popupEl);
    positionPopup();
    setTimeout(() => document.addEventListener('mousedown', outsideClick), 0);
  }

  function closePopup() {
    if (!popupOpen || !popupEl) return;
    popupOpen = false;
    inputEl.classList.remove(cls.datepickerInputOpen);
    popupEl.remove();
    popupEl = null;
    document.removeEventListener('mousedown', outsideClick);
  }

  function outsideClick(e: MouseEvent) {
    if (popupEl && !popupEl.contains(e.target as Node) && !wrap.contains(e.target as Node)) {
      closePopup();
    }
  }

  function positionPopup() {
    if (!popupEl) return;
    const rect = wrap.getBoundingClientRect();
    const popH = popupEl.offsetHeight || 300;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = (spaceBelow >= popH || spaceBelow >= rect.top)
      ? rect.bottom + 2
      : rect.top - popH - 2;
    const popW = popupEl.offsetWidth || 240;
    const left = Math.max(4, Math.min(rect.left, window.innerWidth - popW - 4));
    popupEl.style.top = `${top}px`;
    popupEl.style.left = `${left}px`;
  }

  function rebuildPopup() {
    if (!popupOpen || !popupEl) return;
    const next = buildPopup();
    opts.propagateTheme?.(next);
    popupEl.replaceWith(next);
    popupEl = next;
    positionPopup();
  }

  // ---- popup DOM ----
  function buildPopup(): HTMLElement {
    const popup = document.createElement('div');
    popup.className = cls.datepickerPopup;

    popup.appendChild(buildHeader());
    popup.appendChild(buildWeekdays());
    popup.appendChild(buildGrid());
    popup.appendChild(buildFooter());

    popup.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Escape') { closePopup(); inputEl.focus(); }
      else if (ke.key === 'Enter' && !isDatetime && focusedIso) { ke.preventDefault(); confirmDate(focusedIso); }
      else if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(ke.key)) { ke.preventDefault(); moveFocus(ke.key); }
    });

    return popup;
  }

  function buildHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = cls.dpHeader;

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = cls.dpNavBtn;
    prevBtn.textContent = '‹';
    prevBtn.setAttribute('aria-label', 'Previous month');
    prevBtn.addEventListener('click', () => navigateMonth(-1));

    const caption = document.createElement('button');
    caption.type = 'button';
    caption.className = cls.dpCaption;
    caption.textContent = formatCaption(viewYear, viewMonth, locale);

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = cls.dpNavBtn;
    nextBtn.textContent = '›';
    nextBtn.setAttribute('aria-label', 'Next month');
    nextBtn.addEventListener('click', () => navigateMonth(1));

    header.appendChild(prevBtn);
    header.appendChild(caption);
    header.appendChild(nextBtn);
    return header;
  }

  function buildWeekdays(): HTMLElement {
    const row = document.createElement('div');
    row.className = cls.dpWeekdays;
    for (const name of getDayNames(weekStart, locale)) {
      const s = document.createElement('span');
      s.textContent = name;
      row.appendChild(s);
    }
    return row;
  }

  function buildGrid(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = cls.dpGrid;
    const todayIso = isoToday();
    const selectedDateIso = isDatetime ? pendingDateIso : getDatePart(currentValue);

    for (const { iso, day, otherMonth } of buildDayGrid(viewYear, viewMonth, weekStart)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = cls.dpDay;
      btn.textContent = String(day);
      if (otherMonth) btn.classList.add(cls.dpDayOtherMonth);
      if (iso === todayIso) btn.classList.add(cls.dpDayToday);
      if (iso === selectedDateIso) btn.classList.add(cls.dpDaySelected);
      if (iso === focusedIso) btn.classList.add(cls.dpDayFocused);
      const isoC = iso;
      btn.addEventListener('click', () => onDayClick(isoC));
      grid.appendChild(btn);
    }
    return grid;
  }

  function buildFooter(): HTMLElement {
    const footer = document.createElement('div');
    footer.className = cls.dpFooter;

    const todayBtn = document.createElement('button');
    todayBtn.type = 'button';
    todayBtn.className = cls.dpTodayBtn;
    todayBtn.textContent = todayLabel;
    todayBtn.addEventListener('click', () => {
      const today = isoToday();
      if (isDatetime) {
        const now = new Date();
        pendingDateIso = today;
        focusedIso = today;
        pendingHH = now.getHours();
        pendingMM = now.getMinutes();
        const viewDate = new Date();
        viewYear = viewDate.getFullYear();
        viewMonth = viewDate.getMonth();
        rebuildPopup();
      } else {
        confirmDate(today);
      }
    });
    footer.appendChild(todayBtn);

    if (isDatetime) {
      footer.appendChild(buildTimeRow());
    }

    return footer;
  }

  // ---- time row (datetime only) ----
  function buildTimeRow(): HTMLElement {
    const row = document.createElement('div');
    row.className = cls.dpTime;

    row.appendChild(buildSpinner(
      pendingHH, 0, 23,
      (v) => { pendingHH = v; },
    ));

    const sep = document.createElement('span');
    sep.className = cls.dpTimeSep;
    sep.textContent = ':';
    row.appendChild(sep);

    row.appendChild(buildSpinner(
      pendingMM, 0, 59,
      (v) => { pendingMM = v; },
    ));

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = cls.dpConfirmBtn;
    confirmBtn.textContent = confirmLabel;
    confirmBtn.addEventListener('click', () => {
      if (pendingDateIso) {
        const hh = String(pendingHH).padStart(2, '0');
        const mm = String(pendingMM).padStart(2, '0');
        const fullVal = `${pendingDateIso} ${hh}:${mm}`;
        setValue(fullVal);
        opts.onChange(fullVal);
        closePopup();
      }
    });
    row.appendChild(confirmBtn);

    return row;
  }

  function buildSpinner(
    initial: number,
    min: number,
    max: number,
    onUpdate: (v: number) => void,
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = cls.dpTimeSpinner;

    let value = initial;

    const display = document.createElement('span');
    display.className = cls.dpTimePart;
    display.textContent = String(value).padStart(2, '0');

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = cls.dpTimeUp;
    upBtn.textContent = '▲';
    upBtn.addEventListener('click', () => {
      value = value >= max ? min : value + 1;
      display.textContent = String(value).padStart(2, '0');
      onUpdate(value);
    });

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = cls.dpTimeDown;
    downBtn.textContent = '▼';
    downBtn.addEventListener('click', () => {
      value = value <= min ? max : value - 1;
      display.textContent = String(value).padStart(2, '0');
      onUpdate(value);
    });

    // Allow mouse wheel on the spinner
    wrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      if ((e as WheelEvent).deltaY < 0) {
        value = value >= max ? min : value + 1;
      } else {
        value = value <= min ? max : value - 1;
      }
      display.textContent = String(value).padStart(2, '0');
      onUpdate(value);
    }, { passive: false });

    wrap.appendChild(upBtn);
    wrap.appendChild(display);
    wrap.appendChild(downBtn);
    return wrap;
  }

  // ---- interactions ----
  function navigateMonth(delta: number) {
    viewMonth += delta;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    rebuildPopup();
  }

  function onDayClick(iso: string) {
    focusedIso = iso;
    if (isDatetime) {
      // Select day but stay open for time selection
      pendingDateIso = iso;
      rebuildPopup();
    } else {
      confirmDate(iso);
    }
  }

  function confirmDate(iso: string) {
    setValue(iso);
    opts.onChange(iso);
    closePopup();
  }

  function setValue(v: string | null) {
    currentValue = v;
    inputEl.value = v ? formatDisplay(v, isDatetime, locale) : '';
    clearBtn.style.display = v ? '' : 'none';
  }

  function moveFocus(key: string) {
    const base = focusedIso ?? (getDatePart(currentValue) ?? isoToday());
    const d = parseIsoPart(base);
    if (key === 'ArrowLeft') d.setDate(d.getDate() - 1);
    else if (key === 'ArrowRight') d.setDate(d.getDate() + 1);
    else if (key === 'ArrowUp') d.setDate(d.getDate() - 7);
    else if (key === 'ArrowDown') d.setDate(d.getDate() + 7);
    focusedIso = dateToIso(d);
    if (d.getMonth() !== viewMonth || d.getFullYear() !== viewYear) {
      viewYear = d.getFullYear();
      viewMonth = d.getMonth();
    }
    rebuildPopup();
  }

  inputEl.addEventListener('click', () => {
    if (popupOpen) closePopup();
    else openPopup();
  });

  inputEl.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key === 'Enter' || ke.key === ' ') { ke.preventDefault(); openPopup(); }
    else if (ke.key === 'Escape') closePopup();
  });

  return wrap;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoToday(): string {
  return dateToIso(new Date());
}

function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns the "YYYY-MM-DD" portion of a value string (handles both "YYYY-MM-DD" and "YYYY-MM-DD HH:MM"). */
function getDatePart(value: string | null): string | null {
  if (!value) return null;
  return value.split(' ')[0];
}

/** Returns [hours, minutes] from a "YYYY-MM-DD HH:MM" string. */
function getTimePart(value: string | null): [number, number] {
  if (!value) return [0, 0];
  const timePart = value.split(' ')[1];
  if (!timePart) return [0, 0];
  const [hh, mm] = timePart.split(':').map(Number);
  return [hh || 0, mm || 0];
}

/** Parse the date portion of a value string to a local Date. */
function parseIsoPart(value: string): Date {
  const datePart = value.split(' ')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplay(value: string, isDatetime: boolean, locale?: string): string {
  const datePart = value.split(' ')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  let result: string;
  try {
    result = dateObj.toLocaleDateString(locale);
  } catch {
    result = datePart;
  }
  if (isDatetime) {
    const timePart = value.split(' ')[1];
    if (timePart) result += ' ' + timePart;
  }
  return result;
}

function formatCaption(year: number, month: number, locale?: string): string {
  const d = new Date(year, month, 1);
  try {
    return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  } catch {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }
}

function getDayNames(weekStart: 0 | 1, locale?: string): string[] {
  const names: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dayIndex = (weekStart + i) % 7;
    // Use a known Sunday-anchored reference: 2023-01-01 = Sunday
    const d = new Date(2023, 0, 1 + dayIndex);
    try {
      names.push(d.toLocaleDateString(locale, { weekday: 'narrow' }));
    } catch {
      names.push(['Su','Mo','Tu','We','Th','Fr','Sa'][dayIndex]);
    }
  }
  return names;
}

interface DayCell { iso: string; day: number; otherMonth: boolean; }

function buildDayGrid(year: number, month: number, weekStart: 0 | 1): DayCell[] {
  const cells: DayCell[] = [];
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  let startDow = firstDay.getDay();
  if (weekStart === 1) startDow = (startDow + 6) % 7;

  for (let i = startDow - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    cells.push({ iso: dateToIso(new Date(year, month - 1, day)), day, otherMonth: true });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: dateToIso(new Date(year, month, day)), day, otherMonth: false });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ iso: dateToIso(new Date(year, month + 1, nextDay)), day: nextDay, otherMonth: true });
    nextDay++;
  }
  return cells;
}
