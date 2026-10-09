import {
  APIFY,
  JBLANKED,
  CALENDAR_URLS,
  CURRENCIES,
  INSTRUMENTS,
  LABELS,
  MAJORS,
  MODEL,
  PRICE_LEGS,
  PRICE_REQUEST_DELAY_MS,
  RETENTION,
} from '../../pipeline/config.js';
import { CATEGORIES, LOWER_IS_BETTER, NO_SIGNAL, RATE_DECISION } from '../../pipeline/rules.js';
import { CAL_CACHE_MINUTES, COLLECT_REST_MINUTES, POLL_MINUTES, REFRESH_COOLDOWN_S, STALE_HOURS } from '../constants.js';
import { Contents, useActiveSection } from './Doc.jsx';
import { DataFlow, LiveStatus, useHealth } from './Health.jsx';
import { OFFICIAL } from '../../pipeline/lib/official-series.js';
import { PROJECT_MAX_HOURS } from '../freshness.js';

// Every number on this page is read from the pipeline's own settings (pipeline/config.js
// and pipeline/rules.js), so the explanation can't drift from what the site computes.

const SECTIONS = [
  ['short', 'The short version'],
  ['flow', 'How the data flows'],
  ['status', 'Live status'],
  ['pipeline', 'The hourly pipeline'],
  ['apis', 'Data sources and APIs'],
  ['calendar', '1. Calendar'],
  ['actuals', '2. Released values'],
  ['classify', '3. Classifying releases'],
  ['surprise', '4. The surprise'],
  ['expected', '5. The expected change'],
  ['direction', '6. Which way it pushes'],
  ['time', '7. Over time'],
  ['score', '8. The score'],
  ['example', 'Worked example'],
  ['projection', 'The dotted line'],
  ['band', 'The grey range'],
  ['checker', 'Bias checker'],
  ['reading', 'Reading the site'],
  ['prices', 'Prices'],
  ['updates', 'Updates and Refresh'],
  ['stack', 'Engine and tech stack'],
  ['settings', 'All settings'],
  ['limits', 'Limitations'],
];

const F = ({ children }) => <div className="formula">{children}</div>;
const Words = ({ list }) => (
  <span className="words">
    {list.map((w) => (
      <code key={w}>{w}</code>
    ))}
  </span>
);
const signedMult = (m) => (m > 0 ? `+${m}` : `−${Math.abs(m)}`);
const days = (h) => (h === 24 ? '1 day' : h % 24 === 0 ? `${h / 24} days` : `${h} h`);
const catName = { growth: 'growth', labour: 'jobs', inflation: 'inflation', rates: 'rate decisions' };

