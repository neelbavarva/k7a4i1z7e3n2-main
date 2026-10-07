import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseValue, unitOf, classify } from '../lib/parse.js';
import { surprise, toScore, labelFor, computePair, buildSurpriseStats, bandWidth } from '../lib/score.js';
import { normalise, mergeCalendar } from '../sources/calendar.js';
import { fillFromFeedPrevious, applyOverrides, plausible, needsLookup } from '../sources/actuals.js';
import { MODEL } from '../config.js';
import { fillFromApify } from '../sources/apify.js';
import { fillFromJBlanked } from '../sources/jblanked.js';
import { fillFromOfficial, formatLike } from '../sources/official.js';

const near = (a, b, tol = 0.6) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);
const HOUR = 3600e3;

test('parseValue handles every format the feed uses', () => {
  assert.equal(parseValue('0.3%'), 0.3);
  assert.equal(parseValue('201K'), 201000);
  assert.equal(parseValue('7.23M'), 7230000);
  assert.equal(parseValue('-116.3B'), -116.3e9);
  assert.equal(parseValue('54.8'), 54.8);
  assert.equal(parseValue('5.16|3.6'), 5.16);
  assert.equal(parseValue(''), null);
  assert.equal(parseValue('n/a'), null);
  assert.equal(unitOf('201K'), 'K');
  assert.equal(unitOf('54.8'), '');
});

test('classify: first matching rule wins', () => {
  assert.equal(classify('Unemployment Rate', 'High').dir, -1);
  assert.equal(classify('Unemployment Claims', 'Medium').dir, -1);
  assert.equal(classify('Cash Rate', 'High').isRate, true);
  assert.equal(classify('Cash Rate', 'High').weight, 4);
  assert.equal(classify('ECB President Lagarde Speaks', 'Medium').skip, true);
  assert.equal(classify('Bank Holiday', 'Holiday').skip, true);
  assert.equal(classify('Non-Farm Employment Change', 'High').weight, 3);
  assert.equal(classify('CPI m/m', 'Medium').weight, 1.5);
  assert.equal(classify('Factory Orders m/m', 'Low').weight, 0);
});

test('worked example: NFP beat on EUR/USD = -54, then -30 after 72h', () => {
  const nfp = { title: 'Non-Farm Employment Change', currency: 'USD', actual: 150e3, forecast: 89e3, previous: 162e3, dir: 1, weight: 3, isRate: false };
  // force sigma = 50K through stats
  const stats = { 'USD|Non-Farm Employment Change': { n: 10, sigma: 50e3 } };
  const s = surprise(nfp, stats);
  near(s.z, 1.22, 0.01);
  const c = -1 * s.currencyEffect; // USD is the quote of EUR/USD
  // The brief's example used K = 6:
  near(toScore(c, 6), -54.4);
  near(toScore(c * 0.5, 6), -29.6);
  assert.equal(labelFor(toScore(c, 6)), 'Bearish');
  assert.equal(labelFor(toScore(c * 0.5, 6)), 'Mildly bearish');
  // With the shipped K = 12 the same event reads milder:
  near(toScore(c), -29.6);
  assert.equal(labelFor(5), 'Neutral');
  assert.equal(labelFor(80), 'Strongly bullish');
});

test('computePair: score decays and future band widens around events', () => {
  const now = Date.parse('2026-10-03T00:00:00Z');
  const pair = { id: 'EURUSD', symbol: 'EUR/USD', base: 'EUR', quote: 'USD' };
  const ev = (o) => ({ dir: 1, weight: 3, halfLife: 72, skip: false, isRate: false, impact: 'High', forecastRaw: '', previousRaw: '', ...o });
  const events = [
    ev({ id: 'a', title: 'NFP', currency: 'USD', time: new Date(now - 72 * HOUR).toISOString(), forecast: 89e3, actual: 150e3, previous: 89e3 }),
    ev({ id: 'b', title: 'CPI', currency: 'EUR', time: new Date(now + 48 * HOUR).toISOString(), forecast: 2.5, actual: null }),
  ];
  const stats = { 'USD|NFP': { n: 10, sigma: 50e3 } };
  const out = computePair(pair, events, stats, now);
  const at = (h) => out.series.find((p) => p.t === now + h * HOUR);
  near(at(-72).s, -29.6);
  near(at(0).s, -15.2);
  assert.ok(at(24).s > at(0).s, 'projection keeps decaying toward zero');
  assert.ok(at(48).hi - at(48).lo > at(24).hi - at(24).lo, 'band is widest at the event');
  assert.equal(out.summary.label, 'Mildly bearish');
  assert.ok(out.summary.driver.value < 0, 'driver pushes the same way as the score');
  assert.equal(out.summary.next.title, 'CPI');
  assert.equal(out.summary.driver.currency, 'USD');
  assert.equal(out.series.length, (30 + 7) * 24 + 1);
  near(bandWidth(now, []), 5, 0);
});

