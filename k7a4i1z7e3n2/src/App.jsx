import { useCallback, useEffect, useRef, useState } from 'react';
import { SITES } from './sites.js';

const STORAGE_KEY = 'split-view:sizes';
const TAB_KEY = 'split-view:tab';
const WIDE_QUERY = '(min-width: 2500px)'; // split view only on very wide screens, tabs otherwise
const MIN = 0.12; // smallest a pane can get, as a fraction of the viewport
const STEP = 0.02; // keyboard nudge

const equal = (n) => Array.from({ length: n }, () => 1 / n);

function loadSizes(n) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length === n && saved.every((v) => v >= MIN)) return saved;
  } catch {
    /* storage unavailable: fall back to equal panes */
  }
  return equal(n);
}

function loadTab() {
  try {
    const saved = Number(localStorage.getItem(TAB_KEY));
    if (Number.isInteger(saved) && saved >= 0 && saved < SITES.length) return saved;
  } catch {
    /* storage unavailable: start on the first site */
  }
  return 0;
}

function useMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export default function App() {
  const wide = useMedia(WIDE_QUERY);
  // Bumping a site's nonce remounts its pane, which reloads the iframe.
  const [nonces, setNonces] = useState(() => SITES.map(() => 0));
  const reload = (i) => setNonces((prev) => prev.map((n, j) => (j === i ? n + 1 : n)));

  return wide ? <Split nonces={nonces} reload={reload} /> : <Tabs nonces={nonces} reload={reload} />;
}

function Tabs({ nonces, reload }) {
  const [active, setActive] = useState(loadTab);
  // Only load a site once it has been opened, then keep it mounted so switching back is instant.
  const [visited, setVisited] = useState(() => new Set([active]));
  const tabRefs = useRef([]);

  useEffect(() => {
    setVisited((prev) => (prev.has(active) ? prev : new Set(prev).add(active)));
    tabRefs.current[active]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    try {
      localStorage.setItem(TAB_KEY, String(active));
    } catch {
      /* ignore */
    }
  }, [active]);

  const select = (i) => {
    setActive(i);
    tabRefs.current[i]?.focus();
  };

  const onKeyDown = (e) => {
    const n = SITES.length;
    if (e.key === 'ArrowRight') select((active + 1) % n);
    else if (e.key === 'ArrowLeft') select((active - 1 + n) % n);
    else if (e.key === 'Home') select(0);
    else if (e.key === 'End') select(n - 1);
    else return;
    e.preventDefault();
  };

  const site = SITES[active];

  return (
    <div className="tabs-view">
      <nav className="tabbar">
        <span className="brand">K7A4I1Z7E3N2</span>
        <div className="tablist" role="tablist" aria-label="Sites" onKeyDown={onKeyDown}>
          {SITES.map((s, i) => (
            <button
              key={s.url}
              ref={(el) => (tabRefs.current[i] = el)}
              type="button"
              role="tab"
              id={`tab-${i}`}
              aria-selected={i === active}
              aria-controls={`panel-${i}`}
              tabIndex={i === active ? 0 : -1}
              className="tab"
              onClick={() => setActive(i)}
            >
              {s.title}
            </button>
          ))}
        </div>
        <SiteTools site={site} onReload={() => reload(active)} />
      </nav>
      <main className="stage">
        {SITES.map(
          (s, i) =>
            visited.has(i) && (
              <Pane
                key={`${s.url}#${nonces[i]}`}
                site={s}
                hidden={i !== active}
                id={`panel-${i}`}
                labelledBy={`tab-${i}`}
              />
            ),
        )}
      </main>
    </div>
  );
}

