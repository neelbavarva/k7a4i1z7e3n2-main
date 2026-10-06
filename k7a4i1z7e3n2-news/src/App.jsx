import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import PairPicker from './components/PairPicker.jsx';
import Meter from './components/Meter.jsx';
import { UpcomingTable, SurprisesTable } from './components/EventTables.jsx';
import { COLLECT_TIMEOUT_MINUTES, POLL_MINUTES, REFRESH_COOLDOWN_S } from './constants.js';
const HowItWorks = lazy(() => import('./components/HowItWorks.jsx'));
const Calendar = lazy(() => import('./components/Calendar.jsx'));
const CalendarGuide = lazy(() => import('./components/CalendarGuide.jsx'));
import Overview from './components/Overview.jsx';
import BiasCheck from './components/BiasCheck.jsx';
import MarketIcon from './components/MarketIcon.jsx';
import Outlook from './components/Outlook.jsx';
import { NotFound, ErrorState, Skeleton, StatusBar } from './components/States.jsx';
import { fmtDayTime, fmtRelative, zone, signed } from './format.js';
import { isFx, KIND_LABEL, subName } from './markets.js';

// The chart library is the heaviest part of the bundle; load it only on pair pages.
const BiasChart = lazy(() => import('./components/BiasChart.jsx'));
const NewsLoad = lazy(() => import('./components/NewsLoad.jsx'));

const BASE = import.meta.env.BASE_URL;
export const href = (route) => `${BASE}#/${route}`;

/**
 * Hash routes. News: #/all, #/how-it-works, #/EURUSD. Economic calendar: #/calendar,
 * #/calendar/how-it-works. Anything off the site's base path is a 404.
 */
