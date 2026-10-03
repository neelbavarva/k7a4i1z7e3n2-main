import { fmtDay, signed } from '../format.js';
import { isFx } from '../markets.js';

const HOUR = 3.6e6;
const NEUTRAL = 15;
const TIERS = [
  { key: 'Weak', from: 15, to: 40 },
  { key: 'Moderate', from: 40, to: 70 },
  { key: 'Strong', from: 70, to: 100 },
];
const sideClass = (s) => (s >= NEUTRAL ? 'up' : s <= -NEUTRAL ? 'down' : 'flat');
const leanWord = (s) => (s >= NEUTRAL ? 'bullish' : s <= -NEUTRAL ? 'bearish' : 'neutral');

/** How big the surprise risk ahead is, from the widest point of the grey range. */
function riskAhead(data) {
  const future = data.series.filter((p) => p.proj);
  if (!future.length) return null;
  const peak = future.reduce((m, p) => (p.hi - p.lo > m.hi - m.lo ? p : m), future[0]);
  const half = (peak.hi - peak.lo) / 2;
  const level = half >= 35 ? 'High' : half >= 20 ? 'Medium' : 'Low';
  const events = data.events
    .filter((e) => e.impact === 'High' && Math.abs(Date.parse(e.t) - peak.t) <= 6 * HOUR)
    .slice(0, 2);
  return { level, half, t: peak.t, events };
}

/**
 * Bias checker: one fundamental bias for the coming week, combining news already out with
 * forecasts for what's scheduled, with its strength and what it's made of.
 */
