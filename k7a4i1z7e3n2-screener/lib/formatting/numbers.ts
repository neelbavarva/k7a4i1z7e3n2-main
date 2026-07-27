export function compactCurrency(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(abs >= 10e12 ? 1 : 2)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
export function compactNumber(value: number | null) { return value === null ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value); }
export function percent(value: number | null, digits = 0) { return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(digits)}%`; }
export function delta(current: number | null, prior: number | null) {
  if (current === null || prior === null || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}
