# K7A4I1Z7E3N2 Split View

Frontend-only page that shows other sites side by side in full-height, resizable panes on screens 2500px or wider, and one at a time with a tab bar on anything narrower.
Uses the same theme (colours, Young Serif + Instrument Sans) as FX Fundamental Bias.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

- **Change the sites:** edit `src/sites.js` (any number of panes works).
- **Resize:** drag a divider. The pane you're widening takes the space and every pane on the other side shrinks together, down to a minimum width (`MIN` in `src/App.jsx`). Arrow keys nudge a focused divider; double-click or Enter evens all widths out.
- **Rearrange:** hover a pane, then drag the dotted handle at the left of its toolbar (bottom-right) and drop it between two other panes. Arrow keys move it when the handle is focused. Tabs follow the same order.
- **Reset:** once the layout differs from the default, a reset button appears in each pane's toolbar; it restores the default order and equal widths.
- Order and widths are remembered per browser (`localStorage`); they fall back to the default if the site list changes.
- Any path other than the viewer itself shows a 404 that links to the split view and each site. Builds also write the app as `dist/404.html` (`vite.config.js`), which Vercel serves for unknown paths.
- **Per pane:** hover a pane for reload / open-in-new-tab (bottom-right).
- **Below 2500px wide:** one site at a time; switch with the tab bar (arrow keys work when a tab is focused). Reload / open-in-new-tab sit at the right of the bar. Each site loads the first time it's opened and stays loaded, and the last tab is remembered. The breakpoint is `WIDE_QUERY` in `src/App.jsx`.

A site can only be embedded if it doesn't send `X-Frame-Options: DENY/SAMEORIGIN` or a restrictive `frame-ancestors` CSP.
