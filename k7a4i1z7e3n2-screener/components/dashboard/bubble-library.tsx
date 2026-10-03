'use client';

import type { BubbleDataset } from '@/types/bubbles';
import { PALETTE } from '@/lib/markets';
import { CHARTED_BUBBLES } from '@/lib/bubbles/library';
import { ChevronDown } from '@/components/ui/icons';

const yr = (value: number | null) => (value === null ? '—' : String(value));

/** Historical bubbles as an FX table card, with research notes behind disclosures. */
export function BubbleLibrary({ bubbles }: { bubbles: BubbleDataset[] }) {
  const charted = CHARTED_BUBBLES;
  return (
    <section className="card section fade-in" aria-labelledby="bubbles-title">
      <div className="card-head">
        <div>
          <h2 id="bubbles-title">Historical bubbles</h2>
          <p>{bubbles.length} reference episodes: how long the run-up lasted, how far prices fell and how long recovery took.</p>
        </div>
      </div>
      <div className="scroll">
        <table className="t" style={{ minWidth: 820 }}>
          <thead>
            <tr>
              <th>Episode</th>
              <th>Start → peak → crash</th>
              <th>At the peak</th>
              <th className="r">Largest fall</th>
              <th className="r">Recovered</th>
              <th>What set it off</th>
            </tr>
          </thead>
          <tbody>
            {bubbles.map(bubble => {
              const ci = charted.findIndex(b => b.id === bubble.id);
              return (
                <tr key={bubble.id}>
                  <td>
                    <span className="cell-market strong">
                      {ci >= 0 && <i className="dot" style={{ backgroundColor: PALETTE[ci % PALETTE.length] }} />}
                      {bubble.name}
                    </span>
                    <span className="sub">{bubble.benchmark}</span>
                  </td>
                  <td className="when">
                    {yr(bubble.startYear)} → {yr(bubble.peakYear)} → {yr(bubble.crashYear)}
                  </td>
                  <td style={{ maxWidth: 220 }}>{bubble.peakValuation ?? '—'}</td>
                  <td className="r">
                    {bubble.largestDrawdownPercent === null ? '—' : <span className="down strong">{`−${Math.abs(bubble.largestDrawdownPercent).toFixed(1)}%`}</span>}
                  </td>
                  <td className="r">
                    {bubble.recoveryYear === null ? <span className="muted">Not yet</span> : bubble.recoveryYear}
                    {bubble.recoveryTimeYears !== null && <span className="sub">{bubble.recoveryTimeYears} years</span>}
                  </td>
                  <td style={{ maxWidth: 280, color: 'var(--ink2)' }}>{bubble.mainTrigger}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 18 }}>
        {bubbles.map(bubble => (
          <details key={bubble.id} className="disc">
            <summary>
              <span>
                {bubble.name} <span className="muted">· research notes and sources</span>
              </span>
              <ChevronDown className="chev" />
            </summary>
            <dl className="disc-body">
              <div>
                <dt>Summary</dt>
                <dd>{bubble.historicalSummary}</dd>
                <dt>Main cause</dt>
                <dd>{bubble.mainCause}</dd>
                <dt>Capital inflow</dt>
                <dd>{bubble.capitalInflow ?? 'No reliable aggregate published.'}</dd>
              </div>
              <div>
                <dt>Major events</dt>
                <dd>
                  <ul className="notes">
                    {bubble.timeline.map(event => (
                      <li key={`${bubble.id}-${event.year}-${event.title}`}>
                        <b className="num">{event.year}</b> {event.title}. <span className="muted">{event.detail}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt>Key lessons</dt>
                <dd>
                  <ul className="notes">
                    {bubble.keyLessons.map(lesson => <li key={lesson}>{lesson}</li>)}
                  </ul>
                </dd>
              </div>
              <div className="disc-wide">
                <dt>Sources</dt>
                <dd>
                  <ul className="notes">
                    {bubble.sources.map(source => (
                      <li key={source.url}>
                        <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a>{' '}
                        <span className="muted">· {source.organization}{source.note ? ` · ${source.note}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
                <dt>Limitations</dt>
                <dd>{bubble.limitations.join(' ')}</dd>
              </div>
            </dl>
          </details>
        ))}
      </div>
    </section>
  );
}
