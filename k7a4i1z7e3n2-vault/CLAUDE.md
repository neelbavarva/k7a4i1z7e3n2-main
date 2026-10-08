# k7a4i1z7e3n2-vault

A private vault (saved logins and bank cards) and a trade journal with a net worth page, behind a
TOTP lock. Next.js 16 (App Router) + React 19, deployed on Vercel as `k7a4i1z7e3n2-vault.vercel.app`.
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
  - `AppRoot` → `Login` (locked) or `Main` (top bar, tabs **Vault** `1` / **Trades** `2`, `N` new).
  - Vault tab: `Passwords` (logins list + the bank-card strip, `BankCard`, reveal/copy dialogs),
    `ManageVault` (add login / add card / change key), `BreachCheck` (streams over SSE).
  - Trades tab: `Trades` with a **Journal** / **Net worth** switch. Journal: `StrategyAnalysis`
    (performance, breakdown), `AddTrade` (checklist grading, chart links). Net worth: `NetWorth`
    (status line, `Hero` total + history, compact treemap `Picture`, and one `Ledger` card where
    each account opens in place under its row; an `AddMenu` beside the heading), `Zerodha` (Kite
    account, only the sections that have something, plus `TodaysLogin` for the 6 AM login window;
    also exports `Table`, `Sym`, `SideTag`, `Rupees`, `Chip`), `AddWallet`, `BalanceDialog`.
    Sources: Zerodha, MT5 accounts (via the Kaizen Reporter add-on, `public/KaizenReporter.mq5`, which
    POSTs to `/mt5/push` with `MT5_PUSH_TOKEN`), crypto wallets, typed-in balances. Groww was removed.
  - `k7/`: shared pieces: `Modal`, `Seg` (segmented switch), `PairPicker`, `DatePicker`,
    `BankPicker`, `BankLogo`, `Marks` (brand/bank/wallet marks), `CryptoIcons`, `MarketIcon`,
    `hooks` (`useKey`, `useScrolled`, `useCountUp`, `useNow`).
  - `ui/`: shadcn/Radix leftovers. New UI uses plain CSS classes in `globals.css`, not these.
- `lib/`:
  - `http.js`: the only way to call the API (`http`, `httpStream`, `HttpError`, `API_BASE`); adds
    `x-api-key` and `x-vault-session`, and a 401 `locked` sends you back to the lock screen.
  - `auth.js`: unlock state in localStorage, 24 h, synced across tabs. `api.ts`: legacy `/otp/*` calls.
  - `trades.js`, `format.js`: trade maths (stats, R:R, grades, checklist scoring, dates as
    `"25 June 2025"`), money formatting. `session.ts`: forex session bar.
  - `worth.js`: every source turned into the same categories (`CATS`) and `combine`d. `kite.js`: Kite session handoff and rupee formatting (`inr`).
  - `cards.js`: `BANKS` (with regions), card faces/colours, network detection, Luhn.
    `logos.js` + `public/logos/*.json`: measured bank logos. `icons.js`: inline SVG wallets, tokens,
    networks. `wallets.js`: wallet list, coins, chain detection from an address, EIP-6963 extension
    discovery, WalletConnect.
  - `kiteDemo.js`, `worthDemo.js`: sample data behind each panel's "preview" (`onPreview`).
- `public/`: `brands/` (broker logos), `flags/`, `icons/` (pairs), `logos/` (bank logos).

## The lock

A 6-digit TOTP code → `POST /otp/unlock` → a day's session in localStorage, sent as
`x-vault-session`; the unlock lasts 24 hours (`UNLOCK_MS`) across tabs and reloads. Dev runs the
same lock as production (each origin, e.g. `localhost:3001`, unlocks on its own). Three wrong codes
block the IP for a day, so never test `/otp/unlock` with made-up codes. `.env` holds `NEXT_PUBLIC_PROD_LINK`,
`NEXT_PUBLIC_SERVER_KEY`, `NEXT_PUBLIC_SECRET_KEY` (legacy in-browser check); never print them.

## API routes the vault uses (`../k7a4i1z7e3n2-api`)

`/passwords/*`, `/cards/*` (encrypted; decrypt with the vault key), `/trades/*` (+ strategy points),
`/otp/*`, `/kite/*` (Zerodha, read only), `/mt5/accounts`, `/crypto/wallets`,
`/worth/fx`, `/worth/manual`, `/worth/history`. Its README documents each one. API tests:
`npm test` there (node:test).

## Design rules

- Shared Kaizen look: off-white light theme only, tokens on `:root` in `globals.css` (`--page`,
  `--ink`, `--bull`, `--bear`, …). Young Serif for headings, Instrument Sans for text, Literata
  (`--figs`) for money; bank cards use Montserrat + Share Tech Mono.
- No gradients, no one-sided colour stripes: flat tints with a full hairline border.
- Nothing templated (rows of identical icon/title/number tiles, letter-on-colour placeholders).
  Real logos, sized optically. The bank-card UI (`BankCard`, `BankPicker`, `.bank-card` CSS) is
  the quality bar.
- Works inside the split view (`html.is-framed`), on phones (see `/* Responsive */`) and on touch.
- Design for real, small numbers (a few thousand rupees, empty sections, one account), not the
  sample data. Empty parts collapse into one line; nothing repeats what's already on screen.
- Check UI changes in the browser before calling them done. To see the page with made-up data,
  stub `fetch` in a tab on `http://127.0.0.1:3001`, never on `localhost`: localStorage is per
  origin, and stubbing on localhost overwrites the real vault session.

## Code and commit style

- Comments are plain sentences about why, in the voice already in the files; no jargon.
- Commit subjects: `Area: what changed`, e.g. `Net worth: bare logos, a quiet treemap`.
