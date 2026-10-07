// What the scores on screen are, as time passes after an update. In order of preference:
//   1. the latest update, while it's recent;
//   2. the same update a little older (up to PROJECT_AFTER_HOURS), shown as it is;
//   3. after that, each market's projected score for the hour we're in: releases since the
//      update are counted at their forecasts. Past PROJECT_MAX_HOURS the update is just old.
import { labelFor } from '../pipeline/lib/score.js';
import { STALE_HOURS } from './constants.js';

const HOUR = 3600 * 1000;
export const PROJECT_AFTER_HOURS = STALE_HOURS;
export const PROJECT_MAX_HOURS = 48;

export function freshness(generatedAt, now = Date.now()) {
  const age = now - Date.parse(generatedAt);
  return { age, projected: age > PROJECT_AFTER_HOURS * HOUR && age <= PROJECT_MAX_HOURS * HOUR, old: age > PROJECT_MAX_HOURS * HOUR };
}

/** A market's score for now: the published one, or, when the update is late, its projection for this hour. */
export function scoreNow(p, generatedAt, now = Date.now()) {
  if (!freshness(generatedAt, now).projected || !p.hourly?.length) return { score: p.score, label: p.label };
  const i = Math.floor((now - Math.floor(Date.parse(generatedAt) / HOUR) * HOUR) / HOUR);
  const s = p.hourly[Math.min(Math.max(i, 0), p.hourly.length - 1)];
  return { score: s, label: labelFor(s) };
}

/** A market page's summary for now, the same way, from its hourly series. */
export function summaryNow(summary, series, generatedAt, now = Date.now()) {
  if (!freshness(generatedAt, now).projected) return summary;
  const point = series.find((p) => p.t === Math.floor(now / HOUR) * HOUR);
  return point ? { ...summary, score: point.s, label: labelFor(point.s) } : summary;
}
