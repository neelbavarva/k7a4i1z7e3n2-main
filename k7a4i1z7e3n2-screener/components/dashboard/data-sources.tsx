import type { AiCapitalFlowResponse } from '@/types/economics';
import { ChevronDown } from '@/components/ui/icons';

type SourceEntry = {
  feature: string;
  source: string;
  api: string;
  organization: string;
  description: string;
  limitations: string;
  url: string;
};

const WORLD_BANK_API = 'https://data360api.worldbank.org/data360/data?DATABASE_ID=WB_WDI&INDICATOR=WB_WDI_{indicator}&REF_AREA={area}';

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
      url: 'https://data360.worldbank.org/',
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
    <section className="card section" aria-labelledby="sources-title">
      <div className="card-head">
        <div>
          <h2 id="sources-title">Data sources</h2>
          <p>Where each number comes from, what it measures, and what it can’t tell you.</p>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        {entries.map(entry => (
          <details key={entry.feature} className="disc">
            <summary>
              <span>
                {entry.feature} <span className="muted">· {entry.organization}</span>
              </span>
              <ChevronDown className="chev" />
            </summary>
            <dl className="disc-body">
              <div>
                <dt>Source</dt>
                <dd>{entry.source}</dd>
              </div>
              <div>
                <dt>What it measures</dt>
                <dd>{entry.description}</dd>
              </div>
              <div>
                <dt>Limitations</dt>
                <dd>{entry.limitations}</dd>
              </div>
              <div className="disc-wide">
                <dt>API / provider</dt>
                <dd>
                  <a href={entry.url} target="_blank" rel="noreferrer">{entry.api}</a>
                </dd>
              </div>
            </dl>
          </details>
        ))}
      </div>
    </section>
  );
}
