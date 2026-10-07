#!/usr/bin/env node
// Hourly pipeline: calendar -> actual values -> prices -> scores -> public/data/*.json
//
//   node pipeline/run.js                 live run (what GitHub Actions does)
//   node pipeline/run.js --fixture       use the saved sample calendar, no network for it
//   node pipeline/run.js --skip-prices   don't call Twelve Data
//
// Environment: JBLANKED_API_KEY, APIFY_TOKEN, TWELVE_DATA_KEY (all optional; a step without its key is skipped and the
// site still updates).

import { join } from 'node:path';
import { fetchCalendar, normalise, mergeCalendar } from './sources/calendar.js';
import { fillFromFeedPrevious, applyOverrides } from './sources/actuals.js';
import { fillFromApify } from './sources/apify.js';
import { fillFromJBlanked } from './sources/jblanked.js';
import { effectOf } from './lib/score.js';
import { INSTRUMENTS } from './config.js';
import { syncPrices, loadLegs, makePriceSource } from './sources/prices.js';
import { writeOutputs } from './lib/output.js';
import { DATA_DIR, ROOT, readJson, writeJson, readText, log } from './lib/store.js';

// Local runs read keys from .env in this folder (gitignored); GitHub Actions passes them as
// secrets instead, and a variable already set always wins over the file.
try {
  process.loadEnvFile(join(ROOT, '.env'));
} catch {
  /* no .env: nothing to load */
}

const args = new Set(process.argv.slice(2));
const nowMs = Date.now();
const EVENTS_PATH = join(DATA_DIR, 'events.json');
const PRICES_SYNCED = join(DATA_DIR, 'prices', 'synced.json');
const PRICE_EVERY_MIN = 50;

async function main() {
  const events = await readJson(EVENTS_PATH, {});
  const sources = { calendar: 'ForexFactory weekly feed', actuals: ['feed'], prices: null };
  // how each step went, for the live status on "How the score works"
  const report = {
    trigger: process.env.GITHUB_EVENT_NAME || 'local',
    calendar: { files: [], added: 0, updated: 0, removed: 0, error: null },
    actuals: { feed: 0, jblanked: null, apify: null, overrides: 0 },
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

  // 2. Actual values, each source taking what the ones before it left: feed "previous" -> JBlanked
  //    (free) -> ForexFactory's page via Apify (paid from a monthly credit) -> manual CSV (always wins)
  report.actuals.feed = fillFromFeedPrevious(events, nowMs);
  log(`actuals: ${report.actuals.feed} filled from the feed`);
  // releases that only matter to a commodity or index (e.g. crude inventories) still get looked up
  const isDriver = (e) => INSTRUMENTS.some((p) => effectOf(p, e)?.override);
  const jbKey = process.env.JBLANKED_API_KEY;
  if (jbKey) {
    try {
      const r = (report.actuals.jblanked = await fillFromJBlanked(events, nowMs, { apiKey: jbKey, isDriver }));
      log(`actuals: JBlanked filled ${r.filled}/${r.tried} from ${r.results} events`);
      sources.actuals.push('forexfactory');
    } catch (err) {
      report.actuals.jblanked = { error: err.message };
      log(`actuals: ${err.message}`);
    }
  } else {
    log('actuals: JBlanked skipped (no JBLANKED_API_KEY)');
    report.actuals.jblanked = { skipped: 'no JBLANKED_API_KEY' };
  }

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

  // 3. Prices, once an hour although the job runs twice: hourly bars only change hourly, and it
  // keeps Twelve Data inside its free daily credits
  const twelveKey = process.env.TWELVE_DATA_KEY;
  const synced = await readJson(PRICES_SYNCED, null);
  const recently = synced && nowMs - Date.parse(synced.at) < PRICE_EVERY_MIN * 60 * 1000;
  if (twelveKey && !args.has('--skip-prices') && recently) {
    report.prices = { ...synced.report, at: synced.at, recent: true };
    sources.prices = 'Twelve Data';
    log(`prices: fetched ${Math.round((nowMs - Date.parse(synced.at)) / 60000)} min ago; next time`);
  } else if (twelveKey && !args.has('--skip-prices')) {
    report.prices = await syncPrices(nowMs, { apiKey: twelveKey });
    await writeJson(PRICES_SYNCED, { at: new Date(nowMs).toISOString(), report: report.prices });
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
