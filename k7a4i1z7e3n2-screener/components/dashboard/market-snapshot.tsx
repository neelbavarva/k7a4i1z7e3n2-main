'use client';

import type { EconomicRecord } from '@/types/economics';
import { compactCurrency, delta } from '@/lib/formatting/numbers';
import { colorFor } from '@/lib/markets';
import { BUFFETT_BAND, BUFFETT_IN_LINE_PTS, GAUGE_MAX_PCT } from '@/lib/model';
import { MarketIcon } from '@/components/ui/market-icon';
import { CloseIcon } from '@/components/ui/icons';

type Market = { country: string; name: string; records: EconomicRecord[] };

const side = (v: number | null, dead = 0) => (v === null ? 'flat' : v > dead ? 'up' : v < -dead ? 'down' : 'flat');
const signedPct = (v: number | null, digits = 1) => (v === null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}%`);
const pct = (v: number | null, digits = 0) => (v === null || !Number.isFinite(v) ? '—' : `${v.toFixed(digits)}%`);

/** Latest year inside the range with a GDP value, plus the year before it. */
export function snapshot(market: Market, rangeStart: number, rangeEnd: number) {
  const inRange = market.records.filter(r => r.year >= rangeStart && r.year <= rangeEnd);
  const current = [...inRange].reverse().find(r => r.gdp !== null) ?? inRange.at(-1);
  const previous = current ? market.records.find(r => r.year === current.year - 1) : undefined;
  const buffettLatest = [...inRange].reverse().find(r => r.buffettIndicator !== null) ?? null;
  const decade = buffettLatest
    ? market.records.filter(r => r.year > buffettLatest.year - BUFFETT_BAND.windowYears && r.year <= buffettLatest.year && r.buffettIndicator !== null)
    : [];
  const buffettAvg = decade.length ? decade.reduce((s, r) => s + (r.buffettIndicator as number), 0) / decade.length : null;
  const growth = inRange.filter(r => r.gdpGrowth !== null);
  const growthAvg = growth.length ? growth.reduce((s, r) => s + (r.gdpGrowth as number), 0) / growth.length : null;
  return { current, previous, buffettLatest, buffettAvg, growthAvg, growthYears: growth.length };
}

/* ─── Brief: four facts for the focused market, like the FX pair page ─── */
export function Brief({ market, rangeStart, rangeEnd, multiple }: { market: Market; rangeStart: number; rangeEnd: number; multiple: boolean }) {
  const s = snapshot(market, rangeStart, rangeEnd);
  const c = s.current;
  if (!c) {
    return <p className="brief-note">No annual observations for {market.name} in {rangeStart}–{rangeEnd}.</p>;
  }
  const gdpChg = delta(c.gdp, s.previous?.gdp ?? null);
  const capChg = delta(c.marketCap, s.previous?.marketCap ?? null);
  const b = s.buffettLatest?.buffettIndicator ?? null;
  const vsAvg = b !== null && s.buffettAvg !== null ? b - s.buffettAvg : null;

  return (
    <>
      <dl className="brief" aria-label={`Latest figures for ${market.name}`}>
        <div className="brief-cell">
          <dt>
            {multiple && <MarketIcon code={market.country} size={14} />}
            GDP · {c.year}
          </dt>
          <dd className="brief-num">{compactCurrency(c.gdp)}</dd>
          <dd className="brief-sub">
            <span className={side(gdpChg)}>{signedPct(gdpChg)}</span> on {c.year - 1}, nominal US$
          </dd>
        </div>
        <div className="brief-cell">
          <dt>Stock market value</dt>
          <dd className="brief-num">{compactCurrency(c.marketCap)}</dd>
          <dd className="brief-sub">
            {c.marketCap === null ? 'Not reported for this year' : <><span className={side(capChg)}>{signedPct(capChg)}</span> on {c.year - 1}, listed companies</>}
          </dd>
        </div>
        <div className="brief-cell">
          <dt>Buffett indicator{s.buffettLatest && s.buffettLatest.year !== c.year ? ` · ${s.buffettLatest.year}` : ''}</dt>
          <dd className="brief-num">{pct(b)}</dd>
          <dd className="brief-sub">
            {vsAvg === null
              ? 'Market value ÷ GDP'
              : `${Math.abs(vsAvg) < BUFFETT_IN_LINE_PTS ? 'In line with' : vsAvg > 0 ? `${Math.abs(vsAvg).toFixed(0)} pts above` : `${Math.abs(vsAvg).toFixed(0)} pts below`} its 10-year average (${s.buffettAvg!.toFixed(0)}%)`}
          </dd>
        </div>
        <div className="brief-cell">
          <dt>Real GDP growth</dt>
          <dd className={`brief-num ${side(c.gdpGrowth, 0.05)}`}>{signedPct(c.gdpGrowth)}</dd>
          <dd className="brief-sub">
            {s.growthAvg === null ? 'Annual, constant prices' : `Averaged ${signedPct(s.growthAvg)} over ${s.growthYears} year${s.growthYears === 1 ? '' : 's'}`}
          </dd>
        </div>
      </dl>
    </>
  );
}

/* ─── Mini gauge: Buffett indicator on a 0–200% track, 100% in the middle ─── */
function Gauge({ value, avg }: { value: number | null; avg: number | null }) {
  if (value === null) return <div className="mini" aria-hidden="true" />;
  const pos = (v: number) => Math.min(100, Math.max(0, (v / GAUGE_MAX_PCT) * 100));
  const at = pos(value);
  const dir = value > GAUGE_MAX_PCT / 2 ? 'up' : value < GAUGE_MAX_PCT / 2 ? 'down' : '';
  return (
    <div className="mini" aria-hidden="true">
      <span className="mini-mid" />
      <span className={`mini-pull ${dir}`} style={{ left: `${Math.min(50, at)}%`, width: `${Math.abs(at - 50)}%` }} />
      {avg !== null && <span className="mini-avg" style={{ left: `${pos(avg)}%` }} />}
      <span className={`mini-knot ${dir}`} style={{ left: `${at}%` }} />
    </div>
  );
}

/* ─── Rows: every selected market, the FX overview table pattern ─── */
export function MarketRows({
  markets,
  rangeStart,
  rangeEnd,
  focus,
  onFocus,
  onRemove,
}: {
  markets: Market[];
  rangeStart: number;
  rangeEnd: number;
  focus: string;
  onFocus: (code: string) => void;
  onRemove: (code: string) => void;
}) {
  const multiple = markets.length > 1;
  return (
    <section className="section" aria-labelledby="rows-title">
      <h2 id="rows-title" className="group-title">
        {multiple ? 'Compared markets' : 'Market'} <span className="count">{markets.length}</span>
      </h2>
      <div className="rows-card">
        <div className="row-headings" aria-hidden="true">
          <span>Market</span>
          <span>Buffett vs 100%</span>
          <span className="r">Buffett</span>
          <span className="r">GDP</span>
          <span className="r">Market value</span>
          <span className="r">Growth</span>
          <span />
        </div>
        <ul className="rows">
          {markets.map((market, index) => {
            const s = snapshot(market, rangeStart, rangeEnd);
            const c = s.current;
            const b = s.buffettLatest?.buffettIndicator ?? null;
            const isFocus = market.country === focus;
            return (
              <li
                key={market.country}
                className="row fade-in"
                style={{ cursor: multiple ? 'pointer' : undefined, background: isFocus && multiple ? 'var(--raised)' : undefined, animationDelay: `${index * 30}ms` }}
                onClick={() => onFocus(market.country)}
                aria-current={isFocus && multiple ? 'true' : undefined}
              >
                <span className="row-sym">
                  <MarketIcon code={market.country} size={24} ring={isFocus && multiple ? colorFor(market.country, index) : undefined} />
                  <span className="row-sym-text">
                    {market.name}
                    <span className="row-name">
                      <i className="dot" style={{ backgroundColor: colorFor(market.country, index), width: 7, height: 7, marginRight: 6 }} />
                      {c ? `Latest ${c.year}` : 'No data in range'}
                    </span>
                  </span>
                </span>
                <Gauge value={b} avg={s.buffettAvg} />
                <span className="r row-val" data-label="Buffett">
                  {pct(b)}
                </span>
                <span className="r" data-label="GDP">
                  <span className="row-val">{compactCurrency(c?.gdp ?? null)}</span>
                  <Change v={delta(c?.gdp ?? null, s.previous?.gdp ?? null)} />
                </span>
                <span className="r" data-label="Market value">
                  <span className="row-val">{compactCurrency(c?.marketCap ?? null)}</span>
                  <Change v={delta(c?.marketCap ?? null, s.previous?.marketCap ?? null)} />
                </span>
                <span className={`r row-val ${side(c?.gdpGrowth ?? null, 0.05)}`} data-label="Growth">
                  {signedPct(c?.gdpGrowth ?? null)}
                </span>
                <span>
                  {multiple && (
                    <button
                      type="button"
                      className="row-remove"
                      onClick={e => { e.stopPropagation(); onRemove(market.country); }}
                      aria-label={`Remove ${market.name}`}
                      title={`Remove ${market.name}`}
                    >
                      <CloseIcon />
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="brief-note muted">
        The gauge places each market’s market value ÷ GDP on a 0–{GAUGE_MAX_PCT}% track; the ring is its own {BUFFETT_BAND.windowYears}-year average. Changes are on the previous year.
      </p>
    </section>
  );
}

function Change({ v }: { v: number | null }) {
  return <span className={`row-chg ${side(v)}`}>{v === null ? '—' : `${signedPct(v)} y/y`}</span>;
}
