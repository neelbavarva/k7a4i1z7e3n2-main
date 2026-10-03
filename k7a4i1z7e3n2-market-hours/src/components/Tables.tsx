import type { MarketDay } from '../hooks';
import { ACTIVITY_LABEL, SESSIONS, activityOf, sampleAt } from '../marketModel';
import type { SessionId } from '../marketModel';
import { HOUR_MS, formatClock, formatDuration, formatWhen } from '../marketTime';
import { Flag } from './common';

const pad = (h: number) => `${h % 12 || 12}:00 ${h < 12 ? 'am' : 'pm'}`;
const pad24 = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Each session's hours in its own city and in the viewer's time, and when it next changes. */
export function SessionTable({ day, is24Hour }: { day: MarketDay; is24Hour: boolean }) {
  const { rows, status, dayStart, timezone, nowMs } = day;
  const clock = (h: number) => formatClock(dayStart + h * HOUR_MS, timezone, is24Hour);
  const local = (h: number) => (is24Hour ? pad24(h) : pad(h));

  return (
    <section className="table-block" aria-labelledby="st-title">
      <h2 id="st-title">Session times</h2>
      <p className="muted">
        Every session in its own city’s time and in yours. Daylight saving moves each city on its own date, so the gaps between
        them shift a little in spring and autumn.
      </p>
      <div className="scroll">
        <table className="stack stack-4">
          <thead>
            <tr>
              <th scope="col">Session</th>
              <th scope="col">Local hours</th>
              <th scope="col">Your time</th>
              <th scope="col">Status</th>
              <th scope="col" className="num">
                Next change
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ session, segments }) => {
              const st = status[session.id];
              const seg = segments.find((s) => s.rawStart >= 0) ?? segments[0];
              const at = st.open ? st.closesAt : st.opensAt;
              return (
                <tr key={session.id}>
                  <td className="c-main">
                    <span className="sess-cell">
                      <Flag id={session.id} size={20} />
                      <span>
                        <b>{session.city}</b>
                        <span className="row-name">{session.timeZone.replace('_', ' ')}</span>
                      </span>
                    </span>
                  </td>
                  <td data-label="Local hours">
                    {local(session.open)} – {local(session.close)}
                    <span className="row-name">now {formatClock(nowMs, session.timeZone, is24Hour)} there</span>
                  </td>
                  <td data-label="Your time">{seg ? `${clock(seg.rawStart)} – ${clock(seg.rawEnd)}` : '—'}</td>
                  <td data-label="Status">
                    <span className={`impact ${st.open ? 'impact-open' : 'impact-closed'}`}>{st.open ? 'Open' : 'Closed'}</span>
                  </td>
                  <td className="num" data-label="Next change">
                    {at ? (
                      <>
                        {st.open ? 'Closes' : 'Opens'} {formatWhen(at, nowMs, timezone, is24Hour)}
                        <span className="row-name">in {formatDuration(at - nowMs)}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const WHY: Record<string, string> = {
  'london-newyork': 'The busiest hours of the day. The two largest centres trade together, so EUR, GBP and USD pairs move most.',
  'tokyo-london': 'Asia hands over to Europe. Yen and euro crosses tend to wake up.',
  'sydney-tokyo': 'The Asia-Pacific session. Best for AUD, NZD and JPY pairs; usually calmer.',
  'sydney-newyork': 'A short handover as New York winds down and Sydney opens.',
  'sydney-london': 'A brief crossover between the Pacific and Europe.',
  'tokyo-newyork': 'A brief crossover between Asia and the Americas.',
};

/** Where sessions overlap on the shown day, ranked by how busy the overlap usually is. */
export function OverlapTable({ day, is24Hour }: { day: MarketDay; is24Hour: boolean }) {
  const { crossings, dayStart, timezone, volume } = day;
  const clock = (h: number) => formatClock(dayStart + h * HOUR_MS, timezone, is24Hour);
  const order = (id: SessionId) => SESSIONS.findIndex((s) => s.id === id);

  // join pieces of the same overlap cut by midnight, keeping the longest
  const byPair = new Map<string, (typeof crossings)[number]>();
  for (const c of crossings) {
    const key = [c.a.id, c.b.id].sort((x, y) => order(x) - order(y)).join('-');
    const prev = byPair.get(key);
    if (!prev || c.rawEnd - c.rawStart > prev.rawEnd - prev.rawStart) byPair.set(key, c);
  }
  const items = [...byPair.entries()]
    .map(([key, c]) => {
      const mid = ((Math.max(0, c.rawStart) + Math.min(24, c.rawEnd)) / 2) / 24;
      const v = sampleAt(volume.values, mid);
      return { key, c, v, level: activityOf(v) };
    })
    .sort((x, y) => y.v - x.v);

  return (
    <section className="table-block" aria-labelledby="ov-title">
      <h2 id="ov-title">Best times to trade</h2>
      <p className="muted">
        When two sessions are open at once, more traders are in the market: spreads narrow and price moves further. These are
        the overlaps on the day shown above, busiest first.
      </p>
      {items.length ? (
        <div className="scroll">
          <table className="stack stack-4 ov-table">
            <thead>
              <tr>
                <th scope="col">Overlap</th>
                <th scope="col">Your time</th>
                <th scope="col">Length</th>
                <th scope="col">Activity</th>
                <th scope="col">Why it matters</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ key, c, level }) => (
                <tr key={key}>
                  <td className="c-main">
                    <span className="sess-cell">
                      <span className="flag-pair">
                        <Flag id={c.a.id} size={18} />
                        <Flag id={c.b.id} size={18} />
                      </span>
                      <b>
                        {c.a.city} + {c.b.city}
                      </b>
                    </span>
                  </td>
                  <td data-label="Your time" className="when">
                    {clock(c.rawStart)} – {clock(c.rawEnd)}
                  </td>
                  <td data-label="Length">{formatDuration((c.rawEnd - c.rawStart) * HOUR_MS)}</td>
                  <td data-label="Activity">
                    <span className={`impact impact-lvl lvl-${level}`}>{ACTIVITY_LABEL[level]}</span>
                  </td>
                  <td className="c-sub" data-label="Why">
                    {WHY[key] ?? 'A short crossover between the two sessions.'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-note">No sessions overlap on this day.</p>
      )}
    </section>
  );
}
