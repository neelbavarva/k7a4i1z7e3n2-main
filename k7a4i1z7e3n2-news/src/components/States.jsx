import { useEffect, useState } from 'react';
import { fmtRelative } from '../format.js';
import { REFRESH_COOLDOWN_S } from '../constants.js';
import { freshness } from '../freshness.js';
import MarketIcon from './MarketIcon.jsx';

const BASE = import.meta.env.BASE_URL;

/** 404: a URL off the site, or a pair the site doesn't cover. */
export function NotFound({ kind, value, meta, onPick }) {
  const isPair = kind === 'pair';
  const clean = (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const parts = [clean.slice(0, 3), clean.slice(-3)].filter((x) => x.length === 3);
  const suggestions = isPair && meta ? meta.pairs.filter((p) => parts.some((c) => p.id.includes(c))).slice(0, 6) : [];
  const label = clean.length === 6 ? `${clean.slice(0, 3)}/${clean.slice(3)}` : value;

  return (
    <main className="state fade-in">
      <p className="state-code">404</p>
      <h1 className="state-title">{isPair ? `We don't cover ${label}` : "This page doesn't exist"}</h1>
      <p className="state-text">
        {isPair
          ? 'The site covers the 28 pairs between EUR, GBP, AUD, NZD, USD, CAD, CHF and JPY, plus gold, silver, copper, WTI crude and three US stock indices.'
          : 'The link may be broken, or the page may have moved.'}
      </p>
      {suggestions.length > 0 && (
        <div className="state-suggest">
          <span className="muted">Did you mean</span>
          {suggestions.map((p) => (
            <a key={p.id} className="chip" href={`${BASE}#/${p.id}`}>
              <MarketIcon pair={p} size={16} />
              {p.symbol}
            </a>
          ))}
        </div>
      )}
      {isPair && meta && onPick && (
        <div className="state-actions">
          <button type="button" className="btn btn-primary" onClick={onPick}>
            Search markets
          </button>
        </div>
      )}
      <nav className="nf-links" aria-label="Pages on this site">
        <p className="nf-title">{isPair ? 'Or go to' : 'Try one of these'}</p>
        {PAGES.map(([route, title, text]) => (
          <a key={route} href={`${BASE}#/${route}`}>
            <span>
              <b>{title}</b>
              <small>{text}</small>
            </span>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </a>
        ))}
      </nav>
    </main>
  );
}

/** Where a 404 points: both halves of the site and how each works. */
const PAGES = [
  ['all', 'All markets', 'Where fundamentals lean for every market, now and in 7 days.'],
  ['calendar', 'Economic calendar', 'Every scheduled release this week, live, in your time zone.'],
  ['how-it-works', 'How the score works', 'The data, the formulas and every setting behind the scores.'],
  ['calendar/how-it-works', 'How the calendar works', 'Where the releases come from and how to read them.'],
];

/** Data couldn't be loaded: say so plainly and offer a retry. */
export function ErrorState({ error, onRetry }) {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return (
    <main className="state fade-in" role="alert">
      <p className="state-code">{offline ? 'Offline' : 'Unavailable'}</p>
      <h1 className="state-title">{offline ? "You're offline" : "The latest scores didn't load"}</h1>
      <p className="state-text">
        {offline
          ? 'Reconnect to the internet and try again.'
          : 'This is usually a brief network hiccup. Try again in a moment.'}
      </p>
      {import.meta.env.DEV && (
        <p className="state-dev">
          Dev: {String(error?.message ?? error)}. Make sure public/data exists: run <code>npm run demo</code> or{' '}
          <code>npm run pipeline</code>.
        </p>
      )}
      <div className="state-actions">
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
      </div>
    </main>
  );
}

/** Placeholder shaped like the page that's loading, so nothing jumps when it arrives. */
export function Skeleton({ kind }) {
  if (kind === 'calendar') {
    return (
      <main className="skeleton" aria-busy="true" aria-label="Loading the calendar">
        <div className="sk sk-line" />
        <div className="sk sk-title sk-title-wide" />
        <div className="sk sk-card" />
        <div className="sk sk-search" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="sk sk-rows" />
        ))}
      </main>
    );
  }
  if (kind === 'pair') {
    return (
      <main className="skeleton" aria-busy="true" aria-label="Loading pair">
        <div className="sk-row">
          <div className="sk sk-btn" />
          <div className="sk sk-btn" />
        </div>
        <div className="sk sk-title" />
        <div className="sk sk-meter" />
        <div className="sk-brief">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="sk sk-cell" />
          ))}
        </div>
        <div className="sk sk-card" />
      </main>
    );
  }
  return (
    <main className="skeleton" aria-busy="true" aria-label="Loading pairs">
      <div className="sk sk-title sk-title-wide" />
      <div className="sk sk-line" />
      <div className="sk sk-search" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="sk sk-rows" />
      ))}
    </main>
  );
}

