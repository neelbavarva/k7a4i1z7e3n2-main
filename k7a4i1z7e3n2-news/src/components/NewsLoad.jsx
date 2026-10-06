import { useMemo } from 'react';
import { Area, Bar, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useThemeColors } from '../theme.js';
import { fmtDay, fmtDayTime, fmtTime } from '../format.js';
import { useNow } from '../clock.js';

const HOUR = 3.6e6;
const SPREAD_H = 12; // the soft "pressure" hill around each release, in hours (as the grey range)
const CHART_H = 200;
const TOP = 22; // room above the tallest spike for its cap and count
const BUSY = '#e07a1f'; // between medium amber and high red, as the "Busy" day bar

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
const weekday = new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: 'short' });
const dayNum = new Intl.DateTimeFormat(undefined, { timeZone: tz, day: 'numeric' });

// How busy, from the summed weight of releases (High 3, Medium 1.5, rate decision 4)
const dayLevel = (w) => (w <= 0 ? 'Quiet' : w < 4 ? 'Light' : w < 9 ? 'Busy' : 'Very busy');
const weekLevel = (w) => (w < 8 ? 'Quiet' : w < 20 ? 'Moderate' : w < 40 ? 'Busy' : 'Very busy');
const levelClass = (l) => l.toLowerCase().replace(' ', '-');
const kindOf = (e) => (e.rate ? 'rate' : e.impact === 'High' ? 'high' : 'medium');
// the stretch around a release when the market is busy with it: positioning before, the reaction after
const WINDOW_BEFORE = 15 * 60 * 1000;
const WINDOW_AFTER = 45 * 60 * 1000;

