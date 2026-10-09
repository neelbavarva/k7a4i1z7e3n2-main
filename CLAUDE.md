# k7a4i1z7e3n2-main

Monorepo of the Kaizen trading sites (GitHub `neelbavarva/k7a4i1z7e3n2-main`). Each folder is its
own app with its own `package.json`; there is no workspace tooling. Each site deploys to Vercel as
`k7a4i1z7e3n2-<name>.vercel.app`.

| Folder | What | Stack |
|---|---|---|
| `k7a4i1z7e3n2-vault` | Vault (logins, cards), trade journal, net worth. **Main focus; see its CLAUDE.md.** | Next.js 16, React 19, plain CSS |
| `k7a4i1z7e3n2-api` | Express + MongoDB server behind the vault (Render: `k7a4i1z7e3n2.onrender.com`) | Node, CommonJS, node:test |
| `k7a4i1z7e3n2-news` | FX Fundamental Bias: bias scores + economic calendar; hourly GitHub Action pipeline | Vite + React |
| `k7a4i1z7e3n2-market-hours` | Forex sessions, volume model, position size calculator | Vite + React + TS |
| `k7a4i1z7e3n2-screener` | Macro dataset screener (Buffett indicator, bubbles) | Next.js 15, Lightweight Charts |
| `k7a4i1z7e3n2-journal-lite` | Frontend for the Lovable-hosted Kaizen Journal API | Next.js 15 + TS |
| `k7a4i1z7e3n2` | Split view: the other sites side by side (≥2500px) or as tabs | Vite + React |

`.github/workflows/news-update.yml` runs the news pipeline and deploy (workflows must live at the root).
Deploy News only through it (`gh workflow run news-update.yml`, or the site's Refresh), never with
`vercel deploy` from the folder: its scores (`public/data/`) are made by the run and never committed, so a
local deploy would ship this machine's old copy. A Vercel build refuses scores over 3 hours old
(`freshData` in its `vite.config.js`). The other sites deploy with `vercel deploy --prod` from their folders.

All sites share one design, and the vault is its source: off-white light theme, the same tokens,
Fraunces at 500 for headings (`--serif`) and IBM Plex Sans for text and figures (`--font`, `--figs`).
Compact: body 13px, labels 11–12px, 32px buttons, small radii (`--radius: 6px`, 6px or less on most
surfaces; pills and circles stay round). Status bars, top bars, page titles, tab bars and the 32px
page margins keep their sizes on every site, because the split view lines them up (see each site's
"Split view" CSS). The vault's `app/globals.css` is the fullest copy; when a shared part changes
there (buttons, segmented controls, the switch, search fields), carry it to the other sites.
No gradients; flat tints with full hairline borders.
