import { MODEL, LABELS, publicPair } from '../config.js';
import { CATEGORIES } from '../rules.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const HOUR = 3600 * 1000;
const statKey = (e) => `${e.currency}|${e.title}`;

export const isReleasedWithData = (e, nowMs) =>
  !e.skip && e.weight > 0 && e.actual != null && e.forecast != null && Date.parse(e.time) <= nowMs;

/** Sample standard deviation of (actual - forecast) per indicator. */
export function buildSurpriseStats(events) {
  const groups = new Map();
  for (const e of events) {
    if (e.skip || e.actual == null || e.forecast == null) continue;
    const k = statKey(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e.actual - e.forecast);
  }
  const stats = {};
  for (const [k, diffs] of groups) {
    const n = diffs.length;
    if (n < 2) {
      stats[k] = { n, sigma: null };
      continue;
    }
    const mean = diffs.reduce((a, b) => a + b, 0) / n;
    const v = diffs.reduce((a, d) => a + (d - mean) ** 2, 0) / (n - 1);
    stats[k] = { n, sigma: Math.sqrt(v) };
  }
  return stats;
}

export function sigmaFor(e, stats) {
  if (e.isRate) return MODEL.rateSigma;
  const st = stats[statKey(e)];
  if (st && st.n >= MODEL.minStatsN && st.sigma > 0) return st.sigma;
  const prev = e.previous ?? e.forecast;
  return Math.max(Math.abs(e.forecast - prev), 0.1 * Math.abs(e.forecast), 0.05);
}


/** Step 1-2: z-score and the event's effect on its own currency (before pair sign). */
export function surprise(e, stats) {
  const sigma = sigmaFor(e, stats);
  const z = clamp((e.actual - e.forecast) / sigma, -MODEL.zCap, MODEL.zCap);
  return { z, sigma, currencyEffect: e.dir * e.weight * z };
}

/**
 * Consensus expectation for a release without an actual value:
 * z = (forecast - previous) / sigma, scaled by MODEL.consensusWeight.
 * Null when there's nothing to compare.
 */
export function expectation(e, stats) {
  if (e.skip || !(e.weight > 0)) return null;
  const z = expectedZ(e, stats);
  return z == null ? null : { z, currencyEffect: e.dir * e.weight * z };
}

/** The consensus-weighted expected change, with no impact or skip checks. */
export function expectedZ(e, stats) {
  if (e.forecast == null || e.previous == null) return null;
  const sigma = sigmaFor(e, stats);
  return clamp((e.forecast - e.previous) / sigma, -MODEL.zCap, MODEL.zCap) * MODEL.consensusWeight;
}

/** Broad type of a release, used by the driver profiles of non-FX markets. */
export function categoryOf(e) {
  if (e.isRate) return 'rates';
  const t = e.title.toLowerCase();
  return CATEGORIES.find((c) => c.words.some((w) => t.includes(w)))?.key ?? 'other';
}

/**
 * How one release moves one market: { m, weight, group } or null if it doesn't.
 * FX pairs: +1 for base-currency data, -1 for quote-currency data.
 * Other markets: the first matching rule in their driver profile (config.js).
 */
export function effectOf(pair, e) {
  if (!pair.drivers) {
    const side = pairSide(pair, e.currency);
    if (!side || e.skip || !(e.weight > 0)) return null;
    return { m: side, weight: e.weight, group: e.currency };
  }
  for (const r of pair.drivers) {
    if (r.ccy !== e.currency) continue;
    if (r.title) {
      if (!r.title.test(e.title)) continue;
    } else {
      if (e.skip) continue;
      if (r.cat && ![].concat(r.cat).includes(categoryOf(e))) continue;
    }
    const weight = r.weight ?? e.weight;
    if (!(weight > 0)) return null;
    return { m: r.mult, weight, group: r.label, override: r.weight != null };
  }
  return null;
}

/** Which calendar currencies a market listens to (for its event lists and risk band). */
export const currenciesOf = (pair) => new Set(pair.drivers ? pair.drivers.map((d) => d.ccy) : [pair.base, pair.quote]);

export const pairSide = (pair, currency) => (currency === pair.base ? 1 : currency === pair.quote ? -1 : 0);

