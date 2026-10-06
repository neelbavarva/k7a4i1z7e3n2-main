// Released values from ForexFactory's calendar page, read by the "forexfactory-calendar" scraper on
// Apify (needs APIFY_TOKEN). The weekly feed we use for the schedule has no actual values; the
// calendar page has them minutes after each release, under the same titles, currencies and times,
// so each value matches its release exactly and comes in the feed's own format ("54.9", "0.3%").
//
// Apify's free plan is $5 of usage a month, and every run costs a few cents, so the job asks only
// when a release that counts is waiting, only for those days and currencies, at most a few times
// per release, and not at all once the month's credit is nearly used.

import { APIFY } from '../config.js';
import { parseValue } from '../lib/parse.js';
import { log } from '../lib/store.js';
import { plausible } from './actuals.js';

const API = 'https://api.apify.com/v2';
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const call = (path, token, init = {}) =>
  fetch(`${API}${path}`, {
    ...init,
    // the token travels in a header, so no URL that might be logged ever carries it
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    signal: AbortSignal.timeout(APIFY.timeoutS * 1000 + 30_000),
  });

async function why(res) {
  const text = await res.text().catch(() => '');
  try {
    const e = JSON.parse(text).error;
    if (e?.message) return `${e.type ? `${e.type}: ` : ''}${e.message}`;
  } catch {
    /* not JSON */
  }
  return text.replace(/\s+/g, ' ').slice(0, 160) || 'no reason given';
}

/** Releases worth a paid run: High/Medium, out for a while, recent, not tried too often. */
export function waitingForApify(store, nowMs) {
  return Object.values(store).filter((e) => {
    const t = Date.parse(e.time);
    return (
      !e.skip &&
      (e.impact === 'High' || e.impact === 'Medium') &&
      e.actual == null &&
      e.forecast != null &&
      (e.apifyTries ?? 0) < APIFY.maxTries &&
      t <= nowMs - APIFY.minutesAfterRelease * MIN &&
      t >= nowMs - APIFY.lookbackDays * DAY
    );
  });
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const nyDate = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(ms);

/** How much of the month's Apify credit is used: { used, limit } in US$, or null if it can't be read. */
async function budget(token) {
  const res = await call('/users/me/limits', token);
  if (!res.ok) throw new Error(`Apify HTTP ${res.status}: ${await why(res)}`);
  const d = (await res.json()).data ?? {};
  const used = Number(d.current?.monthlyUsageUsd);
  const limit = Number(d.limits?.maxMonthlyUsageUsd);
  return Number.isFinite(used) && Number.isFinite(limit) ? { used, limit } : null;
}

export async function fillFromApify(store, nowMs, { token }) {
  const todo = waitingForApify(store, nowMs);
  const out = { tried: todo.length, filled: 0, runs: 0, results: 0, used: null, limit: null, error: null, paused: null };
  if (!todo.length) {
    // still report the month's spend, so the status page can show it
    const b = await budget(token).catch(() => null);
    if (b) Object.assign(out, b);
    return out;
  }

  const b = await budget(token);
  if (b) Object.assign(out, b);
  if (b && b.used >= b.limit - APIFY.reserveUsd) {
    out.paused = `this month's Apify credit is nearly used ($${b.used.toFixed(2)} of $${b.limit.toFixed(2)})`;
    log(`actuals: Apify paused: ${out.paused}`);
    return out;
  }

  // one run per day needed. The scraper's "day" may follow New York time rather than UTC, so a
  // release not found on its UTC day is asked for on its New York day on the next try.
  const days = new Map();
  for (const e of todo) {
    const t = Date.parse(e.time);
    const want = [new Date(t).toISOString().slice(0, 10)];
    if ((e.apifyTries ?? 0) > 0) want.push(nyDate(t));
    for (const d of want) {
      if (!days.has(d)) days.set(d, new Set());
      days.get(d).add(e.currency);
    }
  }

  const items = [];
  for (const [day, currencies] of [...days].slice(0, APIFY.maxRunsPerJob)) {
    const res = await call(
      `/acts/${APIFY.actor}/run-sync-get-dataset-items?timeout=${APIFY.timeoutS}&memory=${APIFY.memoryMb}&maxTotalChargeUsd=${APIFY.maxChargePerRunUsd}`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({ dateRange: 'day', day, currencies: [...currencies], minImpact: 'medium', upcomingOnly: false, maxItems: APIFY.maxItems }),
      },
    );
    out.runs++;
    if (!res.ok) throw new Error(`Apify HTTP ${res.status}: ${await why(res)}`);
    const got = await res.json();
    if (!Array.isArray(got)) throw new Error('Apify answered without a list of events');
    items.push(...got);
  }
  out.results = items.length;

  const released = items
    .filter((it) => it.actual != null && String(it.actual).trim() !== '')
    .map((it) => ({ ...it, ms: Date.parse(it.datetimeISO ?? '') || Number(it.dateline) * 1000, key: norm(it.title) }));

  for (const e of todo) {
    e.apifyTries = (e.apifyTries ?? 0) + 1;
    const t = Date.parse(e.time);
    const title = norm(e.title);
    const hit = released
      .filter((it) => it.currency === e.currency && it.key === title && Math.abs(it.ms - t) <= 3 * HOUR)
      .sort((a, b) => Math.abs(a.ms - t) - Math.abs(b.ms - t))[0];
    const raw = hit ? String(hit.actual).trim() : null;
    if (raw && plausible(e, raw)) {
      e.actual = parseValue(raw);
      e.actualRaw = raw;
      e.actualSource = 'forexfactory';
      e.actualSourceUrl = hit.url ?? null;
      out.filled++;
      log(`actuals: ${e.currency} ${e.title} = ${raw} (ForexFactory, via Apify)`);
    } else if (hit) {
      log(`actuals: Apify gave "${raw}" for ${e.currency} ${e.title}, which doesn't fit its forecast "${e.forecastRaw}"; left waiting`);
    }
  }
  return out;
}
