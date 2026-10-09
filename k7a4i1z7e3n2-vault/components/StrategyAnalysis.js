"use client";

import React, { useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { sideOf } from "@/lib/format";
import { GRADE_BANDS, equityOf, gradeKey, inPnl, shortDate, statsOf } from "@/lib/trades";
import { useCountUp } from "./k7/hooks";
import { BigFig, useUsd } from "./k7/Money";
import MarketIcon from "./k7/MarketIcon";

// How the trades have done: the trading in the top card (TradingDash) and the breakdown above the
// journal. Everything here follows the page's filters: the card and the grade breakdown use all of
// them; the pair breakdown leaves out the pair filter so it can compare pairs (and set it). An
// archived trade's result is out of the P&L, but every stat still counts it. Results are logged in
// dollars and shown in the page's currency.

const pct = (v) => (v == null ? "—" : `${v.toFixed(v >= 99.95 || v === 0 ? 0 : 1)}%`);
const rate = (s) => (s.winRate == null ? null : s.winRate);
const tone = (v) => (v == null ? "" : v >= 50 ? "up" : "down");

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

/**
 * The trading, laid out like the net worth above it and in the same columns: the net P&L of the
 * trades the filters pick, what it's made of and its equity curve on the left; on the right, where
 * the globe sits, `head` (the account switch) and the figures that explain the result. In the page's
 * currency (dollars until the rate is in). scope: what it's of, in words ("every trade", "Real account").
 */
export function TradingDash({ trades, replay, scope, head }) {
    // every stat counts each trade; the P&L (the figure, won and lost, the curve) leaves out the archived
    const s = useMemo(() => statsOf(trades), [trades]);
    const counted = useMemo(() => trades.filter(inPnl), [trades]);
    const p = useMemo(() => statsOf(counted), [counted]);
    const curve = useMemo(() => equityOf(counted), [counted]);
    const archived = trades.length - counted.length;
    const usd = useUsd();
    const pf = s.profitFactor;
    const results = equityOf(trades).map((q) => q.pnl);
    const best = results.length ? Math.max(...results) : null;
    const worst = results.length ? Math.min(...results) : null;
    const first = curve.find((p) => Number.isFinite(p.at));

    return (
        <div className="hx-trade tx" role="group" aria-labelledby="tx-title">
            <div className="tx-main">
                <p className="hx-eyebrow" id="tx-title">
                    Trading <span>· {scope}</span>
                </p>
                <p className={`hx-big tx-big ${sideOf(p.net)}`}>{usd.rate ? <BigFig value={usd.inr(p.net)} sign /> : usd.text(p.net)}</p>
                <div className="hx-facts">
                    {p.closed ? (
                        <span className={`hx-change tone-${p.net >= 0 ? "up" : "down"}`}>
                            <svg viewBox="0 0 10 10" aria-hidden="true">
                                <path d={p.net >= 0 ? "M5 1.5 9 8H1z" : "M5 8.5 1 2h8z"} />
                            </svg>
                            {usd.text(p.won)} <span className="muted">won</span>
                            <span className="muted">·</span> {usd.text(-p.lost)} <span className="muted">lost</span>
                        </span>
                    ) : null}
                    {archived > 0 && (
                        <span className="hx-fact muted">
                            {archived} archived, out of the P&amp;L
                        </span>
                    )}
                </div>
            </div>
            <div className="tx-side">
                <div className="hx-side-head">
                    <span>{p.closed ? `${p.closed} closed trade${p.closed === 1 ? "" : "s"}` : "Equity curve"}</span>
                    {first && <span>since {shortDate(first.at)}</span>}
                </div>
                <EquityCurve key={replay} points={curve} />
            </div>
            <div className="tx-stats">
                {head}
                {/* the figures behind the result as one list: the name on the left, the figure on the right */}
                <dl className="tx-list">
                    <div>
                        <dt>Win rate</dt>
                        <dd className="tx-meter" aria-hidden="true">
                            <i style={{ width: `${rate(s) ?? 0}%` }} />
                        </dd>
                        <dd className="tx-val">
                            <span className="tx-pct">
                                <Pct value={rate(s)} />
                            </span>
                        </dd>
                    </div>
                    <div>
                        <dt>Profit factor</dt>
                        <dd className="tx-val">{pf == null ? <span className="muted">—</span> : pf === Infinity ? "∞" : pf.toFixed(2)}</dd>
                    </div>
                    <div>
                        <dt>Average win / loss</dt>
                        <dd className="tx-val">
                            <span className="up">{s.wins ? usd.text(s.avgWin) : "—"}</span>
                            <i>/</i>
                            <span className="down">{s.losses ? usd.text(-s.avgLoss) : "—"}</span>
                        </dd>
                    </div>
                    <div>
                        <dt>Risk : reward</dt>
                        <dd className="tx-val">{s.avgRR == null ? <span className="muted">—</span> : `1:${s.avgRR.toFixed(2)}`}</dd>
                    </div>
                    <div>
                        <dt>Best / worst trade</dt>
                        <dd className="tx-val">
                            <span className={sideOf(best)}>{best == null ? "—" : usd.text(best)}</span>
                            <i>/</i>
                            <span className={sideOf(worst)}>{worst == null ? "—" : usd.text(worst)}</span>
                        </dd>
                    </div>
                    <div>
                        <dt>Trades</dt>
                        <dd className="tx-val">
                            <small className="tx-aside">{s.closed ? `${s.wins} won · ${s.losses} lost${s.open ? ` · ${s.open} open` : ""}` : s.open ? `${s.open} open` : ""}</small>
                            {s.total}
                        </dd>
                    </div>
                </dl>
            </div>
        </div>
    );
}

/**
 * Running P&L over closed trades, oldest to newest. Point at it to read any trade.
 */
function EquityCurve({ points }) {
    const [at, setAt] = useState(null);
    const usd = useUsd();
    const plot = useRef(null);
    if (points.length < 2) {
        return <p className="eq-empty">The equity curve draws itself once two trades are closed.</p>;
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
                    {[33.3, 66.6].map((g) => (
                        <line key={g} className="hx-grid" x1="0" x2="100" y1={g} y2={g} />
                    ))}
                    <line className="eq-zero" x1="0" x2="100" y1={zero} y2={zero} />
                    <path className="eq-area" d={`${line}L100 ${zero}L0 ${zero}Z`} />
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
                                        <b className={sideOf(p.pnl)}>{usd.text(p.pnl)}</b>
                                    </span>
                                    <b className={sideOf(p.sum)}>{usd.text(p.sum)} total</b>
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
                <span>{Number.isFinite(last.at) ? shortDate(last.at) : ""}</span>
            </div>
        </div>
    );
}

/** One line of a breakdown: mark and name, trade count, win rate bar, net P&L. */
function BreakRow({ mark, label, strong, s }) {
    const r = rate(s);
    const usd = useUsd();
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
            <span className={`bd-net ${sideOf(s.net)}`}>{s.closed ? usd.text(s.net) : "—"}</span>
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
