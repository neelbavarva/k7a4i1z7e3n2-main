'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type State = 'ok' | 'warn' | 'fail' | 'off';
type Check = { state: State; detail: string; ms?: number };
type Checks = Record<string, Check>;

const STATE_LABEL: Record<State, string> = { ok: 'Working', warn: 'Needs attention', fail: 'Failing', off: 'Not available' };

// the checks, in the order the data flows
const CHECKS = [
  { id: 'worldbank', title: 'World Bank Data360', what: 'Asked directly, right now, for one small series' },
  { id: 'economics', title: 'The page’s economic data', what: 'Every indicator for every market, through the server’s cache' },
  { id: 'oecd', title: 'AI capital flow', what: 'OECD.AI, the built-in table or a live feed' },
  { id: 'bubbles', title: 'Bubble library', what: 'Historical episodes shipped with the site' },
  { id: 'server', title: 'Screener server', what: 'Vercel, answering this check' },
];

// which checks light up each box in the diagram
const NODE_CHECKS: Record<string, string[]> = {
  worldbank: ['worldbank'],
  oecd: ['oecd'],
  bubbles: ['bubbles'],
  server: ['server', 'economics'],
  you: ['server'],
};

const worst = (states: State[]): State | null =>
  states.includes('fail') ? 'fail' : states.includes('warn') ? 'warn' : states.some(s => s === 'ok') ? 'ok' : states.length ? 'off' : null;

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Runs /api/health from this browser; the round trip itself is the server check. */
function useHealth() {
  const [checks, setChecks] = useState<Checks | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async () => {
    setBusy(true);
    const t0 = performance.now();
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const ms = Math.round(performance.now() - t0);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { checks: ({ id: string } & Check)[] };
      const out: Checks = Object.fromEntries(body.checks.map(({ id, ...c }) => [id, c]));
      out.server = { state: 'ok', detail: `Answered every check in ${ms} ms.`, ms };
      setChecks(out);
    } catch (error) {
      const ms = Math.round(performance.now() - t0);
      setChecks(
        Object.fromEntries(
          CHECKS.map(c => [c.id, c.id === 'server'
            ? { state: 'fail' as State, detail: `/api/health didn't answer (${(error as Error).message}).`, ms }
            : { state: 'off' as State, detail: 'Couldn’t be checked: the server didn’t answer.' }]),
        ),
      );
    } finally {
      setAt(Date.now());
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    run();
  }, [run]);
  return { checks, at, busy, run };
}

function StateIcon({ state }: { state: State | null }) {
  if (!state) return <span className="hc-icon is-wait" aria-label="Checking" />;
  return (
    <span className={`hc-icon is-${state}`} aria-label={STATE_LABEL[state]}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        {state === 'ok' ? <path d="m4 8.2 2.6 2.6L12 5.4" /> : state === 'fail' ? <path d="M5 5l6 6M11 5l-6 6" /> : state === 'warn' ? <path d="M8 4.5v4.2M8 11.4v.1" /> : <path d="M4.5 8h7" />}
      </svg>
    </span>
  );
}

function Arrow() {
  return (
    <div className="fl-arrow" aria-hidden="true">
      <svg viewBox="0 0 24 12">
        <path d="M1 6h20M16 1.5 21 6l-5 4.5" />
      </svg>
    </div>
  );
}