test('calendar merge keeps actuals and drops rescheduled events', () => {
  const now = Date.parse('2026-10-03T00:00:00Z');
  const fresh = normalise([
    { title: 'CPI y/y', country: 'AUD', date: '2026-09-29T21:30:00-04:00', impact: 'High', forecast: '4.1%', previous: '3.5%' },
    { title: 'X', country: 'MXN', date: '2026-09-29T21:30:00-04:00', impact: 'High', forecast: '', previous: '' },
  ]);
  assert.equal(fresh.length, 1, 'non-tracked currencies are dropped');
  assert.equal(fresh[0].time, '2026-09-30T01:30:00.000Z', 'times are stored in UTC');
  const store = { [fresh[0].id]: { ...fresh[0], actual: 4.3, actualRaw: '4.3%', actualSource: 'manual', apifyTries: 2 }, ghost: { ...fresh[0], id: 'ghost', actual: null } };
  mergeCalendar(store, fresh, now);
  assert.equal(store[fresh[0].id].actual, 4.3);
  assert.equal(store[fresh[0].id].apifyTries, 2, 'paid tries are kept across merges');
  assert.equal(store.ghost, undefined);
});

test('actual values: feed previous, overrides and plausibility', () => {
  const now = Date.parse('2026-10-10T00:00:00Z');
  const base = { title: 'Unemployment Claims', currency: 'USD', impact: 'Medium', skip: false, forecastRaw: '201K', forecast: 201e3, attempts: 0 };
  const store = {
    a: { ...base, id: 'a', time: '2026-10-01T12:30:00.000Z', previousRaw: '197K', previous: 197e3, actual: null },
    b: { ...base, id: 'b', time: '2026-10-08T12:30:00.000Z', previousRaw: '209K', previous: 209e3, actual: null },
  };
  assert.equal(fillFromFeedPrevious(store, now), 1);
  assert.equal(store.a.actual, 209e3);
  assert.equal(store.a.actualSource, 'feed');
  assert.deepEqual(needsLookup(store, now).map((e) => e.id), ['b']);
  applyOverrides(store, 'date,currency,title,actual\n2026-10-08,USD,Unemployment Claims,215K\n');
  assert.equal(store.b.actual, 215e3);
  assert.equal(store.b.actualSource, 'manual');
  assert.equal(plausible(store.a, '210K'), true);
  assert.equal(plausible(store.a, '0.3%'), false);
  assert.equal(plausible(store.a, '99999K'), false);
});

test('surprise stats need at least two releases', () => {
  const e = (a) => ({ title: 'T', currency: 'USD', skip: false, actual: a, forecast: 1 });
  const s = buildSurpriseStats([e(1.1), e(0.9), e(1.0)]);
  near(s['USD|T'].sigma, 0.1, 1e-9);
  assert.equal(s['USD|T'].n, 3);
});

test('markets: 28 FX crosses in market convention, plus metals, energy and indices', async () => {
  const { PAIRS } = await import('../config.js');
  const ids = PAIRS.map((p) => p.id);
  assert.equal(PAIRS.filter((p) => p.kind === 'fx').length, 28);
  for (const id of ['EURGBP', 'GBPAUD', 'AUDNZD', 'NZDCAD', 'CADCHF', 'CHFJPY', 'GBPJPY', 'EURCHF', 'USDJPY']) assert.ok(ids.includes(id), id);
  for (const id of ['XAUUSD', 'XAGUSD', 'COPPER', 'USOIL', 'US500', 'NAS100', 'US30']) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, PAIRS.length);
  for (const p of PAIRS.filter((x) => x.kind !== 'fx')) assert.ok(p.drivers?.length && p.price?.length, `${p.id} has drivers and a price symbol`);
});

