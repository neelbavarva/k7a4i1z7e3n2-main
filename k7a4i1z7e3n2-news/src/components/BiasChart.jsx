import { useMemo, useState } from 'react';
import {
  Area,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceDot,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { useThemeColors } from '../theme.js';
import { fmtDay, fmtDayTime, fmtPrice, signed } from '../format.js';
import { isFx } from '../markets.js';

const HOUR = 3.6e6;
const DAY = 24 * HOUR;
const RANGES = [7, 14, 30];

export default function BiasChart({ data, byId }) {
  const c = useThemeColors();
  const [days, setDays] = useState(14);
  const now = Math.floor(data.now / HOUR) * HOUR;
  const from = now - days * DAY;
  const to = data.series.at(-1).t;
  // before the first week the data job collected there is nothing to plot
  const since = data.since ?? -Infinity;
  const gap = since > from ? Math.min(since, now) : null;

  const { rows, markers, priceRows, ticks } = useMemo(() => {
    const priceMap = new Map(data.prices.map((p) => [p.t, p.c]));
    const evByHour = new Map();
    for (const e of data.events) {
      if (e.skip && e.impact !== 'High') continue;
      if (e.impact !== 'High' && e.impact !== 'Medium') continue;
      const h = Math.round(Date.parse(e.t) / HOUR) * HOUR;
      if (!evByHour.has(h)) evByHour.set(h, []);
      evByHour.get(h).push(e);
    }
    const rows = data.series
      .filter((p) => p.t >= Math.max(from, since))
      .map((p) => ({
        t: p.t,
        s: p.s,
        pos: p.proj ? null : Math.max(0, p.s),
        neg: p.proj ? null : Math.min(0, p.s),
        posLine: p.proj || p.s < 0 ? null : p.s,
        negLine: p.proj || p.s > 0 ? null : p.s,
        proj: p.proj || p.t === now ? p.s : null,
        band: p.lo != null ? [p.lo, p.hi] : null,
        top: p.top,
        isProj: p.proj,
        events: evByHour.get(p.t) ?? [],
      }));
    const markers = [...evByHour.entries()]
      .filter(([t]) => t >= from && t <= to)
      .map(([t, evs]) => ({ t, y: -94, high: evs.some((e) => e.impact === 'High'), events: evs }));
    const priceRows = rows.filter((r) => priceMap.has(r.t)).map((r) => ({ t: r.t, price: priceMap.get(r.t) }));
    const step = days <= 7 ? 1 : days <= 14 ? 2 : 4;
    const ticks = [];
    const first = Math.ceil(from / DAY) * DAY;
    for (let t = first; t <= to; t += step * DAY) ticks.push(t);
    return { rows, markers, priceRows, ticks };
  }, [data, from, to, now, days, since]);

  const xProps = {
    dataKey: 't',
    type: 'number',
    scale: 'time',
    domain: [from, to],
    ticks,
    tickFormatter: fmtDay,
    stroke: c.axis,
    tick: { fill: c.muted, fontSize: 12 },
    tickLine: false,
    allowDataOverflow: true,
  };

  return (
    <section className="chart-block" aria-labelledby="chart-title">
      <div className="chart-head">
        <div>
          <h2 id="chart-title">Bias over time</h2>
          <p className="muted">
            Past {days} days, then the next 7. Right of “now”, the dotted line is where the score would go if every
            scheduled release matched its forecast. Real numbers replace it as they come out. The grey band shows how far a
            surprise could move it.
          </p>
        </div>
        <div className="seg" role="group" aria-label="History range">
          {RANGES.map((d) => (
            <button key={d} type="button" aria-pressed={d === days} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      <div className="legend" aria-hidden="true">
        <span><i style={{ background: c.bull }} /> {isFx(data.pair) ? `${data.pair.base} stronger (bullish)` : `Bullish for ${data.pair.name}`}</span>
        <span><i style={{ background: c.bear }} /> {isFx(data.pair) ? `${data.pair.quote} stronger (bearish)` : `Bearish for ${data.pair.name}`}</span>
        <span><i className="dash" style={{ borderColor: c.ink2 }} /> If releases match forecasts</span>
        <span><i style={{ background: c.band }} /> News risk range</span>
        <span><i className="diamond" style={{ background: c.high }} /> High-impact event</span>
        <span><i className="diamond" style={{ background: c.medium }} /> Medium-impact event</span>
      </div>

      <div className="chart" style={{ height: 340 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} syncId="fx" syncMethod="value" margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis {...xProps} />
            <YAxis
              domain={[-100, 100]}
              ticks={[-100, -50, 0, 50, 100]}
              tickFormatter={(v) => signed(v)}
              stroke={c.axis}
              tick={{ fill: c.muted, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            {gap && (
              <ReferenceArea
                x1={from}
                x2={gap}
                y1={-100}
                y2={100}
                fill={c.grid}
                fillOpacity={0.55}
                stroke="none"
                ifOverflow="hidden"
                label={{ value: `Not collected yet: data starts ${fmtDay(since)}`, position: 'insideTop', offset: 18, fill: c.muted, fontSize: 12 }}
              />
            )}
            <ReferenceLine y={0} stroke={c.axis} />
            <Area dataKey="band" stroke="none" fill={c.band} fillOpacity={1} isAnimationActive={false} connectNulls={false} />
            <Area dataKey="pos" type="linear" baseValue={0} stroke="none" fill={c.bull} fillOpacity={0.18} activeDot={false} isAnimationActive={false} />
            <Area dataKey="neg" type="linear" baseValue={0} stroke="none" fill={c.bear} fillOpacity={0.18} activeDot={false} isAnimationActive={false} />
            <Line dataKey="posLine" type="linear" stroke={c.bull} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: c.bull, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
            <Line dataKey="negLine" type="linear" stroke={c.bear} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: c.bear, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
            <Line dataKey="proj" type="linear" stroke={c.ink2} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={false} isAnimationActive={false} />
            {markers.map((m) => (
              <ReferenceDot key={m.t} x={m.t} y={m.y} ifOverflow="hidden" shape={(p) => <Diamond {...p} high={m.high} c={c} />} />
            ))}
            <ReferenceLine x={now} stroke={c.now} strokeWidth={1.5} label={{ value: 'now', position: 'insideTopLeft', fill: c.now, fontSize: 12, fontWeight: 600 }} />
            <Tooltip content={<BiasTooltip byId={byId} pair={data.pair} />} cursor={{ stroke: c.axis }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <h3 className="price-title">
        {isFx(data.pair) ? `${data.pair.symbol} price` : `${data.pair.name} price`}
        {!isFx(data.pair) && data.priceSymbol && data.priceSymbol !== data.pair.symbol && (
          <span className="muted"> · {/^[A-Z]{3}\/[A-Z]{3}$/.test(data.priceSymbol) ? data.priceSymbol : `${data.priceSymbol} fund`}</span>
        )}
      </h3>
      {priceRows.length ? (
        <div className="chart" style={{ height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={priceRows} syncId="fx" syncMethod="value" margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis {...xProps} />
              <YAxis
                domain={['auto', 'auto']}
                stroke={c.axis}
                tick={{ fill: c.muted, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickCount={3}
                tickFormatter={fmtPrice}
              />
              <ReferenceLine x={now} stroke={c.now} strokeWidth={1.5} />
              <Line dataKey="price" type="linear" stroke={c.ink2} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Tooltip
                cursor={{ stroke: c.axis }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="tip">
                      <div className="tip-time">{fmtDayTime(payload[0].payload.t)}</div>
                      <div className="tip-score">{payload[0].value}</div>
                    </div>
                  ) : null
                }
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="muted empty-note">Prices aren't available for this market yet. They appear once the hourly update has a price source for it.</p>
      )}

      <DailyTable series={data.series.filter((p) => p.t >= since)} now={now} />
    </section>
  );
}

function Diamond({ cx, cy, high, c }) {
  if (cx == null) return null;
  const r = 6;
  return (
    <path
      d={`M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`}
      fill={high ? c.high : c.medium}
      stroke={c.surface}
      strokeWidth={2}
    />
  );
}

function BiasTooltip({ active, payload, byId, pair }) {
  if (!active || !payload?.length) return null;
  const row = payload.find((p) => p.payload?.t != null)?.payload;
  if (!row) return null;
  const events = row.events ?? [];
  return (
    <div className="tip">
      <div className="tip-time">{fmtDayTime(row.t)}</div>
      {row.s != null && (
        <div className="tip-score">
          {row.isProj ? <span className="tip-proj">If forecasts hold</span> : null}
          {signed(row.s)}
          {row.band && row.isProj && (
            <span className="tip-range">
              range {signed(row.band[0])} to {signed(row.band[1])}
            </span>
          )}
        </div>
      )}
      {row.top?.length > 0 && (
        <ul className="tip-list">
          {row.top.map((x) => {
            const e = byId.get(x.id);
            return (
              <li key={x.id}>
                <span className={x.v > 0 ? 'up' : 'down'}>{signed(x.v, 1)}</span> {e ? `${e.ccy} ${e.title}` : 'Earlier release'}
                {x.x ? <span className="muted"> (expected, {e?.p} → {e?.f})</span> : null}
              </li>
            );
          })}
        </ul>
      )}
      {events.length > 0 && (
        <ul className="tip-list tip-events">
          {events.map((e) => (
            <li key={e.id}>
              <b>{e.impact}</b> {e.ccy} {e.title}
              {e.a ? ` · actual ${e.a} vs ${e.f ?? '—'}` : e.f ? ` · forecast ${e.f}` : ''}
            </li>
          ))}
        </ul>
      )}
      {row.top?.length > 0 && <div className="tip-note muted">Contributions to {pair.symbol}, before scaling</div>}
    </div>
  );
}

function DailyTable({ series, now }) {
  const rows = series.filter((p) => p.t <= now && new Date(p.t).getUTCHours() === 12).reverse();
  return (
    <details className="daily">
      <summary>Show the daily values</summary>
      <p className="muted small">Score at 12:00 UTC each day, newest first.</p>
      <ul className="daily-grid">
        {rows.map((p) => (
          <li key={p.t}>
            <span className="daily-day">{fmtDay(p.t)}</span>
            <span className={`daily-score ${p.s >= 15 ? 'up' : p.s <= -15 ? 'down' : ''}`}>{signed(p.s, 1)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
