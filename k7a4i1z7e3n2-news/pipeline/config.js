// Central settings for the data pipeline. Tune the model here, nowhere else.

// The 8 major currencies in market-convention priority: in any pair, the one listed
// first here is the base (EUR/GBP, GBP/AUD, AUD/NZD, NZD/USD, USD/CAD, CAD/CHF, CHF/JPY).
export const MAJORS = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY'];

const fx = (base, quote) => ({ id: base + quote, symbol: `${base}/${quote}`, base, quote, kind: 'fx' });

/*
 * Non-FX markets have no second economy to pull against, so each gets a driver
 * profile instead: which releases move it and which way. Rules are checked top to
 * bottom; the first one that matches an event decides how it counts.
 *
 *   ccy     the calendar currency of the release (USD, CNY…)
 *   cat     'growth' | 'labour' | 'inflation' | 'rates' (see categoryOf in lib/score.js); omit for "any"
 *   title   match a specific release by name instead of a category (it counts even if
 *           the FX model ignores it, e.g. crude inventories)
 *   mult    how a surprise that is *good for that currency's economy* moves this market
 *           (+1 = same way, -1 = opposite)
 *   weight  override the impact weight (for Low-impact releases that matter here)
 *   label   how the driver is named on the site
 *
 * price: Twelve Data symbols, tried in order (spot first, a tracking fund as fallback).
 */
