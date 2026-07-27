import { cache } from 'react';
import type { CryptoMarketCapRecord, CryptoMarketCapResponse } from '@/types/economics';

/**
 * Provider seam for historical global cryptocurrency market capitalization.
 *
 * The dashboard's common timeframe selector is annual, while CoinGecko's
 * endpoint returns timestamped observations. This adapter keeps the last
 * actual observation in each calendar year; it never interpolates missing
 * years or constructs a market-cap total from individual coins.
 */
export interface CryptoMarketCapProvider {
  getMarketCap(): Promise<CryptoMarketCapResponse>;
}

type CoinGeckoPayload = { market_cap_chart?: { market_cap?: Array<[number, number]> } };

const COINGECKO_GLOBAL_CHART = 'https://pro-api.coingecko.com/api/v3/global/market_cap_chart?vs_currency=usd&days=max';
const COINGECKO_DOCS = 'https://docs.coingecko.com/reference/global-market-cap-chart';

const unavailable = (): CryptoMarketCapResponse => ({
  records: [],
  fetchedAt: new Date().toISOString(),
  source: {
    name: 'CoinGecko · Global Market Cap Chart',
    url: COINGECKO_DOCS,
    frequency: 'annual',
    latestObservationYear: null,
    availability: 'unavailable'
  }
});

function normalizeAnnual(points: Array<[number, number]>): CryptoMarketCapRecord[] {
  const byYear = new Map<number, CryptoMarketCapRecord>();
  for (const [timestamp, marketCap] of points) {
    const year = new Date(timestamp).getUTCFullYear();
    if (!Number.isInteger(year) || !Number.isFinite(marketCap) || marketCap < 0) continue;
    // API points are chronological; replacing preserves the final reported
    // observation of the year rather than inventing a year-end value.
    byYear.set(year, { year, marketCap });
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

export class CoinGeckoCryptoMarketCapProvider implements CryptoMarketCapProvider {
  async getMarketCap(): Promise<CryptoMarketCapResponse> {
    // CoinGecko documents this endpoint as a paid-plan endpoint. Keep an
    // optional provider seam instead of silently substituting a different
    // metric when no credential is configured.
    const apiKey = process.env.COINGECKO_PRO_API_KEY;
    if (!apiKey) return unavailable();

    const response = await fetch(COINGECKO_GLOBAL_CHART, {
      headers: { 'x-cg-pro-api-key': apiKey },
      next: { revalidate: 300 }
    });
    if (!response.ok) throw new Error(`CoinGecko global market-cap chart responded ${response.status}`);
    const payload = await response.json() as CoinGeckoPayload;
    const records = normalizeAnnual(payload.market_cap_chart?.market_cap ?? []);
    return {
      records,
      fetchedAt: new Date().toISOString(),
      source: {
        name: 'CoinGecko · Global Market Cap Chart',
        url: COINGECKO_DOCS,
        frequency: 'annual',
        latestObservationYear: records.at(-1)?.year ?? null,
        availability: records.length ? 'available' : 'unavailable'
      }
    };
  }
}

export const getCryptoMarketCap = cache(async () => new CoinGeckoCryptoMarketCapProvider().getMarketCap());
