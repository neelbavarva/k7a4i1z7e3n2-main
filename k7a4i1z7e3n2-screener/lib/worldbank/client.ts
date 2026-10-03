import { cache } from 'react';
import { calculateBuffettIndicator } from '@/calculations/buffett';
import { INDICATORS } from './indicators';
import type { CountryCode, CountryDataset, EconomicsResponse } from '@/types/economics';

type ApiRow = { date: string; value: number | null };
export const RESEARCH_MARKETS = [
  ['US', 'United States'], ['IN', 'India'], ['CN', 'China'], ['RU', 'Russia'], ['JP', 'Japan'], ['GB', 'United Kingdom'],
  ['WLD', 'World'], ['Z7E', 'Europe & Central Asia'], ['Z4E', 'East Asia & Pacific'], ['SAS', 'South Asia'], ['LCN', 'Latin America & Caribbean'], ['MEA', 'Middle East & North Africa'], ['SSF', 'Sub-Saharan Africa']
] as const;
const countryNames = Object.fromEntries(RESEARCH_MARKETS) as Record<string, string>;

// Data comes from the World Bank Data360 API (same World Development Indicators as the
// old v2 API). The v2 endpoint (api.worldbank.org/v2) has been answering 502 for most
// requests, and almost always for regional aggregates. Data360 takes one request per
// indicator for all markets at once, paged 100 rows at a time.
const DATA360_URL = 'https://data360api.worldbank.org/data360/data';
const PAGE_SIZE = 100;
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_CONCURRENT = 6;

// Market ids used in the app → Data360 REF_AREA codes.
const REF_AREA: Record<string, string> = {
  US: 'USA', IN: 'IND', CN: 'CHN', RU: 'RUS', JP: 'JPN', GB: 'GBR',
  WLD: 'WLD', Z7E: 'ECS', Z4E: 'EAS', SAS: 'SAS', LCN: 'LCN', MEA: 'MEA', SSF: 'SSF'
};
const MARKET_BY_AREA = Object.fromEntries(Object.entries(REF_AREA).map(([market, area]) => [area, market]));

type Data360Row = { REF_AREA: string; TIME_PERIOD: string; OBS_VALUE: string | number | null };
type Data360Page = { count: number; value: Data360Row[] };

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let active = 0;
const waiting: (() => void)[] = [];
async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>(resolve => waiting.push(resolve));
  active++;
  try { return await task(); }
  finally { active--; waiting.shift()?.(); }
}

async function requestPage(indicator: string, skip: number): Promise<Data360Page> {
  const params = new URLSearchParams({
    DATABASE_ID: 'WB_WDI',
    INDICATOR: `WB_WDI_${indicator.replaceAll('.', '_')}`,
    REF_AREA: RESEARCH_MARKETS.map(([market]) => REF_AREA[market]).join(','),
    skip: String(skip),
  });
  const url = `${DATA360_URL}?${params}`;
  for (let attempt = 1; ; attempt++) {
    try {
      return await limited(async () => {
        const response = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (!response.ok) throw new Error(`Data360 API responded ${response.status}`);
        const json = await response.json() as Partial<Data360Page>;
        return { count: Number(json.count) || 0, value: Array.isArray(json.value) ? json.value : [] };
      });
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) throw error;
      await sleep(400 * 2 ** (attempt - 1) + Math.random() * 250);
    }
  }
}

/** One indicator for every market: market id → rows. A failed indicator yields empty series. */
async function fetchIndicator(indicator: string): Promise<Map<string, ApiRow[]>> {
  const byMarket = new Map<string, ApiRow[]>(RESEARCH_MARKETS.map(([market]) => [market, []]));
  try {
    const first = await requestPage(indicator, 0);
    // A page that still fails after its retries only loses its own rows.
    const settled = await Promise.allSettled(
      Array.from({ length: Math.max(0, Math.ceil(first.count / PAGE_SIZE) - 1) }, (_, i) => requestPage(indicator, (i + 1) * PAGE_SIZE)),
    );
    const failed = settled.filter(r => r.status === 'rejected').length;
    if (failed) console.warn(`[worldbank] ${indicator}: ${failed} of ${settled.length + 1} pages unavailable; showing the rest`);
    const rest = settled.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
    for (const row of [first, ...rest].flatMap(page => page.value)) {
      const market = MARKET_BY_AREA[row.REF_AREA];
      const year = Number(row.TIME_PERIOD);
      if (!market || year < 1960 || year > 2025) continue;
      const value = row.OBS_VALUE === null || row.OBS_VALUE === '' ? null : Number(row.OBS_VALUE);
      byMarket.get(market)!.push({ date: String(year), value: Number.isFinite(value) ? value : null });
    }
  } catch (error) {
    console.warn(`[worldbank] ${indicator} unavailable: ${(error as Error).message}`);
  }
  return byMarket;
}

function buildCountry(country: CountryCode, series: Record<keyof typeof INDICATORS, Map<string, ApiRow[]>>): CountryDataset {
  const values = Object.fromEntries(Object.entries(series).map(([key, map]) => [key, map.get(country) ?? []])) as Record<keyof typeof INDICATORS, ApiRow[]>;
  const years = new Set(values.gdp.map(x => Number(x.date)));
  const get = (key: keyof typeof INDICATORS, year: number) => values[key].find(x => Number(x.date) === year)?.value ?? null;
  const records = [...years].filter(y => y > 1960).sort((a, b) => a - b).map(year => {
    const gdp = get('gdp', year), marketCap = get('marketCap', year);
    return { country, year, gdp, marketCap, realGdp: get('realGdp', year), gdpGrowth: get('gdpGrowth', year), marketCapToGdp: get('marketCapToGdp', year), listedCompanies: get('listedCompanies', year), buffettIndicator: calculateBuffettIndicator(marketCap, gdp) };
  });
  return { country, name: countryNames[country], records };
}

export const getEconomics = cache(async (): Promise<EconomicsResponse> => {
  const entries = await Promise.all(Object.entries(INDICATORS).map(async ([key, indicator]) => [key, await fetchIndicator(indicator)] as const));
  const series = Object.fromEntries(entries) as Record<keyof typeof INDICATORS, Map<string, ApiRow[]>>;
  const countries = RESEARCH_MARKETS.map(([country]) => buildCountry(country, series));
  // Only treat it as a failure when nothing at all came back (API fully down).
  if (countries.every(dataset => dataset.records.length === 0)) throw new Error('World Bank API returned no data');
  return { countries, fetchedAt: new Date().toISOString() };
});
