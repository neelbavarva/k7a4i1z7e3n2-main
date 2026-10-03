import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CALENDAR_URLS, CURRENCIES, RETENTION } from '../config.js';
import { classify, eventId, parseValue } from '../lib/parse.js';
import { log } from '../lib/store.js';

const DAY = 86400 * 1000;

/** Downloads this week's (and, when available, next week's) ForexFactory calendar. */
export async function fetchCalendar({ fixtureDir } = {}) {
  if (fixtureDir) {
    const raw = await readFile(join(fixtureDir, 'ff_calendar_thisweek.json'), 'utf8');
    log('calendar: using fixture');
    return JSON.parse(raw);
  }
  const items = [];
  for (const [i, url] of CALENDAR_URLS.entries()) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'fx-fundamental-bias (hourly, cached)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      log(`calendar: ${data.length} items from ${url.split('/').pop()}`);
      items.push(...data);
    } catch (err) {
      // This-week is required; next-week is optional (it may not exist).
      if (i === 0) throw new Error(`calendar fetch failed: ${err.message}`);
      log(`calendar: optional ${url.split('/').pop()} unavailable (${err.message})`);
    }
  }
  return items;
}

/** Normalises feed items into event records. */
export function normalise(items) {
  return items
    .filter((it) => CURRENCIES.has(it.country) && it.date)
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
      attempts: old?.attempts ?? 0,
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
