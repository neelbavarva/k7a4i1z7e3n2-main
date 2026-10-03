# FX Fundamental Bias

A free, read-only website that scores the fundamental bias of 35 markets: all 28 pairs between the major currencies (EUR, GBP, AUD, NZD, USD, CAD, CHF, JPY), gold, silver, copper, WTI crude, and the S&P 500, Nasdaq 100 and Dow Jones from −100 (fundamentals favour the quote currency) to +100 (they favour the base currency). It is built from economic-calendar surprises and shows upcoming news as a widening risk range. Traders use it as a second opinion on their technical bias.

No backend, no database, no logins. An hourly GitHub Action fetches the data, scores it, saves its state in this repo, and deploys a static React site to GitHub Pages. All API keys stay in GitHub Secrets and never reach the browser.

```
GitHub Actions (hourly)                         GitHub Pages
┌──────────────────────────────────────┐        ┌───────────────────────┐
│ pipeline/run.js                      │        │ React + Vite site     │
│  1. ForexFactory calendar ──┐        │  build │ reads public/data/*.  │
│  2. actual values           ├─ data/ ├───────▶│ json only; no keys,   │
│     (feed, Gemini, CSV)     │ (state)│        │ no API calls          │
│  3. Twelve Data prices ─────┘        │        └───────────────────────┘
│  4. score → public/data/*.json       │
└──────────────────────────────────────┘
```

## Run it locally

Needs Node 20 or newer.

```bash
npm install
npm run demo     # writes SAMPLE data to public/data (marked "Sample data" on the site)
npm run dev      # http://localhost:5173
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests for parsing, classification and the scoring maths |
| `npm run pipeline` | The real hourly job: fetches the calendar, fills actuals, fetches prices, scores |
| `npm run pipeline:offline` | Same, using the saved calendar in `pipeline/fixtures/` and no APIs |
| `npm run build` | Production build into `dist/` |

To run the real pipeline locally with keys:

```bash
TWELVE_DATA_KEY=xxx GEMINI_API_KEY=yyy npm run pipeline
```

Both keys are optional. Without them, prices and AI lookups are skipped and everything else still works.

## Deploy for free (GitHub Pages)

1. Create a GitHub repo (public repos get unlimited free Actions minutes) and push this folder to `main`.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Settings → Secrets and variables → Actions → New repository secret:**
   - `TWELVE_DATA_KEY`: free key from twelvedata.com (prices for the lower chart). 14 series are downloaded an hour (336 credits a day, inside the free 800): the 7 USD pairs, from which every FX cross is calculated (EUR/GBP = EUR/USD ÷ GBP/USD), plus one symbol per instrument. Indices use their tracking funds (SPY, QQQ, DIA). Silver, copper and oil try spot first (XAG/USD, XCU/USD, WTI/USD) and fall back to SLV, CPER and USO if your plan doesn't include spot; `data/prices/sources.json` records which one is used.
   - `GEMINI_API_KEY`: free key from Google AI Studio (looks up released values)
   - Optional variable `GEMINI_MODEL` if you want a model other than `gemini-2.5-flash`
4. **Actions → Update data and deploy → Run workflow** for the first run. After that it runs every hour at :07.

The site is then live at `https://<your-username>.github.io/<repo-name>/`.

**History builds up over time.** The calendar feed only covers the current week, so the 30-day chart fills in over about four weeks of hourly runs. Until then the left part of the chart is flat at zero.

## Markets

**Forex (28):** `pipeline/config.js` builds every pair from `MAJORS`, in market-convention order (EUR > GBP > AUD > NZD > USD > CAD > CHF > JPY decides which currency is the base). The score is a tug-of-war: base-currency data pushes it up, quote-currency data pushes it down.

**Metals, energy and indices (7):** these have no second economy pulling against them, so each has a **driver profile** in `INSTRUMENTS`: which releases move it and which way (`mult`). Positive is bullish.

| Market | Code | Drivers (first match wins) |
| --- | --- | --- |
| Gold | XAU/USD | All US data, inverse (via the dollar) |
| Silver | XAG/USD | China factory PMIs (+1, weight 1.5), US growth (−0.4), other US data (−1) |
| Copper | COPPER | China factory PMIs (+1, weight 2), US growth (+0.6), US inflation and rates (−0.5) |
| WTI crude | USOIL | US crude inventories (−1, weight 2), China factory PMIs (+0.8), US growth (+0.6) |
| S&P 500 | US500 | Fed rates (−1.2), US inflation (−1), US growth (+1), US jobs (+0.5) |
| Nasdaq 100 | NAS100 | Fed rates (−1.5), US inflation (−1.3), US growth (+0.8), US jobs (+0.3) |
| Dow Jones | US30 | Fed rates (−0.9), US inflation (−0.8), US growth (+1.2), US jobs (+0.6) |