test('driver profiles: indices, metals, oil and copper react the right way', async () => {
  const { INSTRUMENTS } = await import('../config.js');
  const m = Object.fromEntries(INSTRUMENTS.map((p) => [p.id, p]));
  const now = Date.parse('2026-10-03T00:00:00Z');
  const ago = new Date(now - 3600e3).toISOString();
  const ev = (o) => ({ id: o.title, dir: 1, weight: 3, halfLife: 72, skip: false, isRate: false, impact: 'High', forecastRaw: '1', previousRaw: '1', time: ago, ...o });
  const score = (id, events, stats = {}) => computePair(m[id], events, stats, now).summary.score;
  const cpiBeat = ev({ title: 'CPI m/m', currency: 'USD', forecast: 0.3, previous: 0.3, actual: 0.6 });
  const gdpBeat = ev({ title: 'Final GDP q/q', currency: 'USD', forecast: 1.5, previous: 1.5, actual: 2.5 });

  assert.ok(score('US500', [cpiBeat]) < 0, 'hot US inflation is bearish for the S&P 500');
  assert.ok(score('NAS100', [cpiBeat]) < score('US30', [cpiBeat]), 'and hits the Nasdaq harder than the Dow');
  assert.ok(score('US500', [gdpBeat]) > 0, 'strong US growth is bullish for the S&P 500');
  assert.ok(score('XAUUSD', [gdpBeat]) < score('XAGUSD', [gdpBeat]) && score('XAGUSD', [gdpBeat]) < 0, 'growth hurts silver less than gold');

  // Crude inventories are Low impact and skipped by FX, but drive oil: a bigger build is bearish
  const build = ev({ title: 'Crude Oil Inventories', currency: 'USD', impact: 'Low', weight: 0, skip: true, forecast: -0.7e6, previous: -0.7e6, actual: 3e6, forecastRaw: '-0.7M', previousRaw: '-0.7M' });
  const oil = computePair(m.USOIL, [build], {}, now);
  assert.ok(oil.summary.score < 0);
  assert.equal(oil.events[0].impact, 'Medium', 'shown as a release that matters for oil');
  assert.equal(oil.events[0].skip, false);
  assert.equal(score('US500', [build]), 0, 'inventories do not move the S&P 500');

  // China factory PMI (Low impact on the calendar) beats: bullish copper, ignored by EUR/USD
  const pmi = ev({ title: 'Manufacturing PMI', currency: 'CNY', impact: 'Low', weight: 0, forecast: 50, previous: 50, actual: 52 });
  assert.ok(score('COPPER', [pmi]) > 0);
  assert.equal(computePair({ id: 'EURUSD', symbol: 'EUR/USD', base: 'EUR', quote: 'USD' }, [pmi], {}, now).summary.score, 0);

  // drivers breakdown on the page
  const d = computePair(m.US500, [cpiBeat, gdpBeat], {}, now).summary.drivers;
  assert.ok(d.find((x) => x.label === 'US inflation data').now < 0);
  assert.ok(d.find((x) => x.label === 'US growth data').now > 0);
});

test('cross prices are derived from the USD legs', async () => {
  const { makePriceSource } = await import('../sources/prices.js');
  const t = 1;
  const legs = { EUR: [{ t, c: 1.125 }], GBP: [{ t, c: 1.324 }], CHF: [{ t, c: 0.8288 }], JPY: [{ t, c: 157.9 }] };
  const price = makePriceSource({ legs, instruments: { XAUUSD: [{ t, c: 4140 }] }, sources: { XAUUSD: 'XAU/USD' } });
  near(price({ base: 'EUR', quote: 'GBP' })[0].c, 1.125 / 1.324, 1e-5);
  near(price({ base: 'GBP', quote: 'CHF' })[0].c, 1.324 * 0.8288, 1e-4);
  near(price({ base: 'CHF', quote: 'JPY' })[0].c, 157.9 / 0.8288, 1e-2);
  near(price({ base: 'USD', quote: 'CHF' })[0].c, 0.8288, 1e-6);
  near(price({ id: 'XAUUSD', base: 'XAU', quote: 'USD', kind: 'metal', drivers: [] })[0].c, 4140, 1e-6);
  assert.equal(price.symbolOf({ id: 'XAUUSD', drivers: [] }), 'XAU/USD');
  assert.deepEqual(price({ base: 'AUD', quote: 'NZD' }), [], 'missing legs give no prices');
});

test('gold moves opposite to US data and ignores everything else', async () => {
  const { INSTRUMENTS } = await import('../config.js');
  const now = Date.parse('2026-10-03T00:00:00Z');
  const gold = INSTRUMENTS.find((p) => p.id === 'XAUUSD');
  const ev = (o) => ({ dir: 1, weight: 3, halfLife: 72, skip: false, isRate: false, impact: 'High', forecastRaw: '', previousRaw: '', ...o });
  const events = [
    ev({ id: 'u', title: 'NFP', currency: 'USD', time: new Date(now - 3600e3).toISOString(), forecast: 89e3, actual: 150e3, previous: 162e3 }),
    ev({ id: 'e', title: 'CPI', currency: 'EUR', time: new Date(now - 3600e3).toISOString(), forecast: 2, actual: 3, previous: 2 }),
  ];
  const out = computePair(gold, events, { 'USD|NFP': { n: 10, sigma: 50e3 } }, now);
  assert.ok(out.summary.score < 0, 'strong US data is bearish for gold');
  assert.deepEqual(out.events.map((e) => e.id), ['u']);
});

