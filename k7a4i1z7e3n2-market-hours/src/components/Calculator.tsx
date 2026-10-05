import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { readStorage, writeStorage } from '../hooks';
import { ACCOUNT_CURRENCIES, CURRENCY_NAME, INSTRUMENTS, decimals, findInstrument, pairLabel, searchInstruments, unitName } from '../instruments';
import type { Instrument } from '../instruments';
import { formatWhen } from '../marketTime';
import { parseNum, sizePosition } from '../positionSize';
import type { Sizing } from '../positionSize';
import { convert, priceOf, useRates } from '../rates';
import type { RateTable } from '../rates';
import { SiteNav, isMac } from './common';
import Dropdown from './Dropdown';
import type { DropdownOption } from './Dropdown';
import { currencySymbol, formatMoney, formatNumber, formatPercent, formatPrice, formatRate } from './format';

// ---------------------------------------------------------------------------
// Settings, remembered between visits
// ---------------------------------------------------------------------------

const KEY = 'tj-mh-ps';

interface Settings {
  symbol: string;
  account: string;
  balance: string;
  riskMode: 'percent' | 'money';
  risk: string;
  stopMode: 'pips' | 'price';
  stopPips: string;
  entry: string;
  stop: string;
  lotStep: string;
  leverage: string;
  /** contract changes per instrument (units in a lot, the pip), as typed */
  contract: Record<string, { lot?: string; pip?: string }>;
}

const DEFAULTS: Settings = {
  symbol: 'EURUSD',
  account: 'USD',
  balance: '10,000',
  riskMode: 'percent',
  risk: '1',
  stopMode: 'pips',
  stopPips: '20',
  entry: '',
  stop: '',
  lotStep: '0.01',
  leverage: '100',
  contract: {},
};

const TEXT_FIELDS = ['balance', 'risk', 'stopPips', 'entry', 'stop', 'lotStep', 'leverage'] as const;

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(readStorage(KEY) || '{}') as Partial<Settings>;
    const s: Settings = { ...DEFAULTS, ...saved, contract: { ...(saved.contract ?? {}) } };
    if (!findInstrument(s.symbol)) s.symbol = DEFAULTS.symbol;
    if (!ACCOUNT_CURRENCIES.includes(s.account)) s.account = DEFAULTS.account;
    if (s.riskMode !== 'money') s.riskMode = 'percent';
    if (s.stopMode !== 'price') s.stopMode = 'pips';
    for (const k of TEXT_FIELDS) if (typeof s[k] !== 'string') s[k] = DEFAULTS[k];
    return s;
  } catch {
    return DEFAULTS;
  }
}

function useCalcSettings() {
  const [s, setS] = useState<Settings>(loadSettings);
  useEffect(() => writeStorage(KEY, JSON.stringify(s)), [s]);
  const set = (patch: Partial<Settings>) => setS((prev) => ({ ...prev, ...patch }));
  return [s, set] as const;
}

const positive = (n: number | null) => (n !== null && n > 0 ? n : null);
/** A number as it should sit in an input: no grouping, at most `dp` decimals. */
const plain = (v: number, dp: number) => String(Number(v.toFixed(dp)));

const CURRENCY_OPTIONS: DropdownOption[] = ACCOUNT_CURRENCIES.map((c) => ({ value: c, label: c, sub: CURRENCY_NAME[c] }));

const RISK_PRESETS = [0.5, 1, 2];
const RISK_LEVELS = [0.25, 0.5, 1, 1.5, 2, 3, 5];
const TARGETS = [1, 2, 3];

// ---------------------------------------------------------------------------

type RateSource = 'live' | 'daily' | 'manual';

function freshness(source: RateSource, table: RateTable, nowMs: number, timezone: string, is24Hour: boolean): string {
  if (source === 'manual') return 'your rate';
  if (source === 'daily') {
    const d = table.dailyDate ? new Date(`${table.dailyDate}T12:00:00Z`) : null;
    return d ? `daily rate, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}` : 'daily rate';
  }
  return nowMs - table.liveAt < 5 * 60_000 ? 'live' : `as of ${formatWhen(table.liveAt, nowMs, timezone, is24Hour)}`;
}

