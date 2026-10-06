import { SESSIONS, sessionStatus } from '../marketModel';
import { cityOfZone, formatClock, formatGmtOffset, offsetMinutes, shiftDate, zonedParts, zonedWallToUtc } from '../marketTime';
import { Contents, useActiveSection } from './doc';

const BASE = import.meta.env.BASE_URL;

const SECTIONS = [
  ['short', 'The short version'],
  ['sessions', 'The four sessions'],
  ['overlaps', 'Overlaps'],
  ['when', 'When to trade'],
  ['volume', 'The volume model'],
  ['amd', 'Accumulation, manipulation, distribution'],
  ['weekend', 'Weekends and holidays'],
  ['dst', 'Daylight saving'],
  ['using', 'Using this page'],
  ['faq', 'Questions'],
] as const;

/** Next weekday's session in UTC and the viewer's zone, so the table reflects today's DST. */
function hoursTable(timezone: string, nowMs: number, is24Hour: boolean) {
  return SESSIONS.map((s) => {
    const st = sessionStatus(s, nowMs);
    let open = st.openedAt ?? st.opensAt;
    let close = st.closesAt;
    if (open === null) {
      const d = shiftDate(zonedParts(s.timeZone, nowMs), 1);
      open = zonedWallToUtc(s.timeZone, d, s.open);
    }
    if (close === null) close = open + (s.close - s.open) * 3_600_000;
    return {
      s,
      utc: `${formatClock(open, 'UTC', is24Hour)} – ${formatClock(close, 'UTC', is24Hour)}`,
      yours: `${formatClock(open, timezone, is24Hour)} – ${formatClock(close, timezone, is24Hour)}`,
      offset: formatGmtOffset(offsetMinutes(s.timeZone, open)),
    };
  });
}

