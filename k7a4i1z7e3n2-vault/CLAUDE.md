# k7a4i1z7e3n2-vault

A private vault (saved logins and bank cards) and a Finance page (net worth, accounts and a trade
journal on one page), behind a TOTP lock. Next.js 16 (App Router) + React 19, deployed on Vercel as `k7a4i1z7e3n2-vault.vercel.app`.
The data lives in the sibling Express + MongoDB server `../k7a4i1z7e3n2-api` (hosted on Render at
`https://k7a4i1z7e3n2.onrender.com`). Part of the monorepo described in `../CLAUDE.md`.

```bash
npm run dev     # http://localhost:3000 (port 3001 via the vault-main preview)
npm test        # vitest + jsdom, test/**/*.test.js
npm run lint
npm run build
```

## Layout

- `app/`: `layout.tsx` (fonts, the `is-framed` class for the split view), `page.tsx` → `AppRoot`,
  `connect/` (the pop-up that connects a wallet extension when the vault is inside the split view's
  iframe), `not-found.tsx`, and `globals.css`, the whole design system (~9k lines, sectioned with
  `/* ---------- Name ---------- */` headers; grep for them).
- `components/` (JSX in `.js` files, not TypeScript):
  - `AppRoot` → `Login` (locked) or `Main` (top bar, tabs **Vault** `1` / **Finance** `2`, `N` new:
    Manage vault on the vault, the Finance `AddMenu` on Finance). `Main` keeps the top bar's height in
    `--topbar-h` for what sticks under it.
  - Vault tab: `Passwords` (logins list + the bank-card strip, `BankCard`, reveal/copy dialogs),
    `ManageVault` (add login / add card / change key), `BreachCheck` (streams over SSE).
  - Finance tab: `Finance`, one page: the title with the page's one currency switch beside it
    (`CurrencyMenu`; every figure follows it, trades too, through the `Money` context in
    `k7/Money.js`: `Fig`, `BigFig`, `useMoneyText`, `useUsd` for dollar results; an eye beside it, or H,
    hides every amount as its sign and dots, `masked` in that context, remembered as `financeHidden`;
    shares, returns, rates and prices still show), a row of section
    tabs (Overview, Accounts, Trades) that sticks under the top bar and lights the section you're in,
    then `NetWorth` and `Trades`. The overview is one card (`Hero`): the net worth over its history,
    the globe with the kinds boxed under it, then the trading laid out the same way in the card's own columns (`TradingStrip` in
    `Trades.js` → `TradingDash` in `StrategyAnalysis.js`: the filtered trades' net P&L and their
    equity curve on the left; on the right, in the globe's column, the account switch, Real marked
    as the one counted in the net worth, and win rate, profit factor, average win and loss, R:R,
    best and worst trade, count). Then the accounts
    (`Ledger`), one card whose top row opens and shuts the list (shut: the biggest accounts' logos
    and names; remembered; opening an account from the globe opens it), then the trades: the time frame and pair filters in the heading, `Breakdown` and the
    journal. Finance loads the day's rates (`/worth/fx`) and the trades (`useJournal`) for both, and
    keeps the trades' filters (`useTradeView`), so the card and the journal show the same trades. The Real account's closed trades count in the net worth
    (`countsInWorth` in `lib/trades.js`): a "Forex trading" line in a Trading group (not on the
    globe), the `forex` part of the total, and earlier history days get what the trades had made by then.
    An archived trade (`isArchived`; archived and restored from its dialog through
    `PUT /trades/archiveTrade/:id`) only leaves the total P&L (`inPnl`: the card's figure, won and
    lost, the equity curve, a month's net) and so the net worth; every stat and the grade and pair
    analysis still count it, and the journal keeps it in its month, tagged. `AddMenu`
    (the top bar's Add: a trade, or a balance, fund, investment account, wallet or loan) reaches
    `NetWorth` through its `ask` prop. The two halves share one look: the trading card is laid out
    like the net worth card, the journal is one card like the ledger, with a band per month.
    Trading and journal: `Trades` (`useJournal` loads the trades for the page; `useTradeView` keeps
    the filters: the account in the top card, the time frame and pair in the Trades heading;
    `TradingStrip`, the journal by month, `TradeDetail` to close or archive a trade),
    `StrategyAnalysis` (`TradingDash`, `Breakdown`, the equity curve), `AddTrade` (checklist
    grading, the Counter trade switch, chart links). Net worth: `NetWorth`
    (status line; the top card, `Hero`: the total over its history, and with money in more
    than one place a draggable canvas `Globe` beside them (the Earth: land dots, today's day and night, each account pinned at its bank's or broker's city, threads from home, crypto wallets on orbits) with the kinds boxed under it; then one
    `Ledger` card where each account opens in place under its row, with an add row per group), `Zerodha` (Kite
    account, only the sections that have something, plus `TodaysLogin` for the 6 AM login window;
    also exports `Table`, `Sym`, `SideTag`, `Amount`, `Chip`), `AddWallet`, `BalanceDialog`.
    Sources: Zerodha, crypto wallets, typed-in balances (kinds include `invest`, a brokerage account
    like Merrill, and `funds`, mutual funds on Groww). MetaTrader (MT5) and the Groww API were removed;
    the API server still has its `/mt5` and `/groww` routes, unused by the vault.
  - `k7/`: shared pieces: `Modal`, `Seg` (segmented switch), `SectionTabs` (Vault / Finance),
    `Money` (the page currency: `Fig`, `BigFig`, `CurrencyMenu`, `useUsd`), `MoreMenu`, `PairPicker`,
    `DatePicker`, `BankPicker`, `FundPicker`, `BankLogo`, `Marks` (brand/bank/wallet marks, a `badge`
    on a mark's corner for where it's held, a fund's house with Groww's, say, and the trading's own
    candle disc), `CryptoIcons`, `NetworkMark`, `MarketIcon`, `TradeTags`, `Notes`,
    `ChartViewer`, `SecretInput`, `SessionBar`, `ServiceIcon`, `Mark` (the site's mark), `hooks`
    (`useKey`, `useScrolled`, `useCountUp`, `useNow`).
  - Plain CSS only: every class lives in `app/globals.css`; there's no Tailwind or component kit.
    Radix (`radix-ui`) is used bare for dialogs, menus and popovers, `sonner` for toasts.
- `lib/`:
  - `http.js`: the only way to call the API (`http`, `httpStream`, `HttpError`, `API_BASE`); adds
    `x-api-key` and `x-vault-session`, and a 401 `locked` sends you back to the lock screen. A read
    (GET) that gets no answer, a timeout or a 5xx (not a 503 `unset`) is retried 3 times, 1, 2 and 4 s
    apart, before the page sees the error; writes are never repeated. Wallets whose chains didn't
    answer are re-read fresh the same way in `NetWorth` (`useSource`'s `again`) before it says so.
  - `auth.js`: unlock state in localStorage, 24 h, synced across tabs. `api.ts`: legacy `/otp/*` calls.
  - `trades.js`, `format.js`: trade maths (stats, R:R, grades, checklist scoring, dates as
    `"25 June 2025"`), money formatting. `session.ts`: forex session bar.
  - `worth.js`: every source turned into the same categories (`CATS`) and `combine`d. `kite.js`: Kite session handoff and rupee formatting (`inr`).
  - `funds.js`: fund houses (`AMCS`, `houseOf`), kinds, the well-known funds (popular picks and
    the fallback list), `searchFunds`. `fundList.js`: the full list (every Direct Growth plan and
    ETF, from AMFI via `/worth/funds`), loaded once per tab session by `useFundList`. A mutual
    fund holding stores its AMFI `scheme` code; its category, NAV and 1Y/3Y/5Y returns come from
    `/worth/funds/:code`.
  - `currency.js`: the currency the Finance page is shown in (`currencyOf` for any code, names from
    `Intl.DisplayNames`; `currenciesIn(rates)`, the common few first; `flagOf`, flags in `public/flags`;
    `perRupee`, `moneyParts`, `moneyText`, `useCurrencyCode`: dollars until one is picked, the pick kept in
    localStorage as `financeCurrency`; Finance keeps the last rates too, `worthFx`, so the page opens in its
    currency before today's arrive). `/worth/fx` gives every
    ECB currency plus the Gulf ones at their dollar pegs. Totals are worked out in rupees, trades in
    dollars; `k7/Money.js` turns both into the picked currency at today's rate (its context also carries
    `rates` and `day`). Every figure on the page is in that currency, nothing beside it in another: the
    ledger, the accounts' own panels (Zerodha's amounts; share prices and NAVs stay as quoted), wallets'
    coins, the trading. Convert only through `toRupees`, `fromRupees`, `convert` and `roundIn` in
    `currency.js` (null, never a guess, without a rate). A typed-in balance can be kept in any currency
    (the API takes any ISO code). Its forms start in the page's currency: the inline figure, and the
    add and edit dialog, whose currency field (`CurrencyMenu field`) overrides it. A new balance is kept
    in the currency it's typed in; an edited one stays in its own (a figure typed in another is turned
    into it), unless a currency is picked in the field, which moves it; changing only its name or
    note leaves the figure exactly as it was. Until the picked currency's rate is in, the page is in
    rupees and the status line says so (`waiting`).
  - `places.js`: cities, the bank and broker headquarters behind `placeOf(mark)`, `landPoints()` (unpacked
    from `landDots.js`, a bitmask made once from Natural Earth's 1:110m land), `sunVec()`.
  - `cards.js`: `BANKS` (with regions), card faces/colours, network detection, Luhn.
    `logos.js` + `public/logos/*.json`: measured bank logos. `icons.js`: inline SVG wallets, tokens,
    networks. `wallets.js`: wallet list, coins, chain detection from an address, EIP-6963 extension
    discovery, WalletConnect.
- `public/`: `brands/` (broker logos), `flags/`, `icons/` (pairs), `logos/` (bank logos).
- `test/`: vitest + jsdom; `fixtures/` holds a made-up Kite account and typed-in and crypto
  answers for the net worth maths. The app has no sample-data mode.

## The lock

A 6-digit TOTP code → `POST /otp/unlock` → a day's session in localStorage, sent as
`x-vault-session`; the unlock lasts 24 hours (`UNLOCK_MS`) across tabs and reloads. Dev runs the
same lock as production (each origin, e.g. `localhost:3001`, unlocks on its own). Three wrong codes
block the IP for a day, so never test `/otp/unlock` with made-up codes. `.env` holds `NEXT_PUBLIC_PROD_LINK`,
`NEXT_PUBLIC_SERVER_KEY`, `NEXT_PUBLIC_SECRET_KEY` (legacy in-browser check); never print them.

## API routes the vault uses (`../k7a4i1z7e3n2-api`)

`/passwords/*`, `/cards/*` (encrypted; decrypt with the vault key), `/trades/*` (+ strategy points),
`/otp/*`, `/kite/*` (Zerodha, read only), `/crypto/wallets`,
`/worth/fx`, `/worth/manual`, `/worth/funds`, `/worth/history`. Its README documents each one. API tests:
`npm test` there (node:test).

## Design rules

- Shared Kaizen look: off-white light theme only, tokens on `:root` in `globals.css` (`--page`,
  `--ink`, `--bull`, `--bear`, …). Fraunces at 500 for headings (`--serif`, with optical sizes);
  IBM Plex Sans for everything else: text (`--font`) and every figure (`--figs`, the same face, its
  own token), sizes and weights varying. Every Kaizen site now uses the same faces, scale and radii,
  taken from here: change a shared part here, then carry it over. Bank cards use Montserrat + Share
  Tech Mono.
- No gradients, no one-sided colour stripes: flat tints with a full hairline border.
- Nothing templated (rows of identical icon/title/number tiles, letter-on-colour placeholders).
  Real logos, sized optically. The bank-card UI (`BankCard`, `BankPicker`, `.bank-card` CSS) is
  the quality bar.
- Works inside the split view (`html.is-framed`), on phones (see `/* Responsive */`) and on touch.
- Compact by preference: small type (body 13px, labels 11–12px), tight spacing, small corner radii
  (6px or less on most surfaces; pills and circles stay round), 32px buttons, 36px inputs. The top
  bar and the page title keep their sizes (34px buttons there): in the split view they line up with
  the other sites. The bank cards keep their own proportions.
- Design for real, small numbers (a few thousand rupees, empty sections, one account), not the
  sample data. Empty parts collapse into one line; nothing repeats what's already on screen.
- Check UI changes in the browser before calling them done. To see the page with made-up data,
  stub `fetch` in a tab on `http://127.0.0.1:3001`, never on `localhost`: localStorage is per
  origin, and stubbing on localhost overwrites the real vault session.

## Code and commit style

- Comments are plain sentences about why, in the voice already in the files; no jargon.
- Commit subjects: `Area: what changed`, e.g. `Net worth: bare logos, a quiet treemap`.
