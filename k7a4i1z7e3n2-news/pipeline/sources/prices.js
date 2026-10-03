import { join } from 'node:path';
import { INSTRUMENTS, PRICE_LEGS, PRICE_REQUEST_DELAY_MS, RETENTION } from '../config.js';
import { DATA_DIR, readJson, writeJson, log, sleep } from '../lib/store.js';

const DAY = 86400 * 1000;
const PRICES = join(DATA_DIR, 'prices');
const legFile = (symbol) => join(PRICES, `${symbol.replace('/', '')}.json`);
const instrumentFile = (id) => join(PRICES, `${id}.json`);
const SOURCES = join(PRICES, 'sources.json'); // which symbol each instrument's prices came from

async function fetchSeries(symbol, size, apiKey) {
  const url = new URL('https://api.twelvedata.com/time_series');
  url.search = new URLSearchParams({ symbol, interval: '1h', outputsize: String(size), timezone: 'UTC', apikey: apiKey });
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(data.message || 'bad response');
  return data.values.map((v) => ({ t: Date.parse(v.datetime.replace(' ', 'T') + 'Z'), c: Number(v.close) }));
}

async function mergeInto(path, fresh, nowMs) {
  const stored = await readJson(path, []);
  const merged = new Map(stored.map((p) => [p.t, p]));
  for (const p of fresh) merged.set(p.t, p);
  const cutoff = nowMs - RETENTION.pricesDays * DAY;
  await writeJson(path, [...merged.values()].filter((p) => p.t >= cutoff).sort((a, b) => a.t - b.t));
}

/**
 * Hourly closes from Twelve Data. Free tier: 8 requests a minute and 800 a day, so we
 * pause between requests and fetch only 14 series (7 FX legs + 7 instruments).
 * Instruments try their symbols in order (spot first, a tracking fund as fallback) and
 * remember which one worked, so they don't switch back and forth.
 */
export async function syncPrices(nowMs, { apiKey, delayMs = PRICE_REQUEST_DELAY_MS }) {
  const sources = await readJson(SOURCES, {});
  let ok = 0;
  let calls = 0;
  const wait = async () => {
    if (calls++ > 0) await sleep(delayMs);
  };

  for (const { symbol } of Object.values(PRICE_LEGS)) {
    await wait();
    const path = legFile(symbol);
    try {
      const size = (await readJson(path, [])).length ? 72 : RETENTION.pricesDays * 24;
      await mergeInto(path, await fetchSeries(symbol, size, apiKey), nowMs);
      ok++;
    } catch (err) {
      log(`prices: ${symbol} failed: ${err.message}`);
    }
  }

  for (const inst of INSTRUMENTS) {
    const path = instrumentFile(inst.id);
    const known = sources[inst.id];
    const order = known ? [known, ...inst.price.filter((s) => s !== known)] : inst.price;
    let done = false;
    for (const symbol of order) {
      await wait();
      try {
        const switching = known && symbol !== known;
        const stored = switching ? [] : await readJson(path, []);
        const size = stored.length ? 72 : RETENTION.pricesDays * 24;
        const fresh = await fetchSeries(symbol, size, apiKey);
        if (switching) await writeJson(path, []); // different scale: don't mix with the old symbol
        await mergeInto(path, fresh, nowMs);
        sources[inst.id] = symbol;
        done = true;
        ok++;
        break;
      } catch (err) {
        log(`prices: ${inst.id} via ${symbol} failed: ${err.message}`);
      }
    }
    if (!done) log(`prices: no price source worked for ${inst.id}`);
  }
  await writeJson(SOURCES, sources, { pretty: true });
  log(`prices: updated ${ok}/${Object.keys(PRICE_LEGS).length + INSTRUMENTS.length} series`);
}

/** Reads everything stored: FX legs as quoted, instrument series and their symbols. */
export async function loadLegs() {
  const legs = {};
  for (const [ccy, { symbol }] of Object.entries(PRICE_LEGS)) legs[ccy] = await readJson(legFile(symbol), []);
  const instruments = {};
  for (const inst of INSTRUMENTS) instruments[inst.id] = await readJson(instrumentFile(inst.id), []);
  return { legs, instruments, sources: await readJson(SOURCES, {}) };
}

/**
 * Builds the price lookup used when writing the site's JSON.
 * FX: each leg becomes "USD per 1 unit of the currency"; a pair is usd(base) / usd(quote).
 * Instruments: their own downloaded series. `symbolOf(pair)` says where prices came from.
 */
export function makePriceSource({ legs = {}, instruments = {}, sources = {} } = {}) {
  const usdValue = {};
  for (const [ccy, series] of Object.entries(legs)) {
    const invert = PRICE_LEGS[ccy]?.invert;
    usdValue[ccy] = new Map(series.map((p) => [p.t, invert ? 1 / p.c : p.c]));
  }
  const priceOf = (pair) => {
    if (pair.drivers || pair.kind && pair.kind !== 'fx') return instruments[pair.id] ?? [];
    const b = pair.base === 'USD' ? null : usdValue[pair.base];
    const q = pair.quote === 'USD' ? null : usdValue[pair.quote];
    if ((pair.base !== 'USD' && !b?.size) || (pair.quote !== 'USD' && !q?.size)) return [];
    const times = [...(b ?? q).keys()].sort((x, y) => x - y);
    const out = [];
    for (const t of times) {
      const bv = b ? b.get(t) : 1;
      const qv = q ? q.get(t) : 1;
      if (bv == null || qv == null) continue;
      out.push({ t, c: Number((bv / qv).toPrecision(6)) });
    }
    return out;
  };
  priceOf.symbolOf = (pair) => (pair.drivers ? sources[pair.id] ?? null : pair.symbol);
  return priceOf;
}
