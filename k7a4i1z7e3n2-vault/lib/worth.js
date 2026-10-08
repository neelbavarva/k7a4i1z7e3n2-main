// Net worth: what each source is worth in rupees, split the same way for all of them, and the
// total across sources.

import { holdingsSummary, positionsSummary } from "./kite";

export const CATS = [
    { key: "stocks", label: "Stocks and ETFs" },
    { key: "funds", label: "Mutual funds" },
    { key: "cash", label: "Broker cash" },
    { key: "crypto", label: "Crypto" },
    { key: "bank", label: "Bank and cash" },
    { key: "other", label: "Other assets" },
    { key: "loans", label: "Loans" },
];

const empty = () => Object.fromEntries(CATS.map((c) => [c.key, 0]));
const sum = (parts) => Object.entries(parts).reduce((a, [k, v]) => a + (k === "loans" ? -v : v), 0);

/**
 * Zerodha: holdings and Coin funds at their last price, and cash as the day's opening balance
 * plus today's P&L on positions (what's been spent on today's buys is still in the positions).
 */
export function zerodhaWorth(account) {
    const s = account?.sections || {};
    const parts = empty();
    const h = holdingsSummary(s.holdings?.data || []);
    parts.stocks = h.current;
    parts.funds = (s.mfHoldings?.data || []).reduce((a, x) => a + (x.quantity || 0) * (x.last_price || 0), 0);
    const eq = s.funds?.data?.equity;
    const co = s.funds?.data?.commodity;
    parts.cash = (eq?.available?.opening_balance || 0) + (co?.available?.opening_balance || 0) + positionsSummary(s.positions?.data?.net || []).pnl;
    return { parts, total: sum(parts), day: h.day };
}

const MANUAL_CAT = { bank: "bank", cash: "bank", deposit: "bank", invest: "stocks", funds: "funds", crypto: "crypto", property: "other", other: "other", loan: "loans" };

/** Hand-typed entries; dollar ones at today's rate, loans taken off. */
export function manualWorth(entries = [], rate) {
    const parts = empty();
    for (const e of entries) {
        const k = e.currency === "USD" ? rate || 0 : 1;
        parts[MANUAL_CAT[e.kind] || "other"] += (e.amount || 0) * k;
    }
    return { parts, total: sum(parts) };
}

/** Crypto wallets: every coin at its CoinGecko price in rupees. */
export function cryptoWorth(data) {
    const parts = empty();
    parts.crypto = (data?.wallets || []).reduce((a, w) => a + (w.inr || 0), 0);
    return { parts, total: sum(parts) };
}

/** Everything together: the total, each category, and today's move where it's known. */
export function combine(worths) {
    const parts = empty();
    let day = 0;
    for (const w of worths.filter(Boolean)) {
        for (const c of CATS) parts[c.key] += w.parts[c.key] || 0;
        day += w.day || 0;
    }
    return { parts, total: sum(parts), day, gross: sum({ ...parts, loans: 0 }) };
}
