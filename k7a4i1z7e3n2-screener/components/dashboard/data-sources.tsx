import type { AiCapitalFlowResponse } from '@/types/economics';
import { Card } from '@/components/ui/card';

type SourceEntry = { feature: string; source: string; api: string; organization: string; description: string; limitations: string; url: string };

const WORLD_BANK_API = 'https://api.worldbank.org/v2/country/{country}/indicator/{indicator}?format=json';

export function DataSources({ aiSource }: { aiSource: AiCapitalFlowResponse['source'] | undefined }) {
  const entries: SourceEntry[] = [
    { feature: 'GDP', source: 'World Development Indicators · NY.GDP.MKTP.CD', api: WORLD_BANK_API, organization: 'World Bank', description: 'Annual nominal gross domestic product in current US dollars.', limitations: 'Annual observations; revisions and reporting lags are possible. Values are nominal, not inflation-adjusted.', url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD' },
    { feature: 'GDP growth', source: 'World Development Indicators · NY.GDP.MKTP.KD.ZG', api: WORLD_BANK_API, organization: 'World Bank', description: 'Annual real GDP growth rate.', limitations: 'Annual; based on constant-price national accounts and subject to revisions.', url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG' },
    { feature: 'Market capitalization', source: 'World Development Indicators · CM.MKT.LCAP.CD', api: WORLD_BANK_API, organization: 'World Bank', description: 'Year-end market capitalization of listed domestic companies in current US dollars.', limitations: 'Annual and coverage differs materially by market; regional aggregates can be incomplete.', url: 'https://data.worldbank.org/indicator/CM.MKT.LCAP.CD' },
    { feature: 'Buffett indicator', source: 'Calculated in Kaizen from World Bank GDP and market capitalization', api: 'No separate API', organization: 'Kaizen calculation', description: 'Market capitalization divided by nominal GDP, expressed as a percentage.', limitations: 'A broad valuation context, not a universal fair-value target; inherits both underlying series’ coverage gaps.', url: 'https://data.worldbank.org/indicator/CM.MKT.LCAP.CD' },
    { feature: 'Relative / valuation views', source: 'Derived from World Bank GDP, market cap, and growth series', api: WORLD_BANK_API, organization: 'World Bank / Kaizen calculation', description: 'Indexed comparisons and GDP-growth versus Buffett scatter use the same annual observations displayed elsewhere.', limitations: 'Indexes use the first available point in the selected window; comparisons are descriptive, not causal.', url: 'https://api.worldbank.org/' },
    { feature: 'AI Capital Flow', source: aiSource?.name ?? 'OECD.AI', api: aiSource?.url ?? 'https://oecd.ai/en/data', organization: 'OECD.AI; underlying published VC series uses Preqin data', description: 'Annual venture-capital investment into AI start-ups. Broader AI investment is displayed only when a provider reports it separately.', limitations: `Annual, not real-time. ${aiSource?.latestObservationYear ? `Current loaded coverage ends in ${aiSource.latestObservationYear}.` : 'No compatible public machine-readable series is currently loaded.'} Country and regional coverage can be unavailable; no gaps are estimated.`, url: aiSource?.url ?? 'https://oecd.ai/en/data' }
    // Crypto Market Cap source entry is intentionally parked with the feature.
  ];

  return <section className="mb-3 pt-2">
    <Card className="overflow-hidden border-slate-200">
      <div className="border-b border-slate-200 px-3 py-2"><h2 className="text-xs font-semibold text-slate-800">Data sources</h2><p className="mt-0.5 text-[10px] text-slate-400">Definitions, providers, coverage, and limitations</p></div>
      <div className="divide-y divide-slate-200">
        {entries.map(entry => <details key={entry.feature} className="group">
          <summary className="flex min-h-[44px] select-none cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100/80"><span>{entry.feature}</span><span className="font-mono text-[10px] text-slate-400 transition-transform group-open:rotate-45">+</span></summary>
          <div className="grid gap-3 border-t border-slate-200 bg-slate-50/50 px-3 py-3 text-[10px] leading-5 text-slate-600 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.2fr)_minmax(0,1.55fr)]">
            <div><p><span className="font-medium text-slate-800">Source:</span> {entry.source}</p><p className="mt-1"><span className="font-medium text-slate-800">Maintained by:</span> {entry.organization}</p></div>
            <div><p><span className="font-medium text-slate-800">What it measures:</span> {entry.description}</p></div>
            <div><p><span className="font-medium text-slate-800">API / provider:</span> <a className="break-all underline" href={entry.url} target="_blank" rel="noreferrer">{entry.api}</a></p><p className="mt-1"><span className="font-medium text-slate-800">Limitations:</span> {entry.limitations}</p></div>
          </div>
        </details>)}
      </div>
    </Card>
  </section>;
}
