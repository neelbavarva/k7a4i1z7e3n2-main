import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { MAJORS, MODEL, PAIRS } from '../../pipeline/config.js';
import { effectOf, pairSide } from '../../pipeline/lib/score.js';
import { useCalendar } from '../calendarData.js';
import { useNow } from '../clock.js';
import { CAL_POLL_MINUTES, REFRESH_COOLDOWN_S } from '../constants.js';
import { fmtRelative, fmtTime, zone } from '../format.js';
import { Tick } from './EventTables.jsx';
import { CurrencyFlag } from './Flag.jsx';
import MarketIcon from './MarketIcon.jsx';
import { ErrorState, RefreshButton, Skeleton } from './States.jsx';

const BASE = import.meta.env.BASE_URL;
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const fmt = (o) => new Intl.DateTimeFormat(undefined, { timeZone: tz, ...o });
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (t) => dayKeyFmt.format(new Date(t));
const weekdayLong = fmt({ weekday: 'long' });
const weekdayShort = fmt({ weekday: 'short' });
const dateLong = fmt({ day: 'numeric', month: 'long' });
const dateShort = fmt({ day: 'numeric', month: 'short' });
const dayNum = fmt({ day: 'numeric' });
const hm = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Minutes since local midnight: where a release sits on its day's 24-hour track. */
const minuteOfDay = (t) => {
  const [h, m] = hm.format(new Date(t)).split(':').map(Number);
  return h * 60 + m;
};
/** "2026-10-06" -> a Date on that local day (noon, clear of any clock change). */
const dateOfKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
const nextKey = (key) => {
  const d = dateOfKey(key);
  d.setDate(d.getDate() + 1);
  return dayKey(d);
};

const IMPACTS = [
  { key: 'High', label: 'High' },
  { key: 'Medium', label: 'Medium' },
  { key: 'Low', label: 'Low' },
  { key: 'Holiday', label: 'Holidays' },
];
const IMPACT_KEYS = IMPACTS.map((i) => i.key);
const impactOf = (e) => (IMPACT_KEYS.includes(e.impact) ? e.impact : 'Low');
const RANK = { High: 0, Medium: 1, Low: 2, Holiday: 3 };
const CCY_ORDER = [...MAJORS, 'CNY', 'All'];
const COUNTRY = {
  USD: 'the US', EUR: 'the euro area', GBP: 'the UK', JPY: 'Japan', AUD: 'Australia', NZD: 'New Zealand',
  CAD: 'Canada', CHF: 'Switzerland', CNY: 'China', All: 'several countries',
};
/** Events that belong to no one country (OPEC meetings, G7 summits) come as "All" in the feed. */
const ccyLabel = (c) => (c === 'All' ? 'Global' : c);
/** Auctions list two numbers, yield and bid-to-cover, as "3.00|3.3". */
const val = (v) => (v ? v.replace(/\|/g, ' / ') : v);
const CAT_NAME = { growth: 'growth data', labour: 'jobs data', inflation: 'inflation data', rates: 'rate decision', other: 'data' };

/** Time to go, to the minute: "45 min", "2 h 14 min", "1 d 6 h". */
function timeLeft(ms) {
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h < 24) return mm ? `${h} h ${mm} min` : `${h} h`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return hh ? `${d} d ${hh} h` : `${d} d`;
}

const pad = (n) => String(n).padStart(2, '0');

// ---------------------------------------------------------------------------------------------
// Filters: which impacts and currencies, remembered on this device

const STORE = 'fx-calendar-filters';
function readFilters() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? 'null');
    const impacts = Array.isArray(v?.impacts) ? v.impacts.filter((k) => IMPACT_KEYS.includes(k)) : [];
    return { impacts: impacts.length ? impacts : IMPACT_KEYS, ccys: Array.isArray(v?.ccys) ? v.ccys : [] };
  } catch {
    return { impacts: IMPACT_KEYS, ccys: [] };
  }
}
function useFilters() {
  const [f, setF] = useState(readFilters);
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(f));
    } catch {
      // private mode: the filters just aren't remembered
    }
  }, [f]);
  return [f, setF];
}

// ---------------------------------------------------------------------------------------------
// What a release means for the markets on this site

const asEvent = (e) => ({ currency: e.ccy, title: e.title, skip: e.skip, weight: e.w, isRate: e.kind === 'rate' });

