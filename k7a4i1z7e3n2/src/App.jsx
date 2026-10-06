import { useEffect, useRef, useState } from 'react';
import { SITES } from './sites.js';

const LAYOUT_KEY = 'split-view:layout';
const TAB_KEY = 'split-view:tab';
const WIDE_QUERY = '(min-width: 2500px)'; // split view only on very wide screens, tabs otherwise
const MIN = 0.08; // smallest a pane can get, as a fraction of the viewport
const STEP = 0.02; // keyboard nudge

const sum = (list) => list.reduce((a, b) => a + b, 0);
const equal = (n) => Array.from({ length: n }, () => 1 / n);

// Layout: `order` lists site indexes left to right, `sizes[site]` is that site's width.
// Widths belong to the site, so a pane keeps its width when it is moved.
const defaultLayout = () => ({ order: SITES.map((_, i) => i), sizes: equal(SITES.length) });

const isDefault = ({ order, sizes }) =>
  order.every((s, i) => s === i) && sizes.every((v) => Math.abs(v - 1 / sizes.length) < 1e-4);

function loadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY));
    const order = saved.order.map((url) => SITES.findIndex((s) => s.url === url));
    const valid =
      order.length === SITES.length &&
      !order.includes(-1) &&
      new Set(order).size === order.length &&
      saved.sizes.length === order.length &&
      saved.sizes.every((v) => v >= MIN - 1e-6) &&
      Math.abs(sum(saved.sizes) - 1) < 1e-3;
    if (valid) {
      const sizes = [];
      order.forEach((s, p) => (sizes[s] = saved.sizes[p]));
      return { order, sizes };
    }
  } catch {
    /* nothing saved, storage unavailable, or the site list changed: use the default */
  }
  return defaultLayout();
}

function saveLayout(layout) {
  try {
    if (isDefault(layout)) localStorage.removeItem(LAYOUT_KEY);
    else
      localStorage.setItem(
        LAYOUT_KEY,
        JSON.stringify({
          order: layout.order.map((s) => SITES[s].url),
          sizes: layout.order.map((s) => layout.sizes[s]),
        }),
      );
  } catch {
    /* ignore */
  }
}

// Move the boundary after position i to `pos` (0..1), starting from the widths at drag start.
// The pane on the growing side takes all the space; every pane on the other side gives some up
// in proportion to how far it is above MIN, so they shrink together and bottom out together.
function resize(start, i, pos) {
  const delta = pos - sum(start.slice(0, i + 1));
  const grow = delta > 0 ? i : i + 1;
  const shrink = start.map((_, j) => j).filter((j) => (delta > 0 ? j > i : j <= i));
  const spare = (j) => Math.max(start[j] - MIN, 0);
  const room = sum(shrink.map(spare));
  const amount = Math.min(Math.abs(delta), room);
  if (amount <= 0) return start;
  const next = [...start];
  next[grow] += amount;
  for (const j of shrink) next[j] -= (amount * spare(j)) / room;
  return next;
}

// Take the item at `from` and put it in gap `gap` (0 = before the first item, length = after the last).
function move(list, from, gap) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(gap > from ? gap - 1 : gap, 0, item);
  return next;
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

const BASE = import.meta.env.BASE_URL;
const onBase = () => {
  const path = window.location.pathname;
  return path === BASE || path === `${BASE}index.html` || `${path}/` === BASE;
};

// What each site is, for the 404's list
const ABOUT = {
  'Kaizen News': 'Where fundamentals lean, and the economic calendar.',
  'Kaizen Screener': 'GDP, market value and AI capital flows, market by market.',
  'Kaizen Market Hours': 'Which sessions are open, and the position size calculator.',
  'Kaizen Journal': 'Trades, the monthly calendar and one-loss-a-day discipline.',
  'Kaizen Vault': 'Passwords, cards and the trade journal, behind the lock.',
};

/** 404: any path other than the split view itself. */
function NotFound() {
  useEffect(() => {
    document.title = 'Page not found · Kaizen';
  }, []);
  return (
    <div className="nf-page">
      <main className="state nf-in">
        <p className="state-code">404</p>
        <h1 className="state-title">This page doesn’t exist</h1>
        <p className="state-text">The link may be broken, or the page may have moved.</p>
        <nav className="nf-links" aria-label="Where to go">
          <p className="nf-title">Try one of these</p>
          {[{ title: 'Split view', url: BASE, about: 'All five Kaizen sites side by side, or as tabs.' }]
            .concat(SITES.map((s) => ({ ...s, about: ABOUT[s.title] ?? s.url })))
            .map((s) => (
              <a key={s.url} href={s.url}>
                <span>
                  <b>{s.title}</b>
                  <small>{s.about}</small>
                </span>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3.5 10.5 8 6 12.5" />
                </svg>
              </a>
            ))}
        </nav>
      </main>
    </div>
  );
}