/** "1 USD = 157.74 JPY", whichever way round reads as a number above one. */
function rateText(from: string, to: string, value: number): string {
  return value >= 1 ? `1 ${from} = ${formatRate(value)} ${to}` : `1 ${to} = ${formatRate(1 / value)} ${from}`;
}

interface Props {
  nowMs: number;
  timezone: string;
  is24Hour: boolean;
}

export default function Calculator({ nowMs, timezone, is24Hour }: Props) {
  const [s, set] = useCalcSettings();
  const { table, loading, failed } = useRates(true);
  const [pairOpen, setPairOpen] = useState(false);
  const [manualRate, setManualRate] = useState('');
  const inst = findInstrument(s.symbol)!;

  // "/" or Cmd/Ctrl+K opens the pair list
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPairOpen((v) => !v);
      } else if (e.key === '/' && !typing && !pairOpen) {
        e.preventDefault();
        setPairOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pairOpen]);

  // every pair with its price, and the search that finds them ("eurusd", "eur/usd", "jpy", "gold")
  const pairOptions = useMemo(() => {
    const map = new Map<string, DropdownOption>();
    for (const i of INSTRUMENTS) {
      const p = priceOf(table, i);
      map.set(i.symbol, { value: i.symbol, label: i.symbol, sub: i.name, group: i.group, aside: p ? formatPrice(p.value, i.digits) : undefined });
    }
    return { list: [...map.values()], search: (q: string) => searchInstruments(q).map((i) => map.get(i.symbol)!) };
  }, [table]);

  // the contract: this instrument's, unless changed here
  const custom = s.contract[inst.symbol] ?? {};
  const pip = positive(parseNum(custom.pip)) ?? inst.pip;
  const lot = positive(parseNum(custom.lot)) ?? inst.lot;
  const lotStep = positive(parseNum(s.lotStep)) ?? 0.01;
  const leverage = positive(parseNum(s.leverage));
  const lotDp = decimals(lotStep);

  // rates: the price, and what one unit of the quote currency is worth in the account's
  const price = priceOf(table, inst);
  const conv = convert(table, inst.quote, s.account);
  const manual = conv ? null : positive(parseNum(manualRate));
  const rate = conv ? { value: conv.value, source: conv.source as RateSource } : manual ? { value: manual, source: 'manual' as const } : null;
  const priceFresh = price ? freshness(price.source, table, nowMs, timezone, is24Hour) : '';
  const priceTag = price ? (
    <>
      {formatPrice(price.value, inst.digits)}
      <span className={`rate-tag${priceFresh === 'live' ? ' is-live' : ''}`}> · {priceFresh}</span>
    </>
  ) : loading ? (
    <span className="rate-tag">getting prices…</span>
  ) : null;

  // the trade
  const balance = positive(parseNum(s.balance));
  const risk = positive(parseNum(s.risk));
  const byPrice = s.stopMode === 'price';
  const entry = positive(parseNum(s.entry));
  const stop = positive(parseNum(s.stop));
  const stopPips = byPrice ? (entry && stop ? Math.abs(entry - stop) / pip : null) : positive(parseNum(s.stopPips));
  const side = byPrice && entry && stop && entry !== stop ? (stop < entry ? 'long' : 'short') : null;
  const riskAmount = balance && risk ? (s.riskMode === 'percent' ? (balance * risk) / 100 : risk) : null;

  let problem: string | null = null;
  if (!balance) problem = 'Enter your account balance.';
  else if (!risk) problem = 'Enter how much to risk on the trade.';
  else if (s.riskMode === 'percent' && risk > 100) problem = 'Risk can’t be more than the whole account (100%).';
  else if (s.riskMode === 'money' && risk > balance) problem = 'That’s more than the whole account.';
  else if (byPrice && (!entry || !stop)) problem = 'Enter an entry price and a stop price.';
  else if (byPrice && entry === stop) problem = 'The stop can’t be at the entry price.';
  else if (!stopPips) problem = 'Enter a stop loss in pips.';
  const needsRate = !problem && !rate;

  const sizeAt = (riskMode: Settings['riskMode'], riskValue: number): Sizing | null =>
    !problem && rate && balance && stopPips
      ? sizePosition({
          balance,
          riskMode,
          risk: riskValue,
          stopPips,
          pip,
          lot,
          lotStep,
          quoteToAccount: rate.value,
          price: (byPrice ? entry : null) ?? price?.value ?? null,
          leverage,
        })
      : null;
  const sizing = risk ? sizeAt(s.riskMode, risk) : null;

  const money = (v: number) => formatMoney(v, s.account);

  const switchRisk = (mode: Settings['riskMode']) => {
    if (mode === s.riskMode) return;
    if (!balance || !risk) return set({ riskMode: mode });
    set({ riskMode: mode, risk: mode === 'money' ? plain((balance * risk) / 100, 2) : plain((risk / balance) * 100, 2) });
  };

  // switching keeps the same trade: pips become an entry and stop (long, unless it was short), and back
  const switchStop = (mode: Settings['stopMode']) => {
    if (mode === s.stopMode) return;
    if (mode === 'pips') return set({ stopMode: 'pips', ...(stopPips ? { stopPips: plain(stopPips, 1) } : {}) });
    const from = entry ?? price?.value;
    const pips = stopPips ?? 20;
    if (!from) return set({ stopMode: 'price' });
    const dir = side === 'short' ? 1 : -1;
    set({ stopMode: 'price', entry: plain(from, inst.digits), stop: plain(from + dir * pips * pip, inst.digits) });
  };

  const pickInstrument = (symbol: string) => {
    if (symbol === s.symbol) return;
    const next = findInstrument(symbol)!;
    const p = priceOf(table, next);
    setManualRate('');
    set({ symbol, entry: byPrice && p ? plain(p.value, next.digits) : '', stop: '' });
  };

  const setContract = (field: 'lot' | 'pip', value: string) => {
    const all = { ...s.contract };
    const mine = { ...all[inst.symbol], [field]: value };
    if (parseNum(value) === inst[field]) delete mine[field];
    if (mine.lot === undefined && mine.pip === undefined) delete all[inst.symbol];
    else all[inst.symbol] = mine;
    set({ contract: all });
  };
  // an empty or unusable contract field goes back to the instrument's own value
  const settleContract = (field: 'lot' | 'pip') => {
    if (custom[field] !== undefined && !positive(parseNum(custom[field]))) setContract(field, String(inst[field]));
  };
  const customised = custom.lot !== undefined || custom.pip !== undefined;
  const resetContract = () => {
    const all = { ...s.contract };
    delete all[inst.symbol];
    set({ contract: all });
  };

  const fx = inst.group !== 'Metals' && inst.group !== 'Crypto';
  const units = unitName(inst);
  const sym = currencySymbol(s.account);

  return (
    <main className="fade-in">
      <section className="overview" aria-labelledby="page-title">
        <div className="overview-row">
          <h1 id="page-title" className="overview-title">
            Position size calculator
          </h1>
          <SiteNav current="size" />
        </div>
      </section>

      <section className="calc" aria-label="Position size">
        <form className="calc-form" onSubmit={(e) => e.preventDefault()} noValidate>
          <div className="calc-fields">
            <div className="field field-wide">
              <div className="field-top">
                <span className="field-label" id="ps-pair-label">
                  Currency pair
                </span>
                <kbd className="field-key" aria-hidden="true">
                  {isMac ? '⌘K' : '/'}
                </kbd>
              </div>
              <Dropdown
                labelId="ps-pair-label"
                value={s.symbol}
                options={pairOptions.list}
                search={pairOptions.search}
                onChange={pickInstrument}
                placeholder="Search EURUSD, jpy, gold…"
                aside={priceTag}
                open={pairOpen}
                onOpenChange={setPairOpen}
              />
            </div>

            <div className="field">
              <span className="field-label" id="ps-account-label">
                Account currency
              </span>
              <Dropdown
                labelId="ps-account-label"
                value={s.account}
                options={CURRENCY_OPTIONS}
                onChange={(account) => {
                  setManualRate('');
                  set({ account });
                }}
                placeholder="Search USD, euro, rupee…"
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="ps-balance">
                Account balance
              </label>
              <div className="input-wrap">
                <span className="input-pre">{sym}</span>
                <input id="ps-balance" inputMode="decimal" autoComplete="off" value={s.balance} onChange={(e) => set({ balance: e.target.value })} />
              </div>
            </div>

            <div className="field field-wide">
              <div className="field-top">
                <label className="field-label" htmlFor="ps-risk">
                  Risk on this trade
                </label>
                <div className="seg seg-mini" role="group" aria-label="Risk as">
                  <button type="button" aria-pressed={s.riskMode === 'percent'} onClick={() => switchRisk('percent')}>
                    % of balance
                  </button>
                  <button type="button" aria-pressed={s.riskMode === 'money'} onClick={() => switchRisk('money')}>
                    {s.account}
                  </button>
                </div>
              </div>
              <div className="input-wrap">
                {s.riskMode === 'money' && <span className="input-pre">{sym}</span>}
                <input id="ps-risk" inputMode="decimal" autoComplete="off" value={s.risk} onChange={(e) => set({ risk: e.target.value })} />
                {s.riskMode === 'percent' && <span className="input-post">%</span>}
              </div>
              <div className="field-foot">
                {s.riskMode === 'percent' && (
                  <span className="chips" role="group" aria-label="Common risks">
                    {RISK_PRESETS.map((p) => (
                      <button key={p} type="button" className="chip" aria-pressed={risk === p} onClick={() => set({ risk: String(p) })}>
                        {p}%
                      </button>
                    ))}
                  </span>
                )}
                {riskAmount !== null && balance && (
                  <span className="field-note">
                    {s.riskMode === 'percent' ? `= ${money(riskAmount)}` : `= ${formatPercent((riskAmount / balance) * 100)} of the balance`}
                  </span>
                )}
              </div>
            </div>

            <div className="field field-wide">
              <div className="field-top">
                {byPrice ? (
                  <span className="field-label">Stop loss</span>
                ) : (
                  <label className="field-label" htmlFor="ps-stop-pips">
                    Stop loss
                  </label>
                )}
                <div className="seg seg-mini" role="group" aria-label="Stop loss as">
                  <button type="button" aria-pressed={!byPrice} onClick={() => switchStop('pips')}>
                    Pips
                  </button>
                  <button type="button" aria-pressed={byPrice} onClick={() => switchStop('price')}>
                    Entry and stop
                  </button>
                </div>
              </div>
              {byPrice ? (
                <div className="input-pair">
                  <div className="input-wrap">
                    <span className="input-pre">Entry</span>
                    <input id="ps-entry" aria-label="Entry price" inputMode="decimal" autoComplete="off" value={s.entry} onChange={(e) => set({ entry: e.target.value })} />
                  </div>
                  <div className="input-wrap">
                    <span className="input-pre">Stop</span>
                    <input id="ps-stop" aria-label="Stop price" inputMode="decimal" autoComplete="off" value={s.stop} onChange={(e) => set({ stop: e.target.value })} />
                  </div>
                </div>
              ) : (
                <div className="input-wrap">
                  <input id="ps-stop-pips" inputMode="decimal" autoComplete="off" value={s.stopPips} onChange={(e) => set({ stopPips: e.target.value })} />
                  <span className="input-post">pips</span>
                </div>
              )}
              <div className="field-foot">
                <span className="field-note">
                  {byPrice
                    ? side && stopPips
                      ? `${side === 'long' ? 'Long' : 'Short'}: the stop is ${formatNumber(stopPips, 1)} pips ${side === 'long' ? 'below' : 'above'} the entry`
                      : `1 pip = ${formatNumber(pip, 10)}`
                    : `1 pip = ${formatNumber(pip, 10)}${stopPips ? `, so the stop is ${formatPrice(stopPips * pip, inst.digits)} from the entry` : ''}`}
                </span>
                {byPrice && price && (
                  <button type="button" className="link-btn" onClick={() => set({ entry: plain(price.value, inst.digits) })}>
                    Entry at {formatPrice(price.value, inst.digits)}
                  </button>
                )}
              </div>
            </div>
          </div>

          <details className="calc-more">
            <summary>
              <span className="calc-more-title">Contract</span>
              <span className="calc-more-sum">
                1 lot = {formatNumber(lot, 4)} {units} · 1 pip = {formatNumber(pip, 10)} · steps of {formatNumber(lotStep, 6)} lots
                {leverage ? ` · 1:${formatNumber(leverage, 2)}` : ''}
              </span>
            </summary>
            <div className="calc-fields">
              <div className="field">
                <label className="field-label" htmlFor="ps-lot">
                  One lot
                </label>
                <div className="input-wrap">
                  <input
                    id="ps-lot"
                    inputMode="decimal"
                    autoComplete="off"
                    value={custom.lot ?? formatNumber(inst.lot, 4)}
                    onChange={(e) => setContract('lot', e.target.value)}
                    onBlur={() => settleContract('lot')}
                  />
                  <span className="input-post">{units}</span>
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="ps-pip">
                  One pip
                </label>
                <div className="input-wrap">
                  <input
                    id="ps-pip"
                    inputMode="decimal"
                    autoComplete="off"
                    value={custom.pip ?? formatNumber(inst.pip, 10)}
                    onChange={(e) => setContract('pip', e.target.value)}
                    onBlur={() => settleContract('pip')}
                  />
                  <span className="input-post">{inst.quote}</span>
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="ps-step">
                  Lot step
                </label>
                <div className="input-wrap">
                  <input id="ps-step" inputMode="decimal" autoComplete="off" value={s.lotStep} onChange={(e) => set({ lotStep: e.target.value })} />
                  <span className="input-post">lots</span>
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="ps-leverage">
                  Leverage
                </label>
                <div className="input-wrap">
                  <span className="input-pre">1 :</span>
                  <input id="ps-leverage" inputMode="decimal" autoComplete="off" value={s.leverage} onChange={(e) => set({ leverage: e.target.value })} />
                </div>
              </div>
            </div>
            <p className="calc-more-note">
              Brokers differ, above all on gold and crypto: check one lot and one pip against your platform’s contract
              specification.
              {customised && (
                <>
                  {' '}
                  <button type="button" className="link-btn" onClick={resetContract}>
                    Reset {pairLabel(inst)} to {formatNumber(inst.lot, 4)} {units} and {formatNumber(inst.pip, 10)}
                  </button>
                </>
              )}
            </p>
          </details>
        </form>

        <div className="calc-out">
          <p className="calc-kicker">Position size</p>
          <p className={`calc-lots${sizing ? '' : ' is-empty'}`} aria-live="polite">
            <span className="calc-lots-num">{sizing ? formatNumber(sizing.lots, lotDp, lotDp) : '—'}</span>
            <span className="calc-lots-unit">lots</span>
          </p>

          {sizing ? (
            <Result
              sizing={sizing}
              inst={inst}
              units={units}
              fx={fx && lot === 100_000}
              lotStep={lotStep}
              balance={balance!}
              stopPips={stopPips!}
              pip={pip}
              side={side}
              entry={byPrice ? entry : null}
              leverage={leverage}
              money={money}
              rateNote={
                inst.quote !== s.account && rate
                  ? `${rateText(inst.quote, s.account, rate.value)}, ${freshness(rate.source, table, nowMs, timezone, is24Hour)}`
                  : null
              }
            />
          ) : needsRate ? (
            loading || (!failed && !table.liveAt && !table.dailyAt) ? (
              <p className="calc-problem">Getting exchange rates…</p>
            ) : (
              <div className="calc-problem">
                <p>
                  The exchange rates didn’t load, and {pairLabel(inst)} is priced in {inst.quote}. What is 1 {inst.quote} worth in{' '}
                  {s.account}?
                </p>
                <div className="input-wrap">
                  <span className="input-pre">1 {inst.quote} =</span>
                  <input aria-label={`1 ${inst.quote} in ${s.account}`} inputMode="decimal" autoComplete="off" value={manualRate} onChange={(e) => setManualRate(e.target.value)} />
                  <span className="input-post">{s.account}</span>
                </div>
              </div>
            )
          ) : (
            <p className="calc-problem">{problem}</p>
          )}
        </div>
      </section>

      {sizing && riskAmount !== null && rate && (
        <Workings
          inst={inst}
          account={s.account}
          balance={balance!}
          risk={s.riskMode === 'percent' ? risk : null}
          sizing={sizing}
          stopPips={stopPips!}
          pip={pip}
          lot={lot}
          lotStep={lotStep}
          rate={rate.value}
          entry={byPrice ? entry : null}
          stop={byPrice ? stop : null}
        />
      )}

      {sizing && (
        <RiskTable
          rows={RISK_LEVELS.map((level) => ({ level, sizing: sizeAt('percent', level)! }))}
          current={sizing.riskPercent}
          stopPips={stopPips!}
          lotStep={lotStep}
          units={units}
          money={money}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------

type CheckKind = 'ok' | 'warn' | 'no' | 'info';

function Result({
  sizing,
  inst,
  units,
  fx,
  lotStep,
  balance,
  stopPips,
  pip,
  side,
  entry,
  leverage,
  money,
  rateNote,
}: {
  sizing: Sizing;
  inst: Instrument;
  units: string;
  fx: boolean;
  lotStep: number;
  balance: number;
  stopPips: number;
  pip: number;
  side: 'long' | 'short' | null;
  entry: number | null;
  leverage: number | null;
  money: (v: number) => string;
  rateNote: string | null;
}) {
  const lotDp = decimals(lotStep);
  const distance = stopPips * pip;
  const checks: { kind: CheckKind; label: string; text: ReactNode }[] = [];

  const pct = sizing.actualPercent;
  if (sizing.lots === 0) {
    checks.push({
      kind: 'no',
      label: 'Too small',
      text: `the smallest position, ${formatNumber(lotStep, 6)} lots, would risk ${money(sizing.stepRisk)} (${formatPercent((sizing.stepRisk / balance) * 100)}). Risk more, or use a tighter stop.`,
    });
  } else if (pct > 5) {
    checks.push({ kind: 'no', label: 'Risk', text: `${formatPercent(pct)} of the account on one trade. A short losing run would do real damage.` });
  } else if (pct > 2) {
    checks.push({ kind: 'warn', label: 'Risk', text: `${formatPercent(pct)} of the account, more than the usual 1–2% a trade.` });
  } else {
    checks.push({ kind: 'ok', label: 'Risk', text: `${formatPercent(pct)} of the account, within the usual 1–2% a trade.` });
  }
  if (sizing.lots > 0 && sizing.exactLots - sizing.lots > 1e-9) {
    checks.push({
      kind: 'info',
      label: 'Rounded',
      text: `down from ${formatNumber(sizing.exactLots, lotDp + 2)} lots to the ${formatNumber(lotStep, 6)} step, so the risk stays at or under ${money(sizing.riskAmount)}.`,
    });
  }
  if (sizing.margin !== null && sizing.margin > balance) {
    checks.push({ kind: 'no', label: 'Margin', text: `${money(sizing.margin)} at 1:${formatNumber(leverage!, 2)} is more than the balance.` });
  }
  if (rateNote) checks.push({ kind: 'info', label: 'Rate', text: rateNote });

  return (
    <>
      <p className="calc-units">
        {formatNumber(sizing.units, 4)} {units}
        {fx && sizing.lots > 0 && (
          <span className="muted">
            {' '}
            · {formatNumber(sizing.units / 10_000, 2)} mini · {formatNumber(sizing.units / 1_000, 1)} micro lots
          </span>
        )}
      </p>

      <dl className="calc-facts">
        <div>
          <dt>Amount at risk</dt>
          <dd>
            <b>{money(sizing.actualRisk)}</b> <span className="muted">· {formatPercent(sizing.actualPercent)}</span>
          </dd>
        </div>
        <div>
          <dt>Pip value</dt>
          <dd>
            <b>{money(sizing.pipValue)}</b> <span className="muted">· {money(sizing.pipValuePerLot)} a lot</span>
          </dd>
        </div>
        <div>
          <dt>Stop</dt>
          <dd>
            {formatNumber(stopPips, 1)} pips <span className="muted">· {formatPrice(distance, inst.digits)}{side ? `, ${side}` : ''}</span>
          </dd>
        </div>
        {sizing.notional !== null && (
          <div>
            <dt>Position value</dt>
            <dd>{money(sizing.notional)}</dd>
          </div>
        )}
        {sizing.margin !== null && (
          <div>
            <dt>Margin at 1:{formatNumber(leverage!, 2)}</dt>
            <dd>
              {money(sizing.margin)} <span className="muted">· {formatPercent((sizing.margin / balance) * 100)}</span>
            </dd>
          </div>
        )}
      </dl>

      <div className="calc-targets" role="table" aria-label="Targets">
        <div role="row">
          <span role="rowheader" className="muted">
            Targets
          </span>
          {TARGETS.map((k) => (
            <span role="columnheader" key={k}>
              1:{k}
            </span>
          ))}
        </div>
        <div role="row">
          <span role="rowheader" className="muted">
            Profit
          </span>
          {TARGETS.map((k) => (
            <b role="cell" key={k} className="up">
              +{money(sizing.actualRisk * k)}
            </b>
          ))}
        </div>
        {entry && side && (
          <div role="row">
            <span role="rowheader" className="muted">
              Price
            </span>
            {TARGETS.map((k) => (
              <span role="cell" key={k}>
                {formatPrice(entry + (side === 'long' ? 1 : -1) * k * distance, inst.digits)}
              </span>
            ))}
          </div>
        )}
      </div>

      <ul className="bc-checks calc-checks">
        {checks.map((k) => (
          <li key={k.label} className={k.kind}>
            <span className="bc-icon" aria-label={{ ok: 'Good', warn: 'Caution', no: 'Problem', info: 'Info' }[k.kind]}>
              {{ ok: '✓', warn: '!', no: '✕', info: 'i' }[k.kind]}
            </span>
            <span className="bc-label">{k.label}</span>
            <span className="bc-text">{k.text}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------

/** The sum with the reader's own numbers, then what's worth knowing about the inputs. */
function Workings({
  inst,
  account,
  balance,
  risk,
  sizing,
  stopPips,
  pip,
  lot,
  lotStep,
  rate,
  entry,
  stop,
}: {
  inst: Instrument;
  account: string;
  balance: number;
  /** the percentage, or null when the risk was typed as an amount */
  risk: number | null;
  sizing: Sizing;
  stopPips: number;
  pip: number;
  lot: number;
  lotStep: number;
  rate: number;
  entry: number | null;
  stop: number | null;
}) {
  const n2 = (v: number) => formatNumber(v, 2, 2);
  const lotDp = decimals(lotStep);
  const perLotQuote = pip * lot;
  const same = inst.quote === account;
  return (
    <section className="chart-block workings" aria-labelledby="wk-title">
      <div className="chart-head">
        <div>
          <h2 id="wk-title">How it’s worked out</h2>
          <p>The amount you’re willing to lose, divided by what the stop costs on one lot. Here it is with your numbers.</p>
        </div>
      </div>
      <div className="formula">
        {entry !== null && stop !== null && (
          <>
            stop&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= |{formatPrice(entry, inst.digits)} − {formatPrice(stop, inst.digits)}| ÷ {formatNumber(pip, 10)} ={' '}
            {formatNumber(stopPips, 1)} pips
            <br />
          </>
        )}
        risk&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;={' '}
        {risk !== null ? `${formatNumber(balance, 2)} × ${formatNumber(risk, 4)}% = ` : ''}
        {n2(sizing.riskAmount)} {account}
        <br />
        pip value = {formatNumber(pip, 10)} × {formatNumber(lot, 4)}
        {same
          ? ` = ${n2(sizing.pipValuePerLot)} ${account} a lot`
          : ` = ${formatNumber(perLotQuote, 6)} ${inst.quote} × ${formatRate(rate)} = ${n2(sizing.pipValuePerLot)} ${account} a lot`}
        <br />
        lots&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= {n2(sizing.riskAmount)} ÷ ({formatNumber(stopPips, 1)} × {n2(sizing.pipValuePerLot)}) ={' '}
        {formatNumber(sizing.exactLots, lotDp + 2)}
        {sizing.exactLots - sizing.lots > 1e-9 ? ` → ${formatNumber(sizing.lots, lotDp, lotDp)}, rounded down to the step` : ''}
      </div>
      <ul className="calc-notes">
        <li>
          <b>A lot</b> is 100,000 units of the base currency for forex, 100 oz of gold, platinum or palladium, 5,000 oz of
          silver and one coin of crypto. A mini lot is a tenth of a forex lot, a micro lot a hundredth.
        </li>
        <li>
          <b>A pip</b> is 0.0001 on most pairs, 0.01 when the price is in yen, forint, baht or rupees, and 0.01 on metals here.
          Some brokers count gold in 0.1s: change it under Contract if yours does.
        </li>
        <li>
          <b>Rates:</b>{' '}
          {same
            ? `${pairLabel(inst)} is priced in ${account}, your account’s currency, so no conversion is needed.`
            : `${pairLabel(inst)} is priced in ${inst.quote}, so its pip value is converted to ${account} at ${rateText(inst.quote, account, rate)}.`}{' '}
          Rates come live from Coinbase every minute, and once a day from currency-api for metals. Spreads, commission and
          slippage aren’t included, so leave a little room.
        </li>
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

function RiskTable({
  rows,
  current,
  stopPips,
  lotStep,
  units,
  money,
}: {
  rows: { level: number; sizing: Sizing }[];
  current: number;
  stopPips: number;
  lotStep: number;
  units: string;
  money: (v: number) => string;
}) {
  const lotDp = decimals(lotStep);
  return (
    <section className="table-block" aria-labelledby="rl-title">
      <h2 id="rl-title">Other risk levels</h2>
      <p className="muted">
        The same balance and {formatNumber(stopPips, 1)}-pip stop at the risks most traders choose between, rounded down to
        steps of {formatNumber(lotStep, 6)} lots.
      </p>
      <div className="scroll">
        <table className="stack risk-table">
          <thead>
            <tr>
              <th scope="col">Risk</th>
              <th scope="col" className="num">
                Amount
              </th>
              <th scope="col" className="num">
                Position
              </th>
              <th scope="col" className="num">
                Units
              </th>
              <th scope="col" className="num">
                Pip value
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ level, sizing }) => (
              <tr key={level} className={Math.abs(level - current) < 1e-6 ? 'is-current' : ''}>
                <td className="c-main">
                  <b>{formatPercent(level)}</b>
                  {Math.abs(level - current) < 1e-6 && <span className="muted small"> · yours</span>}
                </td>
                <td className="num" data-label="Amount">
                  {money(sizing.riskAmount)}
                </td>
                <td className="num" data-label="Position">
                  {formatNumber(sizing.lots, lotDp, lotDp)} lots
                </td>
                <td className="num" data-label="Units">
                  {formatNumber(sizing.units, 4)} {units}
                </td>
                <td className="num" data-label="Pip value">
                  {money(sizing.pipValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