function Split({ nonces, reload }) {
  const [sizes, setSizes] = useState(() => loadSizes(SITES.length));
  const [dragging, setDragging] = useState(-1);
  const rootRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
    } catch {
      /* ignore */
    }
  }, [sizes]);

  // Move the boundary between pane i and i+1 so it sits at `pos` (0..1 of the viewport).
  const moveTo = useCallback((i, pos) => {
    setSizes((prev) => {
      const before = prev.slice(0, i).reduce((a, b) => a + b, 0);
      const pair = prev[i] + prev[i + 1];
      const left = Math.min(Math.max(pos - before, MIN), pair - MIN);
      const next = [...prev];
      next[i] = left;
      next[i + 1] = pair - left;
      return next;
    });
  }, []);

  const nudge = (i, delta) => {
    const before = sizes.slice(0, i + 1).reduce((a, b) => a + b, 0);
    moveTo(i, before + delta);
  };

  const onPointerDown = (i) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(i);
  };

  const onPointerMove = (i) => (e) => {
    if (dragging !== i) return;
    const rect = rootRef.current.getBoundingClientRect();
    moveTo(i, (e.clientX - rect.left) / rect.width);
  };

  const endDrag = () => setDragging(-1);

  const onKeyDown = (i) => (e) => {
    if (e.key === 'ArrowLeft') nudge(i, -STEP);
    else if (e.key === 'ArrowRight') nudge(i, STEP);
    else if (e.key === 'Home') moveTo(i, 0);
    else if (e.key === 'End') moveTo(i, 1);
    else if (e.key === 'Enter') setSizes(equal(SITES.length));
    else return;
    e.preventDefault();
  };

  return (
    <main ref={rootRef} className={`split ${dragging >= 0 ? 'is-dragging' : ''}`}>
      {SITES.map((site, i) => (
        <Pane
          key={`${site.url}#${nonces[i]}`}
          site={site}
          size={sizes[i]}
          tools={<SiteTools site={site} onReload={() => reload(i)} />}
        >
          {i < SITES.length - 1 && (
            <div
              className="divider"
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-valuenow={Math.round(sizes.slice(0, i + 1).reduce((a, b) => a + b, 0) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Resize ${site.title} and ${SITES[i + 1].title}`}
              title="Drag to resize · double-click to reset"
              data-active={dragging === i || undefined}
              onPointerDown={onPointerDown(i)}
              onPointerMove={onPointerMove(i)}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={endDrag}
              onDoubleClick={() => setSizes(equal(SITES.length))}
              onKeyDown={onKeyDown(i)}
            >
              <span className="grip" />
            </div>
          )}
        </Pane>
      ))}
    </main>
  );
}

function Pane({ site, size, hidden, id, labelledBy, tools, children }) {
  const [loaded, setLoaded] = useState(false);
  const host = new URL(site.url).host;

  return (
    <>
      <section
        className="pane"
        style={size === undefined ? undefined : { flexBasis: `${size * 100}%` }}
        hidden={hidden}
        id={id}
        role={labelledBy ? 'tabpanel' : undefined}
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : site.title}
      >
        {!loaded && (
          <div className="pane-loading" aria-hidden="true">
            <span className="pane-loading-title">{site.title}</span>
            <span className="pane-loading-host">{host}</span>
            <span className="pane-loading-bar" />
          </div>
        )}
        <iframe
          src={site.url}
          title={site.title}
          className={loaded ? 'is-loaded' : ''}
          onLoad={() => setLoaded(true)}
          allow="clipboard-write; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        {tools && <div className="pane-tools">{tools}</div>}
      </section>
      {children}
    </>
  );
}

function SiteTools({ site, onReload }) {
  return (
    <div className="site-tools">
      <span className="pane-host">{new URL(site.url).host}</span>
      <button type="button" className="tool" onClick={onReload} aria-label={`Reload ${site.title}`} title="Reload">
        <svg viewBox="0 0 24 24">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 4v5h-5" />
        </svg>
      </button>
      <a
        className="tool"
        href={site.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${site.title} in a new tab`}
        title="Open in new tab"
      >
        <svg viewBox="0 0 24 24">
          <path d="M14 4h6v6" />
          <path d="M20 4l-9 9" />
          <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
      </a>
    </div>
  );
}
