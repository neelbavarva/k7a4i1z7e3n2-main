// Zerodha (Kite Connect) on the vault's side: this browser's session with the API server,
// the hand-off after the Kite login, and the sums the Zerodha view shows.
// The Kite access token never reaches the browser; the server holds it and reads for us.

import { API_BASE, http } from "./http";

const KEY = "kiteSession";

/** This browser's session, while it lasts: { session, expiresAt, userName }. */
export function loadSession(now = Date.now()) {
    try {
        const s = JSON.parse(localStorage.getItem(KEY) || "null");
        if (s?.session && new Date(s.expiresAt).getTime() > now) return s;
    } catch {
        // storage blocked or junk: no session
    }
    return null;
}

export function saveSession(s) {
    try {
        localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
        // storage blocked: the session lasts as long as the page
    }
}

export function clearSession() {
    try {
        localStorage.removeItem(KEY);
    } catch {
        // nothing stored
    }
}

/** Where "Connect Zerodha" goes: the server sends on to Kite and Kite comes back here. */
export const connectUrl = () => `${API_BASE}/kite/login?to=${encodeURIComponent(window.location.origin)}`;

/** Is the page opening with something from the Kite login in its fragment? */
export const hasHandoff = () => typeof window !== "undefined" && /^#kite(-error)?=/.test(window.location.hash);

/** Reads (and clears) the login's result from the URL: { code } or { error }, or null. */
export function takeHandoff() {
    if (!hasHandoff()) return null;
    const [name, value = ""] = window.location.hash.slice(1).split("=");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return name === "kite" ? { code: decodeURIComponent(value) } : { error: decodeURIComponent(value) };
}

export const HANDOFF_ERRORS = {
    cancelled: "The Zerodha login was cancelled.",
    "wrong-account": "That Zerodha account isn't the one this vault is set up for.",
    unset: "Zerodha isn't set up on the server yet.",
    failed: "Zerodha didn't accept the login. Try again.",
};

export const kiteGet = (path, session) => http(path, { headers: { "x-kite-session": session } });
export const kitePost = (path, session, body = {}) => http(path, { method: "POST", body, headers: { "x-kite-session": session } });

// ---------- Numbers ----------

const inrFmt = (d) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: d, maximumFractionDigits: d });
const fmts = { 0: inrFmt(0), 2: inrFmt(2) };

/** Rupees with Indian grouping and a real minus: ₹1,23,456.50 · −₹85 · +₹2,415 with `sign`. */
export function inr(x, { sign = false, whole = false } = {}) {
    const n = Number(x) || 0;
    const d = whole || Number.isInteger(n) ? 0 : 2;
    const abs = fmts[d].format(Math.abs(n));
    if (n === 0) return abs;
    return `${n < 0 ? "−" : sign ? "+" : ""}${abs}`;
}

/** A plain number with Indian grouping: 1,23,456.5 */
export const num = (x, d = 2) =>
    (Number(x) || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: d });

/** +1.25% · −0.40% */
export function pct(x, { sign = true } = {}) {
    if (x == null || !Number.isFinite(x)) return "—";
    const abs = Math.abs(x).toFixed(2);
    return `${x < 0 ? "−" : sign && x > 0 ? "+" : ""}${abs}%`;
}

// ---------- Sums ----------

/** Holdings as a whole: what went in, what it's worth, and today's move. */
export function holdingsSummary(holdings = []) {
    let invested = 0;
    let current = 0;
    let day = 0;
    for (const h of holdings) {
        const qty = (h.quantity || 0) + (h.t1_quantity || 0);
        invested += qty * (h.average_price || 0);
        current += qty * (h.last_price || 0);
        day += qty * (h.day_change || 0);
    }
    const pnl = current - invested;
    const before = current - day;
    return {
        invested,
        current,
        pnl,
        pnlPct: invested ? (pnl / invested) * 100 : null,
        day,
        dayPct: before ? (day / before) * 100 : null,
    };
}

/** Today's positions: total P&L and its realised and open parts. */
export function positionsSummary(net = []) {
    let pnl = 0;
    let realised = 0;
    let unrealised = 0;
    let open = 0;
    for (const p of net) {
        pnl += p.pnl || 0;
        realised += p.realised || 0;
        unrealised += p.unrealised || 0;
        if (p.quantity) open++;
    }
    return { pnl, realised, unrealised, open, total: net.length };
}

/** What today's filled orders cost, in total and by kind. */
export function chargesSummary(rows = []) {
    const out = { total: 0, brokerage: 0, taxes: 0, other: 0 };
    for (const r of rows) {
        const c = r.charges || {};
        out.total += c.total || 0;
        out.brokerage += c.brokerage || 0;
        out.taxes += (c.transaction_tax || 0) + (c.gst?.total || 0) + (c.stamp_duty || 0);
    }
    out.other = out.total - out.brokerage - out.taxes;
    return out;
}

/** Orders by how they ended up. */
export function orderCounts(orders = []) {
    const c = { done: 0, open: 0, failed: 0 };
    for (const o of orders) c[orderState(o)]++;
    return c;
}

export function orderState(o) {
    const s = String(o.status || "").toUpperCase();
    if (s === "COMPLETE") return "done";
    if (s === "REJECTED" || s === "CANCELLED") return "failed";
    return "open";
}

/** "NSE:INFY" style, the way quotes are asked for. */
export const instrumentOf = (row) => `${row.exchange}:${row.tradingsymbol}`;

/** A Kite time ("2026-10-07 09:21:04" in India time) as a short clock time here. */
export function clock(stamp) {
    if (!stamp) return "";
    const iso = String(stamp).includes("T") ? stamp : `${String(stamp).replace(" ", "T")}+05:30`;
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
}

/** A Kite date as "10 Oct". */
export function shortDay(stamp) {
    if (!stamp) return "";
    const d = new Date(String(stamp).slice(0, 10) + "T00:00:00");
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
}
