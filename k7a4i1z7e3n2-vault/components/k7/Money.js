"use client";

import { createContext, useContext, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover } from "radix-ui";
import { num } from "@/lib/kite";
import { money as usdText } from "@/lib/format";
import { POPULAR, currencyOf, flagOf, moneyParts, moneyText, perRupee } from "@/lib/currency";
import { useCountUp } from "./hooks";

// The currency the Finance page is shown in, for both halves: what you own (worked out in rupees)
// and how the trading went (trades are logged in dollars). Finance provides it; Fig and the text
// helpers turn an amount into it as it's set.

/**
 * `k`: how much of the page's currency one rupee is. `usd`: rupees to the dollar today, for trades
 * (null until the rates are in). Every figure is worked out in rupees first (see lib/currency.js).
 */
export const Money = createContext({ ...currencyOf("INR"), k: 1, usd: null });

/** A rupee amount as text in the page's currency (for the figures inside sentences and tooltips). */
export function useMoneyText() {
    const m = useContext(Money);
    return (inrValue, o) => moneyText((Number(inrValue) || 0) * m.k, m, o);
}

/**
 * A trade's result (in dollars) in the page's currency: `inr(x)` to set with Fig (null without a
 * rate), `text(x)` signed, for rows and sentences. Dollars stay as they were logged, cents and all;
 * anything else comes from a conversion, so it's rounded to whole units. Without a rate yet, dollars.
 */
export function useUsd() {
    const m = useContext(Money);
    const text = useMoneyText();
    return {
        rate: m.usd,
        inr: (x) => (m.usd ? (Number(x) || 0) * m.usd : null),
        text: (x, o = {}) => (m.usd ? text((Number(x) || 0) * m.usd, { sign: true, paise: m.code === "USD" ? "auto" : "never", ...o }) : usdText(x, o)),
    };
}

/**
 * Money set for reading, in the figures font (IBM Plex Sans, see --figs): lining, tabular figures and
 * the currency's own sign. `value` is in rupees, shown in the page's currency. `short` uses lakh and
 * crore for rupees (₹6.63 L), K, M and B for the others; `paise` is "auto" (shown unless .00),
 * "always" or "never"; `sign` puts a + on a gain (a result, not a balance).
 */
export function Fig({ value, short, paise = "auto", sign = false, className = "" }) {
    const m = useContext(Money);
    const n = (Number(value) || 0) * m.k;
    const p = moneyParts(n, m, { short, paise });
    const plus = sign && n > 0;
    const words = { L: "lakh", Cr: "crore", K: "thousand", M: "million", B: "billion" };
    return (
        <span className={`fig ${className}${p.neg ? " is-neg" : ""}`} aria-label={`${p.neg ? "minus " : plus ? "plus " : ""}${p.symbol}${p.int}${p.frac}${p.unit ? ` ${words[p.unit]}` : ""}`}>
            <span aria-hidden="true">
                {p.neg || plus ? <span className="fig-sign">{p.neg ? "−" : "+"}</span> : null}
                <span className={`fig-cur${p.spaced ? " is-code" : ""}`}>{p.symbol}</span>
                <span className="fig-int">{p.int}</span>
                {/* paise a shade lighter; the decimals of a short figure (6.63 L) are part of it */}
                {p.frac ? <span className={p.unit ? "fig-dec" : "fig-frac"}>{p.frac}</span> : null}
                {p.unit ? <span className="fig-unit">{p.unit}</span> : null}
            </span>
        </span>
    );
}

/** A headline figure, counting up to a new value. */
export function BigFig({ value, sign = false }) {
    const v = useCountUp(value);
    return <Fig value={Math.round(v * 100) / 100} paise="always" sign={sign} className="fig-big" />;
}

/** A currency's flag, round; one without a flag here gets its sign in a quiet circle. */
export function CurrencyMark({ c, size = 18 }) {
    const flag = flagOf(c.code);
    if (flag)
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="nw-cur-flag" src={`/flags/${flag}.svg`} alt="" width={size} height={size} draggable="false" />
        );
    return (
        <span className={`nw-cur-tile${c.symbol.length > 2 ? " is-long" : ""}`} style={{ "--s": `${size}px` }} aria-hidden="true">
            {c.symbol}
        </span>
    );
}

/**
 * The currency the whole Finance page is shown in, net worth and trades alike: every one the day's
 * rates cover (the ECB's, and the Gulf ones by their dollar pegs), searched by name or code, the
 * usual few first. Under the list, what the one picked is worth in rupees today.
 */
export function CurrencyMenu({ offered, rates, day, onPick }) {
    const m = useContext(Money);
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const query = q.trim().toLowerCase();
    const found = query ? offered.filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(query)) : offered;
    const common = query ? [] : found.filter((c) => POPULAR.includes(c.code));
    const rest = query ? found : found.filter((c) => !POPULAR.includes(c.code));
    const pick = (code) => {
        onPick(code);
        setOpen(false);
        setQ("");
    };
    // arrows move between the rows; Enter in the search picks the first match
    const step = (e) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        e.preventDefault();
        const rows = [...e.currentTarget.closest(".nw-cur-menu").querySelectorAll(".nw-cur-row")];
        const i = rows.indexOf(document.activeElement);
        rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
    };
    const row = (c) => (
        <button key={c.code} type="button" role="option" aria-selected={c.code === m.code} className={`nw-cur-row${c.code === m.code ? " is-on" : ""}`} onClick={() => pick(c.code)} onKeyDown={step}>
            <CurrencyMark c={c} />
            <span className="nw-cur-name">{c.name}</span>
            <span className="nw-cur-code">{c.code}</span>
            {c.code === m.code ? <Check className="nw-cur-check" aria-hidden="true" /> : null}
        </button>
    );
    const inRupees = m.code === "INR" ? null : 1 / perRupee(m.code, rates);
    const dayText = day ? new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "today";
    return (
        <Popover.Root
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) setQ("");
            }}
        >
            <Popover.Trigger asChild>
                <button type="button" className="btn nw-cur" aria-label={`Shown in ${m.name}. Change currency`} title="Show the whole page in another currency">
                    <CurrencyMark c={m} size={15} />
                    <span className="btn-label">{m.code}</span>
                    <ChevronDown aria-hidden="true" />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content className="menu nw-cur-menu" align="end" sideOffset={6} collisionPadding={16}>
                    <div className="nw-cur-search">
                        <Search aria-hidden="true" />
                        <input
                            autoFocus
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && found[0]) pick(found[0].code);
                                else step(e);
                            }}
                            placeholder={`Search ${offered.length} currencies`}
                            aria-label="Search currencies"
                            autoComplete="off"
                            spellCheck="false"
                        />
                    </div>
                    <div className="nw-cur-list" role="listbox" aria-label="Currencies">
                        {common.length > 0 && <p className="nw-cur-head">Common</p>}
                        {common.map(row)}
                        {!query && rest.length > 0 && <p className="nw-cur-head">All currencies</p>}
                        {rest.map(row)}
                        {!found.length && <p className="nw-cur-none">No currency by that name.</p>}
                    </div>
                    <p className="nw-cur-foot">
                        {inRupees ? (
                            <>
                                <b>
                                    1 {m.code} = ₹{num(inRupees)}
                                </b>{" "}
                                ·{" "}
                            </>
                        ) : null}
                        ECB rates, {dayText}. Trades and accounts turn into it at today’s rate; each keeps its own inside.
                    </p>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}

