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

All sites share one design: off-white light theme, the same tokens; Young Serif + Instrument Sans,
except the vault, which titles in Fraunces with IBM Plex Sans for everything else.
The vault's `app/globals.css` is the fullest copy. No gradients; flat tints with full hairline borders.