export const toScore = (R, K = MODEL.K) => 100 * Math.tanh(R / K);

export function labelFor(score) {
  const a = Math.abs(score);
  const tier = LABELS.find((l) => a < l.max);
  if (tier.text === 'Neutral') return 'Neutral';
  const dir = score > 0 ? 'bullish' : 'bearish';
  return tier.text ? `${tier.text} ${dir}` : dir[0].toUpperCase() + dir.slice(1);
}

/** Step 5 band half-width at time t from upcoming risk events. */
export function bandWidth(tMs, upcoming) {
  const { base, perWeight, widthHours, cap } = MODEL.band;
  let sum = 0;
  for (const u of upcoming) {
    const dh = (tMs - u.tMs) / (widthHours * HOUR);
    sum += perWeight * u.riskWeight * Math.exp(-dh * dh);
  }
  return base + Math.min(cap, sum);
}

const riskWeightOf = (e) => (e.isRate ? MODEL.rateWeight : MODEL.impactWeight[e.impact] ?? 0);

const round = (x, d = 2) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);

/**
 * Bias checker: one trade bias for the coming week, from released news and forecasts.
 * The average total over now and every hour of the next 7 days (as projected) is split
 * into its released-news part and its forecast part, then squashed like the score.
 *   score     100·tanh((avg past + avg upcoming) / K): direction and strength
 *   past/up   each part on its own, on the same scale
 *   share     how much of the total weight comes from released news (0..1)
 *   agree     share of those hours where the projected score leans the same way (|s| ≥ 15)
 */
export function biasCheck({ past, up, n, scores }) {
  if (!n) return null;
  const p = past / n;
  const u = up / n;
  const score = toScore(p + u);
  const side = Math.sign(score);
  const neutral = LABELS[0].max;
  const agree = side ? scores.filter((x) => Math.sign(x) === side && Math.abs(x) >= neutral).length / n : 0;
  const tot = Math.abs(p) + Math.abs(u);
  return {
    score: round(score, 1),
    strength: round(Math.abs(score), 0),
    tier: strengthTier(score),
    past: round(toScore(p), 1),
    up: round(toScore(u), 1),
    share: tot ? round(Math.abs(p) / tot, 2) : null,
    agree: round(agree, 2),
    min: round(Math.min(...scores), 1),
    max: round(Math.max(...scores), 1),
  };
}

/** Strength wording for the bias checker: same cut-offs as the score labels. */
export function strengthTier(score) {
  const a = Math.abs(score);
  return a < LABELS[0].max ? 'None' : a < LABELS[1].max ? 'Weak' : a < LABELS[2].max ? 'Moderate' : 'Strong';
}

/**
 * Computes the hourly bias series for one pair.
 *
 * Every release contributes its expected change (forecast vs previous, at consensus
 * weight). Once the actual is out it also contributes its surprise (actual vs forecast,
 * full weight). So an in-line print lands exactly on the projected path, and a beat or
 * miss moves the score away from it. Future hours use expectations only, with a band
 * that widens around upcoming events.
 */
