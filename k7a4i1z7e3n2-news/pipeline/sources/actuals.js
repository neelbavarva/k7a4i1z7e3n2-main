import { ACTUALS } from '../config.js';
import { parseValue, unitOf } from '../lib/parse.js';
import { log } from '../lib/store.js';

const MIN = 60 * 1000;
const DAY = 86400 * 1000;

function setActual(e, raw, source, url = null) {
  e.actual = parseValue(raw);
  e.actualRaw = String(raw).trim();
  e.actualSource = source;
  e.actualSourceUrl = url;
}

/**
 * Source 1 (free, automatic): a recurring indicator's next listing carries the
 * previous release as "previous". That is the official (possibly revised) actual.
 */
export function fillFromFeedPrevious(store, nowMs) {
  const byKey = new Map();
  for (const e of Object.values(store)) {
    const k = `${e.currency}|${e.title}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(e);
  }
  let filled = 0;
  for (const list of byKey.values()) {
    list.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    for (let i = 0; i < list.length - 1; i++) {
      const e = list[i];
      const next = list[i + 1];
      if (e.actualSource === 'manual' || e.actualSource === 'feed') continue;
      // Only trust it once the release is at least an hour old, so the feed has caught up.
      if (Date.parse(e.time) > nowMs - 60 * MIN) continue;
      if (next.previous == null || unitOf(next.previousRaw) !== unitOf(e.forecastRaw)) continue;
      setActual(e, next.previousRaw, 'feed');
      filled++;
    }
  }
  return filled;
}

/**
 * Source 2 (manual, highest priority): data/actuals_overrides.csv
 * columns: date (YYYY-MM-DD, UTC), currency, title, actual
 */
export function applyOverrides(store, csvText) {
  const rows = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (!rows.length) return 0;
  const header = rows[0].toLowerCase().split(',').map((s) => s.trim());
  const idx = (name) => header.indexOf(name);
  let applied = 0;
  for (const line of rows.slice(1)) {
    const cols = splitCsv(line);
    const date = cols[idx('date')];
    const currency = cols[idx('currency')]?.toUpperCase();
    const title = cols[idx('title')]?.toLowerCase();
    const actual = cols[idx('actual')];
    if (!date || !currency || !title || !actual) continue;
    const match = Object.values(store).find(
      (e) => e.currency === currency && e.title.toLowerCase() === title && e.time.slice(0, 10) === date,
    );
    if (!match) {
      log(`overrides: no event matches "${line}"`);
      continue;
    }
    setActual(match, actual, 'manual');
    applied++;
  }
  return applied;
}

function splitCsv(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const matters = (e) => !e.skip && (e.impact === 'High' || e.impact === 'Medium');

/**
 * Events that still need an actual value and are worth looking up from a released-values source:
 * High/Medium releases, plus anything a market's driver profile counts (isDriver), such as
 * weekly crude inventories or China's factory PMIs.
 */
export function needsLookup(store, nowMs, isDriver = () => false) {
  return Object.values(store)
    .filter((e) => {
      const t = Date.parse(e.time);
      return (
        (matters(e) || isDriver(e)) &&
        e.actual == null &&
        e.forecast != null &&
        t < nowMs - ACTUALS.minutesAfterRelease * MIN &&
        t > nowMs - ACTUALS.lookbackDays * DAY
      );
    })
    .sort((a, b) => (b.impact === 'High') - (a.impact === 'High') || Date.parse(b.time) - Date.parse(a.time));
}

/** Rejects values that are clearly not the same kind of number as the forecast. */
export function plausible(e, raw) {
  const v = parseValue(raw);
  if (v == null) return false;
  if (unitOf(raw) !== unitOf(e.forecastRaw)) return false;
  const scale = Math.max(Math.abs(e.forecast), Math.abs(e.previous ?? 0), 1e-9);
  return Math.abs(v - e.forecast) <= 10 * scale + 1;
}
