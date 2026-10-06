// Reading calendar values. Plain JavaScript with no Node imports, so the website can use it too
// (the Calendar page judges a released value against its forecast with it).

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

/**
 * Which way `a` is from `b`: 1 above, -1 below, 0 the same, null when either is missing or
 * they aren't the same kind of number ("0.3%" against "201K" can't be compared).
 */
export function compareValues(a, b) {
  const x = parseValue(a);
  const y = parseValue(b);
  if (x == null || y == null) return null;
  // "1.2M" and "1200K" are the same kind of number; "%" and a plain index are not
  const pct = (r) => unitOf(r) === '%';
  if (pct(a) !== pct(b)) return null;
  const d = x - y;
  return Math.abs(d) <= 1e-9 * Math.max(1, Math.abs(y)) ? 0 : Math.sign(d);
}

/**
 * How a release reads for its own currency, given `dir` (-1 when lower is better, as for
 * unemployment): `vs` is the actual against the forecast and `beat` what that means for the
 * currency (1 better than expected, -1 worse); `trend` is the forecast against the previous
 * value and `lean` what the forecast change means. Risk-only releases (speeches, auctions,
 * inventories) get the raw comparisons but no verdict.
 */
export function judge({ a, f, p, dir = 1, skip = false }) {
  const vs = compareValues(a, f);
  const trend = compareValues(f, p);
  return {
    vs,
    beat: skip || vs == null ? null : vs * dir || 0,
    trend,
    lean: skip || trend == null ? null : trend * dir || 0,
  };
}
