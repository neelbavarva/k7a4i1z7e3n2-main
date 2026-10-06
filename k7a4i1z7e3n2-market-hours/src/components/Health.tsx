import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { SESSIONS } from '../marketModel';
import { cityOfZone, formatGmtOffset, offsetMinutes } from '../marketTime';
import { readStorage } from '../hooks';
import { RATE_CODES } from '../instruments';
import { DAILY_URLS, LIVE_URL, RATES_KEY } from '../rates';

const BASE = import.meta.env.BASE_URL;
const HOUR = 3_600_000;

type State = 'ok' | 'warn' | 'fail' | 'off';
type Check = { state: State; detail: string; ms?: number };
type Checks = Record<string, Check>;

const STATE_LABEL: Record<State, string> = { ok: 'Working', warn: 'Needs attention', fail: 'Failing', off: 'Not used yet' };

/** GET a URL, timed. Never throws. */
async function probe(url: string) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
    const ms = Math.round(performance.now() - t0);
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, ms, body, date: res.headers.get('date') };
  } catch (error) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - t0), body: null, date: null, error: (error as Error).message };
  }
}

const age = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60_000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

/** How many of the calculator's currencies an answer has. */
const coverage = (rates: Record<string, unknown> | undefined) =>
  RATE_CODES.filter((c) => Number(rates?.[c] ?? rates?.[c.toLowerCase()]) > 0).length;

async function runChecks(): Promise<Checks> {
  const checks: Checks = {};
  const site = await probe(`${BASE}?health=${Date.now()}`);
  const [live, ...daily] = await Promise.all([probe(LIVE_URL), ...DAILY_URLS.map(probe)]);

  // 1. your clock and time zones: the session times come from these alone
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = Date.now();
  const offsets = SESSIONS.map((s) => `${s.city} ${formatGmtOffset(offsetMinutes(s.timeZone, now))}`).join(', ');
  const skew = site.date ? (now - Date.parse(site.date)) / 1000 : null;
  checks.clock = {
    state: skew !== null && Math.abs(skew) > 120 ? 'warn' : 'ok',
    detail: `${cityOfZone(zone)} (${formatGmtOffset(offsetMinutes(zone, now))}) · ${offsets}${
      skew === null ? '' : ` · your clock is ${Math.abs(skew) < 2 ? 'in step with' : `${Math.abs(Math.round(skew))} s ${skew > 0 ? 'ahead of' : 'behind'}`} the server`
    }`,
  };

  // 2. the site itself
  checks.site = site.status
    ? { state: 'ok', detail: 'Vercel served the app; everything else on the page runs in your browser.', ms: site.ms }
    : { state: 'fail', detail: `The site didn't answer (${site.error}).`, ms: site.ms };

  // 3. live rates, every minute
  const liveRates = (live.body as { data?: { rates?: Record<string, unknown> } } | null)?.data?.rates;
  const n = coverage(liveRates);
  checks.coinbase = live.ok && n
    ? { state: 'ok', detail: `${n} of the calculator's ${RATE_CODES.length} currencies, live. The daily feed fills the other ${RATE_CODES.length - n}.`, ms: live.ms }
    : { state: 'fail', detail: `Coinbase didn't answer (${live.error ?? `HTTP ${live.status}`}). The calculator falls back on the daily rates.`, ms: live.ms };

  // 4 and 5. the daily feed and its mirror
  ['daily', 'mirror'].forEach((id, i) => {
    const r = daily[i];
    const body = r.body as { date?: string; usd?: Record<string, unknown> } | null;
    const m = coverage(body?.usd);
    const metals = ['XAU', 'XAG'].filter((c) => Number(body?.usd?.[c.toLowerCase()]) > 0).length === 2;
    checks[id] = r.ok && m
      ? { state: 'ok', detail: `Rates for ${body?.date ?? 'an unknown date'}: ${m} of ${RATE_CODES.length} currencies${metals ? ', gold and silver included' : ''}.`, ms: r.ms }
      : { state: i === 0 && daily[1].ok ? 'warn' : 'fail', detail: `Didn't answer (${r.error ?? `HTTP ${r.status}`})${i === 0 ? '; the mirror stands in.' : '.'}`, ms: r.ms };
  });

  // 6. the last good rates kept in this browser
  try {
    const saved = JSON.parse(readStorage(RATES_KEY) || 'null') as { liveAt?: number; dailyAt?: number; rates?: object } | null;
    checks.saved = saved?.rates
      ? {
          state: saved.liveAt && Date.now() - saved.liveAt < 24 * HOUR ? 'ok' : 'warn',
          detail: `${Object.keys(saved.rates).length} rates kept in this browser · live ones from ${saved.liveAt ? age(saved.liveAt) : 'never'}, daily ones from ${saved.dailyAt ? age(saved.dailyAt) : 'never'}.`,
        }
      : { state: 'off', detail: 'Nothing saved yet: open the position size calculator once and its rates are kept here.' };
  } catch {
    checks.saved = { state: 'off', detail: "This browser doesn't allow saving, so the calculator fetches rates each visit." };
  }
  return checks;
}

