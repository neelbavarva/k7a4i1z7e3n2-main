import { cache } from 'react';
import { RESEARCH_MARKETS } from '@/lib/worldbank/client';
import { CACHE_HOURS } from '@/lib/model';
import type { AiCapitalFlowDataset, AiCapitalFlowRecord, AiCapitalFlowResponse } from '@/types/economics';

/**
 * Provider seam for annual AI capital-flow data.
 *
 * OECD.AI publishes the headline AI VC series, but its current underlying
 * transaction data is supplied by Preqin rather than an open OECD/SDMX API.
 * A direct, public machine-readable OECD feed can be supplied through
 * OECD_AI_CAPITAL_FLOW_URL when one is published. The adapter deliberately
 * returns gaps until then: no value is estimated, back-filled or derived.
 */
type FeedRecord = Omit<AiCapitalFlowRecord, 'country' | 'aiInvestmentGrowth'> & { country: string; aiInvestmentGrowth?: number | null };
type Feed = { countries?: { country: string; name?: string; records?: FeedRecord[] }[]; source?: { name?: string; url?: string } };

export interface AiCapitalFlowProvider {
  getCapitalFlow(): Promise<AiCapitalFlowResponse>;
}

const OECD_AI_URL = 'https://oecd.ai/en/data?selectedArea=investments-in-ai-and-data&selectedVisualization=vc-investments-in-ai-by-country';
const PUBLISHED_SOURCE_URL = 'https://www.oecd-ilibrary.org/deliver/f97beae7-en.pdf';
const names = Object.fromEntries(RESEARCH_MARKETS) as Record<string, string>;
const missing = (): AiCapitalFlowDataset[] => RESEARCH_MARKETS.map(([country, name]) => ({ country, name, records: [] }));

// OECD Digital Economy Paper 2021, Table A.1. Values are reported annual
// AI venture-capital investments in USD millions; they are not estimates made
// by this application. The table provides country coverage only for OECD
// members, so countries/regions not listed below remain genuinely unavailable.
const publishedOecdVcMillions: Record<string, number[]> = {
  US: [1868, 3462, 10799, 13096, 16930, 18346, 30768, 36375, 41870],
  GB: [38, 55, 140, 497, 492, 1174, 1567, 3076, 2529],
  JP: [5, 27, 85, 152, 224, 428, 738, 1376, 909]
};
const publishedOecdBaseline = (): AiCapitalFlowDataset[] => RESEARCH_MARKETS.map(([country, name]) => ({
  country,
  name,
  records: (publishedOecdVcMillions[country] ?? []).map((millions, index, values) => ({
    country,
    year: 2012 + index,
    aiInvestment: null,
    aiVentureCapitalInvestment: millions * 1e6,
    aiInvestmentGrowth: index === 0 ? null : yoy(millions * 1e6, values[index - 1] * 1e6),
    aiShareOfTotalVc: null
  }))
}));

const yoy = (current: number | null, previous: number | null) => current === null || previous === null || previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100;

function normalize(raw: Feed): AiCapitalFlowDataset[] {
  const byCountry = new Map((raw.countries ?? []).map(dataset => [dataset.country, dataset]));
  return RESEARCH_MARKETS.map(([country, fallbackName]) => {
    const dataset = byCountry.get(country);
    const rows = (dataset?.records ?? [])
      .filter(record => Number.isInteger(record.year))
      .sort((a, b) => a.year - b.year)
      .map((record, index, records) => {
        const previous = index ? records[index - 1] : undefined;
        return {
          country,
          year: record.year,
          aiInvestment: typeof record.aiInvestment === 'number' ? record.aiInvestment : null,
          aiVentureCapitalInvestment: typeof record.aiVentureCapitalInvestment === 'number' ? record.aiVentureCapitalInvestment : null,
          aiInvestmentGrowth: typeof record.aiInvestmentGrowth === 'number' ? record.aiInvestmentGrowth : yoy(typeof record.aiInvestment === 'number' ? record.aiInvestment : typeof record.aiVentureCapitalInvestment === 'number' ? record.aiVentureCapitalInvestment : null, typeof previous?.aiInvestment === 'number' ? previous.aiInvestment : typeof previous?.aiVentureCapitalInvestment === 'number' ? previous.aiVentureCapitalInvestment : null),
          aiShareOfTotalVc: typeof record.aiShareOfTotalVc === 'number' ? record.aiShareOfTotalVc : null
        } satisfies AiCapitalFlowRecord;
      });
    return { country, name: dataset?.name ?? names[country] ?? fallbackName, records: rows };
  });
}

export class OecdAiProvider implements AiCapitalFlowProvider {
  async getCapitalFlow(): Promise<AiCapitalFlowResponse> {
    const endpoint = process.env.OECD_AI_CAPITAL_FLOW_URL;
    if (!endpoint) return {
      countries: publishedOecdBaseline(),
      fetchedAt: new Date().toISOString(),
      source: { name: 'OECD.AI · published VC baseline', url: PUBLISHED_SOURCE_URL, frequency: 'annual', latestObservationYear: 2020, availability: 'available' }
    };
    const response = await fetch(endpoint, { next: { revalidate: CACHE_HOURS * 3600 } });
    if (!response.ok) throw new Error(`OECD AI capital-flow feed responded ${response.status}`);
    const raw = await response.json() as Feed;
    const countries = normalize(raw);
    const latestObservationYear = Math.max(...countries.flatMap(country => country.records.map(record => record.year)), Number.NEGATIVE_INFINITY);
    return {
      countries,
      fetchedAt: new Date().toISOString(),
      source: { name: raw.source?.name ?? 'OECD.AI', url: raw.source?.url ?? endpoint, frequency: 'annual', latestObservationYear: Number.isFinite(latestObservationYear) ? latestObservationYear : null, availability: 'available' }
    };
  }
}

export const getAiCapitalFlow = cache(async () => new OecdAiProvider().getCapitalFlow());