test('consensus path: expectations build up before a release, surprises land at it', () => {
  const now = Date.parse('2026-10-03T00:00:00Z');
  const H = 3600e3;
  const pair = { id: 'EURUSD', symbol: 'EUR/USD', base: 'EUR', quote: 'USD' };
  const ev = (o) => ({ title: 'CPI y/y', currency: 'EUR', dir: 1, weight: 3, halfLife: 72, skip: false, isRate: false, impact: 'High', forecastRaw: '3.7%', previousRaw: '3.3%', forecast: 3.7, previous: 3.3, actual: null, ...o });
  const stats = { 'EUR|CPI y/y': { n: 10, sigma: 0.2 } };
  const at = (out, h) => out.series.find((p) => p.t === now + h * H);

  // Upcoming EUR CPI expected to rise: (3.7 - 3.3) / 0.2 = 2, x 0.5 consensus weight = 1 -> +3 in full.
  // It builds up over the L hours before the release: 0 before that, half at L/2, all of it at release.
  const L = MODEL.expectationLeadHours;
  const future = computePair(pair, [ev({ id: 'f', time: new Date(now + 48 * H).toISOString() })], stats, now);
  assert.equal(at(future, 48 - L - 8).s, 0, 'nothing before the build-up starts');
  near(at(future, 48 - L / 2).s, toScore(3 / 2), 0.1);
  near(at(future, 48).s, toScore(3), 0.1);
  assert.ok(at(future, 48 - L + 2).s < at(future, 47).s, 'rises steadily into the release');
  assert.equal(at(future, 49).top[0].x, 1, 'tooltip marks it as expected');
  assert.equal(future.events[0].ec, 3);
  assert.equal(future.events[0].c, null);
  near(future.summary.path.score, at(future, 7 * 24).s, 0);

  // Released 2 h ago, no actual yet -> counted as if it came in at forecast
  const time = new Date(now - 2 * H).toISOString();
  const pending = computePair(pair, [ev({ id: 'p', time })], stats, now);
  assert.ok(at(pending, 0).s > 0);
  assert.equal(pending.summary.assumed, 1);
  assert.equal(pending.events[0].as, true);
  // …and still counted a week later (it fades, it isn't dropped)
  const old = computePair(pair, [ev({ id: 'p', time: new Date(now - 9 * 24 * H).toISOString() })], stats, now);
  assert.ok(at(old, 0).s > 0);
  // in its first hour it's still provisional
  const fresh = computePair(pair, [ev({ id: 'p', time: new Date(now - 0.5 * H).toISOString() })], stats, now);
  assert.equal(fresh.summary.provisional, 1);
  assert.equal(fresh.events[0].prov, true);

  // In-line print: lands exactly where the expectation had it, no jump at the release
  const inline = computePair(pair, [ev({ id: 'p', time, actual: 3.7, actualRaw: '3.7%' })], stats, now);
  near(at(inline, 0).s, at(pending, 0).s, 0.01);
  near(at(inline, -2).s, at(inline, -3).s + (at(inline, -3).s - at(inline, -4).s), 0.5);
  assert.equal(inline.summary.provisional, 0);
  assert.equal(inline.events[0].c, 0, 'no surprise, no push at release');

  // Big miss (3.4 vs 3.7): the release pushes DOWN even though CPI rose from 3.3
  const miss = computePair(pair, [ev({ id: 'p', time, actual: 3.4, actualRaw: '3.4%' })], stats, now);
  assert.ok(at(miss, -2).s < at(miss, -3).s, 'the score drops at the release');
  near(miss.events[0].c, 3 * -1.5, 0.01, 'push = the surprise alone');
  near(miss.events[0].z, -1.5, 0.01);
  assert.ok(at(miss, 0).s < 0, 'net: the miss outweighs the expected rise');

  // Scenario size and currency strength
  assert.equal(future.events[0].sc, 3);
  assert.ok(at(future, 49).b > 0);
  assert.equal(at(future, 49).q, 0);
});

test('every released surprise pushes the way it beat or missed', async () => {
  const { classify } = await import('../lib/parse.js');
  const now = Date.parse('2026-10-03T00:00:00Z');
  const pair = { id: 'USDCAD', symbol: 'USD/CAD', base: 'USD', quote: 'CAD' };
  // The case that looked reversed: NFP beat (118K vs 89K) while the forecast was far below
  // the previous 162K. It must push USD/CAD UP at the release.
  const nfp = { id: 'n', title: 'Non-Farm Employment Change', currency: 'USD', impact: 'High', halfLife: 72, time: new Date(now - 3600e3).toISOString(), forecast: 89e3, previous: 162e3, actual: 118e3, forecastRaw: '89K', previousRaw: '162K', actualRaw: '118K', ...classify('Non-Farm Employment Change', 'High') };
  const out = computePair(pair, [nfp], { 'USD|Non-Farm Employment Change': { n: 10, sigma: 50e3 } }, now);
  assert.ok(out.events[0].c > 0, 'push is positive for USD/CAD');
  const before = out.series.find((p) => p.t === now - 2 * 3600e3).s;
  const after = out.series.find((p) => p.t === now - 3600e3).s;
  assert.ok(after > before, `score jumps up at the release (${before} -> ${after})`);
  // The score is still slightly negative (jobs growth was expected to slow from 162K), so this
  // positive surprise must not be named as the reason the market leans bearish.
  assert.ok(out.summary.score < 0);
  assert.equal(out.summary.driver, null);
});

