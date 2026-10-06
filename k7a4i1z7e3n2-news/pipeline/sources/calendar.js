import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CALENDAR_URLS, CURRENCIES, RETENTION } from '../config.js';
import { classify, eventId, parseValue } from '../lib/parse.js';
import { log } from '../lib/store.js';

const DAY = 86400 * 1000;

/** Downloads this week's (and, when available, next week's) ForexFactory calendar. */
export async function fetchCalendar({ fixtureDir, report = [] } = {}) {
  if (fixtureDir) {
    const raw = await readFile(join(fixtureDir, 'ff_calendar_thisweek.json'), 'utf8');
    log('calendar: using fixture');
    const items = JSON.parse(raw);
    report.push({ file: 'fixture', items: items.length });
    return items;
  }
  const items = [];
  for (const [i, url] of CALENDAR_URLS.entries()) {
    const file = url.split('/').pop();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'fx-fundamental-bias (hourly, cached)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      log(`calendar: ${data.length} items from ${file}`);
      report.push({ file, items: data.length });
      items.push(...data);
    } catch (err) {
      report.push({ file, error: err.message, optional: i > 0 });
      // This-week is required; next-week is optional (it may not exist).
      if (i === 0) throw new Error(`calendar fetch failed: ${err.message}`);
      log(`calendar: optional ${file} unavailable (${err.message})`);
    }
  }
  return items;
}

/**
 * Normalises feed items into event records. The scores keep the currencies they use; the
 * Calendar page passes `currencies: null` to keep every country in the feed.
 */
export function normalise(items, { currencies = CURRENCIES } = {}) {
  return items
    .filter((it) => (!currencies || currencies.has(it.country)) && it.date)
    .map((it) => {
      const time = new Date(it.date).toISOString();
      const cls = classify(it.title, it.impact);
      return {
        id: eventId(it.title, it.country, time),
        title: it.title,
        currency: it.country,
        time,
        impact: it.impact,
        forecastRaw: it.forecast ?? '',
        previousRaw: it.previous ?? '',
        forecast: parseValue(it.forecast),
        previous: parseValue(it.previous),
        ...cls,
      };
    });
}

/**
 * Merges fresh feed events into the stored map (id -> event), keeping any actual
 * values already found. Drops unreleased events the feed no longer lists inside its
 * own date range (rescheduled or cancelled), and prunes very old events.
 */
export function mergeCalendar(store, fresh, nowMs) {
  const stats = { added: 0, updated: 0, removed: 0 };
  const freshIds = new Set(fresh.map((e) => e.id));
  for (const e of fresh) {
    const old = store[e.id];
    if (!old) stats.added++;
    else stats.updated++;
    store[e.id] = {
      ...e,
      actual: old?.actual ?? null,
      actualRaw: old?.actualRaw ?? null,
      actualSource: old?.actualSource ?? null,
      actualSourceUrl: old?.actualSourceUrl ?? null,
      // paid lookups already spent on this release (pipeline/sources/apify.js), so the cap holds across runs
      apifyTries: old?.apifyTries ?? 0,
      firstSeen: old?.firstSeen ?? new Date(nowMs).toISOString(),
    };
  }
  if (fresh.length) {
    const times = fresh.map((e) => Date.parse(e.time));
    const lo = Math.min(...times);
    const hi = Math.max(...times);
    for (const [id, e] of Object.entries(store)) {
      const t = Date.parse(e.time);
      if (t >= lo && t <= hi && !freshIds.has(id) && e.actual == null) {
        delete store[id];
        stats.removed++;
      }
    }
  }
  const cutoff = nowMs - RETENTION.eventsDays * DAY;
  for (const [id, e] of Object.entries(store)) {
    if (Date.parse(e.time) < cutoff) {
      delete store[id];
      stats.removed++;
    }
  }
  return stats;
}