export default function BiasCheck({ data }) {
  const c = data.summary.check;
  if (!c) return null;
  const { pair, summary } = data;
  const fx = isFx(pair);
  const side = sideClass(c.score);
  const dir = c.score >= NEUTRAL ? 1 : c.score <= -NEUTRAL ? -1 : 0;

  const name = fx ? pair.symbol : pair.name;
  const verdict = dir > 0 ? `Favours buying ${name}` : dir < 0 ? `Favours selling ${name}` : 'No clear bias';
  const sub = fx
    ? dir > 0
      ? `${pair.base} fundamentals stronger than ${pair.quote}`
      : dir < 0
        ? `${pair.quote} fundamentals stronger than ${pair.base}`
        : `${pair.base} and ${pair.quote} fundamentals roughly balanced`
    : dir
      ? `Fundamentals ${dir > 0 ? 'supportive' : 'unfavourable'} for ${pair.name.toLowerCase()}`
      : 'Fundamentals balanced this week';

  // upcoming releases in the window, and which way their forecasts lean
  const end = data.series.at(-1).t;
  const upcoming = data.events.filter(
    (e) => Date.parse(e.t) > data.now && Date.parse(e.t) <= end && e.ec != null && Math.abs(e.ec) >= 0.05,
  );
  const withBias = dir ? upcoming.filter((e) => Math.sign(e.ec) === dir).length : 0;
  const risk = riskAhead(data);

  const now = summary.score;
  const later = summary.path?.score ?? now;
  const agrees = (s) => (dir === 0 ? Math.abs(s) < NEUTRAL : Math.sign(s) === dir && Math.abs(s) >= NEUTRAL);
  const pastPct = c.share == null ? null : Math.round(c.share * 100);

  const checks = [
    {
      ok: agrees(now),
      label: 'Now',
      text: (
        <>
          <b className={sideClass(now)}>{signed(now)}</b>, {leanWord(now)}
        </>
      ),
    },
    {
      ok: agrees(later),
      label: 'In 7 days',
      text: (
        <>
          <b className={sideClass(later)}>{signed(later)}</b>, {leanWord(later)} if releases match forecasts
        </>
      ),
    },
    dir !== 0 && {
      ok: c.agree >= 0.75,
      warn: c.agree >= 0.4 && c.agree < 0.75,
      label: 'Through the week',
      text: (
        <>
          leans {dir > 0 ? 'bullish' : 'bearish'} {Math.round(c.agree * 100)}% of the time (range {signed(c.min)} to{' '}
          {signed(c.max)})
        </>
      ),
    },
    dir !== 0 &&
      upcoming.length > 0 && {
        ok: withBias >= upcoming.length / 2,
        warn: withBias < upcoming.length / 2 && withBias > 0,
        label: 'Upcoming forecasts',
        text: (
          <>
            {withBias} of {upcoming.length} lean {dir > 0 ? 'bullish' : 'bearish'}
          </>
        ),
      },
    risk && {
      ok: risk.level === 'Low',
      warn: risk.level !== 'Low',
      label: 'Surprise risk',
      text: (
        <>
          {risk.level}
          {risk.level !== 'Low' && (
            <>
              , peaking {fmtDay(risk.t)}
              {risk.events.length > 0 && ` (${risk.events.map((e) => `${e.ccy} ${e.title}`).join(', ')})`}: a surprise
              could move the score ±{Math.round(risk.half)}
            </>
          )}
        </>
      ),
    },
  ].filter(Boolean);

  const tier = TIERS.find((t) => c.strength >= t.from && c.strength < t.to) ?? (c.strength >= 70 ? TIERS[2] : null);

  return (
    <section className="biascheck" aria-labelledby="bc-title">
      <div className="bc-head">
        <h2 id="bc-title">Bias checker</h2>
        <span className="muted small">Released news plus forecasts for the next 7 days</span>
      </div>

      <div className="bc-grid">
        <div className="bc-verdict">
          <p className={`bc-call ${side}`}>
            <span className="bc-arrow" aria-hidden="true">
              {dir > 0 ? '▲' : dir < 0 ? '▼' : '◆'}
            </span>
            {verdict}
          </p>
          <p className="bc-sub">{sub}</p>

          <div className="bc-strength">
            <div className="bc-strength-top">
              <span>Strength</span>
              <span>
                <b className={side}>{c.strength}</b>
                <span className="muted">/100</span> · {tier ? tier.key : 'None'}
              </span>
            </div>
            <div className="bc-meter" role="img" aria-label={`Strength ${c.strength} out of 100, ${tier ? tier.key : 'none'}`}>
              <span className={`bc-fill ${side}`} style={{ width: `${Math.min(100, c.strength)}%` }} />
              {TIERS.map((t) => (
                <span key={t.key} className="bc-tick" style={{ left: `${t.from}%` }} />
              ))}
            </div>
            <div className="bc-scale" aria-hidden="true">
              <span style={{ left: '0%' }}>None</span>
              {TIERS.map((t) => (
                <span key={t.key} style={{ left: `${t.from}%` }} className={tier?.key === t.key ? 'on' : ''}>
                  {t.key}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="bc-weights">
          <h3>What it's built from</h3>
          {pastPct != null ? (
            <>
              <div className="bc-split" aria-hidden="true">
                <span className={`bc-split-past ${c.past > 0 ? 'up' : c.past < 0 ? 'down' : 'flat'}`} style={{ width: `${pastPct}%` }} />
                <span className={`bc-split-up ${c.up > 0 ? 'up' : c.up < 0 ? 'down' : 'flat'}`} style={{ width: `${100 - pastPct}%` }} />
              </div>
              <dl className="bc-parts">
                <div>
                  <dt>
                    <i className="bc-dot solid" aria-hidden="true" />
                    Released news
                  </dt>
                  <dd>
                    <b className={c.past > 0 ? 'up' : c.past < 0 ? 'down' : 'flat'}>{signed(c.past)}</b> <span className="muted">· {pastPct}% of the weight</span>
                  </dd>
                </div>
                <div>
                  <dt>
                    <i className="bc-dot hatch" aria-hidden="true" />
                    Upcoming forecasts
                  </dt>
                  <dd>
                    <b className={c.up > 0 ? 'up' : c.up < 0 ? 'down' : 'flat'}>{signed(c.up)}</b>{' '}
                    <span className="muted">· {100 - pastPct}% of the weight</span>
                  </dd>
                </div>
              </dl>
              {Math.sign(c.past) !== Math.sign(c.up) && Math.abs(c.past) >= 5 && Math.abs(c.up) >= 5 && (
                <p className="bc-note">
                  Released news and upcoming forecasts point opposite ways, so this bias is weaker than either side alone.
                </p>
              )}
            </>
          ) : (
            <p className="muted small">No scored news in this window yet.</p>
          )}
        </div>
      </div>

      <ul className="bc-checks">
        {checks.map((k) => {
          // with no clear bias there is nothing to support or contradict: just show the facts
          const kind = dir === 0 && k.label !== 'Surprise risk' ? 'info' : k.ok ? 'ok' : k.warn ? 'warn' : 'no';
          return (
          <li key={k.label} className={kind}>
            <span className="bc-icon" aria-label={{ ok: 'Supports', warn: 'Caution', no: 'Against', info: 'Info' }[kind]}>
              {{ ok: '✓', warn: '!', no: '✕', info: '·' }[kind]}
            </span>
            <span className="bc-label">{k.label}</span>
            <span className="bc-text">{k.text}</span>
          </li>
          );
        })}
      </ul>

      <p className="bc-foot muted small">
        Fundamentals only. Use it to check whether your technical setup has the fundamentals behind it, not as a signal on its
        own.
      </p>
    </section>
  );
}
