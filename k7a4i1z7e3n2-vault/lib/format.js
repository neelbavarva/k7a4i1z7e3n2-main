const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "25 June 2025" (how trades store dates) → timestamp, or NaN. */
export function parseTradeDate(s) {
    if (!s) return NaN;
    const m = String(s).trim().match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/);
    if (m) {
        const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
        if (mi >= 0) return new Date(Number(m[3]), mi, Number(m[1])).getTime();
    }
    return Date.parse(s);
}

const dayFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export const fmtDate = (t) => (Number.isFinite(new Date(t).getTime()) ? dayFmt.format(new Date(t)) : "");
export const fmtTime = (t) => timeFmt.format(new Date(t));

export function fmtAgo(t, now = Date.now()) {
    const ts = new Date(t).getTime();
    if (!Number.isFinite(ts)) return "";
    const d = Math.max(0, now - ts);
    const day = 864e5;
    if (d < 36e5) return `${Math.max(1, Math.round(d / 6e4))} min ago`;
    if (d < day) return `${Math.round(d / 36e5)} h ago`;
    if (d < 30 * day) return `${Math.round(d / day)} days ago`;
    return fmtDate(ts);
}

/** Money with a real minus sign: +$1,240 · −$85.50 */
export function money(x, { sign = true } = {}) {
    const n = Number(x) || 0;
    const abs = Math.abs(n).toLocaleString(undefined, {
        minimumFractionDigits: Math.abs(n) % 1 ? 2 : 0,
        maximumFractionDigits: 2,
    });
    if (n === 0) return "$0";
    return `${n < 0 ? "−" : sign ? "+" : ""}$${abs}`;
}

export const pnlOf = (t) => parseFloat(t?.totalPnL) || 0;
export const sideOf = (n) => (n > 0 ? "up" : n < 0 ? "down" : "flat");

export function grade(pct) {
    if (!pct) return { label: "Cntr", key: "x", title: "Counter trade" };
    if (pct >= 90) return { label: "A", key: "a", title: "Grade A" };
    if (pct >= 80) return { label: "B", key: "b", title: "Grade B" };
    if (pct >= 70) return { label: "C", key: "c", title: "Grade C" };
    return { label: "D", key: "d", title: "Grade D" };
}

export const TRADE_TYPES = ["Real", "Funded", "Demo", "Backtest"];

/** Is the user typing somewhere? Then single-key shortcuts stay quiet. */
export function isTyping(e) {
    const t = e.target;
    return (
        t instanceof HTMLElement &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
    );
}