// the checks, in the order the data flows
const CHECKS = [
  { id: 'clock', title: 'Clock and time zones', what: 'Your device, and the time-zone database built into your browser' },
  { id: 'site', title: 'The site', what: 'Vercel, serving the app' },
  { id: 'coinbase', title: 'Live exchange rates', what: 'Coinbase, asked every minute while the calculator is open' },
  { id: 'daily', title: 'Daily rates', what: 'currency-api (pages.dev), for metals and the currencies Coinbase lacks' },
  { id: 'mirror', title: 'Daily rates mirror', what: 'The same feed on jsDelivr, used when the first one fails' },
  { id: 'saved', title: 'Saved rates', what: 'The last good set, kept in this browser for the next visit' },
];

// which checks light up each box in the diagram
const NODE_CHECKS: Record<string, string[]> = {
  device: ['clock'],
  coinbase: ['coinbase'],
  daily: ['daily', 'mirror'],
  sessions: ['clock', 'site'],
  rates: ['coinbase', 'daily', 'saved'],
};

const worst = (states: State[]): State | null =>
  states.includes('fail') ? 'fail' : states.includes('warn') ? 'warn' : states.length && states.some((s) => s === 'ok') ? 'ok' : states.length ? 'off' : null;

function useHealth() {
  const [checks, setChecks] = useState<Checks | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async () => {
    setBusy(true);
    try {
      setChecks(await runChecks());
    } catch (error) {
      setChecks(Object.fromEntries(CHECKS.map((c) => [c.id, { state: 'fail' as State, detail: `The check itself failed: ${(error as Error).message}` }])));
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

// one run of the checks feeds both the diagram and the panel
const HealthContext = createContext<ReturnType<typeof useHealth> | null>(null);

export function HealthProvider({ children }: { children: ReactNode }) {
  return <HealthContext.Provider value={useHealth()}>{children}</HealthContext.Provider>;
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

/** Sources, what your browser works out from them, and where it shows; each box shows its checks. */
export function FlowDiagram() {
  const checks = useContext(HealthContext)?.checks ?? null;
  const Node = ({ id, name, sub }: { id: string; name: string; sub: string }) => {
    const s = checks ? worst(NODE_CHECKS[id].map((c) => checks[c]?.state).filter((x): x is State => Boolean(x))) : null;
    return (
      <div className="fl-node">
        <i className={`fl-dot${s ? ` is-${s}` : ' is-wait'}`} aria-label={s ? STATE_LABEL[s] : 'Checking'} />
        <b>{name}</b>
        <span>{sub}</span>
      </div>
    );
  };
  return (
    <div className="flow flow-3" role="img" aria-label="Your device's clock and two exchange-rate feeds go into your browser, which works out the sessions and the rates for the two pages">
      <div className="fl-col">
        <span className="fl-label">1 · Sources</span>
        <Node id="device" name="Your device" sub="Clock, time zone, daylight-saving rules" />
        <Node id="coinbase" name="Coinbase" sub="Live exchange rates, every minute" />
        <Node id="daily" name="currency-api" sub="Daily rates and metals, two mirrors" />
      </div>
      <Arrow />
      <div className="fl-col">
        <span className="fl-label">2 · Your browser</span>
        <Node id="sessions" name="Session model" sub="Opens, closes, overlaps and volume, worked out every few seconds" />
        <Node id="rates" name="Rate table" sub="Live first, daily to fill gaps, the last good set saved" />
      </div>
      <Arrow />
      <div className="fl-col">
        <span className="fl-label">3 · The pages</span>
        <div className="fl-note">
          <b>Market hours</b>: sessions, overlaps, volume and phase charts.
          <br />
          <b>Position size</b>: lot size, pip value and margin, in your account currency.
        </div>
      </div>
    </div>
  );
}

/** Every check, with what it looked at, what came back and how long it took. */
export function StatusPanel() {
  const health = useContext(HealthContext);
  if (!health) return null;
  const { checks, at, busy, run } = health;
  const states = checks ? CHECKS.map((c) => checks[c.id]?.state ?? 'off') : [];
  const failing = states.filter((s) => s === 'fail').length;
  const warning = states.filter((s) => s === 'warn').length;
  const overall: State | null = !checks ? null : failing ? 'fail' : warning ? 'warn' : 'ok';
  const steps = (n: number) => `${n} step${n === 1 ? '' : 's'}`;
  return (
    <div className={`hc${overall ? ` is-${overall}` : ''}`}>
      <div className="hc-head">
        <StateIcon state={overall} />
        <div className="hc-title">
          <b>{!checks ? 'Checking every step…' : failing ? `${steps(failing)} failing` : warning ? `${steps(warning)} need${warning === 1 ? 's' : ''} attention` : 'Everything is working'}</b>
          <span>{at ? `Checked from your browser at ${new Date(at).toLocaleTimeString()}` : 'Running the checks from your browser'}</span>
        </div>
        <button type="button" className="btn" onClick={run} disabled={busy}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className={busy ? 'hc-spinning' : undefined}>
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