const US_DOLLAR = 'US data, via the dollar';
export const INSTRUMENTS = [
  {
    id: 'XAUUSD', symbol: 'XAU/USD', base: 'XAU', quote: 'USD', kind: 'metal', name: 'Gold',
    aliases: ['GOLD', 'XAU'], price: ['XAU/USD'],
    note: 'Gold has no economic calendar of its own, so this score reflects US data: strong US numbers lift the dollar and weigh on gold, weak ones support it.',
    drivers: [{ label: US_DOLLAR, ccy: 'USD', mult: -1 }],
  },
  {
    id: 'XAGUSD', symbol: 'XAG/USD', base: 'XAG', quote: 'USD', kind: 'metal', name: 'Silver',
    aliases: ['SILVER', 'XAG'], price: ['XAG/USD', 'SLV'],
    note: 'Silver trades like gold against the dollar, but half its demand is industrial, so strong growth data hurts it less and Chinese factory data helps it.',
    drivers: [
      { label: 'China factory data', ccy: 'CNY', cat: 'growth', mult: 1, weight: 1.5 },
      { label: 'US growth data', ccy: 'USD', cat: 'growth', mult: -0.4 },
      { label: US_DOLLAR, ccy: 'USD', mult: -1 },
    ],
  },
  {
    id: 'COPPER', symbol: 'COPPER', base: 'XCU', quote: 'USD', kind: 'metal', name: 'Copper',
    aliases: ['COPPER', 'XCU', 'HG', 'DRCOPPER'], price: ['XCU/USD', 'CPER'],
    note: 'Copper follows global factory demand, and China buys about half the world\'s supply, so Chinese manufacturing data leads. Strong US growth helps; hot US inflation and hawkish rates hurt through the dollar.',
    drivers: [
      { label: 'China factory data', ccy: 'CNY', cat: 'growth', mult: 1, weight: 2 },
      { label: 'US growth data', ccy: 'USD', cat: 'growth', mult: 0.6 },
      { label: US_DOLLAR, ccy: 'USD', cat: ['inflation', 'rates'], mult: -0.5 },
    ],
  },
  {
    id: 'USOIL', symbol: 'USOIL', base: 'WTI', quote: 'USD', kind: 'energy', name: 'WTI crude oil',
    aliases: ['OIL', 'WTI', 'CRUDE', 'USOIL', 'CL'], price: ['WTI/USD', 'USO'],
    note: 'Oil reacts to the weekly US inventory report (a bigger build than expected means weaker demand) and to growth data from the US and China, the two largest consumers.',
    drivers: [
      { label: 'US crude inventories', ccy: 'USD', title: /crude oil inventories/i, mult: -1, weight: 2 },
      { label: 'China factory data', ccy: 'CNY', cat: 'growth', mult: 0.8, weight: 1.5 },
      { label: 'US growth data', ccy: 'USD', cat: 'growth', mult: 0.6 },
    ],
  },
  {
    id: 'US500', symbol: 'US500', base: 'SPX', quote: 'USD', kind: 'index', name: 'S&P 500',
    aliases: ['SPX', 'SP500', 'US500', 'SPY', 'SNP', 'SANDP', 'SPX500'], price: ['SPY'],
    note: 'US stocks like growth but fear rates: strong activity data supports them, while hot inflation and hawkish Fed surprises push yields up and weigh on them.',
    drivers: [
      { label: 'Fed rate decisions', ccy: 'USD', cat: 'rates', mult: -1.2 },
      { label: 'US inflation data', ccy: 'USD', cat: 'inflation', mult: -1 },
      { label: 'US growth data', ccy: 'USD', cat: 'growth', mult: 1 },
      { label: 'US jobs data', ccy: 'USD', cat: 'labour', mult: 0.5 },
    ],
  },
  {
    id: 'NAS100', symbol: 'NAS100', base: 'NDX', quote: 'USD', kind: 'index', name: 'Nasdaq 100',
    aliases: ['NAS100', 'NASDAQ', 'NDX', 'QQQ', 'US100', 'NAS'], price: ['QQQ'],
    note: 'The Nasdaq is the most rate-sensitive of the three indices: its tech companies are valued on profits far in the future, so inflation and Fed surprises hit it harder than the S&P 500.',
    drivers: [
      { label: 'Fed rate decisions', ccy: 'USD', cat: 'rates', mult: -1.5 },
      { label: 'US inflation data', ccy: 'USD', cat: 'inflation', mult: -1.3 },
      { label: 'US growth data', ccy: 'USD', cat: 'growth', mult: 0.8 },
      { label: 'US jobs data', ccy: 'USD', cat: 'labour', mult: 0.3 },
    ],
  },
  {
    id: 'US30', symbol: 'US30', base: 'DJI', quote: 'USD', kind: 'index', name: 'Dow Jones',
    aliases: ['US30', 'DOW', 'DJI', 'DJIA', 'DIA', 'DOWJONES'], price: ['DIA'],
    note: 'The Dow leans toward industrial and value companies, so it tracks growth data more and rate surprises less than the Nasdaq.',
    drivers: [
      { label: 'Fed rate decisions', ccy: 'USD', cat: 'rates', mult: -0.9 },
      { label: 'US inflation data', ccy: 'USD', cat: 'inflation', mult: -0.8 },
      { label: 'US growth data', ccy: 'USD', cat: 'growth', mult: 1.2 },
      { label: 'US jobs data', ccy: 'USD', cat: 'labour', mult: 0.6 },
    ],
  },
];

// All 28 pairs between the majors, then metals, energy and indices.
export const PAIRS = [...MAJORS.flatMap((b, i) => MAJORS.slice(i + 1).map((q) => fx(b, q))), ...INSTRUMENTS];

// Calendar currencies we keep: the majors, plus China for its factory data (commodity driver).
export const CURRENCIES = new Set([...MAJORS, 'CNY']);

// FX prices: only the 7 USD legs are downloaded; every cross is calculated from them,
// e.g. EUR/GBP = EUR/USD / GBP/USD. Instruments download their own symbol (see price above).
// 7 legs + 7 instruments = 14 Twelve Data credits an hour, inside the free tier.
export const PRICE_LEGS = {
  EUR: { symbol: 'EUR/USD', invert: false },
  GBP: { symbol: 'GBP/USD', invert: false },
  AUD: { symbol: 'AUD/USD', invert: false },
  NZD: { symbol: 'NZD/USD', invert: false },
  CAD: { symbol: 'USD/CAD', invert: true },
  CHF: { symbol: 'USD/CHF', invert: true },
  JPY: { symbol: 'USD/JPY', invert: true },
};