test('direction sanity: each market reacts the way a trader would expect', async () => {
  const { PAIRS } = await import('../config.js');
  const { classify } = await import('../lib/parse.js');
  const P = Object.fromEntries(PAIRS.map((p) => [p.id, p]));
  const now = Date.parse('2026-10-03T00:00:00Z');
  const ago = new Date(now - 3600e3).toISOString();
  // a release that beats its forecast by a clear margin, with the forecast equal to previous
  const beat = (currency, title, impact = 'High', f = 1, a = 2) => ({
    id: `${currency}-${title}`, title, currency, impact, time: ago, halfLife: 72,
    forecast: f, previous: f, actual: a, forecastRaw: String(f), previousRaw: String(f), ...classify(title, impact),
  });
  const s = (id, ev) => computePair(P[id], [ev], {}, now).summary.score;
  const up = (id, ev, why) => assert.ok(s(id, ev) > 0, `${id} should rise: ${why} (got ${s(id, ev)})`);
  const down = (id, ev, why) => assert.ok(s(id, ev) < 0, `${id} should fall: ${why} (got ${s(id, ev)})`);
  const flat = (id, ev, why) => assert.equal(s(id, ev), 0, `${id} should ignore it: ${why}`);

  const usCpi = beat('USD', 'CPI m/m');
  down('EURUSD', usCpi, 'hot US inflation lifts the dollar');
  up('USDJPY', usCpi, 'dollar is the base');
  down('XAUUSD', usCpi, 'stronger dollar weighs on gold');
  down('US500', usCpi, 'hot inflation means higher yields');
  assert.ok(s('NAS100', usCpi) < s('US30', usCpi), 'Nasdaq hit harder than the Dow');

  const nfp = beat('USD', 'Non-Farm Employment Change', 'High', 100, 250);
  down('GBPUSD', nfp, 'strong US jobs lift the dollar');
  up('US500', nfp, 'strong jobs are mildly good for stocks');

  const usClaims = beat('USD', 'Unemployment Claims', 'Medium', 200, 260);
  up('EURUSD', usClaims, 'more jobless claims is bad for the dollar');

  up('EURUSD', beat('EUR', 'CPI Flash Estimate y/y'), 'hot euro inflation lifts the euro');
  up('EURGBP', beat('EUR', 'CPI Flash Estimate y/y'), 'euro is the base');
  down('USDJPY', beat('JPY', 'Tokyo Core CPI y/y'), 'yen is the quote');
  up('AUDUSD', beat('AUD', 'Cash Rate', 'High', 4.35, 4.6), 'surprise RBA hike lifts the aussie');

  const chinaPmi = beat('CNY', 'Manufacturing PMI', 'Low', 50, 52);
  up('COPPER', chinaPmi, 'Chinese factory demand');
  up('USOIL', chinaPmi, 'Chinese demand');
  up('XAGUSD', chinaPmi, 'industrial demand');
  flat('EURUSD', chinaPmi, 'FX pairs ignore China');
  flat('US500', chinaPmi, 'not in the index profile');

  down('USOIL', beat('USD', 'Crude Oil Inventories', 'Low', -1, 4), 'surprise build means weak demand');
  flat('EURUSD', beat('USD', 'Crude Oil Inventories', 'Low', -1, 4), 'FX ignores inventories');
  flat('EURUSD', beat('USD', 'FOMC Member Waller Speaks', 'Medium'), 'speeches have no number');
});

test('bias checker: combines released news and forecasts over the next 7 days', async () => {
  const { biasCheck, strengthTier } = await import('../lib/score.js');
  const now = Date.parse('2026-10-03T00:00:00Z');
  const H = 3600e3;
  const pair = { id: 'EURUSD', symbol: 'EUR/USD', base: 'EUR', quote: 'USD' };
  const ev = (o) => ({ dir: 1, weight: 3, halfLife: 72, skip: false, isRate: false, impact: 'High', forecastRaw: '', previousRaw: '', ...o });
  const stats = { 'EUR|CPI': { n: 10, sigma: 0.2 }, 'USD|NFP': { n: 10, sigma: 50e3 } };
  // EUR CPI beat yesterday (bullish EUR/USD), weak US jobs expected in 3 days (also bullish)
  const events = [
    ev({ id: 'a', title: 'CPI', currency: 'EUR', time: new Date(now - 24 * H).toISOString(), forecast: 2.5, previous: 2.5, actual: 2.9 }),
    ev({ id: 'b', title: 'NFP', currency: 'USD', time: new Date(now + 72 * H).toISOString(), forecast: 50e3, previous: 150e3, actual: null }),
  ];
  const out = computePair(pair, events, stats, now);
  const c = out.summary.check;
  // the score is the average of the projected path's total, squashed
  const nowHour = Math.floor(now / H) * H;
  const ahead = out.series.filter((p) => p.t >= nowHour);
  const avgR = ahead.reduce((a, p) => a + p.r, 0) / ahead.length;
  near(c.score, toScore(avgR), 0.2);
  assert.ok(c.past > 0 && c.up > 0, 'both parts favour EUR/USD');
  assert.ok(c.share > 0.5 && c.share < 1);
  assert.equal(c.tier, strengthTier(c.score));
  assert.ok(c.min <= out.summary.score && c.max >= out.summary.score);

  // opposite parts net out
  const mixed = computePair(pair, [events[0], { ...events[1], forecast: 250e3 }], stats, now).summary.check;
  assert.ok(mixed.up < 0 && mixed.past > 0 && Math.abs(mixed.score) < Math.abs(c.score));

  // nothing at all
  assert.equal(computePair(pair, [], stats, now).summary.check.share, null);
  assert.equal(biasCheck({ past: 0, up: 0, n: 0, scores: [] }), null);
  assert.deepEqual(['None', 'Weak', 'Moderate', 'Strong'], [5, -20, 55, -80].map(strengthTier));
});

