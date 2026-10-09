// Indian mutual funds to pick from when a holding is typed in. The full list (every Direct Growth
// plan and ETF, about 2,000) comes from the API, which reads AMFI's daily NAV file; it loads in
// lib/fundList.js. FUNDS below are the well-known ones: shown first as the popular picks, and the
// whole list when the API's can't be had. Names are the current ones; `aka` keeps a scheme's old
// name findable after SEBI's renames (SBI Bluechip → SBI Large Cap).
// A fund house that's a bank's (SBI, HDFC, Axis…) carries that bank's logo from public/logos.

import { BANKS } from "./cards";

const bank = (id) => ({ bank: BANKS.find((b) => b.id === id) });

/** Fund houses (AMCs): the short name AMFI and Groww use, their mark, and how AMFI's name for them starts. */
export const AMCS = [
    { id: "sbi", name: "SBI", mark: bank("sbi"), match: /^sbi\b/i },
    { id: "hdfc", name: "HDFC", mark: bank("hdfc"), match: /^hdfc\b/i },
    { id: "icici", name: "ICICI Prudential", mark: bank("icici"), match: /^icici\b/i },
    { id: "nippon", name: "Nippon India", mark: { glyph: "fund" }, match: /^nippon\b/i },
    { id: "axis", name: "Axis", mark: bank("axis"), match: /^axis\b/i },
    { id: "kotak", name: "Kotak Mahindra", mark: bank("kotak"), match: /^kotak\b/i },
    { id: "ppfas", name: "PPFAS", mark: { glyph: "fund" }, match: /^(ppfas|parag parikh)\b/i },
    { id: "mirae", name: "Mirae Asset", mark: { glyph: "fund" }, match: /^mirae\b/i },
    { id: "uti", name: "UTI", mark: { glyph: "fund" }, match: /^uti\b/i },
    { id: "absl", name: "Aditya Birla Sun Life", mark: { glyph: "fund" }, match: /^aditya birla\b/i },
    { id: "dsp", name: "DSP", mark: { glyph: "fund" }, match: /^dsp\b/i },
    { id: "tata", name: "Tata", mark: { glyph: "fund" }, match: /^tata\b/i },
    { id: "motilal", name: "Motilal Oswal", mark: { glyph: "fund" }, match: /^motilal\b/i },
    { id: "quant", name: "Quant", mark: { glyph: "fund" }, match: /^quant\b/i },
    { id: "canara", name: "Canara Robeco", mark: bank("canara"), match: /^canara\b/i },
    { id: "franklin", name: "Franklin Templeton", mark: { glyph: "fund" }, match: /^franklin\b/i },
    { id: "hsbc", name: "HSBC", mark: bank("hsbc"), match: /^hsbc\b/i },
    { id: "bandhan", name: "Bandhan", mark: bank("bandhan"), match: /^bandhan\b/i },
    { id: "edelweiss", name: "Edelweiss", mark: { glyph: "fund" }, match: /^edelweiss\b/i },
    { id: "quantum", name: "Quantum", mark: { glyph: "fund" }, match: /^quantum\b/i },
    { id: "navi", name: "Navi", mark: { glyph: "fund" }, match: /^navi\b/i },
    { id: "zerodha", name: "Zerodha", mark: { brand: "zerodha" }, match: /^zerodha\b/i },
    { id: "groww", name: "Groww", mark: { brand: "groww" }, match: /^groww\b/i },
];

/**
 * The house a name belongs to: AMFI's name for a house ("Nippon India"), or a fund's own name
 * ("Nippon India Small Cap Fund"), which starts with its house's. One not listed gets a plain mark.
 */
export function houseOf(text) {
    const t = String(text || "").trim();
    if (!t) return null;
    return AMCS.find((a) => a.match.test(t)) || { id: norm(t).replace(/ /g, "-"), name: t, mark: { glyph: "fund" } };
}

