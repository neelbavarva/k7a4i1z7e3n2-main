const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

const fmt = (opts) => new Intl.DateTimeFormat(undefined, { timeZone: tz, ...opts });
const dayTime = fmt({ weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const dayOnly = fmt({ day: 'numeric', month: 'short' });
const timeOnly = fmt({ hour: 'numeric', minute: '2-digit' });
const zoneName = fmt({ timeZoneName: 'short' })
  .formatToParts(new Date())
  .find((p) => p.type === 'timeZoneName')?.value;

export const zone = zoneName || tz;
export const fmtDayTime = (t) => dayTime.format(new Date(t));
export const fmtDay = (t) => dayOnly.format(new Date(t));
export const fmtTime = (t) => timeOnly.format(new Date(t));

export function fmtRelative(t, now = Date.now()) {
  const diff = new Date(t).getTime() - now;
  const abs = Math.abs(diff);
  const h = abs / 3.6e6;
  let s;
  if (h < 1) s = `${Math.max(1, Math.round(abs / 6e4))} min`;
  else if (h < 48) s = `${Math.round(h)} h`;
  else s = `${Math.round(h / 24)} days`;
  return diff >= 0 ? `in ${s}` : `${s} ago`;
}

export function signed(x, d = 0) {
  const r = Number(Math.abs(x).toFixed(d));
  if (r === 0) return (0).toFixed(d);
  return (x > 0 ? '+' : '−') + r.toFixed(d);
}

/** Price with sensible precision: 4,140 · 157.92 · 1.32405 */
export function fmtPrice(v) {
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (v >= 50) return v.toFixed(2);
  return v.toFixed(4);
}

export function scoreWords(score) {
  const a = Math.abs(score);
  if (a < 15) return 'balanced';
  const dir = score > 0 ? 'bullish' : 'bearish';
  if (a < 40) return `mildly ${dir}`;
  if (a < 70) return dir;
  return `strongly ${dir}`;
}