function readRoute() {
  const path = window.location.pathname;
  const onBase = path === BASE || path === `${BASE}index.html` || `${path}/` === BASE;
  if (!onBase) return { kind: 'missing', value: path };
  const raw = decodeURIComponent(window.location.hash.replace(/^#\/?/, '')).replace(/\/+$/, '');
  if (!raw || raw.toLowerCase() === 'all') return { kind: 'all' };
  if (raw.toLowerCase() === 'how-it-works') return { kind: 'how' };
  if (raw.toLowerCase() === 'calendar') return { kind: 'calendar' };
  if (raw.toLowerCase() === 'calendar/how-it-works') return { kind: 'calendar-how' };
  return { kind: 'pair', id: raw.toUpperCase().replace(/[^A-Z0-9]/g, ''), value: raw };
}

function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return route;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class RefreshError extends Error {}
const COLLECTING = 'Collecting the latest news data. This takes about 2 to 3 minutes; the scores update here by themselves.';

async function getJson(path, version) {
  const res = await fetch(`${BASE}data/${path}${version ? `?v=${encodeURIComponent(version)}` : ''}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export default function App() {
  const route = useRoute();
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [pairState, setPairState] = useState({ id: null, data: null, error: null });
  const cache = useRef(new Map()); // pair pages already loaded this visit: instant back/forward
  const [picking, setPicking] = useState(false);

  // Cmd/Ctrl+K opens the pair switcher from anywhere
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPicking((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    let live = true;
    setMetaError(null);
    getJson('meta.json', Date.now())
      .then((m) => {
        if (!live) return;
        if (meta?.generatedAt !== m.generatedAt) cache.current.clear();
        setMeta(m);
      })
      .catch((e) => live && setMetaError(e));
    return () => {
      live = false;
    };
  }, [attempt]);

  // exact code first, then a well-known alias (#/SPX → US500, #/GOLD → XAU/USD)
  const pair =
    route.kind === 'pair' && meta
      ? meta.pairs.find((p) => p.id === route.id) ?? meta.pairs.find((p) => p.aliases?.includes(route.id))
      : null;

  useEffect(() => {
    if (!meta || !pair) return;
    const cached = cache.current.get(pair.id);
    if (cached) {
      setPairState({ id: pair.id, data: cached, error: null });
      return;
    }
    let live = true;
    setPairState({ id: pair.id, data: null, error: null });
    getJson(`pairs/${pair.id}.json`, meta.generatedAt)
      .then((d) => {
        cache.current.set(pair.id, d);
        if (live) setPairState({ id: pair.id, data: d, error: null });
      })
      .catch((e) => live && setPairState({ id: pair.id, data: null, error: e }));
    return () => {
      live = false;
    };
  }, [meta, pair?.id, attempt]);

  const notFound = route.kind === 'missing' || (route.kind === 'pair' && meta && !pair);
  // the site has two halves: the news-based bias, and the economic calendar
  const section = route.kind === 'calendar' || route.kind === 'calendar-how' ? 'calendar' : 'news';

  useEffect(() => {
    document.title = notFound
      ? 'Page not found · FX Fundamental Bias'
      : route.kind === 'how'
        ? 'How the score works · FX Fundamental Bias'
        : route.kind === 'calendar'
          ? 'Economic calendar · FX Fundamental Bias'
          : route.kind === 'calendar-how'
            ? 'How the calendar works · FX Fundamental Bias'
            : pair
          ? `${subName(pair) ? `${pair.name} (${pair.symbol})` : pair.name ?? pair.symbol} fundamental bias · FX Fundamental Bias`
          : 'FX Fundamental Bias · Where fundamentals lean';
  }, [notFound, route.kind, pair?.id]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.kind, route.id]);

  const retry = () => setAttempt((n) => n + 1);

  // Refresh collects new data, then loads it. Locally it re-runs the data job on this machine
  // (vite.config.js). On the deployed site it starts the hourly job right away through
  // /api/refresh (or joins the run already going), waits for it to publish, then loads the new
  // meta.json. A new generatedAt clears the per-pair cache, so the open page reloads too.
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState(null);
  // after each refresh the button rests for a minute
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const loadLatest = async () => {
    const m = await getJson('meta.json', Date.now());
    const changed = m.generatedAt !== metaRef.current?.generatedAt;
    if (changed) {
      cache.current.clear();
      setMeta(m);
    }
    return { m, changed };
  };
  // a finished run has redeployed; give the new files a few tries to come through
  const loadNew = async () => {
    for (let i = 0; i < 6; i++) {
      const r = await loadLatest();
      if (r.changed) return r;
      await sleep(5000);
    }
    return loadLatest();
  };
  // the deployed site: start (or join) the data job and wait for it. null: not set up here
  const collect = async () => {
    const res = await fetch(`${BASE}api/refresh`, { method: 'POST' }).catch(() => null);
    if (!res || res.status === 404 || res.status === 501) return null;
    const run = await res.json().catch(() => ({}));
    if (!res.ok) throw new RefreshError("Couldn't start collecting new data. Try again in a minute.");
    if (run.fresh) return { fresh: run.finishedAt };
    setRefreshMsg(COLLECTING);
    const since = Date.parse(run.startedAt) - 30 * 1000;
    const deadline = Date.now() + COLLECT_TIMEOUT_MINUTES * 60 * 1000;
    while (Date.now() < deadline) {
      await sleep(10 * 1000);
      const s = await fetch(`${BASE}api/refresh`)
        .then((x) => x.json())
        .catch(() => null);
      if (s?.state === 'done' && Date.parse(s.startedAt) >= since) {
        if (!s.ok) throw new RefreshError(`The data job didn't finish, so these are still the scores from ${fmtRelative(metaRef.current.generatedAt)}. Try again in a few minutes.`);
        return { done: true };
      }
    }
    throw new RefreshError('Collecting is taking longer than usual. The scores will update here once it finishes.');
  };
  const refresh = async () => {
    if (refreshing || Date.now() < cooldownUntil) return;
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      if (import.meta.env.DEV) {
        const r = await fetch('/__refresh', { method: 'POST' }).then((x) => x.json());
        if (!r.ok) throw new RefreshError('The local data job failed. The terminal running npm run dev shows why.');
        await loadLatest();
      } else {
        const got = await collect();
        const { m, changed } = got?.done ? await loadNew() : await loadLatest();
        setRefreshMsg(
          changed
            ? null
            : got?.fresh
              ? `The data was collected ${fmtRelative(got.fresh)}, so these are the latest scores.`
              : `No newer scores yet. The last update was ${fmtRelative(m.generatedAt)}.`,
        );
      }
    } catch (e) {
      setRefreshMsg(e instanceof RefreshError ? e.message : "Couldn't reach the latest scores. Check your connection and try again.");
    } finally {
      setRefreshing(false);
      setCooldownUntil(Date.now() + REFRESH_COOLDOWN_S * 1000);
    }
  };

  // The deployed site checks quietly every 10 minutes (and when the tab comes back into
  // view), so a page left open picks up each hourly update on its own.
  useEffect(() => {
    if (import.meta.env.DEV) return;
    let last = Date.now();
    const check = () => {
      last = Date.now();
      loadLatest().catch(() => {});
    };
    const timer = setInterval(check, POLL_MINUTES * 60 * 1000);
    const onVisible = () => document.visibilityState === 'visible' && Date.now() - last > POLL_MINUTES * 60 * 1000 && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (!refreshMsg) return;
    const t = setTimeout(() => setRefreshMsg(null), 8000);
    return () => clearTimeout(t);
  }, [refreshMsg]);

  let body;
  if (route.kind === 'missing') body = <NotFound kind="path" />;
  else if (route.kind === 'calendar') body = (
      <Suspense fallback={<Skeleton kind="calendar" />}>
        <Calendar />
      </Suspense>
    );
  else if (route.kind === 'calendar-how') body = (
      <Suspense fallback={<Skeleton kind="overview" />}>
        <CalendarGuide />
      </Suspense>
    );
  else if (route.kind === 'how') body = (
      <Suspense fallback={<Skeleton kind="overview" />}>
        <HowItWorks meta={meta} />
      </Suspense>
    );
  else if (metaError) body = <ErrorState error={metaError} onRetry={retry} />;
  else if (!meta) body = <Skeleton kind={route.kind === 'pair' ? 'pair' : 'overview'} />;
  else if (route.kind === 'all') body = <Overview meta={meta} />;
  else if (!pair) {
    // six letters looks like a pair code (EURXYZ); anything else is just a bad link
    const looksLikePair = route.id.length === 6;
    body = <NotFound kind={looksLikePair ? 'pair' : 'path'} value={route.value} meta={meta} onPick={() => setPicking(true)} />;
  }
  else if (pairState.id === pair.id && pairState.error) body = <ErrorState error={pairState.error} onRetry={retry} />;
  else if (pairState.id === pair.id && pairState.data) {
    body = <Dashboard key={pair.id} data={pairState.data} meta={meta} onPick={() => setPicking(true)} />;
  } else body = <Skeleton kind="pair" />;

  return (
    <div className="page">
      {meta && !notFound && section === 'news' && (
        <StatusBar
          generatedAt={meta.generatedAt}
          onRefresh={refresh}
          refreshing={refreshing}
          busyLabel={refreshMsg === COLLECTING ? 'Collecting…' : undefined}
          message={refreshMsg}
          cooldownUntil={cooldownUntil}
        />
      )}
      {body}

      {picking && meta && <PairPicker pairs={meta.pairs} current={pair?.id} onClose={() => setPicking(false)} />}

      <footer className="footer">
        {section === 'calendar' ? (
          <p className="muted">
            Calendar: ForexFactory weekly feed, checked live. Times shown in {zone}.{' · '}
            <a href={href('calendar/how-it-works')}>How the calendar works</a>
          </p>
        ) : (
          <p className="muted">
            {meta && (
              <>
                Data refreshed {fmtDayTime(meta.generatedAt)} ({fmtRelative(meta.generatedAt)}). Times shown in {zone}.
                Calendar: {meta.sources.calendar}.{meta.sources.prices ? ` Prices: ${meta.sources.prices}.` : ''}
                {' · '}
              </>
            )}
            <a href={href('how-it-works')}>How the score works</a>
          </p>
        )}
      </footer>
    </div>
  );
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