/** What a fund is, for filtering and for the line under its name. */
export const FUND_KINDS = [
    { id: "equity", label: "Equity" },
    { id: "index", label: "Index and ETFs" },
    { id: "gold", label: "Gold and silver" },
    { id: "elss", label: "Tax saving" },
    { id: "hybrid", label: "Hybrid" },
    { id: "debt", label: "Debt" },
    { id: "global", label: "Global" },
];

// what a listed fund is called, the way Groww says it, when it hasn't come from AMFI
const CATEGORY = { equity: "Equity", index: "Equity Index", elss: "Equity ELSS", hybrid: "Hybrid", debt: "Debt", global: "Equity International" };
const categoryOf = (name, kind) => (kind === "gold" ? `Commodities ${/silver/i.test(name) ? "Silver" : "Gold"}` : /\betf\b|bees/i.test(name) && kind === "index" ? "Equity ETF" : CATEGORY[kind] || "Mutual fund");

const f = (amc, name, kind, aka = []) => ({ amc, name, kind, aka });

export const FUNDS = [
    // SBI
    f("sbi", "SBI Gold Fund", "gold"),
    f("sbi", "SBI Gold ETF", "gold", ["SBI ETF Gold"]),
    f("sbi", "SBI Silver ETF", "gold"),
    f("sbi", "SBI Nifty Index Fund", "index", ["SBI Nifty 50 Index Fund"]),
    f("sbi", "SBI Large Cap Fund", "equity", ["SBI Bluechip Fund"]),
    f("sbi", "SBI Small Cap Fund", "equity"),
    f("sbi", "SBI Contra Fund", "equity"),
    f("sbi", "SBI Magnum Midcap Fund", "equity", ["SBI Midcap Fund"]),
    f("sbi", "SBI Focused Fund", "equity", ["SBI Focused Equity Fund"]),
    f("sbi", "SBI ELSS Tax Saver Fund", "elss", ["SBI Long Term Equity Fund"]),
    f("sbi", "SBI Equity Hybrid Fund", "hybrid"),
    // HDFC
    f("hdfc", "HDFC Gold ETF Fund of Fund", "gold", ["HDFC Gold Fund"]),
    f("hdfc", "HDFC Gold ETF", "gold"),
    f("hdfc", "HDFC Nifty 50 Index Fund", "index", ["HDFC Index Fund Nifty 50 Plan"]),
    f("hdfc", "HDFC Flexi Cap Fund", "equity"),
    f("hdfc", "HDFC Large Cap Fund", "equity", ["HDFC Top 100 Fund"]),
    f("hdfc", "HDFC Mid Cap Fund", "equity", ["HDFC Mid-Cap Opportunities Fund"]),
    f("hdfc", "HDFC Small Cap Fund", "equity"),
    f("hdfc", "HDFC ELSS Tax Saver", "elss", ["HDFC Tax Saver"]),
    f("hdfc", "HDFC Balanced Advantage Fund", "hybrid"),
    // ICICI Prudential
    f("icici", "ICICI Prudential Regular Gold Savings Fund (FOF)", "gold", ["ICICI Prudential Gold Fund"]),
    f("icici", "ICICI Prudential Gold ETF", "gold"),
    f("icici", "ICICI Prudential Silver ETF", "gold"),
    f("icici", "ICICI Prudential Nifty 50 Index Fund", "index"),
    f("icici", "ICICI Prudential Large Cap Fund", "equity", ["ICICI Prudential Bluechip Fund"]),
    f("icici", "ICICI Prudential Value Fund", "equity", ["ICICI Prudential Value Discovery Fund"]),
    f("icici", "ICICI Prudential Technology Fund", "equity"),
    f("icici", "ICICI Prudential Balanced Advantage Fund", "hybrid"),
    // Nippon India
    f("nippon", "Nippon India ETF Gold BeES", "gold", ["Gold BeES", "GOLDBEES"]),
    f("nippon", "Nippon India Gold Savings Fund", "gold"),
    f("nippon", "Nippon India Silver ETF", "gold", ["SILVERBEES"]),
    f("nippon", "Nippon India ETF Nifty 50 BeES", "index", ["Nifty BeES", "NIFTYBEES"]),
    f("nippon", "Nippon India Small Cap Fund", "equity"),
    f("nippon", "Nippon India Growth Mid Cap Fund", "equity", ["Nippon India Growth Fund"]),
    f("nippon", "Nippon India Large Cap Fund", "equity"),
    f("nippon", "Nippon India Multi Cap Fund", "equity"),
    // Axis
    f("axis", "Axis Gold Fund", "gold"),
    f("axis", "Axis Large Cap Fund", "equity", ["Axis Bluechip Fund"]),
    f("axis", "Axis Midcap Fund", "equity"),
    f("axis", "Axis Small Cap Fund", "equity"),
    f("axis", "Axis ELSS Tax Saver Fund", "elss", ["Axis Long Term Equity Fund"]),
    // Kotak
    f("kotak", "Kotak Gold Fund", "gold"),
    f("kotak", "Kotak Flexicap Fund", "equity"),
    f("kotak", "Kotak Midcap Fund", "equity", ["Kotak Emerging Equity Fund"]),
    f("kotak", "Kotak Small Cap Fund", "equity"),
    // PPFAS
    f("ppfas", "Parag Parikh Flexi Cap Fund", "equity", ["PPFAS"]),
    f("ppfas", "Parag Parikh ELSS Tax Saver Fund", "elss", ["Parag Parikh Tax Saver Fund"]),
    f("ppfas", "Parag Parikh Conservative Hybrid Fund", "hybrid"),
    // Mirae Asset
    f("mirae", "Mirae Asset Large Cap Fund", "equity"),
    f("mirae", "Mirae Asset Large & Midcap Fund", "equity", ["Mirae Asset Emerging Bluechip Fund"]),
    f("mirae", "Mirae Asset ELSS Tax Saver Fund", "elss", ["Mirae Asset Tax Saver Fund"]),
    f("mirae", "Mirae Asset NYSE FANG+ ETF Fund of Fund", "global", ["FANG"]),
    // UTI
    f("uti", "UTI Nifty 50 Index Fund", "index"),
    f("uti", "UTI Nifty Next 50 Index Fund", "index"),
    f("uti", "UTI Flexi Cap Fund", "equity"),
    // Aditya Birla Sun Life
    f("absl", "Aditya Birla Sun Life Gold Fund", "gold", ["ABSL Gold Fund"]),
    f("absl", "Aditya Birla Sun Life Large Cap Fund", "equity", ["Aditya Birla Sun Life Frontline Equity Fund", "ABSL Frontline Equity"]),
    // DSP
    f("dsp", "DSP Midcap Fund", "equity"),
    f("dsp", "DSP Small Cap Fund", "equity"),
    f("dsp", "DSP ELSS Tax Saver Fund", "elss", ["DSP Tax Saver Fund"]),
    // Tata
    f("tata", "Tata Digital India Fund", "equity"),
    f("tata", "Tata Small Cap Fund", "equity"),
    // Motilal Oswal
    f("motilal", "Motilal Oswal Midcap Fund", "equity"),
    f("motilal", "Motilal Oswal Flexi Cap Fund", "equity"),
    f("motilal", "Motilal Oswal Nasdaq 100 Fund of Fund", "global", ["Nasdaq 100"]),
    f("motilal", "Motilal Oswal S&P 500 Index Fund", "global", ["S&P 500"]),
    // Quant
    f("quant", "Quant Small Cap Fund", "equity"),
    f("quant", "Quant Active Fund", "equity"),
    f("quant", "Quant ELSS Tax Saver Fund", "elss", ["Quant Tax Plan"]),
    // Canara Robeco
    f("canara", "Canara Robeco Large Cap Fund", "equity", ["Canara Robeco Bluechip Equity Fund"]),
    f("canara", "Canara Robeco Large and Mid Cap Fund", "equity", ["Canara Robeco Emerging Equities"]),
    // Franklin Templeton
    f("franklin", "Franklin India Flexi Cap Fund", "equity"),
    f("franklin", "Franklin India Mid Cap Fund", "equity", ["Franklin India Prima Fund"]),
    // the rest
    f("hsbc", "HSBC Small Cap Fund", "equity"),
    f("bandhan", "Bandhan Small Cap Fund", "equity"),
    f("bandhan", "Bandhan Value Fund", "equity", ["Bandhan Sterling Value Fund", "IDFC Sterling Value Fund"]),
    f("edelweiss", "Edelweiss Nifty Midcap150 Momentum 50 Index Fund", "index"),
    f("quantum", "Quantum Gold Savings Fund", "gold"),
    f("navi", "Navi Nifty 50 Index Fund", "index"),
    f("zerodha", "Zerodha Nifty LargeMidcap 250 Index Fund", "index"),
    f("groww", "Groww Nifty Total Market Index Fund", "index"),
].map((x) => ({ ...x, house: AMCS.find((a) => a.id === x.amc), category: categoryOf(x.name, x.kind), popular: true }));

