# K7A4I1Z7E3N2 Split View

Frontend-only page that shows other sites side by side in full-height, resizable panes on screens 2500px or wider, and one at a time with a tab bar on anything narrower.
Uses the same theme (colours, Young Serif + Instrument Sans) as FX Fundamental Bias.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

- **Change the sites:** edit `src/sites.js` (any number of panes works).
- **Resize:** drag the divider, arrow keys when it's focused, double-click or Enter to reset to equal widths. The split is remembered per browser (it resets when the number of sites changes).
- **Per pane:** hover a pane for reload / open-in-new-tab (bottom-right).
- **Below 2500px wide:** one site at a time; switch with the tab bar (arrow keys work when a tab is focused). Reload / open-in-new-tab sit at the right of the bar. Each site loads the first time it's opened and stays loaded, and the last tab is remembered. The breakpoint is `WIDE_QUERY` in `src/App.jsx`.

A site can only be embedded if it doesn't send `X-Frame-Options: DENY/SAMEORIGIN` or a restrictive `frame-ancestors` CSP.
