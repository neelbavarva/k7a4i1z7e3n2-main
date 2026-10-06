import { findInstrument } from '../instruments';
import { sizePosition } from '../positionSize';
import type { SizeInput } from '../positionSize';
import { Contents, useActiveSection } from './doc';
import { isMac } from './common';
import { formatMoney, formatNumber, formatPercent } from './format';

const BASE = import.meta.env.BASE_URL;

const SECTIONS = [
  ['short', 'The short version'],
  ['formula', 'The formula'],
  ['risk', 'How much to risk'],
  ['stop', 'The stop loss'],
  ['pips', 'Pips and lots'],
  ['rates', 'Exchange rates'],
  ['margin', 'Leverage and margin'],
  ['rounding', 'Rounding'],
  ['left-out', 'What it leaves out'],
  ['using', 'Using the calculator'],
  ['faq', 'Questions'],
] as const;

// The worked examples go through the calculator's own sum, so the page can't disagree with it.
const usd = (v: number) => formatMoney(v, 'USD');
const lots = (v: number) => `${formatNumber(v, 2, 2)} lots`;
const pct1 = (v: number) => `${formatNumber(v, 1, 1)}%`;
const base = { balance: 10_000, riskMode: 'percent', risk: 1, lotStep: 0.01, price: null, leverage: null } as const;
const spec = (symbol: string) => {
  const i = findInstrument(symbol)!;
  return { pip: i.pip, lot: i.lot };
};
const USDJPY = 157.5;
const EXAMPLES = {
  eurusd: sizePosition({ ...base, ...spec('EURUSD'), stopPips: 20, quoteToAccount: 1 } satisfies SizeInput),
  eurjpy: sizePosition({ ...base, ...spec('EURJPY'), stopPips: 30, quoteToAccount: 1 / USDJPY } satisfies SizeInput),
  gold: sizePosition({ ...base, ...spec('XAUUSD'), stopPips: 500, quoteToAccount: 1 } satisfies SizeInput),
};

// what a run of losses leaves, at each risk
const STREAK = [0.5, 1, 2, 5].map((r) => {
  const after = (n: number) => Math.pow(1 - r / 100, n);
  return { r, ten: after(10) * 100, twenty: after(20) * 100, back: (1 / after(10) - 1) * 100 };
});

// each kind of instrument's pip and lot, read from the calculator's own list
const CONTRACTS: { what: string; example: string; unit: string }[] = [
  { what: 'Most forex pairs', example: 'EURUSD', unit: 'units' },
  { what: 'Prices in yen, forint, baht or rupees', example: 'USDJPY', unit: 'units' },
  { what: 'Gold, platinum, palladium', example: 'XAUUSD', unit: 'oz' },
  { what: 'Silver', example: 'XAGUSD', unit: 'oz' },
  { what: 'Bitcoin', example: 'BTCUSD', unit: 'BTC' },
  { what: 'Ether, Solana, Litecoin', example: 'ETHUSD', unit: 'coin' },
  { what: 'XRP', example: 'XRPUSD', unit: 'XRP' },
];