/** Shown when the hourly update hasn't landed for a while, with a way to fetch the latest. */
/** Seconds left until `until` (a timestamp), ticking every second while > 0. */
function useCountdown(until) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!(until > Date.now())) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

/** Re-render every `ms` so relative times ("12 min ago") stay current. */
function useTick(ms) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/**
 * Top-of-page status: when the scores were last updated (amber if that is more than
 * a few hours ago), any refresh result, and the Refresh button with its 1-minute cooldown.
 */
export function StatusBar({ generatedAt, counts, onRefresh, refreshing, busyLabel, message, cooldownUntil }) {
  useTick(30 * 1000);
  const f = freshness(generatedAt);
  // what the scores on screen are made of: real numbers, and releases counted at their forecasts
  const c = counts?.counted ? counts : null;
  const gaps = !c
    ? null
    : c.atForecast
      ? `${c.real} of ${c.counted} recent releases have their number; ${c.atForecast} counted at forecast.`
      : `All ${c.counted} recent releases have their number.`;
  return (
    <div className={`statusbar${f.projected || f.old ? ' is-stale' : ''}${message ? ' has-msg' : ''}`} role="status">
      <i aria-hidden="true" />
      <p>
        {message ??
          (f.old ? (
            `Scores were last updated ${fmtRelative(generatedAt)}, so they may be out of date.`
          ) : f.projected ? (
            <>
              Last update {fmtRelative(generatedAt)}, so scores are projected to now, with releases since counted at forecast.
              {gaps && <span className="sb-extra"> {gaps}</span>}
            </>
          ) : (
            <>
              Scores updated {fmtRelative(generatedAt)}.{gaps ? ` ${gaps}` : <span className="sb-extra"> They update twice an hour.</span>}
            </>
          ))}
      </p>
      <RefreshButton onRefresh={onRefresh} refreshing={refreshing} busyLabel={busyLabel} cooldownUntil={cooldownUntil} />
    </div>
  );
}

export function RefreshButton({ onRefresh, refreshing, busyLabel = 'Refreshing…', cooldownUntil = 0, what = 'scores' }) {
  const left = useCountdown(cooldownUntil);
  const waiting = !refreshing && left > 0;
  const total = REFRESH_COOLDOWN_S;
  return (
    <button
      type="button"
      className={`btn refresh${waiting ? ' is-waiting' : ''}`}
      onClick={onRefresh}
      disabled={refreshing || waiting}
      title={waiting ? `You can refresh again in ${left} s` : `Collect the latest ${what}`}
    >
      {waiting ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="refresh-timer">
          <circle cx="12" cy="12" r="8" className="track" />
          <circle cx="12" cy="12" r="8" className="arc" pathLength="100" strokeDasharray={`${(left / total) * 100} 100`} />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={refreshing ? 'spin' : ''}>
          <path d="M20 12a8 8 0 1 1-2.34-5.66" />
          <path d="M20 4v5h-5" />
        </svg>
      )}
      {refreshing ? busyLabel : waiting ? `Refresh in 0:${String(left).padStart(2, '0')}` : 'Refresh'}
    </button>
  );
}
