# k7a4i1z7e3n2-vault

The private vault (saved logins and bank cards) and the Finance page (net worth, accounts and the
trade journal), behind a TOTP lock. Next.js 16 + React 19, plain CSS, deployed on Vercel at
`k7a4i1z7e3n2-vault.vercel.app`. Its data lives in the API next door, `../k7a4i1z7e3n2-api`.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # vitest + jsdom
npm run lint
npm run build
```

`.env` needs `NEXT_PUBLIC_PROD_LINK` (the API's address) and `NEXT_PUBLIC_SERVER_KEY`. The layout of
the code, the design rules and how to try the page with made-up data are in `CLAUDE.md`.
