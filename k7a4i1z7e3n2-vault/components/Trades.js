"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, ChevronDown, ChevronRight, ClockArrowDown, ClockArrowUp, Download, X } from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/http";
import { TRADE_TYPES, grade, money, parseTradeDate, pnlOf, sideOf } from "@/lib/format";
import { TradeSymbolIconMap } from "./TradeSymbols";
import StrategyAnalysis from "./StrategyAnalysis";
import MarketIcon, { PairCode } from "./k7/MarketIcon";
import Modal from "./k7/Modal";
import PairPicker from "./k7/PairPicker";
import SessionBar from "./k7/SessionBar";
import Seg from "./k7/Seg";
import { useKey } from "./k7/hooks";

const TF_OPTIONS = [
    { value: "all", label: "All time frames" },
    { value: "lower", label: "Lower" },
    { value: "higher", label: "Higher" },
];

// chart slots per time frame: lower = 15m / 1H / 4H, higher = 4H / 1D / W
export const tfLabels = (isLower) => (isLower ? ["15min", "1H", "4H"] : ["4H", "1D", "W"]);

export function GradeChip({ pct }) {
    const g = grade(pct);
    return (
        <span className={`grade g-${g.key}`} title={g.title}>
            {g.label}
        </span>
    );
}

export function TypeTag({ type }) {
    return (
        <span className={`ttype t-${String(type || "").toLowerCase()}`}>
            <i aria-hidden="true" />
            {type || "—"}
        </span>
    );
}

function TfTag({ lower }) {
    return (
        <span className="tf">
            {lower ? <ClockArrowDown aria-hidden="true" /> : <ClockArrowUp aria-hidden="true" />}
            {lower ? "Lower" : "Higher"}
        </span>
    );
}

