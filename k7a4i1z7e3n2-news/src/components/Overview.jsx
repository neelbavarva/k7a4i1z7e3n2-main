import { useEffect, useRef, useState } from 'react';
import { fmtRelative, signed } from '../format.js';
import { KINDS, matchesMarket, normalise, subName } from '../markets.js';
import MarketIcon from './MarketIcon.jsx';
import Sections from './Sections.jsx';

const GROUPS = [
  { key: 'bull', title: 'Bullish', range: 'Score +15 and up', zone: [15, 100], test: (s) => s >= 15, sort: (a, b) => b.score - a.score, empty: 'No market leans bullish right now' },
  { key: 'flat', title: 'Balanced', range: 'Score between −15 and +15', zone: [-15, 15], test: (s) => s > -15 && s < 15, sort: (a, b) => b.score - a.score, empty: 'No market is balanced right now' },
  { key: 'bear', title: 'Bearish', range: 'Score −15 and down', zone: [-100, -15], test: (s) => s <= -15, sort: (a, b) => a.score - b.score, empty: 'No market leans bearish right now' },
];

// each group's mark: up, level, down
const TONE_ICON = {
  bull: <path d="M2 11.5 6 7.5l3 2.5 5-5.5M10.5 4.5H14V8" />,
  flat: <path d="M2.5 6h11M2.5 10h11" />,
  bear: <path d="M2 4.5 6 8.5l3-2.5 5 5.5M10.5 11.5H14V8" />,
};

// each asset class's mark
const KIND_ICON = {
  all: (
    <>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1.2" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1.2" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1.2" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1.2" />
    </>
  ),
  fx: <path d="M2.5 5.5h10M10 3l2.5 2.5L10 8M13.5 10.5h-10M6 8l-2.5 2.5L6 13" />,
  metal: <path d="M1.8 12.5h12.4l-1.9-4.8H3.7zM4.6 7.7l1.2-3.2h4.4l1.2 3.2" />,
  energy: <path d="M8 2.2s4.2 4.4 4.2 7.6a4.2 4.2 0 0 1-8.4 0C3.8 6.6 8 2.2 8 2.2z" />,
  index: <path d="M2 13.5h12M2.5 10.5l3.2-3.3 2.6 2.2 5.2-5.4M10.5 4H13.5V7" />,
};

const sideOf = (s) => (s >= 15 ? 'bull' : s <= -15 ? 'bear' : 'flat');