export default function HowItWorks({ meta }) {
  const active = useActiveSection(SECTIONS);
  const health = useHealth();
  const K = MODEL.K;
  const W = MODEL.impactWeight;
  const lead = MODEL.expectationLeadHours;
  const fx = (MAJORS.length * (MAJORS.length - 1)) / 2;
  const total = fx + INSTRUMENTS.length;

  return (
    <main className="doc fade-in">
      <a href="#/all" className="btn btn-ghost doc-back">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        All markets
      </a>
      <header className="doc-head">
        <h1>How the score works</h1>
        <p className="lede">
          Everything behind the numbers: where the data comes from, every formula, every setting, and how each part of the
          site is built from them. Nothing is hand-tuned per market or per day; the same rules run for all {total} markets
          every hour.
        </p>
      </header>

      <div className="doc-layout">
        <nav className="toc" aria-label="On this page">
          <p className="toc-title">On this page</p>
          <Contents sections={SECTIONS} active={active} />
        </nav>

        <article className="doc-body">
          <details className="toc-mobile">
            <summary>On this page</summary>
            <Contents sections={SECTIONS} active={active} />
          </details>

          {/* ------------------------------------------------------------------ */}
          <section id="short">
            <h2>The short version</h2>
            <p>
              A currency pair is a tug-of-war between two economies. When one country's data beats what economists
              expected, its currency tends to gain; when it misses, it tends to lose. The score adds up those surprises,
              weights them by importance, lets them fade over a few days, and squashes the total onto a −100 to +100 scale.
            </p>
            <p>
              For forex, positive means the first currency (EUR in EUR/USD) has the stronger fundamentals. For gold,
              silver, copper, oil and the US indices, positive simply means bullish. Under ±{LABELS[0].max} is neutral.
            </p>
            <p>
              Ahead of “now”, a dotted line shows where the score is heading over the next {MODEL.forwardDays} days if
              every scheduled release comes in exactly as forecast, with a grey range showing how much a surprise could
              move it.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="flow">
            <h2>How the data flows</h2>
            <p>
              Nothing on the site is typed in by hand, and your browser never calls a data provider or holds an API key. The
              data moves in one direction, left to right:
            </p>
            <DataFlow checks={health.checks} />
            <ol className="steps">
              <li>
                <b>Sources.</b> ForexFactory publishes the week's economic calendar as a JSON feed: times, forecasts and
                previous values. Released values come first from the statistics agencies themselves (FRED for the US,
                Statistics Canada, the ONS and the ABS), then from JBlanked's calendar API and ForexFactory's calendar page
                through Apify for what the agencies don't publish, such as PMIs. Twelve Data supplies hourly prices. The
                keys live in GitHub Secrets.
              </li>
              <li>
                <b>The hourly job.</b> GitHub Actions runs <code>pipeline/run.js</code> twice an hour, at :17 and :47 UTC, and right away
                when someone presses <b>Refresh</b>. It fetches all three sources, scores every market for every hour,
                commits what it learned to the repository's <code>data/</code> folder (the site's only database), then
                builds the site and deploys it with the fresh JSON.
              </li>
              <li>
                <b>Vercel.</b> Serves the site and the JSON as static files, plus two small functions:{' '}
                <code>/api/calendar</code> passes the live calendar feed to the Calendar page (browsers can't read it
                directly) and keeps each answer {CAL_CACHE_MINUTES} minutes; <code>/api/refresh</code> starts the job or
                reports how it's doing.
              </li>
              <li>
                <b>Your browser.</b> Loads <code>meta.json</code> for the list and one market's file when you open it,
                checks for a newer <code>meta.json</code> every {POLL_MINUTES} minutes, and reloads the open page when one
                arrives.
              </li>
            </ol>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="status">
            <h2>Live status</h2>
            <p>
              These checks run now, from your browser, against the live site: the files and the two functions are fetched
              for real, and the job's sources are read from the report the last hourly run wrote into{' '}
              <code>meta.json</code>. The coloured dots in the diagram above follow the same results.
            </p>
            <LiveStatus health={health} />
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="pipeline">
            <h2>The hourly pipeline</h2>
            <p>
              A Node.js job runs twice an hour on GitHub Actions (and whenever someone presses Refresh), writes the results
              as static JSON files, and Vercel serves them to the website. Each run does five steps, in this order:
            </p>
            <ol className="steps">
              <li>
                <b>Calendar.</b> Download this week's and next week's economic calendar and merge it into the stored
                history.
              </li>
              <li>
                <b>Released values.</b> Fill in the actual numbers for releases that have come out: from the calendar feed
                itself, from the statistics agencies, from JBlanked's calendar API, from ForexFactory's calendar page
                (through Apify), or from a hand-edited file.
              </li>
              <li>
                <b>Prices.</b> Download hourly prices for {Object.keys(PRICE_LEGS).length} dollar pairs and{' '}
                {INSTRUMENTS.length} instruments.
              </li>
              <li>
                <b>Score.</b> For each of the {total} markets, compute the score for every hour from {MODEL.historyDays}{' '}
                days ago to {MODEL.forwardDays} days ahead.
              </li>
              <li>
                <b>Publish.</b> Write <code>meta.json</code> (every market with its headline numbers) and one{' '}
                <code>pairs/&lt;ID&gt;.json</code> per market, commit the history back to the repository, and deploy the
                site.
              </li>
            </ol>
            <p>
              The repository is the database: stored releases, actual values and price history live in its{' '}
              <code>data/</code> folder, and every hourly commit is a snapshot. If one step fails (a feed is down, an API
              key is missing), the others still run and the site still updates with what it has.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="apis">
            <h2>Data sources and APIs</h2>
            <p>Everything runs on free tiers. API keys live in GitHub Secrets and never reach your browser.</p>
            <div className="doc-scroll">
              <table className="doc-table doc-stack">
                <thead>
                  <tr>
                    <th scope="col">Service</th>
                    <th scope="col">Used for</th>
                    <th scope="col">How it's called</th>
                    <th scope="col">Limits</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td data-label="Service">
                      <b>ForexFactory calendar feed</b>
                      <div className="muted small">no key</div>
                    </td>
                    <td data-label="Used for">Every scheduled release: time, currency, impact (High / Medium / Low), forecast and previous value.</td>
                    <td data-label="How it's called">
                      {CALENDAR_URLS.map((u) => (
                        <code key={u} className="block">
                          {u.replace('https://', '')}
                        </code>
                      ))}
                      <span className="muted small">This week is required; next week is optional (it appears late in the week).</span>
                    </td>
                    <td data-label="Limits">One week at a time, and no actual values, which is why step 2 exists.</td>
                  </tr>
                  <tr>
                    <td data-label="Service">
                      <b>Statistics agencies</b>
                      <div className="muted small">
                        <code>FRED_API_KEY</code> (FRED only)
                      </div>
                    </td>
                    <td data-label="Used for">Released values for the big official figures in the US, Canada, the UK and Australia.</td>
                    <td data-label="How it's called">
                      <code className="block">api.stlouisfed.org · www150.statcan.gc.ca/t1/wds · ons.gov.uk · data.api.abs.gov.au</code>
                      <span className="muted small">Only for releases that are out and still waiting; one request per series.</span>
                    </td>
                    <td data-label="Limits">Free. FRED needs a free key (120 requests a minute); the others need none.</td>
                  </tr>
                  <tr>
                    <td data-label="Service">
                      <b>JBlanked</b>
                      <div className="muted small">
                        <code>JBLANKED_API_KEY</code>
                      </div>
                    </td>
                    <td data-label="Used for">Released values, relayed from ForexFactory's calendar.</td>
                    <td data-label="How it's called">
                      <code className="block">jblanked.com/news/api/{JBLANKED.source}/calendar/week/</code>
                      <span className="muted small">One request a run, for this week's calendar.</span>
                    </td>
                    <td data-label="Limits">
                      Free key covers today and this week (a date range needs paid credits). A small independent service:
                      when it's down, Apify takes over.
                    </td>
                  </tr>
                  <tr>
                    <td data-label="Service">
                      <b>Apify</b>
                      <div className="muted small">
                        <code>APIFY_TOKEN</code>
                      </div>
                    </td>
                    <td data-label="Used for">Released values, read from ForexFactory's calendar page.</td>
                    <td data-label="How it's called">
                      <code className="block">api.apify.com/v2/acts/{APIFY.actor}/run-sync-get-dataset-items</code>
                      <span className="muted small">
                        One day and the currencies waiting, Medium impact and up, {APIFY.memoryMb / 1024} GB, at most{' '}
                        {APIFY.maxRunsPerJob} runs an hour.
                      </span>
                    </td>
                    <td data-label="Limits">
                      Free plan: $5 of usage a month, checked before every run; the job stops asking with{' '}
                      {`$${APIFY.reserveUsd.toFixed(2)}`} left.
                    </td>
                  </tr>
                  <tr>
                    <td data-label="Service">
                      <b>Twelve Data</b>
                      <div className="muted small">
                        <code>TWELVE_DATA_KEY</code>
                      </div>
                    </td>
                    <td data-label="Used for">Hourly closing prices for the chart under the score.</td>
                    <td data-label="How it's called">
                      <code className="block">api.twelvedata.com/time_series</code>
                      <span className="muted small">interval 1h, time zone UTC</span>
                    </td>
                    <td data-label="Limits">
                      Free tier: 8 requests a minute, 800 a day. The site uses {Object.keys(PRICE_LEGS).length + INSTRUMENTS.length}{' '}
                      an hour, {PRICE_REQUEST_DELAY_MS / 1000} s apart.
                    </td>
                  </tr>
                  <tr>
                    <td data-label="Service">
                      <b>GitHub Actions</b>
                    </td>
                    <td data-label="Used for">Runs the hourly job, then builds and deploys the site.</td>
                    <td data-label="How it's called">
                      Cron <code>17,47 * * * *</code>: twice an hour (GitHub sometimes skips a scheduled run, so the second covers it), plus a manual “Run workflow” button.
                    </td>
                    <td data-label="Limits">Free for public repositories. Runs never overlap.</td>
                  </tr>
                  <tr>
                    <td data-label="Service">
                      <b>GitHub Pages</b>
                    </td>
                    <td data-label="Used for">Hosts the website and its JSON data.</td>
                    <td data-label="How it's called">Static files only; no server code.</td>
                    <td data-label="Limits">Free.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="calendar">
            <h2>1. Calendar</h2>
            <p>
              The site keeps releases for {[...CURRENCIES].filter((c) => c !== 'CNY').join(', ')}, plus China (CNY), whose
              factory data drives silver, copper and oil. Everything else in the feed is ignored.
            </p>
            <ul>
              <li>
                <b>Identity.</b> Each release gets a fixed id, a hash of its title, currency and UTC time, so the same release
                seen on two runs is recognised as one.
              </li>
              <li>
                <b>Merging.</b> New releases are added; known ones get the latest forecast and previous value but keep any
                actual value already found. A release the feed no longer lists inside the week it covers, with no actual yet,
                was rescheduled or cancelled, so it's removed.
              </li>
              <li>
                <b>Numbers.</b> Values like <code>0.3%</code>, <code>201K</code> and <code>-116.3B</code> are read as plain
                numbers (K thousand, M million, B billion, T trillion). Where the feed gives two figures, as in{' '}
                <code>5.16|3.6</code>, the first one counts.
              </li>
              <li>
                <b>History.</b> Releases are kept for {RETENTION.eventsDays} days. That long memory is what lets the model
                learn how big a surprise usually is for each indicator (step 4).
              </li>
            </ul>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="actuals">
            <h2>2. Released values</h2>
            <p>The calendar feed never lists a release's own actual value, so five sources fill them in, tried in this order each run, each taking what the ones before it left:</p>
            <ol className="steps">
              <li>
                <b>The feed's own “previous” figure.</b> When an indicator's next release appears on the calendar, its
                “previous” value is the official (possibly revised) result of the last one. It's used once the release is at
                least an hour old and the units match.
              </li>
              <li>
                <b>Official statistics, from the agencies.</b> Free, and out minutes after each release: FRED (the St. Louis
                Fed's copy of BLS, BEA and Census figures) for the US, Statistics Canada, the ONS for the UK and the ABS for
                Australia. They cover {Object.keys(OFFICIAL).length} releases: jobs, unemployment, inflation, GDP, retail
                sales, trade and housing. Each figure must come from the release in question: FRED and the ONS say when the
                series was last published, Statistics Canada stamps each number with its release time, and for the ABS the
                latest period must be the one the release reports. Until then the release keeps waiting, so last month's
                number is never taken for this month's. Surveys (PMIs, sentiment) aren't published by agencies, so the
                next sources cover those.
              </li>
              <li>
                <b>JBlanked's calendar API.</b> A free service that relays ForexFactory's calendar with actual values. One
                request a run for this week's calendar covers the releases still waiting (High and Medium, plus anything a commodity or index counts
                on its own), matched by currency and name within {JBLANKED.matchHours} hours. A plain number is scaled
                against the forecast both calendars carry and written in the feed's own unit and decimals.
              </li>
              <li>
                <b>ForexFactory's calendar page, through Apify.</b> The backup for what JBlanked misses. The page shows each release's actual value minutes after
                it's out, under the same title, currency and time as the feed, so it matches exactly and arrives in the
                feed's own format. The <code>forexfactory-calendar</code> scraper on Apify reads it. Each run costs a few
                cents and Apify's free plan is $5 of usage a month, so the job asks only when a Medium or High
                release has been out {APIFY.minutesAfterRelease} minutes without its value, only for that day and those
                currencies, at most {APIFY.maxTries} times per release, and not at all once the month's credit is nearly
                used. Older releases wait for the feed.
              </li>
              <li>
                <b>Manual file.</b> <code>data/actuals_overrides.csv</code>, with columns{' '}
                <code>date, currency, title, actual</code>. A value entered here always wins, so any wrong number can be
                corrected by hand.
              </li>
            </ol>
            <p>
              Every value from JBlanked or Apify must be the same kind of number as the forecast (same unit, a plausible size) before
              it's accepted. A release out for {MODEL.assumeAfterHours} hour with no value yet is counted as if it came in
              exactly at forecast, which is just how an in-line print counts: its expected change stays, with no surprise.
              The tables mark it “at forecast”, the bar at the top says how many there are, and it fades like any release;
              when the real number arrives, the score moves only by how far it is from the forecast.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="classify">
            <h2>3. Classifying each release</h2>
            <p>
              Each release gets three properties from its title and impact: a <b>direction</b> d (is higher good or bad?), a{' '}
              <b>weight</b> w (how much it counts) and a <b>half-life</b> (how fast it fades). The rules are checked top to
              bottom and the first match wins:
            </p>
            <ol className="steps">
              <li>
                <b>Holidays and non-economic items</b> are skipped.
              </li>
              <li>
                <b>Lower is better</b>, d = −1: a title containing <Words list={LOWER_IS_BETTER} />. Unemployment falling is
                good news, so the sign of its surprise flips.
              </li>
              <li>
                <b>No number to score</b>: <Words list={NO_SIGNAL} />. These are shown and widen the grey range, but don't
                move the score.
              </li>
              <li>
                <b>Central bank rate decisions</b>: <Words list={RATE_DECISION} />. Weight {MODEL.rateWeight}, half-life{' '}
                {MODEL.rateHalfLifeHours} h.
              </li>
              <li>
                <b>Everything else</b>: d = +1 (higher is good), weight by impact, half-life {MODEL.halfLifeHours} h.
              </li>
            </ol>
            <div className="doc-scroll">
              <table className="doc-table compact">
                <thead>
                  <tr>
                    <th scope="col">Release</th>
                    <th scope="col" className="num">
                      Weight w
                    </th>
                    <th scope="col" className="num">
                      Half-life
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Rate decision</td>
                    <td className="num">{MODEL.rateWeight}</td>
                    <td className="num">{MODEL.rateHalfLifeHours} h</td>
                  </tr>
                  {['High', 'Medium', 'Low'].map((k) => (
                    <tr key={k}>
                      <td>{k} impact</td>
                      <td className="num">{W[k]}</td>
                      <td className="num">{W[k] ? `${MODEL.halfLifeHours} h` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              For metals, oil and indices, releases are also sorted into broad types (first match wins; rate decisions are
              always their own type):
            </p>
            <ul>
              {CATEGORIES.map((c) => (
                <li key={c.key}>
                  <b>{catName[c.key]}</b>: <Words list={c.words} />
                </li>
              ))}
            </ul>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="surprise">
            <h2>4. The surprise</h2>
            <p>
              When a number comes out, the surprise is how far it landed from the forecast, measured in typical surprises
              for that indicator, so a 50K jobs miss and a 0.1% inflation miss can be compared:
            </p>
            <F>
              z = clamp( (actual − forecast) ÷ σ , −{MODEL.zCap}, +{MODEL.zCap} )
            </F>
            <p>σ, the size of a typical surprise, is chosen in this order:</p>
            <ul>
              <li>
                <b>Rate decisions</b>: σ = {MODEL.rateSigma} percentage points, so a quarter-point surprise is one unit.
              </li>
              <li>
                <b>From the indicator's own history</b>: the standard deviation of (actual − forecast) over its stored
                releases, once there are at least {MODEL.minStatsN}.
              </li>
              <li>
                <b>Until then</b>: σ = max( |forecast − previous|, 10% of |forecast|, 0.05 ).
              </li>
            </ul>
            <p>The cap at ±{MODEL.zCap} stops a single freak number, or a data error, from dominating the score.</p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="expected">
            <h2>5. The expected change</h2>
            <p>
              Before a release, the forecast already says something: CPI expected to rise from 3.3% to 3.7% leans towards
              that currency, whatever the actual turns out to be. That lean is the expected change:
            </p>
            <F>
              e = {MODEL.consensusWeight} × clamp( (forecast − previous) ÷ σ , −{MODEL.zCap}, +{MODEL.zCap} )
            </F>
            <p>
              It counts at {MODEL.consensusWeight * 100}% of a real surprise because the consensus is largely priced in, and
              markets price it in during the run-up to the release, so the score does the same: the expected change builds up in a
              straight line over the {lead} hours ({days(lead)}) before the release and is fully in place when the number
              comes out.
            </p>
            <p>
              That's what makes every release behave as you'd expect when it's published: <b>only the surprise moves the
              score at release</b>. An in-line number changes nothing, a beat always pushes towards that currency and a miss
              always against it, even when the forecast itself was weak.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="direction">
            <h2>6. Which way it pushes each market</h2>
            <p>
              Steps 4 and 5 say whether a release was good or bad for its own economy. Each market then has a multiplier{' '}
              <b>m</b> for how that moves it.
            </p>
            <h3>Forex pairs ({fx})</h3>
            <p>
              m = +1 for data from the first currency (the base), −1 for data from the second (the quote), 0 for anything
              else. The {fx} pairs cover every combination of {MAJORS.join(', ')}, written in market convention: whichever
              comes first in that list is the base.
            </p>
            <F>pair total = base currency's own total − quote currency's own total</F>
            <p>
              That's why the site can also show each side of the tug-of-war on its own: each currency's strength from its own
              data, on the same −100 to +100 scale.
            </p>
            <h3>Metals, oil and indices ({INSTRUMENTS.length})</h3>
            <p>
              These have no second economy, so each has a driver profile: rules checked top to bottom, the first match
              decides. m is how a release that is <i>good for that economy</i> moves the market (+ the same way, − the
              opposite way). A number in the weight column replaces the release's own impact weight, so releases like crude
              inventories count even though the calendar rates them low.
            </p>
            {INSTRUMENTS.map((inst) => (
              <div key={inst.id} className="driver-block">
                <p className="driver-head">
                  <b>{inst.name}</b> <span className="muted">{inst.symbol}</span>
                </p>
                <p className="muted small">{inst.note}</p>
                <div className="doc-scroll">
                  <table className="doc-table compact">
                    <thead>
                      <tr>
                        <th scope="col">Rule</th>
                        <th scope="col">Matches</th>
                        <th scope="col" className="num">
                          m
                        </th>
                        <th scope="col" className="num">
                          Weight
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {inst.drivers.map((d, i) => (
                        <tr key={i}>
                          <td>{d.label}</td>
                          <td>
                            {d.ccy}{' '}
                            {d.title
                              ? `“${d.title.source.replace(/\\/g, '')}”`
                              : d.cat
                                ? [].concat(d.cat).map((c) => catName[c]).join(' or ')
                                : 'any scored release'}
                          </td>
                          <td className="num">{signedMult(d.mult)}</td>
                          <td className="num">{d.weight ?? 'by impact'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="time">
            <h2>7. How one release plays out over time</h2>
            <p>
              Put together, a release at time t₀ with direction d, weight w, expected change e and surprise z has this effect
              at any hour t:
            </p>
            <F>
              u = d × w
              <br />
              before t₀ − {lead} h: 0
              <br />
              from t₀ − {lead} h to t₀: u × e × (hours since the build-up started ÷ {lead})
              <br />
              from t₀ on: u × (e + z) × 0.5 ^ (hours since t₀ ÷ half-life)
            </F>
            <p>
              The expected part builds up, the surprise lands at the release, and from then on both fade together, halving
              every {MODEL.halfLifeHours} h ({MODEL.rateHalfLifeHours} h for rate decisions). A release with no actual value
              yet uses z = 0.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="score">
            <h2>8. The score</h2>
            <p>Every hour, each release's effect is multiplied by the market's m and added up:</p>
            <F>
              R(t) = Σ m × effect(t)
              <br />
              score(t) = 100 × tanh( R(t) ÷ {K} )
            </F>
            <p>
              tanh is an S-curve: small totals pass through almost unchanged and large ones are squeezed, so the score can't
              run off the scale and a busy week doesn't pin every market at ±100. K = {K} sets how quickly it saturates. The
              labels:
            </p>
            <div className="doc-scroll">
              <table className="doc-table compact">
                <thead>
                  <tr>
                    <th scope="col">Score (either sign)</th>
                    <th scope="col">Label</th>
                  </tr>
                </thead>
                <tbody>
                  {LABELS.map((l, i) => {
                    const lo = i ? LABELS[i - 1].max : 0;
                    const range = !i ? `under ${l.max}` : l.max === Infinity ? `${lo} and above` : `${lo} to ${l.max}`;
                    const text = l.text === 'Neutral' ? 'Neutral' : l.text ? `${l.text} bullish / bearish` : 'Bullish / Bearish';
                    return (
                      <tr key={i}>
                        <td>{range}</td>
                        <td>{text}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="example">
            <h2>Worked example</h2>
            <p>
              US non-farm payrolls on EUR/USD, as if it were the only release: forecast 89K, previous 162K, actual 150K, and a
              typical surprise σ = 50K. It's High impact (w = {W.High}), higher jobs are good (d = +1) and USD is the quote
              currency (m = −1).
            </p>
            <F>
              expected change e = {MODEL.consensusWeight} × (89K − 162K) ÷ 50K = −0.73 (jobs growth expected to slow)
              <br />
              surprise z = (150K − 89K) ÷ 50K = +1.22 (a clear beat)
              <br />u = d × w = +{W.High}
            </F>
            <div className="doc-scroll">
              <table className="doc-table compact">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col" className="num">
                      R
                    </th>
                    <th scope="col" className="num">
                      Score
                    </th>
                    <th scope="col">What's happening</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{days(lead)} before</td>
                    <td className="num">0</td>
                    <td className="num">0</td>
                    <td>The build-up starts</td>
                  </tr>
                  <tr>
                    <td>{lead / 2} h before</td>
                    <td className="num">+1.10</td>
                    <td className="num">+9.1</td>
                    <td>Halfway: a weak US jobs forecast leans EUR/USD up</td>
                  </tr>
                  <tr>
                    <td>Just before</td>
                    <td className="num">+2.19</td>
                    <td className="num">+18.1</td>
                    <td>m × u × e = −1 × 3 × −0.73: fully priced in</td>
                  </tr>
                  <tr>
                    <td>At release</td>
                    <td className="num">−1.47</td>
                    <td className="num">−12.2</td>
                    <td>The beat lands: m × u × z = −1 × 3 × 1.22 = −3.66, the dollar gains</td>
                  </tr>
                  <tr>
                    <td>{MODEL.halfLifeHours} h later</td>
                    <td className="num">−0.74</td>
                    <td className="num">−6.1</td>
                    <td>One half-life: half the effect is left</td>
                  </tr>
                  <tr>
                    <td>{MODEL.halfLifeHours * 2} h later</td>
                    <td className="num">−0.37</td>
                    <td className="num">−3.1</td>
                    <td>Two half-lives: a quarter is left</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              On a real page dozens of releases overlap like this, and the score is their sum at each hour. The “Push” column
              in Recent surprises is the surprise part alone (here −3.66), and “Expected push” in Coming up is the expected
              part alone (here +2.19).
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="projection">
            <h2>The dotted line and the 7-day score</h2>
            <p>
              To the right of “now”, the same formula runs on scheduled releases with z = 0, as if every one lands exactly on
              its forecast. Upcoming releases build up, past news keeps fading, and the line shows where the fundamentals are
              heading if nothing surprises. Releases up to {days(lead)} past the end of the chart already start building up.
            </p>
            <ul>
              <li>
                <b>In 7 days</b>, on the overview and the market page, is the last point of that line,{' '}
                {MODEL.forwardDays * 24} hours from now.
              </li>
              <li>
                When a real number comes out, the next hourly run replaces the guess with the actual surprise and redraws the
                line from there.
              </li>
              <li>
                Releases without both a forecast and a previous value can't be projected, so they only show up in the grey
                range.
              </li>
            </ul>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="band">
            <h2>The grey range</h2>
            <p>
              The range shows how far a surprise could move the score, and when, but not which way. Around each upcoming
              release i at time tᵢ with risk weight wᵢ, it widens with a bell curve {MODEL.band.widthHours} hours wide:
            </p>
            <F>
              half-width(t) = {MODEL.band.base} + min( {MODEL.band.cap}, Σ {MODEL.band.perWeight} × wᵢ × e^−((t − tᵢ) ÷{' '}
              {MODEL.band.widthHours} h)² )
              <br />
              range = dotted line ± half-width, kept within −100…+100
            </F>
            <p>
              Risk weights match the scoring weights ({W.High} High, {W.Medium} Medium, {MODEL.rateWeight} rate decisions),
              except that speeches and statements count here too: a central bank governor speaking can move a market even
              with no number to score. For metals, oil and indices, the risk comes from their driver releases, rate
              decisions, and any High-impact release from a currency they follow.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="checker">
            <h2>Bias checker</h2>
            <p>
              The score answers “where do fundamentals stand right now?”. The bias checker answers “for a trade over the
              coming week, which side do fundamentals favour, and how strongly?”. It looks at now and every hour of the next{' '}
              {MODEL.forwardDays} days on the dotted line, so it counts both the news already out (still fading) and the
              forecasts for what's scheduled.
            </p>
            <F>
              over now and the next {MODEL.forwardDays * 24} hours (n = {MODEL.forwardDays * 24 + 1} hourly points):
              <br />
              released part = average of Σ m × effect(t) over releases already out
              <br />
              forecast part = average of Σ m × effect(t) over releases still to come (or waiting for a value)
              <br />
              bias = 100 × tanh( (released part + forecast part) ÷ {K} )
              <br />
              strength = |bias|, weight of each part = |part| ÷ (|released part| + |forecast part|)
            </F>
            <ul>
              <li>
                <b>Direction</b>: above +{LABELS[0].max} favours buying (for forex, the first currency over the second),
                below −{LABELS[0].max} favours selling, in between there's no clear bias.
              </li>
              <li>
                <b>Strength</b> from 0 to 100: under {LABELS[0].max} none, {LABELS[0].max}–{LABELS[1].max} weak,{' '}
                {LABELS[1].max}–{LABELS[2].max} moderate, {LABELS[2].max} and above strong. These are the same cut-offs as the
                score labels.
              </li>
              <li>
                <b>What it's built from</b> shows each part on the same −100 to +100 scale and its share of the weight. When
                they point opposite ways the bias is weaker than either part, and the card says so.
              </li>
              <li>
                <b>Checks</b>: whether the score now and in 7 days lean the same way as the bias; how much of the week the
                dotted line stays on that side (a tick at 75% or more, a caution from 40%); how many upcoming releases'
                forecasts lean that way; and the surprise risk from the widest point of the grey range (high from ±35,
                medium from ±20), with the releases behind it.
              </li>
            </ul>
            <p>
              Each hour of the week counts equally, so a bias that only appears late in the week counts for less than one
              that is already in place. And like the dotted line, it assumes no surprises; the surprise risk line is the
              reminder of how much a single release could change that.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="reading">
            <h2>Reading each part of the site</h2>
            <h3>Overview</h3>
            <ul>
              <li>
                <b>Bullish / Balanced / Bearish</b> groups split at ±{LABELS[0].max}.
              </li>
              <li>
                <b>Now</b> is the score this hour. <b>In 7 days</b> is the end of the dotted line, with ↗ or ↘ when it
                differs by 3 or more. <b>24h</b> is the change since this hour yesterday.
              </li>
              <li>
                <b>Next high-impact release</b> is the next High-impact release or rate decision the market listens to.
              </li>
            </ul>
            <h3>Market page</h3>
            <ul>
              <li>
                <b>Meter</b>: the solid dot is now, the dashed one is in 7 days.
              </li>
              <li>
                <b>Bias checker</b>: the side fundamentals favour over the coming week, its strength and the checks behind
                it (see <a href="#checker" onClick={(e) => jump(e, 'checker')}>Bias checker</a>).
              </li>
              <li>
                <b>Biggest push</b>: of the releases already out, the one whose surprise pushes hardest in the same direction as
                the score right now, after fading. It reads “above / below forecast” when the surprise is at least a quarter
                of a typical one, otherwise “in line”. It's empty when no released surprise supports the current lean.
              </li>
              <li>
                <b>Next big risk</b>: the next High-impact release or rate decision.
              </li>
              <li>
                <b>Outlook verdict</b>: compares the score now with the score in 7 days. Strengthening or fading means the lean
                grows or shrinks by 8 or more, turning means it crosses to the other side, and fading to neutral means it ends
                inside ±{LABELS[0].max}. The biggest expected moves are the two upcoming releases with the largest expected
                push.
              </li>
              <li>
                <b>Each side of the tug-of-war</b> (forex) shows each currency's own strength now and in 7 days.{' '}
                <b>What's driving it</b> (other markets) shows each driver rule's share of the score.
              </li>
              <li>
                <b>Day by day</b>: the score at the end of each day in your time zone, and its change on the day. A day is
                High risk if it has a High-impact release and Medium if it has a Medium one. Arrows show each release's
                expected direction.
              </li>
              <li>
                <b>What each release could do</b>: <i>Before</i> is the score the hour before the release, <i>In line</i> the
                score right after it if it matches the forecast, and <i>If above / If below</i> the score after a typical-size
                surprise (z = ±1): 100 × tanh( (R ± m × d × w) ÷ {K} ).
              </li>
              <li>
                <b>News load</b>: a spike at each hour with a scheduled release in the next {MODEL.forwardDays} days, as tall
                as the releases' summed risk weight ({MODEL.rateWeight} rate decision, {W.High} High, {W.Medium} Medium;
                speeches included), coloured by the biggest of them and marked ×2, ×3 when several land in the same hour. The
                shaded “news pressure”, amber at the foot and red near the top, is the same bell curve as the grey range (Σ wᵢ
                × e^−((t − tᵢ) ÷ {MODEL.band.widthHours} h)²), so clusters of news show up as hills. Each day is rated by its
                summed weight: quiet (none), light (under 4), busy (under 9), very busy (9 and up); the week: quiet (under
                8), moderate (under 20), busy (under 40), very busy. The height scale has a fixed floor, so a quiet market
                looks quiet. It shows when news hits, not which way it pushes.
              </li>
              <li>
                <b>Chart</b>: {MODEL.historyDays} days of hourly scores, the {MODEL.forwardDays}-day dotted line and range,
                diamonds for releases, and the price underneath on the same time axis. Hovering shows the score and the
                biggest pushes at that hour.
              </li>
              <li>
                <b>Coming up</b> lists upcoming High and Medium releases with their expected push. <b>Recent surprises</b>{' '}
                lists released ones with actual, forecast and the surprise's push.
              </li>
            </ul>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="prices">
            <h2>Prices</h2>
            <p>
              Prices are only there for context and never feed into the score. To stay inside Twelve Data's free tier, only{' '}
              {Object.keys(PRICE_LEGS).length} forex series are downloaded (
              {Object.values(PRICE_LEGS)
                .map((l) => l.symbol)
                .join(', ')}
              ) and every other pair is calculated from them:
            </p>
            <F>
              EUR/GBP = EUR/USD ÷ GBP/USD
              <br />
              CAD/JPY = USD/JPY ÷ USD/CAD
            </F>
            <p>Each metal, oil and index downloads its own series, trying symbols in order and remembering which one worked:</p>
            <ul>
              {INSTRUMENTS.map((i) => (
                <li key={i.id}>
                  <b>{i.name}</b>: {i.price.join(', then ')}
                  {i.price.length > 1 || !i.price[0].includes('/') ? ' (a fund that tracks it)' : ''}
                </li>
              ))}
            </ul>
            <p>
              The first run downloads {RETENTION.pricesDays} days of hourly closes, later runs the last 72 hours, and history
              older than {RETENTION.pricesDays} days is dropped. If a market switches symbol (spot to fund), its old history is
              cleared so two price scales are never mixed.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="updates">
            <h2>Updates and Refresh</h2>
            <ul>
              <li>New scores are published twice an hour, a few minutes after :17 and :47 UTC. Prices are fetched once an hour.</li>
              <li>
                A page left open checks for new scores every {POLL_MINUTES} minutes, and again when you come back to the tab.
              </li>
              <li>
                <b>Refresh</b>, at the top of every page, collects new data right away: it starts the same job that runs
                every hour (or joins it if it's already running), which fetches the calendar and the released values,
                scores every market and publishes the result. That takes about 2 to 3 minutes, and the page updates by
                itself when it's done. If the job finished less than {COLLECT_REST_MINUTES} minutes ago, the scores
                you see are already the latest. After each use the button rests for {REFRESH_COOLDOWN_S} seconds.
              </li>
              <li>
                The bar at the top says what the scores are made of (how many recent releases have their real number,
                and how many are counted at forecast). If the last update is more than {STALE_HOURS} hours old it turns
                amber, and every score shown becomes the projection for the hour you're in: the last update carried
                forward, with releases since counted at forecast. After {PROJECT_MAX_HOURS} hours it just says the scores
                may be out of date.
              </li>
              <li>All times on the site are shown in your own time zone.</li>
            </ul>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="stack">
            <h2>Engine and tech stack</h2>
            <div className="doc-scroll">
              <table className="doc-table compact">
                <tbody>
                  <tr>
                    <th scope="row">Data job</th>
                    <td>
                      Node.js 22 with no third-party packages: built-in <code>fetch</code>, file system and test runner.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Scheduler and hosting</th>
                    <td>GitHub Actions (hourly) and GitHub Pages (static hosting).</td>
                  </tr>
                  <tr>
                    <th scope="row">Website</th>
                    <td>React 18, built with Vite 6. Plain CSS, no UI framework.</td>
                  </tr>
                  <tr>
                    <th scope="row">Charts</th>
                    <td>Recharts 2, loaded only when a market page opens.</td>
                  </tr>
                  <tr>
                    <th scope="row">Fonts</th>
                    <td>Fraunces (headings) and IBM Plex Sans (text and figures), self-hosted via Fontsource.</td>
                  </tr>
                  <tr>
                    <th scope="row">Data files</th>
                    <td>
                      <code>meta.json</code> (all markets) and <code>pairs/&lt;ID&gt;.json</code> (hourly series, releases,
                      prices and summary), regenerated every hour.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Checks</th>
                    <td>
                      Automated tests for the formulas and for the direction of every market's reaction (a beat must push the
                      way a trader expects), plus consistency checks over every published number.
                    </td>
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
              <table className="doc-table compact">
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
                  {[
                    ['K', MODEL.K, 'Score scale: score = 100 × tanh(R ÷ K). Higher K means calmer scores.'],
                    ['Surprise cap', `±${MODEL.zCap}`, 'The most one release can count for, in typical surprises.'],
                    ['History for σ', `${MODEL.minStatsN} releases`, "Releases needed before an indicator's own surprise size is used."],
                    ['Rate decision σ', `${MODEL.rateSigma} pp`, 'A typical rate surprise: a quarter point.'],
                    ['High / Medium / Low weight', `${W.High} / ${W.Medium} / ${W.Low}`, 'How much each impact level counts.'],
                    ['Rate decision weight', MODEL.rateWeight, 'Central bank decisions count the most.'],
                    ['Half-life', `${MODEL.halfLifeHours} h`, 'Time for a release to lose half its effect.'],
                    ['Rate decision half-life', `${MODEL.rateHalfLifeHours} h`, 'Rate decisions fade over about 10 days.'],
                    ['Consensus weight', MODEL.consensusWeight, 'The expected change counts at this share of a real surprise.'],
                    ['Build-up period', `${lead} h`, 'The expected change is priced in over this long before a release.'],
                    ['Counted at forecast', `after ${MODEL.assumeAfterHours} h`, 'A release still without its value counts as an in-line print until the number arrives.'],
                    ['Late update', `${STALE_HOURS} h`, `After this, scores are projected to the hour you're in (up to ${PROJECT_MAX_HOURS} h).`],
                    ['Chart history', `${MODEL.historyDays} days`, 'How far back the chart goes.'],
                    ['Projection', `${MODEL.forwardDays} days`, 'How far ahead the dotted line goes.'],
                    [
                      'Range',
                      `${MODEL.band.base} + up to ${MODEL.band.cap}`,
                      `Base half-width plus risk bumps of ${MODEL.band.perWeight} × weight, ${MODEL.band.widthHours} h wide.`,
                    ],
                    ['Stored releases', `${RETENTION.eventsDays} days`, 'Release history kept for learning surprise sizes.'],
                    ['Stored prices', `${RETENTION.pricesDays} days`, 'Hourly price history kept.'],
                  ].map(([k, v, d]) => (
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
              <li>
                It only knows scheduled data. Geopolitics, risk sentiment, positioning, flows and surprise speeches aren't in
                it.
              </li>
              <li>
                Speeches, minutes and statements can move markets a lot but have no number to compare, so they only widen the
                range.
              </li>
              <li>
                Actual values depend on the lookups in step 2. A wrong value pushes the score the wrong way until it's
                corrected, by the official “previous” figure or the manual file.
              </li>
              <li>
                Until an indicator has {MODEL.minStatsN} stored releases, its typical surprise is estimated from forecast and
                previous, which can over- or under-state it.
              </li>
              <li>
                The calendar feed covers one week at a time, so a fresh install needs about four weeks of hourly runs before
                the {MODEL.historyDays}-day chart is full.
              </li>
              <li>The dotted line assumes no surprises at all, which never happens.</li>
            </ul>
            <p>
              Use it as a second opinion on your chart. A long setup on EUR/USD with the score at +50 has the fundamentals
              behind it; the same setup at −60 is fighting them. A wide range ahead means a release could flip the picture,
              so size accordingly or wait for the number.
            </p>
            {meta?.demo && <p className="muted">This copy of the site is running on sample data, so the numbers are made up.</p>}
            <p className="muted">This is an educational tool, not financial advice. It summarises scheduled data and can be wrong.</p>
          </section>
        </article>
      </div>
    </main>
  );
}
