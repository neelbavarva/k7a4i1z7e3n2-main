import { useEffect, useRef, useState } from 'react';
import { fmtRelative, signed } from '../format.js';
import { KINDS, matchesMarket, normalise, subName } from '../markets.js';
import MarketIcon from './MarketIcon.jsx';

const GROUPS = [
  { key: 'bull', title: 'Bullish', test: (s) => s >= 15, sort: (a, b) => b.score - a.score, empty: 'No pair leans bullish right now.' },
  { key: 'flat', title: 'Balanced', test: (s) => s > -15 && s < 15, sort: (a, b) => b.score - a.score, empty: 'No balanced pairs right now.' },
  { key: 'bear', title: 'Bearish', test: (s) => s <= -15, sort: (a, b) => a.score - b.score, empty: 'No pair leans bearish right now.' },
];

export default function Overview({ meta }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const input = useRef(null);
  const q = normalise(query);
  const kindOf = (p) => p.kind ?? 'fx';
  const pairs = meta.pairs.filter((p) => (kind === 'all' || kindOf(p) === kind) && matchesMarket(p, q));
  const counts = Object.fromEntries(KINDS.map((k) => [k.key, meta.pairs.filter((p) => k.key === 'all' || kindOf(p) === k.key).length]));
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
      <h1 className="overview-title">Where fundamentals lean</h1>
      <p className="overview-lede">
        {meta.pairs.length} markets scored from −100 to +100 on recent economic surprises, and where that score is
        heading in 7 days if upcoming releases match their forecasts. For forex, positive favours the first currency in
        the pair; for metals, oil and indices, positive is bullish. Open a market to see why, and what's coming up.
      </p>

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
      <div className="seg kinds" role="group" aria-label="Asset class">
        {KINDS.map((k) => (
          <button key={k.key} type="button" aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>
            {k.label} <span className="seg-count">{counts[k.key]}</span>
          </button>
        ))}
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
            <h2 id={`g-${g.key}`}>
              {g.title} <span className="count">{g.rows.length}</span>
            </h2>
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
              <p className="empty-note">{g.empty}</p>
            )}
          </section>
        ),
      )}
    </main>
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