// ---------------------------------------------------------------------------------------------
// Economic calendar (api/calendar.js and public/data/calendar.json)

import { compareValues, judge } from '../lib/values.js';
import { kindOf, liveCalendar, savedCalendar } from '../lib/calendar.js';

test('calendar values: compared only when they are the same kind of number', () => {
  assert.equal(compareValues('0.4%', '0.3%'), 1);
  assert.equal(compareValues('201K', '0.25M'), -1);
  assert.equal(compareValues('54.8', '54.8'), 0);
  assert.equal(compareValues('0.3%', '54.8'), null);
  assert.equal(compareValues('', '0.3%'), null);
});

test('calendar verdicts: better or worse for the currency, lower is better for jobless data', () => {
  // inflation above forecast: better than expected for the currency
  assert.deepEqual(judge({ a: '0.4%', f: '0.3%', p: '0.2%', dir: 1 }), { vs: 1, beat: 1, trend: 1, lean: 1 });
  // unemployment above forecast: worse; a forecast rise would weigh on it
  assert.deepEqual(judge({ a: '4.4%', f: '4.3%', p: '4.2%', dir: -1 }), { vs: 1, beat: -1, trend: 1, lean: -1 });
  // in line
  assert.equal(judge({ a: '150K', f: '150K', dir: 1 }).beat, 0);
  // risk-only releases get the comparison but no verdict
  assert.deepEqual(judge({ a: '3.1M', f: '-1.2M', p: '0.5M', dir: 1, skip: true }), { vs: 1, beat: null, trend: -1, lean: null });
});

test('calendar kinds', () => {
  const k = (title, impact) => kindOf({ title, impact, ...classify(title, impact) });
  assert.equal(k('Bank Holiday', 'Holiday'), 'holiday');
  assert.equal(k('Cash Rate', 'High'), 'rate');
  assert.equal(k('ECB President Lagarde Speaks', 'Medium'), 'speech');
  assert.equal(k('FOMC Meeting Minutes', 'High'), 'other');
  assert.equal(k('CPI m/m', 'High'), 'data');
});

test('live calendar: every country, actuals from the next listing, ids shared with the hourly job', async () => {
  const week1 = [
    { title: 'Unemployment Claims', country: 'USD', date: '2026-10-01T08:30:00-04:00', impact: 'High', forecast: '220K', previous: '218K' },
    { title: 'OPEC-JMMC Meetings', country: 'All', date: '2026-10-02T05:15:00-04:00', impact: 'Medium', forecast: '', previous: '' },
  ];
  const week2 = [
    { title: 'Unemployment Claims', country: 'USD', date: '2026-10-08T08:30:00-04:00', impact: 'High', forecast: '225K', previous: '231K' },
  ];
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => ({ ok: true, json: async () => (String(url).includes('nextweek') ? week2 : week1) });
  try {
    const cal = await liveCalendar({ nowMs: Date.parse('2026-10-03T00:00:00Z') });
    assert.equal(cal.live, true);
    assert.equal(cal.events.length, 3);
    const [claims, opec, next] = cal.events;
    assert.equal(opec.ccy, 'All');
    assert.equal(claims.a, '231K');
    // 231K against a 220K forecast: more claims than expected is worse for the dollar
    assert.equal(claims.beat, -1);
    assert.equal(next.a, null);
    // the same id the hourly job gives the release, so its saved actual values can be matched
    const [stored] = normalise(week1);
    assert.equal(claims.id, stored.id);
  } finally {
    globalThis.fetch = real;
  }
});

test('saved calendar starts at the beginning of the current week', () => {
  const ev = (time) => ({ ...normalise([{ title: 'CPI m/m', country: 'USD', date: time, impact: 'High', forecast: '0.3%', previous: '0.2%' }])[0], actualRaw: null });
  const now = Date.parse('2026-10-07T12:00:00Z'); // a Wednesday
  const cal = savedCalendar([ev('2026-09-30T08:30:00-04:00'), ev('2026-10-05T08:30:00-04:00'), ev('2026-10-12T08:30:00-04:00')], { nowMs: now, demo: false, source: 'test' });
  assert.deepEqual(cal.events.map((e) => e.t.slice(0, 10)), ['2026-10-05', '2026-10-12']);
  assert.equal(cal.live, false);
});


