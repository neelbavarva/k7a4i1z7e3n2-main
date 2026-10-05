"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { BANK_GROUPS, BANKS, REGIONS, bankColor, findBank, guessRegion, regionsOf, searchBanks } from "@/lib/cards";
import { BankMark } from "./BankLogo";

const byId = new Map(BANKS.map((b) => [b.id, b]));
const regionLabel = (id) => REGIONS.find((r) => r.id === id)?.label || "";
const groupLabel = (id) => BANK_GROUPS.find((g) => g.id === id)?.label.replace(/ banks$/, "") || "";
const inRegion = (region) => BANKS.filter((b) => regionsOf(b).includes(region));
const COUNTS = Object.fromEntries(REGIONS.map((r) => [r.id, inRegion(r.id).length]));

/** India's banks in its own groups; any other region as one list. */
function sectionsFor(region) {
    if (region === "in") {
        return BANK_GROUPS.map((g) => ({ id: g.id, label: g.label, banks: BANKS.filter((b) => !b.region && b.group === g.id) })).filter((g) => g.banks.length);
    }
    if (region === "all") return REGIONS.map((r) => ({ id: r.id, label: r.label, banks: inRegion(r.id) }));
    return [{ id: region, label: regionLabel(region), banks: inRegion(region) }];
}

/** Four tiles: the banks you already hold cards with, then the usual ones where you are. */
function tilesFor(mine, region) {
    const usual = region === "in" ? BANKS.filter((b) => b.top) : inRegion(region);
    const out = [];
    for (const b of [...mine.map((id) => byId.get(id)).filter(Boolean), ...usual]) {
        if (!out.includes(b)) out.push(b);
        if (out.length === 4) break;
    }
    return out;
}

/** What a search result says beside its name: India's group, or the bank's region. */
const whereOf = (b) => (b.region ? regionLabel(b.region) : groupLabel(b.group));

/**
 * The bank for a card. Four tiles (your banks first, then the usual ones where you are); the
 * fifth opens every bank in the world list, by region, starting with yours. Search covers all
 * of them, understands initials ("boa"), accents and a typo, and anything not listed can be
 * typed in as is.
 * value: { id } for a listed bank, { name } for one typed in, or null.
 * mine: ids of the banks the person already has cards with, most used first.
 */