/** What the website gets for a pair: no regexes or driver internals. */
export const publicPair = ({ drivers, price, ...rest }) => ({
  ...rest,
  ...(drivers ? { driverLabels: [...new Set(drivers.map((d) => d.label))] } : {}),
});

export const MODEL = {
  // tanh sensitivity: S = 100 * tanh(R / K). The brief started at 6, but with a normal
  // week's event density that pins most pairs near +/-90. At 12 the median |score| is
  // about 35 and the 90th percentile about 63, so the labels separate. Re-tune after backtesting.
  K: 12,
  zCap: 3, // surprises are clamped to +/- zCap standard deviations
  minStatsN: 5, // releases needed before using the indicator's own sigma
  rateSigma: 0.25, // sigma for policy-rate decisions, in percentage points
  impactWeight: { High: 3, Medium: 1.5, Low: 0, Holiday: 0 },
  rateWeight: 4,
  halfLifeHours: 72,
  rateHalfLifeHours: 240,
  band: { base: 5, perWeight: 12, widthHours: 12, cap: 55 },
  // Consensus path: an upcoming release pushes the projection by (forecast - previous) / sigma,
  // at this fraction of a real surprise's weight (consensus is mostly priced in already).
  consensusWeight: 0.5,
  // The expected change is priced in over this many hours before a release, so at the
  // release itself only the surprise moves the score (a beat always pushes the right way).
  // Short enough that the projected line still turns sharply at each release.
  expectationLeadHours: 24,
  // A release with no actual value yet keeps its expected push for up to this many days.
  provisionalDays: 7,
  historyDays: 30,
  forwardDays: 7,
};

export const LABELS = [
  { max: 15, text: 'Neutral' },
  { max: 40, text: 'Mildly' },
  { max: 70, text: '' },
  { max: Infinity, text: 'Strongly' },
];

// Twelve Data free tier: 8 requests a minute, so the price step waits this long between requests.
export const PRICE_REQUEST_DELAY_MS = 8000;

export const CALENDAR_URLS = [
  'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
  'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
];

// How long the pipeline keeps things in data/ (the repo is the database).
export const RETENTION = {
  eventsDays: 400, // long enough to learn each indicator's typical surprise
  pricesDays: 45,
};

export const ACTUALS = {
  minutesAfterRelease: 20, // a release counts as waiting for its value this long after it's out…
  lookbackDays: 7, // …until this long after
};

// Released values from JBlanked's News API (pipeline/sources/jblanked.js), which relays
// ForexFactory's calendar with actual values. Free, so it's asked before Apify.
export const JBLANKED = {
  base: 'https://www.jblanked.com',
  source: 'forex-factory', // the calendar it relays (also: mql5, fxstreet)
  matchHours: 12, // its times may be in another zone: same currency and name within this window
};

// Released values from ForexFactory's calendar page, through the "forexfactory-calendar" scraper on
// Apify (pipeline/sources/apify.js). Apify's free plan is $5 of usage a month; a run here costs a few
// cents (a start fee per GB of memory, $0.002 a result on the free tier, and a little compute).
export const APIFY = {
  actor: 'xtracto~forexfactory-calendar',
  minutesAfterRelease: 20, // ask once a release has been out this long…
  lookbackDays: 2, // …and until this long after (older ones wait for the feed)
  maxTries: 3, // paid runs per release before it's left to the feed
  maxRunsPerJob: 2, // days asked for in one hourly run
  maxItems: 60, // events a run may return (each one costs)
  memoryMb: 1024, // the start fee is charged per GB
  proxyCountry: 'US', // residential proxy country for reading ForexFactory
  timeoutS: 120,
  maxChargePerRunUsd: 0.15,
  reserveUsd: 0.3, // stop asking when this little of the month's credit is left
};