export default function SizeGuide() {
  const active = useActiveSection(SECTIONS);
  const { eurusd, eurjpy, gold } = EXAMPLES;

  return (
    <main className="doc fade-in">
      <nav className="topbar" aria-label="Back">
        <a href={`${BASE}#/position-size`} className="btn btn-ghost doc-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Position size
        </a>
      </nav>

      <header className="doc-head">
        <h1>How position sizing works</h1>
        <p className="lede">
          Position sizing decides how big a trade to take so that, if the stop loss is hit, you lose the amount you planned
          and no more. This page explains the sum the calculator does, what goes into it, and what it can’t know about your
          broker.
        </p>
      </header>

      <div className="doc-layout">
        <aside className="toc" aria-label="On this page">
          <p className="toc-title">On this page</p>
          <Contents sections={SECTIONS} active={active} />
        </aside>

        <div className="doc-body">
          <details className="toc-mobile">
            <summary>On this page</summary>
            <Contents sections={SECTIONS} active={active} />
          </details>

          <section id="short">
            <h2>The short version</h2>
            <p>
              Decide what you’re willing to lose on the trade, usually a small percentage of the account. Decide where the
              stop goes. The position size is whatever makes that stop cost exactly that much.
            </p>
            <p>
              So the size changes from trade to trade while the risk stays the same: a <b>wide stop</b> means a{' '}
              <b>small position</b>, a <b>tight stop</b> a bigger one. Picking a lot size first and the stop afterwards gets
              this backwards.
            </p>
          </section>

          <section id="formula">
            <h2>The formula</h2>
            <p>The amount at risk, divided by what the stop costs on one lot:</p>
            <div className="formula">
              risk = balance × risk %
              <br />
              pip value of one lot = pip × units in a lot × (1 quote currency in your account currency)
              <br />
              lots = risk ÷ (stop in pips × pip value of one lot), rounded down to the lot step
            </div>
            <p>
              <b>Example: EUR/USD.</b> A ${formatNumber(base.balance)} account risking {formatNumber(base.risk)}% is{' '}
              {usd(eurusd.riskAmount)}. One pip on a lot of EUR/USD is 0.0001 × 100,000 = {usd(eurusd.pipValuePerLot)}, already
              in dollars. A 20-pip stop costs {usd(20 * eurusd.pipValuePerLot)} a lot, so the size is{' '}
              {usd(eurusd.riskAmount)} ÷ {usd(20 * eurusd.pipValuePerLot)} = <b>{lots(eurusd.lots)}</b>, or{' '}
              {formatNumber(eurusd.units)} euros.
            </p>
            <p>
              <b>Example: EUR/JPY, with a conversion.</b> The same account and risk, with a 30-pip stop. A pip on a lot is 0.01
              × 100,000 = 1,000 yen, which at {formatNumber(USDJPY, 2, 2)} yen to the dollar is {usd(eurjpy.pipValuePerLot)}. The
              stop costs {usd(30 * eurjpy.pipValuePerLot)} a lot, so the exact size is {formatNumber(eurjpy.exactLots, 4)} lots,
              rounded down to <b>{lots(eurjpy.lots)}</b>, which risks {usd(eurjpy.actualRisk)}.
            </p>
            <p>
              <b>Example: gold.</b> With a stop $5.00 below the entry, which is 500 pips of 0.01, one lot of 100 oz loses{' '}
              {usd(500 * gold.pipValuePerLot)}. Risking {usd(gold.riskAmount)} gives <b>{lots(gold.lots)}</b>,{' '}
              {formatNumber(gold.units)} oz.
            </p>
            <p>The calculator shows this same sum with your own numbers, under “How it’s worked out”.</p>
          </section>

          <section id="risk">
            <h2>How much to risk</h2>
            <p>
              Enter the risk as a <b>percentage of the balance</b> or as an <b>amount</b> in your account currency; switching
              between them keeps the same trade. Most traders risk 1–2% a trade, and the calculator says so when you go above
              2%, and warns harder above 5%.
            </p>
            <p>
              The reason is losing streaks. They happen to every strategy, and a high risk makes them hard to come back from,
              because each loss is taken from a smaller balance and the climb back has to be bigger:
            </p>
            <div className="doc-scroll">
              <table className="doc-table compact doc-stack">
                <thead>
                  <tr>
                    <th scope="col">Risk a trade</th>
                    <th scope="col">Left after 10 losses</th>
                    <th scope="col">Left after 20 losses</th>
                    <th scope="col">Gain needed after 10</th>
                  </tr>
                </thead>
                <tbody>
                  {STREAK.map((s) => (
                    <tr key={s.r}>
                      <td>
                        <b>{formatPercent(s.r)}</b>
                      </td>
                      <td data-label="After 10 losses">{pct1(s.ten)}</td>
                      <td data-label="After 20 losses">{pct1(s.twenty)}</td>
                      <td data-label="Gain needed">+{pct1(s.back)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="stop">
            <h2>The stop loss</h2>
            <p>There are two ways to give the stop:</p>
            <ul>
              <li>
                <b>Pips:</b> the distance from the entry to the stop. The note under the field shows what that is in price.
              </li>
              <li>
                <b>Entry and stop:</b> the two prices. The calculator works out the distance (the gap ÷ one pip) and whether
                it’s a long (stop below the entry) or a short (stop above). It also shows the price for each target.
              </li>
            </ul>
            <p>
              The stop should sit where your trade idea is proven wrong, not wherever makes the position a round number. Set
              the stop first, then let the size follow.
            </p>
            <p>
              <b>Targets</b> show what the trade makes at one, two and three times the risk (1:1, 1:2, 1:3), so you can see if
              the reward is worth taking it.
            </p>
          </section>

          <section id="pips">
            <h2>Pips and lots</h2>
            <p>
              A <b>pip</b> is the price step that moves are counted in, and a <b>lot</b> is the standard trade size. For
              forex, a mini lot is a tenth of a lot and a micro lot a hundredth. Here is what the calculator uses:
            </p>
            <div className="doc-scroll">
              <table className="doc-table compact doc-stack">
                <thead>
                  <tr>
                    <th scope="col">Instrument</th>
                    <th scope="col">One pip</th>
                    <th scope="col">One lot</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTRACTS.map((c) => {
                    const i = findInstrument(c.example)!;
                    return (
                      <tr key={c.example}>
                        <td>
                          <b>{c.what}</b> <span className="muted small">{i.base}/{i.quote}</span>
                        </td>
                        <td data-label="One pip">{formatNumber(i.pip, 10)}</td>
                        <td data-label="One lot">
                          {formatNumber(i.lot)} {c.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p>
              Brokers don’t all agree, especially on metals and crypto (some count gold in 0.1s, or sell 10 oz lots). If yours
              differs, change the lot and the pip under <b>Contract</b>; the calculator remembers it for that instrument.
            </p>
          </section>

          <section id="rates">
            <h2>Exchange rates</h2>
            <p>
              A pip is worth so much of the pair’s <b>quote currency</b>, the second one: yen for EUR/JPY, dollars for EUR/USD.
              When that isn’t your account currency, the pip value is converted at the current rate, so it drifts a little as
              the rate moves.
            </p>
            <ul>
              <li>
                <b>Live rates</b> come from Coinbase, every minute while the calculator is open.
              </li>
              <li>
                <b>Daily rates</b> come from currency-api, for gold, silver, platinum, palladium and the few currencies Coinbase
                doesn’t carry. They also stand in if Coinbase can’t be reached.
              </li>
              <li>
                Each price says whether it’s live or a daily rate. The last good set is kept in your browser, so the calculator
                opens with prices straight away and keeps working offline. If a rate is missing, you can type it in.
              </li>
            </ul>
          </section>

          <section id="margin">
            <h2>Leverage and margin</h2>
            <p>
              The <b>position value</b> is the units times the price, in your account currency. With leverage, the broker only
              holds part of it as <b>margin</b>: the value ÷ the leverage. At 1:100, a position worth $100,000 ties up
              $1,000.
            </p>
            <p>
              Leverage changes how much margin a trade needs, not how much it risks: that’s set by the size and the stop. The
              calculator warns when the margin would be more than the balance. Set your broker’s leverage under{' '}
              <b>Contract</b>.
            </p>
          </section>

          <section id="rounding">
            <h2>Rounding</h2>
            <p>
              Brokers only take sizes in steps, usually 0.01 lots. The exact answer is <b>rounded down</b> to your step, so the
              trade risks the amount you asked for or a little less, never more. The result says how far it was rounded.
            </p>
            <p>
              If even the smallest step would risk more than you asked, the calculator says the trade is too small and shows
              what that step would risk: risk more, use a tighter stop, or skip the trade.
            </p>
          </section>

          <section id="left-out">
            <h2>What it leaves out</h2>
            <ul>
              <li>
                <b>Spread and commission:</b> you start a trade slightly behind, so a stop is reached a little sooner than the
                chart suggests.
              </li>
              <li>
                <b>Slippage and gaps:</b> in fast markets, around big news and over weekends, price can jump past a stop and
                fill worse than it.
              </li>
              <li>
                <b>Swaps:</b> the overnight financing charged or paid on positions held past the day’s close.
              </li>
            </ul>
            <p>Leave a little room for these. It’s a guide to sizing, not financial advice.</p>
          </section>

          <section id="using">
            <h2>Using the calculator</h2>
            <ul>
              <li>
                <b>Pair:</b> search by symbol, currency or name (“eurusd”, “jpy”, “gold”). Press{' '}
                <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd> or <kbd>/</kbd> to open the list.
              </li>
              <li>
                <b>Risk:</b> 0.5%, 1% and 2% are a tap away. “Other risk levels” shows the size at the risks most traders choose
                between, with the same stop.
              </li>
              <li>
                <b>Checks:</b> under the result, whether the risk is within the usual range, how far the size was rounded, and
                anything about the margin or the rate.
              </li>
              <li>
                <b>Remembered:</b> your pair, account, balance, risk, stop and contract changes stay in this browser for next
                time. Nothing is sent anywhere.
              </li>
            </ul>
          </section>

          <section id="faq">
            <h2>Questions</h2>
            <h3>What is position size?</h3>
            <p>How many lots or units you trade. It’s the one thing that ties the stop loss to the money you can lose.</p>
            <h3>How much is a pip worth on EUR/USD?</h3>
            <p>With a dollar account, $10 a standard lot, $1 a mini lot and $0.10 a micro lot.</p>
            <h3>Why does the pip value change?</h3>
            <p>
              When the pair isn’t priced in your account currency, the pip value is converted at the current exchange rate,
              which moves.
            </p>
            <h3>Should I trade the same lot size every time?</h3>
            <p>
              Only if every stop is the same distance. Keeping the risk the same and letting the size change with the stop is
              what keeps one trade from costing more than another.
            </p>
            <h3>Does higher leverage mean more risk?</h3>
            <p>
              Not by itself. It lets you open a bigger position with the same margin, and a bigger position does risk more
              for the same stop. The size is what decides the risk.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