function norm(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

// Every fund listed is its Direct Growth plan, so the plan's words ("SBI Gold Direct Plan Growth",
// as Groww writes it) narrow nothing: searches and names are read without them.
const PLAN_WORDS = new Set(["direct", "plan", "growth", "option", "dir", "gr"]);
const wordsOf = (s) =>
    norm(s)
        .split(" ")
        .filter((w) => w && !PLAN_WORDS.has(w));
// a name to compare: without the plan, or "Fund" ("SBI Gold Direct Plan Growth" is SBI Gold Fund)
const keyOf = (s) =>
    wordsOf(s)
        .filter((w) => w !== "fund" && w !== "funds")
        .join(" ");

// a listed fund's old names, by its current one, for the full list to be found by them too
const AKA = new Map(FUNDS.map((x) => [norm(x.name), x.aka]));

/**
 * A fund from the API's list (AMFI's), in the shape the picker uses: its code, its house and
 * mark, its kind and category; the well-known ones keep their old names and come first.
 */
export function fromApi(f) {
    const key = norm(f.name);
    return { code: f.code, name: f.name, kind: f.kind, category: f.category, house: houseOf(f.house) || houseOf(f.name), amc: null, aka: AKA.get(key) || [], popular: AKA.has(key) };
}

/** The listed fund a stored name is, by its name or an old one, with or without its plan's words. */
export function fundOf(name, list = FUNDS) {
    const k = keyOf(name);
    if (!k) return null;
    return list.find((x) => keyOf(x.name) === k || x.aka.some((a) => keyOf(a) === k)) || null;
}

// each fund's words to search, worked out once per fund
const hays = new WeakMap();
const hayOf = (x) => {
    if (!hays.has(x)) hays.set(x, ` ${norm([x.name, ...x.aka, x.house?.name, x.category, fundKindLabel(x.kind)].join(" "))} `);
    return hays.get(x);
};

/**
 * Funds matching what's typed: every word somewhere in the name, an old name, the house or the
 * category. Best first: the well-known ones, then a name that starts with the first word typed.
 */
export function searchFunds(query, kind = "all", list = FUNDS) {
    const words = wordsOf(query);
    const found = list.filter((x) => (kind === "all" || x.kind === kind) && words.every((w) => hayOf(x).includes(` ${w}`)));
    if (!words.length) return found;
    const starts = (x) => (norm(x.name).startsWith(words[0]) ? 0 : 1);
    return found
        .map((x, i) => ({ x, i }))
        .sort((a, b) => Number(!a.x.popular) - Number(!b.x.popular) || starts(a.x) - starts(b.x) || a.i - b.i)
        .map((r) => r.x);
}

export const fundKindLabel = (id) => FUND_KINDS.find((k) => k.id === id)?.label || "";