Releases are sorted into growth, labour, inflation and rates by title (`categoryOf` in `pipeline/lib/score.js`). A `weight` on a rule lets a Low-impact calendar item count, such as weekly crude inventories or China's PMIs, and those also get Gemini lookups for their actual values. China (CNY) calendar events are kept for these profiles only; FX pairs ignore them. To add a market, add an entry to `INSTRUMENTS` with its drivers and price symbols; the site picks it up automatically.

The home page (`#/all`) groups every pair into bullish, balanced and bearish, with a currency filter. Each pair has its own page at `#/EURGBP`, `#/XAUUSD` and so on.

## The site

- **Home (`#/all`):** every market grouped into bullish, balanced and bearish, with the score now, in 7 days and its 24-hour change. A full-width search understands codes and names (eur, gbpjpy, gold, oil, spx, nasdaq, dow; **/** focuses it, **Enter** opens the top match, **Esc** clears), and an asset-class filter (Forex · Metals · Energy · Indices) narrows the list.
- **Market pages (`#/EURUSD`, `#/US500`, `#/USOIL`…, aliases like `#/spx` or `#/gold` work too):** the tug-of-war meter, a four-part brief (now, in 7 days, biggest push, next big risk), the 7-day Outlook, the chart, and the event tables. **⌘K / Ctrl+K** opens a market switcher from anywhere. FX pages show each currency's side of the tug-of-war; other markets show how hard each driver is pushing.
- **How the score works (`#/how-it-works`):** the method in plain English.
- **Refresh:** a status bar at the top of every page shows when the scores were last updated (amber after 3 hours) and has the Refresh button, which rests for 60 seconds after each use with a countdown. Under `npm run dev` it re-runs the data job on your machine (the real pipeline once `data/events.json` exists, otherwise the sample data; see `vite.config.js`), then reloads the scores. On the deployed site it re-fetches the latest JSON and says plainly if nothing newer exists yet; open tabs also re-check every 10 minutes on their own.
- **States:** skeleton screens while data loads, a friendly error with **Try again** if it fails, a notice when the data is more than 3 hours old (the hourly job has stalled), and a 404 page for unknown pairs or paths (GitHub Pages serves it via `404.html`, which the workflow copies from `index.html`).
- **Type:** Young Serif for headers and big numbers, Instrument Sans for text and data. Both are bundled through `@fontsource`, so there are no external font requests. The theme is a light off-white.
- **Performance:** the chart library is loaded only on pair pages, so the home page ships about 58 KB gzipped of JavaScript.

## The Outlook section (each pair page)

The forward-looking summary a technical trader reads instead of gathering news. It is computed in the browser from the pair's JSON (`src/components/Outlook.jsx`) and assumes every scheduled release matches its forecast:

- **Bias checker:** one fundamental bias for the coming week: `100 × tanh(avg R ÷ K)` over now and the next 7 days of the projection, split into its released-news part and its forecast part (each shown with its share of the weight), with a strength tier (none / weak / moderate / strong at 15 / 40 / 70) and checks: now, in 7 days, share of the week on that side, upcoming forecasts that agree, and surprise risk.
- **News load:** spikes for each scheduled release in the next 7 days (height = risk weight: rate 4, High 3, Medium 1.5; stacked per hour), a soft "news pressure" curve (same Gaussian as the risk band), a per-day busyness strip (quiet / light < 4 / busy < 9 / very busy) and a week rating (quiet < 8 / moderate < 20 / busy < 40 / very busy).
- **Verdict:** the current lean and where it's heading, e.g. "Mildly bearish, fading to neutral". It names the score now and in 7 days, the two biggest expected moves, and the highest-risk day.
- **Each side of the tug-of-war:** each currency's own score from its own data (`b` and `q` in the series), now and in 7 days. This shows *which* currency is driving the change.
- **Day by day:** the score at the end of each day in the viewer's time zone, the change on the day, the risk (High if a High-impact release is scheduled that day), and the releases with their expected direction.
- **What each release could do:** the score right after each release if it comes in line, one standard deviation above, or one below forecast. `sc` on each event is the pair effect of a 1σ beat, applied as `100 × tanh((r ± sc) / K)`.

## How the score works

Full explanation: the "How the score works" page on the site, which reads its numbers, word lists and driver tables straight from `pipeline/config.js` and `pipeline/rules.js`, so it can't drift from the model. Code: `pipeline/lib/score.js`.

Every release counts its **expected change** `0.5 × clamp((forecast − previous) / σ, −3, 3)`, which builds up linearly over the 24 h before the release (markets price the consensus in ahead of time). At the release only its **surprise** (below) is added. So an in-line release doesn't move the score, a beat always pushes towards that currency and a miss always against it.

1. **Surprise:** `z = clamp((actual − forecast) / σ, −3, 3)`. σ is the spread of past surprises for that indicator (needs 5 stored releases). Until then it's `max(|forecast − previous|, 10% of forecast, 0.05)`, and 0.25 for rate decisions.
2. **Direction and weight:** `c = side × dir × weight × z` (the surprise push shown in the tables). side is +1 for the base currency and −1 for the quote. dir is −1 for unemployment and claims. weight is High 3, Medium 1.5, Low 0, rate decisions 4. Speeches and statements are risk-only.
3. **Decay:** each contribution halves every 72 h (240 h for rate decisions).
4. **Score:** `S = 100 × tanh(Σ / K)` with `K = 12`.
5. **Consensus path (the dotted line):** each upcoming release with a forecast and previous value ramps in `0.5 × dir × weight × clamp((forecast − previous) / σ, −3, 3)` over the 24 h before its release (`expectationLeadHours`). When the actual arrives, the surprise is added on top at the release hour. A release still waiting for its actual (up to 7 days) keeps the expected push and is marked "expected".
6. **Future band:** the range around the dotted line widens near upcoming High/Medium events (Gaussian bump, 12 h width).

All tunables live in `pipeline/config.js`.

> **Why K = 12, not 6?** With a normal week's event density, K = 6 put most pairs at ±80–98 most of the time, so every pair looked "strong". At 12 the median |score| is about 35 and the 90th percentile about 63, so the labels separate. Re-tune after backtesting against real data.

## Where actual values come from

The ForexFactory feed has forecasts and previous values but **no actual values**. The pipeline fills them from three sources, in priority order:

1. **Manual:** `data/actuals_overrides.csv`, edited directly on GitHub. Always wins.
   ```csv
   date,currency,title,actual
   2026-10-02,USD,Non-Farm Employment Change,150K
   ```
   `date` is the release date in UTC, and `title` must match the calendar exactly.
2. **Feed:** for recurring indicators, the next listing's "previous" figure is the official value. This is free and automatic, but only arrives when the next release appears in the feed (next week for weekly data, the release week for monthly data).
3. **Gemini:** 20+ minutes after each Medium/High release, Gemini with Google Search grounding is asked for the value. An answer is accepted only if it has the same unit as the forecast and a plausible size. The source link shows in the "Recent surprises" table. At most 10 lookups and 3 attempts per event per run.

Spot-check AI-filled values now and then. A wrong High-impact actual moves the score for days.

## Project layout

```
pipeline/
  config.js            pairs (28 crosses + gold), price legs, model constants, retention
  run.js               hourly job (calendar → actuals → prices → scores)
  demo.js              sample data for previewing the site
  lib/parse.js         value parsing ("201K", "0.3%"), event classification
  lib/score.js         the scoring model
  lib/output.js        writes public/data/*.json
  sources/             calendar.js, actuals.js, prices.js
  fixtures/            one real calendar week, for tests and the demo
  test/                node:test unit tests
data/                  pipeline state, committed by the Action (events.json, prices/, overrides CSV)
src/                   React app: App.jsx (routing, data loading), components/ (Overview, Outlook,
                       BiasChart, EventTables, Meter, PairPicker, States, HowItWorks), styles.css
.github/workflows/     update.yml: hourly pipeline + Pages deploy
```

## Caveats

- **Not financial advice.** The "How it works" page says so, and the site never uses buy/sell wording.
- **ForexFactory's feed is unofficial.** It's fetched at most twice an hour (this week + next week). If you ever monetise the site, switch to a licensed calendar API and check the terms first.
- **Scheduled workflows pause** if a public repo has no activity for 60 days. The hourly data commits normally count as activity, but if the site stops updating, check the Actions tab and re-enable the workflow.
- **Backtest before you promote it.** Check whether the score at time t lines up with the pair's move over the next 1–5 days, then tune `K`, the weights and the half-life in `pipeline/config.js`.
