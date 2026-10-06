import type { Metadata } from 'next';
import Link from 'next/link';
import { DocLayout, SectionLink } from '@/components/doc/contents';
import { BUBBLE_LIBRARY, CHARTED_BUBBLES } from '@/lib/bubbles/library';
import { isCountry } from '@/lib/markets';
import {
  AI_BASELINE_YEARS,
  AI_GROWTH_YEARS,
  BUFFETT_BAND,
  BUFFETT_IN_LINE_PTS,
  CACHE_HOURS,
  GAUGE_MAX_PCT,
  GROWTH_STATUS,
  TIMEFRAMES,
  TREND_BAND_PCT,
  VALUATION_Z,
} from '@/lib/model';
import { ENGINES, ROADMAP } from '@/lib/project';
import { INDICATORS } from '@/lib/worldbank/indicators';
import { MAX_ATTEMPTS, MAX_CONCURRENT, PAGE_SIZE, REF_AREA, REQUEST_TIMEOUT_MS, RESEARCH_MARKETS } from '@/lib/worldbank/client';

// Every number on this page is read from the code that computes it (lib/model.ts, the
// World Bank client, the bubble library), so the explanation can't drift from the site.

export const metadata: Metadata = {
  title: 'How the screener works',
  description: 'Where every number on Kaizen Screener comes from: the data sources, every formula and threshold, and how each part of the page is built from them.',
};

const SECTIONS = [
  ['short', 'The short version'],
  ['loading', 'How a page load works'],
  ['apis', 'Data sources and APIs'],
  ['markets', 'Markets'],
  ['range', 'Time range'],
  ['gdp', '1. GDP'],
  ['market-cap', '2. Market value'],
  ['buffett', '3. Buffett indicator'],
  ['band', '4. The 10-year band'],
  ['relative', '5. Relative'],
  ['growth', '6. Growth'],
  ['ai', '7. AI flow'],
  ['bubbles', '8. Bubbles'],
  ['valuation', '9. Valuation'],
  ['layered', 'Layered views'],
  ['status', 'Status labels'],
  ['reading', 'Reading the page'],
  ['built', 'Engines and roadmap'],
  ['stack', 'Tech stack'],
  ['settings', 'All settings'],
  ['limits', 'Limitations'],
] as const;

const F = ({ children }: { children: React.ReactNode }) => <div className="formula">{children}</div>;
const signed = (v: number) => `±${v}`;

const SHOWN: Record<keyof typeof INDICATORS, string> = {
  gdp: 'GDP view, brief, Buffett indicator, AI VC / GDP',
  realGdp: 'Fetched for future views; not shown yet',
  gdpGrowth: 'Growth view, brief, Valuation view',
  marketCap: 'Market cap view, brief, Buffett indicator',
  marketCapToGdp: 'Fetched as a cross-check; the site computes its own ratio',
  listedCompanies: 'Fetched for future views; not shown yet',
};
const INDICATOR_NAME: Record<keyof typeof INDICATORS, string> = {
  gdp: 'GDP, current US$',
  realGdp: 'GDP, constant 2015 US$',
  gdpGrowth: 'GDP growth, annual %',
  marketCap: 'Market capitalization of listed domestic companies, current US$',
  marketCapToGdp: 'Market capitalization, % of GDP',
  listedCompanies: 'Listed domestic companies, total',
};