export default function Trades({ refreshKey = 0, onNew }) {
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [tfFilter, setTfFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [pairFilter, setPairFilter] = useState("all");
    const [pickerOpen, setPickerOpen] = useState(false);
    const [selected, setSelected] = useState(null);

    const fetchTrades = async () => {
        try {
            const r = await http("/trades/getTrades");
            setTrades(Array.isArray(r) ? r : []);
            setFailed(false);
        } catch {
            setTrades([]);
            setFailed(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrades();
    }, [refreshKey]);

    useKey("p", () => setPickerOpen(true));

    const allPairs = useMemo(() => {
        const fromTrades = Array.from(new Set(trades.map((t) => t.tradeSymbol).filter((s) => typeof s === "string" && s))).sort();
        return fromTrades.length ? fromTrades : Object.keys(TradeSymbolIconMap).sort();
    }, [trades]);

    // time frame + type: what the stats and pair ranking are computed over
    const byTfAndType = useMemo(
        () =>
            trades
                .filter((t) => (tfFilter === "lower" ? t.isLowerTf : tfFilter === "higher" ? !t.isLowerTf : true))
                .filter((t) => typeFilter === "all" || String(t.tradeType) === typeFilter),
        [trades, tfFilter, typeFilter]
    );

    const filtered = useMemo(() => {
        const list = byTfAndType
            .map((t, i) => ({ t, i, d: parseTradeDate(t.dateOfTrade) }))
            .filter(({ t }) => pairFilter === "all" || String(t.tradeSymbol) === pairFilter);
        // newest first; trades without a readable date keep their order at the end
        list.sort((a, b) => {
            const an = Number.isNaN(a.d);
            const bn = Number.isNaN(b.d);
            if (an !== bn) return an ? 1 : -1;
            if (an) return a.i - b.i;
            return b.d - a.d || b.i - a.i;
        });
        return list.map((x) => x.t);
    }, [byTfAndType, pairFilter]);

    const typeCounts = useMemo(() => {
        const base = trades.filter((t) => (tfFilter === "lower" ? t.isLowerTf : tfFilter === "higher" ? !t.isLowerTf : true));
        const c = { all: base.length };
        for (const t of base) c[t.tradeType] = (c[t.tradeType] || 0) + 1;
        return c;
    }, [trades, tfFilter]);

    const pairCounts = useMemo(() => {
        const c = { all: byTfAndType.length };
        for (const t of byTfAndType) c[t.tradeSymbol] = (c[t.tradeSymbol] || 0) + 1;
        return c;
    }, [byTfAndType]);

    const groups = [
        { key: "open", title: "Open", rows: filtered.filter((t) => t.tradeStatus === "Open"), note: "Close them out with P&L and charts" },
        { key: "closed", title: "Closed", rows: filtered.filter((t) => t.tradeStatus !== "Open") },
    ];

    const filterKey = `${tfFilter}-${typeFilter}-${pairFilter}`;

    return (
        <>
            <section className="overview">
                <h1 className="overview-title">Trade journal</h1>
                <p className="overview-lede">
                    Every trade, graded against your checklist. Filter by time frame, account or pair; the numbers follow your
                    filters.
                </p>
            </section>

            <SessionBar />

            <div className="filters">
                <Seg label="Time frame" options={TF_OPTIONS} value={tfFilter} onChange={setTfFilter} />
                <Seg
                    label="Account type"
                    value={typeFilter}
                    onChange={setTypeFilter}
                    options={[
                        { value: "all", label: "All", count: typeCounts.all || 0 },
                        ...TRADE_TYPES.map((t) => ({ value: t, label: t, count: typeCounts[t] || 0 })),
                    ]}
                />
                <button type="button" className="btn pair-btn" onClick={() => setPickerOpen(true)} aria-haspopup="dialog">
                    {pairFilter === "all" ? null : <MarketIcon symbol={pairFilter} size={18} />}
                    {pairFilter === "all" ? "All pairs" : pairFilter}
                    <ChevronDown className="chev" aria-hidden="true" />
                    <kbd>P</kbd>
                </button>
                {pairFilter !== "all" && (
                    <button type="button" className="btn btn-ghost" onClick={() => setPairFilter("all")}>
                        <X aria-hidden="true" />
                        Clear pair
                    </button>
                )}
            </div>

            {loading ? (
                <div className="skeleton" aria-busy="true" aria-label="Loading trades">
                    <div className="sk sk-brief" />
                    <div className="sk sk-rows" />
                </div>
            ) : (
                <>
                    <StrategyAnalysis trades={byTfAndType} pair={pairFilter} allPairs={allPairs} />

                    {failed && (
                        <div className="empty-card fade-in">
                            <h2>Trades didn&apos;t load</h2>
                            <p>This is usually a brief network hiccup, or the server is waking up. Try again in a moment.</p>
                            <button type="button" className="btn btn-primary" onClick={() => { setLoading(true); fetchTrades(); }}>
                                Try again
                            </button>
                        </div>
                    )}

                    {!failed && !trades.length && (
                        <div className="empty-card fade-in">
                            <h2>No trades yet</h2>
                            <p>Log your first trade and grade it against your checklist.</p>
                            <button type="button" className="btn btn-primary" onClick={onNew}>
                                New trade
                            </button>
                        </div>
                    )}

                    {!failed && trades.length > 0 && !filtered.length && (
                        <p className="empty-note" style={{ marginTop: 24 }}>
                            No trades match these filters.
                        </p>
                    )}

                    {groups.map((g) =>
                        g.rows.length ? (
                            <section key={g.key} className="group" aria-labelledby={`g-${g.key}`}>
                                <div className="group-head">
                                    <h2 id={`g-${g.key}`}>{g.title}</h2>
                                    <span className="count">{g.rows.length}</span>
                                    {g.note && <span className="group-note">{g.note}</span>}
                                </div>
                                <div className="rows-card">
                                    <div className="row-headings trow trow-head" aria-hidden="true">
                                        <span>Pair</span>
                                        <span>Grade</span>
                                        <span>Account</span>
                                        <span>Date</span>
                                        <span>R:R</span>
                                        <span>P&amp;L</span>
                                        <span className="col-tf">Time frame</span>
                                        <span />
                                    </div>
                                    <ul className="rows stagger" key={filterKey}>
                                        {g.rows.map((t, i) => (
                                            <TradeRow key={t._id} t={t} i={i} onOpen={() => setSelected(t)} />
                                        ))}
                                    </ul>
                                </div>
                            </section>
                        ) : null
                    )}
                </>
            )}

            <PairPicker
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                pairs={allPairs}
                value={pairFilter}
                onPick={setPairFilter}
                withAll
                counts={pairCounts}
            />

            <TradeDetail
                trade={selected}
                onClose={() => setSelected(null)}
                onUpdated={async () => {
                    await fetchTrades();
                    setSelected(null);
                }}
            />
        </>
    );
}

function TradeRow({ t, i, onOpen }) {
    const pnl = pnlOf(t);
    return (
        <li style={{ "--i": i }}>
            <button type="button" className="row-btn trow" onClick={onOpen}>
                <span className="row-main col-pair">
                    <MarketIcon symbol={t.tradeSymbol} size={22} />
                    <span className="row-title">{t.tradeSymbol}</span>
                </span>
                <span className="col-grade">
                    <GradeChip pct={t.totalPercentage || 0} />
                </span>
                <span className="col-type">
                    <TypeTag type={t.tradeType} />
                </span>
                <span className="row-meta col-date">{t.dateOfTrade}</span>
                <span className="row-num row-meta col-rr">{t.riskRewardRatio || "—"}</span>
                <span className={`row-num pnl col-pnl ${sideOf(pnl)}`}>
                    {t.tradeStatus === "Open" && !pnl ? <span className="muted">—</span> : money(pnl)}
                </span>
                <span className="col-tf">
                    <TfTag lower={t.isLowerTf} />
                </span>
                <span className="col-meta">
                    <GradeChip pct={t.totalPercentage || 0} />
                    <TypeTag type={t.tradeType} />
                    <span className="row-meta">{t.dateOfTrade}</span>
                    {t.riskRewardRatio ? <span className="row-meta">R:R {t.riskRewardRatio}</span> : null}
                </span>
                <ChevronRight className="row-go" aria-hidden="true" />
            </button>
        </li>
    );
}

function Checks({ responses }) {
    const items = responses || [];
    const total = items.reduce((n, r) => n + 1 + (r.secondaryResponses || []).length, 0);
    const done = items.reduce((n, r) => n + (r.checked ? 1 : 0) + (r.secondaryResponses || []).filter((c) => c.checked).length, 0);
    if (!items.length) return null;
    return (
        <div>
            <div className="section-title">
                <h3>Checklist</h3>
                <span>
                    {done} of {total} ticked
                </span>
            </div>
            <ul className="checks stagger">
                {items.map((item, i) => (
                    <React.Fragment key={item.question}>
                        <li style={{ "--i": i }}>
                            <Mark ok={item.checked} />
                            <span>{item.question}</span>
                        </li>
                        {(item.secondaryResponses || []).map((child) => (
                            <li key={child._id || child.question} className="child" style={{ "--i": i }}>
                                <Mark ok={child.checked} />
                                <span>{child.question}</span>
                            </li>
                        ))}
                    </React.Fragment>
                ))}
            </ul>
        </div>
    );
}

function Mark({ ok }) {
    return (
        <span className={`check-icon ${ok ? "ok" : "no"}`} aria-label={ok ? "Yes" : "No"}>
            {ok ? <Check /> : <X />}
        </span>
    );
}

function TradeDetail({ trade, onClose, onUpdated }) {
    const [form, setForm] = useState({ totalPnL: "", description: "", lowTf: "", midTf: "", highTf: "" });
    const [submitting, setSubmitting] = useState(false);
    const t = trade;

    useEffect(() => {
        if (trade && trade.tradeStatus === "Open") {
            setForm({
                totalPnL: trade.totalPnL ?? "",
                description: trade.description || "",
                lowTf: trade.lowTf || "",
                midTf: trade.midTf || "",
                highTf: trade.highTf || "",
            });
        }
    }, [trade]);

    if (!t) return null;
    const isOpen = t.tradeStatus === "Open";
    const pnl = pnlOf(t);
    const labels = tfLabels(t.isLowerTf);
    const shots = [
        [labels[0], t.lowTf],
        [labels[1], t.midTf],
        [labels[2], t.highTf],
    ].filter(([, src]) => src);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const closeTrade = async () => {
        setSubmitting(true);
        try {
            await http(`/trades/updateTrade/${t._id}`, {
                method: "PUT",
                body: {
                    tradeStatus: "Closed",
                    totalPnL: form.totalPnL || t.totalPnL,
                    description: form.description || t.description,
                    lowTf: form.lowTf || t.lowTf,
                    midTf: form.midTf || t.midTf,
                    highTf: form.highTf || t.highTf,
                    riskRewardRatio: t.riskRewardRatio,
                },
            });
            toast.success("Trade closed", { description: `${t.tradeSymbol} · ${money(parseFloat(form.totalPnL) || 0)}` });
            await onUpdated();
        } catch (error) {
            console.error("Error closing trade:", error);
            toast.error("Could not close trade");
        } finally {
            setSubmitting(false);
        }
    };

    const downloadOld = () => {
        const a = document.createElement("a");
        a.href = "/Forex.zip";
        a.download = "Forex.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <Modal open={!!trade} onClose={onClose} wide head={false} label={`${t.tradeSymbol} trade`}>
            <div className="modal-head">
                <div>
                    <PairCode symbol={t.tradeSymbol} size={30} />
                    <div className="chips">
                        <GradeChip pct={t.totalPercentage || 0} />
                        <span className="chip">
                            <TypeTag type={t.tradeType} />
                        </span>
                        <span className={`chip ${isOpen ? "live" : ""}`}>
                            <i />
                            {t.tradeStatus || "Closed"}
                        </span>
                        <span className="chip">
                            <TfTag lower={t.isLowerTf} />
                        </span>
                    </div>
                </div>
                <button type="button" className="btn btn-ghost btn-icon modal-close" onClick={onClose} aria-label="Close">
                    <X />
                </button>
            </div>

            <div className="modal-body">
                <dl className="brief three">
                    <div className="brief-cell">
                        <dt>Date</dt>
                        <dd className="brief-text">{t.dateOfTrade || "—"}</dd>
                    </div>
                    <div className="brief-cell">
                        <dt>Risk / reward</dt>
                        <dd className="brief-num sm">{t.riskRewardRatio || "—"}</dd>
                    </div>
                    <div className="brief-cell">
                        <dt>P&amp;L</dt>
                        <dd className={`brief-num sm ${sideOf(pnl)}`}>{money(pnl)}</dd>
                    </div>
                </dl>

                {t.totalPercentage ? (
                    <Checks responses={t.responses} />
                ) : (
                    <p className="note">Counter trade, so no checklist was scored.</p>
                )}

                {isOpen ? (
                    <div>
                        <div className="section-title">
                            <h3>Close this trade</h3>
                            <span>Add the result and chart snapshots</span>
                        </div>
                        <div className="form">
                            <div className="form-grid">
                                <div className="field span-2">
                                    <label htmlFor="ct-pnl">Total P&amp;L (USD)</label>
                                    <input id="ct-pnl" className="input num-tab" inputMode="decimal" value={form.totalPnL} onChange={set("totalPnL")} placeholder="e.g. 240 or -85" />
                                </div>
                                {[
                                    ["lowTf", labels[0]],
                                    ["midTf", labels[1]],
                                    ["highTf", labels[2]],
                                ].map(([k, l]) => (
                                    <div className="field span-2" key={k}>
                                        <label htmlFor={`ct-${k}`}>{l} chart</label>
                                        <input
                                            id={`ct-${k}`}
                                            className="input mono"
                                            value={form[k]}
                                            onChange={set(k)}
                                            placeholder="https://s3.tradingview.com/snapshots/X/XXXXXXXX.png"
                                        />
                                    </div>
                                ))}
                                <div className="field span-2">
                                    <label htmlFor="ct-desc">Notes</label>
                                    <textarea id="ct-desc" className="textarea" value={form.description} onChange={set("description")} placeholder="What happened, what you'd repeat, what you wouldn't" />
                                </div>
                            </div>
                            <button type="button" className="btn btn-primary btn-block" onClick={closeTrade} disabled={submitting}>
                                {submitting ? "Saving…" : "Close trade"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {t.description ? (
                            <div>
                                <div className="section-title">
                                    <h3>Notes</h3>
                                </div>
                                <p className="note">{t.description}</p>
                            </div>
                        ) : null}

                        {shots.length ? (
                            <div>
                                <div className="section-title">
                                    <h3>Charts</h3>
                                    <span>{shots.map(([l]) => l).join(" · ")}</span>
                                </div>
                                <div className="shots">
                                    {shots.map(([label, src]) => (
                                        <figure className="shot fade-in" key={label}>
                                            <figcaption>
                                                {label}
                                                <a href={src} target="_blank" rel="noreferrer">
                                                    Open
                                                </a>
                                            </figcaption>
                                            <Image src={src} alt={`${t.tradeSymbol} ${label} chart`} width={900} height={500} />
                                        </figure>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <button type="button" className="btn btn-block" onClick={downloadOld}>
                                <Download aria-hidden="true" />
                                Download old trades data
                            </button>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
}