export default function Guide({ timezone, nowMs, is24Hour }: { timezone: string; nowMs: number; is24Hour: boolean }) {
  const active = useActiveSection(SECTIONS);
  const table = hoursTable(timezone, nowMs, is24Hour);
  const you = `${cityOfZone(timezone)} (${formatGmtOffset(offsetMinutes(timezone, nowMs))})`;

  return (
    <main className="doc fade-in">
      <nav className="topbar" aria-label="Back">
        <a href={`${BASE}#/`} className="btn btn-ghost doc-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Market hours
        </a>
      </nav>

      <header className="doc-head">
        <h1>How market hours work</h1>
        <p className="lede">
          Forex has no single exchange: it trades around the clock through banks in the big financial centres, from Sunday
          evening to Friday evening New York time. This page explains the four sessions, why the overlaps matter, and how the
          volume and phase charts are worked out.
        </p>
      </header>

      <div className="doc-layout">
        <aside className="toc" aria-label="On this page">
          <p className="toc-title">On this page</p>
          <Contents sections={SECTIONS} active={active} />
        </aside>

        <div className="doc-body">
          <details className="toc-mobile">
            <summary>On this page</summary>
            <Contents sections={SECTIONS} active={active} />
          </details>

          <section id="short">
            <h2>The short version</h2>
            <p>
              The trading day moves west with the sun. <b>Sydney</b> opens the week, <b>Tokyo</b> follows, <b>London</b> takes
              over as Asia closes, and <b>New York</b> joins while London is still open. Then Sydney opens again and the cycle
              repeats, five days a week.
            </p>
            <p>
              The market is busiest when two big centres are open together, above all <b>London and New York</b>. Most traders
              find the best prices and the clearest moves then, and the quietest, choppiest conditions in the gap after New York
              closes.
            </p>
          </section>

          <section id="sessions">
            <h2>The four sessions</h2>
            <p>
              Each session is shown as 8 am to 5 pm in its own city (Tokyo 9 am to 6 pm), which is roughly when that centre’s
              banks are active. Here they are in UTC and in your time, {you}, with this week’s daylight-saving settings:
            </p>
            <div className="doc-scroll">
              <table className="doc-table compact doc-stack">
                <thead>
                  <tr>
                    <th scope="col">Session</th>
                    <th scope="col">City time</th>
                    <th scope="col">UTC</th>
                    <th scope="col">Your time</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map(({ s, utc, yours, offset }) => (
                    <tr key={s.id}>
                      <td>
                        <b>{s.city}</b> <span className="muted small">{offset}</span>
                      </td>
                      <td data-label="City time">
                        {s.open === 9 ? '9 am – 6 pm' : '8 am – 5 pm'}
                      </td>
                      <td data-label="UTC" className="nowrap">
                        {utc}
                      </td>
                      <td data-label="Your time" className="nowrap">
                        {yours}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Other sources quote slightly different hours (some use Wellington for the Pacific open, or Frankfurt for Europe).
              The exact edges matter less than the shape of the day: who is in the market, and who is overlapping.
            </p>
          </section>

          <section id="overlaps">
            <h2>Overlaps</h2>
            <p>When two sessions are open at the same time, both sets of traders are active and volume adds up. There are three regular overlaps:</p>
            <ol className="steps">
              <li>
                <b>London + New York.</b> About four hours, and by far the busiest part of the day. EUR/USD, GBP/USD and USD/CHF
                usually see their biggest moves here, along with most US data releases.
              </li>
              <li>
                <b>Tokyo + London.</b> An hour or two as Asia hands over to Europe. Yen and euro crosses such as EUR/JPY and
                GBP/JPY often pick up.
              </li>
              <li>
                <b>Sydney + Tokyo.</b> The Asia-Pacific stretch: quieter overall, but the main hours for AUD, NZD and JPY pairs.
              </li>
            </ol>
            <p>The overlap row on the sessions chart and the “Best times to trade” table work these out for your day.</p>
          </section>

          <section id="when">
            <h2>When to trade</h2>
            <p>
              <b>Busy hours</b> mean tighter spreads, cheaper fills and moves large enough to plan around. <b>Quiet hours</b>{' '}
              mean wider spreads and price that can drift sideways for hours, or jump on a single large order.
            </p>
            <ul>
              <li>Trade the pairs whose currencies are “at work”: yen and Aussie pairs in Asia, euro and pound pairs in London, dollar pairs in New York.</li>
              <li>Expect the strongest moves early in London and during the London–New York overlap.</li>
              <li>Be careful in the hour after New York closes and before Sydney gets going: spreads widen and liquidity is thin.</li>
              <li>Scheduled news (central bank decisions, jobs and inflation data) can make any hour busy, whatever the session.</li>
            </ul>
          </section>

          <section id="volume">
            <h2>The volume model</h2>
            <p>
              There is no single public figure for forex volume, so the volume chart is a model of a typical day, built only from
              which sessions are open. For every five minutes of your day:
            </p>
            <div className="formula">
              activity = 0.12 + Σ (session weight × edge) for each open session
              <br />
              weights: Sydney 0.5 · Tokyo 0.8 · London 1.3 · New York 1.25
              <br />
              edge = min(1, 0.35 + 0.65 × distance from the nearer open/close ÷ half the session)
            </div>
            <p>
              The edge term makes each session ramp up after it opens and wind down before it closes, instead of switching on and
              off. The result is smoothed twice and scaled against a normal weekday’s peak, so 100 is a typical London–New York
              overlap and a weekend reads as zero.
            </p>
            <p>
              The bands are <b>Quiet</b> (under 25), <b>Light</b> (25 to 50), <b>Busy</b> (50 to 75) and <b>Very busy</b> (75 and
              up). It tells you when the market is usually active; it doesn’t know about today’s news or holidays.
            </p>
          </section>

          <section id="amd">
            <h2>Accumulation, manipulation, distribution</h2>
            <p>
              Many traders describe the day in three acts, sometimes called the “power of three”. The chart times them on New
              York’s clock, where the idea is usually taught:
            </p>
            <ol className="steps">
              <li>
                <b>Accumulation, 8 pm – 3 am New York.</b> The Asian session. Price builds a tight range while positions are
                quietly put on.
              </li>
              <li>
                <b>Manipulation, 2 am – 5 am New York.</b> Around the London open, price often pushes through one side of the Asian
                range, triggering stops, before turning.
              </li>
              <li>
                <b>Distribution, 8:30 – 11:30 am New York.</b> With New York in, the day’s real move tends to run, often the
                opposite way to the earlier fake-out.
              </li>
            </ol>
            <p>
              The shapes are drawings of that idea, not price data, and plenty of days don’t follow it. Use it as a reminder of
              what often happens around each open, not as a signal.
            </p>
          </section>

          <section id="weekend">
            <h2>Weekends and holidays</h2>
            <p>
              Forex closes from Friday 5 pm to Sunday 5 pm New York time. Over the weekend this page shows the next trading day
              (faded) so you can plan ahead, and the status bar turns amber with a countdown to the reopen.
            </p>
            <p>
              Bank holidays aren’t built in. When London or New York is closed for a holiday, that session is much quieter than
              the chart suggests, and so is the overlap.
            </p>
          </section>

          <section id="dst">
            <h2>Daylight saving</h2>
            <p>
              Sydney, London and New York change their clocks on different dates, and Sydney moves the opposite way (its summer is
              the northern winter). Tokyo doesn’t change at all. So for a few weeks each spring and autumn the gaps between
              sessions shift by an hour.
            </p>
            <p>
              The page handles this by keeping each session at its local hours and converting with your browser’s timezone data
              for the exact day shown, so the bars are right on either side of a change.
            </p>
          </section>

          <section id="using">
            <h2>Using this page</h2>
            <ul>
              <li>
                <b>Timezone:</b> picked up from your browser. Change it with the timezone bar, or press <kbd>/</kbd> (or{' '}
                <kbd>Ctrl K</kbd>) and type a city, country, abbreviation like IST or EST, or an offset like +5:30.
              </li>
              <li>
                <b>12h / 24h:</b> the switch in the status bar. Both choices are remembered on this device.
              </li>
              <li>
                <b>Time line:</b> press and drag on any chart to look at another time; every chart follows. Let go and it slides
                back to now. Double-click or press <kbd>Esc</kbd> to jump back straight away. With the keyboard, focus the
                sessions chart and use the arrow keys (Shift for an hour at a time).
              </li>
              <li>
                <b>Updates:</b> the clock and statuses refresh every 30 seconds. Nothing is downloaded: all of it is worked out in
                your browser.
              </li>
            </ul>
          </section>

          <section id="faq">
            <h2>Questions</h2>
            <h3>When does the forex market open?</h3>
            <p>Sunday at 5 pm New York time, when Sydney starts the week. In your time that is shown in the status bar over the weekend.</p>
            <h3>When does it close?</h3>
            <p>Friday at 5 pm New York time, when the New York session ends.</p>
            <h3>Is forex really open 24 hours?</h3>
            <p>
              On weekdays, yes: at any hour at least one centre is trading, or about to. But “open” isn’t the same as “busy”;
              some hours are much thinner than others.
            </p>
            <h3>What is the best session to trade?</h3>
            <p>
              For most pairs, the London session and its overlap with New York. For AUD, NZD and JPY pairs, the Asian session
              can be just as good.
            </p>
            <h3>Why do other sites show different hours?</h3>
            <p>
              There’s no official timetable. Sites pick different cities and opening hours, and some ignore daylight saving.
              The overlaps and the overall rhythm come out the same.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