export default function HowItWorks() {
  const W = BUFFETT_BAND.windowYears;
  const D = BUFFETT_BAND.deviations;
  const countries = RESEARCH_MARKETS.filter(([code]) => isCountry(code));
  const regions = RESEARCH_MARKETS.filter(([code]) => !isCountry(code));
  const presets = TIMEFRAMES.map(p => (p === 'MAX' ? 'Max' : `${p}Y`));
  const done = ROADMAP.filter(r => r.done).length;

  return (
    <main id="main-content" className="page">
      <div className="doc fade-in">
        <Link href="/" className="btn btn-ghost doc-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Screener
        </Link>
        <header className="doc-head">
          <h1>How the screener works</h1>
          <p className="lede">
            Everything behind the numbers: where the data comes from, every formula and threshold, and how each part of the
            page is built from them. Nothing is hand-tuned per market or per year; the same rules run for all{' '}
            {RESEARCH_MARKETS.length} markets on every view.
          </p>
        </header>

        <DocLayout sections={SECTIONS}>
          {/* ------------------------------------------------------------------ */}
          <section id="short">
            <h2>The short version</h2>
            <p>
              The screener compares how big an economy is with how much its stock market is worth. GDP measures the economy;
              market capitalization measures the value of its listed companies. Divide one by the other and you get the{' '}
              <b>Buffett indicator</b>: when it runs far above its own history, stock prices have pulled ahead of the
              economy underneath them.
            </p>
            <p>
              Around that, the page lines up real GDP growth, AI venture-capital flows and a library of past bubbles, so you
              can see whether today looks like the run-up to one of them. Everything is annual, in current US dollars unless a
              view says otherwise.
            </p>
            <p>
              It describes; it doesn’t forecast. There are no projections on the page, and no reading here is a fair-value
              target.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="loading">
            <h2>How a page load works</h2>
            <p>The page is rendered on the server, then the browser takes over for every control. Each load does this:</p>
            <ol className="steps">
              <li>
                <b>Economic data.</b> One request per indicator to the World Bank, for all {RESEARCH_MARKETS.length} markets at
                once, {PAGE_SIZE} rows a page. Up to {MAX_CONCURRENT} requests run at a time.
              </li>
              <li>
                <b>AI capital flow.</b> The OECD.AI series, read in parallel with step 1. If it fails, the rest of the page
                still loads and the AI view says it has no data.
              </li>
              <li>
                <b>Build the records.</b> For each market and year from 1961 to 2025: GDP, market value, growth, and the
                Buffett indicator computed from the first two.
              </li>
              <li>
                <b>Render.</b> The page arrives with the data inside it; every view, range and market change after that
                happens in your browser with no further requests.
              </li>
            </ol>
            <p>
              Each request gets {REQUEST_TIMEOUT_MS / 1000} seconds and up to {MAX_ATTEMPTS} attempts, waiting a little longer
              before each retry. A page of rows that still fails loses only its own rows, and an indicator that fails leaves
              only that series empty; the bar at the top names any market that came back without data. The error page appears
              only when nothing at all comes back.
            </p>
            <p>
              Every upstream answer is cached on the server for {CACHE_HOURS} hours, since the series only change a few times a
              year. <b>Refresh</b> re-renders the page from that cache, so it’s instant, but it won’t ask the World Bank again
              before the cache expires.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="apis">
            <h2>Data sources and APIs</h2>
            <p>Everything is free and public. No API keys are needed, and nothing reaches your browser except the finished data.</p>
            <div className="doc-scroll">
              <table className="t doc-table doc-stack">
                <thead>
                  <tr>
                    <th scope="col">Service</th>
                    <th scope="col">Used for</th>
                    <th scope="col">How it’s called</th>
                    <th scope="col">Limits</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td data-label="Service">
                      <b>World Bank Data360</b>
                      <div className="muted small">World Development Indicators</div>
                    </td>
                    <td data-label="Used for">GDP, real growth and stock-market value for every market.</td>
                    <td data-label="How it’s called">
                      <code className="block">data360api.worldbank.org/data360/data</code>
                      <span className="muted small">
                        DATABASE_ID=WB_WDI, one INDICATOR per request, every REF_AREA at once, paged with skip.
                      </span>
                    </td>
                    <td data-label="Limits">
                      Annual only. Latest year usually lags by one; some markets don’t report market value every year. Used in
                      place of the older v2 API, which fails for most regional requests.
                    </td>
                  </tr>
                  <tr>
                    <td data-label="Service">
                      <b>OECD.AI</b>
                      <div className="muted small">published VC baseline</div>
                    </td>
                    <td data-label="Used for">Annual venture-capital investment into AI start-ups.</td>
                    <td data-label="How it’s called">
                      Built into the site from the OECD’s published table (Digital Economy Paper, 2021, Table A.1, US$ millions).
                      If <code>OECD_AI_CAPITAL_FLOW_URL</code> is set, a live JSON feed replaces it.
                    </td>
                    <td data-label="Limits">
                      2012–2020, for the United States, the United Kingdom and Japan only. No other market or year is
                      estimated.
                    </td>
                  </tr>
                  <tr>
                    <td data-label="Service">
                      <b>Bubble library</b>
                      <div className="muted small">in the repository</div>
                    </td>
                    <td data-label="Used for">
                      {BUBBLE_LIBRARY.length} historical episodes: timelines, drawdowns, recoveries and reference paths.
                    </td>
                    <td data-label="How it’s called">
                      Static JSON in <code>data/bubbles/</code>, each value with its published source.
                    </td>
                    <td data-label="Limits">
                      {CHARTED_BUBBLES.length} of {BUBBLE_LIBRARY.length} have a published path to chart; paths are a few
                      anchor years, not full series.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>The World Bank indicators requested on every load:</p>
            <div className="doc-scroll">
              <table className="t doc-table compact">
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">Series</th>
                    <th scope="col">Where it shows</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(INDICATORS) as (keyof typeof INDICATORS)[]).map(key => (
                    <tr key={key}>
                      <td className="nowrap">
                        <code>{INDICATORS[key]}</code>
                      </td>
                      <td>{INDICATOR_NAME[key]}</td>
                      <td>{SHOWN[key]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="markets">
            <h2>Markets</h2>
            <p>
              {countries.length} countries and {regions.length + 1} aggregates: the World plus {regions.length} World Bank
              regions. Countries get a round flag; aggregates get a lettered badge. Any combination can be compared, and at
              least one market always stays selected.
            </p>
            <div className="doc-scroll">
              <table className="t doc-table compact">
                <thead>
                  <tr>
                    <th scope="col">Market</th>
                    <th scope="col">Kind</th>
                    <th scope="col">World Bank code</th>
                  </tr>
                </thead>
                <tbody>
                  {RESEARCH_MARKETS.map(([code, name]) => (
                    <tr key={code}>
                      <td>{name}</td>
                      <td>{isCountry(code) ? 'Country' : code === 'WLD' ? 'World' : 'Region'}</td>
                      <td>
                        <code>{REF_AREA[code]}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Aggregates are the World Bank’s own sums. When a member country doesn’t report market value for a year, the
              region’s total for that year is missing or understated, which is why regional Buffett readings can jump.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="range">
            <h2>Time range</h2>
            <ul>
              <li>
                <b>Presets</b>: {presets.join(', ')}. Each ends at the latest year any selected market has, and goes back that
                many years. The data is annual, so a one-year window would be a single point; the shortest preset is{' '}
                {TIMEFRAMES[0]} years.
              </li>
              <li>
                <b>Custom range</b> lays out every year with data, a decade to a row: click a first year, then a last one, and
                the band between them is the range (it follows the pointer, or the arrow keys, until you click). From and To
                pick one end again on its own; clicking a year before the start while picking the end starts over from there.
                The eras jump to each bubble in the library, from its run-up to two years after it burst.
              </li>
              <li>
                Every view except Bubbles follows the range, and so do the brief, Compared markets and the status labels.
                Bubbles are fixed historical references.
              </li>
            </ul>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="gdp">
            <h2>1. GDP</h2>
            <p>
              Nominal gross domestic product in current US dollars, straight from <code>{INDICATORS.gdp}</code>. Nominal means
              it includes inflation and exchange-rate moves: a strong dollar shrinks every other market’s GDP on this chart even
              if its economy grew.
            </p>
            <p>The axis is in US$ trillions; the brief shows the latest year and its change on the year before:</p>
            <F>change on the year = (GDP this year ÷ GDP last year − 1) × 100</F>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="market-cap">
            <h2>2. Market value</h2>
            <p>
              The year-end value of all listed domestic companies, in current US dollars (<code>{INDICATORS.marketCap}</code>
              ). It moves with share prices and with listings: a large company going public adds to it overnight. Some markets
              skip years, which shows as a gap.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="buffett">
            <h2>3. Buffett indicator</h2>
            <p>The site computes it from the two series above, for every market and year where both exist:</p>
            <F>Buffett indicator = market value ÷ GDP × 100%</F>
            <p>
              100% means the stock market is worth one year of the economy’s output. The 100% line on the chart is there for
              orientation only. Markets with a large financial centre or many global companies listed at home (the United
              States, the United Kingdom) sit well above it for decades, so each market is read against <i>its own</i>{' '}
              history (next section), not against 100%.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="band">
            <h2>4. The {W}-year band</h2>
            <p>
              Around each market’s Buffett line, a shaded band shows the range it has usually moved in. For every year t in the
              selected range:
            </p>
            <F>
              window = Buffett values from t − {W - 1} to t (fewer at the start of the range)
              <br />
              average = mean(window)
              <br />
              σ = standard deviation(window)
              <br />
              band = average ± {D} × σ, with the lower edge kept at 0% or above
            </F>
            <p>
              The dashed line inside the band is the average. A line that leaves its band means market value and GDP are
              unusually far apart for that market’s recent history, in either direction. Because the window trails, a long boom
              drags the band up behind it: the band says “unusual for the last {W} years”, not “unusual ever”.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="relative">
            <h2>5. Relative</h2>
            <p>GDP and market value on one chart, each rebased so their first year in the range is 100:</p>
            <F>index(t) = value(t) ÷ value(first year with data) × 100</F>
            <p>
              Solid lines are GDP, dashed lines market value, in each market’s colour. When the dashed line climbs away from the
              solid one, the stock market has grown faster than the economy since the start of the range, which is the same
              story the Buffett indicator tells, without the absolute level.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="growth">
            <h2>6. Growth</h2>
            <p>
              Real (inflation-adjusted) GDP growth for each year, as published (<code>{INDICATORS.gdpGrowth}</code>). One bar per
              market per year, grouped side by side; the line at zero marks contraction. The brief’s figure under it is the
              plain average over the years in range.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="ai">
            <h2>7. AI flow</h2>
            <p>Two ways to read the same annual series, switched at the top right of the chart:</p>
            <F>
              AI VC / GDP = AI venture capital ÷ GDP × 100%
              <br />
              baseline(t) = mean of AI VC / GDP over t − {AI_BASELINE_YEARS - 1} … t (only when all {AI_BASELINE_YEARS} years
              are observed)
            </F>
            <ul>
              <li>
                <b>AI VC / GDP</b> (the default) scales the flow by the size of the economy, so markets of different sizes
                compare. The tooltip also shows it in basis points of GDP. A rise means AI funding is growing faster than the
                economy.
              </li>
              <li>
                <b>Raw VC</b> is the flow itself, in US dollars.
              </li>
              <li>
                The dashed <b>baseline</b> needs {AI_BASELINE_YEARS} observed years, so short ranges don’t have one and the
                legend leaves it out.
              </li>
              <li>
                Where a provider reports total AI investment separately, it’s used instead of venture capital alone. The
                built-in OECD table only has venture capital.
              </li>
            </ul>
            <p>The AI capital flow table under the chart, for the latest observed year:</p>
            <F>
              {AI_GROWTH_YEARS}-year growth a year = (flow ÷ flow {AI_GROWTH_YEARS} years earlier)^(1 ÷ {AI_GROWTH_YEARS}) − 1
              <br />
              change on year = flow ÷ last year’s flow − 1
            </F>
            <p>Blank cells weren’t published. They are never filled in or estimated.</p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="bubbles">
            <h2>8. Bubbles</h2>
            <p>
              {BUBBLE_LIBRARY.length} past episodes, each with when it started, peaked and crashed, the largest fall, how long
              recovery took, what set it off, a timeline of major events and the sources behind every figure. The table and
              research notes appear under the chart when Bubbles is on.
            </p>
            <p>For the chart, each episode’s published benchmark (an index or a price) is rescaled to its own peak:</p>
            <F>
              path value = benchmark ÷ benchmark at the peak × 100
              <br />
              across = years from that episode’s peak (0 = the peak)
            </F>
            <ul>
              <li>Every year between gets its own slot, so the axis is to scale even where a path has only a few anchor years.</li>
              <li>
                Lines join the published observations, so they show the shape of the run-up and the fall, not every year in
                between.
              </li>
              <li>
                The benchmarks differ (NASDAQ, Case-Shiller, Nikkei), so compare shapes, not levels.
                {BUBBLE_LIBRARY.length > CHARTED_BUBBLES.length &&
                  ` ${BUBBLE_LIBRARY.filter(b => !CHARTED_BUBBLES.includes(b)).map(b => b.name).join(', ')} has no published path yet, so it appears in the table only.`}
              </li>
            </ul>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="valuation">
            <h2>9. Valuation</h2>
            <p>
              A scatter instead of a timeline: one dot per market per year in range, across for real GDP growth, up for the
              Buffett indicator. The dashed lines mark 0% growth and the 100% Buffett level.
            </p>
            <p>
              Dots high and to the left are years when the stock market was valued richly while the economy grew slowly, the
              corner where past bubbles tended to sit. Hover a dot for its exact values.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="layered">
            <h2>Layered views</h2>
            <p>
              Views can be combined: click more than one in the switcher and they share one chart. A view that’s on turns off
              with another click, and one always stays on.
            </p>
            <ul>
              <li>
                <b>Same units</b> (say GDP and market cap) are drawn as they are.
              </li>
              <li>
                <b>Mixed units</b> share one axis, so every dollar series (GDP, market cap, AI VC) is indexed to its first year
                in range = 100, and percentages (Buffett, growth) stay as they are. The legend says so, and the tooltip
                gives each series’ own value.
              </li>
              <li>
                <b>Bubbles</b> layered onto markets sit on their real calendar years, so they only show where they overlap the
                range.
              </li>
              <li>
                <b>Valuation</b> is a scatter with no time axis, so it takes over the chart when it’s on.
              </li>
            </ul>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="status">
            <h2>Status labels</h2>
            <p>
              To the right of the chart title, a reading says where each market’s latest year in range stands against its own
              history. One or two show inline; with more, a <b>Readings</b> button shows one dot per reading and opens the full
              table (Esc closes it). A blue dot leans up, a red one down (for Buffett, red means richly valued), grey is in line.
              Each view uses its own rule:
            </p>
            <div className="doc-scroll">
              <table className="t doc-table compact">
                <thead>
                  <tr>
                    <th scope="col">View</th>
                    <th scope="col">Compared with</th>
                    <th scope="col">Labels</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>GDP, market cap</td>
                    <td>A straight-line trend fitted to the years in range</td>
                    <td>
                      Above / below trend when more than {TREND_BAND_PCT}% off it, with the gap; otherwise at trend
                    </td>
                  </tr>
                  <tr>
                    <td>Buffett</td>
                    <td>The mean and σ of the last {W} years in range</td>
                    <td>
                      z = (latest − mean) ÷ σ. Overvalued above +{VALUATION_Z.stretched}, extreme above +{VALUATION_Z.extreme};
                      undervalued and extreme below the same on the other side; fair value between
                    </td>
                  </tr>
                  <tr>
                    <td>Growth</td>
                    <td>The {GROWTH_STATUS.windowYears}-year average, including the latest year</td>
                    <td>
                      Accelerating / slowing when more than {GROWTH_STATUS.deadBandPts} points away, with the gap;
                      otherwise steady
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              They describe the data in range, so changing the range can change the label: a trend fitted to 50 years is not
              the one fitted to 10.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="reading">
            <h2>Reading the page</h2>
            <h3>Top</h3>
            <ul>
              <li>
                <b>The bar</b> says when the data was loaded and the latest year in it, or which markets came back empty.
              </li>
              <li>
                <b>Markets</b> (or ⌘K / Ctrl K anywhere) opens the picker: type to filter, arrows to move, Enter to add or
                remove.
              </li>
              <li>The title names up to three selected markets; “+ more” opens the picker for the rest.</li>
            </ul>
            <h3>Brief</h3>
            <ul>
              <li>
                Four figures for one market, the latest year in range with GDP data. With several markets selected, click a
                row in Compared markets to switch which one it describes.
              </li>
              <li>
                <b>Buffett indicator</b> is compared with that market’s average over the {W} years up to it (from its full
                history, not only the range). Within {BUFFETT_IN_LINE_PTS} points reads “in line”.
              </li>
              <li>
                <b>Real GDP growth</b> shows the latest year and the average over the range.
              </li>
            </ul>
            <h3>Chart</h3>
            <ul>
              <li>Hover (or tap) for the values in that year. Drag to move through time.</li>
              <li>
                Zoom with a pinch, on a touchscreen or trackpad, or hold ⌘ / Ctrl and scroll. A plain scroll moves the page,
                never the chart.
              </li>
              <li>
                <b>Reset</b> puts the view back; <b>Expand</b> opens the chart full screen (Esc closes it).
              </li>
            </ul>
            <h3>Compared markets</h3>
            <ul>
              <li>
                The gauge places each market’s Buffett indicator on a 0–{GAUGE_MAX_PCT}% track with 100% in the middle. The
                bar runs from 100% to the value; the ring is the market’s own {W}-year average.
              </li>
              <li>GDP and market value show the change on the year before. × removes a market.</li>
            </ul>
            <h3>Data sources</h3>
            <p>
              At the bottom of the screener, each series opens to show its source, what it measures, its limitations and the
              exact API. See also <SectionLink id="apis">Data sources and APIs</SectionLink>.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="built">
            <h2>Engines and roadmap</h2>
            <p>
              The code is split into engines, each with one job. Data flows one way through them; none reaches back up the
              chain. The first {ENGINES.filter(e => e.onScreen).length} drive everything on the screener today. The rest are
              built and tested, and come to the screen in the next version.
            </p>
            <ol className="pipeline">
              {ENGINES.map(engine => (
                <li key={engine.name}>
                  <b>{engine.name}</b>
                  <span>
                    {engine.desc}
                    {!engine.onScreen && <span className="muted">Not on screen yet</span>}
                  </span>
                </li>
              ))}
            </ol>
            <p>
              {done} of {ROADMAP.length} phases are done:
            </p>
            <div className="doc-scroll">
              <table className="t doc-table compact">
                <tbody>
                  {ROADMAP.map(item => (
                    <tr key={item.phase}>
                      <th scope="row">{item.phase}</th>
                      <td>{item.title}</td>
                      <td className="num">{item.done ? 'Done' : <span className="muted">Planned</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="stack">
            <h2>Tech stack</h2>
            <div className="doc-scroll">
              <table className="t doc-table compact">
                <tbody>
                  <tr>
                    <th scope="row">Framework</th>
                    <td>Next.js 15 (App Router) with React 19 and TypeScript. The data loads in a server component; the page is interactive in the browser.</td>
                  </tr>
                  <tr>
                    <th scope="row">Charts</th>
                    <td>
                      TradingView Lightweight Charts 5 for the time axis, pan and zoom, with the band, area fills, bars and
                      point markers drawn on a canvas above it. The Valuation scatter is plain SVG.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Styling</th>
                    <td>Plain CSS, no UI framework: the same design system as FX Fundamental Bias.</td>
                  </tr>
                  <tr>
                    <th scope="row">Fonts</th>
                    <td>Young Serif (headings) and Instrument Sans (text), self-hosted via Fontsource.</td>
                  </tr>
                  <tr>
                    <th scope="row">Icons</th>
                    <td>Inline SVG strokes, and round flags from country-flag-icons (MIT).</td>
                  </tr>
                  <tr>
                    <th scope="row">Caching</th>
                    <td>Next.js’ fetch cache, {CACHE_HOURS} hours for every upstream request.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="settings">
            <h2>All settings</h2>
            <p>The values the site runs on right now.</p>
            <div className="doc-scroll">
              <table className="t doc-table compact">
                <thead>
                  <tr>
                    <th scope="col">Setting</th>
                    <th scope="col" className="num">
                      Value
                    </th>
                    <th scope="col">What it does</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['Timeframes', presets.join(' · '), 'The preset ranges.'],
                      ['Band window', `${W} years`, 'How far back the Buffett band and the valuation status look.'],
                      ['Band width', `${signed(D)} σ`, 'How wide the Buffett band is.'],
                      ['Valuation status', `${signed(VALUATION_Z.stretched)} / ${signed(VALUATION_Z.extreme)} σ`, 'Where fair value turns over- or undervalued, and extreme.'],
                      ['Trend status', `${signed(TREND_BAND_PCT)}%`, 'How far from trend counts as above or below it.'],
                      ['Growth status', `${GROWTH_STATUS.windowYears} years, ${signed(GROWTH_STATUS.deadBandPts)} pts`, 'The growth average, and how far from it counts as accelerating or decelerating.'],
                      ['Brief “in line”', `${signed(BUFFETT_IN_LINE_PTS)} pts`, 'How close to its average the Buffett indicator reads as in line.'],
                      ['Gauge', `0–${GAUGE_MAX_PCT}%`, 'The track in Compared markets.'],
                      ['AI baseline', `${AI_BASELINE_YEARS} years`, 'The dashed AI baseline’s window.'],
                      ['AI growth', `${AI_GROWTH_YEARS} years`, 'The compounding period in the AI table.'],
                      ['Cache', `${CACHE_HOURS} h`, 'How long upstream answers are reused.'],
                      ['Requests', `${MAX_CONCURRENT} at once, ${MAX_ATTEMPTS} tries`, `${REQUEST_TIMEOUT_MS / 1000} s each, ${PAGE_SIZE} rows a page.`],
                    ] as const
                  ).map(([k, v, d]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td className="num nowrap">{v}</td>
                      <td>{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="limits">
            <h2>Limitations</h2>
            <ul>
              <li>Annual data only, and the latest year usually lags by one. Nothing here is real-time.</li>
              <li>
                Values are nominal US dollars, so exchange rates move every non-US market. A falling currency can make an economy
                look like it shrank.
              </li>
              <li>
                Market value counts companies listed at home. Markets whose big companies list abroad look small; markets that
                host global listings look large.
              </li>
              <li>Regional aggregates have gaps when members don’t report, and can jump when they start.</li>
              <li>AI venture capital covers three countries and ends in 2020 unless a live feed is configured.</li>
              <li>Bubble paths are a few published anchor years, not continuous series.</li>
              <li>
                The status labels compare a market with its own recent past. They don’t say what any market is worth, and a
                market can stay “overvalued” for years.
              </li>
            </ul>
            <p className="muted">This is an educational research tool, not financial advice.</p>
          </section>
        </DocLayout>
      </div>

      <footer className="footer">
        <p>
          Economic data: World Bank World Development Indicators via the Data360 API. AI venture capital: OECD.AI. Bubble paths: the
          published sources listed with each episode.
        </p>
        <p className="muted">
          <Link href="/">Back to the screener</Link>
        </p>
      </footer>
    </main>
  );
}
