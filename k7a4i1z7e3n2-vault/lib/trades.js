// Trade maths shared by the journal, its stats and the dialogs.
import { grade, parseTradeDate, pnlOf } from "./format";

export const isOpen = (t) => t?.tradeStatus === "Open";

/**
 * An archived trade: still in the journal and in every stat (win rate, profit factor, averages,
 * the grade and pair analysis), but its result is out of the total P&L, and so of the net worth.
 */
export const isArchived = (t) => Boolean(t?.archived);
/** The trades whose results add up to the total P&L: all but the archived. */
export const inPnl = (t) => !isArchived(t);

/**
 * The trades whose results count in the net worth: the Real account's, unless archived. A funded
 * account's money isn't yours, and demo and backtest are practice.
 */
export const countsInWorth = (t) => t?.tradeType === "Real" && !isArchived(t);

/** When a trade happened: its trade date, else when it was logged; NaN if neither reads. */
export function tradeTime(t) {
    const d = parseTradeDate(t?.dateOfTrade);
    if (Number.isFinite(d)) return d;
    const logged = Date.parse(t?.date);
    return Number.isFinite(logged) ? logged : NaN;
}

/** Newest first; trades without a readable date go last, in the order they came. */
export function newestFirst(list) {
    return list
        .map((t, i) => ({ t, i, at: tradeTime(t), logged: Date.parse(t.date) || 0 }))
        .sort((a, b) => {
            const an = Number.isNaN(a.at);
            const bn = Number.isNaN(b.at);
            if (an !== bn) return an ? 1 : -1;
            if (an) return a.i - b.i;
            return b.at - a.at || b.logged - a.logged || b.i - a.i;
        })
        .map((x) => x.t);
}

/** Reward per unit of risk. Trades store it as "2.5"; "1:2.5" means the same. */
export function rrValue(rr) {
    const m = String(rr ?? "")
        .trim()
        .match(/^(?:(\d+(?:\.\d+)?)\s*:\s*)?(\d+(?:\.\d+)?)$/);
    if (!m) return NaN;
    const risk = m[1] ? parseFloat(m[1]) : 1;
    return risk ? parseFloat(m[2]) / risk : NaN;
}

/** "1:2.5", or what was typed if it isn't a ratio. */
export function rrText(rr) {
    const v = rrValue(rr);
    if (Number.isFinite(v)) return `1:${+v.toFixed(2)}`;
    return rr ? String(rr) : "—";
}

// chart slots per time frame: lower = 15m / 1H / 4H, higher = 4H / 1D / W
export const tfLabels = (isLower) => (isLower ? ["15min", "1H", "4H"] : ["4H", "1D", "W"]);

/** Results over a list of trades. Win rate and averages count closed trades only. */
export function statsOf(list) {
    const closed = list.filter((t) => !isOpen(t));
    let won = 0;
    let lost = 0;
    let wins = 0;
    let losses = 0;
    for (const t of closed) {
        const p = pnlOf(t);
        if (p > 0) {
            won += p;
            wins++;
        } else if (p < 0) {
            lost -= p;
            losses++;
        }
    }
    const rrs = list.map((t) => rrValue(t.riskRewardRatio)).filter(Number.isFinite);
    return {
        total: list.length,
        open: list.length - closed.length,
        closed: closed.length,
        wins,
        losses,
        winRate: closed.length ? (wins / closed.length) * 100 : null,
        won,
        lost,
        net: won - lost,
        profitFactor: lost ? won / lost : won ? Infinity : null,
        avgWin: wins ? won / wins : 0,
        avgLoss: losses ? lost / losses : 0,
        avgRR: rrs.length ? rrs.reduce((a, b) => a + b, 0) / rrs.length : null,
        rrCount: rrs.length,
    };
}

/** Closed trades oldest first, each with the running total after it. */
export function equityOf(list) {
    let sum = 0;
    return newestFirst(list.filter((t) => !isOpen(t)))
        .reverse()
        .map((t) => ({ t, at: tradeTime(t), pnl: pnlOf(t), sum: (sum += pnlOf(t)) }));
}

