// The currency the Finance page is shown in, dollars unless another is picked. Everything is added
// up in rupees, then shown in the currency picked (remembered in this browser), accounts' own panels
// too; a typed-in balance is typed in it and kept in the account's own currency. Rates are each
// currency per US dollar, from /worth/fx.

import { useCallback, useState } from "react";

export const CURRENCIES = [
    { code: "INR", symbol: "₹", name: "Indian Rupee" },
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "AED", symbol: "AED", name: "UAE Dirham", spaced: true },
    { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
    { code: "JPY", symbol: "¥", name: "Japanese Yen", whole: true },
    { code: "AUD", symbol: "A$", name: "Australian Dollar" },
    { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
    { code: "CHF", symbol: "CHF", name: "Swiss Franc", spaced: true },
];

/** The ones the menu shows first, in this order; the rest follow by name. */
export const POPULAR = ["INR", "USD", "AED", "EUR", "GBP", "SGD"];

// the sign people know a currency by, where the code would otherwise stand in for it
const SIGNS = {
    CNY: "¥", NZD: "NZ$", HKD: "HK$", KRW: "₩", ILS: "₪", THB: "฿", TRY: "₺", PHP: "₱", BRL: "R$", MXN: "MX$", ZAR: "R",
    PLN: "zł", IDR: "Rp", MYR: "RM", CZK: "Kč", HUF: "Ft", SEK: "kr", NOK: "kr", DKK: "kr", ISK: "kr", RON: "lei", BGN: "лв",
};
// no cents in everyday use
const WHOLE = new Set(["JPY", "KRW", "HUF", "ISK", "IDR"]);
// the flags in public/flags, by currency
const FLAGS = { INR: "IN", USD: "US", EUR: "EU", GBP: "GB", AED: "AE", JPY: "JP", AUD: "AU", CAD: "CA", CHF: "CH", NZD: "NZ" };
export const flagOf = (code) => FLAGS[code] || null;

let names = null;
/** A currency's name in English, as the browser knows it ("Swedish Krona"). */
function nameOf(code) {
    try {
        names ??= new Intl.DisplayNames(["en"], { type: "currency" });
        const n = names.of(code);
        return n && n !== code ? n.replace(/^./, (c) => c.toUpperCase()) : code;
    } catch {
        return code;
    }
}

const made = new Map(CURRENCIES.map((c) => [c.code, c]));
/** Any currency by its code: its sign (a word-like one, "kr", "AED", is set apart), name and whether it has cents. */
export function currencyOf(code) {
    if (!/^[A-Z]{3}$/.test(code || "")) return CURRENCIES[0];
    if (!made.has(code)) {
        const symbol = SIGNS[code] || code;
        made.set(code, { code, symbol, name: nameOf(code), spaced: /^\p{L}{2,}$/u.test(symbol), whole: WHOLE.has(code) });
    }
    return made.get(code);
}

/** Each currency per US dollar: the API's `rates`, or from `rate` alone the dollar and the rupee. */
export function ratesOf(fx) {
    if (fx?.rates?.INR > 0) return fx.rates;
    if (fx?.rate > 0) return { USD: 1, INR: fx.rate };
    return { INR: 1 };
}

/** Every currency there's a rate for: the popular ones first, then the rest by name. */
export function currenciesIn(rates) {
    const codes = new Set(["INR", ...Object.keys(rates || {})]);
    const rank = (c) => (POPULAR.includes(c.code) ? POPULAR.indexOf(c.code) : POPULAR.length);
    return [...codes]
        .filter((c) => perRupee(c, rates) != null)
        .map(currencyOf)
        .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** How much of a currency one rupee is, or null with no rate for it. */
export function perRupee(code, rates) {
    if (code === "INR") return 1;
    const r = rates?.[code];
    const inr = rates?.INR;
    return r > 0 && inr > 0 ? r / inr : null;
}

/**
 * An amount in any currency as rupees, at the day's rates: what every total is worked out in. Null
 * without a rate for the currency, so a missing rate is never read as zero or as one.
 */
export function toRupees(amount, code, rates) {
    const k = perRupee(code || "INR", rates);
    return k ? (Number(amount) || 0) / k : null;
}

/** Rupees as an amount in `code`; null without a rate for it. */
export function fromRupees(rupees, code, rates) {
    const k = perRupee(code || "INR", rates);
    return k ? (Number(rupees) || 0) * k : null;
}

/** An amount from one currency into another, through rupees; the same amount when they're the same. */
export function convert(amount, from, to, rates) {
    const a = from || "INR";
    const b = to || "INR";
    if (a === b) return Number(amount) || 0;
    const r = toRupees(amount, a, rates);
    return r == null ? null : fromRupees(r, b, rates);
}

/** An amount rounded the way the currency is written: to the cent, or whole for yen and the like. */
export function roundIn(amount, code) {
    const places = currencyOf(code || "INR").whole ? 0 : 2;
    return Math.round((Number(amount) || 0) * 10 ** places) / 10 ** places;
}

const fmt = {};
const grouping = (code, digits) => (fmt[`${code}:${digits}`] ??= new Intl.NumberFormat(code === "INR" ? "en-IN" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }));

/**
 * An amount (already in the currency `cur`) as parts to set: { neg, symbol, int, frac, unit }.
 * `short`: rupees in lakh and crore (6.63 L), the others in thousands, millions and billions
 * (12.6K, 1.24M). `paise`: "auto" (the cents shown unless .00), "always" or "never".
 */
export function moneyParts(x, cur, { short = false, paise = "auto" } = {}) {
    const n = Number(x) || 0;
    const a = Math.abs(n);
    const out = { neg: n < 0, symbol: cur.symbol, spaced: Boolean(cur.spaced), int: "", frac: "", unit: "" };
    // [from, in units of, unit, decimals]: thousands only from ten thousand ($4,372, then $43.7 K)
    const units = cur.code === "INR" ? [[1e7, 1e7, "Cr", 2], [1e5, 1e5, "L", 2]] : [[1e9, 1e9, "B", 2], [1e6, 1e6, "M", 2], [1e4, 1e3, "K", 1]];
    const big = short && units.find(([from]) => a >= from);
    if (big) {
        const [, per, unit, digits] = big;
        [out.int, out.frac] = (a / per).toFixed(digits).split(".");
        out.frac = out.frac ? `.${out.frac}` : "";
        out.unit = unit;
        return out;
    }
    // whole units are rounded, not cut: 1.95 without its cents is 2
    const digits = cur.whole || paise === "never" || short ? 0 : 2;
    [out.int, out.frac = ""] = grouping(cur.code, digits).format(a).split(".");
    out.frac = !out.frac || (paise === "auto" && /^0+$/.test(out.frac)) ? "" : `.${out.frac}`;
    return out;
}

/** The same as text: "₹1,843.42", "$19.06", "AED 70.03"; `sign` puts a + on gains. */
export function moneyText(x, cur, { short = false, paise = "auto", sign = false } = {}) {
    const p = moneyParts(x, cur, { short, paise });
    const lead = p.neg ? "−" : sign && Number(x) > 0 ? "+" : "";
    return `${lead}${p.symbol}${p.spaced ? " " : ""}${p.int}${p.frac}${p.unit ? ` ${p.unit}` : ""}`;
}

// A key of its own: the one before ("worthCurrency") was written on every visit, so the rupees kept
// there weren't anyone's choice. This one is written only when a currency is picked.
const KEY = "financeCurrency";
/** The page's currency until another is picked. */
export const DEFAULT_CURRENCY = "USD";

/** The currency picked for the Finance page, remembered in this browser; dollars until one is. */
export function useCurrencyCode() {
    const [code, setCode] = useState(() => {
        try {
            return (typeof window !== "undefined" && localStorage.getItem(KEY)) || DEFAULT_CURRENCY;
        } catch {
            return DEFAULT_CURRENCY;
        }
    });
    const pick = useCallback((next) => {
        setCode(next);
        try {
            localStorage.setItem(KEY, next);
        } catch {
            // storage blocked: it lasts until the page is closed
        }
    }, []);
    return [code, pick];
}
