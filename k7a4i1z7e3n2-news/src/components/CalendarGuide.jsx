import { CALENDAR_URLS, INSTRUMENTS, MAJORS, MODEL } from '../../pipeline/config.js';
import { LOWER_IS_BETTER, NO_SIGNAL } from '../../pipeline/rules.js';
import { CAL_CACHE_MINUTES, CAL_POLL_MINUTES, REFRESH_COOLDOWN_S } from '../constants.js';
import { zone } from '../format.js';
import { Contents, useActiveSection } from './Doc.jsx';
import { ImpactMark } from './Calendar.jsx';

// How the Economic calendar works. As on "How the score works", the numbers here are read from
// the settings the site actually runs on, so the page can't drift from what it describes.

const SECTIONS = [
  ['short', 'The short version'],
  ['source', 'Where it comes from'],
  ['row', 'Reading a row'],
  ['impact', 'Impact levels'],
  ['colours', 'Better or worse'],
  ['actuals', 'Released values'],
  ['open', 'Opening a release'],
  ['now', 'What’s out, and now'],
  ['filters', 'Filters and keys'],
  ['updates', 'Updates and Refresh'],
  ['limits', 'Limitations'],
];

const Words = ({ list }) => (
  <span className="words">
    {list.map((w) => (
      <code key={w}>{w}</code>
    ))}
  </span>
);
const days = (h) => `${h / 24} days`;

