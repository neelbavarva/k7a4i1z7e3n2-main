'use client';

import { useMemo, useRef, useState } from 'react';
import { Rabbit, Search, Snail, X } from 'lucide-react';
import { byWeek, fmtPct, fmtR, fmtRate, isOpen, parseDay, sideOf, statsOf } from '@/lib/journal';
import { isDemo } from '@/lib/api';
import { ON_PACE, PACE_LABEL, paceKey, paceOf, type Pace } from '@/lib/pace';
import type { Trade, TradeStatus, TradeType } from '@/lib/types';
import { useJournal } from '../JournalContext';
import { useCountUp, useKey } from '../hooks';
import Seg from '../ui/Seg';
import MarketIcon from '../ui/MarketIcon';
import DayStatusCard from './DayStatusCard';
import { PaceIcon, TradeRow } from './bits';

type TypeFilter = 'all' | TradeType;
type OutcomeFilter = 'all' | TradeStatus;
type PaceFilter = 'all' | 'NONE' | Pace;

const paceKind = (t: Trade): 'NONE' | Pace => paceOf(t) ?? 'NONE';

export default function TradesView() {
  const j = useJournal();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [outcome, setOutcome] = useState<OutcomeFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pace, setPace] = useState<PaceFilter>('all');
  const searchRef = useRef<HTMLInputElement>(null);

  useKey('/', () => searchRef.current?.focus());

  const q = query.trim().toUpperCase().replace(/[\s/]/g, '');
  const inRange = (t: Trade) => {
    const at = new Date(t.createdAt);
    if (from && at < parseDay(from)) return false;
    if (to && at >= new Date(parseDay(to).getTime() + 86400000)) return false;
    return true;
  };

  // pair search and dates narrow everything; type, outcome and pace then split it
  const base = useMemo(
    () => j.trades.filter((t) => (!q || t.pair.toUpperCase().replace('/', '').includes(q)) && inRange(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [j.trades, q, from, to],
  );
  const byType = (t: Trade) => type === 'all' || t.tradeType === type;
  const byOutcome = (t: Trade) => outcome === 'all' || t.status === outcome;
  const byPace = (t: Trade) => pace === 'all' || paceKind(t) === pace;
  const filtered = useMemo(
    () => base.filter((t) => byType(t) && byOutcome(t) && byPace(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, type, outcome, pace],
  );

  // each switch counts what the other filters leave
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = { all: 0, NORMAL: 0, DEMO: 0, MISSED: 0 };
    for (const t of base.filter((t) => byOutcome(t) && byPace(t))) {
      c.all++;
      c[t.tradeType]++;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, outcome, pace]);
  // the trades every filter but pace leaves: the pace switch and the pace breakdown split these
  const paceBase = useMemo(
    () => base.filter((t) => byType(t) && byOutcome(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, type, outcome],
  );
  const paceCounts = useMemo(() => {
    const c: Record<PaceFilter, number> = { all: paceBase.length, NONE: 0, RUSHING: 0, DRAGGING: 0 };
    for (const t of paceBase) c[paceKind(t)]++;
    return c;
  }, [paceBase]);

  // matching pairs while searching: one card each
  const matches = useMemo(() => {
    if (!q) return [];
    const by = new Map<string, Trade[]>();
    for (const t of base) by.set(t.pair, [...(by.get(t.pair) || []), t]);
    return [...by.entries()].map(([pair, rows]) => ({ pair, ...statsOf(rows) })).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [base, q]);

  const open = filtered.filter(isOpen);
  const weeks = useMemo(() => byWeek(filtered.filter((t) => !isOpen(t))), [filtered]);
  const filtering = !!(q || from || to || type !== 'all' || outcome !== 'all' || pace !== 'all');
  const clear = () => {
    setQuery('');
    setType('all');
    setOutcome('all');
    setPace('all');
    setFrom('');
    setTo('');
  };

  return (
    <>
      <section className="overview">
        <div className="overview-row">
          <h1 className="overview-title">Trade journal</h1>
        </div>
        <hr className="rule" />
      </section>

      <DayStatusCard />

      <div className="searchbar">
        <Search aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          placeholder="Search pairs: EURUSD, gbp, xau…"
          aria-label="Search trades by pair"
          autoComplete="off"
          spellCheck={false}
        />
        {query ? (
          <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
            <X />
          </button>
        ) : (
          <kbd aria-hidden="true">/</kbd>
        )}
      </div>

      {matches.length > 0 && (
        <ul className="matches stagger" aria-label="Matching pairs">
          {matches.map((m, i) => (
            <li key={m.pair} style={{ '--i': i } as React.CSSProperties}>
              <button type="button" className="match" onClick={() => setQuery(m.pair)} aria-label={`Show only ${m.pair}`}>
                <MarketIcon symbol={m.pair} size={22} />
                <span className="match-text">
                  <b>{m.pair}</b>
                  <span>
                    {m.total} trade{m.total === 1 ? '' : 's'} · {fmtRate(m.winRate)} won
                  </span>
                </span>
                <span className={`pnl ${sideOf(m.r)}`}>{fmtR(m.r)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="toolbar">
        <Seg
          label="Trade type"
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'All', count: typeCounts.all },
            { value: 'NORMAL', label: 'Real', count: typeCounts.NORMAL },
            { value: 'DEMO', label: 'Demo', count: typeCounts.DEMO },
            { value: 'MISSED', label: 'Missed', count: typeCounts.MISSED },
          ]}
        />
        <Seg
          label="Outcome"
          value={outcome}
          onChange={setOutcome}
          options={[
            { value: 'all', label: 'Any result' },
            { value: 'OPEN', label: 'Open' },
            { value: 'PROFIT', label: 'Profit' },
            { value: 'LOSS', label: 'Loss' },
          ]}
        />
        <Seg
          label="Pace"
          className="pace-seg"
          value={pace}
          onChange={setPace}
          options={[
            { value: 'all', label: 'Any pace', count: paceCounts.all },
            { value: 'NONE', label: ON_PACE, count: paceCounts.NONE, className: 'p-none' },
            { value: 'RUSHING', label: PACE_LABEL.RUSHING, icon: <Rabbit aria-hidden="true" />, count: paceCounts.RUSHING, className: 'p-rushing' },
            { value: 'DRAGGING', label: PACE_LABEL.DRAGGING, icon: <Snail aria-hidden="true" />, count: paceCounts.DRAGGING, className: 'p-dragging' },
          ]}
        />
        <div className="dates" role="group" aria-label="Date range">
          <input type="date" className="input input-sm" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          <span aria-hidden="true">–</span>
          <input type="date" className="input input-sm" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        </div>
        {filtering && (
          <button type="button" className="btn btn-ghost fade-in" onClick={clear}>
            <X aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      {j.state === 'loading' ? (
        <div className="skeleton" aria-busy="true" aria-label="Loading trades">
          <div className="sk sk-brief" />
          <div className="sk sk-rows" />
        </div>
      ) : j.state === 'error' ? (
        <div className="empty-card fade-in" role="alert">
          <h2>The journal didn’t load</h2>
          <p>{j.error || 'The Kaizen Journal API isn’t answering right now.'} Your trades are safe; this page just couldn’t reach them.</p>
          <button type="button" className="btn btn-primary" onClick={j.reload}>
            Try again
          </button>
        </div>
      ) : !j.trades.length ? (
        <div className="empty-card fade-in">
          <h2>No trades yet</h2>
          <p>Log your first trade: the pair, the R you’re aiming for, and why you took it.</p>
          <div className="empty-actions">
            <button type="button" className="btn btn-primary" onClick={j.newTrade}>
              New trade
            </button>
            {!isDemo() && (
              <a className="btn" href="/?demo">
                Explore with sample data
              </a>
            )}
          </div>
        </div>
      ) : (
        <>
          <Summary trades={filtered} filtering={filtering} />
          <PaceBreakdown trades={paceBase} value={pace} onPick={setPace} filtering={!!(q || from || to || type !== 'all' || outcome !== 'all')} />

          {!filtered.length && (
            <div className="empty-card fade-in">
              <h2>No trades match</h2>
              <p>Nothing in the journal fits this mix of pair, type, result and dates.</p>
              <button type="button" className="btn" onClick={clear}>
                Clear filters
              </button>
            </div>
          )}

          {open.length > 0 && <Group title="Open" rows={open} note="Close them as a profit or a loss" />}
          {weeks.map((w) => (
            <Group key={w.key} title={w.label} rows={w.rows} />
          ))}

          {j.loadingMore && (
            <p className="loading-more" role="status">
              <span className="spinner" aria-hidden="true" />
              Loading older trades…
            </p>
          )}
        </>
      )}
    </>
  );
}

function Summary({ trades, filtering }: { trades: Trade[]; filtering: boolean }) {
  const s = statsOf(trades);
  const r = useCountUp(s.r);
  const rate = useCountUp(s.winRate == null ? 0 : s.winRate * 100);
  return (
    <section className="group" aria-labelledby="g-summary">
      <div className="group-head">
        <h2 id="g-summary">Summary</h2>
        {filtering && <span className="group-note">Following your filters</span>}
      </div>
      <dl className="brief five summary">
        <div className="brief-cell">
          <dt>Trades</dt>
          <dd className="brief-num">{s.total}</dd>
          <dd className="brief-sub">{s.open ? `${s.open} open` : 'None open'}</dd>
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
            {s.winRate == null ? '—' : Math.round(rate)}
            {s.winRate != null && <small>%</small>}
          </dd>
          <dd className="meter" aria-hidden="true">
            <span className="meter-fill up" style={{ width: `${(s.winRate || 0) * 100}%` }} />
          </dd>
        </div>
        <div className="brief-cell">
          <dt>Net</dt>
          <dd className={`brief-num ${sideOf(s.r)}`}>{fmtR(r)}</dd>
          <dd className="brief-sub">{fmtPct(s.percent)} of risk</dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * The three kinds of trade side by side: how many, how they did, and their share of the whole.
 * Each column filters the list to that pace (again to show everything).
 */
function PaceBreakdown({ trades, value, onPick, filtering }: { trades: Trade[]; value: PaceFilter; onPick: (p: PaceFilter) => void; filtering: boolean }) {
  const kinds: ('NONE' | Pace)[] = ['NONE', 'RUSHING', 'DRAGGING'];
  const groups = kinds.map((k) => {
    const list = trades.filter((t) => paceKind(t) === k);
    return { k, n: list.length, ...statsOf(list) };
  });
  // whole-number shares that add up to 100: the leftover points go to the biggest remainders
  const total = trades.length || 1;
  const share = groups.map((g) => Math.floor((g.n / total) * 100));
  const order = groups.map((g, i) => i).sort((a, b) => ((groups[b].n / total) * 100 - share[b]) - ((groups[a].n / total) * 100 - share[a]));
  for (let left = trades.length ? 100 - share.reduce((a, b) => a + b, 0) : 0, i = 0; left > 0; left--, i++) share[order[i % 3]]++;
  return (
    <section className="group" aria-labelledby="g-pace">
      <div className="group-head">
        <h2 id="g-pace">Pace</h2>
        <span className="group-note">{filtering ? 'Following your filters' : 'Every trade: real, demo and missed'}</span>
      </div>
      <div className="pace-card">
        <div className="pace-bar" aria-hidden="true">
          {groups.map((g) => g.n > 0 && <span key={g.k} className={`p-${paceKey(g.k === 'NONE' ? null : g.k)}`} style={{ flexGrow: g.n }} />)}
        </div>
        <div className="pace-cells">
          {groups.map((g, i) => {
            const on = value === g.k;
            return (
              <button
                key={g.k}
                type="button"
                className={`pace-cell p-${paceKey(g.k === 'NONE' ? null : g.k)}`}
                aria-pressed={on}
                onClick={() => onPick(on ? 'all' : g.k)}
                title={on ? 'Show every pace' : `Show only ${g.k === 'NONE' ? ON_PACE.toLowerCase() : PACE_LABEL[g.k].toLowerCase()} trades`}
              >
                <span className="pace-name">
                  {g.k === 'NONE' ? <i aria-hidden="true" /> : <PaceIcon pace={g.k} />}
                  {g.k === 'NONE' ? ON_PACE : PACE_LABEL[g.k]}
                  <span className="pace-share">{share[i]}%</span>
                </span>
                <span className="pace-num">
                  {g.n}
                  <small>{g.n === 1 ? 'trade' : 'trades'}</small>
                </span>
                <span className="pace-stats">
                  <b className={g.closed ? sideOf(g.r) : ''}>{g.closed ? fmtR(g.r) : '—'}</b>
                  <span>{fmtRate(g.winRate)} won</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Group({ title, rows, note }: { title: string; rows: Trade[]; note?: string }) {
  const j = useJournal();
  const s = statsOf(rows);
  return (
    <section className="group trade-group">
      <div className="group-head">
        <h3 className="group-title">{title}</h3>
        <span className="count">{rows.length}</span>
        {note ? (
          <span className="group-note">{note}</span>
        ) : (
          <span className="group-sum">
            <span className="muted">
              {s.wins}W {s.losses}L
            </span>
            <b className={sideOf(s.r)}>{fmtR(s.r)}</b>
          </span>
        )}
      </div>
      <div className="rows-card">
        <ul className="rows stagger">
          {rows.map((t, i) => (
            <TradeRow key={t.id} t={t} i={i} onOpen={() => j.openTrade(t.id)} />
          ))}
        </ul>
      </div>
    </section>
  );
}
