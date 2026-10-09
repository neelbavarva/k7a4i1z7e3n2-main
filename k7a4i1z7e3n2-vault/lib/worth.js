// Net worth: what each source is worth in rupees, split the same way for all of them, and the
// total across sources.

import { holdingsSummary, positionsSummary } from "./kite";
import { toRupees } from "./currency";

export const CATS = [
    { key: "stocks", label: "Stocks and ETFs" },
    { key: "funds", label: "Mutual funds" },
    { key: "cash", label: "Broker cash" },
    { key: "crypto", label: "Crypto" },
    { key: "bank", label: "Bank and cash" },
    { key: "other", label: "Other assets" },
    // what the Real trading account's closed trades have made (or lost): a result, so it can be negative
    { key: "forex", label: "Forex trading" },
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

/** Hand-typed entries, each in its own currency at the day's rates (`rates`), loans taken off. */
export function manualWorth(entries = [], rates) {
    // the day's rates, or (as before) rupees to the dollar alone
    const table = typeof rates === "number" ? { USD: 1, INR: rates } : rates;
    const parts = empty();
    for (const e of entries) {
        // in its own currency, turned into rupees; one with no rate yet counts nothing rather than a guess
        parts[MANUAL_CAT[e.kind] || "other"] += toRupees(e.amount || 0, e.currency, table) ?? 0;
    }
    return { parts, total: sum(parts) };
}

/** Crypto wallets: every coin at its CoinGecko price in rupees. */
export function cryptoWorth(data) {
    const parts = empty();
    parts.crypto = (data?.wallets || []).reduce((a, w) => a + (w.inr || 0), 0);
    return { parts, total: sum(parts) };
}

/**
 * Everything together: the total, each category, and today's move where it's known. `gross` is
 * what's owned, for shares: loans aren't in it, and nor is a trading loss.
 */
export function combine(worths) {
    const parts = empty();
    let day = 0;
    for (const w of worths.filter(Boolean)) {
        for (const c of CATS) parts[c.key] += w.parts[c.key] || 0;
        day += w.day || 0;
    }
    return { parts, total: sum(parts), day, gross: sum({ ...parts, loans: 0, forex: Math.max(0, parts.forex) }) };
}
