// The economic calendar behind the site's Calendar page: every release in the feed's weeks as
// one flat list, with what each one means for its currency. Two places build it:
//   - api/calendar.js (and the dev server): live from the ForexFactory feed, on request
//   - the hourly job (lib/output.js): a saved copy in public/data/calendar.json, with the
//     actual values the job has found, which the page falls back on and borrows actuals from

import { fetchCalendar, normalise } from '../sources/calendar.js';
import { fillFromFeedPrevious } from '../sources/actuals.js';
import { categoryOf } from './score.js';
import { judge } from './values.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** Talk rather than a number: moves markets through what is said. */
const SPEECH = ['speaks', 'speech', 'testifies', 'press conference', 'hearing', 'remarks'];

/** holiday | rate | speech | data | other (minutes, auctions, inventories: risk without a verdict) */
export function kindOf(e) {
  if (e.impact === 'Holiday') return 'holiday';
  if (e.isRate) return 'rate';
  const t = e.title.toLowerCase();
  if (SPEECH.some((w) => t.includes(w))) return 'speech';
  return e.skip ? 'other' : 'data';
}

/** One release as the page gets it. Field names follow the pair files (t, ccy, f, p, a…). */
export function publicEvent(e) {
  const kind = kindOf(e);
  const f = e.forecastRaw || null;
  const p = e.previousRaw || null;
  const a = e.actualRaw || null;
  return {
    id: e.id,
    t: e.time,
    ccy: e.currency,
    title: e.title,
    impact: e.impact,
    f,
    p,
    a,
    src: e.actualSource || null,
    url: e.actualSourceUrl || null,
    kind,
    cat: kind === 'data' || kind === 'rate' ? categoryOf(e) : null,
    dir: e.dir,
    skip: e.skip,
    w: e.weight,
    ...judge({ a, f, p, dir: e.dir, skip: e.skip }),
  };
}

export function buildCalendar(events, { nowMs, live, demo = false, source }) {
  const list = [...events].sort((x, y) => Date.parse(x.time) - Date.parse(y.time) || x.currency.localeCompare(y.currency));
  return {
    generatedAt: new Date(nowMs).toISOString(),
    live,
    demo,
    source,
    events: list.map(publicEvent),
  };
}

/** Sunday 00:00 UTC of the week `ms` is in (the feed's weeks run Sunday to Saturday). */
const weekStart = (ms) => {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - d.getUTCDay() * DAY;
};

/** The hourly job's copy: this week onwards, with every actual value it has found. */
export function savedCalendar(events, { nowMs, demo, source }) {
  // half a day early, so Sunday evening in New York (Monday morning in Asia) is in
  const from = weekStart(nowMs) - 12 * HOUR;
  return buildCalendar(
    events.filter((e) => Date.parse(e.time) >= from),
    { nowMs, live: false, demo, source },
  );
}

/**
 * Live: this week's feed and next week's once it's out (every country in it), with the actual
 * values the feed itself reveals (a weekly release's next listing carries it as "previous").
 */
export async function liveCalendar({ nowMs = Date.now() } = {}) {
  const items = await fetchCalendar();
  const store = {};
  for (const e of normalise(items, { currencies: null })) {
    store[e.id] = { ...e, actual: null, actualRaw: null, actualSource: null, actualSourceUrl: null };
  }
  fillFromFeedPrevious(store, nowMs);
  return buildCalendar(Object.values(store), { nowMs, live: true, source: 'ForexFactory weekly feed' });
}
