# Forex Market Hours

When Sydney, Tokyo, London and New York are trading, in your own time. Built in the same design system as
[FX Fundamental Bias](../fx-fundamental-bias): Young Serif + Instrument Sans, off-white, the same cards, tables,
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

One time line is shared by every chart: press and drag anywhere on a chart to see another time, and it springs back to
now when you let go. Double-click or `Esc` returns straight away; the arrow keys move it when the sessions chart is
focused. Over the weekend the charts show the next trading day, faded.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-checks, then builds to dist/
npm run preview
```

Node 20+ (`.nvmrc` pins 22). No data files, no API keys: everything is worked out in the browser.

## Deploy

It's a static site: `npm run build` writes everything to `dist/`, which any static host can serve.

- **GitHub Pages:** push to a repo's `main` branch and set *Settings → Pages → Source* to *GitHub Actions*.
  `.github/workflows/deploy.yml` builds with the right base path (`/<repo-name>/`) and publishes.
- **Vercel / Netlify:** build command `npm run build`, output folder `dist`. No settings needed.

## Files

| File | What it does |
| --- | --- |
| `src/App.tsx` | Routes (`#/`, `#/how-it-works`), status bar, picker, footer, keyboard shortcuts |
| `src/components/Dashboard.tsx` | Head, day meter, brief, Right now card |
| `src/components/SessionsChart.tsx`, `VolumeChart.tsx`, `AmdChart.tsx` | The three charts |
| `src/components/common.tsx` | Flags, time axis, and the chart area with the shared line and tooltip |
| `src/components/Tables.tsx` | Session times and Best times to trade |
| `src/components/ZonePicker.tsx`, `src/zones.ts` | Timezone search |
| `src/components/Guide.tsx` | How market hours work |
| `src/hooks.ts` | Clock, settings, everything computed for a day, and the scrub line |
| `src/marketModel.ts` | Sessions, overlaps, the volume model and AMD phases (pure) |
| `src/marketTime.ts` | IANA timezone helpers on `Intl.DateTimeFormat` (no hardcoded offsets) |
| `src/styles.css` | All styles |

Settings are remembered in `localStorage` (`tj-mh-tz`, `tj-mh-24`).

Flags: country-flag-icons, MIT (see `src/assets/flags/LICENSE.txt`).
