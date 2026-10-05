# Kaizen Journal (lite)

A frontend for the [Kaizen Journal API](https://k7a4i1z7e3n2-journal.lovable.app/): a focused forex trade journal with a **Trades** tab and a **Calendar** tab, in the same look as the other k7a4i1z7e3n2 sites (Young Serif + Instrument Sans, off-white, light only). It has no database of its own.

```bash
npm install
cp .env.example .env.local   # then set KAIZEN_API_KEY
npm run dev                  # http://localhost:3000
npm run build
```

Open **`/?demo`** to try everything with about four months of made-up trades, screenshots and blown weeks. In sample mode every action works (closing, pace, uploads, blown weeks, deleting), but it all stays in the browser tab and a reload starts fresh. Nothing is sent to the API.

## How it talks to the API

- **Reads** (trades, one trade with its screenshots, calendar months, blown weeks) go straight from the browser to `NEXT_PUBLIC_KAIZEN_API_URL`. They are public.
- **Writes** go to this site's own server route, `app/api/kaizen/[...path]/route.ts`. It allows only the operations the UI uses (never the API's `/cleanup`: trades are deleted one at a time), checks the input again against the API contract (`lib/validate.ts`), refuses requests started by other sites, adds `X-API-Key` from the server-only `KAIZEN_API_KEY`, and forwards the request. The key never reaches the browser.
- **Screenshots** upload one per request. Anything over 4 MB is redrawn as WebP first, because hosted functions cap a request at about 4.5 MB (the API itself allows 10 MB per image).

| Variable | Where | What |
| --- | --- | --- |
| `NEXT_PUBLIC_KAIZEN_API_URL` | browser + server | `https://k7a4i1z7e3n2-journal.lovable.app/api/public/v1` |
| `KAIZEN_API_KEY` | server only | Must be the same value as the `KAIZEN_API_KEY` secret on the Lovable API. Never prefix it with `NEXT_PUBLIC_`. |

On Vercel, add both under Project → Settings → Environment Variables. Without the key the site still reads; writes show a clear "no key" message.

Anyone who can open this site can write to the journal through the proxy. Keep the URL private, or put the deployment behind Vercel's password protection.

## What's in it

- **Trades:** summary (trades, wins, losses, win rate, net R and %), a pace breakdown, today's forex-day card, pair search (`/`) with a card per matching pair, Real/Demo/Missed, outcome and pace filters, open trades first, then closed trades grouped by week. Pages load newest first until the whole journal is in.
- **New trade:** type, pair, R, pace, notes, when and screenshots. The pair comes from a fixed list, the vault journal's 31: majors, crosses, gold, silver, bitcoin and ether (`PAIRS` in `lib/pairs.ts`; the write proxy refuses anything else). Click the pair, or just start typing on it, to open the picker; it finds pairs by code or by name ("gold", "bitcoin"). **When** is now (stamped as you save) or earlier: a month calendar in the site's style (dots on days that already have trades, ← → ↑ ↓ and PageUp/PageDown to move, nothing after now) and a 24-hour time you type or nudge with ↑ ↓, with the forex day it falls in.
- **Pace:** every trade (real, demo or missed) is on pace, **rushing** (a hare, orange) or **dragging** (a snail, violet). Set it on a new trade or in a trade's review at any time, open or closed. Rushed and dragged trades are tinted in their colour, across the whole row and as a bordered chip on the calendar; the breakdown under the summary shows each pace's share, count, net R and win rate, and filters the list. The API has no pace field, so it lives in the old King fields: `isKing: true` with `kingDescription` `"RUSHING"` or `"DRAGGING"`; anything else reads as on pace (`lib/pace.ts`).
- **Trade detail:** close as profit or loss, reopen, edit the R, notes, pace, the set-and-forget answer, "would've hit TP", and screenshots (drop, paste or pick up to five; view full screen with ← →; rename; delete). Deleting a trade removes its screenshots too.
- **Calendar:** month grid (← → to change month, `P` for the pair picker), daily R, trade markers with "+N more", hatched blown weeks with a flame control per week (mark it blown through a day, undo within 24 hours), and the month's analysis from the API: closed, wins, losses, open, win rate, R, % and best/worst week, pair and weekday.
- **Discipline:** the forex day rolls over at 5:00 PM New York. One real loss closes real trading until the next forex day; a blown week blocks it through the chosen day. Demo and missed always stay open, and logging an earlier trade is never blocked.
- **Rules:** profit = +riskRatio R, loss = −1R, open = 0R, percent = R × 100. Missed setups are saved as profits.

Keys: `N` new trade · `/` search pairs · `1` `2` switch tab · `P` pair picker and `←` `→` months on the calendar.

## Layout

- `app/`: layout, page, styles (`globals.css` reuses the vault journal's design system), the write proxy
- `components/`: `JournalApp` (shell and shared state), `trades/`, `calendar/`, `ui/` (dialog, segmented control, pair picker, date-time picker, market icon, toasts)
- `lib/`: `api.ts` (client), `demo.ts` (sample mode), `journal.ts` (maths, dates, forex day), `pace.ts` (pace in the King fields), `validate.ts`, `images.ts`, `pairs.ts` (the pair list and pair search), `prefs.ts`