/** Time to go, to the minute: "45 min", "2 h 14 min", "1 d 6 h". */
function timeLeft(ms) {
  const m = Math.max(1, Math.ceil(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h < 24) return mm ? `${h} h ${mm} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

/**
 * News load over the next 7 days: a spike for every hour with a scheduled release the market
 * listens to (as tall as their summed weight, coloured by the biggest, counted when several
 * share the hour), a heat-shaded area for how crowded each stretch is, and a strip under it
 * with each day's date and how busy it is. It shows when, not which way.
 */
export default function NewsLoad({ data }) {
  const c = useThemeColors();
  // the time line runs on the clock, so it keeps moving after the data was made
  const clock = useNow();
  const start = Math.floor(data.now / HOUR) * HOUR;
  const end = data.series.at(-1).t;

  const m = useMemo(() => {
    const events = data.events
      .filter((e) => {
        const t = Date.parse(e.t);
        return t > data.now && t <= end && e.w > 0 && (e.impact === 'High' || e.impact === 'Medium' || e.rate);
      })
      .map((e) => ({ ...e, ms: Date.parse(e.t), h: Math.round(Date.parse(e.t) / HOUR) * HOUR, kind: kindOf(e) }));
    // for "what's going on now": also what came out shortly before the data was made
    const recent = data.events
      .filter((e) => {
        const t = Date.parse(e.t);
        return t <= data.now && t > data.now - 2 * HOUR && e.w > 0 && (e.impact === 'High' || e.impact === 'Medium' || e.rate);
      })
      .map((e) => ({ ...e, ms: Date.parse(e.t), kind: kindOf(e) }));

    const byHour = new Map();
    for (const e of events) {
      if (!byHour.has(e.h)) byHour.set(e.h, []);
      byHour.get(e.h).push(e);
    }
    const rows = [];
    for (let t = start; t <= end; t += HOUR) {
      const here = byHour.get(t) ?? [];
      const sum = (k) => here.filter((e) => e.kind === k).reduce((a, e) => a + e.w, 0) || null;
      let pressure = 0;
      for (const e of events) {
        const d = (t - e.ms) / (SPREAD_H * HOUR);
        if (Math.abs(d) < 3) pressure += e.w * Math.exp(-d * d);
      }
      const total = here.reduce((a, e) => a + e.w, 0);
      // one spike per hour, coloured by the biggest release in it
      const top = here.some((e) => e.kind === 'rate') ? 'rate' : here.some((e) => e.kind === 'high') ? 'high' : 'medium';
      rows.push({ t, total: total || null, top, n: here.length, pressure: Math.round(pressure * 100) / 100 });
    }

    // local days across the window
    const days = [];
    for (const r of rows) {
      const key = dayKey.format(new Date(r.t));
      if (days.at(-1)?.key !== key) days.push({ key, from: r.t, to: r.t, events: [] });
      days.at(-1).to = r.t + HOUR;
    }
    for (const e of events) days.find((d) => e.ms >= d.from && e.ms < d.to)?.events.push(e);
    const span = end + HOUR - start;
    for (const d of days) {
      d.w = d.events.reduce((a, e) => a + e.w, 0);
      d.level = dayLevel(d.w);
      d.high = d.events.filter((e) => e.kind !== 'medium').length;
      d.medium = d.events.length - d.high;
      d.left = ((d.from - start) / span) * 100;
      d.width = ((d.to - d.from) / span) * 100;
    }
    const busiest = days.reduce((b, d) => (d.w > (b?.w ?? 0) ? d : b), null);
    const total = events.reduce((a, e) => a + e.w, 0);
    // a fixed floor keeps the scale comparable between markets: a lone medium release
    // stays a small spike, and only a crowded hour or day reaches the top
    const peak = Math.max(10, ...rows.map((r) => r.total ?? 0), ...rows.map((r) => r.pressure));
    const midnights = days.slice(1).map((d) => d.from);
    return { events, recent: [...recent, ...events], rows, days, busiest, total, peak, midnights };
  }, [data, start, end]);

  const high = m.events.filter((e) => e.kind !== 'medium').length;
  const medium = m.events.length - high;
  const level = weekLevel(m.total);
  const big = m.busiest?.events.filter((e) => e.kind !== 'medium') ?? [];
  const headline = (big.length ? big : m.busiest?.events ?? []).slice(0, 3).map((e) => `${e.ccy} ${e.title}`);

  return (
    <section className="chart-block newsload" aria-labelledby="nl-title">
      <div className="chart-head">
        <div>
          <h2 id="nl-title">News load, next 7 days</h2>
          <p className="muted">
            How bumpy the week ahead looks. Each spike is a scheduled release this market reacts to: taller for bigger news,
            red for high impact, with a count when several land at once. It shows when the news hits, not which way it pushes.
          </p>
        </div>
        {m.events.length > 0 && (
          <div className={`nl-rating ${levelClass(level)}`}>
            <span className="nl-rating-label">{level} week</span>
            <span className="nl-rating-sub">
              {high} high · {medium} medium
            </span>
          </div>
        )}
      </div>

      {m.events.length ? (
        <>
          <div className="legend">
            {[
              ['rate', 'Rate decision'],
              ['high', 'High impact'],
              ['medium', 'Medium impact'],
            ]
              .filter(([k]) => m.events.some((e) => e.kind === k))
              .map(([k, label]) => (
                <span key={k}>
                  <i className="dot" style={{ background: c[k] }} /> {label}
                </span>
              ))}
            <span>
              <i className="heat" /> News pressure
            </span>
          </div>

          <NowStatus events={m.recent} clock={clock} />

          <div className="nl-plot">
            <div className="chart nl-chart" style={{ height: CHART_H }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={m.rows} margin={{ top: TOP, right: 8, bottom: 0, left: 8 }} barGap={0}>
                  <defs>
                    {/* heat by height, not by hill: the scale is fixed, so only a crowded stretch reaches the red */}
                    <linearGradient id="nl-heat-fill" gradientUnits="userSpaceOnUse" x1="0" y1={TOP} x2="0" y2={CHART_H}>
                      <stop offset="0%" stopColor={c.high} stopOpacity={0.32} />
                      <stop offset="45%" stopColor={BUSY} stopOpacity={0.16} />
                      <stop offset="100%" stopColor={c.medium} stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="nl-heat-line" gradientUnits="userSpaceOnUse" x1="0" y1={TOP} x2="0" y2={CHART_H}>
                      <stop offset="0%" stopColor={c.high} />
                      <stop offset="50%" stopColor={BUSY} />
                      <stop offset="100%" stopColor={c.medium} stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" type="number" scale="time" domain={[start, end + HOUR]} hide />
                  <YAxis hide domain={[0, Math.ceil(m.peak * 1.08)]} />
                  {m.midnights.map((t) => (
                    <ReferenceLine key={t} x={t} stroke={c.axis} strokeOpacity={0.7} strokeDasharray="2 4" />
                  ))}
                  <Area
                    dataKey="pressure"
                    type="monotone"
                    stroke="url(#nl-heat-line)"
                    strokeWidth={1.5}
                    fill="url(#nl-heat-fill)"
                    fillOpacity={1}
                    isAnimationActive={false}
                    activeDot={false}
                  />
                  <Bar dataKey="total" barSize={9} shape={<Spike colors={c} clock={clock} />} isAnimationActive={false} />
                  <ReferenceLine y={0} stroke={c.axis} />
                  <Tooltip content={<LoadTooltip events={m.events} />} cursor={{ stroke: c.ink2, strokeOpacity: 0.35, strokeDasharray: '3 3' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* the days double as the time axis: date, how busy, and what's on */}
            <div className="nl-days" aria-label="How busy each day is">
              {m.days.map((d) => (
                <div
                  key={d.key}
                  className={`nl-day ${levelClass(d.level)}${d.width < 9 ? ' tiny' : ''}${d.to <= clock ? ' is-past' : ''}`}
                  style={{ left: `${d.left}%`, width: `${d.width}%` }}
                  title={`${weekday.format(new Date(d.from))} ${dayNum.format(new Date(d.from))}: ${d.level}${
                    d.events.length ? ` (${d.high} high, ${d.medium} medium)` : ''
                  }`}
                >
                  <span className="nl-day-bar" />
                  {d.width >= 9 && (
                    // level and counts are hidden on phones (see styles.css); the key below explains the colours
                    <>
                      <span className="nl-day-date">
                        {weekday.format(new Date(d.from))} {dayNum.format(new Date(d.from))}
                      </span>
                      <span className="nl-day-name">{d.level}</span>
                      <span className="nl-day-count">
                        {d.events.length ? `${d.high ? `${d.high} high` : ''}${d.high && d.medium ? ' · ' : ''}${d.medium ? `${d.medium} med` : ''}` : 'no major news'}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>

            <NowLine start={start} end={end + HOUR} clock={clock} />
          </div>

          <div className="nl-key" aria-hidden="true">
            {['Quiet', 'Light', 'Busy', 'Very busy'].map((l) => (
              <span key={l} className={`nl-day ${levelClass(l)}`}>
                <span className="nl-day-bar" />
                {l}
              </span>
            ))}
          </div>

          {m.busiest && m.busiest.w > 0 && (
            <p className="nl-summary">
              Busiest: <b>{fmtDay(m.busiest.from + HOUR)}</b>
              {headline?.length ? <> with {headline.join(', ')}</> : null}.
            </p>
          )}
        </>
      ) : (
        <p className="empty-note">
          Nothing high or medium impact is scheduled for this market in the next 7 days yet. Next week's calendar usually
          appears over the weekend.
        </p>
      )}
    </section>
  );
}

/**
 * Where we are: a line at the current time over the chart and the days, with what's behind it
 * washed back. It moves with the clock, a minute at a time.
 */
function NowLine({ start, end, clock }) {
  if (clock < start || clock > end) return null;
  const x = ((clock - start) / (end - start)) * 100;
  return (
    <div className="nl-now-layer" aria-hidden="true">
      <div className="nl-past" style={{ width: `${x}%` }} />
      <div className="nl-now" style={{ left: `${x}%` }}>
        <span className={`now-tag nl-now-tag${x > 85 ? ' at-end' : ''}`}>
          Now <time>{fmtTime(clock)}</time>
        </span>
      </div>
    </div>
  );
}

/** One line on what's happening: a release going on right now, or how long until the next one. */
function NowStatus({ events, clock }) {
  const live = events.filter((e) => clock >= e.ms - WINDOW_BEFORE && clock < e.ms + WINDOW_AFTER);
  const next = events.find((e) => e.ms > clock);
  const name = (e) => `${e.ccy} ${e.title}`;
  let body;
  if (live.length) {
    const e = live.find((x) => x.kind !== 'medium') ?? live[0];
    const more = live.length > 1 ? ` (+${live.length - 1} more)` : '';
    body =
      e.ms > clock ? (
        <>
          <b>News window open.</b> {name(e)}
          {more} is out in {timeLeft(e.ms - clock)}, at {fmtTime(e.ms)}.
        </>
      ) : (
        <>
          <b>News window open.</b> {name(e)}
          {more} came out {timeLeft(clock - e.ms)} ago; the market is still taking it in.
        </>
      );
  } else if (next) {
    body = (
      <>
        <b>Next in {timeLeft(next.ms - clock)}:</b> {name(next)}, {fmtDayTime(next.ms)}.
      </>
    );
  } else {
    body = <>No more major releases in this window.</>;
  }
  return (
    <p className={`nl-status${live.length ? ' is-live' : ''}`} aria-live="polite">
      <i aria-hidden="true" />
      <span className="nl-status-now">Now {fmtTime(clock)}</span>
      <span className="nl-status-text">{body}</span>
    </p>
  );
}

/** A release as a lollipop: a thin stem and a ringed cap in its impact's colour, with a count when several share the hour. */
function Spike({ x, y, width, height, payload, colors, clock }) {
  if (!payload?.total || !(height > 0)) return null;
  const cx = x + width / 2;
  const color = colors[payload.top];
  // already out: it stays on the chart, faded, like everything left of the time line
  const out = payload.t + HOUR / 2 <= clock;
  return (
    <g opacity={out ? 0.35 : 1}>
      <line x1={cx} x2={cx} y1={y + height} y2={y + 4} stroke={color} strokeWidth={2} strokeLinecap="round" strokeOpacity={0.85} />
      <circle cx={cx} cy={y} r={4.5} fill={color} stroke={colors.surface} strokeWidth={2} />
      {payload.n > 1 && (
        <text x={cx} y={y - 9} textAnchor="middle" fontSize={10} fontWeight={600} fill={colors.ink2}>
          ×{payload.n}
        </text>
      )}
    </g>
  );
}

function LoadTooltip({ active, payload, events }) {
  if (!active || !payload?.length) return null;
  const t = payload[0].payload.t;
  // releases within 3 hours of the cursor, so thin spikes are easy to hit
  const near = events.filter((e) => Math.abs(e.ms - t) <= 3 * HOUR).sort((a, b) => a.ms - b.ms);
  if (!near.length) {
    return (
      <div className="tip">
        <div className="tip-time">{fmtDayTime(t)}</div>
        <div className="muted">No major releases around this time</div>
      </div>
    );
  }
  return (
    <div className="tip">
      <div className="tip-time">{fmtDay(near[0].ms)}</div>
      <ul className="tip-list">
        {near.map((e) => (
          <li key={e.id}>
            <i className={`nl-dot ${e.kind}`} /> {fmtTime(e.ms)} · <b>{e.ccy}</b> {e.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