export default function Overview({ meta }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const input = useRef(null);
  const q = normalise(query);
  const kindOf = (p) => p.kind ?? 'fx';
  const pairs = meta.pairs.filter((p) => (kind === 'all' || kindOf(p) === kind) && matchesMarket(p, q));
  const counts = Object.fromEntries(KINDS.map((k) => [k.key, meta.pairs.filter((p) => k.key === 'all' || kindOf(p) === k.key).length]));
  // how each asset class splits between bullish, balanced and bearish, for the bar under its tab
  const mixes = Object.fromEntries(
    KINDS.map((k) => {
      const m = { bull: 0, flat: 0, bear: 0 };
      meta.pairs.forEach((p) => (k.key === 'all' || kindOf(p) === k.key) && m[sideOf(p.score)]++);
      return [k.key, m];
    }),
  );
  const groups = GROUPS.map((g) => ({ ...g, rows: pairs.filter((p) => g.test(p.score)).sort(g.sort) }));
  const ordered = groups.flatMap((g) => g.rows);

  // "/" focuses the search from anywhere on the page
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const typing = t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && ordered[0]) window.location.assign(`${import.meta.env.BASE_URL}#/${ordered[0].id}`);
    if (e.key === 'Escape') {
      setQuery('');
      input.current?.blur();
    }
  };

  return (
    <main className="overview fade-in">
      <div className="page-head">
        <h1 className="overview-title">Where fundamentals lean</h1>
        <Sections section="news" />
      </div>

      <div className="searchbar">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search EUR, GBPJPY, gold, nasdaq…"
          aria-label="Search markets"
          autoComplete="off"
          spellCheck="false"
        />
        {!query && <kbd aria-hidden="true">/</kbd>}
      </div>
      <div className="kinds" role="group" aria-label="Asset class">
        {KINDS.map((k) => {
          const mix = mixes[k.key];
          return (
            <button key={k.key} type="button" className="kind" aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>
              <span className="kind-top">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  {KIND_ICON[k.key]}
                </svg>
                <span className="kind-label">{k.label}</span>
                <span className="kind-count">{counts[k.key]}</span>
              </span>
              <span className="kind-mix" title={`${mix.bull} bullish · ${mix.flat} balanced · ${mix.bear} bearish`}>
                {['bull', 'flat', 'bear'].map((t) => mix[t] > 0 && <i key={t} className={`is-${t}`} style={{ flexGrow: mix[t] }} />)}
              </span>
            </button>
          );
        })}
      </div>
      <p className={`search-hint${q ? ' on' : ''}`} aria-live="polite">
        {q
          ? ordered.length
            ? `${ordered.length} market${ordered.length > 1 ? 's' : ''} match. Press Enter to open ${ordered[0].symbol}.`
            : `Nothing matches “${query.trim()}”${kind !== 'all' ? ' in this group' : ''}. Try EUR, GBPJPY, gold, oil or nasdaq.`
          : ''}
      </p>

      {groups.map((g) =>
        (q || kind !== 'all') && !g.rows.length ? null : (
          <section key={g.key} className="group" aria-labelledby={`g-${g.key}`}>
            <header className={`group-head is-${g.key}`}>
              <span className="g-tone" aria-hidden="true">
                <svg viewBox="0 0 16 16">{TONE_ICON[g.key]}</svg>
              </span>
              <h2 id={`g-${g.key}`}>{g.title}</h2>
              <span className="g-count">{g.rows.length}</span>
              <span className="g-range">{g.range}</span>
            </header>
            {g.rows.length ? (
              <div className="rows-card">
                <div className="row-headings" aria-hidden="true">
                  <span>Market</span>
                  <span>Bias</span>
                  <span>Now</span>
                  <span>In 7 days</span>
                  <span>Lean</span>
                  <span>24h</span>
                  <span>Next high-impact release</span>
                </div>
                <ul className="rows">
                  {g.rows.map((p) => (
                    <PairRow key={p.id} p={p} now={Date.now()} />
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyGroup g={g} pairs={pairs} />
            )}
          </section>
        ),
      )}
    </main>
  );
}

/**
 * An empty group: says so, and shows on a −100…+100 scale where the group's zone is and which
 * market is closest to entering it.
 */
function EmptyGroup({ g, pairs }) {
  const [lo, hi] = g.zone;
  const near =
    g.key === 'bull'
      ? pairs.reduce((a, p) => (!a || p.score > a.score ? p : a), null)
      : g.key === 'bear'
        ? pairs.reduce((a, p) => (!a || p.score < a.score ? p : a), null)
        : pairs.reduce((a, p) => (!a || Math.abs(p.score) < Math.abs(a.score) ? p : a), null);
  const at = (v) => `${50 + v / 2}%`;
  const score = near ? Math.round(near.score) : null;
  const gap = near ? (g.key === 'bull' ? 15 - score : g.key === 'bear' ? score + 15 : Math.abs(score) - 14) : null;
  return (
    <div className={`empty-card is-${g.key}`}>
      <div className="empty-text">
        <b>{g.empty}</b>
        {near && (
          <span>
            Closest is <a href={`${import.meta.env.BASE_URL}#/${near.id}`}>{near.symbol}</a> at {signed(score)},{' '}
            {gap} point{gap === 1 ? '' : 's'} {g.key === 'flat' ? 'outside the band' : 'short'}.
          </span>
        )}
      </div>
      <div className="empty-gauge" aria-hidden="true">
        <div className="eg-track">
          <i className="eg-zone" style={{ left: at(lo), width: `${(hi - lo) / 2}%` }} />
          <i className="eg-mid" />
          {near && <i className="eg-dot" style={{ left: at(score) }} />}
        </div>
        <div className="eg-scale">
          <span>−100</span>
          <span>0</span>
          <span>+100</span>
        </div>
      </div>
    </div>
  );
}

function PairRow({ p, now }) {
  const side = p.score >= 15 ? 'up' : p.score <= -15 ? 'down' : 'flat';
  const pos = 50 + p.score / 2;
  const fside = p.future >= 15 ? 'up' : p.future <= -15 ? 'down' : 'flat';
  const fpos = 50 + (p.future ?? p.score) / 2;
  const move = (p.future ?? p.score) - p.score;
  return (
    <li>
      <a className="row" href={`#/${p.id}`}>
        <span className="row-sym">
          <MarketIcon pair={p} size={22} />
          <span className="row-sym-text">
            {p.symbol}
            {subName(p) && <span className="row-name">{subName(p)}</span>}
          </span>
        </span>
        <span className="mini" aria-hidden="true">
          <span className="mini-mid" />
          <span className={`mini-pull ${side}`} style={{ left: `${Math.min(50, pos)}%`, width: `${Math.abs(pos - 50)}%` }} />
          {p.future != null && <span className="mini-future" style={{ left: `${fpos}%` }} />}
          <span className={`mini-knot ${side}`} style={{ left: `${pos}%` }} />
        </span>
        <span className={`row-score ${side}`}>{signed(p.score)}</span>
        <span className="row-future" title={`In 7 days if releases match forecasts: ${p.futureLabel}`}>
          {p.future != null && (
            <>
              <span className="muted">{Math.abs(move) < 3 ? '→' : move > 0 ? '↗' : '↘'}</span>{' '}
              <b className={fside}>{signed(p.future)}</b>
            </>
          )}
        </span>
        <span className="row-label">{p.label}</span>
        <span className="row-change muted" title="Change over the last 24 hours">
          {Math.abs(p.change24h) >= 0.5 ? signed(p.change24h) : '0'}
        </span>
        <span className="row-next">
          {p.next ? (
            <>
              <span className="muted">{fmtRelative(p.next.time, now)}</span> {p.next.currency} {p.next.title}
            </>
          ) : (
            <span className="muted">None scheduled</span>
          )}
        </span>
      </a>
    </li>
  );
}