export default function CalendarGuide() {
  const active = useActiveSection(SECTIONS);
  const W = MODEL.impactWeight;
  const watched = [...new Set(INSTRUMENTS.flatMap((i) => i.drivers.map((d) => d.ccy)))];

  return (
    <main className="doc fade-in">
      <a href="#/calendar" className="btn btn-ghost doc-back">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Economic calendar
      </a>
      <header className="doc-head">
        <h1>How the calendar works</h1>
        <p className="lede">
          Where the releases come from, how fresh they are, what each column and colour means, and how a release on the
          calendar connects to the bias scores on the News side of the site.
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
              The calendar lists every scheduled economic release for this week, and next week once it's published: rate
              decisions, inflation, jobs, growth figures, central bankers' speeches and bank holidays, for every currency in
              the feed. Times are shown in your own time zone ({zone}).
            </p>
            <p>
              It's live: the page asks for the latest calendar when it opens and again every {CAL_POLL_MINUTES} minutes.
              What has already come out steps back, a line marks the present moment, and the next big release counts down
              to the second at the top.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="source">
            <h2>Where it comes from</h2>
            <p>
              The releases come from ForexFactory's public weekly calendar feed, the same one the bias scores are built on:
            </p>
            {CALENDAR_URLS.map((u) => (
              <code key={u} className="block">
                {u.replace('https://', '')}
              </code>
            ))}
            <p>
              Your browser can't read that feed directly (it doesn't allow other websites to), so the site has one small
              function of its own, <code>/api/calendar</code>, that fetches it, tidies each release (currency, impact, what
              kind of release it is, whether lower is better) and hands it to the page. Its answer is kept for{' '}
              {CAL_CACHE_MINUTES} minutes and shared by everyone, so the feed sees only a few requests an hour however many
              people have the page open.
            </p>
            <p>
              If that function can't be reached, the page falls back on the copy of the calendar saved by the hourly data
              job, and the bar at the top says so, with how old the copy is.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="row">
            <h2>Reading a row</h2>
            <div className="doc-scroll">
              <table className="doc-table doc-stack">
                <thead>
                  <tr>
                    <th scope="col">Column</th>
                    <th scope="col">What it shows</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td data-label="Column">
                      <b>Time</b>
                    </td>
                    <td data-label="What it shows">
                      When it's due, in {zone}. Releases at the same moment show the time once. Bank holidays say “All day”.
                    </td>
                  </tr>
                  <tr>
                    <td data-label="Column">
                      <b>Status</b>
                    </td>
                    <td data-label="What it shows">
                      How long until it's out (“in 2 h 14 min”), or a check and “Out” once its time has passed. The next
                      release is in darker ink.
                    </td>
                  </tr>
                  <tr>
                    <td data-label="Column">
                      <b>Cur.</b>
                    </td>
                    <td data-label="What it shows">
                      The currency whose economy it's about. “All” is for events that belong to no one country, such as OPEC
                      meetings.
                    </td>
                  </tr>
                  <tr>
                    <td data-label="Column">
                      <b>Impact</b>
                    </td>
                    <td data-label="What it shows">How much the release usually moves its currency (below).</td>
                  </tr>
                  <tr>
                    <td data-label="Column">
                      <b>Actual</b>
                    </td>
                    <td data-label="What it shows">
                      The released number, coloured by whether it was better or worse than expected for the currency. A dash
                      until it's known.
                    </td>
                  </tr>
                  <tr>
                    <td data-label="Column">
                      <b>Forecast</b>
                    </td>
                    <td data-label="What it shows">What economists expect: the consensus the actual is judged against.</td>
                  </tr>
                  <tr>
                    <td data-label="Column">
                      <b>Previous</b>
                    </td>
                    <td data-label="What it shows">The last release's number, as the feed has it now (so it may be revised).</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="impact">
            <h2>Impact levels</h2>
            <p>
              The impact is ForexFactory's own rating of how much a release tends to move its currency. The bias scores on
              the News side use it as each surprise's weight:
            </p>
            <div className="doc-scroll">
              <table className="doc-table doc-stack">
                <thead>
                  <tr>
                    <th scope="col">Level</th>
                    <th scope="col">Typically</th>
                    <th scope="col" className="num">
                      Weight in the bias score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td data-label="Level">
                      <span className="guide-imp">
                        <ImpactMark level="High" /> High
                      </span>
                    </td>
                    <td data-label="Typically">Rate decisions, inflation, payrolls, GDP: the releases that move markets most.</td>
                    <td className="num" data-label="Weight">
                      {W.High}× (rate decisions {MODEL.rateWeight}×)
                    </td>
                  </tr>
                  <tr>
                    <td data-label="Level">
                      <span className="guide-imp">
                        <ImpactMark level="Medium" /> Medium
                      </span>
                    </td>
                    <td data-label="Typically">Surveys, retail sales, trade balances, second-tier data.</td>
                    <td className="num" data-label="Weight">
                      {W.Medium}×
                    </td>
                  </tr>
                  <tr>
                    <td data-label="Level">
                      <span className="guide-imp">
                        <ImpactMark level="Low" /> Low
                      </span>
                    </td>
                    <td data-label="Typically">Minor data and regional figures. Rarely moves much on its own.</td>
                    <td className="num" data-label="Weight">
                      {W.Low ? `${W.Low}×` : 'not scored'}
                    </td>
                  </tr>
                  <tr>
                    <td data-label="Level">
                      <span className="guide-imp">
                        <ImpactMark level="Holiday" /> Holiday
                      </span>
                    </td>
                    <td data-label="Typically">Banks closed: thinner trading in that currency, and sometimes sharper moves.</td>
                    <td className="num" data-label="Weight">
                      none
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              A scored surprise fades by half every {days(MODEL.halfLifeHours)}, a rate decision's every{' '}
              {days(MODEL.rateHalfLifeHours)}. Speeches, minutes, auctions and similar releases (titles containing{' '}
              <Words list={NO_SIGNAL.slice(0, 8)} /> and a few more) have no number to beat, so they count as risk only.
              Some low-impact releases still drive a market on this site, like US crude inventories for oil or China's factory
              data for copper; opening the release says so.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="colours">
            <h2>Better or worse than expected</h2>
            <p>
              An actual is <b className="up">blue</b> when it's better than the forecast for its currency and{' '}
              <b className="down">red</b> when it's worse, in the same colours the site uses for bullish and bearish. Plain
              ink means it came in right on the forecast.
            </p>
            <p>
              Usually higher is better. For releases whose title contains <Words list={LOWER_IS_BETTER} />, lower is better:
              fewer people out of work is good news, so an unemployment rate below forecast is blue.
            </p>
            <p>
              Releases with no verdict for their currency (such as crude inventories, where a bigger number is about oil, not
              the dollar) aren't coloured.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="actuals">
            <h2>Released values</h2>
            <p>
              The feed has forecasts and previous values but no actual numbers, so the actual column fills in from what the
              site can find:
            </p>
            <ol className="steps">
              <li>
                <b>The feed itself.</b> A weekly release's next listing carries the last one as its “previous”, which is the
                official figure. This arrives a week later.
              </li>
              <li>
                <b>The hourly data job.</b> When it runs with its lookups switched on, it finds the actuals of high and
                medium impact releases soon after they're out (see “Released values” on How the score works) and saves them
                with the calendar. The page borrows them from there.
              </li>
            </ol>
            <p>
              A dash on a release that's already out means its number isn't known to the site yet. The release still counts
              as out.
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="open">
            <h2>Opening a release</h2>
            <p>Click or tap a release to open it. Three things are explained:</p>
            <ol className="steps">
              <li>
                <b>The number.</b> Before the release: the forecast against the previous value, and whether that change
                would be good or bad for the currency. After it: where the actual landed against the forecast.
              </li>
              <li>
                <b>How it counts.</b> Its weight in the bias score and how fast that fades, or why it isn't scored.
              </li>
              <li>
                <b>The markets it moves.</b> Each market on the News side that the release feeds, with the way it would
                move if the number comes in above forecast (below forecast: the reverse). Each one opens that market's page.
              </li>
            </ol>
            <p>
              Forex pairs move with their own two currencies: data from the first currency in the pair pushes it up when good,
              data from the second pushes it down. That covers every pair between {MAJORS.join(', ')}. Gold, silver, copper,
              oil and the US indices follow driver profiles instead, which listen to data from {watched.join(' and ')}; How
              the score works lists every rule.
            </p>
            <p>For a speech or a holiday, which has no number, it lists the pairs of that currency to keep an eye on.</p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="now">
            <h2>What’s out, and now</h2>
            <p>
              Everything is judged by your device's clock, not by when the calendar was fetched, so the page stays right
              while it's left open:
            </p>
            <ul>
              <li>
                A release whose time has passed shows a check and “Out”; its row steps back but keeps its actual number in
                full ink.
              </li>
              <li>Today's list has a dark “Now” line between what's out and what's next.</li>
              <li>Days that are over are folded into one line. “Done · show” opens one again.</li>
              <li>
                The strip of days at the top places each release on its day's 24 hours (taller and red for high impact),
                with a marker for the present on today. Pick a day to jump to it.
              </li>
              <li>The card at the top counts down to the next high-impact release (or medium, when no high is left).</li>
            </ul>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="filters">
            <h2>Filters and keys</h2>
            <ul>
              <li>
                <b>Search</b> matches the release name and currency (CPI, payrolls, Lagarde, USD). Press <kbd>/</kbd> to
                jump to it and <kbd>Esc</kbd> to clear it.
              </li>
              <li>
                <b>Currencies:</b> pick one or several; “All” shows every one.
              </li>
              <li>
                <b>Impact:</b> switch levels on and off. Switching off the last one shows them all again.
              </li>
              <li>The currency and impact choices are remembered on this device; the search isn't.</li>
            </ul>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="updates">
            <h2>Updates and Refresh</h2>
            <p>
              While the page is open and on screen it checks for a newer calendar every {CAL_POLL_MINUTES} minutes, and
              again when you come back to the tab. Refresh asks straight away, then rests for {REFRESH_COOLDOWN_S} seconds.
              Times, countdowns and the “Now” line move with the clock every minute (the top countdown every second).
            </p>
          </section>

          {/* ------------------------------------------------------------------ */}
          <section id="limits">
            <h2>Limitations</h2>
            <ul>
              <li>
                <b>One feed.</b> ForexFactory's feed is unofficial and covers one week at a time. Next week appears once it's
                published, usually late in the week or at the weekend.
              </li>
              <li>
                <b>Actual values lag</b> (see Released values). For a number the moment it's out, check the official source.
              </li>
              <li>
                <b>Times can move.</b> Releases are sometimes rescheduled or tentative; a holiday's time only marks its day.
              </li>
              <li>
                <b>Not financial advice.</b> The calendar says when news is due and what it could mean, never what to trade.
              </li>
            </ul>
          </section>
        </article>
      </div>
    </main>
  );
}
