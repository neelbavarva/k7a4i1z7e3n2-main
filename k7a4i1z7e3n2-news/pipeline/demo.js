#!/usr/bin/env node
// Writes SAMPLE data to public/data so the website can be previewed before the
// real pipeline has collected history. Uses the saved real calendar week as a
// template, repeats it across the last 5 weeks and next week, and invents actual
// values (seeded per release, so they never reshuffle) and prices. The site shows a "Demo data" banner.
// It never touches data/ (the real pipeline state).

import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { INSTRUMENTS, PRICE_LEGS, RETENTION } from './config.js';
import { makePriceSource } from './sources/prices.js';
import { normalise } from './sources/calendar.js';
import { eventId, unitOf } from './lib/parse.js';
import { sigmaFor } from './lib/score.js';
import { writeOutputs } from './lib/output.js';
import { ROOT, log } from './lib/store.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

// Small deterministic PRNG (mulberry32) + Box-Muller normal.
function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(next() || 1e-12)) * Math.cos(2 * Math.PI * next());
  return { next, normal };
}

// Seed from a string (FNV-1a), so each sample release always gets the same made-up
// actual value, however many other events exist or how often the data is refreshed.
const seedOf = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

function formatLike(value, raw) {
  const unit = unitOf(raw);
  const div = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[unit] ?? 1;
  const decimals = (String(raw).split('|')[0].match(/\.(\d+)/)?.[1].length) ?? 0;
  return (value / div).toFixed(decimals) + unit;
}

const startOfWeek = (ms) => {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - d.getUTCDay() * DAY;
};

async function main() {
  const nowMs = Date.now();
  const template = normalise(JSON.parse(await readFile(join(ROOT, 'pipeline', 'fixtures', 'ff_calendar_thisweek.json'), 'utf8')));
  const tmplWeek = startOfWeek(Math.min(...template.map((e) => Date.parse(e.time))));
  const shift0 = Math.round((startOfWeek(nowMs) - tmplWeek) / WEEK);

  const events = {};
  for (let w = -5; w <= 1; w++) {
    for (const e of template) {
      if (e.isRate && w !== 0) continue; // a rate decision every week would be silly
      const time = new Date(Date.parse(e.time) + (shift0 + w) * WEEK).toISOString();
      const ev = { ...e, time, id: eventId(e.title, e.currency, time), actual: null, actualRaw: null, actualSource: null };
      if (Date.parse(time) < nowMs && e.forecast != null && !e.skip) {
        const sigma = sigmaFor(ev, {});
        const v = e.forecast + rng(seedOf(ev.id)).normal() * sigma * 0.9;
        ev.actualRaw = formatLike(v, e.forecastRaw);
        ev.actual = Number.parseFloat(ev.actualRaw) * ({ K: 1e3, M: 1e6, B: 1e9 }[unitOf(e.forecastRaw)] ?? 1);
        ev.actualSource = 'demo';
      }
      events[ev.id] = ev;
    }
  }

  // Random-walk the FX legs as quoted (EUR/USD, USD/JPY…) and each instrument's first
  // price symbol; FX crosses are derived from the legs, as in the real pipeline.
  const levels = { EUR: 1.1253, GBP: 1.3241, AUD: 0.6957, NZD: 0.5614, CAD: 1.425, CHF: 0.8288, JPY: 157.9 };
  const instLevels = { XAUUSD: 4140.5, XAGUSD: 48.6, COPPER: 4.92, USOIL: 61.8, US500: 668.4, NAS100: 598.2, US30: 463.9 };
  const instVol = { XAUUSD: 0.0018, XAGUSD: 0.003, COPPER: 0.0025, USOIL: 0.004, US500: 0.0015, NAS100: 0.002, US30: 0.0013 };
  const end = Math.floor(nowMs / HOUR) * HOUR;
  const walk = (key, start, vol) => {
    const r = rng(seedOf(`price:${key}`));
    let c = start;
    const out = [];
    for (let t = end - RETENTION.pricesDays * DAY; t <= end; t += HOUR) {
      c *= 1 + r.normal() * vol;
      out.push({ t, c: Number(c.toPrecision(6)) });
    }
    return out;
  };
  const legs = Object.fromEntries(Object.keys(PRICE_LEGS).map((ccy) => [ccy, walk(ccy, levels[ccy], 0.0009)]));
  const instruments = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, walk(i.id, instLevels[i.id], instVol[i.id])]));
  const sources = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i.price[0]]));

  const meta = await writeOutputs({
    events,
    nowMs,
    pricesFor: makePriceSource({ legs, instruments, sources }),
    demo: true,
    sources: { calendar: 'ForexFactory sample week (repeated)', actuals: ['demo'], prices: 'random walk (demo)' },
  });
  for (const p of meta.pairs) log(`demo score ${p.symbol.padEnd(8)} ${String(p.score).padStart(6)}  ${p.label}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
