import { createHash } from 'node:crypto';
import { MODEL } from '../config.js';
import { LOWER_IS_BETTER, NO_SIGNAL, RATE_DECISION } from '../rules.js';

const MULT = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
const VALUE_RE = /^([+-]?(?:\d+\.?\d*|\.\d+))\s*([%KMBT])?$/i;

/** "0.3%" -> 0.3, "201K" -> 201000, "-116.3B" -> -1.163e11, "5.16|3.6" -> 5.16, "" -> null */
export function parseValue(raw) {
  if (raw == null) return null;
  const s = String(raw).split('|')[0].trim().replace(/,/g, '');
  if (!s) return null;
  const m = s.match(VALUE_RE);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const suffix = (m[2] || '').toUpperCase();
  return MULT[suffix] ? n * MULT[suffix] : n;
}

/** The unit suffix of a raw value: '%', 'K', 'M', 'B', 'T' or '' */
export function unitOf(raw) {
  if (raw == null) return '';
  const s = String(raw).split('|')[0].trim();
  const m = s.match(VALUE_RE);
  return m ? (m[2] || '').toUpperCase() : '';
}

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
