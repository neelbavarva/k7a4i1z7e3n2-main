// Helpers shared by every screen that lists or names a market.

export const isFx = (p) => !p.kind || p.kind === 'fx';

export const KINDS = [
  { key: 'all', label: 'All' },
  { key: 'fx', label: 'Forex' },
  { key: 'metal', label: 'Metals' },
  { key: 'energy', label: 'Energy' },
  { key: 'index', label: 'Indices' },
];

export const KIND_LABEL = { fx: 'Forex pair', metal: 'Metal', energy: 'Energy', index: 'US stock index' };

/** Letters and digits only, upper case: "eur/usd" → EURUSD, "S&P 500" → SP500. */
export const normalise = (q) => q.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Search match on code, symbol, name and aliases (gold, spx, nasdaq, oil, dow…). */
export function matchesMarket(p, q) {
  if (!q) return true;
  if (p.id.includes(q) || normalise(p.symbol).includes(q)) return true;
  if (p.name && normalise(p.name).includes(q)) return true;
  return (p.aliases ?? []).some((a) => a.includes(q) || (a.length >= 3 && q.includes(a)));
}

/** A second line for markets whose code doesn't say what they are (US500 → S&P 500). */
export const subName = (p) => (p.name && normalise(p.name) !== normalise(p.symbol) ? p.name : null);