function Dashboard({ data, meta, onPick }) {
  const { pair, summary } = data;
  const byId = new Map(data.events.map((e) => [e.id, e]));
  return (
    <main className="fade-in">
      <nav className="topbar" aria-label="Pair navigation">
        <a href="#/all" className="btn btn-ghost">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          All markets
        </a>
        <button type="button" className="btn" onClick={onPick}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          Switch market
          <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
      </nav>

      <section className="hero" aria-labelledby="pair-title">
        <h1 id="pair-title" className="pair-code">
          <MarketIcon pair={pair} size="clamp(34px, 4.6vw, 52px)" />
          {pair.symbol.includes('/') ? (
            <>
              <span>{pair.base}</span>
              <span className="slash">/</span>
              <span>{pair.quote}</span>
            </>
          ) : (
            <span>{pair.symbol}</span>
          )}
        </h1>
        {!isFx(pair) && (
          <p className="pair-sub">
            {pair.name} · {KIND_LABEL[pair.kind]}
          </p>
        )}
        <Meter pair={pair} score={summary.score} label={summary.label} future={summary.path?.score} />
        <Brief pair={pair} s={summary} />
        {pair.note && <p className="pair-note">{pair.note}</p>}
      </section>

      <BiasCheck data={data} />

      <Outlook data={data} K={meta.model.K} />

      <Suspense fallback={<div className="chart-block sk sk-chart" aria-hidden="true" />}>
        <BiasChart data={data} byId={byId} />
      </Suspense>

      <Suspense fallback={<div className="chart-block sk sk-chart" aria-hidden="true" />}>
        <NewsLoad data={data} />
      </Suspense>

      <div className="tables">
        <UpcomingTable data={data} />
        <SurprisesTable data={data} />
      </div>
    </main>
  );
}