/** Markets a release moves (and which way, if it comes in above forecast), or just touches. */
function marketsFor(e) {
  const ev = asEvent(e);
  const moves = [];
  const touches = [];
  for (const p of PAIRS) {
    const eff = e.kind === 'holiday' ? null : effectOf(p, ev);
    if (eff) moves.push({ pair: p, sign: Math.sign(eff.m * (e.dir || 1)) });
    else if (!p.drivers && pairSide(p, e.ccy)) touches.push(p);
  }
  return { moves, touches };
}

const nameOf = (p) => p.name ?? p.symbol;
const listOf = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

function NumberLine({ e: raw, out }) {
  const e = { ...raw, a: val(raw.a), f: val(raw.f), p: val(raw.p) };
  const ccy = e.ccy === 'All' ? 'markets' : `the ${e.ccy}`;
  if (e.kind === 'holiday') {
    return (
      <p>
        Banks in {COUNTRY[e.ccy] ?? e.ccy} are closed. Trading in {ccy} is usually thinner, so moves can be jumpy.
      </p>
    );
  }
  if (e.kind === 'speech' && !e.f) {
    return <p>No number to beat: markets move on what is said, most of all about interest rates.</p>;
  }
  if (e.a && e.f) {
    const where = e.vs > 0 ? `above the ${e.f} forecast` : e.vs < 0 ? `below the ${e.f} forecast` : 'right on the forecast';
    const verdict = e.beat > 0 ? `better than expected for ${ccy}` : e.beat < 0 ? `worse than expected for ${ccy}` : e.beat === 0 ? 'no surprise' : null;
    return (
      <p>
        Came in at <b>{e.a}</b>, {where}
        {verdict ? `: ${verdict}` : ''}.{e.p ? ` Last time: ${e.p}.` : ''}
      </p>
    );
  }
  if (e.a) {
    return (
      <p>
        Came in at <b>{e.a}</b>
        {e.p ? `, after ${e.p} last time` : ''}. There was no forecast to compare it with.
      </p>
    );
  }
  const pending = out ? ' The actual figure isn’t in the feed yet.' : '';
  if (e.f && e.p) {
    const change = e.trend > 0 ? 'a rise' : e.trend < 0 ? 'a fall' : 'no change';
    const lean = e.lean > 0 ? `, which would be good news for ${ccy}` : e.lean < 0 ? `, which would weigh on ${ccy}` : '';
    return (
      <p>
        Forecast <b>{e.f}</b>, after {e.p} last time: {change}
        {lean}.{pending}
      </p>
    );
  }
  if (e.f) return <p>Forecast <b>{e.f}</b>. No previous value in the feed.{pending}</p>;
  if (e.p) return <p>Last time: <b>{e.p}</b>. The feed has no forecast for this one.{pending}</p>;
  return <p>The feed lists no numbers for this one.</p>;
}

function CountsLine({ e, moves }) {
  const days = (h) => `${h / 24} days`;
  const drives = moves.filter((m) => m.pair.drivers).map((m) => nameOf(m.pair));
  if (e.kind === 'holiday') return <p>No effect on any score. Holidays only mark thin trading.</p>;
  if (e.kind === 'rate') {
    return (
      <p>
        A rate decision: the biggest mover there is. A surprise counts {MODEL.rateWeight}× in the bias score and fades by half
        every {days(MODEL.rateHalfLifeHours)}.
      </p>
    );
  }
  if (e.skip) {
    return drives.length ? (
      <p>Not scored for the {e.ccy}, but it drives {listOf(drives)}.</p>
    ) : (
      <p>Risk only: no number the bias score uses, but it widens the range of the markets it touches.</p>
    );
  }
  if (e.w > 0) {
    return (
      <p>
        {e.impact} impact {CAT_NAME[e.cat] ?? 'data'}. A surprise counts {e.w}× in the bias score and fades by half every{' '}
        {days(MODEL.halfLifeHours)}.{e.dir < 0 ? ' Lower is better here.' : ''}
      </p>
    );
  }
  return drives.length ? (
    <p>Low impact for the {e.ccy}, but it drives {listOf(drives)}.</p>
  ) : (
    <p>Low impact: here for context. The bias score leaves it out.{e.dir < 0 ? ' Lower is better here.' : ''}</p>
  );
}

