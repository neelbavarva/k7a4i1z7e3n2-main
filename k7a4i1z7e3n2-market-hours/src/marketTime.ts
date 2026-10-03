/**
 * Pure date/time helpers built on IANA timezones and Intl.DateTimeFormat.
 * No hardcoded UTC offsets: every offset is read from Intl for the instant in question,
 * so daylight-saving changes are handled independently for every zone.
 */

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

export interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number; // 0–23
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday … 6 = Saturday
}

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
  weekday: number;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

/** Wall-clock fields of an instant as seen in `timeZone`. */
export function zonedParts(timeZone: string, at: number | Date): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(typeof at === 'number' ? new Date(at) : at);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour') % 24; // some engines report midnight as 24 even with h23
  return {
    year,
    month,
    day,
    hour,
    minute: get('minute'),
    second: get('second'),
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

/** UTC offset of `timeZone` at instant `at`, in minutes (e.g. +330 for Kolkata). */
export function offsetMinutes(timeZone: string, at: number): number {
  const p = zonedParts(timeZone, at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(at / 1000) * 1000) / 60_000);
}

/**
 * The UTC instant at which the wall clock in `timeZone` reads `hours` past midnight of the given date.
 * `hours` may exceed 24 (27 = 03:00 the next day); Date.UTC normalises the overflow.
 */
export function zonedWallToUtc(timeZone: string, date: Pick<CalendarDate, 'year' | 'month' | 'day'>, hours: number): number {
  const naive = Date.UTC(date.year, date.month - 1, date.day) + hours * HOUR_MS;
  let utc = naive - offsetMinutes(timeZone, naive) * 60_000;
  // second pass settles instants near a DST transition
  utc = naive - offsetMinutes(timeZone, utc) * 60_000;
  return utc;
}

/** Calendar date `days` away from `date` (pure calendar arithmetic, no zone involved). */
export function shiftDate(date: Pick<CalendarDate, 'year' | 'month' | 'day'>, days: number): CalendarDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay() };
}

/** UTC instant of local midnight, in `timeZone`, of the day containing `at`. */
export function zonedDayStart(timeZone: string, at: number): number {
  return zonedWallToUtc(timeZone, zonedParts(timeZone, at), 0);
}

/** "GMT +5:30", "GMT -4", "GMT +0" */
export function formatGmtOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT ${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/** "Kolkata", "New York", "UTC" */
export function cityOfZone(timeZone: string): string {
  if (timeZone === 'UTC' || timeZone === 'Etc/UTC') return 'UTC';
  if (timeZone === 'America/Sao_Paulo') return 'São Paulo';
  const last = timeZone.split('/').pop() ?? timeZone;
  return last.replace(/_/g, ' ');
}

/** "7:42 pm" (12-hour) or "19:42" (24-hour) in `timeZone`. */
export function formatClock(at: number, timeZone: string, is24Hour: boolean): string {
  const p = zonedParts(timeZone, at);
  const mm = String(p.minute).padStart(2, '0');
  if (is24Hour) return `${String(p.hour).padStart(2, '0')}:${mm}`;
  return `${p.hour % 12 || 12}:${mm} ${p.hour < 12 ? 'am' : 'pm'}`;
}

const dayCache = new Map<string, Intl.DateTimeFormat>();

/** "Sat, Oct 3" in `timeZone`. */
export function formatDay(at: number, timeZone: string): string {
  let f = dayCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' });
    dayCache.set(timeZone, f);
  }
  return f.format(new Date(at));
}

/** Axis label for hour `h` (0–23). */
export function hourLabel(h: number, is24Hour: boolean): string {
  return is24Hour ? String(h) : String(h % 12 || 12);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** "45 min", "1 h 48 min", "2 d 7 h" */
export function formatDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d} d ${rh} h` : `${d} d`;
}

const longCache = new Map<string, Intl.DateTimeFormat>();

/** "Saturday, October 3" in `timeZone`. */
export function formatLongDay(at: number, timeZone: string): string {
  let f = longCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric' });
    longCache.set(timeZone, f);
  }
  return f.format(new Date(at));
}

/** "Mon" in `timeZone`. */
export function formatWeekday(at: number, timeZone: string): string {
  return formatDay(at, timeZone).split(',')[0];
}

/**
 * "7:42 pm" when `at` falls on the reference day in `timeZone`, otherwise "Mon 2:30 am".
 */
export function formatWhen(at: number, ref: number, timeZone: string, is24Hour: boolean): string {
  const a = zonedParts(timeZone, at);
  const b = zonedParts(timeZone, ref);
  const same = a.year === b.year && a.month === b.month && a.day === b.day;
  const clock = formatClock(at, timeZone, is24Hour);
  return same ? clock : `${formatWeekday(at, timeZone)} ${clock}`;
}

/** "12 am", "3 pm" or "00", "15" for axis ticks. */
export function tickLabel(h: number, is24Hour: boolean): string {
  const hh = ((h % 24) + 24) % 24;
  if (is24Hour) return `${String(hh).padStart(2, '0')}:00`;
  return `${hh % 12 || 12} ${hh < 12 ? 'am' : 'pm'}`;
}
