# k7a4i1z7e3n2-api

Express + MongoDB server behind the vault. Run the tests with `npm test`.

## The lock

Every data route needs the `x-api-key` header (`SERVER_KEYS`) and, once `VAULT_TOTP_SECRET` is set,
today's vault session in `x-vault-session`. The vault gets that session from `POST /otp/unlock` with
the 6-digit code from your authenticator app; the code is checked here, against `VAULT_TOTP_SECRET`
(a base32 key, 32 characters), and three wrong codes block the address for a day. The session lasts
24 hours. While `VAULT_TOTP_SECRET` isn't set, `/otp/unlock` answers 503 and the vault falls back to
its old in-browser check.

## Zerodha (`/kite`)

Read-only access to one Zerodha account through Kite Connect, shown on the vault's Trades page under **Zerodha**.

| Route | What it does |
|---|---|
| `GET /kite/status` | Whether Kite is set up and logged in today. Nothing personal. |
| `GET /kite/login?to=<vault origin>` | Sends the browser to Kite's login. |
| `GET /kite/callback` | Kite's redirect: stores today's token (encrypted), then returns to the vault with a one-time code. |
| `POST /kite/session` | Swaps that code (valid 2 minutes, once) for this browser's session. |
| `GET /kite/account` | Profile, funds, holdings, positions, orders, trades, today's charges, GTTs, alerts, MF holdings and SIPs. |
| `GET /kite/quote?i=NSE:INFY` | Live quote (paid Kite Connect plan). |
| `GET /kite/candles/:token?interval=day&days=365` | Historical candles (paid plan). |
| `POST /kite/logout` | Ends the login at Kite and signs every browser out. |

All routes except the login redirects also need the browser's session in `x-kite-session`.
The Kite access token never leaves the server. Kite tokens expire at 6:00 AM India time, so log in once a day.
No order routes: Kite only accepts API orders from a registered static IP.

### Setup

1. Create an app at [developers.kite.trade](https://developers.kite.trade). The free Personal plan covers everything except quotes and candles.
2. Set its redirect URL to `https://k7a4i1z7e3n2.onrender.com/kite/callback`.
3. Add these to the server's environment:

| Variable | Value |
|---|---|
| `KITE_API_KEY` | The app's API key |
| `KITE_API_SECRET` | The app's API secret |
| `KITE_USER_ID` | Your Zerodha client ID. Only this account can connect. |
| `VAULT_URLS` | Optional. Comma-separated vault origins to return to. Defaults to `https://k7a4i1z7e3n2-vault.vercel.app`. Any `http://localhost` port is always allowed. |
