import { SESSIONS } from '../marketModel';
import { formatDuration, formatWhen } from '../marketTime';
import type { MarketDay } from '../hooks';

const list = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * Top-of-page status: which sessions are open right now (amber over the weekend), with the
 * 12 / 24-hour switch on the right.
 */
export default function StatusBar({
  day,
  is24Hour,
  setIs24Hour,
}: {
  day: MarketDay;
  is24Hour: boolean;
  setIs24Hour: (v: boolean) => void;
}) {
  const { status, nowMs, timezone } = day;
  const open = SESSIONS.filter((s) => status[s.id].open);
  const next = SESSIONS.filter((s) => !status[s.id].open && status[s.id].opensAt !== null).sort(
    (a, b) => status[a.id].opensAt! - status[b.id].opensAt!,
  )[0];
  const nextAt = next ? status[next.id].opensAt! : null;
  const when = (t: number) => `${formatWhen(t, nowMs, timezone, is24Hour)}, in ${formatDuration(t - nowMs)}`;

  let text: string;
  if (day.weekend) text = next && nextAt ? `Closed for the weekend. ${next.city} opens ${when(nextAt)}.` : 'Closed for the weekend.';
  else if (open.length) text = `${list(open.map((s) => s.city))} ${open.length > 1 ? 'are' : 'is'} open.`;
  else text = next && nextAt ? `Between sessions. ${next.city} opens ${when(nextAt)}.` : 'Between sessions.';

  return (
    <div className={`statusbar${day.weekend ? ' is-stale' : ''}`} role="status">
      <i aria-hidden="true" />
      <p>
        {text}
        <span className="sb-extra"> Times update every 30 seconds.</span>
      </p>
      <div className="seg" role="group" aria-label="Clock format">
        <button type="button" aria-pressed={!is24Hour} onClick={() => setIs24Hour(false)}>
          12h
        </button>
        <button type="button" aria-pressed={is24Hour} onClick={() => setIs24Hour(true)}>
          24h
        </button>
      </div>
    </div>
  );
}
