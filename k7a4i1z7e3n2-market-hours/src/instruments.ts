// What the position size calculator can size: forex, metals and the big coins, with each one's
// usual contract (units in one lot) and pip. Pips follow Myfxbook's calculator; brokers differ, so
// both can be changed on the page.

export type Group = 'Majors' | 'Crosses' | 'Exotics' | 'Metals' | 'Crypto';

export interface Instrument {
  symbol: string;
  base: string;
  quote: string;
  name: string;
  group: Group;
  /** one pip, in the quote currency */
  pip: number;
  /** units of the base in one standard lot */
  lot: number;
  /** decimals in a quoted price */
  digits: number;
}

export const CURRENCY_NAME: Record<string, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  JPY: 'Japanese Yen',
  CHF: 'Swiss Franc',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  NZD: 'New Zealand Dollar',
  SGD: 'Singapore Dollar',
  HKD: 'Hong Kong Dollar',
  ZAR: 'South African Rand',
  MXN: 'Mexican Peso',
  TRY: 'Turkish Lira',
  NOK: 'Norwegian Krone',
  SEK: 'Swedish Krona',
  DKK: 'Danish Krone',
  PLN: 'Polish Zloty',
  HUF: 'Hungarian Forint',
  CZK: 'Czech Koruna',
  CNH: 'Chinese Yuan (offshore)',
  THB: 'Thai Baht',
  INR: 'Indian Rupee',
  AED: 'UAE Dirham',
  XAU: 'Gold',
  XAG: 'Silver',
  XPT: 'Platinum',
  XPD: 'Palladium',
  BTC: 'Bitcoin',
  ETH: 'Ether',
  SOL: 'Solana',
  XRP: 'XRP',
  LTC: 'Litecoin',
};

/** Currencies an account can be held in. */
export const ACCOUNT_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'SGD', 'HKD', 'INR', 'AED', 'ZAR', 'SEK', 'NOK', 'PLN', 'MXN'];

const MAJORS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD'];
const CROSSES = [
  'EURGBP', 'EURJPY', 'EURCHF', 'EURCAD', 'EURAUD', 'EURNZD',
  'GBPJPY', 'GBPCHF', 'GBPCAD', 'GBPAUD', 'GBPNZD',
  'AUDJPY', 'AUDCHF', 'AUDCAD', 'AUDNZD',
  'NZDJPY', 'NZDCHF', 'NZDCAD', 'CADJPY', 'CADCHF', 'CHFJPY',
];
const EXOTICS = [
  'USDSGD', 'USDHKD', 'USDZAR', 'USDMXN', 'USDTRY', 'USDNOK', 'USDSEK', 'USDDKK', 'USDPLN', 'USDHUF', 'USDCZK', 'USDCNH',
  'USDTHB', 'USDINR', 'EURTRY', 'EURZAR', 'EURNOK', 'EURSEK', 'EURPLN', 'EURHUF', 'EURCZK', 'GBPZAR', 'SGDJPY', 'ZARJPY',
];
// pip, lot, digits
const METALS: Record<string, [number, number, number]> = {
  XAUUSD: [0.01, 100, 2],
  XAGUSD: [0.01, 5000, 3],
  XPTUSD: [0.01, 100, 2],
  XPDUSD: [0.01, 100, 2],
  XAUEUR: [0.01, 100, 2],
  XAUAUD: [0.01, 100, 2],
};
const CRYPTO: Record<string, [number, number, number]> = {
  BTCUSD: [1, 1, 2],
  ETHUSD: [0.01, 1, 2],
  SOLUSD: [0.01, 1, 2],
  XRPUSD: [0.0001, 1, 4],
  LTCUSD: [0.01, 1, 2],
};

// quotes this far from 1 are priced in hundredths, like the yen
const BIG_QUOTES = ['JPY', 'HUF', 'THB', 'INR'];

function make(symbol: string, group: Group, spec?: [number, number, number]): Instrument {
  const base = symbol.slice(0, 3);
  const quote = symbol.slice(3);
  const pip = spec ? spec[0] : BIG_QUOTES.includes(quote) ? 0.01 : 0.0001;
  return {
    symbol,
    base,
    quote,
    name: `${CURRENCY_NAME[base]} / ${CURRENCY_NAME[quote]}`,
    group,
    pip,
    lot: spec ? spec[1] : 100_000,
    // forex is quoted to a tenth of a pip
    digits: spec ? spec[2] : decimals(pip) + 1,
  };
}

export const INSTRUMENTS: Instrument[] = [
  ...MAJORS.map((s) => make(s, 'Majors')),
  ...CROSSES.map((s) => make(s, 'Crosses')),
  ...EXOTICS.map((s) => make(s, 'Exotics')),
  ...Object.entries(METALS).map(([s, spec]) => make(s, 'Metals', spec)),
  ...Object.entries(CRYPTO).map(([s, spec]) => make(s, 'Crypto', spec)),
];

export const GROUPS: Group[] = ['Majors', 'Crosses', 'Exotics', 'Metals', 'Crypto'];

const BY_SYMBOL = new Map(INSTRUMENTS.map((i) => [i.symbol, i]));

export const findInstrument = (symbol: string | null | undefined) => (symbol ? BY_SYMBOL.get(symbol) : undefined);

/** Every currency the calculator may need a rate for. */
export const RATE_CODES = [...new Set([...INSTRUMENTS.flatMap((i) => [i.base, i.quote]), ...ACCOUNT_CURRENCIES])];

/** "EUR/USD" */
export const pairLabel = (i: Instrument) => `${i.base}/${i.quote}`;

/** How a position's size reads in units: "50,000 EUR", "50 oz", "0.5 BTC". */
export const unitName = (i: Instrument) => (i.group === 'Metals' ? 'oz' : i.base);

/** Decimal places in a number like 0.0001 (4) or 2.5 (1). */
export function decimals(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const s = String(n);
  if (s.includes('e-')) return Number(s.split('e-')[1]);
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : s.length - dot - 1;
}

/**
 * Instruments matching a search: "eurusd", "eur/usd", "eur usd", a currency code ("jpy"), or a
 * name ("gold", "yen"). Symbol matches come first, then name matches, each in list order.
 */
export function searchInstruments(query: string): Instrument[] {
  const q = query.trim().toLowerCase();
  if (!q) return INSTRUMENTS;
  const code = q.replace(/[^a-z0-9]/g, '').toUpperCase();
  const words = q.split(/[\s/]+/).filter(Boolean);
  const starts: Instrument[] = [];
  const contains: Instrument[] = [];
  const named: Instrument[] = [];
  for (const i of INSTRUMENTS) {
    if (code && i.symbol.startsWith(code)) starts.push(i);
    else if (code && i.symbol.includes(code)) contains.push(i);
    else if (words.every((w) => i.name.toLowerCase().includes(w) || i.group.toLowerCase().startsWith(w))) named.push(i);
  }
  return [...starts, ...contains, ...named];
}
