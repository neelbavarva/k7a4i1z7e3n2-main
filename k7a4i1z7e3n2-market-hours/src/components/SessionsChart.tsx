import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MarketDay, Scrub } from '../hooks';
import { HOUR_MS, formatClock, formatDay, formatWhen } from '../marketTime';
import { Axis, Flag, Plot } from './common';

/**
 * The four sessions on the viewer's day: one row each, bars at their real hours, an overlap
 * row underneath, the shared time line across all of it.
 */
export default function SessionsChart({ day, scrub, is24Hour }: { day: MarketDay; scrub: Scrub; is24Hour: boolean }) {
  const { rows, dayStart, timezone, nowMs, status, preview, crossings } = day;
  const clock = (h: number) => formatClock(dayStart + h * HOUR_MS, timezone, is24Hour);
  const range = (a: number, b: number) => `${clock(a)} – ${clock(b)}`;

  // width of the drawing area, so labels only go inside bars wide enough for them
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.plot');
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fits = (text: string, hours: number) => text.length * 6.1 + 18 <= (hours / 24) * width;

  const tip = (h: number) => {
    const open = rows.filter((r) => r.segments.some((s) => h >= s.start && h < s.end));
    return open.length ? (
      <ul className="tip-list">
        {open.map((r) => (
          <li key={r.session.id}>
            <i className="tip-dot" style={{ background: r.session.color }} /> {r.session.city} open
          </li>
        ))}
      </ul>
    ) : (
      <div className="muted">No session open</div>
    );
  };

  return (
    <section className={`chart-block sessions${preview ? ' is-preview' : ''}`} aria-labelledby="ses-title" ref={ref}>
      <div className="chart-head">
        <div>
          <h2 id="ses-title">Trading sessions</h2>
          <p className="muted">
            {preview
              ? `Markets are closed for the weekend, so this shows ${formatDay(dayStart + 12 * HOUR_MS, timezone)}, the next trading day. `
              : 'Each market from 8 am to 5 pm in its own city (Tokyo 9 to 6), shown in your time. '}
            Press and drag anywhere on a chart to see another time of day; it springs back to now.
          </p>
        </div>
        {scrub.scrubPercent !== null && !scrub.dragging && (
          <button type="button" className="btn btn-small" onClick={scrub.reset}>
            Back to now
          </button>
        )}
      </div>

      <div className="legend">
        {rows.map(({ session }) => (
          <span key={session.id}>
            <i style={{ background: session.color }} /> {session.city}
          </span>
        ))}
        <span>
          <i className="hatch" /> Overlap
        </span>
        <span>
          <i className={`line${preview ? ' dashed' : ''}`} /> {preview ? 'This time of day' : 'Now'}
        </span>
      </div>

      <div className="frame">
        <div className="gutter ses-labels">
          {rows.map(({ session, segments }) => {
            const st = status[session.id];
            const first = segments.find((s) => s.rawStart >= 0) ?? segments[0];
            return (
              <div key={session.id} className="ses-label">
                <Flag id={session.id} size={20} />
                <div>
                  <div className="ses-label-city">{session.city}</div>
                  <div className={`ses-label-sub${st.open ? ' is-open' : ''}`}>
                    {st.open && st.closesAt
                      ? `Closes ${formatWhen(st.closesAt, nowMs, timezone, is24Hour)}`
                      : st.opensAt
                        ? `Opens ${formatWhen(st.opensAt, nowMs, timezone, is24Hour)}`
                        : first
                          ? `Opens ${clock(first.rawStart)}`
                          : 'Closed'}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="ses-label ses-label-ov">Overlaps</div>
        </div>

        <Plot
          preview={preview}
          scrub={scrub}
          dayStart={dayStart}
          timezone={timezone}
          is24Hour={is24Hour}
          tip={tip}
          keyboard
          label="Trading sessions through the day. Use the arrow keys to move the time line."
        >
          <div className="grid-v" aria-hidden="true">
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <i key={h} className={h % 6 ? '' : 'major'} style={{ left: `${(h / 24) * 100}%` }} />
            ))}
          </div>
          {rows.map(({ session, segments }) => (
            <div key={session.id} className="ses-row">
              {segments.map((s) => {
                const cutStart = s.rawStart < 0;
                const cutEnd = s.rawEnd > 24;
                const text =
                  cutStart && cutEnd ? '' : cutStart ? `← ${clock(s.rawEnd)}` : cutEnd ? `${clock(s.rawStart)} →` : range(s.rawStart, s.rawEnd);
                const isLive = !preview && status[session.id].open && nowMs >= dayStart + s.rawStart * HOUR_MS && nowMs < dayStart + s.rawEnd * HOUR_MS;
                return (
                  <span
                    key={s.rawStart}
                    className={`bar${cutStart ? ' cut-start' : ''}${cutEnd ? ' cut-end' : ''}${isLive ? ' is-live' : ''}`}
                    style={{ left: `${(s.start / 24) * 100}%`, width: `${((s.end - s.start) / 24) * 100}%`, '--c': session.color } as CSSProperties}
                  >
                    {fits(text, s.end - s.start) && <span className="bar-text">{text}</span>}
                  </span>
                );
              })}
            </div>
          ))}
          <div className="ses-row ov-row">
            {crossings.map((c) => {
              const text = `${c.a.city} + ${c.b.city}`;
              return (
                <span
                  key={`${c.a.id}-${c.b.id}-${c.rawStart}`}
                  className="ov"
                  style={{ left: `${(c.start / 24) * 100}%`, width: `${((c.end - c.start) / 24) * 100}%` }}
                  title={`${text}: ${range(c.rawStart, c.rawEnd)}`}
                >
                  {fits(text, c.end - c.start) && <span className="bar-text">{text}</span>}
                </span>
              );
            })}
          </div>
        </Plot>

        <div className="gutter" />
        <Axis is24Hour={is24Hour} />
      </div>
    </section>
  );
}
