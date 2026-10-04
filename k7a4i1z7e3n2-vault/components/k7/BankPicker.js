"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { BANK_GROUPS, BANKS, bankColor, findBank, searchBanks } from "@/lib/cards";
import { BankMark } from "./BankLogo";

const TOP = BANKS.filter((b) => b.top);
const GROUPS = BANK_GROUPS.map((g) => ({ ...g, banks: BANKS.filter((b) => !b.top && b.group === g.id) })).filter((g) => g.banks.length);
const REST = GROUPS.flatMap((g) => g.banks);
const groupLabel = (id) => BANK_GROUPS.find((g) => g.id === id)?.label.replace(/ banks$/, "") || "";

/**
 * The bank for a card. The most used banks are tiles; the fifth tile opens every other bank,
 * grouped and searchable, and anything not listed can be typed in as is.
 * value: { id } for a listed bank, { name } for one typed in, or null.
 */
export default function BankPicker({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const uid = useId();
    const wrap = useRef(null);
    const moreBtn = useRef(null);

    const picked = value?.id ? BANKS.find((b) => b.id === value.id) : null;
    const custom = value?.name || "";
    const fromMore = (picked && !picked.top) || !!custom;

    const q = query.trim().replace(/·/g, "");
    const results = q ? searchBanks(q) : null;
    // what the arrow keys walk through: banks in the order shown, then "use what I typed"
    const options = results ? [...results, ...(findBank(q) ? [] : [{ custom: q }])] : REST;
    const optId = (i) => `${uid}-opt-${i}`;

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

    const onKey = (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const d = e.key === "ArrowDown" ? 1 : -1;
            setActive((a) => Math.min(options.length - 1, Math.max(0, a + d)));
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
                key={opt.custom ? "custom" : opt.id}
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
                        {results && <span className="bank-item-group">{groupLabel(opt.group)}</span>}
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
                {TOP.map((b) => (
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
                        title={b.name}
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
                    onClick={() => (open ? close() : setOpen(true))}
                    title={fromMore ? `${picked?.name || custom}. Change bank` : "All other banks"}
                >
                    {fromMore ? (
                        <BankMark bank={picked} name={custom} color={picked?.color || bankColor(custom)} size={26} />
                    ) : (
                        <span className="bank-more-icon" aria-hidden="true">
                            <Search />
                        </span>
                    )}
                    <span className="bank-option-label">{fromMore ? picked?.short || custom : `${REST.length} more`}</span>
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
                            placeholder={`Search ${BANKS.length} banks, or type any name`}
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
                    <div className="bank-list" role="listbox" id={`${uid}-list`} aria-label="Banks">
                        {results ? (
                            <div className="bank-items is-results">{options.map((o) => item(o, n++))}</div>
                        ) : (
                            GROUPS.map((g) => (
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
                            : "↑ ↓ to move, Enter to pick. Not listed? Type its name."}
                    </p>
                </div>
            )}
        </div>
    );
}
