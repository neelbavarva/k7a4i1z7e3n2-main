// Pairs are stored as one uppercase code ("EURUSD"); the UI shows them as base/quote.

const CCY = ['USD', 'EUR', 'GBP', 'AUD', 'NZD', 'CAD', 'CHF', 'JPY', 'XAU', 'XAG', 'BTC', 'ETH'];

/**
 * The pairs a new trade can be logged on: the vault journal's list (components/TradeSymbols.js),
 * majors first, then the crosses by base, then metals and crypto.
 */
export const PAIRS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD',
  'EURGBP', 'EURJPY', 'EURCHF', 'EURAUD', 'EURNZD', 'EURCAD',
  'GBPJPY', 'GBPCHF', 'GBPAUD', 'GBPNZD', 'GBPCAD',
  'AUDJPY', 'AUDCHF', 'AUDNZD', 'AUDCAD',
  'NZDJPY', 'NZDCHF', 'NZDCAD',
  'CADJPY', 'CADCHF',
  'XAUUSD', 'XAGUSD', 'BTCUSD', 'ETHUSD',
] as const;

export type Pair = (typeof PAIRS)[number];

export const isPair = (v: unknown): v is Pair => typeof v === 'string' && (PAIRS as readonly string[]).includes(v);

export function splitPair(symbol = '') {
  const s = symbol.toUpperCase().trim();
  if (s.includes('/')) {
    const [base = '', quote = ''] = s.split('/');
    return { base, quote };
  }
  if (s.length === 6 && CCY.includes(s.slice(0, 3)) && CCY.includes(s.slice(3))) return { base: s.slice(0, 3), quote: s.slice(3) };
  return { base: s, quote: '' };
}

const ALIASES: Record<string, string> = { XAU: 'GOLD', XAG: 'SILVER', BTC: 'BITCOIN', ETH: 'ETHEREUM' };
const bare = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Pairs matching a search ("gbp", "eur/usd", "gold"), the ones that start with it first. */
export function findPairs(pairs: readonly string[], query: string): string[] {
  const q = bare(query);
  if (!q) return [...pairs];
  const alias = (p: string) => ALIASES[bare(p).slice(0, 3)] ?? '';
  const starts = (p: string) => (bare(p).startsWith(q) || alias(p).startsWith(q) ? 0 : 1);
  return pairs.filter((p) => bare(p).includes(q) || alias(p).includes(q)).sort((a, b) => starts(a) - starts(b));
}
