import { useId } from 'react';
import type { MarketDay, Scrub } from '../hooks';
import { ACTIVITY_LABEL, ACTIVITY_TIERS, activityOf, sampleAt, volumeY } from '../marketModel';
import type { Activity } from '../marketModel';
import { HOUR_MS, formatClock } from '../marketTime';
import { Axis, Plot, Tube } from './common';

/** each activity band, 0–100, for the labels on the scale */
const BANDS = ([{ key: 'quiet', from: 0 }, ...ACTIVITY_TIERS] as { key: Activity; from: number }[]).map((t, i, all) => ({
  key: t.key,
  from: t.from,
  to: all[i + 1]?.from ?? 100,
}));

/** round to the quarter hour */
const q = (h: number) => Math.round(h * 4) / 4;

const LEVELS: Activity[] = ['quiet', 'light', 'busy', 'very-busy'];
const list = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * How busy the market usually is through the day: a model from which sessions are open
 * (weighted, softened at the edges, smoothed), with a strip of three-hour blocks underneath.
 */
export default function VolumeChart({ day, scrub, is24Hour }: { day: MarketDay; scrub: Scrub; is24Hour: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const { volume, dayStart, timezone, preview, rows, crossings } = day;
  const clock = (h: number) => formatClock(dayStart + h * HOUR_MS, timezone, is24Hour);

  const value = sampleAt(volume.values, scrub.percent / 100);
  const level = activityOf(value);
  const live = scrub.scrubPercent === null;
  const closedNow = day.weekend && live;

  const peak = volume.peak;
  const peakCross = peak ? crossings.find((c) => c.start < peak.to && c.end > peak.from) : null;

  const tip = (h: number) => {
    const v = sampleAt(volume.values, h / 24);
    const open = rows.filter((r) => r.segments.some((s) => h >= s.start && h < s.end)).map((r) => r.session.city);
    return (
      <>
        <div className={`tip-score lvl-text-${activityOf(v)}`}>{ACTIVITY_LABEL[activityOf(v)]}</div>
        <div className="muted">{open.length ? `${list(open)} open` : 'No session open'}</div>
      </>
    );
  };

  return (
    <section className={`chart-block volume${preview ? ' is-preview' : ''}`} aria-labelledby="vol-title">
      <div className="chart-head">
        <div>
          <h2 id="vol-title">Trading volume through the day</h2>
          <p className="muted">
            How busy the market usually is at each hour, worked out from which sessions are open: London and New York count
            the most, Sydney the least, and two at once adds up. A typical day, not live volume.
          </p>
        </div>
        <div className={`nl-rating lvl-${closedNow ? 'closed' : level}`}>
          <span className="nl-rating-label">{closedNow ? 'Closed' : `${ACTIVITY_LABEL[level]} ${live ? 'now' : 'then'}`}</span>
          {!closedNow && (
            <span className="nl-rating-sub">
              {`${Math.round(value * 100)}/100 at ${formatClock(dayStart + (scrub.percent / 100) * 24 * HOUR_MS, timezone, is24Hour)}`}
            </span>
          )}
        </div>
      </div>

      <div className="frame">
        <div className="gutter" aria-hidden="true">
          <div className="y-area">
            <Tube
              className="tube-volume"
              y={volumeY(value)}
              top={volumeY(1)}
              bottom={volumeY(0)}
              marker={`lvl-${level}`}
              ticks={ACTIVITY_TIERS.map((t) => ({ y: volumeY(t.from / 100) }))}
              labels={BANDS.map((b) => ({ y: volumeY((b.from + b.to) / 200), label: ACTIVITY_LABEL[b.key] }))}
              moving={scrub.scrubPercent !== null}
            />
          </div>
        </div>

        <Plot preview={preview} scrub={scrub} dayStart={dayStart} timezone={timezone} is24Hour={is24Hour} tip={tip} className="plot-volume" label="Typical trading volume through the day">
          <div className="plot-area">
          <div className="grid-h" aria-hidden="true">
            {ACTIVITY_TIERS.map((t) => (
              <i key={t.key} style={{ top: `${volumeY(t.from / 100)}%` }} />
            ))}
          </div>
          <svg className="plot-svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id={`${uid}-s`} gradientUnits="userSpaceOnUse" x1="0" y1={volumeY(0)} x2="0" y2={volumeY(1)}>
                <stop offset="0" stopColor="#a3aa9b" />
                <stop offset="0.22" stopColor="#a3aa9b" />
                <stop offset="0.38" stopColor="#e2a52a" />
                <stop offset="0.6" stopColor="#6fa978" />
                <stop offset="0.8" stopColor="#2f7d3d" />
                <stop offset="1" stopColor="#2f7d3d" />
              </linearGradient>
              <linearGradient id={`${uid}-f`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2f7d3d" stopOpacity="0.16" />
                <stop offset="1" stopColor="#2f7d3d" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={volume.area} fill={`url(#${uid}-f)`} />
            <path
              d={volume.line}
              fill="none"
              stroke={`url(#${uid}-s)`}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span
            className={`read-guide lvl-${level}${scrub.scrubPercent !== null ? ' is-moving' : ''}`}
            style={{ top: `${volumeY(value)}%`, width: `${scrub.percent}%` }}
            aria-hidden="true"
          />
          <span className={`vol-dot lvl-${level}`} style={{ left: `${scrub.percent}%`, top: `${volumeY(value)}%` }} aria-hidden="true" />
          </div>
        </Plot>

        <div className="gutter" />
        <Axis is24Hour={is24Hour} />

        <div className="gutter" />
        <div className="strip">
        <div className="nl-days" aria-label="How busy each three hours are">
          {volume.blocks.map((b) => (
            <div
              key={b.from}
              className={`nl-day lvl-${b.level}`}
              style={{ left: `${(b.from / 24) * 100}%`, width: `${((b.to - b.from) / 24) * 100}%` }}
              title={`${clock(b.from)} – ${clock(b.to)}: ${ACTIVITY_LABEL[b.level]}${b.sessions.length ? ` (${b.sessions.map((s) => s.city).join(', ')})` : ''}`}
            >
              <span className="nl-day-bar" />
              <span className="nl-day-name">{ACTIVITY_LABEL[b.level]}</span>
              <span className="nl-day-count">{b.sessions.length ? b.sessions.map((s) => s.city).join(' · ') : 'no session'}</span>
            </div>
          ))}
        </div>
        </div>
      </div>

      <div className="nl-key" aria-hidden="true">
        {LEVELS.map((l) => (
          <span key={l} className={`nl-day lvl-${l}`}>
            <span className="nl-day-bar" />
            {ACTIVITY_LABEL[l]}
          </span>
        ))}
      </div>

      {peak && (
        <p className="nl-summary">
          Busiest:{' '}
          <b>{peakCross ? `${clock(peakCross.rawStart)} – ${clock(peakCross.rawEnd)}` : `${clock(q(peak.from))} – ${clock(q(peak.to))}`}</b>
          {peakCross ? `, while ${peakCross.a.city} and ${peakCross.b.city} overlap.` : '.'}
        </p>
      )}
    </section>
  );
}
