"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { FUND_KINDS, FUNDS, fundOf, houseOf, searchFunds } from "@/lib/funds";
import { useFundList } from "@/lib/fundList";
import { Mark } from "./Marks";

const PAGE = 60; // rows drawn at a time; more as you scroll or arrow down

const still = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const shortDay = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");

/** A fund house's logo in a tile, the way fund lists show them. */
export const FundTile = ({ house, size = 36 }) => (
    <span className="fund-tile" style={{ "--ts": `${size}px` }} aria-hidden="true">
        <Mark mark={house?.mark || { glyph: "fund" }} size={Math.round(size * 0.62)} />
    </span>
);

/**
 * The fund a mutual fund holding is in: a field showing the one picked (its house's logo, its
 * name, its category), opening onto every fund in India: the well-known ones first, filtered by
 * kind, searched by any words of the name, an old name, the house or the category. Anything not
 * listed can be used as typed.
 * value: the fund's name ("" for none); scheme: its AMFI code, if it was picked from the list.
 * onChange(name, fund) gets the fund from the list, or null for a name typed in.
 */
export default function FundPicker({ value, scheme, onChange }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [kind, setKind] = useState("all");
    const [active, setActive] = useState(0);
    const [limit, setLimit] = useState(PAGE);
    const uid = useId();
    const wrap = useRef(null);
    const field = useRef(null);
    const listEl = useRef(null);
    const panel = useRef(null);
    // the full list loads once a fund is shown or the list is opened
    const all = useFundList(open || Boolean(value));
    const list = all.status === "ready" ? all.list : FUNDS;
    const full = all.status === "ready";
    const fund = (scheme && full ? list.find((x) => x.code === scheme) : null) || fundOf(value, list) || fundOf(value);

    const q = query.trim();
    const browsing = !q && kind === "all";
    // browsing: the well-known funds; filtered or searched: everything that matches
    const found = browsing ? list.filter((x) => x.popular) : searchFunds(q, kind, list);
    const shown = found.slice(0, limit);
    // what's typed, to use as it is: last, once every match is drawn
    const custom = q && !fundOf(q, list) && shown.length === found.length ? { custom: q } : null;
    const options = [...shown, ...(custom ? [custom] : [])];
    const optId = (i) => `${uid}-opt-${i}`;
    const counts = Object.fromEntries(FUND_KINDS.map((k) => [k.id, 0]));
    for (const x of list) if (x.kind in counts) counts[x.kind]++;

    useEffect(() => {
        if (!open) return;
        const away = (e) => {
            if (!wrap.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener("pointerdown", away);
        return () => document.removeEventListener("pointerdown", away);
    }, [open]);

    // opened low in the dialog: scrolled up into view, clear of the dialog's foot (a frame on, once
    // the search box has taken focus, which would stop a scroll already under way)
    useEffect(() => {
        if (!open) return;
        const id = requestAnimationFrame(() => panel.current?.scrollIntoView({ block: "nearest", behavior: still() ? "auto" : "smooth" }));
        return () => cancelAnimationFrame(id);
    }, [open]);

    useEffect(() => {
        if (open) document.getElementById(optId(active))?.scrollIntoView({ block: "nearest" });
        // optId only depends on uid, which never changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, open]);

    const restart = () => {
        setActive(0);
        setLimit(PAGE);
        listEl.current?.scrollTo({ top: 0 });
    };
    const close = () => {
        setOpen(false);
        setQuery("");
        setActive(0);
        setLimit(PAGE);
        field.current?.focus();
    };
    const choose = (opt) => {
        if (!opt) return;
        if (opt.custom) onChange(opt.custom, null);
        else onChange(opt.name, opt.code ? opt : null);
        close();
    };
    const more = () => setLimit((l) => (l < found.length ? l + PAGE : l));
    const onKey = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            const last = options.length - 1;
            // past the last row drawn: draw the next lot and step into it
            if (active >= last && shown.length < found.length) {
                more();
                setActive(active + 1);
            } else setActive(Math.min(Math.max(last, 0), active + 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive(Math.max(0, active - 1));
        } else if (e.key === "Enter") {
            e.preventDefault(); // never submit the form from here
            choose(options[active]);
        } else if (e.key === "Escape" && value) {
            close(); // the dialog leaves this Esc to us (data-own-escape)
        }
    };

    const row = (opt, i) => (
        <div
            key={opt.custom ? "custom" : `${opt.code || ""}:${opt.name}`}
            id={optId(i)}
            role="option"
            aria-selected={i === active}
            className={`fund-row${opt.custom ? " is-custom" : ""}${i === active ? " is-active" : ""}`}
            onPointerMove={() => i !== active && setActive(i)}
            onMouseDown={(e) => e.preventDefault()} // keep focus in the search box
            onClick={() => choose(opt)}
        >
            {opt.custom ? (
                <>
                    <span className="fund-tile is-add" style={{ "--ts": "34px" }} aria-hidden="true">
                        <Plus />
                    </span>
                    <span className="fund-row-text">
                        <b>
                            Use “<span>{opt.custom}</span>”
                        </b>
                        <small>Not in the list: kept as you typed it</small>
                    </span>
                </>
            ) : (
                <>
                    <FundTile house={opt.house} size={34} />
                    <span className="fund-row-text">
                        <b>{opt.name}</b>
                        <small>
                            {opt.category}
                            <span> · {opt.house?.name}</span>
                        </small>
                    </span>
                    {(opt.code && opt.code === scheme) || opt.name === fund?.name ? <Check className="fund-row-check" aria-hidden="true" /> : null}
                </>
            )}
        </div>
    );

    const house = fund?.house || houseOf(value);
    return (
        <div className="fund-picker" ref={wrap}>
            <button
                ref={field}
                type="button"
                className={`fund-field${open ? " is-open" : ""}${value ? " is-set" : ""}`}
                aria-expanded={open}
                aria-controls={`${uid}-panel`}
                onClick={() => (open ? close() : setOpen(true))}
            >
                {value ? (
                    <>
                        <FundTile house={house} size={40} />
                        <span className="fund-field-text">
                            <b>{value}</b>
                            <small>{fund ? [fund.category, fund.house?.name].filter(Boolean).join(" · ") : "Typed in"}</small>
                        </span>
                    </>
                ) : (
                    <>
                        <span className="fund-tile is-search" style={{ "--ts": "40px" }} aria-hidden="true">
                            <Search />
                        </span>
                        <span className="fund-field-text">
                            <b>Pick the fund</b>
                            <small>{full ? `${list.length.toLocaleString("en-IN")} funds, every house in India` : "Every fund in India, gold and silver ones included"}</small>
                        </span>
                    </>
                )}
                <ChevronDown className="fund-field-chev" aria-hidden="true" />
            </button>

            {open && (
                <div className="bank-browser pop-down fund-browser" id={`${uid}-panel`} ref={panel} data-own-escape>
                    <div className="bank-search">
                        <Search aria-hidden="true" />
                        <input
                            autoFocus
                            role="combobox"
                            aria-expanded="true"
                            aria-controls={`${uid}-list`}
                            aria-autocomplete="list"
                            aria-activedescendant={options[active] ? optId(active) : undefined}
                            aria-label="Search funds"
                            placeholder={full ? `Search ${list.length.toLocaleString("en-IN")} funds: name, house or category` : "Search: SBI gold, Parag Parikh, Nifty 50, Gold BeES…"}
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                restart();
                            }}
                            onKeyDown={onKey}
                            autoComplete="off"
                            spellCheck="false"
                        />
                        {value ? <kbd aria-hidden="true">esc</kbd> : null}
                    </div>
                    <div className="bank-regions" role="group" aria-label="Kind of fund">
                        {[{ id: "all", label: "All" }, ...FUND_KINDS].map((k) =>
                            k.id === "all" || counts[k.id] ? (
                                <button
                                    key={k.id}
                                    type="button"
                                    aria-pressed={kind === k.id}
                                    title={`${(k.id === "all" ? list.length : counts[k.id]).toLocaleString("en-IN")} funds`}
                                    onMouseDown={(e) => e.preventDefault()} // keep typing in the search box
                                    onClick={() => {
                                        setKind(k.id);
                                        restart();
                                    }}
                                >
                                    {k.label}
                                </button>
                            ) : null
                        )}
                    </div>
                    <div
                        className="bank-list fund-list"
                        role="listbox"
                        id={`${uid}-list`}
                        ref={listEl}
                        aria-label="Funds"
                        onScroll={(e) => {
                            const el = e.currentTarget;
                            if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) more();
                        }}
                    >
                        {browsing && (
                            <div className="bank-group">
                                {full ? "Popular" : "Well known"}
                                <span>{found.length}</span>
                            </div>
                        )}
                        {options.map(row)}
                        {!options.length && <p className="fund-none">No fund by that name{kind !== "all" ? " of this kind" : ""}.</p>}
                        {browsing && full && <p className="fund-none">Type to search all {list.length.toLocaleString("en-IN")}, or pick a kind above.</p>}
                    </div>
                    <p className="bank-foot">
                        {all.status === "loading"
                            ? "Loading every fund from AMFI…"
                            : full
                              ? `From AMFI${all.date ? `, NAVs of ${shortDay(all.date)}` : ""}. ↑ ↓ to move, Enter to pick.`
                              : "The well-known funds. Not listed? Type its name."}
                    </p>
                </div>
            )}
        </div>
    );
}
