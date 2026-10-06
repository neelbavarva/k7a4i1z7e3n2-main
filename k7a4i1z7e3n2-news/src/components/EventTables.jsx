import { useState } from 'react';
import { fmtDayTime, fmtRelative, signed } from '../format.js';
import { useNow } from '../clock.js';

const FIRST = 6;

/** Shows the first few rows, with a button for the rest. */
export function useMore(rows) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, FIRST);
  const button =
    rows.length > FIRST ? (
      <button type="button" className="more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
        {all ? 'Show fewer' : `Show all ${rows.length}`}
      </button>
    ) : null;
  return [shown, button];
}

function Push({ v }) {
  if (v == null) return <span className="muted">—</span>;
  if (Math.abs(v) < 0.05) return <span className="muted">≈ 0</span>;
  return (
    <span className={v > 0 ? 'up' : v < 0 ? 'down' : ''}>
      {v > 0 ? '▲ ' : v < 0 ? '▼ ' : ''}
      {signed(v, 1)}
    </span>
  );
}

/** A small check mark: this release is out. */
export function Tick() {
  return (
    <svg className="tick" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 6.4 4.9 8.7 9.5 3.6" />
    </svg>
  );
}

const Impact = ({ level }) => <span className={`impact impact-${level.toLowerCase()}`}>{level}</span>;

export function UpcomingTable({ data }) {
  const now = data.now;
  const rows = data.events
    .filter((e) => Date.parse(e.t) > now && (e.impact === 'High' || e.impact === 'Medium'))
    .slice(0, 16);
  const [shown, more] = useMore(rows);
  // times are counted from the clock, so a release that has come out since the data was made says so
  const clock = useNow();
  return (
    <section className="table-block" aria-labelledby="up-title">
      <h2 id="up-title">Coming up</h2>
      <p className="muted">{data.pair.kind && data.pair.kind !== 'fx'
          ? `Scheduled releases that drive ${data.pair.name}.`
          : `Scheduled news for ${data.pair.base} and ${data.pair.quote}.`} Expected push is how
        each release moves the dotted line if it matches its forecast.</p>
      {rows.length ? (
        <div className="scroll">
          <table className="stack stack-up">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Event</th>
                <th scope="col">Impact</th>
                <th scope="col" className="num">Forecast</th>
                <th scope="col" className="num">Previous</th>
                <th scope="col" className="num">Expected push</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id} className={Date.parse(e.t) <= clock ? 'is-done' : undefined}>
                  <td className="when c-when">
                    <div>{fmtDayTime(e.t)}</div>
                    {Date.parse(e.t) <= clock ? (
                      <div className="out-tag">
                        <Tick />
                        Out {fmtRelative(e.t, clock)}
                      </div>
                    ) : (
                      <div className="muted small">{fmtRelative(e.t, clock)}</div>
                    )}
                  </td>
                  <td className="c-main">
                    <span className="ccy">{e.ccy}</span> {e.title}
                  </td>
                  <td className="c-impact">
                    <Impact level={e.impact} />
                  </td>
                  <td className="num" data-label="Forecast">{e.f ?? '—'}</td>
                  <td className="num" data-label="Previous">{e.p ?? '—'}</td>
                  <td className="num" data-label="Expected push">
                    <Push v={e.ec} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {more}
        </div>
      ) : (
        <p className="empty-note">Nothing high or medium impact is scheduled yet. Next week's calendar usually appears over the weekend.</p>
      )}
    </section>
  );
}

export function SurprisesTable({ data }) {
  const now = data.now;
  const rows = data.events
    .filter((e) => Date.parse(e.t) <= now && !e.skip && (e.impact === 'High' || e.impact === 'Medium') && e.f)
    .reverse()
    .slice(0, 16);
  const [shown, more] = useMore(rows);
  return (
    <section className="table-block" aria-labelledby="sur-title">
      <h2 id="sur-title">Recent surprises</h2>
      <p className="muted">Released data against forecast, and how much each pushed {data.pair.symbol}.</p>
      {rows.length ? (
        <div className="scroll">
          <table className="stack">
            <thead>
              <tr>
                <th scope="col">Released</th>
                <th scope="col">Event</th>
                <th scope="col" className="num">Actual</th>
                <th scope="col" className="num">Forecast</th>
                <th scope="col" className="num">Push</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id}>
                  <td className="when c-when">{fmtDayTime(e.t)}</td>
                  <td className="c-main">
                    <span className="ccy">{e.ccy}</span> {e.title}
                  </td>
                  <td className="num" data-label="Actual">
                    {e.a ? (
                      e.url ? (
                        <a href={e.url} target="_blank" rel="noreferrer">
                          {e.a}
                        </a>
                      ) : (
                        e.a
                      )
                    ) : (
                      <span className="muted">pending</span>
                    )}
                  </td>
                  <td className="num" data-label="Forecast">{e.f}</td>
                  <td className="num" data-label="Push">
                    {e.c != null ? (
                      <Push v={e.c} />
                    ) : e.ec != null ? (
                      <span title="No actual yet: using the forecast vs previous until it arrives">
                        <Push v={e.ec} /> <span className="muted small">expected</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {more}
        </div>
      ) : (
        <p className="empty-note">No released data with a forecast yet. The table fills in as this week's numbers come out.</p>
      )}
    </section>
  );
}
