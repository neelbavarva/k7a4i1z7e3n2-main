// Released values from Financial Modeling Prep's economic calendar (needs FMP_API_KEY).
// One request covers every release still waiting for its number; each is matched to FMP's
// listing by currency, time and name, and the value is written in ForexFactory's own format
// (same unit and decimals), so it reads exactly like a value the feed would have given.

import { ACTUALS } from '../config.js';
import { parseValue, unitOf } from '../lib/parse.js';
import { log } from '../lib/store.js';
import { needsLookup, plausible } from './actuals.js';

const URL = 'https://financialmodelingprep.com/stable/economic-calendar';
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const MULT = { '': 1, '%': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

// "German Factory Orders m/m" is listed by FMP as Germany's "Factory Orders (MoM)"
const COUNTRY_WORD = { german: 'DE', french: 'FR', italian: 'IT', spanish: 'ES', chinese: 'CN' };
// words that name the same thing differently on the two calendars
const SAME = [
  [/non-?farm employment change/, 'nonfarm payrolls'],
  [/unemployment claims/, 'initial jobless claims'],
  [/\bservices pmi\b/, 'services pmi'],
  [/non-?manufacturing pmi/, 'services pmi'],
  [/\bism services\b/, 'ism services'],
  [/average hourly earnings/, 'average hourly earnings'],
  [/core pce price index/, 'core pce price index'],
  [/\bcb consumer confidence\b/, 'consumer confidence'],
  [/\bprelim\b/, 'flash'],
];
// names of survey publishers FMP adds and ForexFactory leaves out
const NOISE = new Set(['s&p', 's', 'p', 'global', 'hcob', 'au', 'jibun', 'bank', 'caixin', 'rbc', 'the', 'of', 'and', 'sa', 's.a', 'nsa', 'n.s.a', 'final', 'a']);
const MONTHS = /\((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\)|\(q[1-4]\)/gi;

/** Lower-case words, the period kind (mom/yoy/qoq) apart, publishers dropped. */
function words(title) {
  let t = ` ${title.toLowerCase()} `
    .replace(MONTHS, ' ')
    .replace(/\(mom\)|\bm\/m\b/g, ' mom ')
    .replace(/\(yoy\)|\by\/y\b/g, ' yoy ')
    .replace(/\(qoq\)|\bq\/q\b/g, ' qoq ');
  for (const [re, to] of SAME) t = t.replace(re, ` ${to} `);
  const all = t.replace(/[(),.]/g, ' ').split(/\s+/).filter((w) => w && !NOISE.has(w));
  const period = all.find((w) => w === 'mom' || w === 'yoy' || w === 'qoq') ?? null;
  return { set: new Set(all.filter((w) => w !== 'mom' && w !== 'yoy' && w !== 'qoq')), period };
}

/** How well an FMP listing's name fits ours: the share of our words it has, 0 when the period kind differs. */
function fit(ours, theirs) {
  if (ours.period && theirs.period && ours.period !== theirs.period) return 0;
  if (!ours.set.size) return 0;
  let hit = 0;
  for (const w of ours.set) if (theirs.set.has(w)) hit++;
  return hit / ours.set.size;
}

const decimalsOf = (raw) => (String(raw ?? '').split('|')[0].match(/\.(\d+)/)?.[1].length ?? 0);

/**
 * FMP's number in our format. K/M/B/T values are calibrated against the previous (or forecast)
 * value both calendars carry, since FMP may give 150 where ForexFactory says 150K; without
 * something to calibrate against, only plain and % values are taken.
 */
function toRaw(e, row) {
  const ref = e.forecastRaw || e.previousRaw;
  const unit = unitOf(ref);
  let factor = 1;
  if (unit === 'K' || unit === 'M' || unit === 'B' || unit === 'T') {
    const pairs = [
      [e.previous, row.previous],
      [e.forecast, row.estimate],
    ].filter(([a, b]) => a != null && b != null && b !== 0 && a !== 0);
    if (!pairs.length) return null;
    const [ours, theirs] = pairs[0];
    const best = [1, 1e3, 1e6, 1e9, 1e12, 1e-3]
      .map((f) => ({ f, off: Math.abs(Math.log(Math.abs((theirs * f) / ours))) }))
      .sort((a, b) => a.off - b.off)[0];
    if (best.off > Math.log(2) || Math.sign(theirs) !== Math.sign(ours)) return null;
    factor = best.f;
  }
  const full = Number(row.actual) * factor;
  if (!Number.isFinite(full)) return null;
  const shown = (full / MULT[unit]).toFixed(Math.max(decimalsOf(e.previousRaw), decimalsOf(e.forecastRaw)));
  return `${shown === '-0' ? '0' : shown}${unit}`;
}

export async function fillFromFmp(store, nowMs, { apiKey, isDriver }) {
  const todo = needsLookup(store, nowMs, isDriver);
  if (!todo.length) return { tried: 0, filled: 0, rows: 0, error: null };
  const day = (ms) => new Date(ms).toISOString().slice(0, 10);
  const from = day(Math.min(...todo.map((e) => Date.parse(e.time))) - DAY);
  const to = day(nowMs + DAY);

  // the key goes in the query string; it never appears in a log or an error
  const res = await fetch(`${URL}?from=${from}&to=${to}&apikey=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(20_000) });
  const body = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(body)) {
    const why = (body && (body['Error Message'] || body.message || body.error)) || `HTTP ${res.status}`;
    throw new Error(`FMP: ${String(why).replace(/apikey=\w+/gi, 'apikey=…').slice(0, 220)}`);
  }
  const rows = body
    .filter((r) => r.actual != null && r.actual !== '')
    .map((r) => ({ ...r, ms: Date.parse(`${String(r.date).replace(' ', 'T')}Z`), words: words(String(r.event ?? '')) }));

  let filled = 0;
  const missed = [];
  for (const e of todo) {
    const t = Date.parse(e.time);
    const ours = words(e.title);
    const adjective = e.title.split(' ')[0].toLowerCase();
    const country = COUNTRY_WORD[adjective];
    if (country) ours.set.delete(adjective);
    const candidates = rows
      .filter((r) => r.currency === e.currency && Math.abs(r.ms - t) <= 12 * HOUR && (!country || r.country === country))
      .map((r) => ({ r, score: fit(ours, r.words), gap: Math.abs(r.ms - t) }))
      .filter((c) => c.score >= ACTUALS.fmpMinFit)
      .sort((a, b) => b.score - a.score || a.gap - b.gap);
    const pick = candidates[0]?.r;
    const raw = pick ? toRaw(e, pick) : null;
    if (raw && plausible(e, raw)) {
      e.actual = parseValue(raw);
      e.actualRaw = raw;
      e.actualSource = 'fmp';
      e.actualSourceUrl = null;
      filled++;
      log(`actuals: ${e.currency} ${e.title} = ${raw} (FMP "${pick.event}")`);
    } else missed.push(`${e.currency} ${e.title}${pick ? ` (closest "${pick.event}", value didn't fit)` : ''}`);
  }
  if (missed.length) log(`actuals: FMP had no usable match for ${missed.slice(0, 8).join('; ')}${missed.length > 8 ? '…' : ''}`);
  return { tried: todo.length, filled, rows: rows.length, error: null };
}
