// Trade maths, dates and the forex-day rules the journal is built around.
// P/L rule: PROFIT = +riskRatio R, LOSS = -1R, OPEN = 0R. Percent = R × 100.

import type { BlownWeek, Ranked, Trade, TradeType } from './types';

export const TYPE_LABEL: Record<TradeType, string> = { NORMAL: 'Real', DEMO: 'Demo', MISSED: 'Missed' };

export const isOpen = (t: Trade) => t.status === 'OPEN';
export const rOf = (t: Trade) => (t.status === 'PROFIT' ? t.riskRatio : t.status === 'LOSS' ? -1 : 0);

export function statsOf(list: Trade[]) {
  let wins = 0;
  let losses = 0;
  let open = 0;
  let r = 0;
  for (const t of list) {
    if (t.status === 'PROFIT') wins++;
    else if (t.status === 'LOSS') losses++;
    else open++;
    r += rOf(t);
  }
  const closed = wins + losses;
  return { total: list.length, wins, losses, open, closed, winRate: closed ? wins / closed : null, r, percent: r * 100 };
}

// ----- Formatting -----

const MINUS = '−';
const trim = (n: number, dp = 2) => String(+Math.abs(n).toFixed(dp));

export const sideOf = (n: number) => (n > 0.0001 ? 'up' : n < -0.0001 ? 'down' : 'flat');
export const fmtR = (r: number) => (Math.abs(r) < 0.0001 ? '0R' : `${r > 0 ? '+' : MINUS}${trim(r)}R`);
export const fmtPct = (p: number) => (Math.abs(p) < 0.5 ? '0%' : `${p > 0 ? '+' : MINUS}${Math.round(Math.abs(p)).toLocaleString('en-US')}%`);
export const fmtRatio = (r: number) => `1:${trim(r)}`;
export const fmtRate = (rate: number | null) => (rate == null ? '—' : `${Math.round(rate * 100)}%`);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => String(n).padStart(2, '0');

/** "Tue 6 Oct" */
export const fmtDay = (d: Date) => `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
/** "14:05" */
export const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** "6 Oct 2026, 14:05" */
export function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** "Tue 6" under a week heading */
export const fmtRowDay = (iso: string) => {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()}`;
};
export const fmtMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return `${LONG_MONTHS[m - 1]} ${y}`;
};

/** How long until `ms` from now: "3h 12m", "45m", "under a minute". */
export function fmtSpan(ms: number) {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 1) return 'under a minute';
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d) return `${d}d ${h}h`;
  return h ? `${h}h ${pad(m)}m` : `${m}m`;
}

// ----- Local calendar days (YYYY-MM-DD) -----

export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
/** A local moment as "YYYY-MM-DDTHH:mm" (the date-time picker's value; `new Date()` reads it back as local). */
export const localStamp = (d: Date) => `${dayKey(d)}T${fmtTime(d)}`;
export const parseDay = (key: string) => {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** The Monday on or before `d`. */
export const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
export const shiftMonth = (key: string, n: number) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
};

/** The weeks (Monday first) covering a month: each a list of 7 days. */
export function monthGrid(key: string) {
  const [y, m] = key.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const weeks: { key: string; date: Date; inMonth: boolean }[][] = [];
  for (let start = mondayOf(first); start <= last; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return { key: dayKey(date), date, inMonth: date.getMonth() === m - 1 };
    }));
  }
  return weeks;
}

/** Trades in weeks (newest first), each { key: Monday, label, rows }. */
export function byWeek(list: Trade[], now = new Date()) {
  const thisWeek = dayKey(mondayOf(now));
  const lastWeek = dayKey(addDays(mondayOf(now), -7));
  const weeks: { key: string; label: string; rows: Trade[] }[] = [];
  for (const t of list) {
    const monday = mondayOf(new Date(t.createdAt));
    const key = dayKey(monday);
    let w = weeks.find((x) => x.key === key);
    if (!w) {
      const label =
        key === thisWeek ? 'This week' : key === lastWeek ? 'Last week' : `Week of ${monday.getDate()} ${MONTHS[monday.getMonth()]} ${monday.getFullYear()}`;
      w = { key, label, rows: [] };
      weeks.push(w);
    }
    w.rows.push(t);
  }
  return weeks.sort((a, b) => (a.key < b.key ? 1 : -1));
}