export const GRADE_BANDS = [
    { key: "a", label: "A", range: "90% and up" },
    { key: "b", label: "B", range: "80 to 89%" },
    { key: "c", label: "C", range: "70 to 79%" },
    { key: "d", label: "D", range: "Under 70%" },
    { key: "x", label: "Cntr", range: "Counter trades" },
];

export const gradeKey = (t) => grade(t.totalPercentage || 0).key;

const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

/** Trades (already newest first) in calendar months: [{ key, label, rows }]. */
export function byMonth(list) {
    const months = [];
    for (const t of list) {
        const at = tradeTime(t);
        const key = Number.isNaN(at) ? "undated" : `${new Date(at).getFullYear()}-${new Date(at).getMonth()}`;
        let m = months[months.length - 1];
        if (m?.key !== key) {
            m = { key, label: key === "undated" ? "Undated" : monthFmt.format(at), rows: [] };
            months.push(m);
        }
        m.rows.push(t);
    }
    return months;
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "26 Sep" */
export const shortDate = (at) => `${new Date(at).getDate()} ${MON[new Date(at).getMonth()]}`;
/** "Fri 26" for a row under its month heading, or with `withMonth` "26 Sep". */
export function dayLabel(t, withMonth = false) {
    const at = tradeTime(t);
    if (Number.isNaN(at)) return t.dateOfTrade || "—";
    return withMonth ? shortDate(at) : `${DAY[new Date(at).getDay()]} ${new Date(at).getDate()}`;
}
/** "Fri 26 Sep 2026" */
export function longDate(t) {
    const at = tradeTime(t);
    if (Number.isNaN(at)) return t.dateOfTrade || "";
    return `${DAY[new Date(at).getDay()]} ${shortDate(at)} ${new Date(at).getFullYear()}`;
}

/** "04 October 2026", the way trades store their date, from a date input's "2026-10-04". */
export function storedDate(isoDay) {
    const [y, m, d] = String(isoDay).split("-").map(Number);
    if (!y || !m || !d) return "";
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

/** Today as a date input wants it, in local time. */
export function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/*
 * The checklist while a trade is graded. `selected` maps point ids to true. A point with
 * parts (like "All time frames in sync") is either ticked as a whole, which counts its full
 * weight, or has some of its parts ticked, which count theirs. Ticking its last part ticks
 * the whole; unticking one part of a ticked whole keeps the others. This is the shape trades
 * are saved in (whole: checked, parts unchecked), so old trades read the same.
 */

/** "on" (ticked as a whole), "part" (some parts ticked) or "off". */
export function checklistState(selected, item) {
    if (selected[item._id]) return "on";
    return (item.secondaryStrategyPoints || []).some((c) => selected[c._id]) ? "part" : "off";
}

/** The checklist score in percent. */
export function checklistScore(selected, points) {
    let total = 0;
    for (const item of points) {
        if (selected[item._id]) total += item.percentage || 0;
        else for (const c of item.secondaryStrategyPoints || []) if (selected[c._id]) total += c.percentage || 0;
    }
    return total;
}

/** A point clicked: a ticked one clears; an empty or partly ticked one ticks as a whole. */
export function tickWhole(selected, item) {
    const next = { ...selected };
    const was = checklistState(selected, item);
    for (const c of item.secondaryStrategyPoints || []) delete next[c._id];
    if (was === "on") delete next[item._id];
    else next[item._id] = true;
    return next;
}

/** One part of a point clicked. */
export function tickPart(selected, item, part) {
    const next = { ...selected };
    const parts = item.secondaryStrategyPoints || [];
    if (selected[item._id]) {
        // the whole was ticked: keep every part but this one
        delete next[item._id];
        for (const c of parts) if (c._id !== part._id) next[c._id] = true;
    } else if (next[part._id]) {
        delete next[part._id];
    } else {
        next[part._id] = true;
        if (parts.every((c) => next[c._id])) {
            for (const c of parts) delete next[c._id];
            next[item._id] = true;
        }
    }
    return next;
}