test('Apify fills released values from ForexFactory, sparingly and without exposing the token', async () => {
  const [ism, ivey, low] = normalise([
    { title: 'ISM Services PMI', country: 'USD', date: '2026-10-05T10:00:00-04:00', impact: 'Medium', forecast: '55.1', previous: '55.4' },
    { title: 'Ivey PMI', country: 'CAD', date: '2026-10-06T10:00:00-04:00', impact: 'Medium', forecast: '65.2', previous: '64.3' },
    { title: 'Final Services PMI', country: 'USD', date: '2026-10-05T09:45:00-04:00', impact: 'Low', forecast: '58.7', previous: '58.7' },
  ]);
  const store = Object.fromEntries([ism, ivey, low].map((e) => [e.id, e]));
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), auth: init.headers?.Authorization, body: init.body ? JSON.parse(init.body) : null });
    if (String(url).endsWith('/users/me/limits')) return { ok: true, json: async () => ({ data: { limits: { maxMonthlyUsageUsd: 5 }, current: { monthlyUsageUsd: 1.2 } } }) };
    const { day } = JSON.parse(init.body);
    const items = {
      '2026-10-05': [{ title: 'ISM Services PMI', currency: 'USD', datetimeISO: '2026-10-05T14:00:00Z', actual: '54.9', forecast: '55.1', previous: '55.4' }],
      '2026-10-06': [{ title: 'Ivey PMI', currency: 'CAD', datetimeISO: '2026-10-06T14:00:00Z', actual: '58.2', forecast: '65.2', previous: '64.3' }],
    }[day];
    return { ok: true, status: 201, json: async () => items ?? [] };
  };
  try {
    const r = await fillFromApify(store, Date.parse('2026-10-06T20:00:00Z'), { token: 'SECRET' });
    assert.equal(r.filled, 2);
    assert.equal(ism.actualRaw, '54.9');
    assert.equal(ivey.actualRaw, '58.2');
    assert.equal(ivey.actualSource, 'forexfactory');
    // Low impact isn't worth a paid run
    assert.equal(low.apifyTries, undefined);
    const runs = calls.filter((c) => c.body);
    assert.equal(runs.length, 2);
    assert.deepEqual(runs.map((c) => c.body.currencies), [['USD'], ['CAD']]);
    assert.ok(runs.every((c) => c.body.minImpact === 'medium' && c.body.dateRange === 'day'));
    assert.ok(calls.every((c) => !c.url.includes('SECRET') && c.auth === 'Bearer SECRET'));
    assert.equal(r.used, 1.2);
  } finally {
    globalThis.fetch = real;
  }
});

test('Apify pauses when the month\'s credit is nearly used', async () => {
  const [e] = normalise([{ title: 'Ivey PMI', country: 'CAD', date: '2026-10-06T10:00:00-04:00', impact: 'Medium', forecast: '65.2', previous: '64.3' }]);
  let runs = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/users/me/limits')) return { ok: true, json: async () => ({ data: { limits: { maxMonthlyUsageUsd: 5 }, current: { monthlyUsageUsd: 4.9 } } }) };
    runs++;
    return { ok: true, json: async () => [] };
  };
  try {
    const r = await fillFromApify({ [e.id]: e }, Date.parse('2026-10-06T20:00:00Z'), { token: 't' });
    assert.equal(runs, 0);
    assert.match(r.paused, /nearly used/);
  } finally {
    globalThis.fetch = real;
  }
});

test('Apify: a page ForexFactory blocks is tried once more, then reported, and the try counts', async () => {
  const [e] = normalise([{ title: 'Ivey PMI', country: 'CAD', date: '2026-10-06T10:00:00-04:00', impact: 'Medium', forecast: '65.2', previous: '64.3' }]);
  let runs = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).endsWith('/users/me/limits')) return { ok: true, json: async () => ({ data: { limits: { maxMonthlyUsageUsd: 5 }, current: { monthlyUsageUsd: 0.1 } } }) };
    runs++;
    assert.deepEqual(JSON.parse(init.body).proxyConfiguration.apifyProxyGroups, ['RESIDENTIAL']);
    return { ok: true, json: async () => [{ _input: 'day=oct6.2026', _error: 'http_403' }] };
  };
  try {
    await assert.rejects(fillFromApify({ [e.id]: e }, Date.parse('2026-10-06T20:00:00Z'), { token: 't' }), /bot protection/);
    assert.equal(runs, 2);
    assert.equal(e.apifyTries, 1);
  } finally {
    globalThis.fetch = real;
  }
});

