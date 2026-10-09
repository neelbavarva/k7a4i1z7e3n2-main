"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CandlestickChart, ChartPie, HandCoins, Landmark, Plus, TrendingUp, WalletMinimal } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { http } from "@/lib/http";
import { currenciesIn, currencyOf, perRupee, ratesOf, useCurrencyCode } from "@/lib/currency";
import { CurrencyMenu, Money } from "./k7/Money";
import NetWorth from "./NetWorth";
import Trades, { TradingStrip, useJournal, useTradeView } from "./Trades";

// Finance: everything about money on one page. One card on top: the net worth (the Real trading
// account's results counted in it), its history, where it sits, and what the trades add up to, with
// the account switch. Under it the accounts, a list that opens from its heading, then the trades:
// the time frame and pair filters, the breakdown and the journal. One currency for the whole page beside the title, one
// row of section tabs that stays under the top bar, and one Add menu for all of it.

const SECTIONS = [
    { id: "worth", label: "Overview" },
    { id: "accounts", label: "Accounts" },
    { id: "trades", label: "Trades" },
];

const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// the last rates read, kept in this browser: the page opens in its currency (dollars unless another
// is picked) at those while today's are read, not in rupees until they come
const FX_KEY = "worthFx";

/** The day's rates: rupees to the dollar (`rate`) and every currency the page can be shown in (`rates`). */
function useFx() {
    const [s, setS] = useState(() => {
        try {
            const data = JSON.parse(localStorage.getItem(FX_KEY) || "null");
            return data?.rate > 0 ? { state: "refreshing", data } : { state: "loading" };
        } catch {
            return { state: "loading" };
        }
    });
    const [ask, setAsk] = useState(0);
    useEffect(() => {
        let gone = false;
        http("/worth/fx").then(
            (data) => {
                if (gone) return;
                setS({ state: "ready", data });
                try {
                    localStorage.setItem(FX_KEY, JSON.stringify(data));
                } catch {
                    // storage blocked: today's rates only
                }
            },
            () => !gone && setS((p) => ({ ...p, state: "error" }))
        );
        return () => {
            gone = true;
        };
    }, [ask]);
    const reload = () => {
        setS((p) => ({ ...p, state: p.data ? "refreshing" : "loading" }));
        setAsk((n) => n + 1);
    };
    return { ...s, reload };
}

export default function Finance({ refreshKey, ask, onNewTrade }) {
    const journal = useJournal(refreshKey);
    const fx = useFx();
    // the trades' filters: the account in the top card, the time frame and pair over the journal
    const view = useTradeView(journal.trades);

    // the page's currency: one with a rate, else rupees. Trades (logged in dollars) turn into it too.
    const rates = ratesOf(fx.data);
    const [currency, setCurrency] = useCurrencyCode();
    const code = perRupee(currency, rates) != null ? currency : "INR";
    const k = perRupee(code, rates);
    const usd = fx.data?.rate || null;
    const money = { ...currencyOf(code), k, usd };
    const offered = currenciesIn(rates);

    /** The trades of one account (Real, Funded, Demo or Backtest), in the section below. */
    const showTrades = (type) => {
        view.setAccount(type);
        document.getElementById("trades")?.scrollIntoView({ block: "start", behavior: still() ? "auto" : "smooth" });
    };

    return (
        <Money.Provider value={money}>
            <section className="overview">
                <div className="overview-row">
                    <h1 className="overview-title">Finance</h1>
                    {offered.length > 1 && (
                        <div className="overview-actions">
                            <CurrencyMenu offered={offered} rates={rates} day={fx.data?.date} onPick={setCurrency} />
                        </div>
                    )}
                </div>
            </section>
            <SectionNav sections={SECTIONS} />
            <NetWorth ask={ask} fx={fx} journal={journal} band={<TradingStrip journal={journal} view={view} onNew={onNewTrade} />} onNewTrade={onNewTrade} onShowTrades={showTrades} />
            <Trades journal={journal} view={view} onNew={onNewTrade} />
        </Money.Provider>
    );
}

/**
 * The page's sections as tabs along the title's rule. Choosing one scrolls to it; scrolling lights
 * the one you're in. Wider than a phone, the row stays under the top bar once it gets there.
 */
