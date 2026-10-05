'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, FlaskConical, ListOrdered, Plus } from 'lucide-react';
import { friendly, isDemo, listAllTrades, listBlownWeeks } from '@/lib/api';
import { dayKey, dayStatus, fmtDay, parseDay } from '@/lib/journal';
import { loadBatman, loadTab, saveBatman, saveTab, type Tab } from '@/lib/prefs';
import type { BlownWeek, Trade, TradeType } from '@/lib/types';
import { JournalCtx, type Journal, type LoadState } from './JournalContext';
import { useKey, useNow, useScrolled } from './hooks';
import Seg from './ui/Seg';
import { Toaster } from './ui/Toast';
import TradesView from './trades/TradesView';
import CalendarView from './calendar/CalendarView';
import NewTrade from './trades/NewTrade';
import TradeDetail from './trades/TradeDetail';

const TABS = [
  { value: 'trades' as const, label: 'Trades', title: 'Trades (1)', icon: <ListOrdered aria-hidden="true" /> },
  { value: 'calendar' as const, label: 'Calendar', title: 'Calendar (2)', icon: <CalendarDays aria-hidden="true" /> },
];

export default function JournalApp() {
  return (
    <Toaster>
      <Workspace />
    </Toaster>
  );
}

function Workspace() {
  const [tab, setTab] = useState<Tab>('trades');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blownWeeks, setBlownWeeks] = useState<BlownWeek[]>([]);
  const [version, setVersion] = useState(0);
  const [batman, setBatmanState] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [demo, setDemo] = useState(false);
  const loadId = useRef(0);
  const scrolled = useScrolled();
  const now = useNow(30000);

  // browser-only preferences, read after the first render so server and client agree
  useEffect(() => {
    setTab(loadTab());
    setBatmanState(loadBatman());
    setDemo(isDemo());
  }, []);

  const reload = useCallback(async () => {
    const id = ++loadId.current;
    setState((s) => (s === 'ready' ? s : 'loading'));
    setError(null);
    try {
      await listAllTrades((sofar, more) => {
        if (id !== loadId.current) return;
        setTrades(sofar);
        setState('ready');
        setLoadingMore(more);
      });
    } catch (e) {
      if (id !== loadId.current) return;
      setError(friendly(e));
      setState((s) => (s === 'ready' ? s : 'error'));
      setLoadingMore(false);
    }
  }, []);

  const reloadBlown = useCallback(async () => {
    try {
      setBlownWeeks(await listBlownWeeks());
    } catch {
      /* the calendar shows its own error; discipline just won't know about blown weeks */
    }
  }, []);

  useEffect(() => {
    reload();
    reloadBlown();
  }, [reload, reloadBlown]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const applyTrade = useCallback(
    (t: Trade) => {
      setTrades((list) => {
        const rest = list.filter((x) => x.id !== t.id);
        return [t, ...rest].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
      });
      bump();
    },
    [bump],
  );

  const dropTrade = useCallback(
    (id: string) => {
      setTrades((list) => list.filter((x) => x.id !== id));
      setSelected((s) => (s === id ? null : s));
      bump();
    },
    [bump],
  );

  const setBatman = useCallback((until: string | null) => {
    saveBatman(until);
    setBatmanState(until);
  }, []);

  const today = useMemo(() => (now ? dayStatus(trades, blownWeeks, now) : null), [trades, blownWeeks, now]);
  const batmanActive = batman && now && batman > dayKey(now) ? batman : null;

  const blocked = useMemo(() => {
    const b: Partial<Record<TradeType, string>> = {};
    if (batmanActive) {
      const why = `Batman Mode is on until ${fmtDay(parseDay(batmanActive))}. Demo trades are still open.`;
      b.NORMAL = why;
      b.MISSED = why;
    } else if (today?.lossLock) {
      b.NORMAL = 'One real loss today: real trading reopens at 5:00 PM New York. Demo is still open.';
    } else if (today?.blown) {
      b.NORMAL = `This week is marked blown through ${fmtDay(parseDay(today.blown.blown_through))}. Demo is still open.`;
    }
    return b;
  }, [batmanActive, today]);

  const switchTab = (t: Tab) => {
    setTab(t);
    saveTab(t);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    document.title = `${tab === 'calendar' ? 'Calendar' : 'Trades'} · Kaizen Journal`;
  }, [tab]);

  useKey('n', () => setCreating(true));
  useKey('1', () => switchTab('trades'));
  useKey('2', () => switchTab('calendar'));

  const journal: Journal = {
    trades,
    state,
    loadingMore,
    error,
    reload,
    blownWeeks,
    reloadBlown,
    applyTrade,
    dropTrade,
    version,
    bump,
    openTrade: setSelected,
    newTrade: () => setCreating(true),
    today,
    batman: batmanActive,
    setBatman,
    blocked,
  };

  return (
    <JournalCtx.Provider value={journal}>
      <header className={`topbar${scrolled ? ' is-scrolled' : ''}`}>
        <div className="topbar-in">
          <div className="brand">
            <Mark />
            <span className="brand-name">Kaizen Journal</span>
          </div>
          <Seg className="tabs" label="Workspace" options={TABS} value={tab} onChange={switchTab} />
          <div className="topbar-actions">
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              <span className="btn-label">New trade</span>
              <kbd>N</kbd>
            </button>
          </div>
        </div>
      </header>

      {demo && (
        <div className="demo-bar" role="status">
          <div className="demo-bar-in">
            <FlaskConical aria-hidden="true" />
            <p>
              <b>Sample data</b> <span className="demo-bar-more">· made-up trades to try everything. Changes stay in this tab and reset on reload.</span>
            </p>
            <a className="btn btn-sm" href="/">
              Use my journal
            </a>
          </div>
        </div>
      )}

      <main className="page" id="main">
        <div key={tab} className="fade-in">
          {tab === 'trades' ? <TradesView /> : <CalendarView />}
        </div>

        <footer className="footer">
          <p>
            Forex day {today && `${fmtDay(parseDay(today.day))} · `}rolls over at 5:00 PM New York · data from the Kaizen Journal API
          </p>
          <p className="keys" aria-hidden="true">
            <span>
              <kbd>N</kbd>new trade
            </span>
            <span>
              <kbd>/</kbd>search pairs
            </span>
            <span>
              <kbd>1</kbd>
              <kbd>2</kbd>switch tab
            </span>
          </p>
        </footer>
      </main>

      <NewTrade open={creating} onClose={() => setCreating(false)} />
      <TradeDetail id={selected} onClose={() => setSelected(null)} />
    </JournalCtx.Provider>
  );
}

/** The family mark: a rope with a knot on it. */
export function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect className="mark-rope" x="2" y="15" width="28" height="2" rx="1" />
      <circle className="mark-knot" cx="16" cy="16" r="6" />
    </svg>
  );
}
