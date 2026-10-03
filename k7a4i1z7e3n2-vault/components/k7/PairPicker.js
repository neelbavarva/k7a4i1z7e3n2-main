"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { Check, Layers, Search } from "lucide-react";
import MarketIcon from "./MarketIcon";

const norm = (q) => q.toUpperCase().replace(/[^A-Z0-9]/g, "");
const ALIASES = { XAU: "GOLD", XAG: "SILVER", BTC: "BITCOIN", ETH: "ETHEREUM" };

/**
 * Command-palette pair switcher, as on the base site: type to filter,
 * arrows to move, Enter to choose, Esc or a click outside to close.
 * `withAll` adds an "All pairs" row on top (for filters).
 */
export default function PairPicker({ open, onClose, ...rest }) {
    // Radix unmounts the content when closed, so the search starts fresh each time
    return (
        <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="modal-backdrop">
                    <Dialog.Content className="modal picker" aria-describedby={undefined}>
                        <Dialog.Title className="visually-hidden">Choose a pair</Dialog.Title>
                        <Palette onClose={onClose} {...rest} />
                    </Dialog.Content>
                </Dialog.Overlay>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function Palette({ onClose, pairs, value, onPick, withAll, counts }) {
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const list = useRef(null);

    const results = useMemo(() => {
        const q = norm(query);
        const base = withAll ? ["all", ...pairs] : pairs;
        if (!q) return base;
        const starts = (p) => (p !== "all" && norm(p).startsWith(q) ? 0 : 1);
        return base
            .filter((p) => {
                if (p === "all") return "ALLPAIRS".includes(q);
                const n = norm(p);
                const alias = ALIASES[p.slice(0, 3)] || "";
                return n.includes(q) || alias.includes(q);
            })
            .sort((a, b) => starts(a) - starts(b));
    }, [pairs, query, withAll]);

    useEffect(() => {
        list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
    }, [active]);

    const choose = (p) => {
        if (p == null) return;
        onPick(p);
        onClose();
    };

    const onKeyDown = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(results.length - 1, i + 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            choose(results[active]);
        }
    };

    return (
        <>
            <div className="picker-search">
                <Search aria-hidden="true" />
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setActive(0);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder="Search GBPUSD, gold, bitcoin…"
                    aria-label="Search pairs"
                    aria-controls="picker-list"
                    autoComplete="off"
                    spellCheck="false"
                />
                <kbd>Esc</kbd>
            </div>
            <ul className="picker-list" id="picker-list" role="listbox" ref={list}>
                {results.map((p, i) => (
                    <li
                        key={p}
                        role="option"
                        aria-selected={value === p}
                        data-active={i === active}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => choose(p)}
                    >
                        <span className="picker-sym">
                            {p === "all" ? (
                                <span className="all-icon">
                                    <Layers />
                                </span>
                            ) : (
                                <MarketIcon symbol={p} size={20} />
                            )}
                            {p === "all" ? "All pairs" : p}
                        </span>
                        <span className="picker-right">
                            {counts && counts[p] != null && (
                                <span>
                                    {counts[p]} trade{counts[p] === 1 ? "" : "s"}
                                </span>
                            )}
                            {value === p && <Check aria-label="Selected" />}
                        </span>
                    </li>
                ))}
                {!results.length && <li className="picker-empty muted">Nothing matches “{query.trim()}”.</li>}
            </ul>
            <div className="picker-foot">
                <span>
                    <kbd>↑</kbd>
                    <kbd>↓</kbd> to move
                </span>
                <span>
                    <kbd>Enter</kbd> to choose
                </span>
            </div>
        </>
    );
}