export function computePair(pair, allEvents, stats, nowMs) {
  const nowHour = Math.floor(nowMs / HOUR) * HOUR;
  const start = nowHour - MODEL.historyDays * 24 * HOUR;
  const end = nowHour + MODEL.forwardDays * 24 * HOUR;
  const ccys = currenciesOf(pair);
  const isFx = !pair.drivers;
  const mine = allEvents.filter((e) => ccys.has(e.currency));
  const effects = new Map(mine.map((e) => [e.id, effectOf(pair, e)]));

  // Each release has two parts:
  //  - expected change (forecast vs previous, at consensus weight): priced in gradually over
  //    the days before the release, as the consensus forms;
  //  - surprise (actual vs forecast, full weight): lands at the release.
  // So the score always moves the way the release surprised, and an in-line print lands
  // exactly on the projected path. Both decay together after the release.
  const lead = MODEL.expectationLeadHours * HOUR;
  const contributions = [];
  for (const e of mine) {
    const eff = effects.get(e.id);
    if (!eff) continue;
    const tMs = Date.parse(e.time);
    const ez = expectedZ(e, stats) ?? 0;
    // "good for that currency's economy", at this market's weight
    const unit = e.dir * eff.weight;
    const released = e.actual != null && e.forecast != null && tMs <= nowMs;
    // out for a while with no number: counted as if it came in exactly at forecast. That is what an
    // in-line print does (its expected change stays, no surprise), so the real number, when it
    // comes, moves the score only by how far it is from forecast; it fades like any release
    const assumed = !released && e.actual == null && ez && tMs <= nowMs - MODEL.assumeAfterHours * HOUR;
    const recent = tMs > nowMs - MODEL.provisionalDays * 24 * HOUR;
    if (!released && !assumed && !(e.actual == null && tMs <= end + lead && ez && (recent || tMs > nowMs))) continue;
    const z = released ? surprise(e, stats).z : 0;
    contributions.push({
      e,
      tMs,
      from: tMs - lead,
      z,
      uExp: unit * ez, // currency effect of the expected change
      uSur: unit * z, // currency effect of the surprise
      m: eff.m,
      group: eff.group,
      halfLife: e.halfLife,
      expected: !released && !assumed,
      assumed,
      provisional: !released && !assumed && tMs <= nowMs,
    });
  }
  contributions.sort((a, b) => a.from - b.from);

  /** Currency effect of one release at time t (before the market's multiplier). */
  const effectAt = (k, t) => {
    if (t < k.from) return 0;
    if (t < k.tMs) return k.uExp * ((t - k.from) / lead); // consensus building up
    return (k.uExp + k.uSur) * 0.5 ** ((t - k.tMs) / HOUR / k.halfLife);
  };

  // Risk band: anything scheduled that this market listens to, including speeches
  const riskOf = (e) => {
    const eff = effects.get(e.id);
    return eff?.override ? eff.weight : isFx || eff || e.isRate || e.impact === 'High' ? riskWeightOf(e) : 0;
  };
  const upcoming = mine
    .filter((e) => Date.parse(e.time) > nowMs && riskOf(e) > 0)
    .map((e) => ({ tMs: Date.parse(e.time), riskWeight: riskOf(e) }));

  const groupNow = new Map();
  // Bias checker: over "now" and the next forwardDays, how much of the score comes from
  // news already released vs forecasts for news still to come
  const ahead = { past: 0, up: 0, n: 0, scores: [] };
  const groupEnd = new Map();
  const series = [];
  for (let t = start; t <= end; t += HOUR) {
    let R = 0;
    let Rb = 0;
    let Rq = 0;
    const parts = [];
    for (const k of contributions) {
      if (k.from > t) break;
      const u = effectAt(k, t);
      if (!u) continue;
      const v = k.m * u;
      R += v;
      if (isFx) {
        if (k.e.currency === pair.base) Rb += u;
        else Rq += u;
      } else if (t === nowHour || t === end) {
        const g = t === nowHour ? groupNow : groupEnd;
        g.set(k.group, (g.get(k.group) ?? 0) + v);
      }
      parts.push({ k, v });
    }
    const s = toScore(R);
    const proj = t > nowHour;
    const half = proj ? bandWidth(t, upcoming) : 0;
    const point = { t, s: round(s, 1), r: round(R, 3), proj };
    // b / q: each currency's own strength from its own data, on the same -100..100 scale
    if (isFx) Object.assign(point, { b: round(toScore(Rb), 1), q: round(toScore(Rq), 1) });
    if (proj || t === nowHour) {
      point.lo = round(clamp(s - half, -100, 100), 1);
      point.hi = round(clamp(s + half, -100, 100), 1);
    }
    point.top = parts
      .filter((p) => Math.abs(p.v) >= 0.05)
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
      .slice(0, 3)
      .map((p) => (p.k.expected || t < p.k.tMs ? { id: p.k.e.id, v: round(p.v), x: 1 } : { id: p.k.e.id, v: round(p.v) }));
    if (t >= nowHour) {
      for (const { k, v } of parts) ahead[k.expected ? 'up' : 'past'] += v;
      ahead.n++;
      ahead.scores.push(s);
    }
    series.push(point);
  }

  const current = series.find((p) => p.t === nowHour);
  // The "main driver" is the biggest recent surprise pushing in the score's own direction
  // (by its surprise alone, so the sentence "came in above forecast" always matches its push).
  const surpriseNow = (k) => k.m * k.uSur * 0.5 ** ((nowHour - k.tMs) / HOUR / k.halfLife);
  const driverK = contributions
    .filter((k) => !k.expected && !k.assumed && k.uSur && Math.sign(surpriseNow(k)) === Math.sign(current?.r ?? 0))
    .sort((a, b) => Math.abs(surpriseNow(b)) - Math.abs(surpriseNow(a)))[0];
  const driverPart = driverK && { v: round(surpriseNow(driverK)) };
  const effImpact = (e) => {
    const eff = effects.get(e.id);
    if (eff?.override) return eff.weight >= 3 ? 'High' : 'Medium';
    return e.impact;
  };
  const next = mine
    .filter((e) => Date.parse(e.time) > nowMs && (effImpact(e) === 'High' || e.isRate))
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))[0];
  const last = series.at(-1);

  const contribById = new Map(contributions.map((k) => [k.e.id, k]));
  const referenced = new Set(series.flatMap((p) => (p.top ?? []).map((x) => x.id)));
  const events = mine
    .filter((e) => {
      const tm = Date.parse(e.time);
      if (referenced.has(e.id)) return true;
      if (tm < start || tm > end || e.impact === 'Holiday') return false;
      // for non-FX markets, list what drives them plus big scheduled risks
      return isFx || effects.get(e.id) || e.impact === 'High';
    })
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
    .map((e) => {
      const k = contribById.get(e.id);
      const eff = effects.get(e.id);
      return {
        id: e.id,
        t: e.time,
        ccy: e.currency,
        title: e.title,
        impact: effImpact(e),
        f: e.forecastRaw || null,
        p: e.previousRaw || null,
        a: e.actualRaw || null,
        src: e.actualSource || null,
        url: e.actualSourceUrl || null,
        skip: !eff,
        z: k && !k.expected && !k.assumed ? round(k.z) : null,
        // c: the surprise's push at release (always the way it beat or missed);
        // ec: the expected change's push, for releases still waiting for a number, and for
        // releases counted at forecast (as: true) the push of that assumed move
        c: k && !k.expected && !k.assumed ? round(k.m * k.uSur) : null,
        ec: k?.expected || k?.assumed ? round(k.m * k.uExp) : null,
        as: k?.assumed ? true : undefined,
        // market effect of a 1-sigma surprise above forecast, for the scenario columns
        sc: eff && e.forecast != null ? round(eff.m * e.dir * eff.weight) : null,
        prov: k?.provisional ? true : undefined,
        // news-load chart: the release's risk weight (as in the grey range) and rate flag
        w: riskOf(e) > 0 ? round(riskOf(e)) : undefined,
        rate: e.isRate || undefined,
      };
    });

  // Non-FX markets: how much each driver pushes now and in 7 days
  const drivers = isFx
    ? undefined
    : [...new Set(pair.drivers.map((d) => d.label))].map((label) => ({
        label,
        now: round(toScore(groupNow.get(label) ?? 0), 1),
        later: round(toScore(groupEnd.get(label) ?? 0), 1),
      }));

  return {
    pair: publicPair(pair),
    now: nowMs,
    summary: {
      score: round(current?.s ?? 0, 1),
      label: labelFor(current?.s ?? 0),
      driver: driverK
        ? {
            id: driverK.e.id,
            currency: driverK.e.currency,
            title: driverK.e.title,
            above: driverK.e.actual > driverK.e.forecast,
            surpriseZ: round(driverK.z),
            rising: driverK.e.forecast > (driverK.e.previous ?? driverK.e.forecast),
            goodForCurrency: driverK.uSur > 0,
            value: driverPart.v,
          }
        : null,
      next: next ? { id: next.id, title: next.title, currency: next.currency, time: next.time, impact: effImpact(next) } : null,
      path: { t: last.t, score: last.s, label: labelFor(last.s) },
      provisional: contributions.filter((k) => k.provisional).length,
      assumed: contributions.filter((k) => k.assumed).length,
      check: biasCheck(ahead),
      drivers,
    },
    series,
    events,
  };
}
