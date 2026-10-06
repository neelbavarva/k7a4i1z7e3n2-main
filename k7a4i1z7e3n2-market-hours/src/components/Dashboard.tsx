import { useMemo } from 'react';
import { useScrub } from '../hooks';
import type { MarketDay } from '../hooks';
import {
  ACTIVITY_LABEL,
  ACTIVITY_TIERS,
  PHASE_LABEL,
  SESSIONS,
  activityOf,
  phaseAt,
  sampleAt,
} from '../marketModel';
import type { Activity, SessionDef } from '../marketModel';
import {
  DAY_MS,
  HOUR_MS,
  formatClock,
  formatDay,
  formatDuration,
  formatGmtOffset,
  formatLongDay,
  formatWhen,
  offsetMinutes,
} from '../marketTime';
import { Flag, SiteNav, ZoneBar } from './common';
import SessionsChart from './SessionsChart';
import VolumeChart from './VolumeChart';
import AmdChart from './AmdChart';
import { OverlapTable, SessionTable } from './Tables';

interface Props {
  day: MarketDay;
  is24Hour: boolean;
  onPickZone: () => void;
}

const list = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

export default function Dashboard({ day, is24Hour, onPickZone }: Props) {
  const scrub = useScrub(day.livePercent);
  const { timezone, nowMs } = day;

  return (
    <main className="fade-in">
      <section className="overview" aria-labelledby="page-title">
        <ZoneBar timezone={timezone} nowMs={nowMs} is24Hour={is24Hour} onClick={onPickZone} />
        <div className="overview-row">
          <h1 id="page-title" className="overview-title">
            Forex market hours
          </h1>
          <SiteNav current="hours" />
        </div>
      </section>

      <section className="hero" aria-label="Today at a glance">
        <DayMeter day={day} is24Hour={is24Hour} />
        <Brief day={day} is24Hour={is24Hour} />
      </section>

      <RightNow day={day} is24Hour={is24Hour} />

      <SessionsChart day={day} scrub={scrub} is24Hour={is24Hour} />
      <VolumeChart day={day} scrub={scrub} is24Hour={is24Hour} />
      <AmdChart day={day} scrub={scrub} is24Hour={is24Hour} />

      <div className="tables">
        <SessionTable day={day} is24Hour={is24Hour} />
        <OverlapTable day={day} is24Hour={is24Hour} />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------

/** The whole day as one rope, coloured by how busy each hour usually is, with a knot at now. */
function DayMeter({ day, is24Hour }: { day: MarketDay; is24Hour: boolean }) {
  const { volume, dayStart, timezone, preview, livePercent, weekend } = day;
  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, h) => activityOf(sampleAt(volume.values, (h + 0.5) / 24))),
    [volume.values],
  );
  const knotLevel = weekend ? 'closed' : activityOf(sampleAt(volume.values, livePercent / 100));
  const mid = formatLongDay(dayStart + DAY_MS / 2, timezone);
  return (
    <div className="meter daymeter">
      <div className="meter-ends">
        <span>{formatClock(dayStart, timezone, is24Hour)}</span>
        <span className="meter-scale">{preview ? `${mid} · next trading day` : mid}</span>
        <span>{formatClock(dayStart, timezone, is24Hour)}</span>
      </div>
      <div className="meter-rope" role="img" aria-label={`Activity through ${mid}`}>
        {hours.map((lvl, h) => (
          <span key={h} className={`rope-hour lvl-${lvl}`} style={{ left: `${(h / 24) * 100}%`, width: `${100 / 24}%` }} />
        ))}
        {[6, 12, 18].map((h) => (
          <span key={h} className="rope-tick" style={{ left: `${(h / 24) * 100}%` }} />
        ))}
        <span
          className={`meter-knot lvl-${knotLevel}${preview ? ' is-ghost' : ''}`}
          style={{ left: `${livePercent}%` }}
          title={preview ? 'This time of day on the next trading day' : 'Now'}
        />
      </div>
      <div className="rope-key" aria-hidden="true">
        {(['quiet', 'light', 'busy', 'very-busy'] as Activity[]).map((l) => (
          <span key={l}>
            <i className={`lvl-${l}`} />
            {ACTIVITY_LABEL[l]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** The next open or close of any session after now. */
function nextChange(day: MarketDay): { session: SessionDef; kind: 'opens' | 'closes'; at: number } | null {
  let best: { session: SessionDef; kind: 'opens' | 'closes'; at: number } | null = null;
  for (const s of SESSIONS) {
    const st = day.status[s.id];
    const at = st.open ? st.closesAt : st.opensAt;
    if (at === null) continue;
    if (!best || at < best.at) best = { session: s, kind: st.open ? 'closes' : 'opens', at };
  }
  return best;
}

function liveActivity(day: MarketDay): { value: number; level: Activity } | null {
  if (day.weekend) return null;
  const value = sampleAt(day.volume.values, day.livePercent / 100);
  return { value, level: activityOf(value) };
}

function Brief({ day, is24Hour }: { day: MarketDay; is24Hour: boolean }) {
  const { nowMs, timezone, status } = day;
  const open = SESSIONS.filter((s) => status[s.id].open);
  const act = liveActivity(day);
  const next = nextChange(day);
  const pair = open.length >= 2 ? `${open.map((s) => s.city).join('–')} overlap` : null;

  return (
    <dl className="brief">
      <div className="brief-cell">
        <dt>Your time</dt>
        <dd className="brief-num">{formatClock(nowMs, timezone, is24Hour)}</dd>
        <dd className="brief-sub">
          {formatDay(nowMs, timezone)} · {formatGmtOffset(offsetMinutes(timezone, nowMs))}
        </dd>
      </div>
      <div className="brief-cell">
        <dt>Open now</dt>
        <dd className={`brief-num${open.length ? ' up' : ''}`}>
          {open.length}
          <span className="brief-of">/4</span>
        </dd>
        <dd className="brief-sub">{open.length ? list(open.map((s) => s.city)) : day.weekend ? 'Closed for the weekend' : 'Between sessions'}</dd>
      </div>
      <div className="brief-cell">
        <dt>Activity</dt>
        <dd className={`brief-num lvl-text-${act?.level ?? 'closed'}`}>{act ? ACTIVITY_LABEL[act.level] : 'Closed'}</dd>
        <dd className="brief-sub">{act ? pair ?? (open.length ? `${open[0].city} session` : 'No major session open') : 'No session trading'}</dd>
      </div>
      <div className="brief-cell">
        <dt>Next</dt>
        {next ? (
          <>
            <dd className="brief-num">{formatWhen(next.at, nowMs, timezone, is24Hour)}</dd>
            <dd className="brief-sub">
              {next.session.city} {next.kind} in {formatDuration(next.at - nowMs)}
            </dd>
          </>
        ) : (
          <dd className="brief-sub">Nothing scheduled</dd>
        )}
      </div>
    </dl>
  );
}

// ---------------------------------------------------------------------------

type CheckKind = 'ok' | 'warn' | 'no' | 'info';

function RightNow({ day, is24Hour }: { day: MarketDay; is24Hour: boolean }) {
  const { nowMs, timezone, status, todayStart } = day;
  const open = SESSIONS.filter((s) => status[s.id].open);
  const act = liveActivity(day);
  const score = act ? Math.round(act.value * 100) : 0;
  const lnOpen = status.london.open && status.newyork.open;
  const next = nextChange(day);
  const clock = (t: number) => formatWhen(t, nowMs, timezone, is24Hour);

  let call: string;
  let tone: 'good' | 'mid' | 'low' | 'flat';
  let icon: string;
  let sub: string;
  if (day.weekend) {
    call = 'Closed for the weekend';
    tone = 'flat';
    icon = '■';
    sub = `Forex stops from Friday 5 pm to Sunday 5 pm New York time.${next ? ` ${next.session.city} opens ${clock(next.at)}.` : ''}`;
  } else if (lnOpen) {
    call = 'Busiest time of the day';
    tone = 'good';
    icon = '▲';
    sub = 'London and New York are both open. Spreads are usually at their tightest and moves at their biggest.';
  } else if (act && (act.level === 'busy' || act.level === 'very-busy')) {
    call = 'Active market';
    tone = 'good';
    icon = '▲';
    sub = `${list(open.map((s) => s.city))} ${open.length > 1 ? 'are' : 'is'} open, so liquidity is good.`;
  } else if (act && act.level === 'light') {
    call = 'Steady but thinner';
    tone = 'mid';
    icon = '◆';
    sub = open.length
      ? `Only ${list(open.map((s) => s.city))} ${open.length > 1 ? 'are' : 'is'} open. Expect smaller moves and wider spreads.`
      : 'Between sessions: activity is winding down or just starting.';
  } else {
    call = 'Quiet market';
    tone = 'low';
    icon = '▼';
    sub = 'Little is trading right now. Spreads tend to be wide and price can drift or jump on thin volume.';
  }

  const tier = [...ACTIVITY_TIERS].reverse().find((t) => score >= t.from);

  // overlap check: now, or the next one today
  const nowH = (nowMs - todayStart) / HOUR_MS;
  const liveCross = day.preview ? [] : day.crossings;
  const current = liveCross.find((c) => c.rawStart <= nowH && c.rawEnd > nowH);
  const upcoming = liveCross.find((c) => c.rawStart > nowH);
  const atH = (h: number) => clock(day.dayStart + h * HOUR_MS);
  // "at 2:30 am" today, "Mon 2:30 am" on another day
  const at = (t: number) => {
    const c = clock(t);
    return /^[A-Z][a-z]{2} /.test(c) ? c : `at ${c}`;
  };

  const phase = day.weekend ? null : phaseAt(day.amd.segments, (day.livePercent / 100) * 24);
  const phaseSeg = phase ? day.amd.segments.find((s) => s.phase === phase && s.start <= nowH && s.end > nowH) : null;

  const checks: { kind: CheckKind; label: string; text: string }[] = [
    current
      ? { kind: 'ok', label: 'Overlap', text: `${current.a.city} + ${current.b.city} until ${atH(current.rawEnd)}` }
      : upcoming
        ? { kind: 'info', label: 'Overlap', text: `next is ${upcoming.a.city} + ${upcoming.b.city} from ${atH(upcoming.rawStart)}` }
        : { kind: 'no', label: 'Overlap', text: day.weekend ? 'none until the market reopens' : 'none left today' },
    phase && phaseSeg
      ? {
          kind: phase === 'manipulation' ? 'warn' : phase === 'distribution' ? 'ok' : 'info',
          label: 'Phase',
          text: `${PHASE_LABEL[phase]} until ${atH(phaseSeg.rawEnd)}${phase === 'manipulation' ? ', watch for false breakouts' : ''}`,
        }
      : { kind: 'info', label: 'Phase', text: 'no clear phase right now' },
    next
      ? { kind: 'info', label: 'Next change', text: `${next.session.city} ${next.kind} ${at(next.at)}` }
      : { kind: 'info', label: 'Next change', text: 'nothing scheduled' },
  ];

  return (
    <section className="biascheck" aria-labelledby="rn-title">
      <div className="bc-head">
        <h2 id="rn-title">Right now</h2>
        <span className="muted small bc-caption">From which sessions are open at {formatClock(nowMs, timezone, is24Hour)}</span>
      </div>

      <div className="bc-grid">
        <div className="bc-verdict">
          <p className={`bc-call tone-${tone}`}>
            <span className="bc-arrow" aria-hidden="true">
              {icon}
            </span>
            {call}
          </p>
          <p className="bc-sub">{sub}</p>

          <div className="bc-strength">
            <div className="bc-strength-top">
              <span>Activity</span>
              <span>
                <b className={`tone-${tone}`}>{day.weekend ? '0' : score}</b>
                <span className="muted">/100</span> · {day.weekend ? 'Closed' : tier ? ACTIVITY_LABEL[tier.key] : 'Quiet'}
              </span>
            </div>
            <div className="bc-meter" role="img" aria-label={`Activity ${score} out of 100`}>
              <span className={`bc-fill lvl-${act?.level ?? 'quiet'}`} style={{ width: `${day.weekend ? 0 : score}%` }} />
              {ACTIVITY_TIERS.map((t) => (
                <span key={t.key} className="bc-tick" style={{ left: `${t.from}%` }} />
              ))}
            </div>
            <div className="bc-scale" aria-hidden="true">
              <span style={{ left: '0%' }} className={!day.weekend && !tier ? 'on' : ''}>
                Quiet
              </span>
              {ACTIVITY_TIERS.map((t) => (
                <span key={t.key} style={{ left: `${t.from}%` }} className={!day.weekend && tier?.key === t.key ? 'on' : ''}>
                  {ACTIVITY_LABEL[t.key]}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="bc-weights">
          <h3>Sessions</h3>
          <ul className="ses-list">
            {SESSIONS.map((s) => {
              const st = status[s.id];
              const total = st.open && st.openedAt && st.closesAt ? st.closesAt - st.openedAt : 1;
              const done = st.open && st.openedAt ? (nowMs - st.openedAt) / total : 0;
              return (
                <li key={s.id} className={st.open ? 'is-open' : ''}>
                  <Flag id={s.id} size={18} />
                  <span className="ses-name">{s.city}</span>
                  <span className="ses-track" aria-hidden="true">
                    <span className="ses-fill" style={{ width: `${Math.round(done * 100)}%`, background: s.color }} />
                  </span>
                  <span className="ses-when">
                    {st.open && st.closesAt
                      ? `closes in ${formatDuration(st.closesAt - nowMs)}`
                      : st.opensAt
                        ? st.opensAt - nowMs < 20 * HOUR_MS
                          ? `opens in ${formatDuration(st.opensAt - nowMs)}`
                          : `opens ${clock(st.opensAt)}`
                        : 'closed'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <ul className="bc-checks rn-checks">
        {checks.map((k) => (
          <li key={k.label} className={k.kind}>
            <span className="bc-icon" aria-label={{ ok: 'Good', warn: 'Caution', no: 'None', info: 'Info' }[k.kind]}>
              {{ ok: '✓', warn: '!', no: '✕', info: 'i' }[k.kind]}
            </span>
            <span className="bc-label">{k.label}</span>
            <span className="bc-text">{k.text}</span>
          </li>
        ))}
      </ul>

    </section>
  );
}
