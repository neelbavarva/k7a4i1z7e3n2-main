"use client";

import { ClockArrowDown, ClockArrowUp } from "lucide-react";
import { grade } from "@/lib/format";

/** Checklist grade as a small pill: A, B, C, D, or Cntr for a counter trade. */
export function GradeChip({ pct }) {
    const g = grade(pct);
    return (
        <span className={`grade g-${g.key}`} title={pct ? `${g.title} · ${pct}%` : g.title}>
            {g.label}
        </span>
    );
}

/** Account the trade was on: Real, Funded, Demo or Backtest, with its colour key. */
export function TypeTag({ type }) {
    return (
        <span className={`ttype t-${String(type || "").toLowerCase()}`}>
            <i aria-hidden="true" />
            {type || "—"}
        </span>
    );
}

export function TfTag({ lower }) {
    return (
        <span className="tf" title={lower ? "Lower time frame (15min, 1H, 4H)" : "Higher time frame (4H, D, W)"}>
            {lower ? <ClockArrowDown aria-hidden="true" /> : <ClockArrowUp aria-hidden="true" />}
            {lower ? "Lower TF" : "Higher TF"}
        </span>
    );
}
