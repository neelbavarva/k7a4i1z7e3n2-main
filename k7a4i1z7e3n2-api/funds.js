// Every mutual fund in India, for the vault's fund picker: AMFI publishes each scheme's NAV daily
// in one free text file (no key). From it we keep each open-ended scheme's Direct Growth plan, and
// the ETFs (they have only the one plan), with a clean name, the fund house and a category in the
// words Groww uses ("Equity Small Cap", "Commodities Gold"). A fund's returns over 1, 3 and 5
// years come from its NAV history on mfapi.in, asked for only for the funds you hold.
const { cached, getJson, getText } = require("./market");

const NAV_FILES = ["https://www.amfiindia.com/spages/NAVAll.txt", "https://portal.amfiindia.com/spages/NAVAll.txt"];
const HISTORY = (code) => `https://api.mfapi.in/mf/${code}`;

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

/** AMFI's "07-Oct-2026" and mfapi's "07-10-2026", as "2026-10-07". */
function isoDay(d) {
    const m = /^(\d{1,2})-([A-Za-z]{3}|\d{1,2})-(\d{4})$/.exec(String(d || "").trim());
    if (!m) return null;
    const month = MONTHS[m[2].toLowerCase()] || Number(m[2]);
    return month >= 1 && month <= 12 ? `${m[3]}-${pad(month)}-${pad(m[1])}` : null;
}

/** "Aditya Birla Sun Life Mutual Fund" → "Aditya Birla Sun Life"; "360 ONE Mutual Fund (Formerly …)" → "360 ONE". */
const houseName = (line) =>
    line
        .replace(/\(.*?\)/g, "")
        .replace(/\s+mutual\s+fund\s*$/i, "")
        .replace(/\s+/g, " ")
        .trim();

// plans that aren't the one we want: payouts, bonus units, the side pockets of a scheme
const NOT_GROWTH = /\b(idcw|dividend|bonus|payout|re-?invest(ment)?|segregated|unclaimed|institutional|retail)\b/i;

const tidy = (s) => {
    const t = s
        .replace(/\s*\((formerly|erstwhile)[^)]*\)/gi, "")
        .replace(/[\s\-–(]+$/, "")
        .replace(/\s+/g, " ")
        .trim();
    return t.charAt(0).toUpperCase() + t.slice(1); // "quant Small Cap Fund" → "Quant Small Cap Fund"
};

/**
 * The scheme's name without its plan, when the line is a Direct Growth plan (or an ETF), else null.
 * AMFI writes the plan many ways: "- Direct Plan - Growth", "- Growth Option - Direct Plan",
 * "-DIRECT PLAN -GROWTH", "Direct Plan Growth Plan - Growth Option"…
 */
