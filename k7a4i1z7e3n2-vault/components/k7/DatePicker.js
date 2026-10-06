"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON = MONTHS.map((m) => m.slice(0, 3));
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => {
    const [y, m, d] = String(s || "").split("-").map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
};
const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d, n) => {
    const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    // keep the day, or the month's last when it's shorter (31 Jan → 28 Feb)
    return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
};
const monthOf = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const same = (a, b) => !!a && !!b && a.getTime() === b.getTime();

/** "Tue, 6 Oct 2026" */
const label = (d) => `${DAYS[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;

/** "Today", "Yesterday", "3 days ago", or nothing further back than a week. */
function ago(d, today) {
    const n = Math.round((today - d) / 86400000);
    return n === 0 ? "Today" : n === 1 ? "Yesterday" : n > 1 && n < 7 ? `${n} days ago` : null;
}

/**
 * A date field and its month calendar, in the site's style. Weeks start on Monday, the weekend
 * is quieter (no forex), today has a dot, and nothing after `max` can be picked. Arrows move a
 * day or a week, PageUp/PageDown a month, Home/End to the week's ends, Enter picks, Esc closes.
 * `value` and `max` are "2026-10-06" strings, like a date input's.
 */
export default function DatePicker({ id, value, onChange, max, invalid, placeholder = "Pick a day" }) {
    const [open, setOpen] = useState(false);
    const today = day0(new Date());
    const limit = parse(max);
    const sel = parse(value);
    const [focus, setFocus] = useState(sel || today);
    const view = monthOf(focus);
    const grid = useRef(null);

    const allowed = (d) => !limit || d <= limit;
    const clamp = (d) => (limit && d > limit ? limit : d);

    // open on the chosen day (or today)
    const onOpenChange = (v) => {
        if (v) setFocus(sel || today);
        setOpen(v);
    };
    // keep the keyboard on the focused day as it moves
    useLayoutEffect(() => {
        if (open) grid.current?.querySelector('[data-focus="true"]')?.focus({ preventScroll: true });
    }, [open, focus]);

    const pick = (d) => {
        if (!allowed(d)) return;
        onChange(iso(d));
        setOpen(false);
    };

    // six weeks from the Monday on or before the 1st
    const start = addDays(view, -((view.getDay() + 6) % 7));
    const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    const nextMonth = monthOf(addMonths(view, 1));
    const canNext = allowed(nextMonth);

    const onKeyDown = (e) => {
        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
        let next = null;
        if (step) next = addDays(focus, step);
        else if (e.key === "PageUp") next = addMonths(focus, e.shiftKey ? -12 : -1);
        else if (e.key === "PageDown") next = addMonths(focus, e.shiftKey ? 12 : 1);
        else if (e.key === "Home") next = addDays(focus, -((focus.getDay() + 6) % 7));
        else if (e.key === "End") next = addDays(focus, 6 - ((focus.getDay() + 6) % 7));
        else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick(focus);
            return;
        } else return;
        e.preventDefault();
        setFocus(clamp(next));
    };

    const rel = sel ? ago(sel, today) : null;

    return (
        <Popover.Root open={open} onOpenChange={onOpenChange}>
            <Popover.Trigger asChild>
                <button id={id} type="button" className={`input dp-field${invalid ? " is-invalid" : ""}`}>
                    <CalendarDays className="dp-ico" aria-hidden="true" />
                    <span className={`dp-value${sel ? "" : " muted"}`}>{sel ? label(sel) : placeholder}</span>
                    {rel && <span className="dp-rel">{rel}</span>}
                    <ChevronDown className="chev" aria-hidden="true" />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    className="dp"
                    align="start"
                    sideOffset={6}
                    collisionPadding={12}
                    aria-label="Choose the date"
                    // the day takes the focus, not the first button
                    onOpenAutoFocus={(e) => {
                        e.preventDefault();
                        grid.current?.querySelector('[data-focus="true"]')?.focus({ preventScroll: true });
                    }}
                >
                    <div className="dp-head">
                        <span className="dp-title" aria-live="polite">
                            {MONTHS[view.getMonth()]} <span>{view.getFullYear()}</span>
                        </span>
                        <span className="dp-nav">
                            <button type="button" onClick={() => setFocus(addMonths(focus, -1))} aria-label="Previous month">
                                <ChevronLeft aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => setFocus(clamp(addMonths(focus, 1)))} disabled={!canNext} aria-label="Next month">
                                <ChevronRight aria-hidden="true" />
                            </button>
                        </span>
                    </div>

                    <div className="dp-week" aria-hidden="true">
                        {WEEK.map((w) => (
                            <span key={w}>{w}</span>
                        ))}
                    </div>
                    <div className="dp-grid" role="grid" ref={grid} onKeyDown={onKeyDown} key={`${view.getFullYear()}-${view.getMonth()}`}>
                        {days.map((d) => {
                            const out = d.getMonth() !== view.getMonth();
                            const weekend = d.getDay() === 0 || d.getDay() === 6;
                            const isFocus = same(d, focus);
                            return (
                                <button
                                    key={d.getTime()}
                                    type="button"
                                    role="gridcell"
                                    className={`dp-day${out ? " is-out" : ""}${weekend ? " is-weekend" : ""}${same(d, today) ? " is-today" : ""}`}
                                    aria-selected={same(d, sel)}
                                    aria-label={`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}${same(d, today) ? ", today" : ""}`}
                                    tabIndex={isFocus ? 0 : -1}
                                    data-focus={isFocus}
                                    disabled={!allowed(d)}
                                    onClick={() => pick(d)}
                                >
                                    {d.getDate()}
                                </button>
                            );
                        })}
                    </div>

                    <div className="dp-foot">
                        <button type="button" onClick={() => pick(today)} aria-pressed={same(sel, today)}>
                            Today
                        </button>
                        <button type="button" onClick={() => pick(addDays(today, -1))} aria-pressed={same(sel, addDays(today, -1))}>
                            Yesterday
                        </button>
                        <span className="dp-hint">{sel ? label(sel) : "No day picked"}</span>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
