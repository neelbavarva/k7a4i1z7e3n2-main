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

async function fetchIndicator(country: CountryCode, indicator: string) {
  const url = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&per_page=100&date=1960:2025`;
  const response = await fetch(url, { next: { revalidate: 86400 } });
  if (!response.ok) throw new Error(`World Bank API responded ${response.status}`);
  const json = await response.json() as [unknown, ApiRow[]];
  return Array.isArray(json[1]) ? json[1] : [];
}

async function fetchCountry(country: CountryCode): Promise<CountryDataset> {
  const pairs = await Promise.all(Object.entries(INDICATORS).map(async ([key, indicator]) => [key, await fetchIndicator(country, indicator)] as const));
  const values = Object.fromEntries(pairs) as Record<keyof typeof INDICATORS, ApiRow[]>;
  const years = new Set(values.gdp.map(x => Number(x.date)));
  const get = (key: keyof typeof INDICATORS, year: number) => values[key].find(x => Number(x.date) === year)?.value ?? null;
  const records = [...years].filter(y => y > 1960).sort((a, b) => a - b).map(year => {
    const gdp = get('gdp', year), marketCap = get('marketCap', year);
    return { country, year, gdp, marketCap, realGdp: get('realGdp', year), gdpGrowth: get('gdpGrowth', year), marketCapToGdp: get('marketCapToGdp', year), listedCompanies: get('listedCompanies', year), buffettIndicator: calculateBuffettIndicator(marketCap, gdp) };
  });
  return { country, name: countryNames[country], records };
}

export const getEconomics = cache(async (): Promise<EconomicsResponse> => ({ countries: await Promise.all(RESEARCH_MARKETS.map(([country]) => fetchCountry(country))), fetchedAt: new Date().toISOString() }));