function Detail({ e, out }) {
  const { moves, touches } = useMemo(() => marketsFor(e), [e]);
  const chips = moves.length ? moves : touches.map((pair) => ({ pair, sign: 0 }));
  return (
    <div className="cd">
      <div className="cd-col">
        <h4>The number</h4>
        <NumberLine e={e} out={out} />
      </div>
      <div className="cd-col">
        <h4>How it counts</h4>
        <CountsLine e={e} moves={moves} />
      </div>
      <div className="cd-col cd-markets">
        <h4>{moves.length ? 'Above forecast moves' : chips.length ? `${e.ccy} pairs to watch` : 'Markets'}</h4>
        {chips.length ? (
          <>
            <ul className="cd-chips">
              {chips.map(({ pair, sign }) => (
                <li key={pair.id}>
                  <a href={`${BASE}#/${pair.id}`} className="cd-chip" title={`Open ${nameOf(pair)}`}>
                    <MarketIcon pair={pair} size={14} />
                    {pair.symbol}
                    {sign !== 0 && (
                      <span className={sign > 0 ? 'up' : 'down'} aria-label={sign > 0 ? 'up' : 'down'}>
                        {sign > 0 ? '▲' : '▼'}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
            {moves.length > 0 && <p className="cd-note">Below forecast: the reverse.</p>}
          </>
        ) : (
          <p>None of the markets on this site follow it.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Small pieces

/** Impact as three rising bars: High fills all three, Medium two, Low one. Holidays get a flag. */
export function ImpactMark({ level }) {
  if (level === 'Holiday') {
    return (
      <span className="imp imp-holiday" role="img" aria-label="Bank holiday" title="Bank holiday">
        <svg viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3.5 12.5v-10M3.5 3h7l-1.6 2.6L10.5 8h-7" />
        </svg>
      </span>
    );
  }
  const n = level === 'High' ? 3 : level === 'Medium' ? 2 : 1;
  return (
    <span className={`imp imp-${level.toLowerCase()}`} role="img" aria-label={`${level} impact`} title={`${level} impact`}>
      {[0, 1, 2].map((i) => (
        <i key={i} className={i < n ? 'on' : ''} />
      ))}
    </span>
  );
}

/** The next big release, with a countdown to the second. Its name opens it in the list. */
function NextUp({ events, onOpen }) {
  const now = useNow(1000);
  const ahead = events.filter((e) => Date.parse(e.t) > now && e.impact !== 'Holiday');
  const level = ahead.some((e) => e.impact === 'High') ? 'High' : ahead.some((e) => e.impact === 'Medium') ? 'Medium' : null;
  if (!level) {
    return (
      <div className="nx">
        <div className="nx-main">
          <p className="nx-label">Next big release</p>
          <p className="nx-none">Nothing high or medium impact is left in this calendar. Next week shows up once it's published.</p>
        </div>
      </div>
    );
  }
  const e = ahead.find((x) => x.impact === level);
  const same = ahead.filter((x) => x.t === e.t && x.id !== e.id && (x.impact === 'High' || x.impact === 'Medium'));
  const ms = Date.parse(e.t) - now;
  const s = Math.floor(ms / 1000);
  const units = [
    [Math.floor(s / 86400), 'days'],
    [Math.floor((s % 86400) / 3600), 'hrs'],
    [Math.floor((s % 3600) / 60), 'min'],
    [s % 60, 'sec'],
  ].filter(([n, u], i) => i > 0 || n > 0);
  return (
    <div className="nx">
      <div className="nx-main">
        <p className="nx-label">
          <ImpactMark level={level} />
          Next {level.toLowerCase()} impact
        </p>
        <button type="button" className="nx-title" onClick={() => onOpen(e)} title="Open it in the list">
          <CurrencyFlag ccy={e.ccy} size={20} />
          <span className="nx-ccy">{ccyLabel(e.ccy)}</span>
          <span className="nx-name">{e.title}</span>
        </button>
        <p className="nx-meta">
          <span>
            {weekdayShort.format(new Date(e.t))} {dateShort.format(new Date(e.t))}, {fmtTime(e.t)}
          </span>
          {e.f && (
            <span>
              Forecast <b>{val(e.f)}</b>
            </span>
          )}
          {e.p && (
            <span>
              Previous <b>{val(e.p)}</b>
            </span>
          )}
          {same.length > 0 && (
            <span>with {same.length === 1 ? `${ccyLabel(same[0].ccy)} ${same[0].title}` : `${same.length} more`}</span>
          )}
        </p>
      </div>
      <div className="nx-clock" role="timer" aria-label={`Out in ${timeLeft(ms)}`}>
        {units.map(([n, u]) => (
          <span key={u} className="nx-unit">
            <b>{pad(n)}</b>
            <small>{u}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

/** The days at a glance: each one's releases on a 24-hour track. Click a day to jump to it. */
function WeekStrip({ days, todayKey, now, onPick }) {
  return (
    <ol className="ws" aria-label="Days in this calendar">
      {days.map((d) => {
        const past = d.key < todayKey;
        const today = d.key === todayKey;
        const count = (lvl) => d.events.filter((e) => impactOf(e) === lvl).length;
        const high = count('High');
        const med = count('Medium');
        const timed = d.events.filter((e) => e.impact !== 'Holiday');
        const closed = [...new Set(d.events.filter((e) => e.impact === 'Holiday').map((e) => e.ccy))];
        const date = dateOfKey(d.key);
        return (
          <li key={d.key}>
            <button
              type="button"
              className={`ws-day${past ? ' is-past' : ''}${today ? ' is-today' : ''}`}
              onClick={() => onPick(d.key)}
              aria-label={`${today ? 'Today, ' : ''}${weekdayLong.format(date)} ${dateLong.format(date)}: ${timed.length} releases, ${high} high impact`}
            >
              <span className="ws-top">
                <span className="ws-name">{weekdayShort.format(date)}</span>
                <span className="ws-num">{dayNum.format(date)}</span>
                {today && <span className="ws-today">Today</span>}
                <span className="ws-end">
                  {closed.slice(0, 3).map((c) => (
                    <CurrencyFlag key={c} ccy={c} size={12} />
                  ))}
                  {past && <Tick />}
                </span>
              </span>
              <span className="ws-track" aria-hidden="true">
                {[...timed].sort((a, b) => RANK[impactOf(b)] - RANK[impactOf(a)]).map((e) => (
                  <i key={e.id} className={`ws-tick t-${impactOf(e).toLowerCase()}`} style={{ left: `${(minuteOfDay(e.t) / 1440) * 100}%` }} />
                ))}
                {today && <i className="ws-now" style={{ left: `${(minuteOfDay(now) / 1440) * 100}%` }} />}
              </span>
              <span className="ws-counts">
                {high > 0 && <span className="n-high">{high} high</span>}
                {med > 0 && <span className="n-med">{med} med</span>}
                <span className="n-all">{timed.length ? `${timed.length} total` : closed.length ? 'Holiday' : 'Quiet'}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function CalStatus({ cal, error, checkedAt, refreshing, onRefresh, cooldownUntil }) {
  useNow(30 * 1000);
  const saved = cal?.from === 'saved';
  const failedNow = !!error && !!cal;
  const warn = saved || failedNow;
  const ago = (t) => (Date.now() - t < 60 * 1000 ? 'just now' : fmtRelative(t));
  let text;
  if (failedNow) text = `Couldn't reach the calendar just now. This is what it said ${fmtRelative(cal.generatedAt)}.`;
  else if (saved && cal.demo) text = "Sample calendar: the live feed couldn't be reached.";
  else if (saved) text = `The live feed couldn't be reached, so this is the copy saved ${fmtRelative(cal.generatedAt)}.`;
  else
    text = (
      <>
        Live from ForexFactory, checked {ago(checkedAt)}.
        <span className="sb-extra"> It checks again every {CAL_POLL_MINUTES} minutes.</span>
      </>
    );
  return (
    <div className={`statusbar${warn ? ' is-stale' : ''}`} role="status">
      <i aria-hidden="true" />
      <p>{text}</p>
      <RefreshButton onRefresh={onRefresh} refreshing={refreshing} cooldownUntil={cooldownUntil} what="calendar" />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

export default function Calendar() {
  const { cal, error, checkedAt, loading, reload } = useCalendar();
  const now = useNow();
  const [filters, setFilters] = useFilters();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [shownPast, setShownPast] = useState(() => new Set());
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const search = useRef(null);
  const groupEls = useRef(new Map());
  const todayKey = dayKey(now);

  const refresh = async () => {
    if (loading || Date.now() < cooldownUntil) return;
    await reload();
    setCooldownUntil(Date.now() + REFRESH_COOLDOWN_S * 1000);
  };

  // "/" focuses the search from anywhere on the page
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const typing = t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const all = cal?.events ?? [];
  const impacts = new Set(filters.impacts);
  const ccys = new Set(filters.ccys);
  const q = query.trim().toLowerCase();
  const matches = (e) =>
    impacts.has(impactOf(e)) &&
    (ccys.size === 0 || ccys.has(e.ccy)) &&
    (!q || `${e.ccy} ${ccyLabel(e.ccy)} ${e.title}`.toLowerCase().includes(q));
  const shown = all.filter(matches);
  const filtered = shown.length !== all.length;

  // every day from the first release to the last, empty ones included (for the strip)
  const days = useMemo(() => {
    if (!shown.length && !all.length) return [];
    const src = all.length ? all : shown;
    const first = dayKey(src[0].t);
    const last = dayKey(src.at(-1).t);
    const out = [];
    for (let k = first; k <= last && out.length < 21; k = nextKey(k)) out.push({ key: k, events: [] });
    const byKey = new Map(out.map((d) => [d.key, d]));
    for (const e of shown) byKey.get(dayKey(e.t))?.events.push(e);
    // holidays lead their day: they last all of it
    for (const d of out) d.events.sort((a, b) => (b.impact === 'Holiday') - (a.impact === 'Holiday') || Date.parse(a.t) - Date.parse(b.t));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cal, query, filters]);

  const ccyList = useMemo(() => {
    const have = new Set(all.map((e) => e.ccy));
    return CCY_ORDER.filter((c) => have.has(c)).concat([...have].filter((c) => !CCY_ORDER.includes(c)));
  }, [cal]);
  const impactCount = (k) => all.filter((e) => impactOf(e) === k && (ccys.size === 0 || ccys.has(e.ccy))).length;

  const toggleImpact = (k) =>
    setFilters((f) => {
      const set = new Set(f.impacts);
      if (set.has(k)) set.delete(k);
      else set.add(k);
      // never all off: switching off the last one shows everything again
      return { ...f, impacts: set.size ? IMPACT_KEYS.filter((x) => set.has(x)) : IMPACT_KEYS };
    });
  const toggleCcy = (c) =>
    setFilters((f) => {
      if (c == null) return { ...f, ccys: [] };
      const set = new Set(f.ccys);
      if (set.has(c)) set.delete(c);
      else set.add(c);
      return { ...f, ccys: [...set] };
    });
  const clearAll = () => {
    setFilters({ impacts: IMPACT_KEYS, ccys: [] });
    setQuery('');
  };

  const openInList = (e) => {
    setOpenId(e.id);
    requestAnimationFrame(() => document.getElementById(`ev-${e.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  const goTo = (key) => {
    const d = days.find((x) => x.key === key);
    if (!d?.events.length) return;
    if (key < todayKey) setShownPast((s) => new Set(s).add(key));
    requestAnimationFrame(() => groupEls.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // the release(s) up next get a marker in the list
  const nextT = shown.find((e) => Date.parse(e.t) > now && e.impact !== 'Holiday')?.t;

  if (!cal && error) return <ErrorState error={error} onRetry={reload} />;
  if (!cal) return <Skeleton kind="calendar" />;

  const weeks = new Set(days.map((d) => weekKey(d.key))).size;

  return (
    <main className="cal fade-in">
      <CalStatus cal={cal} error={error} checkedAt={checkedAt} refreshing={loading} onRefresh={refresh} cooldownUntil={cooldownUntil} />

      <header className="cal-head">
        <h1 className="overview-title">Economic calendar</h1>
        <p className="overview-lede">
          Every scheduled release for {weeks > 1 ? 'this week and next' : 'this week'}, in your time zone ({zone}). Open a
          release to see what the number means and which markets it moves. What's already out steps back.
        </p>
      </header>

      <section className="cal-top" aria-label="This week at a glance">
        <NextUp events={shown.length ? shown : all} onOpen={openInList} />
        <WeekStrip days={days} todayKey={todayKey} now={now} onPick={goTo} />
      </section>

      <div className="cal-tools">
        <div className="ct-row ct-top">
          <label className="ct-search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            <input
              ref={search}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('');
                  e.currentTarget.blur();
                }
              }}
              placeholder="Search releases: CPI, payrolls, Lagarde, USD…"
              aria-label="Search releases"
              autoComplete="off"
              spellCheck="false"
            />
            {!query && <kbd aria-hidden="true">/</kbd>}
          </label>
          <div className="ct-group ct-impacts" role="group" aria-label="Impact">
            <span className="ct-label" aria-hidden="true">
              Impact
            </span>
            <div className="ct-track">
              {IMPACTS.map((i) => (
                <button key={i.key} type="button" className="ct-tog ct-imp" aria-pressed={impacts.has(i.key)} onClick={() => toggleImpact(i.key)}>
                  <ImpactMark level={i.key} />
                  {i.label}
                  <span className="ct-n">{impactCount(i.key)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="ct-row">
          <div className="ct-group ct-ccys" role="group" aria-label="Currencies">
            <span className="ct-label" aria-hidden="true">
              Currency
            </span>
            <div className="ct-track">
              <button type="button" className="ct-tog" aria-pressed={ccys.size === 0} onClick={() => toggleCcy(null)}>
                All
              </button>
              {ccyList.map((c) => (
                <button key={c} type="button" className="ct-tog" aria-pressed={ccys.has(c)} onClick={() => toggleCcy(c)}>
                  <CurrencyFlag ccy={c} size={14} />
                  {ccyLabel(c)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="cal-count" aria-live="polite">
        {filtered ? (
          <>
            Showing {shown.length} of {all.length} releases.{' '}
            <button type="button" className="linklike" onClick={clearAll}>
              Show all
            </button>
          </>
        ) : (
          `${all.length} releases`
        )}
      </p>

      {shown.length === 0 ? (
        <div className="cal-empty">
          <p>No releases match {q ? `“${query.trim()}”` : 'these filters'}.</p>
          <button type="button" className="btn" onClick={clearAll}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="cal-board">
          <table className="cal-table">
            <colgroup>
              <col className="w-time" />
              <col className="w-left" />
              <col className="w-cur" />
              <col className="w-imp" />
              <col />
              <col className="w-num" />
              <col className="w-num" />
              <col className="w-num" />
              <col className="w-chev" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">
                  <span className="visually-hidden">Status</span>
                </th>
                <th scope="col">Cur.</th>
                <th scope="col">Impact</th>
                <th scope="col">Release</th>
                <th scope="col" className="num">
                  Actual
                </th>
                <th scope="col" className="num">
                  Forecast
                </th>
                <th scope="col" className="num">
                  Previous
                </th>
                <th scope="col">
                  <span className="visually-hidden">Details</span>
                </th>
              </tr>
            </thead>
            {days
              .filter((d) => d.events.length)
              .map((d) => {
                const past = d.key < todayKey;
                const today = d.key === todayKey;
                const collapsed = past && !shownPast.has(d.key);
                const date = dateOfKey(d.key);
                const timed = d.events.filter((e) => e.impact !== 'Holiday');
                const high = timed.filter((e) => e.impact === 'High').length;
                const firstAhead = today ? d.events.findIndex((e) => e.impact !== 'Holiday' && Date.parse(e.t) > now) : -1;
                const nowAt = today ? (firstAhead < 0 ? d.events.length : firstAhead) : -1;
                const name = today ? 'Today' : d.key === nextKey(todayKey) ? 'Tomorrow' : weekdayLong.format(date);
                return (
                  <tbody key={d.key} className={`cal-group${past ? ' is-past' : ''}${today ? ' is-today' : ''}`}>
                    <tr className="cal-day">
                      <th colSpan={9} scope="rowgroup" ref={(el) => (el ? groupEls.current.set(d.key, el) : groupEls.current.delete(d.key))}>
                        <div className="cal-day-in">
                          <span className="cal-day-name">{name}</span>
                          <span className="cal-day-date">
                            {name === weekdayLong.format(date) ? dateLong.format(date) : `${weekdayLong.format(date)} ${dateLong.format(date)}`}
                          </span>
                          <span className="cal-day-meta">
                            {timed.length} release{timed.length === 1 ? '' : 's'}
                            {high > 0 && <span className="n-high"> · {high} high</span>}
                          </span>
                          {past && (
                            <button
                              type="button"
                              className="cal-day-toggle"
                              aria-expanded={!collapsed}
                              onClick={() =>
                                setShownPast((s) => {
                                  const n = new Set(s);
                                  if (n.has(d.key)) n.delete(d.key);
                                  else n.add(d.key);
                                  return n;
                                })
                              }
                            >
                              <Tick />
                              {collapsed ? 'Done · show' : 'Hide'}
                            </button>
                          )}
                        </div>
                      </th>
                    </tr>
                    {!collapsed &&
                      d.events.map((e, i) => {
                        const holiday = e.impact === 'Holiday';
                        const out = !holiday && Date.parse(e.t) <= now;
                        const open = openId === e.id;
                        const sameTime = i > 0 && d.events[i - 1].t === e.t && !holiday && d.events[i - 1].impact !== 'Holiday';
                        return (
                          <Fragment key={e.id}>
                            {i === nowAt && (
                              <tr className="cal-now" aria-label={`Now, ${fmtTime(now)}`}>
                                <td colSpan={9}>
                                  <span className="cal-now-in">
                                    <b>Now</b>
                                    <span>{fmtTime(now)}</span>
                                    <i aria-hidden="true" />
                                  </span>
                                </td>
                              </tr>
                            )}
                            <tr
                              id={`ev-${e.id}`}
                              className={`cal-row imp-row-${impactOf(e).toLowerCase()}${out ? ' is-out' : ''}${open ? ' is-open' : ''}${e.t === nextT ? ' is-next' : ''}`}
                              onClick={(ev) => {
                                // the whole row opens it; the release name is the real button
                                if (ev.target.closest('a, button')) return;
                                setOpenId(open ? null : e.id);
                              }}
                            >
                              <td className={`c-time${sameTime ? ' is-same' : ''}`}>{holiday ? 'All day' : fmtTime(e.t)}</td>
                              <td className="c-left">
                                {holiday ? (
                                  <span className="muted">Closed</span>
                                ) : out ? (
                                  <span className="out-tag">
                                    <Tick />
                                    Out
                                  </span>
                                ) : (
                                  <span className={e.t === nextT ? 'left-next' : 'left'}>in {timeLeft(Date.parse(e.t) - now)}</span>
                                )}
                              </td>
                              <td className="c-cur">
                                <CurrencyFlag ccy={e.ccy} size={16} />
                                <span>{ccyLabel(e.ccy)}</span>
                              </td>
                              <td className="c-imp">
                                <ImpactMark level={impactOf(e)} />
                              </td>
                              <td className="c-ev">
                                {/* phones fold currency and impact into this cell (see styles.css) */}
                                <span className="ev-pre" aria-hidden="true">
                                  <CurrencyFlag ccy={e.ccy} size={14} />
                                  <b>{ccyLabel(e.ccy)}</b>
                                  <ImpactMark level={impactOf(e)} />
                                </span>
                                <button type="button" className="ev-btn" aria-expanded={open} onClick={() => setOpenId(open ? null : e.id)}>
                                  {e.title}
                                </button>
                                {e.kind === 'rate' && <span className="ev-tag">Rate decision</span>}
                                {e.kind === 'speech' && <span className="ev-tag">Speech</span>}
                              </td>
                              <td className="c-num c-act" data-label="Actual">
                                {e.a ? (
                                  <span className={e.beat > 0 ? 'up' : e.beat < 0 ? 'down' : ''}>
                                    {e.url ? (
                                      <a href={e.url} target="_blank" rel="noreferrer">
                                        {val(e.a)}
                                      </a>
                                    ) : (
                                      val(e.a)
                                    )}
                                  </span>
                                ) : (
                                  <span className="muted" title={out ? 'Not in the feed yet' : undefined}>
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="c-num" data-label="Forecast">
                                {val(e.f) ?? <span className="muted">—</span>}
                              </td>
                              <td className="c-num" data-label="Previous">
                                {val(e.p) ?? <span className="muted">—</span>}
                              </td>
                              <td className="c-chev" aria-hidden="true">
                                <svg viewBox="0 0 16 16">
                                  <path d="M4.5 6.5 8 10l3.5-3.5" />
                                </svg>
                              </td>
                            </tr>
                            {open && (
                              <tr className="cal-detail">
                                <td colSpan={9}>
                                  <Detail e={e} out={out} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                  </tbody>
                );
              })}
          </table>
        </div>
      )}
    </main>
  );
}

/** The feed's week (Sunday to Saturday) a local day falls in. */
function weekKey(key) {
  const d = dateOfKey(key);
  d.setDate(d.getDate() - d.getDay());
  return dayKey(d);
}