function planName(raw, etf) {
    const name = String(raw || "")
        .replace(/\s+/g, " ")
        .trim();
    if (!name || NOT_GROWTH.test(name)) return null;
    const at = name.search(/\bdirect\b/i);
    if (at < 0) {
        // an ETF has the one plan; anything else without "Direct" is a Regular plan
        if (!etf || /\bregular\b/i.test(name)) return null;
        return tidy(name.replace(/[\s\-–]+growth(\s+(option|plan))?\s*$/i, ""));
    }
    if (/\bregular\b/i.test(name.slice(0, at))) return null;
    const base = name
        .slice(0, at)
        .replace(/[\s\-–(]+$/, "")
        .replace(/[\s\-–]+growth(\s+(option|plan))?$/i, "");
    return tidy(base);
}

const DEBT_WORDS = /\b(sdl|g-?sec|gilt|bond|debt|crisil|t-?bills?|liquid|psu|target maturity|treasury|money market|overnight)\b/i;
const ABROAD = /\b(international|global|overseas|world|nasdaq|s&p 500|nyse|fang|us|usa|china|japan|taiwan|hang seng|europe|emerging markets)\b/i;

/**
 * What a fund is, from AMFI's category ("Equity Scheme - Small Cap Fund") and its name:
 * `kind` for the picker's filters, `category` for the line under its name.
 */
function classify(amfiCategory, name) {
    const [typePart, ...rest] = String(amfiCategory || "").split(" - ");
    const type = typePart.replace(/\s*scheme\s*$/i, "").trim();
    const raw = rest.join(" - ");
    let sub = raw
        .replace(/\/\s+/g, "/")
        .replace(/\s+/g, " ")
        .replace(/\s+funds?$/i, "")
        .trim();
    if (/balanced advantage/i.test(sub)) sub = "Balanced Advantage";
    if (/^multi asset/i.test(sub)) sub = "Multi Asset";
    const metal = /\bsilver\b/i.test(name) ? "Silver" : /\bgold\b/i.test(name) ? "Gold" : null;
    const etf = /\betf\b/i.test(raw) || /\betf\b|\bbees\b/i.test(name);

    if (/^other$/i.test(type)) {
        if (metal) return { kind: "gold", category: `Commodities ${metal}` };
        if (/index|etf/i.test(raw)) {
            const debt = DEBT_WORDS.test(name);
            return { kind: debt ? "debt" : ABROAD.test(name) ? "global" : "index", category: `${debt ? "Debt" : "Equity"} ${etf ? "ETF" : "Index"}` };
        }
        if (/overseas/i.test(raw)) return { kind: "global", category: "Equity International" };
        return { kind: "other", category: /fof/i.test(raw) ? "Fund of Funds" : sub || "Other" };
    }
    if (/^equity$/i.test(type)) {
        if (/^elss$/i.test(sub)) return { kind: "elss", category: "Equity ELSS" };
        return { kind: ABROAD.test(name) && /thematic|sectoral/i.test(sub) ? "global" : "equity", category: `Equity ${sub}` };
    }
    if (/^debt$/i.test(type)) return { kind: "debt", category: `Debt ${sub}` };
    if (/^hybrid$/i.test(type)) return { kind: "hybrid", category: `Hybrid ${sub.replace(/\s+hybrid$/i, "")}` };
    if (/solution/i.test(type)) return { kind: "other", category: `Solution ${sub}` };
    return { kind: "other", category: [type, sub].filter(Boolean).join(" ") || "Other" };
}

/**
 * NAVAll.txt as a list. The file is blocks: a line for the category ("Open Ended Schemes(Equity
 * Scheme - Large Cap Fund)"), a line for each fund house, then one line per plan:
 * `code;ISIN growth;ISIN reinvest;name;NAV;date`. Close-ended and interval schemes are left out.
 */
function parseNavAll(text) {
    const funds = [];
    const seen = new Set();
    const dates = {};
    let category = null;
    let house = null;
    for (const raw of String(text || "").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        if (!line.includes(";")) {
            const m = /^(open ended|close ended|interval fund) schemes?\s*\((.+)\)\s*$/i.exec(line);
            if (m) {
                category = /^open/i.test(m[1]) ? m[2].trim() : null;
                house = null;
            } else house = houseName(line);
            continue;
        }
        if (!category || !house) continue;
        const [code, isin, , schemeName, navText, dateText] = line.split(";").map((x) => x.trim());
        if (!/^\d+$/.test(code)) continue; // the column heads
        const etf = /etf/i.test(category) || /\betf\b|\bbees\b/i.test(schemeName);
        const name = planName(schemeName, etf);
        if (!name) continue;
        const key = `${house}|${name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const nav = Number(navText);
        const date = isoDay(dateText);
        if (date) dates[date] = (dates[date] || 0) + 1;
        funds.push({ code: Number(code), name, house, ...classify(category, name), nav: nav > 0 ? nav : null, date, isin: /^IN[A-Z0-9]{10}$/.test(isin) ? isin : null });
    }
    // the day most NAVs are for
    const date = Object.entries(dates).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return { date, count: funds.length, funds };
}

/** The whole list, read again every six hours (AMFI updates it each evening). */
function allFunds() {
    return cached("mf:all", 6 * 60 * 60 * 1000, async () => {
        let last;
        for (const url of NAV_FILES) {
            try {
                const out = parseNavAll(await getText(url, 20000));
                if (out.count > 100) return out;
                last = new Error("The NAV file was nearly empty");
            } catch (err) {
                last = err;
            }
        }
        throw last;
    });
}

/**
 * Returns from a NAV history (oldest first, [{ day, nav }]): 1 year as it is, 3 and 5 years a
 * year on average (compounded), as Groww shows them. Null where the fund is younger than that.
 */
function returnsOf(history) {
    if (!history.length) return { "1Y": null, "3Y": null, "5Y": null };
    const last = history[history.length - 1];
    const lastMs = Date.parse(`${last.day}T00:00:00Z`);
    const navOn = (ms) => {
        // the last NAV on or before that day (markets close on holidays)
        let lo = 0;
        let hi = history.length - 1;
        let found = null;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (Date.parse(`${history[mid].day}T00:00:00Z`) <= ms) {
                found = history[mid];
                lo = mid + 1;
            } else hi = mid - 1;
        }
        return found;
    };
    const first = history[0];
    const ret = (years) => {
        const target = lastMs - years * 365 * 864e5;
        // a fund that started within a week after that day still counts, from its first NAV
        const then = navOn(target) || (Date.parse(`${first.day}T00:00:00Z`) - target <= 7 * 864e5 ? first : null);
        if (!then || then === last || !(then.nav > 0)) return null;
        // a hole in the history that long ago: no figure rather than a wrong one
        if (target - Date.parse(`${then.day}T00:00:00Z`) > 31 * 864e5) return null;
        const growth = last.nav / then.nav;
        const pct = years === 1 ? (growth - 1) * 100 : (Math.pow(growth, 1 / years) - 1) * 100;
        return Math.round(pct * 100) / 100;
    };
    return { "1Y": ret(1), "3Y": ret(3), "5Y": ret(5) };
}

/** One fund: its latest NAV, when its history starts, and its returns. Cached six hours. */
function fundDetail(code) {
    return cached(`mf:${code}`, 6 * 60 * 60 * 1000, async () => {
        const j = await getJson(HISTORY(code), 15000);
        const history = (Array.isArray(j?.data) ? j.data : [])
            .map((r) => ({ day: isoDay(r.date), nav: Number(r.nav) }))
            .filter((r) => r.day && r.nav > 0)
            .sort((a, b) => a.day.localeCompare(b.day));
        if (!history.length) return null;
        const last = history[history.length - 1];
        const raw = j.meta?.scheme_name || "";
        const name = planName(raw, /etf/i.test(j.meta?.scheme_category || "") || /\betf\b|\bbees\b/i.test(raw)) || raw;
        // mfapi gives the category as AMFI writes it, "Equity Scheme - Small Cap Fund"
        const category = String(j.meta?.scheme_category || "").replace(/^(open ended|close ended|interval fund) schemes?\s*\((.+)\)$/i, "$2");
        return {
            code: Number(code),
            name,
            house: houseName(j.meta?.fund_house || ""),
            ...classify(category, name),
            nav: last.nav,
            date: last.day,
            since: history[0].day,
            returns: returnsOf(history),
        };
    });
}

module.exports = { allFunds, fundDetail, parseNavAll, planName, classify, returnsOf, isoDay };
