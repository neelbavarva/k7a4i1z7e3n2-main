#!/usr/bin/env node
// Hourly pipeline: calendar -> actual values -> prices -> scores -> public/data/*.json
//
//   node pipeline/run.js                 live run (what GitHub Actions does)
//   node pipeline/run.js --fixture       use the saved sample calendar, no network for it
//   node pipeline/run.js --skip-prices   don't call Twelve Data
//
// Environment: APIFY_TOKEN, TWELVE_DATA_KEY (both optional; a step without its key is skipped and the
// site still updates).

import { join } from 'node:path';
import { fetchCalendar, normalise, mergeCalendar } from './sources/calendar.js';
import { fillFromFeedPrevious, applyOverrides } from './sources/actuals.js';
import { fillFromApify } from './sources/apify.js';
import { syncPrices, loadLegs, makePriceSource } from './sources/prices.js';
import { writeOutputs } from './lib/output.js';
import { DATA_DIR, ROOT, readJson, writeJson, readText, log } from './lib/store.js';

const args = new Set(process.argv.slice(2));
const nowMs = Date.now();
const EVENTS_PATH = join(DATA_DIR, 'events.json');

async function main() {
  const events = await readJson(EVENTS_PATH, {});
  const sources = { calendar: 'ForexFactory weekly feed', actuals: ['feed'], prices: null };
  // how each step went, for the live status on "How the score works"
  const report = {
    trigger: process.env.GITHUB_EVENT_NAME || 'local',
    calendar: { files: [], added: 0, updated: 0, removed: 0, error: null },
    actuals: { feed: 0, apify: null, overrides: 0 },
    prices: null,
  };

  // 1. Calendar
  try {
    const items = await fetchCalendar({ fixtureDir: args.has('--fixture') ? join(ROOT, 'pipeline', 'fixtures') : null, report: report.calendar.files });
    const merged = mergeCalendar(events, normalise(items), nowMs);
    Object.assign(report.calendar, { added: merged.added, updated: merged.updated, removed: merged.removed });
    log(`calendar: +${merged.added} new, ${merged.updated} updated, ${merged.removed} removed`);
  } catch (err) {
    report.calendar.error = err.message;
    // A feed outage shouldn't stop the site: keep scoring (and decaying) stored events.
    if (!Object.keys(events).length) throw err;
    log(`calendar: ${err.message}; continuing with ${Object.keys(events).length} stored events`);
  }

  // 2. Actual values: feed "previous" -> ForexFactory's page via Apify -> manual CSV (manual always wins)
  report.actuals.feed = fillFromFeedPrevious(events, nowMs);
  log(`actuals: ${report.actuals.feed} filled from the feed`);
  const apifyToken = process.env.APIFY_TOKEN;
  if (apifyToken) {
    try {
      const r = (report.actuals.apify = await fillFromApify(events, nowMs, { token: apifyToken }));
      log(`actuals: Apify filled ${r.filled}/${r.tried} in ${r.runs} run(s), ${r.results} results${r.used != null ? `; $${r.used.toFixed(2)} of $${r.limit.toFixed(2)} used this month` : ''}`);
      sources.actuals.push('forexfactory');
    } catch (err) {
      report.actuals.apify = { error: err.message };
      log(`actuals: ${err.message}`);
    }
  } else {
    log('actuals: Apify skipped (no APIFY_TOKEN)');
    report.actuals.apify = { skipped: 'no APIFY_TOKEN' };
  }
  const overrides = await readText(join(DATA_DIR, 'actuals_overrides.csv'));
  report.actuals.overrides = applyOverrides(events, overrides);
  log(`actuals: ${report.actuals.overrides} manual overrides applied`);
  sources.actuals.push('manual');

  await writeJson(EVENTS_PATH, events);

  // 3. Prices
  const twelveKey = process.env.TWELVE_DATA_KEY;
  if (twelveKey && !args.has('--skip-prices')) {
    report.prices = await syncPrices(nowMs, { apiKey: twelveKey });
    sources.prices = 'Twelve Data';
  } else {
    log('prices: skipped (no TWELVE_DATA_KEY)');
    report.prices = { skipped: 'no TWELVE_DATA_KEY' };
  }

  // 4. Scores + static JSON
  const meta = await writeOutputs({ events, nowMs, pricesFor: makePriceSource(await loadLegs()), sources, report });
  for (const p of meta.pairs) log(`score ${p.symbol.padEnd(8)} ${String(p.score).padStart(6)}  ${p.label}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
