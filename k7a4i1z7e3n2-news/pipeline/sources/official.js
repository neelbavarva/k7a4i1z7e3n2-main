// Released values straight from the statistics agencies that publish them: free, official, and
// out minutes after each release. Covers the big official figures (jobs, inflation, GDP, retail
// sales, trade) for the US (FRED, needs a free FRED_API_KEY), Canada (Statistics Canada), the UK
// (ONS) and Australia (ABS). Surveys such as PMIs and sentiment aren't published by agencies, so
// they're left to the other sources.
//
// Each figure is checked to come from the release in question before it's used: FRED and ONS say
// when the series was last published, Statistics Canada stamps every data point with its release
// time, and for the ABS the latest period must be the one this release reports.

import { parseValue, unitOf } from '../lib/parse.js';
import { log } from '../lib/store.js';
import { needsLookup, plausible } from './actuals.js';
import { AGENCY, OFFICIAL } from '../lib/official-series.js';

export { OFFICIAL };

const MIN = 60 * 1000;
const MULT = { '': 1, '%': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

const json = async (url, init = {}) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// ---------------------------------------------------------------------------------------------
// One reader per agency: { points: [{ period, value }] oldest first, publishedMs }

async function readFred(id, { fredKey }) {
  if (!fredKey) throw new Error('no FRED_API_KEY');
  const q = `series_id=${id}&api_key=${encodeURIComponent(fredKey)}&file_type=json`;
  const [info, obs] = await Promise.all([
    json(`https://api.stlouisfed.org/fred/series?${q}`),
    json(`https://api.stlouisfed.org/fred/series/observations?${q}&sort_order=desc&limit=15`),
  ]);
  // "2026-10-03 07:51:03-05" -> a time
  const updated = String(info.seriess?.[0]?.last_updated ?? '').replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  const points = (obs.observations ?? [])
    .filter((o) => o.value !== '.' && o.value !== '')
    .map((o) => ({ period: o.date, value: Number(o.value) }))
    .reverse();
  return { points, publishedMs: Date.parse(updated) };
}

async function readStatcan(ids) {
  const rows = await json('https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ids.map((vectorId) => ({ vectorId, latestN: 14 }))),
  });
  const out = new Map();
  for (const r of rows) {
    const o = r.object;
    if (!o) continue;
    const pts = (o.vectorDataPoint ?? []).map((p) => ({ period: p.refPer, value: Number(p.value), release: p.releaseTime }));
    // release times are Ottawa time without a zone: compare by date, which is all we need
    out.set(o.vectorId, { points: pts, releaseDay: pts.at(-1)?.release?.slice(0, 10) ?? null });
  }
  return out;
}

async function readOns(path) {
  const j = await json(`https://www.ons.gov.uk/${path}/data`, { headers: { 'User-Agent': 'fx-fundamental-bias (hourly, official data)' } });
  const list = j.months?.length ? j.months : j.quarters?.length ? j.quarters : j.years ?? [];
  return { points: list.map((p) => ({ period: p.date, value: Number(p.value) })), publishedMs: Date.parse(j.description?.releaseDate ?? '') };
}

async function readAbs(key) {
  const j = await json(`https://data.api.abs.gov.au/rest/data/${key}?detail=dataonly&lastNObservations=14`, {
    headers: { Accept: 'application/vnd.sdmx.data+json' },
  });
  const periods = j.data.structures[0].dimensions.observation[0].values;
  const series = Object.values(j.data.dataSets[0].series ?? {})[0];
  const points = Object.entries(series?.observations ?? {})
    .map(([i, v]) => ({ period: periods[i].id, value: Number(v[0]) }))
    .sort((a, b) => a.period.localeCompare(b.period));
  return { points };
}

// ---------------------------------------------------------------------------------------------

