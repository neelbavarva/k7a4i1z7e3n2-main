"use client";

import React, { useMemo } from "react";
import { money, pnlOf, sideOf } from "@/lib/format";
import { useCountUp } from "./k7/hooks";

// Strategy analysis, now inline above the journal: the four numbers follow
// the same filters as the table (time frame, account type, pair).

function accuracyOf(list) {
    if (!list.length) return 0;
    return (list.filter((t) => pnlOf(t) > 0).length / list.length) * 100;
}

function Pct({ value }) {
    const v = useCountUp(value);
    return (
        <>
            {v.toFixed(1)}
            <small>%</small>
        </>
    );
}

function Money({ value }) {
    const v = useCountUp(value);
    return <>{money(Math.round(v * 100) / 100)}</>;
}

function Count({ value }) {
    const v = useCountUp(value);
    return <>{Math.round(v)}</>;
}

function Bar({ value, tone }) {
    return (
        <div className="meter" aria-hidden="true">
            <div className={`meter-fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
            <span className="meter-tick" style={{ left: "50%" }} />
        </div>
    );
}

export default function StrategyAnalysis({ trades, pair, allPairs }) {
    const stats = useMemo(() => {
        const list = pair === "all" ? trades : trades.filter((t) => String(t.tradeSymbol) === pair);
        const won = list.reduce((s, t) => s + Math.max(0, pnlOf(t)), 0);
        const lost = list.reduce((s, t) => s + Math.max(0, -pnlOf(t)), 0);
        const profitAcc = won + lost > 0 ? (won / (won + lost)) * 100 : 0;
        const ranked = allPairs
            .map((p) => ({ p, acc: accuracyOf(trades.filter((t) => String(t.tradeSymbol) === p)) }))
            .sort((a, b) => b.acc - a.acc || a.p.localeCompare(b.p));
        const rank = pair === "all" ? 0 : ranked.findIndex((r) => r.p === pair) + 1;
        return {
            total: list.length,
            open: list.filter((t) => t.tradeStatus === "Open").length,
            acc: accuracyOf(list),
            wins: list.filter((t) => pnlOf(t) > 0).length,
            won,
            lost,
            net: won - lost,
            profitAcc,
            rank,
            ranked: ranked.length,
        };
    }, [trades, pair, allPairs]);

    const tone = (v) => (v >= 50 ? "up" : v > 0 ? "down" : "");

    return (
        <dl className="brief" aria-label="Strategy analysis">
            <div className="brief-cell">
                <dt>Win rate</dt>
                <dd className={`brief-num ${stats.total ? (stats.acc >= 50 ? "up" : "down") : ""}`}>
                    <Pct value={stats.acc} />
                </dd>
                <dd>
                    <Bar value={stats.acc} tone={tone(stats.acc)} />
                </dd>
                <dd className="brief-sub">
                    {stats.wins} of {stats.total} in profit
                </dd>
            </div>
            <div className="brief-cell">
                <dt>Profit accuracy</dt>
                <dd className={`brief-num ${stats.won + stats.lost ? (stats.profitAcc >= 50 ? "up" : "down") : ""}`}>
                    <Pct value={stats.profitAcc} />
                </dd>
                <dd>
                    <Bar value={stats.profitAcc} tone={tone(stats.profitAcc)} />
                </dd>
                <dd className="brief-sub">Share of gross P&amp;L that was profit</dd>
            </div>
            <div className="brief-cell">
                <dt>Net P&amp;L</dt>
                <dd className={`brief-num ${sideOf(stats.net)}`}>
                    <Money value={stats.net} />
                </dd>
                <dd className="brief-sub">
                    <span className="up">{money(stats.won)}</span> won · <span className="down">{money(-stats.lost)}</span> lost
                </dd>
            </div>
            <div className="brief-cell">
                <dt>{pair === "all" ? "Trades" : "Pair rank"}</dt>
                <dd className="brief-num">
                    {pair === "all" ? (
                        <Count value={stats.total} />
                    ) : stats.total ? (
                        <>
                            #{stats.rank}
                            <small>of {stats.ranked}</small>
                        </>
                    ) : (
                        <span className="muted">N/A</span>
                    )}
                </dd>
                <dd className="brief-sub">
                    {pair === "all"
                        ? `${stats.open} open, ${stats.total - stats.open} closed`
                        : `${stats.total} trade${stats.total === 1 ? "" : "s"}, ranked by win rate`}
                </dd>
            </div>
        </dl>
    );
}
