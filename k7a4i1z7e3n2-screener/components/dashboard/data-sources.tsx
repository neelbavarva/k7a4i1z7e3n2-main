import type { AiCapitalFlowResponse } from '@/types/economics';
import { Card } from '@/components/ui/card';

type SourceEntry = {
  feature: string;
  source: string;
  api: string;
  organization: string;
  description: string;
  limitations: string;
  url: string;
};

const WORLD_BANK_API = 'https://api.worldbank.org/v2/country/{country}/indicator/{indicator}?format=json';

export function DataSources({ aiSource }: { aiSource: AiCapitalFlowResponse['source'] | undefined }) {
  const entries: SourceEntry[] = [
    {
      feature: 'GDP',
      source: 'World Development Indicators · NY.GDP.MKTP.CD',
      api: WORLD_BANK_API,
      organization: 'World Bank',
      description: 'Annual nominal gross domestic product in current US dollars.',
      limitations: 'Annual observations; revisions and reporting lags are possible. Values are nominal, not inflation-adjusted.',
      url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD',
    },
    {
      feature: 'GDP growth',
      source: 'World Development Indicators · NY.GDP.MKTP.KD.ZG',
      api: WORLD_BANK_API,
      organization: 'World Bank',
      description: 'Annual real GDP growth rate.',
      limitations: 'Annual; based on constant-price national accounts and subject to revisions.',
      url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG',
    },
    {
      feature: 'Market capitalization',
      source: 'World Development Indicators · CM.MKT.LCAP.CD',
      api: WORLD_BANK_API,
      organization: 'World Bank',
      description: 'Year-end market capitalization of listed domestic companies in current US dollars.',
      limitations: 'Annual and coverage differs materially by market; regional aggregates can be incomplete.',
      url: 'https://data.worldbank.org/indicator/CM.MKT.LCAP.CD',
    },
    {
      feature: 'Buffett indicator',
      source: 'Calculated in Kaizen from World Bank GDP and market capitalization',
      api: 'No separate API',
      organization: 'Kaizen calculation',
      description: 'Market capitalization divided by nominal GDP, expressed as a percentage.',
      limitations: 'A broad valuation context, not a universal fair-value target; inherits both underlying series’ coverage gaps.',
      url: 'https://data.worldbank.org/indicator/CM.MKT.LCAP.CD',
    },
    {
      feature: 'Relative / valuation views',
      source: 'Derived from World Bank GDP, market cap, and growth series',
      api: WORLD_BANK_API,
      organization: 'World Bank / Kaizen calculation',
      description: 'Indexed comparisons and GDP-growth versus Buffett scatter use the same annual observations displayed elsewhere.',
      limitations: 'Indexes use the first available point in the selected window; comparisons are descriptive, not causal.',
      url: 'https://api.worldbank.org/',
    },
    {
      feature: 'AI Capital Flow',
      source: aiSource?.name ?? 'OECD.AI',
      api: aiSource?.url ?? 'https://oecd.ai/en/data',
      organization: 'OECD.AI; underlying published VC series uses Preqin data',
      description: 'Annual venture-capital investment into AI start-ups. Broader AI investment is displayed only when a provider reports it separately.',
      limitations: `Annual, not real-time. ${aiSource?.latestObservationYear ? `Current loaded coverage ends in ${aiSource.latestObservationYear}.` : 'No compatible public machine-readable series is currently loaded.'} Country and regional coverage can be unavailable; no gaps are estimated.`,
      url: aiSource?.url ?? 'https://oecd.ai/en/data',
    },
  ];

  return (
    <section className="mb-3 pt-2" aria-label="Data sources overview">
      <Card className="overflow-hidden">
        <div className="px-3.5 py-2.5" style={{ borderBottom: '1px solid var(--border-base)' }}>
          <h2 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Data sources</h2>
          <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Definitions, providers, coverage, and limitations</p>
        </div>
        <div style={{ borderTop: 'none' }}>
          {entries.map(entry => (
            <details key={entry.feature} className="group" style={{ borderBottom: '1px solid var(--border-base)' }}>
              <summary
                className="flex min-h-[40px] select-none cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2 text-[11px] font-medium transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
              >
                <span>{entry.feature}</span>
                <span className="font-mono text-[10px] transition-transform group-open:rotate-45" style={{ color: 'var(--text-tertiary)' }}>+</span>
              </summary>
              <div
                className="grid gap-3 px-3.5 py-3 text-[10.5px] leading-5 panel-reveal lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.2fr)_minmax(0,1.55fr)]"
                style={{
                  borderTop: '1px solid var(--border-base)',
                  background: 'var(--surface-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                <div>
                  <p><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Source:</span> {entry.source}</p>
                  <p className="mt-1"><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Maintained by:</span> {entry.organization}</p>
                </div>
                <div>
                  <p><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>What it measures:</span> {entry.description}</p>
                </div>
                <div>
                  <p>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>API / provider:</span>{' '}
                    <a className="underline text-indigo-600" href={entry.url} target="_blank" rel="noreferrer">
                      {entry.api}
                    </a>
                  </p>
                  <p className="mt-1"><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Limitations:</span> {entry.limitations}</p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </Card>
    </section>
  );
}
