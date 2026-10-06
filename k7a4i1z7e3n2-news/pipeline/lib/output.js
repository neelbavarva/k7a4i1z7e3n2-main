import { join } from 'node:path';
import { PAIRS, MODEL, publicPair } from '../config.js';
import { buildSurpriseStats, computePair } from './score.js';
import { savedCalendar } from './calendar.js';
import { PUBLIC_DATA_DIR, writeJson } from './store.js';

const HOUR = 3600 * 1000;

/**
 * Scores every pair and writes the static JSON the website reads:
 *   public/data/meta.json         - pair list with headline scores
 *   public/data/pairs/<ID>.json   - series, prices, events, summary
 *   public/data/calendar.json     - this week's releases with their actual values (Calendar page)
 */
export async function writeOutputs({ events, nowMs, pricesFor, demo = false, sources = {}, report = null }) {
  const list = Object.values(events);
  const stats = buildSurpriseStats(list);
  // the calendar feed only ever covers the current week, so nothing is known before the first
  // week the job collected; the chart marks that stretch instead of drawing a made-up zero
  const since = list.length ? Math.floor(Math.min(...list.map((e) => Date.parse(e.time))) / HOUR) * HOUR : nowMs;
  const meta = {
    generatedAt: new Date(nowMs).toISOString(),
    demo,
    since: new Date(since).toISOString(),
    sources,
    // how each step of this run went (pipeline/run.js); the live status panel reads it
    report,
    model: { K: MODEL.K, halfLifeHours: MODEL.halfLifeHours, historyDays: MODEL.historyDays, forwardDays: MODEL.forwardDays },
    counts: {
      events: list.length,
      released: list.filter((e) => Date.parse(e.time) <= nowMs && !e.skip && e.weight > 0).length,
      withActual: list.filter((e) => e.actual != null).length,
    },
    pairs: [],
  };
  for (const pair of PAIRS) {
    const result = computePair(pair, list, stats, nowMs);
    const first = result.series[0]?.t ?? nowMs;
    const prices = pricesFor(pair).filter((p) => p.t >= first - HOUR);
    await writeJson(join(PUBLIC_DATA_DIR, 'pairs', `${pair.id}.json`), {
      generatedAt: meta.generatedAt,
      demo,
      since,
      ...result,
      prices,
      priceSymbol: pricesFor.symbolOf?.(pair) ?? null,
    });
    const s = result.summary;
    meta.pairs.push({
      ...publicPair(pair),
      score: s.score,
      label: s.label,
      change24h: Math.round((s.score - (result.series.find((p) => p.t === Math.floor(nowMs / HOUR) * HOUR - 24 * HOUR)?.s ?? s.score)) * 10) / 10,
      next: s.next,
      // where the score is heading in 7 days if upcoming releases match their forecasts
      future: s.path.score,
      futureLabel: s.path.label,
    });
  }
  await writeJson(join(PUBLIC_DATA_DIR, 'calendar.json'), savedCalendar(list, { nowMs, demo, source: sources.calendar }));
  await writeJson(join(PUBLIC_DATA_DIR, 'meta.json'), meta, { pretty: true });
  return meta;
}
