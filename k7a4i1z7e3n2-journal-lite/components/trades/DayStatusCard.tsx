'use client';

import { Lock, Moon, Sun, Flame, PauseCircle } from 'lucide-react';
import { fmtDay, fmtR, fmtSpan, parseDay, sideOf } from '@/lib/journal';
import { useJournal } from '../JournalContext';
import { useNow } from '../hooks';

/** Today's forex day: time left, real trades taken, today's R, and whatever is locking entry. */
export default function DayStatusCard({ onBatman }: { onBatman: () => void }) {
  const j = useJournal();
  const now = useNow(15000);
  const t = j.today;
  const left = t.endsAt.getTime() - now.getTime();

  let tone: 'ok' | 'locked' | 'idle' | 'batman' = 'ok';
  let Icon = Sun;
  let headline = 'Open for trading';
  let detail = 'One real loss closes real trading for the rest of the forex day.';

  if (j.batman) {
    tone = 'batman';
    Icon = Moon;
    headline = 'Batman Mode';
    detail = `Real and missed entries are blocked until ${fmtDay(parseDay(j.batman))}. Demo stays open.`;
  } else if (t.lossLock) {
    tone = 'locked';
    Icon = Lock;
    headline = 'Done for today';
    detail = `A real loss on ${t.lossLock.pair} closed the day. Real trading reopens in ${fmtSpan(left)}. Demo stays open.`;
  } else if (t.blown) {
    tone = 'locked';
    Icon = Flame;
    headline = 'Week blown';
    detail = `No real trading through ${fmtDay(parseDay(t.blown.blown_through))}. Demo stays open.`;
  } else if (t.shut) {
    tone = 'idle';
    Icon = PauseCircle;
    headline = 'Market closed';
    detail = 'Forex is shut from Friday to Sunday, 5:00 PM New York.';
  }

  return (
    <section className={`day-card tone-${tone} fade-in`} aria-label="Today">
      <div className="day-main">
        <span className="day-icon" aria-hidden="true">
          <Icon />
        </span>
        <div className="day-text">
          <p className="day-head">
            <b>{headline}</b>
            <span className="muted"> · forex day {fmtDay(parseDay(t.day))}</span>
          </p>
          <p className="day-detail">{detail}</p>
        </div>
        {tone === 'batman' && (
          <button type="button" className="btn btn-sm" onClick={onBatman}>
            Change
          </button>
        )}
      </div>
      <dl className="day-stats">
        <div>
          <dt>{t.shut ? 'Opens in' : 'Day ends in'}</dt>
          <dd className="num-tab">{fmtSpan(left)}</dd>
        </div>
        <div>
          <dt>Real trades today</dt>
          <dd className="num-tab">{t.taken.length}</dd>
        </div>
        <div>
          <dt>Today’s P/L</dt>
          <dd className={`num-tab ${sideOf(t.r)}`}>{fmtR(t.r)}</dd>
        </div>
      </dl>
    </section>
  );
}
