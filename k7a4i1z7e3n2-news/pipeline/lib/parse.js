import { createHash } from 'node:crypto';
import { MODEL } from '../config.js';
import { LOWER_IS_BETTER, NO_SIGNAL, RATE_DECISION } from '../rules.js';

// value parsing lives in values.js, which the website can load too (this file needs Node)
export { parseValue, unitOf } from './values.js';

export function eventId(title, currency, isoUtc) {
  return createHash('sha256').update(`${title}|${currency}|${isoUtc}`).digest('hex').slice(0, 16);
}

const has = (title, words) => words.some((w) => title.includes(w));

/**
 * Turns an event title + impact into scoring parameters.
 * Rules are checked top to bottom; the first match wins.
 */
export function classify(title, impact) {
  const t = String(title).toLowerCase();
  const base = {
    dir: 1,
    weight: MODEL.impactWeight[impact] ?? 0,
    halfLife: MODEL.halfLifeHours,
    skip: false,
    isRate: false,
  };
  if (impact === 'Holiday' || impact === 'Non-Economic') return { ...base, weight: 0, skip: true };
  if (has(t, LOWER_IS_BETTER)) return { ...base, dir: -1 };
  if (has(t, NO_SIGNAL)) return { ...base, skip: true };
  if (has(t, RATE_DECISION)) {
    return { ...base, weight: MODEL.rateWeight, halfLife: MODEL.rateHalfLifeHours, isRate: true };
  }
  return base;
}