const sideOf = (v) => (v >= 15 ? 'up' : v <= -15 ? 'down' : 'flat');

function Brief({ pair, s }) {
  const d = s.driver;
  const how = d
    ? Math.abs(d.surpriseZ) >= 0.25
      ? `${d.above ? 'Above' : 'Below'} forecast`
      : `In line, ${d.rising ? 'up' : 'down'} on the previous`
    : null;
  return (
    <>
      <dl className="brief">
        <div className="brief-cell">
          <dt>Now</dt>
          <dd className={`brief-num ${sideOf(s.score)}`}>{signed(s.score)}</dd>
          <dd className="brief-sub">{s.label}</dd>
        </div>
        {s.path && (
          <div className="brief-cell">
            <dt>
              In 7 days <i className="ring" aria-hidden="true" />
            </dt>
            <dd className={`brief-num ${sideOf(s.path.score)}`}>{signed(s.path.score)}</dd>
            <dd className="brief-sub">{s.path.label}, if releases match forecasts</dd>
          </div>
        )}
        <div className="brief-cell">
          <dt>Biggest push</dt>
          {d ? (
            <>
              <dd className="brief-text">
                {d.currency} {d.title}
              </dd>
              <dd className="brief-sub">
                {how} ·{' '}
                {isFx(pair)
                  ? `${d.goodForCurrency ? 'supporting' : 'weighing on'} the ${d.currency}`
                  : `${d.value > 0 ? 'bullish' : 'bearish'} for ${pair.name}`}
              </dd>
            </>
          ) : (
            <dd className="brief-sub">No recent surprise stands out</dd>
          )}
        </div>
        <div className="brief-cell">
          <dt>Next big risk</dt>
          {s.next ? (
            <>
              <dd className="brief-text">
                {s.next.currency} {s.next.title}
              </dd>
              <dd className="brief-sub">
                {fmtDayTime(s.next.time)} · {fmtRelative(s.next.time)}
              </dd>
            </>
          ) : (
            <dd className="brief-sub">No high-impact releases scheduled</dd>
          )}
        </div>
      </dl>
      {s.provisional > 0 && (
        <p className="brief-note">
          {s.provisional} recent release{s.provisional > 1 ? 's are' : ' is'} still waiting for an actual value and counted
          at {s.provisional > 1 ? 'their forecasts' : 'its forecast'} for now.
        </p>
      )}
    </>
  );
}
