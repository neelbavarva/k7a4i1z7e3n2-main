import { useMemo } from 'react';
import { fmtDay, fmtTime, signed } from '../format.js';
import { isFx } from '../markets.js';
import { useMore } from './EventTables.jsx';

const HOUR = 3.6e6;
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
const weekday = new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: 'short' });
const weekdayLong = new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: 'long' });

const lean = (s) => (s >= 15 ? 1 : s <= -15 ? -1 : 0);
const sideClass = (s) => (s >= 15 ? 'up' : s <= -15 ? 'down' : 'flat');

function labelFor(s) {
  const a = Math.abs(s);
  if (a < 15) return 'Neutral';
  const d = s > 0 ? 'bullish' : 'bearish';
  if (a < 40) return `Mildly ${d}`;
  if (a < 70) return d[0].toUpperCase() + d.slice(1);
  return `Strongly ${d}`;
}

/** How the lean changes between two scores. */
function trendOf(s0, s1) {
  const a0 = Math.abs(s0);
  const a1 = Math.abs(s1);
  if (a0 < 15 && a1 < 15) return { word: 'staying balanced', kind: 'flat' };
  if (lean(s1) !== 0 && lean(s1) !== lean(s0)) {
    return { word: a0 < 15 ? `building ${s1 > 0 ? 'bullish' : 'bearish'}` : `turning ${s1 > 0 ? 'bullish' : 'bearish'}`, kind: 'turn' };
  }
  if (lean(s0) !== 0 && lean(s1) === 0) return { word: 'fading to neutral', kind: 'fade' };
  if (a1 >= a0 + 8) return { word: 'strengthening', kind: 'grow' };
  if (a1 <= a0 - 8) return { word: 'fading', kind: 'fade' };
  return { word: 'holding steady', kind: 'flat' };
}

function strengthWord(v0, v1) {
  if (v1 >= v0 + 8) return 'strengthening';
  if (v1 <= v0 - 8) return 'weakening';
  return 'steady';
}

