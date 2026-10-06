// Released values from JBlanked's News API (needs JBLANKED_API_KEY), which relays ForexFactory's
// calendar with its actual values. Free, so it's asked before Apify: one request a run for this
// week's calendar covers the releases still waiting, matched by currency, name and time, and written
// in the feed's own format.

import { JBLANKED } from '../config.js';
import { parseValue, unitOf } from '../lib/parse.js';
import { log } from '../lib/store.js';
import { needsLookup, plausible } from './actuals.js';

const HOUR = 3600 * 1000;
const MULT = { '': 1, '%': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
// JBlanked's field names have varied between versions; take whichever is there
const pick = (it, ...keys) => keys.map((k) => it[k]).find((v) => v != null && v !== '');
const decimalsOf = (raw) => String(raw ?? '').split('|')[0].match(/\.(\d+)/)?.[1].length ?? 0;

/** "2026.10.06 14:00:00" or ISO; read as UTC (the match allows for a different zone). */
function timeOf(it) {
  const d = pick(it, 'Date', 'date', 'Time', 'time', 'datetime');
  if (d == null) return NaN;
  if (typeof d === 'number') return d > 1e12 ? d : d * 1000;
  const s = String(d).trim().replace(/^(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3').replace(' ', 'T');
  return Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`);
}

/**
 * Their value in our format: text that already carries our unit is used as it is; a plain number
 * is scaled against the forecast (or previous) both calendars carry, then given our unit and decimals.
 */
function toRaw(e, it) {
  const actual = pick(it, 'Actual', 'actual');
  if (actual == null) return null;
  const unit = unitOf(e.forecastRaw || e.previousRaw);
  if (typeof actual === 'string' && /[%KMBT]$/i.test(actual.trim())) return unitOf(actual) === unit ? actual.trim() : null;
  const a = Number(String(actual).replace(/[,%]/g, ''));
  if (!Number.isFinite(a)) return null;
  const refs = [
    [e.forecast, Number(pick(it, 'Forecast', 'forecast'))],
    [e.previous, Number(pick(it, 'Previous', 'previous'))],
  ].filter(([ours, theirs]) => ours && Number.isFinite(theirs) && theirs !== 0);
  let factor = 1;
  if (refs.length) {
    const [ours, theirs] = refs[0];
    const best = [1, 1e3, 1e6, 1e9, 1e12, 1e-3, 1e-6]
      .map((f) => ({ f, off: Math.abs(Math.log(Math.abs((theirs * f) / ours))) }))
      .sort((x, y) => x.off - y.off)[0];
    if (best.off > Math.log(2) || Math.sign(theirs) !== Math.sign(ours)) return null;
    factor = best.f;
  } else if (unit !== '' && unit !== '%') return null; // nothing to tell 150 from 150K
  const shown = ((a * factor) / MULT[unit]).toFixed(Math.max(decimalsOf(e.previousRaw), decimalsOf(e.forecastRaw)));
  return `${shown === '-0' ? '0' : shown}${unit}`;
}

export async function fillFromJBlanked(store, nowMs, { apiKey, isDriver }) {
  const todo = needsLookup(store, nowMs, isDriver);
  const out = { tried: todo.length, filled: 0, results: 0, error: null };
  if (!todo.length) return out;

  // the free key covers "today" and "this week" (a date range needs paid credits), so one request
  // for the week covers what's waiting; anything older is left to Apify and the feed
  const res = await fetch(`${JBLANKED.base}/news/api/${JBLANKED.source}/calendar/week/`, {
    headers: { Authorization: `Api-Key ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const why = (body && (body.message || body.detail || body.error)) || text.replace(/\s+/g, ' ').slice(0, 160);
    throw new Error(`JBlanked HTTP ${res.status}: ${String(why).slice(0, 200)}`);
  }
  const list = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : Array.isArray(body?.results) ? body.results : null;
  if (!list) throw new Error(`JBlanked answered without a list of events: ${text.slice(0, 160)}`);
  out.results = list.length;

  const rows = list
    .filter((it) => pick(it, 'Actual', 'actual') != null)
    .map((it) => ({ it, ms: timeOf(it), key: norm(pick(it, 'Name', 'name', 'Event', 'event', 'title')), ccy: String(pick(it, 'Currency', 'currency') ?? '').toUpperCase() }));

  const missed = [];
  for (const e of todo) {
    const t = Date.parse(e.time);
    const title = norm(e.title);
    const hit = rows
      .filter((r) => r.ccy === e.currency && r.key === title && Math.abs(r.ms - t) <= JBLANKED.matchHours * HOUR)
      .sort((a, b) => Math.abs(a.ms - t) - Math.abs(b.ms - t))[0];
    const raw = hit ? toRaw(e, hit.it) : null;
    if (raw && plausible(e, raw)) {
      e.actual = parseValue(raw);
      e.actualRaw = raw;
      e.actualSource = 'forexfactory';
      e.actualSourceUrl = null;
      out.filled++;
      log(`actuals: ${e.currency} ${e.title} = ${raw} (JBlanked)`);
    } else missed.push(e);
  }
  if (missed.length) {
    log(
      `actuals: JBlanked had no usable match for ${missed.map((e) => `${e.currency} "${e.title}" @ ${e.time}`).join(', ')}. ` +
        `It returned ${list.length} events, e.g. ${list.slice(0, 3).map((it) => JSON.stringify(it).slice(0, 300)).join(' | ') || 'nothing'}`,
    );
  }
  return out;
}
