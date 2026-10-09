# Forex Market Hours

When Sydney, Tokyo, London and New York are trading, in your own time, and a position size calculator for the trade
you take in them. Built in the same design system as
[FX Fundamental Bias](../k7a4i1z7e3n2-news): Fraunces + IBM Plex Sans, off-white, the same cards, tables,
status bar, command-palette picker and guide layout.

## What's on the page

- **Status bar**: who is open now (amber over the weekend, with a countdown to the reopen) and the 12h / 24h switch.
- **Timezone bar**: detected from your browser. Click it, press `/` or `Ctrl/⌘ K` to search every timezone by city,
  country, abbreviation (IST, EST…) or offset (+5:30).
- **Day meter and brief**: the whole day coloured by how busy each hour usually is, plus your time, sessions open,
  activity and the next open/close.
- **Right now**: a verdict (busiest time, active, thin, quiet, closed), an activity score with bands, each session's
  progress and countdown, and checks for overlap, phase and next change.
- **Trading sessions**: bars at each market's real hours (DST per city), an overlap row and hover tooltips.
- **Trading volume**: a session-overlap model of a typical day (not live volume) with a three-hour strip.
- **Accumulation, manipulation, distribution**: the "power of three" cycle on New York's clock, with a card per phase.
- **Session times** and **Best times to trade** tables (stacked into cards on phones).
- **How market hours work** (`#/how-it-works`): the guide, with contents that follow your scroll and an FAQ.
- **Position size calculator** (`#/position-size`, also from the switch beside the title): see below.
- **How position sizing works** (`#/position-size/how-it-works`): the calculator's guide: the formula with worked examples, how much to risk, stops, pips and lots, rates, margin, rounding and what it leaves out.

Each tool's footer links to its own guide, and each guide back to its tool; the switch beside the title moves between the two tools.

One time line is shared by every chart: press and drag anywhere on a chart to see another time, and it springs back to
now when you let go. Double-click or `Esc` returns straight away; the arrow keys move it when the sessions chart is
focused. Over the weekend the charts show the next trading day, faded.

## Position size calculator

Lots for a trade from the balance, the risk (a percentage or an amount) and the stop (in pips, or an entry and a stop
price), the way [Myfxbook's calculator](https://www.myfxbook.com/forex-calculators/position-size) works:

```
lots = amount at risk ÷ (stop in pips × pip value of one lot)
pip value of one lot = pip × units in a lot × (1 quote currency in the account currency)
```

- **Instruments**: 63 of them, picked like on Myfxbook from a pair list with a search box (`/` or `Ctrl/⌘ K` opens it;
  try "eurusd", "eur/usd", "jpy" or "gold"): majors, crosses, exotics, metals (gold, silver, platinum, palladium) and
  five coins. The account currency uses the same kind of list. Each has the usual contract
  (100,000 units, 100 oz of gold, 5,000 oz of silver, one coin) and pip (Myfxbook's: 0.0001, 0.01 for JPY, HUF, THB and
  INR quotes and metals, 1 for BTC). Both can be changed per instrument under *Contract*, with the lot step and leverage.
- **Answer**: lots rounded *down* to the lot step (so the risk never goes over), units, mini and micro lots, the amount
  actually at risk, pip value, position value, margin, and 1:1 / 1:2 / 1:3 targets (prices too, given an entry).
  Checks flag risk above 2% (amber) or 5% (red), a position below the smallest step, and margin above the balance.
- **How it's worked out**: the sum with your numbers. **Other risk levels**: the same trade at 0.25% to 5%.
- **Rates**, both free, keyless and open to browsers:
  - Coinbase, `api.coinbase.com/v2/exchange-rates?currency=USD`, for fiat and crypto, fetched every minute while the
    calculator is open and the tab visible.
  - [currency-api](https://github.com/fawazahmed0/exchange-api) (`currency-api.pages.dev`, jsDelivr as a fallback),
    updated daily, for metals and CNH, and for everything if Coinbase is down.

  The last good set is cached, so the page works offline; labels say whether a price is live, cached or daily. If no
  rate can be had at all, the page asks for the one it needs.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-checks, then builds to dist/
npm run preview
```

Node 20+ (`.nvmrc` pins 22). No data files, no API keys: everything is worked out in the browser, and the calculator's
exchange rates come straight from the two public APIs above.

## Deploy

It's a static site: `npm run build` writes everything to `dist/`, which any static host can serve.

- **GitHub Pages:** push to a repo's `main` branch and set *Settings → Pages → Source* to *GitHub Actions*.
  `.github/workflows/deploy.yml` builds with the right base path (`/<repo-name>/`) and publishes.
- **Vercel / Netlify:** build command `npm run build`, output folder `dist`. No settings needed.

## Files

| File | What it does |
| --- | --- |
| `src/App.tsx` | Routes (`#/`, `#/how-it-works`, `#/position-size`, `#/position-size/how-it-works`, and a 404 for anything else), status bar, picker, footer, keyboard shortcuts |
| `src/components/NotFound.tsx` | The 404 page, with the site's pages to go to. Builds also write the app as `dist/404.html` (`vite.config.ts`), which Vercel and GitHub Pages serve for unknown paths |
| `src/components/Dashboard.tsx` | Head, day meter, brief, Right now card |
| `src/components/SessionsChart.tsx`, `VolumeChart.tsx`, `AmdChart.tsx` | The three charts |
| `src/components/common.tsx` | Flags, the site switch, time axis, and the chart area with the shared line and tooltip |
| `src/components/Tables.tsx` | Session times and Best times to trade |
| `src/components/ZonePicker.tsx`, `src/zones.ts` | Timezone search |
| `src/components/Guide.tsx` | How market hours work |
| `src/components/SizeGuide.tsx` | How position sizing works (examples run through `positionSize.ts`) |
| `src/components/doc.tsx` | The guides' shared contents list and section tracking |
| `src/components/Calculator.tsx` | The position size calculator: form, answer, workings, risk levels |
| `src/components/Dropdown.tsx` | The select with a search box, for the pair and the account currency |
| `src/instruments.ts` | The instruments, each one's contract and pip, and the pair search |
| `src/positionSize.ts` | Position sizing and number parsing (pure) |
| `src/rates.ts` | Exchange rates: fetching, merging, caching |
| `src/components/format.ts` | Money, price and rate formatting |
| `src/hooks.ts` | Clock, settings, everything computed for a day, and the scrub line |
| `src/marketModel.ts` | Sessions, overlaps, the volume model and AMD phases (pure) |
| `src/marketTime.ts` | IANA timezone helpers on `Intl.DateTimeFormat` (no hardcoded offsets) |
| `src/styles.css` | All styles |

Settings are remembered in `localStorage`: `tj-mh-tz`, `tj-mh-24`, the calculator's inputs in `tj-mh-ps` and the last
exchange rates in `tj-mh-rates`.

Flags: country-flag-icons, MIT (see `src/assets/flags/LICENSE.txt`).