export default function App() {
  return onBase() ? <Viewer /> : <NotFound />;
}

function Viewer() {
  const wide = useMedia(WIDE_QUERY);
  const [layout, setLayout] = useState(loadLayout);
  // Bumping a site's nonce remounts its pane, which reloads the iframe.
  const [nonces, setNonces] = useState(() => SITES.map(() => 0));
  const reload = (i) => setNonces((prev) => prev.map((n, j) => (j === i ? n + 1 : n)));

  useEffect(() => saveLayout(layout), [layout]);

  return wide ? (
    <Split layout={layout} setLayout={setLayout} nonces={nonces} reload={reload} />
  ) : (
    <Tabs order={layout.order} nonces={nonces} reload={reload} />
  );
}

function Tabs({ order, nonces, reload }) {
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

  // Tabs follow the order chosen in the split view.
  const onKeyDown = (e) => {
    const n = order.length;
    const p = order.indexOf(active);
    if (e.key === 'ArrowRight') select(order[(p + 1) % n]);
    else if (e.key === 'ArrowLeft') select(order[(p - 1 + n) % n]);
    else if (e.key === 'Home') select(order[0]);
    else if (e.key === 'End') select(order[n - 1]);
    else return;
    e.preventDefault();
  };

  const site = SITES[active];

  return (
    <div className="tabs-view">
      <nav className="tabbar">
        <span className="brand">K7A4I1Z7E3N2</span>
        <div className="tablist" role="tablist" aria-label="Sites" onKeyDown={onKeyDown}>
          {order.map((i) => (
            <button
              key={SITES[i].url}
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
              {SITES[i].title}
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

function Split({ layout, setLayout, nonces, reload }) {
  const { order, sizes } = layout;
  const n = order.length;
  const widths = order.map((s) => sizes[s]); // by position, left to right
  const [resizing, setResizing] = useState(null); // { i, start }
  const [moving, setMoving] = useState(null); // { from, gap, dropX, x, y }
  const rootRef = useRef(null);
  const paneRefs = useRef([]); // by site index

  const setWidths = (next) =>
    setLayout((prev) => {
      const s = [...prev.sizes];
      prev.order.forEach((site, p) => (s[site] = next[p]));
      return { ...prev, sizes: s };
    });
  const setOrder = (next) => setLayout((prev) => ({ ...prev, order: next }));
  const evenOut = () => setWidths(equal(n));

  // ----- Resizing (dividers) -----

  const onResizeStart = (i) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizing({ i, start: widths });
  };

  const onResizeMove = (i) => (e) => {
    if (resizing?.i !== i) return;
    // Panes share the width left over after the dividers, so measure against that.
    const rect = rootRef.current.getBoundingClientRect();
    const d = e.currentTarget.offsetWidth;
    const pos = (e.clientX - rect.left - i * d - d / 2) / (rect.width - (n - 1) * d);
    setWidths(resize(resizing.start, i, pos));
  };

  const onResizeEnd = () => setResizing(null);

  const onResizeKey = (i) => (e) => {
    const boundary = sum(widths.slice(0, i + 1));
    if (e.key === 'ArrowLeft') setWidths(resize(widths, i, boundary - STEP));
    else if (e.key === 'ArrowRight') setWidths(resize(widths, i, boundary + STEP));
    else if (e.key === 'Home') setWidths(resize(widths, i, 0));
    else if (e.key === 'End') setWidths(resize(widths, i, 1));
    else if (e.key === 'Enter') evenOut();
    else return;
    e.preventDefault();
  };

  // ----- Moving (grip in the hover toolbar) -----

  const onMoveStart = (p) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setMoving({ from: p, gap: p, dropX: 0, x: e.clientX, y: e.clientY });
  };

  const onMoveDrag = (e) => {
    if (!moving) return;
    const root = rootRef.current.getBoundingClientRect();
    const rects = order.map((s) => paneRefs.current[s].getBoundingClientRect());
    // The drop gap is the number of panes whose middle is left of the pointer.
    const gap = rects.filter((r) => r.left + r.width / 2 < e.clientX).length;
    const dropX =
      gap === 0 ? 0 : gap === n ? root.width : (rects[gap - 1].right + rects[gap].left) / 2 - root.left;
    setMoving((m) => m && { ...m, gap, dropX, x: e.clientX, y: e.clientY });
  };

  const onMoveEnd = (commit) => () => {
    if (commit && moving && moving.gap !== moving.from && moving.gap !== moving.from + 1) {
      setOrder(move(order, moving.from, moving.gap));
    }
    setMoving(null);
  };

  const onMoveKey = (p) => (e) => {
    if (e.key === 'ArrowLeft' && p > 0) setOrder(move(order, p, p - 1));
    else if (e.key === 'ArrowRight' && p < n - 1) setOrder(move(order, p, p + 2));
    else return;
    e.preventDefault();
  };

  const dropping = moving && moving.gap !== moving.from && moving.gap !== moving.from + 1;
  const customized = !isDefault(layout);

  // Panes stay in site order in the DOM and are placed with CSS `order`: moving an iframe in
  // the DOM would reload it.
  return (
    <main
      ref={rootRef}
      className={`split ${resizing ? 'is-resizing' : ''} ${moving ? 'is-moving' : ''}`}
    >
      {SITES.map((site, s) => {
        const p = order.indexOf(s);
        return (
          <Pane
            key={`${site.url}#${nonces[s]}`}
            site={site}
            paneRef={(el) => (paneRefs.current[s] = el)}
            style={{ order: 2 * p, flex: `0 1 ${sizes[s] * 100}%` }}
            lifted={moving?.from === p}
            tools={
              <>
                <button
                  type="button"
                  className="tool grab"
                  aria-label={`Move ${site.title} (drag, or arrow keys)`}
                  title="Drag to move"
                  onPointerDown={onMoveStart(p)}
                  onPointerMove={onMoveDrag}
                  onPointerUp={onMoveEnd(true)}
                  onPointerCancel={onMoveEnd(false)}
                  onLostPointerCapture={onMoveEnd(false)}
                  onKeyDown={onMoveKey(p)}
                >
                  <svg viewBox="0 0 24 24" className="dots">
                    <circle cx="9" cy="6" r="1.4" />
                    <circle cx="15" cy="6" r="1.4" />
                    <circle cx="9" cy="12" r="1.4" />
                    <circle cx="15" cy="12" r="1.4" />
                    <circle cx="9" cy="18" r="1.4" />
                    <circle cx="15" cy="18" r="1.4" />
                  </svg>
                </button>
                <SiteTools site={site} onReload={() => reload(s)} />
                {customized && (
                  <>
                    <span className="tool-sep" />
                    <button
                      type="button"
                      className="tool"
                      onClick={() => setLayout(defaultLayout())}
                      aria-label="Reset layout to default order and widths"
                      title="Reset layout"
                    >
                      <svg viewBox="0 0 24 24">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="M9 5v14M15 5v14" />
                      </svg>
                    </button>
                  </>
                )}
              </>
            }
          />
        );
      })}

      {widths.slice(1).map((_, i) => (
        <div
          key={i}
          className="divider"
          style={{ order: 2 * i + 1 }}
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-valuenow={Math.round(sum(widths.slice(0, i + 1)) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Resize ${SITES[order[i]].title} and ${SITES[order[i + 1]].title}`}
          title="Drag to resize · double-click to even out"
          data-active={resizing?.i === i || undefined}
          onPointerDown={onResizeStart(i)}
          onPointerMove={onResizeMove(i)}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
          onLostPointerCapture={onResizeEnd}
          onDoubleClick={evenOut}
          onKeyDown={onResizeKey(i)}
        >
          <span className="grip" />
        </div>
      ))}

      {dropping && <div className="drop-line" style={{ left: moving.dropX }} />}
      {moving && (
        <div className="move-ghost" style={{ left: moving.x, top: moving.y }}>
          {SITES[order[moving.from]].title}
        </div>
      )}
    </main>
  );
}

function Pane({ site, style, hidden, id, labelledBy, tools, lifted, paneRef }) {
  const [loaded, setLoaded] = useState(false);
  const host = new URL(site.url).host;

  return (
    <section
      ref={paneRef}
      className={`pane ${lifted ? 'is-lifted' : ''}`}
      style={style}
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