test('JBlanked fills released values: exact names, plain numbers scaled to our format, the key in a header', async () => {
  const [ism, nfp, claims] = normalise([
    { title: 'ISM Services PMI', country: 'USD', date: '2026-10-05T10:00:00-04:00', impact: 'Medium', forecast: '55.1', previous: '55.4' },
    { title: 'Non-Farm Employment Change', country: 'USD', date: '2026-10-02T08:30:00-04:00', impact: 'High', forecast: '150K', previous: '22K' },
    { title: 'Unemployment Claims', country: 'USD', date: '2026-10-01T08:30:00-04:00', impact: 'High', forecast: '225K', previous: '231K' },
  ]);
  const store = Object.fromEntries([ism, nfp, claims].map((e) => [e.id, e]));
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), auth: init.headers.Authorization });
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify([
          // times three hours off (another zone) still match on name and currency
          { Name: 'ISM Services PMI', Currency: 'USD', Date: '2026.10.05 17:00:00', Actual: 54.9, Forecast: 55.1, Previous: 55.4 },
          { Name: 'Non-Farm Employment Change', Currency: 'USD', Date: '2026.10.02 15:30:00', Actual: 119000, Forecast: 150000, Previous: 22000 },
          { Name: 'Unemployment Claims', Currency: 'EUR', Date: '2026.10.01 15:30:00', Actual: 240000, Forecast: 225000, Previous: 231000 },
        ]),
    };
  };
  try {
    const r = await fillFromJBlanked(store, Date.parse('2026-10-06T20:00:00Z'), { apiKey: 'KEY', isDriver: () => false });
    assert.equal(r.filled, 2);
    assert.equal(ism.actualRaw, '54.9');
    assert.equal(nfp.actualRaw, '119K');
    assert.equal(nfp.actual, 119000);
    assert.ok(claims.actual == null, 'another currency must not fill it');
    assert.ok(calls.every((c) => c.auth === 'Api-Key KEY' && !c.url.includes('KEY')));
  } finally {
    globalThis.fetch = real;
  }
});

test('official statistics: values from the release itself, never the one before', async () => {
  const [nfp, ukCpi, auUnemp] = normalise([
    { title: 'Non-Farm Employment Change', country: 'USD', date: '2026-10-02T08:30:00-04:00', impact: 'High', forecast: '150K', previous: '22K' },
    { title: 'CPI y/y', country: 'GBP', date: '2026-10-21T07:00:00+01:00', impact: 'High', forecast: '3.0%', previous: '3.1%' },
    { title: 'Unemployment Rate', country: 'AUD', date: '2026-10-16T11:30:00+11:00', impact: 'High', forecast: '4.6%', previous: '4.6%' },
  ]);
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    const ok = (body) => ({ ok: true, status: 200, json: async () => body });
    // FRED: updated minutes after the release, payrolls in thousands
    if (u.includes('/fred/series?')) return ok({ seriess: [{ last_updated: '2026-10-02 07:35:10-05' }] }); // also the key check
    if (u.includes('/fred/series/observations')) return ok({ observations: [{ date: '2026-09-01', value: '159650' }, { date: '2026-08-01', value: '159531' }] });
    // ONS: still on the September release, so October's isn't out yet
    if (u.includes('ons.gov.uk')) return ok({ months: [{ date: '2026 AUG', value: '3.1' }], description: { releaseDate: '2026-09-15T23:00:00.000Z' } });
    // ABS: the latest period is August, but an October release reports September
    if (u.includes('abs.gov.au'))
      return ok({ data: { structures: [{ dimensions: { observation: [{ values: [{ id: '2026-08' }] }] } }], dataSets: [{ series: { '0:0': { observations: { 0: [4.646] } } } }] } });
    throw new Error(`unexpected ${u}`);
  };
  try {
    const us = await fillFromOfficial({ [nfp.id]: nfp }, Date.parse('2026-10-02T14:00:00Z'), { fredKey: 'K', isDriver: () => false });
    assert.equal(nfp.actualRaw, '119K');
    assert.equal(nfp.actualSource, 'official');
    assert.equal(us.filled, 1);
    const later = await fillFromOfficial({ [ukCpi.id]: ukCpi, [auUnemp.id]: auUnemp }, Date.parse('2026-10-22T12:00:00Z'), { fredKey: 'K', isDriver: () => false });
    assert.ok(ukCpi.actual == null, 'last month\'s CPI must not fill this month\'s release');
    assert.ok(auUnemp.actual == null, 'August data must not fill the September release');
    assert.equal(later.waiting, 2);
  } finally {
    globalThis.fetch = real;
  }
});

test('official statistics: numbers written in the calendar\'s own unit and decimals', () => {
  const e = (f, p) => ({ forecastRaw: f, previousRaw: p });
  assert.equal(formatLike(e('10.0K', '-40.8K'), -41700), '-41.7K');
  assert.equal(formatLike(e('1.5B', '0.8B'), 4198.8e6), '4.2B');
  assert.equal(formatLike(e('0.1%', '0.5%'), -0.0588), '-0.1%');
  assert.equal(formatLike(e('0.1%', '0.4%'), -0.0048), '0.0%');
  assert.equal(formatLike(e('225K', '231K'), 241000), '241K');
});