export default function BankPicker({ value, onChange, mine = [] }) {
    const [home] = useState(() => guessRegion());
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [region, setRegion] = useState(home);
    const [active, setActive] = useState(0);
    const uid = useId();
    const wrap = useRef(null);
    const moreBtn = useRef(null);
    const chips = useRef(null);

    const tiles = useMemo(() => tilesFor(mine, home), [mine, home]);
    const picked = value?.id ? byId.get(value.id) : null;
    const custom = value?.name || "";
    const fromMore = (picked && !tiles.includes(picked)) || !!custom;

    const q = query.trim().replace(/·/g, "");
    const results = q ? searchBanks(q, home) : null;
    const sections = results ? null : sectionsFor(region);
    // what the arrow keys walk through: banks in the order shown, then "use what I typed"
    const options = results ? [...results, ...(findBank(q) ? [] : [{ custom: q }])] : sections.flatMap((s) => s.banks);
    const optId = (i) => `${uid}-opt-${i}`;
    const regionIds = ["all", ...REGIONS.map((r) => r.id)];

    useEffect(() => {
        if (!open) return;
        const away = (e) => {
            if (!wrap.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener("pointerdown", away);
        return () => document.removeEventListener("pointerdown", away);
    }, [open]);

    useEffect(() => {
        if (open) document.getElementById(optId(active))?.scrollIntoView({ block: "nearest" });
        // optId only depends on uid, which never changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, open]);

    // keep the chosen region's chip in view
    useEffect(() => {
        if (open && !q) chips.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [region, open, q]);

    const openPanel = () => {
        setRegion(picked ? (picked.region || "in") : home);
        setOpen(true);
    };
    const close = () => {
        setOpen(false);
        setQuery("");
        setActive(0);
        moreBtn.current?.focus();
    };
    const choose = (opt) => {
        if (!opt) return;
        onChange(opt.custom ? { name: opt.custom } : { id: opt.id });
        close();
    };
    const showRegion = (id) => {
        setRegion(id);
        setActive(0);
        document.getElementById(`${uid}-list`)?.scrollTo({ top: 0 });
    };

    const onKey = (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const d = e.key === "ArrowDown" ? 1 : -1;
            setActive((a) => Math.min(options.length - 1, Math.max(0, a + d)));
        } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !query) {
            // with nothing typed, left and right move between regions
            e.preventDefault();
            const i = regionIds.indexOf(region) + (e.key === "ArrowRight" ? 1 : -1);
            showRegion(regionIds[(i + regionIds.length) % regionIds.length]);
        } else if (e.key === "Enter") {
            e.preventDefault(); // never submit the card form from here
            choose(options[active]);
        } else if (e.key === "Escape") {
            close(); // the dialog leaves this Esc to us (data-own-escape)
        }
    };

    const item = (opt, i) => {
        const selected = opt.custom ? false : picked?.id === opt.id;
        return (
            <div
                key={opt.custom ? "custom" : `${opt.id}-${i}`}
                id={optId(i)}
                role="option"
                aria-selected={i === active}
                className={`bank-item${opt.custom ? " is-custom" : ""}${i === active ? " is-active" : ""}`}
                onPointerMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the search box
                onClick={() => choose(opt)}
            >
                {opt.custom ? (
                    <>
                        <span className="bank-add" aria-hidden="true">
                            <Plus />
                        </span>
                        <span className="bank-item-name">
                            Use “<b>{opt.custom}</b>”
                        </span>
                    </>
                ) : (
                    <>
                        <BankMark bank={opt} color={opt.color} size={24} />
                        <span className="bank-item-name">{opt.name}</span>
                        {results && <span className="bank-item-group">{whereOf(opt)}</span>}
                        {selected && <Check className="bank-item-check" aria-hidden="true" />}
                    </>
                )}
            </div>
        );
    };

    let n = 0;
    return (
        <div className="bank-picker" ref={wrap}>
            <div className="bank-tiles" role="group" aria-label="Bank">
                {tiles.map((b) => (
                    <button
                        key={b.id}
                        type="button"
                        aria-pressed={picked?.id === b.id}
                        className="bank-option"
                        style={{ "--tint": b.color }}
                        onClick={() => {
                            onChange({ id: b.id });
                            setOpen(false);
                        }}
                        title={mine.includes(b.id) ? `${b.name}: you have cards with them` : b.name}
                    >
                        <BankMark bank={b} color={b.color} size={26} />
                        <span className="bank-option-label">{b.short}</span>
                    </button>
                ))}
                <button
                    ref={moreBtn}
                    type="button"
                    aria-pressed={fromMore}
                    aria-expanded={open}
                    aria-controls={`${uid}-panel`}
                    className={`bank-option is-more${open ? " is-open" : ""}`}
                    style={fromMore ? { "--tint": picked?.color || bankColor(custom) } : undefined}
                    onClick={() => (open ? close() : openPanel())}
                    title={fromMore ? `${picked?.name || custom}. Change bank` : "Every bank, by region"}
                >
                    {fromMore ? (
                        <BankMark bank={picked} name={custom} color={picked?.color || bankColor(custom)} size={26} />
                    ) : (
                        <span className="bank-more-icon" aria-hidden="true">
                            <Search />
                        </span>
                    )}
                    <span className="bank-option-label">{fromMore ? picked?.short || custom : `${BANKS.length - tiles.length} more`}</span>
                </button>
            </div>

            {open && (
                <div className="bank-browser pop-down" id={`${uid}-panel`} data-own-escape>
                    <div className="bank-search">
                        <Search aria-hidden="true" />
                        <input
                            autoFocus
                            role="combobox"
                            aria-expanded="true"
                            aria-controls={`${uid}-list`}
                            aria-autocomplete="list"
                            aria-activedescendant={options[active] ? optId(active) : undefined}
                            aria-label="Search banks"
                            placeholder={`Search ${BANKS.length} banks worldwide, or type any name`}
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setActive(0);
                            }}
                            onKeyDown={onKey}
                            autoComplete="off"
                            spellCheck="false"
                        />
                        <kbd aria-hidden="true">esc</kbd>
                    </div>
                    {!results && (
                        <div className="bank-regions" ref={chips} role="group" aria-label="Region">
                            {regionIds.map((id) => (
                                <button
                                    key={id}
                                    type="button"
                                    aria-pressed={region === id}
                                    onMouseDown={(e) => e.preventDefault()} // keep typing in the search box
                                    onClick={() => showRegion(id)}
                                >
                                    {id === "all" ? "All" : regionLabel(id)}
                                    {id === home && <span className="bank-region-you">yours</span>}
                                    <span className="seg-count">{id === "all" ? BANKS.length : COUNTS[id]}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="bank-list" role="listbox" id={`${uid}-list`} aria-label="Banks">
                        {results ? (
                            <div className="bank-items is-results">{options.map((o) => item(o, n++))}</div>
                        ) : (
                            sections.map((g) => (
                                <div key={g.id} role="group" aria-labelledby={`${uid}-${g.id}`}>
                                    <div className="bank-group" id={`${uid}-${g.id}`}>
                                        {g.label}
                                        <span>{g.banks.length}</span>
                                    </div>
                                    <div className="bank-items">{g.banks.map((b) => item(b, n++))}</div>
                                </div>
                            ))
                        )}
                    </div>
                    <p className="bank-foot">
                        {results && !results.length
                            ? "Not in the list. Press Enter to use the name as typed."
                            : results
                              ? "Matches names, short names and initials (boa, rbc). Enter picks."
                              : "↑ ↓ to move, ← → to change region, Enter to pick. Not listed? Type its name."}
                    </p>
                </div>
            )}
        </div>
    );
}