// ----- The forex day: it rolls over at 5:00 PM New York -----

const nyFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function nyParts(d: Date) {
  const get = (type: string) => nyFormat.formatToParts(d).find((p) => p.type === type)?.value || '';
  return {
    key: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: DAYS.indexOf(get('weekday')),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    seconds: Number(get('second')),
  };
}

const ROLLOVER = 17 * 60; // 5:00 PM in New York

/** The forex day a moment belongs to (YYYY-MM-DD): New York's date, seven hours ahead. */
export const forexDay = (at: Date | string) => nyParts(new Date(new Date(at).getTime() + 7 * 3600_000)).key;

/** When the current forex day ends. */
export function nextRollover(now = new Date()) {
  const { minutes, seconds } = nyParts(now);
  const left = (ROLLOVER - minutes + 1440) % 1440 || 1440;
  return new Date(now.getTime() + left * 60_000 - seconds * 1000);
}

/** Forex is shut from Friday 5 PM to Sunday 5 PM, New York time. */
export function marketShut(now = new Date()) {
  const { weekday, minutes } = nyParts(now);
  return weekday === 6 || (weekday === 5 && minutes >= ROLLOVER) || (weekday === 0 && minutes < ROLLOVER);
}

export type DayStatus = {
  day: string;
  endsAt: Date;
  shut: boolean;
  taken: Trade[];
  r: number;
  lossLock: Trade | null;
  blown: BlownWeek | null;
};

/** Today's discipline picture. Real (NORMAL) trades are the only ones that count. */
export function dayStatus(trades: Trade[], blownWeeks: BlownWeek[], now = new Date()): DayStatus {
  const day = forexDay(now);
  const real = trades.filter((t) => t.tradeType === 'NORMAL');
  const taken = real.filter((t) => forexDay(t.createdAt) === day);
  const closedToday = real.filter((t) => !isOpen(t) && forexDay(t.closedAt || t.createdAt) === day);
  const lossLock = closedToday.find((t) => t.status === 'LOSS') || null;
  return {
    day,
    endsAt: nextRollover(now),
    shut: marketShut(now),
    taken,
    r: closedToday.reduce((s, t) => s + rOf(t), 0),
    lossLock,
    blown: blownFor(day, blownWeeks),
  };
}

/** The blown-week record covering a day, if any. */
export function blownFor(day: string, blownWeeks: BlownWeek[]) {
  const week = dayKey(mondayOf(parseDay(day)));
  return blownWeeks.find((b) => b.week_start.slice(0, 10) === week && day <= b.blown_through.slice(0, 10)) || null;
}

/** A blown week can be undone for 24 hours after it was saved. */
export function undoDeadline(b: BlownWeek) {
  const at = Date.parse(b.updated_at || b.created_at);
  return Number.isFinite(at) ? at + 24 * 3600_000 : 0;
}

// ----- API best/worst entries -----

/** A label and an R value from a best/worst entry, whatever its exact keys. */
export function describeRanked(item: Ranked): { label: string; r: number | null; detail: string | null } | null {
  if (!item || typeof item !== 'object') return null;
  const entries = Object.entries(item);
  if (!entries.length) return null;
  const pick = (...keys: string[]) => keys.map((k) => item[k]).find((v) => v !== undefined && v !== null);
  let label: unknown = pick('label', 'name', 'pair', 'weekday', 'day', 'week', 'weekStart', 'week_start', 'key', 'date');
  if (label === undefined) label = entries.find(([, v]) => typeof v === 'string')?.[1];
  let text = label === undefined ? '—' : String(label);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const d = parseDay(text);
    text = `Week of ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  const rv = pick('r', 'R', 'totalR', 'netR', 'value');
  const r = typeof rv === 'number' ? rv : null;
  const count = pick('trades', 'count', 'total');
  const detail = typeof count === 'number' ? `${count} trade${count === 1 ? '' : 's'}` : Array.isArray(count) ? `${count.length} trades` : null;
  return { label: text, r, detail };
}