export default function Outlook({ data, K }) {
  const { pair } = data;

  const o = useMemo(() => {
    const nowHour = Math.floor(data.now / HOUR) * HOUR;
    const nowPt = data.series.find((p) => p.t === nowHour) ?? data.series.find((p) => !p.proj && p.lo != null);
    const future = data.series.filter((p) => p.t >= nowHour);
    const end = data.series.at(-1);
    const upcoming = data.events.filter((e) => Date.parse(e.t) > data.now && e.impact !== 'Holiday');
    const pointAt = (tMs) => future.find((p) => p.t >= tMs) ?? end;
    const pointBefore = (tMs) => [...future].reverse().find((p) => p.t < tMs) ?? nowPt;

    // Day-by-day, in the viewer's own time zone
    const days = [];
    let prev = nowPt.s;
    for (const p of future) {
      const key = dayKey.format(new Date(p.t));
      let d = days.at(-1);
      if (!d || d.key !== key) {
        d = { key, t: p.t, pts: [], events: [] };
        days.push(d);
      }
      d.pts.push(p);
    }
    for (const d of days) {
      const last = d.pts.at(-1);
      d.score = last.s;
      d.delta = last.s - prev;
      prev = last.s;
      d.events = upcoming
        .filter((e) => (e.impact === 'High' || e.impact === 'Medium') && dayKey.format(new Date(e.t)) === d.key)
        .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
      // Risk comes from the day's own releases: any High-impact one makes it a high-risk day.
      d.risk = d.events.some((e) => e.impact === 'High') ? 'High' : d.events.length ? 'Medium' : 'Low';
    }

    // Scenarios: where the score lands after each release with a forecast
    const scenarios = upcoming
      .filter((e) => e.sc != null && (e.impact === 'High' || e.impact === 'Medium'))
      .slice(0, 10)
      .map((e) => {
        const tMs = Date.parse(e.t);
        const at = pointAt(tMs);
        const before = pointBefore(tMs);
        return {
          e,
          before: before.s,
          inline: at.s,
          above: 100 * Math.tanh((at.r + e.sc) / K),
          below: 100 * Math.tanh((at.r - e.sc) / K),
        };
      });

    const movers = upcoming
      .filter((e) => e.ec != null && Math.abs(e.ec) >= 0.3)
      .sort((a, b) => Math.abs(b.ec) - Math.abs(a.ec))
      .slice(0, 2);

    const peak = future.reduce((m, p) => ((p.hi ?? 0) - (p.lo ?? 0) > (m.hi ?? 0) - (m.lo ?? 0) ? p : m), future[0]);
    const peakEvents = upcoming
      .filter((e) => Math.abs(Date.parse(e.t) - peak.t) <= 6 * HOUR && e.impact === 'High')
      .slice(0, 2);

    return { nowPt, end, days: days.slice(0, 8), scenarios, movers, peak, peakEvents };
  }, [data, K]);

  const [scenShown, scenMore] = useMore(o.scenarios);
  const s0 = o.nowPt.s;
  const s1 = o.end.s;
  const trend = trendOf(s0, s1);
  const fx = isFx(pair);
  const baseName = pair.name ?? pair.base;
  const pushWord = (v) => (fx ? `pushing toward ${v > 0 ? baseName : pair.quote}` : `${v > 0 ? 'bullish' : 'bearish'} for ${pair.name}`);
  const drivers = data.summary.drivers ?? [];

  return (
    <section className="outlook" aria-labelledby="outlook-title">
      <h2 id="outlook-title" className="outlook-title">Outlook for the next 7 days</h2>

      <div className="outlook-top">
      <div className="verdict">
        <p className={`verdict-line ${sideClass(s0)}`}>
          {labelFor(s0)}, {trend.word}
        </p>
        <p className="verdict-text">
          {pair.symbol} goes from <b className={sideClass(s0)}>{signed(s0)}</b> now to about{' '}
          <b className={sideClass(s1)}>{signed(s1)}</b> by {weekdayLong.format(new Date(o.end.t))}.{' '}
          {o.movers.length > 0 && (
            <>
              Biggest expected moves:{' '}
              {o.movers.map((e, i) => (
                <span key={e.id}>
                  {i > 0 && ' and '}
                  {e.ccy} {e.title} on {weekday.format(new Date(e.t))} ({e.p} → {e.f}, {pushWord(e.ec)})
                </span>
              ))}
              .{' '}
            </>
          )}
          {o.peakEvents.length > 0 && (
            <>
              Highest risk: {weekday.format(new Date(o.peak.t))} around {o.peakEvents.map((e) => `${e.ccy} ${e.title}`).join(' and ')}.
            </>
          )}
        </p>
      </div>

        <div className="strength">
          {fx ? (
            <>
              <h3>Each side of the tug-of-war</h3>
              <p className="muted small">
                Each currency's own data, −100 to +100. The pair leans toward the stronger side.{' '}
                <span className="skey">
                  <i className="skey-now" /> now <i className="skey-later" /> in 7 days
                </span>
              </p>
              <StrengthRow ccy={pair.base} now={o.nowPt.b} later={o.end.b} />
              <StrengthRow ccy={pair.quote} now={o.nowPt.q} later={o.end.q} />
            </>
          ) : (
            <>
              <h3>What's driving it</h3>
              <p className="muted small">
                How hard each kind of release is pushing {pair.name}, −100 to +100.{' '}
                <span className="skey">
                  <i className="skey-now" /> now <i className="skey-later" /> in 7 days
                </span>
              </p>
              {drivers.map((d) => (
                <StrengthRow key={d.label} ccy={d.label} now={d.now} later={d.later} driver />
              ))}
            </>
          )}
        </div>
      </div>

      <h3 className="days-title">
        Day by day <span className="swipe-hint">swipe for more</span>
      </h3>
      <ol className="days">
        {o.days.map((d, i) => {
          const shown = [...d.events.filter((e) => e.impact === 'High'), ...d.events.filter((e) => e.impact !== 'High')]
            .slice(0, 4)
            .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
          return (
            <li key={d.key} className={`day risk-${d.risk.toLowerCase()}`}>
              <div className="day-head">
                <span className="day-name">{i === 0 ? 'Today' : weekdayLong.format(new Date(d.t))}</span>
                <span className="day-date">{fmtDay(d.t)}</span>
                <span className="risk-tag">
                  <i aria-hidden="true" />
                  {d.risk} risk
                </span>
              </div>
              <div className="day-score-row">
                <span className={`day-score ${sideClass(d.score)}`}>{signed(d.score)}</span>
                <span className="day-delta">{Math.abs(d.delta) < 1 ? 'unchanged' : `${signed(d.delta)} on the day`}</span>
              </div>
              <ul className="day-events">
                {shown.map((e) => (
                  <li key={e.id} className={e.impact === 'High' ? 'hi' : ''}>
                    <time>{fmtTime(e.t)}</time>
                    <span className="day-ev-name">
                      <span className="ccy">{e.ccy}</span> {e.title}
                    </span>
                    {e.ec != null && Math.abs(e.ec) >= 0.05 ? (
                      <span className={`day-ev-dir ${e.ec > 0 ? 'up' : 'down'}`} title={pushWord(e.ec)}>
                        {e.ec > 0 ? '▲' : '▼'}
                      </span>
                    ) : (
                      <span />
                    )}
                  </li>
                ))}
                {d.events.length > shown.length && <li className="day-more">+{d.events.length - shown.length} more</li>}
                {d.events.length === 0 && <li className="day-quiet">No major releases</li>}
              </ul>
            </li>
          );
        })}
      </ol>

      {o.scenarios.length > 0 && (
        <>
          <h3 className="days-title">What each release could do</h3>
          <p className="muted small scen-note">
            Score right after the release. Above or below means a typical-size surprise (one standard deviation) versus the
            forecast. For unemployment, above forecast is bad news for that currency, and the numbers account for it.
          </p>
          <div className="scroll">
            <table className="scen stack stack-4">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Release</th>
                  <th scope="col" className="num">Forecast (prev)</th>
                  <th scope="col" className="num">Before</th>
                  <th scope="col" className="num">In line</th>
                  <th scope="col" className="num">If above</th>
                  <th scope="col" className="num">If below</th>
                </tr>
              </thead>
              <tbody>
                {scenShown.map(({ e, before, inline, above, below }) => (
                  <tr key={e.id}>
                    <td className="when c-when">
                      {weekday.format(new Date(e.t))} {fmtTime(e.t)}
                    </td>
                    <td className="c-main">
                      <span className="ccy">{e.ccy}</span> {e.title}
                      {e.impact === 'High' && <span className="impact impact-high">High</span>}
                    </td>
                    <td className="num c-sub" data-label="Forecast">
                      {e.f} <span className="muted">(prev {e.p ?? '—'})</span>
                    </td>
                    <td className="num muted" data-label="Before">
                      {signed(before)}
                    </td>
                    <Cell v={inline} label="In line" />
                    <Cell v={above} label="If above" />
                    <Cell v={below} label="If below" />
                  </tr>
                ))}
              </tbody>
            </table>
            {scenMore}
          </div>
        </>
      )}
    </section>
  );
}