/** Sources, the server, your browser; each box shows the state of its checks. */
export function DataFlow({ checks }: { checks: Checks | null }) {
  const Node = ({ id, name, sub }: { id: string; name: string; sub: string }) => {
    const s = checks ? worst(NODE_CHECKS[id].map(c => checks[c]?.state).filter((x): x is State => Boolean(x))) : null;
    return (
      <div className="fl-node">
        <i className={`fl-dot${s ? ` is-${s}` : ' is-wait'}`} aria-label={s ? STATE_LABEL[s] : 'Checking'} />
        <b>{name}</b>
        <span>{sub}</span>
      </div>
    );
  };
  return (
    <div className="flow flow-3" role="img" aria-label="The World Bank, OECD.AI and the bubble library feed the screener's server, which sends the finished page to your browser">
      <div className="fl-col">
        <span className="fl-label">1 · Sources</span>
        <Node id="worldbank" name="World Bank Data360" sub="6 indicators, every market, paged 100 rows" />
        <Node id="oecd" name="OECD.AI" sub="AI venture capital, published table" />
        <Node id="bubbles" name="Bubble library" sub="Past episodes, JSON in the repository" />
      </div>
      <Arrow />
      <div className="fl-col">
        <span className="fl-label">2 · Server (Vercel)</span>
        <Node id="server" name="Next.js" sub="Fetches in parallel, keeps answers 24 h, builds every record" />
        <div className="fl-note">Request → cache or World Bank → Buffett indicator → page with the data inside</div>
      </div>
      <Arrow />
      <div className="fl-col">
        <span className="fl-label">3 · Your browser</span>
        <Node id="you" name="This page" sub="Every view, range and market change runs here, with no more requests" />
      </div>
    </div>
  );
}

/** Every check, with what it looked at, what came back and how long it took. */
export function LiveStatus({ health }: { health: ReturnType<typeof useHealth> }) {
  const { checks, at, busy, run } = health;
  const states = checks ? CHECKS.map(c => checks[c.id]?.state ?? 'off') : [];
  const failing = states.filter(s => s === 'fail').length;
  const warning = states.filter(s => s === 'warn').length;
  const overall: State | null = !checks ? null : failing ? 'fail' : warning ? 'warn' : 'ok';
  const steps = (n: number) => `${n} step${n === 1 ? '' : 's'}`;
  return (
    <div className={`hc${overall ? ` is-${overall}` : ''}`}>
      <div className="hc-head">
        <StateIcon state={overall} />
        <div className="hc-title">
          <b>{!checks ? 'Checking every step…' : failing ? `${steps(failing)} failing` : warning ? `${steps(warning)} need${warning === 1 ? 's' : ''} attention` : 'Everything is working'}</b>
          <span>{at ? `Checked from your browser at ${clock(at)}` : 'Running the checks from your browser'}</span>
        </div>
        <button type="button" className="btn" onClick={run} disabled={busy}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className={busy ? 'spin' : undefined} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12a8 8 0 1 1-2.34-5.66" />
            <path d="M20 4v5h-5" />
          </svg>
          {busy ? 'Checking…' : 'Check again'}
        </button>
      </div>
      <ol className="hc-list">
        {CHECKS.map((c, i) => {
          const r = checks?.[c.id];
          return (
            <li key={c.id} className={`hc-row${r ? ` is-${r.state}` : ''}`}>
              <StateIcon state={busy && !r ? null : r?.state ?? null} />
              <div className="hc-main">
                <div className="hc-name">
                  <span className="hc-step">{i + 1}</span>
                  <b>{c.title}</b>
                  {r && <span className={`hc-pill is-${r.state}`}>{STATE_LABEL[r.state]}</span>}
                </div>
                <span className="hc-what">{c.what}</span>
                <div className="hc-detail">{r ? r.detail : 'Checking…'}</div>
              </div>
              {r?.ms != null && <span className="hc-ms">{r.ms} ms</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// one run of the checks feeds both the diagram and the panel, though they sit in different sections
const HealthContext = createContext<ReturnType<typeof useHealth> | null>(null);

export function HealthProvider({ children }: { children: React.ReactNode }) {
  return <HealthContext.Provider value={useHealth()}>{children}</HealthContext.Provider>;
}

export function FlowDiagram() {
  return <DataFlow checks={useContext(HealthContext)?.checks ?? null} />;
}

export function StatusPanel() {
  const health = useContext(HealthContext);
  return health ? <LiveStatus health={health} /> : null;
}
