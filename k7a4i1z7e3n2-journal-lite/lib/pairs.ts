// Pairs are stored as one uppercase code ("EURUSD"); the UI shows them as base/quote.

const CCY = ['USD', 'EUR', 'GBP', 'AUD', 'NZD', 'CAD', 'CHF', 'JPY', 'XAU', 'XAG', 'BTC', 'ETH'];

export const COMMON_PAIRS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'AUDJPY', 'EURAUD', 'GBPAUD', 'EURCAD', 'GBPCAD',
  'AUDCAD', 'AUDNZD', 'CADJPY', 'CHFJPY', 'NZDJPY', 'EURCHF', 'GBPCHF', 'XAUUSD', 'XAGUSD',
];

export function splitPair(symbol = '') {
  const s = symbol.toUpperCase().trim();
  if (s.includes('/')) {
    const [base = '', quote = ''] = s.split('/');
    return { base, quote };
  }
  if (s.length === 6 && CCY.includes(s.slice(0, 3)) && CCY.includes(s.slice(3))) return { base: s.slice(0, 3), quote: s.slice(3) };
  return { base: s, quote: '' };
}

/** What a pair is saved as: uppercase, no spaces. */
export const normalizePair = (s: string) => s.toUpperCase().replace(/\s+/g, '');
