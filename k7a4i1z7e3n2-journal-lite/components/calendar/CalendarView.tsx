'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Flame, X } from 'lucide-react';
import { friendly, getCalendar } from '@/lib/api';
import {
  blownFor,
  dayKey,
  describeRanked,
  fmtDay,
  fmtMonth,
  fmtPct,
  fmtR,
  isOpen,
  monthGrid,
  monthKey,
  parseDay,
  rOf,
  shiftMonth,
  sideOf,
} from '@/lib/journal';
import { PACES, PACE_LABEL, paceKey, paceOf } from '@/lib/pace';
import type { CalendarDay, CalendarMonth, Ranked, Trade, TradeType } from '@/lib/types';
import { useJournal } from '../JournalContext';
import { useKey } from '../hooks';
import Seg from '../ui/Seg';
import Modal from '../ui/Modal';
import MarketIcon from '../ui/MarketIcon';
import { PaceTag, TradeRow } from '../trades/bits';
import PairPicker from './PairPicker';
import BlownWeekDialog from './BlownWeekDialog';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SHOWN = 3; // trades shown in a day before "+N"

type TypeFilter = 'all' | TradeType;

export default function CalendarView() {
  const j = useJournal();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [pair, setPair] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [data, setData] = useState<CalendarMonth | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState<CalendarDay | null>(null);
  const [blownWeek, setBlownWeek] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setState((s) => (s === 'ready' ? s : 'loading'));
    getCalendar(month, { pair: pair || undefined, tradeType: type === 'all' ? undefined : type })
      .then((d) => {
        if (!live) return;
        setData(d);
        setState('ready');
      })
      .catch((e) => {
        if (!live) return;
        setError(friendly(e));
        setState('error');
      });
    return () => {
      live = false;
    };
  }, [month, pair, type, j.version, retry]);

  useKey('arrowleft', () => setMonth((m) => shiftMonth(m, -1)));
  useKey('arrowright', () => setMonth((m) => shiftMonth(m, 1)));
  useKey('p', () => setPickerOpen(true));

  const pairs = useMemo(() => [...new Set(j.trades.map((t) => t.pair))].sort(), [j.trades]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { '': j.trades.length };
    for (const t of j.trades) c[t.pair] = (c[t.pair] || 0) + 1;
    return c;
  }, [j.trades]);

  const days = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    for (const d of data?.month === month ? data.days : []) m.set(d.date.slice(0, 10), d);
    return m;
  }, [data, month]);

  const weeks = monthGrid(month);
  const today = dayKey(new Date());
  const isThisMonth = month === monthKey(new Date());
  const stale = data?.month !== month;

  return (
    <>
      <section className="overview">
        <div className="overview-row">
          <h1 className="overview-title">{fmtMonth(month)}</h1>
          <div className="overview-actions month-nav">
            <button type="button" className="btn btn-icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" title="Previous month (←)">
              <ChevronLeft />
            </button>
            <button type="button" className="btn" onClick={() => setMonth(monthKey(new Date()))} disabled={isThisMonth}>
              Today
            </button>
            <button type="button" className="btn btn-icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month" title="Next month (→)">
              <ChevronRight />
            </button>
          </div>
        </div>
        <hr className="rule" />
      </section>

      <div className="toolbar">
        <button type="button" className="btn pair-btn" onClick={() => setPickerOpen(true)} aria-haspopup="dialog">
          {pair && <MarketIcon symbol={pair} size={18} />}
          {pair || 'All pairs'}
          <ChevronDown className="chev" aria-hidden="true" />
          <kbd>P</kbd>
        </button>
        <Seg
          label="Trade type"
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'All' },
            { value: 'NORMAL', label: 'Real' },
            { value: 'DEMO', label: 'Demo' },
            { value: 'MISSED', label: 'Missed' },
          ]}
        />
        {(pair || type !== 'all') && (
          <button
            type="button"
            className="btn btn-ghost fade-in"
            onClick={() => {
              setPair('');
              setType('all');
            }}
          >
            <X aria-hidden="true" />
            Clear
          </button>
        )}
        <span className="pace-legend" aria-hidden="true">
          {PACES.map((p) => (
            <span key={p}>
              <PaceTag pace={p} compact />
              {PACE_LABEL[p]}
            </span>
          ))}
        </span>
      </div>

      {state === 'error' && !data ? (
        <div className="empty-card fade-in" role="alert">
          <h2>The calendar didn’t load</h2>
          <p>{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => setRetry((r) => r + 1)}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className={`cal${stale && state !== 'error' ? ' is-stale' : ''}`} aria-busy={stale || undefined}>
            <div className="cal-head" aria-hidden="true">
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
              <span />
            </div>
            {weeks.map((week) => {
              const monday = week[0].key;
              const record = j.blownWeeks.find((b) => b.week_start.slice(0, 10) === monday);
              return (
                <div key={monday} className={`cal-week${record ? ' is-blown-week' : ''}`}>
                  {week.map((d) => {
                    const day = days.get(d.key);
                    const blown = !!blownFor(d.key, record ? [record] : []);
                    const trades = day?.trades || [];
                    return (
                      <div
                        key={d.key}
                        className={`cal-day${d.inMonth ? '' : ' is-out'}${d.key === today ? ' is-today' : ''}${blown ? ' is-blown' : ''}${trades.length ? ' has-trades' : ''}`}
                      >
                        <div className="cal-day-top">
                          <span className="cal-num">{d.date.getDate()}</span>
                          {trades.length > 0 && <span className={`cal-r ${sideOf(day!.r)}`}>{fmtR(day!.r)}</span>}
                        </div>
                        {blown && <span className="cal-blown-tag">Blown</span>}
                        <ul className="cal-trades">
                          {trades.slice(0, SHOWN).map((t) => (
                            <li key={t.id}>
                              <button
                                type="button"
                                className={`cal-trade ${tone(t)}${t.tradeType === 'DEMO' ? ' is-demo' : ''} p-${paceKey(paceOf(t))}`}
                                onClick={() => j.openTrade(t.id)}
                                title={`${t.pair} · ${label(t)}${paceOf(t) ? ` · ${PACE_LABEL[paceOf(t)!]}` : ''}`}
                              >
                                <span className="cal-pair">{t.pair}</span>
                                <span className="cal-res">{label(t)}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        {trades.length > SHOWN && (
                          <button type="button" className="cal-more" onClick={() => setDayOpen(day!)}>
                            +{trades.length - SHOWN} more
                          </button>
                        )}
                        {trades.length > 0 && (
                          <button type="button" className="cal-dots" onClick={() => setDayOpen(day!)} aria-label={`${fmtDay(d.date)}: ${trades.length} trades, ${fmtR(day!.r)}`}>
                            {trades.slice(0, 4).map((t) => (
                              <i key={t.id} className={`${tone(t)} p-${paceKey(paceOf(t))}`} />
                            ))}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <div className="cal-week-act">
                    <button
                      type="button"
                      className={`btn btn-ghost btn-icon btn-sm${record ? ' is-on' : ''}`}
                      onClick={() => setBlownWeek(monday)}
                      aria-label={record ? `Blown week of ${fmtDay(parseDay(monday))}: change or undo` : `Mark the week of ${fmtDay(parseDay(monday))} blown`}
                      title={record ? 'Blown week' : 'Mark week blown'}
                    >
                      <Flame />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {data && !stale && <MonthPanel data={data} filtering={!!pair || type !== 'all'} />}
          {state === 'error' && data && (
            <p className="form-error">
              {error} <button type="button" className="linkish" onClick={() => setRetry((r) => r + 1)}>Try again</button>
            </p>
          )}
        </>
      )}

      <PairPicker open={pickerOpen} onClose={() => setPickerOpen(false)} pairs={pairs} counts={counts} value={pair} onPick={setPair} />

      <Modal
        open={!!dayOpen}
        onClose={() => setDayOpen(null)}
        title={dayOpen ? fmtDay(parseDay(dayOpen.date)) : ''}
        sub={dayOpen ? `${dayOpen.trades.length} trades · ${fmtR(dayOpen.r)}` : undefined}
      >
        {dayOpen && (
          <div className="modal-body">
            <div className="rows-card day-list">
              <ul className="rows">
                {dayOpen.trades.map((t, i) => (
                  <TradeRow
                    key={t.id}
                    t={t}
                    i={i}
                    onOpen={() => {
                      setDayOpen(null);
                      j.openTrade(t.id);
                    }}
                  />
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>

      <BlownWeekDialog week={blownWeek} onClose={() => setBlownWeek(null)} />
    </>
  );
}

const tone = (t: Trade) => (isOpen(t) ? 'is-open' : t.status === 'PROFIT' ? 'is-win' : 'is-loss');
const label = (t: Trade) => (isOpen(t) ? 'Open' : fmtR(rOf(t)));

function MonthPanel({ data, filtering }: { data: CalendarMonth; filtering: boolean }) {
  const s = data.summary;
  const rate = s.winRate > 1 ? s.winRate : s.winRate * 100;
  const rows: [string, Ranked, Ranked][] = [
    ['Week', s.weeks?.best ?? null, s.weeks?.worst ?? null],
    ['Pair', s.pairs?.best ?? null, s.pairs?.worst ?? null],
    ['Weekday', s.weekdays?.best ?? null, s.weekdays?.worst ?? null],
  ];
  return (
    <section className="group" aria-labelledby="g-month">
      <div className="group-head">
        <h2 id="g-month">This month</h2>
        {filtering && <span className="group-note">Following your filters</span>}
      </div>
      <dl className="brief five month-brief">
        <div className="brief-cell">
          <dt>Closed</dt>
          <dd className="brief-num">{s.closed}</dd>
          <dd className="brief-sub">{s.open ? `${s.open} still open` : 'None open'}</dd>
        </div>
        <div className="brief-cell">
          <dt>Wins</dt>
          <dd className="brief-num up">{s.wins}</dd>
        </div>
        <div className="brief-cell">
          <dt>Losses</dt>
          <dd className="brief-num down">{s.losses}</dd>
        </div>
        <div className="brief-cell">
          <dt>Win rate</dt>
          <dd className="brief-num">
            {s.closed ? Math.round(rate) : '—'}
            {s.closed > 0 && <small>%</small>}
          </dd>
          <dd className="meter" aria-hidden="true">
            <span className="meter-fill up" style={{ width: `${s.closed ? rate : 0}%` }} />
          </dd>
        </div>
        <div className="brief-cell">
          <dt>Net</dt>
          <dd className={`brief-num ${sideOf(s.r)}`}>{fmtR(s.r)}</dd>
          <dd className="brief-sub">{fmtPct(s.percent)} of risk</dd>
        </div>
      </dl>

      <div className="rank-card">
        <div className="rank-row rank-head" aria-hidden="true">
          <span />
          <span>Best</span>
          <span>Worst</span>
        </div>
        {rows.map(([name, best, worst]) => (
          <div key={name} className="rank-row">
            <span className="rank-name">{name}</span>
            <Rank item={best} />
            <Rank item={worst} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Rank({ item }: { item: Ranked }) {
  const d = describeRanked(item);
  if (!d) return <span className="rank-cell muted">—</span>;
  return (
    <span className="rank-cell">
      <span className="rank-label">{d.label}</span>
      {d.r != null && <b className={sideOf(d.r)}>{fmtR(d.r)}</b>}
      {d.detail && <span className="muted rank-detail">{d.detail}</span>}
    </span>
  );
}