function SectionNav({ sections }) {
    const [on, setOn] = useState(sections[0].id);
    const [stuck, setStuck] = useState(false);
    const nav = useRef(null);
    const ink = useRef(null);
    const chosen = useRef(null); // the tab just chosen, kept lit while the page scrolls to it
    const letGo = useRef(() => {}); // stops keeping it lit, once the scroll is over
    const ids = sections.map((s) => s.id).join(",");

    useEffect(() => {
        const list = ids.split(",");
        let settle = 0;
        // read on the scroll itself (browsers send one a frame at most): four boxes, nothing heavy
        const read = () => {
            const el = nav.current;
            if (!el) return;
            const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h")) || 0;
            const box = el.getBoundingClientRect();
            setStuck(window.scrollY > 0 && box.top <= bar + 0.5);
            if (chosen.current) return setOn(chosen.current);
            // the section you're in: the last one to have come up past the tabs
            let cur = list[0];
            for (const id of list) {
                const s = document.getElementById(id);
                if (s && s.getBoundingClientRect().top <= box.bottom + 48) cur = id;
            }
            // scrolled to the foot, the last one, however short
            const foot = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
            if (foot && window.scrollY > 0) cur = [...list].reverse().find((id) => document.getElementById(id)) || cur;
            setOn(cur);
        };
        // a moment after the last scroll (or straight away, if there was nothing to scroll), the tab
        // lit is the section you're in again
        letGo.current = (wait) => {
            clearTimeout(settle);
            settle = setTimeout(() => {
                chosen.current = null;
                read();
            }, wait);
        };
        const onScroll = () => {
            read();
            if (chosen.current) letGo.current(160);
        };
        read();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            clearTimeout(settle);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, [ids]);

    // the line under the lit tab, moved straight on the element; it glides once it's been placed
    useLayoutEffect(() => {
        const el = nav.current?.querySelector(`[data-id="${on}"]`);
        const line = ink.current;
        if (!el || !line) return;
        line.style.width = `${el.offsetWidth}px`;
        line.style.transform = `translateX(${el.offsetLeft}px)`;
        const id = requestAnimationFrame(() => nav.current?.classList.add("is-placed"));
        return () => cancelAnimationFrame(id);
    }, [on, ids]);

    const go = (id) => {
        chosen.current = id;
        setOn(id);
        const behavior = still() ? "auto" : "smooth";
        if (id === sections[0].id) window.scrollTo({ top: 0, behavior });
        else document.getElementById(id)?.scrollIntoView({ block: "start", behavior });
        letGo.current(400); // pushed back by each scroll on the way
    };

    return (
        <nav className={`fin-nav${stuck ? " is-stuck" : ""}`} ref={nav} aria-label="Finance sections">
            {sections.map((s) => (
                <button key={s.id} type="button" data-id={s.id} aria-current={on === s.id ? "true" : undefined} onClick={() => go(s.id)}>
                    {s.label}
                </button>
            ))}
            <span className="fin-nav-ink" ref={ink} aria-hidden="true" />
        </nav>
    );
}

const ADDS = [
    { what: "trade", label: "Trade", hint: "Logged and graded against your checklist", icon: CandlestickChart },
    "-",
    { what: "balance", kind: "bank", label: "Bank balance", hint: "Savings, a deposit or cash", icon: Landmark },
    { what: "balance", kind: "funds", label: "Mutual funds", hint: "On Groww or anywhere", icon: ChartPie },
    { what: "balance", kind: "invest", label: "Investment account", hint: "A broker the page can’t read, like Merrill", icon: TrendingUp },
    { what: "wallet", label: "Crypto wallet", hint: "Read from its public addresses", icon: WalletMinimal },
    { what: "balance", kind: "loan", label: "Loan", hint: "Taken off the total", icon: HandCoins },
];

/**
 * The top bar's Add on the Finance page: a trade, or anything that counts towards the net worth.
 * Opened from the keyboard (N), Trade is lit, so N then Enter starts a trade. What's picked opens
 * once the menu has closed, so the dialog keeps the focus.
 */
export function AddMenu({ open, onOpenChange, onTrade, onAsk }) {
    const next = useRef(null);
    return (
        <DropdownMenu.Root open={open} onOpenChange={onOpenChange} modal={false}>
            <DropdownMenu.Trigger asChild>
                <button type="button" className="btn btn-primary">
                    <Plus aria-hidden="true" />
                    <span className="btn-label">Add</span>
                    <kbd>N</kbd>
                </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    className="menu fin-add"
                    align="end"
                    sideOffset={6}
                    collisionPadding={16}
                    onCloseAutoFocus={(e) => {
                        const fn = next.current;
                        if (!fn) return;
                        next.current = null;
                        e.preventDefault();
                        fn();
                    }}
                >
                    {ADDS.map((it, i) =>
                        it === "-" ? (
                            <DropdownMenu.Separator key={i} className="menu-sep" />
                        ) : (
                            <DropdownMenu.Item
                                key={it.label}
                                className="menu-item"
                                onSelect={() => {
                                    next.current = it.what === "trade" ? onTrade : () => onAsk(it.what, it.kind);
                                }}
                            >
                                <it.icon aria-hidden="true" />
                                <span>
                                    {it.label}
                                    <small>{it.hint}</small>
                                </span>
                            </DropdownMenu.Item>
                        )
                    )}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
