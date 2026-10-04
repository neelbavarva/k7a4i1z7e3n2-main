"use client";

import React, { useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { money, sideOf } from "@/lib/format";
import { GRADE_BANDS, equityOf, gradeKey, shortDate, statsOf } from "@/lib/trades";
import { useCountUp } from "./k7/hooks";
import MarketIcon from "./k7/MarketIcon";

// Strategy analysis above the journal. Everything here follows the page's filters:
// the results, the equity curve and the grade breakdown use all of them; the pair
// breakdown leaves out the pair filter so it can compare pairs (and set it).

const pct = (v) => (v == null ? "—" : `${v.toFixed(v >= 99.95 || v === 0 ? 0 : 1)}%`);
const rate = (s) => (s.winRate == null ? null : s.winRate);
const tone = (v) => (v == null ? "" : v >= 50 ? "up" : "down");

function Money({ value }) {
    const v = useCountUp(value);
    return <>{money(Math.round(v * 100) / 100)}</>;
}

function Pct({ value }) {
    const v = useCountUp(value ?? 0);
    if (value == null) return <span className="muted">—</span>;
    return (
        <>
            {v.toFixed(1)}
            <small>%</small>
        </>
    );
}

/** Net P&L with the equity curve, and the four numbers beside it. */
export function Performance({ trades, replay }) {
    const s = useMemo(() => statsOf(trades), [trades]);
    const curve = useMemo(() => equityOf(trades), [trades]);
    const pf = s.profitFactor;
    return (
        <div className="perf">
            <div className="perf-main">
                <span className="perf-label">Net P&amp;L</span>
                <span className={`perf-net ${sideOf(s.net)}`}>
                    <Money value={s.net} />
                </span>
                <span className="perf-sub">
                    <span className="up">{money(s.won)}</span> won <span className="muted">·</span>{" "}
                    <span className="down">{money(-s.lost)}</span> lost
                </span>
                <EquityCurve key={replay} points={curve} />
            </div>
            <dl className="perf-stats">
                <div className="perf-stat">
                    <dt>Win rate</dt>
                    <dd className={`perf-num ${tone(rate(s))}`}>
                        <Pct value={rate(s)} />
                    </dd>
                    <dd className="meter" aria-hidden="true">
                        <span className={`meter-fill ${tone(rate(s))}`} style={{ width: `${rate(s) ?? 0}%` }} />
                        <span className="meter-tick" style={{ left: "50%" }} />
                    </dd>
                    <dd className="perf-note">{s.closed ? `${s.wins} of ${s.closed} closed in profit` : "No closed trades"}</dd>
                </div>
                <div className="perf-stat">
                    <dt>Profit factor</dt>
                    <dd className={`perf-num ${pf == null ? "" : pf >= 1 ? "up" : "down"}`}>
                        {pf == null ? <span className="muted">—</span> : pf === Infinity ? "∞" : pf.toFixed(2)}
                    </dd>
                    <dd className="perf-note">
                        {s.wins || s.losses ? (
                            <>
                                Avg win <span className="up">{money(s.avgWin)}</span> · loss <span className="down">{money(-s.avgLoss)}</span>
                            </>
                        ) : (
                            "Won for every $1 lost"
                        )}
                    </dd>
                </div>
                <div className="perf-stat">
                    <dt>Avg risk : reward</dt>
                    <dd className="perf-num">{s.avgRR == null ? <span className="muted">—</span> : `1:${s.avgRR.toFixed(2)}`}</dd>
                    <dd className="perf-note">
                        Planned, over {s.rrCount} trade{s.rrCount === 1 ? "" : "s"}
                    </dd>
                </div>
                <div className="perf-stat">
                    <dt>Trades</dt>
                    <dd className="perf-num">{s.total}</dd>
                    <dd className="perf-note">
                        {s.open ? `${s.open} open · ` : ""}
                        {s.closed} closed
                    </dd>
                </div>
            </dl>
        </div>
    );
}

/** Running P&L over closed trades, oldest to newest. Point at it to read any trade. */
function EquityCurve({ points }) {
    const [at, setAt] = useState(null);
    const plot = useRef(null);
    if (points.length < 2) {
        return <p className="eq-empty">The equity curve appears once two trades are closed.</p>;
    }

    const values = [0, ...points.map((p) => p.sum)];
    const lo0 = Math.min(...values);
    const hi0 = Math.max(...values);
    const pad = (hi0 - lo0) * 0.1 || 1;
    const lo = lo0 - pad;
    const hi = hi0 + pad;
    const n = values.length - 1;
    const X = (i) => (i / n) * 100;
    const Y = (v) => ((hi - v) / (hi - lo)) * 100;
    const line = values.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(3)} ${Y(v).toFixed(3)}`).join("");
    const zero = Y(0);
    const side = values[n] >= 0 ? "up" : "down";

    const move = (e) => {
        const r = plot.current.getBoundingClientRect();
        setAt(Math.max(0, Math.min(n, Math.round(((e.clientX - r.left) / r.width) * n))));
    };
    const p = at ? points[at - 1] : null;
    const first = points.find((q) => Number.isFinite(q.at));
    const last = points[points.length - 1];

    return (
        <div className={`eq is-${side}`}>
            <div className="eq-plot" ref={plot} onPointerMove={move} onPointerLeave={() => setAt(null)}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                        <linearGradient id="eq-fill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0" stopColor="currentColor" stopOpacity="0.16" />
                            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <line className="eq-zero" x1="0" x2="100" y1={zero} y2={zero} />
                    <path className="eq-area" d={`${line}L100 ${zero}L0 ${zero}Z`} fill="url(#eq-fill)" />
                    <path className="eq-line" d={line} />
                </svg>
                <span className="eq-dot is-end" style={{ left: "100%", top: `${Y(values[n])}%` }} />
                {at != null && (
                    <>
                        <span className="eq-hair" style={{ left: `${X(at)}%` }} />
                        <span className="eq-dot" style={{ left: `${X(at)}%`, top: `${Y(values[at])}%` }} />
                        <span className={`eq-tip${X(at) > 55 ? " is-flip" : ""}`} style={{ left: `${X(at)}%` }}>
                            {p ? (
                                <>
                                    <span>
                                        {Number.isFinite(p.at) ? shortDate(p.at) : p.t.dateOfTrade} · {p.t.tradeSymbol}{" "}
                                        <b className={sideOf(p.pnl)}>{money(p.pnl)}</b>
                                    </span>
                                    <b className={sideOf(p.sum)}>{money(p.sum)} total</b>
                                </>
                            ) : (
                                <span>Start</span>
                            )}
                        </span>
                    </>
                )}
            </div>
            <div className="eq-axis" aria-hidden="true">
                <span>{first ? shortDate(first.at) : ""}</span>
                <span>
                    {n} closed trade{n === 1 ? "" : "s"}
                </span>
                <span>{Number.isFinite(last.at) ? shortDate(last.at) : ""}</span>
            </div>
        </div>
    );
}

/** One line of a breakdown: mark and name, trade count, win rate bar, net P&L. */
function BreakRow({ mark, label, strong, s }) {
    const r = rate(s);
    const count = `${s.total} trade${s.total === 1 ? "" : "s"}`;
    return (
        <>
            <span className="bd-name">
                {mark}
                <span className="bd-text">
                    <span className={`bd-label${strong ? " is-strong" : ""}`}>{label}</span>
                    {/* narrow cards drop the count column and show it here */}
                    <span className="bd-mini">{count}</span>
                </span>
            </span>
            <span className="bd-count">{count}</span>
            <span className="bd-bar" aria-hidden="true">
                <i className={tone(r)} style={{ width: `${r ?? 0}%` }} />
            </span>
            <span className={`bd-rate ${tone(r)}`}>{pct(r)}</span>
            <span className={`bd-net ${sideOf(s.net)}`}>{s.closed ? money(s.net) : "—"}</span>
        </>
    );
}

const PAIRS_SHOWN = 6;

/** How each checklist grade and each pair has done: win rate and net P&L. */
export function Breakdown({ trades, pairTrades, pair, onPair }) {
    const [allPairs, setAllPairs] = useState(false);
    const grades = useMemo(
        () => GRADE_BANDS.map((b) => ({ ...b, s: statsOf(trades.filter((t) => gradeKey(t) === b.key)) })).filter((b) => b.key !== "x" || b.s.total),
        [trades]
    );
    const pairs = useMemo(() => {
        const by = new Map();
        for (const t of pairTrades) {
            const k = String(t.tradeSymbol || "—");
            if (!by.has(k)) by.set(k, []);
            by.get(k).push(t);
        }
        return [...by].map(([p, list]) => ({ p, s: statsOf(list) })).sort((a, b) => b.s.total - a.s.total || b.s.net - a.s.net);
    }, [pairTrades]);
    const shown = allPairs ? pairs : pairs.slice(0, PAIRS_SHOWN);
    // a chosen pair always stays in view
    if (!allPairs && pair !== "all" && !shown.some((x) => x.p === pair)) {
        const chosen = pairs.find((x) => x.p === pair);
        if (chosen) shown.push(chosen);
    }

    return (
        <div className="breakdown">
            <section className="bd-card" aria-labelledby="bd-grade">
                <div className="bd-head">
                    <h3 id="bd-grade">By grade</h3>
                    <span>Does the checklist pay?</span>
                </div>
                <ul className="bd-list">
                    {grades.map((b) => (
                        <li key={b.key} className={`bd-row${b.s.total ? "" : " is-empty"}`}>
                            <BreakRow s={b.s} mark={<span className={`grade g-${b.key}`}>{b.label}</span>} label={b.range} />
                        </li>
                    ))}
                </ul>
            </section>

            <section className="bd-card" aria-labelledby="bd-pair">
                <div className="bd-head">
                    <h3 id="bd-pair">By pair</h3>
                    <span>{pair === "all" ? "Choose one to filter" : "Choose it again to clear"}</span>
                </div>
                {pairs.length ? (
                    <ul className="bd-list">
                        {shown.map(({ p, s }) => (
                            <li key={p}>
                                <button
                                    type="button"
                                    className="bd-row is-button"
                                    aria-pressed={pair === p}
                                    onClick={() => onPair(pair === p ? "all" : p)}
                                >
                                    <BreakRow s={s} mark={<MarketIcon symbol={p} size={20} />} label={p} strong />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="bd-empty">No trades here yet.</p>
                )}
                {pairs.length > PAIRS_SHOWN && (
                    <button type="button" className="bd-more" onClick={() => setAllPairs((v) => !v)} aria-expanded={allPairs}>
                        {allPairs ? "Show fewer" : `Show all ${pairs.length} pairs`}
                        <ChevronDown aria-hidden="true" />
                    </button>
                )}
            </section>
        </div>
    );
}