/** The period an ABS release reports: the month (or quarter) before the one it's published in. */
function absPeriodFor(timeMs, freq) {
  const d = new Date(timeMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0-11
  if (freq === 'Q') {
    const q = Math.floor(m / 3); // this quarter, 0-3
    return q === 0 ? `${y - 1}-Q4` : `${y}-Q${q}`;
  }
  return m === 0 ? `${y - 1}-12` : `${y}-${String(m).padStart(2, '0')}`;
}

/** The release's number from its series, or null if there isn't enough history. */
function compute(spec, points) {
  const v = points.map((p) => p.value);
  const n = v.length;
  if (!n || !Number.isFinite(v[n - 1])) return null;
  const back = (k) => (n > k && Number.isFinite(v[n - 1 - k]) ? v[n - 1 - k] : null);
  if (spec.calc === 'level') return v[n - 1] * spec.scale;
  if (spec.calc === 'diff') return back(1) == null ? null : (v[n - 1] - back(1)) * spec.scale;
  if (spec.calc === 'pct') return back(1) ? (v[n - 1] / back(1) - 1) * 100 : null;
  if (spec.calc === 'yoy') {
    const k = spec.freq === 'Q' ? 4 : 12;
    return back(k) ? (v[n - 1] / back(k) - 1) * 100 : null;
  }
  return null;
}

const decimalsOf = (raw) => String(raw ?? '').split('|')[0].match(/\.(\d+)/)?.[1].length ?? 0;

/** A plain number written like the calendar writes this release: same unit and decimals. */
export function formatLike(e, full) {
  const unit = unitOf(e.forecastRaw || e.previousRaw);
  const decimals = Math.max(decimalsOf(e.previousRaw), decimalsOf(e.forecastRaw));
  const shown = (full / MULT[unit]).toFixed(decimals);
  return `${shown === '-0' || /^-0\.0+$/.test(shown) ? shown.slice(1) : shown}${unit}`;
}

export async function fillFromOfficial(store, nowMs, { fredKey, isDriver }) {
  const todo = needsLookup(store, nowMs, isDriver).filter((e) => OFFICIAL[`${e.currency}|${e.title}`]);
  const out = { tried: todo.length, filled: 0, byAgency: {}, errors: {}, waiting: 0, skipped: {} };
  if (!todo.length) return out;

  // Statistics Canada answers many vectors in one request
  const scIds = [
    ...new Set(
      todo.flatMap((e) => {
        const s = OFFICIAL[`${e.currency}|${e.title}`];
        return s.agency === 'statcan' ? [s.id, ...(s.minus ? [s.minus] : [])] : [];
      }),
    ),
  ];
  let statcan = null;
  if (scIds.length) {
    try {
      statcan = await readStatcan(scIds);
    } catch (err) {
      out.errors.statcan = err.message;
    }
  }
  const cache = new Map();
  const read = (spec) => {
    const k = `${spec.agency}|${spec.id}`;
    if (!cache.has(k)) {
      cache.set(
        k,
        spec.agency === 'fred' ? readFred(spec.id, { fredKey }) : spec.agency === 'ons' ? readOns(spec.id) : readAbs(spec.id),
      );
    }
    return cache.get(k);
  };

  for (const e of todo) {
    const spec = OFFICIAL[`${e.currency}|${e.title}`];
    const t = Date.parse(e.time);
    const label = AGENCY[spec.agency].name;
    if (spec.agency === 'fred' && !fredKey) {
      out.skipped.fred = 'no FRED_API_KEY';
      continue;
    }
    try {
      let points;
      let fresh;
      if (spec.agency === 'statcan') {
        if (!statcan) continue;
        const s = statcan.get(spec.id);
        if (!s) throw new Error(`vector ${spec.id} not returned`);
        const releaseDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(t);
        fresh = s.releaseDay != null && s.releaseDay >= releaseDay;
        points = s.points;
        if (spec.minus) {
          const m = statcan.get(spec.minus);
          const byPeriod = new Map((m?.points ?? []).map((p) => [p.period, p.value]));
          points = points.filter((p) => byPeriod.has(p.period)).map((p) => ({ ...p, value: p.value - byPeriod.get(p.period) }));
        }
      } else {
        const r = await read(spec);
        points = r.points;
        fresh =
          spec.agency === 'abs'
            ? points.at(-1)?.period === absPeriodFor(t, spec.freq)
            : // FRED stamps the minute it updated; ONS gives only the release day, at midnight
              Number.isFinite(r.publishedMs) && r.publishedMs >= t - (spec.agency === 'fred' ? 10 : 12 * 60) * MIN;
      }
      if (!fresh) {
        out.waiting++;
        continue; // the agency hasn't published this release yet: try again next run
      }
      const full = compute(spec, points);
      const raw = full == null ? null : formatLike(e, full);
      if (raw && plausible(e, raw)) {
        e.actual = parseValue(raw);
        e.actualRaw = raw;
        e.actualSource = 'official';
        e.actualSourceUrl = AGENCY[spec.agency].url(spec.id);
        out.filled++;
        out.byAgency[spec.agency] = (out.byAgency[spec.agency] ?? 0) + 1;
        log(`actuals: ${e.currency} ${e.title} = ${raw} (${label})`);
      } else {
        log(`actuals: ${label} gave ${raw ?? 'nothing usable'} for ${e.currency} ${e.title} (forecast ${e.forecastRaw}); left for the other sources`);
      }
    } catch (err) {
      out.errors[spec.agency] = err.message.replace(/api_key=[^&\s]+/gi, 'api_key=…').slice(0, 160);
    }
  }
  return out;
}