function Cell({ v, label }) {
  return (
    <td className={`num scen-v ${sideClass(v)}`} data-label={label}>
      {signed(v)}
    </td>
  );
}

function StrengthRow({ ccy, now, later, driver }) {
  const word = driver
    ? Math.abs(later) >= Math.abs(now) + 8
      ? 'growing'
      : Math.abs(later) <= Math.abs(now) - 8
        ? 'fading'
        : Math.abs(now) < 2 && Math.abs(later) < 2
          ? 'quiet'
          : 'steady'
    : strengthWord(now, later);
  const x0 = 50 + now / 2;
  const x1 = 50 + later / 2;
  return (
    <div className="srow">
      <div className="srow-head">
        <span className={driver ? 'srow-label' : 'ccy'}>{ccy}</span>
        <span className="small">
          <b>{signed(now)}</b> now → <b>{signed(later)}</b> in 7 days,{' '}
          <span className="muted">{word}</span>
        </span>
      </div>
      <div className="strack" aria-hidden="true">
        <span className="strack-mid" />
        <span className="strack-move" style={{ left: `${Math.min(x0, x1)}%`, width: `${Math.abs(x1 - x0)}%` }} />
        <span className="strack-now" style={{ left: `${x0}%` }} />
        <span className="strack-later" style={{ left: `${x1}%` }} />
      </div>
    </div>
  );
}
