import type { MarketDay, Scrub } from '../hooks';
import { AMD_H, AMD_W, PHASE_LABEL, PHASE_NOTE, PHASE_NY, amdY, amdYAt, phaseAt } from '../marketModel';
import type { Phase, PhaseSegment } from '../marketModel';
import { HOUR_MS, clamp, formatClock } from '../marketTime';
import { Axis, Plot, Tube } from './common';

const PHASES: Phase[] = ['accumulation', 'manipulation', 'distribution'];

/**
 * The accumulation → manipulation → distribution cycle on New York's clock, drawn as a
 * schematic price path, with one card per phase underneath.
 */
export default function AmdChart({ day, scrub, is24Hour }: { day: MarketDay; scrub: Scrub; is24Hour: boolean }) {
  const { amd, dayStart, timezone, preview } = day;
  const clock = (h: number) => formatClock(dayStart + h * HOUR_MS, timezone, is24Hour);
  const hour = (scrub.percent / 100) * 24;
  const active = phaseAt(amd.segments, hour);
  const pathY = (amdYAt(amd.segments, amd.shapes, hour) / AMD_H) * 100;
  const closedNow = day.weekend && scrub.scrubPercent === null;

  // the longest piece of each phase in the shown day, for the cards
  const main = (p: Phase): PhaseSegment | undefined =>
    amd.segments.filter((s) => s.phase === p).sort((a, b) => b.end - b.start - (a.end - a.start))[0];

  const tip = (h: number) => {
    const p = phaseAt(amd.segments, h);
    return p ? <div className={`tip-phase ph-${p}`}>{PHASE_LABEL[p]}</div> : <div className="muted">No clear phase</div>;
  };

  return (
    <section className={`chart-block amd${preview ? ' is-preview' : ''}`} aria-labelledby="amd-title">
      <div className="chart-head">
        <div>
          <h2 id="amd-title">Accumulation, manipulation, distribution</h2>
        </div>
        <div className={`nl-rating ph-${closedNow ? 'closed' : active ?? 'quiet'}`}>
          <span className="nl-rating-label">{closedNow ? 'Closed' : active ? PHASE_LABEL[active] : 'No clear phase'}</span>
          {!closedNow && <span className="nl-rating-sub">{scrub.scrubPercent === null ? 'right now' : `at ${clock(hour)}`}</span>}
        </div>
      </div>

      <div className="legend">
        {PHASES.map((p) => (
          <span key={p}>
            <i className={`ph-${p}`} /> {PHASE_LABEL[p]}
          </span>
        ))}
        <span>
          <i className="dash" /> No clear phase
        </span>
      </div>

      <div className="frame">
        <div className="gutter" aria-hidden="true">
          <div className="y-area">
            <Tube
              className="tube-price"
              y={pathY}
              top={(amdY(1) / AMD_H) * 100}
              bottom={(amdY(0) / AMD_H) * 100}
              marker={`ph-${active ?? 'none'}`}
              ticks={[
                { y: (amdY(1) / AMD_H) * 100, label: 'Higher', end: true },
                { y: (amdY(0) / AMD_H) * 100, label: 'Lower', end: true },
              ]}
              moving={scrub.scrubPercent !== null}
            />
          </div>
        </div>

        <Plot preview={preview} scrub={scrub} dayStart={dayStart} timezone={timezone} is24Hour={is24Hour} tip={tip} className="plot-amd" label="Accumulation, manipulation and distribution phases">
          <div className="plot-area">
          <svg className="plot-svg" viewBox={`0 0 ${AMD_W} ${AMD_H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
            {amd.segments.map((s) => (
              <rect
                key={`bg-${s.phase}-${s.rawStart}`}
                className={`amd-bg ph-${s.phase}`}
                x={(s.start / 24) * AMD_W}
                y="0"
                width={((s.end - s.start) / 24) * AMD_W}
                height={AMD_H}
              />
            ))}
            {amd.gaps.map((d, i) => (
              <path key={`gap-${i}`} className="amd-gap" d={d} vectorEffect="non-scaling-stroke" />
            ))}
            {amd.shapes.map((s, i) => (
              <path key={`ph-${s.phase}-${i}`} className={`amd-line ph-${s.phase}`} d={s.d} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          {amd.segments.map((s, i) => (
            <span
              key={`lb-${s.phase}-${s.rawStart}`}
              className={`amd-label ph-${s.phase}${i % 2 ? ' low' : ''}`}
              style={{ left: `${clamp(((s.start + s.end) / 2 / 24) * 100, 8, 92)}%` }}
              aria-hidden="true"
            >
              {PHASE_LABEL[s.phase]}
            </span>
          ))}
          <span
            className={`read-guide ph-${active ?? 'none'}${scrub.scrubPercent !== null ? ' is-moving' : ''}`}
            style={{ top: `${pathY}%`, width: `${scrub.percent}%` }}
            aria-hidden="true"
          />
          <span className={`vol-dot amd-dot ph-${active ?? 'none'}`} style={{ left: `${scrub.percent}%`, top: `${pathY}%` }} aria-hidden="true" />
          </div>
        </Plot>

        <div className="gutter" />
        <Axis is24Hour={is24Hour} />
      </div>

      <ul className="days phases">
        {PHASES.map((p) => {
          const s = main(p);
          const isNow = !closedNow && active === p;
          return (
            <li key={p} className={`day ph-card ph-${p}${isNow ? ' is-now' : ''}`}>
              <div className="day-head">
                <span className="day-name">{PHASE_LABEL[p]}</span>
                <span className="day-date">{PHASE_NY[p]} New York</span>
                {isNow && (
                  <span className="risk-tag">
                    <i />
                    {scrub.scrubPercent === null ? 'Now' : 'At the line'}
                  </span>
                )}
              </div>
              <div className="day-score-row">
                <span className="day-score">{s ? `${clock(s.rawStart)} – ${clock(s.rawEnd)}` : 'Not today'}</span>
              </div>
              <p className="ph-note">{PHASE_NOTE[p]}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
