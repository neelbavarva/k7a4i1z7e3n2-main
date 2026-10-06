import { useCallback, useEffect, useState } from 'react';
import { fmtRelative, fmtTime } from '../format.js';
import { STALE_HOURS } from '../constants.js';

const BASE = import.meta.env.BASE_URL;
const MIN = 60 * 1000;
// on the dev server the files are a local run of the job, without the API keys GitHub has
const LOCAL = import.meta.env.DEV;

/** GET a URL, timed. Never throws: { ok, status, ms, body, error }. */
async function probe(url) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const ms = Math.round(performance.now() - t0);
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* not JSON */
    }
    return { ok: res.ok, status: res.status, ms, body };
  } catch (err) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - t0), error: err.message };
  }
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Every check runs for real from this browser: the published files, the two Vercel functions,
 * and what the last hourly job reported for each of its sources (meta.json's "report").
 * Each answers { state: ok | warn | fail | off, detail, ms }.
 */
async function runChecks() {
  const meta = await probe(`${BASE}data/meta.json?v=${Date.now()}`);
  const m = meta.body;
  const r = m?.report;
  const noReport = { state: 'off', detail: "The hourly job hasn't reported yet. This fills in after its next run." };

  const [job, cal, pair] = await Promise.all([
    probe(`${BASE}api/refresh`),
    probe(`${BASE}api/calendar`),
    m?.pairs?.[0] ? probe(`${BASE}data/pairs/${m.pairs[0].id}.json?v=${encodeURIComponent(m.generatedAt)}`) : null,
  ]);

  const checks = {};

  // the published scores
  if (!meta.ok || !m) checks.files = { state: 'fail', detail: `meta.json didn't load (${meta.error ?? `HTTP ${meta.status}`}).`, ms: meta.ms };
  else {
    const age = Date.now() - Date.parse(m.generatedAt);
    const kind = m.demo ? 'sample data' : 'real data';
    checks.files = {
      state: m.demo ? 'warn' : age <= 75 * MIN ? 'ok' : age <= STALE_HOURS * 60 * MIN ? 'warn' : 'fail',
      detail: `Generated ${fmtRelative(m.generatedAt)} · ${plural(m.pairs.length, 'market')} · ${kind}`,
      ms: meta.ms,
    };
  }

  // one market's file, as a market page loads it
  if (pair) {
    const d = pair.body;
    checks.pair = pair.ok
      ? { state: 'ok', detail: `${d.pair.symbol}: ${plural(d.series.length, 'hourly point')}, ${plural(d.events.length, 'release')}`, ms: pair.ms }
      : { state: 'fail', detail: `The ${m.pairs[0].symbol} file didn't load (HTTP ${pair.status}).`, ms: pair.ms };
  }

  // the job itself, as GitHub reports it (through /api/refresh)
  // the dev server answers unknown paths with the page itself, so anything but JSON means "not here"
  if (job.status === 404 || (job.ok && !job.body?.state)) checks.job = { state: 'off', detail: "/api/refresh isn't served here (the dev server runs the job on your machine instead).", ms: job.ms };
  else if (job.status === 501) checks.job = { state: 'warn', detail: "Refresh can't start the job: GITHUB_DISPATCH_TOKEN isn't set on Vercel.", ms: job.ms };
  else if (!job.ok) checks.job = { state: 'fail', detail: `GitHub couldn't be asked (HTTP ${job.status}).`, ms: job.ms };
  else {
    const j = job.body;
    checks.job =
      j.state === 'running'
        ? { state: 'run', detail: `Running now, started ${fmtRelative(j.startedAt)}. This panel checks again by itself until it's done.`, ms: job.ms }
        : j.state === 'done'
          ? { state: j.ok ? 'ok' : 'fail', detail: `Last run ${j.ok ? 'succeeded' : 'failed'}, ${fmtRelative(j.finishedAt)}${r ? ` · started by ${TRIGGER[r.trigger] ?? r.trigger}` : ''}.`, ms: job.ms }
          : { state: 'off', detail: 'No runs yet.', ms: job.ms };
  }

  // the job's sources, from its own report
  if (!r) Object.assign(checks, { feed: noReport, actuals: noReport, prices: noReport });
  else {
    const c = r.calendar;
    const week = c.files[0];
    const next = c.files[1];
    checks.feed = c.error
      ? { state: 'fail', detail: `${c.error}. The job kept scoring the releases it already had.` }
      : {
          state: 'ok',
          detail: `${plural(week?.items ?? 0, 'release')} this week${next ? (next.error ? '; next week not published yet' : `, ${next.items} next week`) : ''} · ${c.added} new, ${c.updated} updated`,
        };

    const values = m.counts ? `${m.counts.withActual} of ${m.counts.released} released have a value` : '';
    const ap = r.actuals.apify;
    const credit = ap && ap.used != null ? ` · $${ap.used.toFixed(2)} of $${ap.limit.toFixed(2)} Apify credit used this month` : '';
    checks.actuals = !ap
      ? noReport
      : ap.skipped
        ? { state: LOCAL ? 'off' : 'warn', detail: `Skipped: no APIFY_TOKEN${LOCAL ? ' on this machine' : ''}, so released values wait for the feed's next listing · ${values}` }
        : ap.error
          ? { state: 'fail', detail: `${ap.error} · ${values}` }
          : ap.paused
            ? { state: 'warn', detail: `Paused: ${ap.paused}. Values wait for the feed until the credit resets · ${values}` }
            : {
                state: ap.tried && ap.filled < ap.tried ? 'warn' : 'ok',
                detail: `${
                  ap.tried
                    ? `Filled ${ap.filled} of ${ap.tried} waiting in ${plural(ap.runs, 'run')}${ap.filled < ap.tried ? '; the rest are asked for again next hour' : ''}`
                    : 'Nothing waiting'
                }${credit} · ${values}`,
              };

    const p = r.prices;
    checks.prices = !p
      ? noReport
      : p.skipped
        ? { state: LOCAL ? 'off' : 'warn', detail: `Skipped: no TWELVE_DATA_KEY${LOCAL ? ' on this machine' : ''}, so the price charts stay empty.` }
        : { state: p.updated === p.total ? 'ok' : p.updated ? 'warn' : 'fail', detail: `${p.updated} of ${p.total} price series updated${p.error ? ` · last error ${p.error}` : ''}` };
  }

  // the live calendar the Calendar page reads
  checks.live = cal.ok && Array.isArray(cal.body?.events)
    ? { state: cal.body?.live ? 'ok' : 'warn', detail: `${plural(cal.body?.events?.length ?? 0, 'release')} ${cal.body?.live ? 'live from the feed' : 'from the saved copy'}`, ms: cal.ms }
    : { state: 'fail', detail: `/api/calendar didn't answer (${cal.error ?? `HTTP ${cal.status}`}). The Calendar page falls back on the saved copy.`, ms: cal.ms };

  return checks;
}

const TRIGGER = { schedule: 'the hourly schedule', workflow_dispatch: 'Refresh', push: 'a code push', local: 'a local run' };

// the checks, in the order the data flows
const CHECKS = [
  { id: 'feed', title: 'Calendar feed', what: `ForexFactory, fetched by the last ${LOCAL ? 'local run of the job' : 'hourly job'}` },
  { id: 'actuals', title: 'Released values', what: `ForexFactory's calendar page, read through Apify, in the last ${LOCAL ? 'local run of the job' : 'hourly job'}` },
  { id: 'prices', title: 'Prices', what: `Twelve Data, in the last ${LOCAL ? 'local run of the job' : 'hourly job'}` },
  { id: 'job', title: 'Hourly job', what: 'GitHub Actions, asked through /api/refresh' },
  { id: 'files', title: 'Published scores', what: LOCAL ? 'data/meta.json, your local copy' : 'data/meta.json on Vercel' },
  { id: 'pair', title: 'Market files', what: 'data/pairs/<ID>.json, as a market page loads it' },
  { id: 'live', title: 'Live calendar', what: '/api/calendar, the Vercel function behind the Calendar page' },
];

// which checks light up each box in the diagram
const NODE_CHECKS = {
  ff: ['feed', 'live'],
  apify: ['actuals'],
  twelve: ['prices'],
  actions: ['job'],
  files: ['files', 'pair'],
  fn: ['live', 'job'],
  you: ['files', 'pair'],
};

const worst = (states) =>
  states.includes('fail')
    ? 'fail'
    : states.includes('warn')
      ? 'warn'
      : states.includes('run')
        ? 'run'
        : states.some((s) => s === 'ok')
          ? 'ok'
          : states.length
            ? 'off'
            : null;

export function useHealth() {
  const [checks, setChecks] = useState(null);
  const [at, setAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async () => {
    setBusy(true);
    try {
      setChecks(await runChecks());
    } catch (err) {
      // a check that breaks shouldn't take the panel with it
      setChecks(Object.fromEntries(CHECKS.map((c) => [c.id, { state: 'fail', detail: `The check itself failed: ${err.message}` }])));
    } finally {
      setAt(Date.now());
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    run();
  }, [run]);
  // while the job is running, look again every 20 seconds, so the panel shows how it ended
  const running = checks && Object.values(checks).some((c) => c.state === 'run');
  useEffect(() => {
    if (!running || busy) return;
    const t = setTimeout(run, 20 * 1000);
    return () => clearTimeout(t);
  }, [running, busy, run]);
  return { checks, at, busy, run };
}

const STATE_LABEL = { ok: 'Working', run: 'Running', warn: 'Needs attention', fail: 'Failing', off: 'Not available' };

function StateIcon({ state }) {
  if (!state) return <span className="hc-icon is-wait" aria-label="Checking" />;
  // running: a ring that turns, no symbol inside
  if (state === 'run') return <span className="hc-icon is-run" aria-label={STATE_LABEL.run} />;
  return (
    <span className={`hc-icon is-${state}`} aria-label={STATE_LABEL[state]}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        {state === 'ok' ? <path d="m4 8.2 2.6 2.6L12 5.4" /> : state === 'fail' ? <path d="M5 5l6 6M11 5l-6 6" /> : state === 'warn' ? <path d="M8 4.5v4.2M8 11.4v.1" /> : <path d="M4.5 8h7" />}
      </svg>
    </span>
  );
}

/** The sources, the job, Vercel and you, left to right; each box shows the state of its checks. */
export function DataFlow({ checks }) {
  const dot = (id) => {
    const s = checks ? worst(NODE_CHECKS[id].map((c) => checks[c]?.state).filter(Boolean)) : null;
    return <i className={`fl-dot${s ? ` is-${s}` : ' is-wait'}`} aria-label={s ? STATE_LABEL[s] : 'Checking'} />;
  };
  const Node = ({ id, name, sub }) => (
    <div className="fl-node">
      {dot(id)}
      <b>{name}</b>
      <span>{sub}</span>
    </div>
  );
  const Arrow = () => (
    <div className="fl-arrow" aria-hidden="true">
      <svg viewBox="0 0 24 12">
        <path d="M1 6h20M16 1.5 21 6l-5 4.5" />
      </svg>
    </div>
  );
  return (
    <div className="flow" role="img" aria-label="Sources feed the hourly GitHub job, which publishes JSON to Vercel, which your browser reads">
      <div className="fl-col">
        <span className="fl-label">1 · Sources</span>
        <Node id="ff" name="ForexFactory" sub="Weekly calendar: times, forecasts, previous values" />
        <Node id="apify" name="Apify" sub="Released values, from ForexFactory's calendar page" />
        <Node id="twelve" name="Twelve Data" sub="Hourly prices" />
      </div>
      <Arrow />
      <div className="fl-col">
        <span className="fl-label">2 · Hourly job</span>
        <Node id="actions" name="GitHub Actions" sub="Every hour at :07, or when you press Refresh" />
        <div className="fl-note">
          Fetch → fill values → prices → score every market → commit <code>data/</code> → deploy
        </div>
      </div>
      <Arrow />
      <div className="fl-col">
        <span className="fl-label">3 · Vercel</span>
        <Node id="files" name="Static JSON" sub="meta.json, one file per market" />
        <Node id="fn" name="Two functions" sub="/api/calendar (live feed), /api/refresh (starts the job)" />
      </div>
      <Arrow />
      <div className="fl-col">
        <span className="fl-label">4 · Your browser</span>
        <Node id="you" name="This site" sub="Reads the JSON, re-checks every 10 minutes" />
      </div>
    </div>
  );
}

/** Every check, with what it looked at, what came back and how long it took. */
export function LiveStatus({ health }) {
  const { checks, at, busy, run } = health;
  const states = checks ? CHECKS.map((c) => checks[c.id]?.state ?? 'off') : [];
  const failing = states.filter((s) => s === 'fail').length;
  const warning = states.filter((s) => s === 'warn').length;
  const off = states.filter((s) => s === 'off').length;
  const running = states.includes('run');
  const overall = !checks ? null : failing ? 'fail' : warning ? 'warn' : running ? 'run' : 'ok';
  return (
    <div className={`hc${overall ? ` is-${overall}` : ''}`}>
      <div className="hc-head">
        <StateIcon state={overall} />
        <div className="hc-title">
          <b>
            {!checks
              ? 'Checking every step…'
              : failing
                ? `${plural(failing, 'step')} failing`
                : warning
                  ? `${plural(warning, 'step')} need${warning === 1 ? 's' : ''} attention`
                  : running
                    ? 'The hourly job is running now'
                    : off
                    ? `Everything that can run here is working (${CHECKS.length - off} of ${CHECKS.length})`
                    : 'Everything is working'}
          </b>
          <span>
            {at ? `Checked from your browser at ${fmtTime(at)}` : 'Running the checks from your browser'}
            {LOCAL && ' · local dev server'}
          </span>
        </div>
        <button type="button" className="btn" onClick={run} disabled={busy}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className={busy ? 'spin' : ''}>
            <path d="M20 12a8 8 0 1 1-2.34-5.66" />
            <path d="M20 4v5h-5" />
          </svg>
          {busy ? 'Checking…' : 'Check again'}
        </button>
      </div>
      {LOCAL && (
        <div className="hc-note">
          You're on the dev server, so these checks read your local copy. A local run of the job has no API keys (they live
          in GitHub Secrets) and the dev server doesn't serve <code>/api/refresh</code>, so those steps can't pass here. The
          deployed site checks the real hourly job.
        </div>
      )}
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
