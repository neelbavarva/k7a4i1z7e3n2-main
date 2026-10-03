import { useMemo } from 'react';
import { Area, Bar, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useThemeColors } from '../theme.js';
import { fmtDay, fmtDayTime, fmtTime } from '../format.js';

const HOUR = 3.6e6;
const SPREAD_H = 12; // the soft "pressure" hill around each release, in hours (as the grey range)

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
const weekday = new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: 'short' });
const dayNum = new Intl.DateTimeFormat(undefined, { timeZone: tz, day: 'numeric' });

// How busy, from the summed weight of releases (High 3, Medium 1.5, rate decision 4)
const dayLevel = (w) => (w <= 0 ? 'Quiet' : w < 4 ? 'Light' : w < 9 ? 'Busy' : 'Very busy');
const weekLevel = (w) => (w < 8 ? 'Quiet' : w < 20 ? 'Moderate' : w < 40 ? 'Busy' : 'Very busy');
const levelClass = (l) => l.toLowerCase().replace(' ', '-');
const kindOf = (e) => (e.rate ? 'rate' : e.impact === 'High' ? 'high' : 'medium');

/**
 * News load over the next 7 days: a spike for every scheduled release the market listens
 * to (stacked when several land in the same hour), a soft area for how crowded each stretch
 * is, and a strip saying how busy each day is. It shows when, not which way.
 */
export default function NewsLoad({ data }) {
  const c = useThemeColors();
  const start = Math.floor(data.now / HOUR) * HOUR;
  const end = data.series.at(-1).t;

  const m = useMemo(() => {
    const events = data.events
      .filter((e) => {
        const t = Date.parse(e.t);
        return t > data.now && t <= end && e.w > 0 && (e.impact === 'High' || e.impact === 'Medium' || e.rate);
      })
      .map((e) => ({ ...e, ms: Date.parse(e.t), h: Math.round(Date.parse(e.t) / HOUR) * HOUR, kind: kindOf(e) }));

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
      rows.push({ t, rate: sum('rate'), high: sum('high'), medium: sum('medium'), pressure: Math.round(pressure * 100) / 100 });
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
    const peak = Math.max(10, ...rows.map((r) => (r.rate ?? 0) + (r.high ?? 0) + (r.medium ?? 0)), ...rows.map((r) => r.pressure));
    const midnights = days.slice(1).map((d) => d.from);
    return { events, rows, days, busiest, total, peak, midnights };
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
            How bumpy the week ahead looks. Each spike is a scheduled release this market reacts to: taller and redder for
            bigger news, stacked when several land at once. It shows when the news hits, not which way it pushes.
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
                  <i style={{ background: c[k] }} /> {label}
                </span>
              ))}
            <span>
              <i style={{ background: c.band }} /> News pressure
            </span>
          </div>

          <div className="chart" style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={m.rows} margin={{ top: 10, right: 8, bottom: 0, left: 8 }} barGap={0}>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={[start, end + HOUR]}
                  ticks={m.days.filter((d) => d.width > 6).map((d) => d.from + (d.to - d.from) / 2)}
                  tickFormatter={fmtDay}
                  stroke={c.axis}
                  tick={{ fill: c.muted, fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis hide domain={[0, Math.ceil(m.peak * 1.08)]} />
                {m.midnights.map((t) => (
                  <ReferenceLine key={t} x={t} stroke={c.grid} strokeWidth={1} />
                ))}
                <Area
                  dataKey="pressure"
                  type="monotone"
                  stroke={c.axis}
                  strokeWidth={1}
                  fill={c.band}
                  fillOpacity={1}
                  isAnimationActive={false}
                  activeDot={false}
                />
                <Bar dataKey="medium" stackId="n" fill={c.medium} barSize={5} isAnimationActive={false} />
                <Bar dataKey="high" stackId="n" fill={c.high} barSize={5} isAnimationActive={false} />
                <Bar dataKey="rate" stackId="n" fill={c.rate} barSize={5} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                <Tooltip content={<LoadTooltip events={m.events} />} cursor={{ stroke: c.axis }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="nl-days" aria-label="How busy each day is">
            {m.days.map((d) => (
              <div
                key={d.key}
                className={`nl-day ${levelClass(d.level)}${d.width < 9 ? ' tiny' : ''}`}
                style={{ left: `${d.left}%`, width: `${d.width}%` }}
                title={`${weekday.format(new Date(d.from))} ${dayNum.format(new Date(d.from))}: ${d.level}${
                  d.events.length ? ` (${d.high} high, ${d.medium} medium)` : ''
                }`}
              >
                <span className="nl-day-bar" />
                {d.width >= 9 && (
                  // names are hidden on phones (see styles.css); the key below explains the colours
                  <>
                    <span className="nl-day-name">{d.level}</span>
                    <span className="nl-day-count">
                      {d.events.length ? `${d.high ? `${d.high} high` : ''}${d.high && d.medium ? ' · ' : ''}${d.medium ? `${d.medium} med` : ''}` : 'no major news'}
                    </span>
                  </>
                )}
              </div>
            ))}
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
