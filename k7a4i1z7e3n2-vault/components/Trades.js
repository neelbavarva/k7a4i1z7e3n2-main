"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Check, ChevronDown, ChevronRight, Download, Maximize2, Minus, X } from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/http";
import { TRADE_TYPES, money, pnlOf, sideOf } from "@/lib/format";
import { byMonth, dayLabel, isOpen, longDate, newestFirst, rrText, statsOf, tfLabels } from "@/lib/trades";
import { TradeSymbolIconMap } from "./TradeSymbols";
import { Breakdown, Performance } from "./StrategyAnalysis";
import ChartViewer from "./k7/ChartViewer";
import MarketIcon, { splitPair } from "./k7/MarketIcon";
import Modal from "./k7/Modal";
import Notes from "./k7/Notes";
import PairPicker from "./k7/PairPicker";
import SessionBar from "./k7/SessionBar";
import Seg from "./k7/Seg";
import { GradeChip, TfTag, TypeTag } from "./k7/TradeTags";
import { useKey } from "./k7/hooks";

const TF_OPTIONS = [
    { value: "all", label: "All time frames" },
    { value: "lower", label: "Lower" },
    { value: "higher", label: "Higher" },
];

const byTf = (tf) => (t) => (tf === "lower" ? t.isLowerTf : tf === "higher" ? !t.isLowerTf : true);

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

    // time frame + account: what the pair breakdown compares across
    const byTfAndType = useMemo(
        () => trades.filter(byTf(tfFilter)).filter((t) => typeFilter === "all" || String(t.tradeType) === typeFilter),
        [trades, tfFilter, typeFilter]
    );
    // and the pair: what everything else shows
    const filtered = useMemo(
        () => newestFirst(byTfAndType.filter((t) => pairFilter === "all" || String(t.tradeSymbol) === pairFilter)),
        [byTfAndType, pairFilter]
    );

    const typeCounts = useMemo(() => {
        const c = { all: 0 };
        for (const t of trades.filter(byTf(tfFilter))) {
            c.all++;
            c[t.tradeType] = (c[t.tradeType] || 0) + 1;
        }
        return c;
    }, [trades, tfFilter]);

    const pairCounts = useMemo(() => {
        const c = { all: byTfAndType.length };
        for (const t of byTfAndType) c[t.tradeSymbol] = (c[t.tradeSymbol] || 0) + 1;
        return c;
    }, [byTfAndType]);

    const open = filtered.filter(isOpen);
    const months = useMemo(() => byMonth(filtered.filter((t) => !isOpen(t))), [filtered]);
    const filterKey = `${tfFilter}-${typeFilter}-${pairFilter}`;
    const filtering = filterKey !== "all-all-all";
    const clearFilters = () => {
        setTfFilter("all");
        setTypeFilter("all");
        setPairFilter("all");
    };

    return (
        <>
            <section className="overview">
                <div className="overview-row">
                    <h1 className="overview-title">Trade journal</h1>
                    <div className="overview-actions">
                        <a className="btn" href="/Forex.zip" download aria-label="Old trades" title="Download trades from before this journal (zip)">
                            <Download aria-hidden="true" />
                            <span className="btn-label">Old trades</span>
                        </a>
                    </div>
                </div>
                <hr className="rule" />
            </section>

            <SessionBar />

            <div className="toolbar trade-filters">
                <Seg label="Time frame" options={TF_OPTIONS} value={tfFilter} onChange={setTfFilter} />
                <Seg
                    label="Account"
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
                {filtering && (
                    <button type="button" className="btn btn-ghost fade-in" onClick={clearFilters}>
                        <X aria-hidden="true" />
                        Clear filters
                    </button>
                )}
            </div>

            {loading ? (
                <div className="skeleton" aria-busy="true" aria-label="Loading trades">
                    <div className="sk sk-perf" />
                    <div className="sk-pair">
                        <div className="sk sk-break" />
                        <div className="sk sk-break" />
                    </div>
                    <div className="sk sk-rows" />
                </div>
            ) : failed ? (
                <div className="empty-card fade-in">
                    <h2>Trades didn’t load</h2>
                    <p>This is usually a brief network hiccup, or the server is waking up. Try again in a moment.</p>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                            setLoading(true);
                            fetchTrades();
                        }}
                    >
                        Try again
                    </button>
                </div>
            ) : !trades.length ? (
                <div className="empty-card fade-in">
                    <h2>No trades yet</h2>
                    <p>Log your first trade and grade it against your checklist.</p>
                    <button type="button" className="btn btn-primary" onClick={onNew}>
                        New trade
                    </button>
                </div>
            ) : (
                <>
                    <section className="group" aria-labelledby="g-perf">
                        <div className="group-head">
                            <h2 id="g-perf">Performance</h2>
                            {filtering && <span className="group-note">Following your filters</span>}
                        </div>
                        <Performance trades={filtered} replay={filterKey} />
                        <Breakdown trades={filtered} pairTrades={byTfAndType} pair={pairFilter} onPair={setPairFilter} />
                    </section>

                    <section className="group" aria-labelledby="g-journal">
                        <div className="group-head">
                            <h2 id="g-journal">Journal</h2>
                            <span className="count">{filtered.length}</span>
                        </div>

                        {!filtered.length && (
                            <div className="empty-card fade-in">
                                <h2>No trades match</h2>
                                <p>Nothing was logged for this mix of time frame, account and pair.</p>
                                <button type="button" className="btn" onClick={clearFilters}>
                                    Clear filters
                                </button>
                            </div>
                        )}

                        {open.length > 0 && (
                            <TradeGroup key={`open-${filterKey}`} title="Open" rows={open} note="Close them with the result and charts" withMonth onOpen={setSelected} />
                        )}
                        {months.map((m) => (
                            <TradeGroup key={`${m.key}-${filterKey}`} title={m.label} rows={m.rows} onOpen={setSelected} />
                        ))}
                    </section>
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

/** A month (or the open trades): its heading with the count and net, then its rows. */
function TradeGroup({ title, rows, note, withMonth, onOpen }) {
    const s = statsOf(rows);
    return (
        <div className="group trade-group">
            <div className="group-head">
                <h3 className="group-title">{title}</h3>
                <span className="count">{rows.length}</span>
                {note ? (
                    <span className="group-note">{note}</span>
                ) : (
                    <span className="group-sum">
                        <span className="muted">
                            {s.wins}W {s.losses}L
                        </span>
                        <b className={sideOf(s.net)}>{money(s.net)}</b>
                    </span>
                )}
            </div>
            <div className="rows-card">
                <ul className="rows stagger">
                    {rows.map((t, i) => (
                        <TradeRow key={t._id} t={t} i={i} withMonth={withMonth} onOpen={() => onOpen(t)} />
                    ))}
                </ul>
            </div>
        </div>
    );
}

function TradeRow({ t, i, withMonth, onOpen }) {
    const pnl = pnlOf(t);
    const pending = isOpen(t) && !pnl;
    return (
        <li style={{ "--i": i }}>
            <button type="button" className="row-btn jrow" onClick={onOpen}>
                <span className="row-main col-pair">
                    <MarketIcon symbol={t.tradeSymbol} size={26} />
                    <span className="row-text">
                        <span className="row-title">{t.tradeSymbol}</span>
                        <span className="row-sub">{t.description || "No notes"}</span>
                    </span>
                </span>
                <span className="row-meta col-date">{dayLabel(t, withMonth)}</span>
                <span className="col-grade">
                    <GradeChip pct={t.totalPercentage || 0} />
                </span>
                <span className="col-type">
                    <TypeTag type={t.tradeType} />
                </span>
                <span className="col-tf">
                    <TfTag lower={t.isLowerTf} />
                </span>
                <span className="row-num row-meta col-rr">{rrText(t.riskRewardRatio)}</span>
                <span className={`row-num pnl col-pnl ${sideOf(pnl)}`}>{pending ? <span className="open-tag">Open</span> : money(pnl)}</span>
                <span className="col-meta" aria-hidden="true">
                    <GradeChip pct={t.totalPercentage || 0} />
                    <TypeTag type={t.tradeType} />
                    <span>{dayLabel(t, true)}</span>
                    <span>{rrText(t.riskRewardRatio)}</span>
                </span>
                <ChevronRight className="row-go" aria-hidden="true" />
            </button>
        </li>
    );
}

/** The trade's pair as a serif code with a soft slash, for the dialog title. */
function PairTitle({ symbol }) {
    const { base, quote } = splitPair(symbol);
    if (!quote) return symbol || "Trade";
    return (
        <>
            {base}
            <span className="slash">/</span>
            {quote}
        </>
    );
}

function SubLine({ items }) {
    return items.filter(Boolean).map((item, i) => (
        <span key={i} className="sub-item">
            {item}
        </span>
    ));
}

/**
 * The checklist as it was scored. A ticked group (like "All time frames in sync")
 * ticks everything under it; a group with only some of its parts ticked shows a dash.
 */
function Checks({ responses, score }) {
    const items = responses || [];
    if (!items.length) return null;
    const stateOf = (item) => {
        const kids = item.secondaryResponses || [];
        if (item.checked) return "ok";
        return kids.some((c) => c.checked) ? "part" : "no";
    };
    const ticked = items.filter((item) => stateOf(item) === "ok").length;
    return (
        <section>
            <div className="section-title">
                <h3>Checklist</h3>
                <span>
                    {ticked} of {items.length} ticked · {score}%
                </span>
            </div>
            <ul className="checks stagger">
                {items.map((item, i) => {
                    const state = stateOf(item);
                    const kids = item.secondaryResponses || [];
                    return (
                        <li key={item.question} style={{ "--i": i }}>
                            <div className="check-row">
                                <CheckMark state={state} />
                                <span>{item.question}</span>
                            </div>
                            {kids.length > 0 && (
                                <ul className="check-kids">
                                    {kids.map((c) => (
                                        <li key={c._id || c.question} className="check-row">
                                            <CheckMark state={item.checked || c.checked ? "ok" : "no"} />
                                            <span>{c.question}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

function CheckMark({ state }) {
    const label = state === "ok" ? "Yes" : state === "part" ? "Partly" : "No";
    return (
        <span className={`check-icon ${state}`} role="img" aria-label={label}>
            {state === "ok" ? <Check /> : state === "part" ? <Minus /> : <X />}
        </span>
    );
}

function TradeDetail({ trade, onClose, onUpdated }) {
    const [form, setForm] = useState({ totalPnL: "", description: "", lowTf: "", midTf: "", highTf: "" });
    const [submitting, setSubmitting] = useState(false);
    const [viewing, setViewing] = useState(null); // index of the chart open full screen
    // keep the last trade while the dialog animates out
    const shown = useRef(trade);
    if (trade) shown.current = trade;
    const t = shown.current;

    useEffect(() => {
        if (trade && isOpen(trade)) {
            setForm({
                totalPnL: trade.totalPnL ? String(trade.totalPnL) : "",
                description: trade.description || "",
                lowTf: trade.lowTf || "",
                midTf: trade.midTf || "",
                highTf: trade.highTf || "",
            });
        }
    }, [trade]);

    if (!t) return null;
    const live = isOpen(t);
    const pnl = pnlOf(t);
    const labels = tfLabels(t.isLowerTf);
    const shots = [
        [labels[0], t.lowTf],
        [labels[1], t.midTf],
        [labels[2], t.highTf],
    ].filter(([, src]) => src);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const pnlValid = form.totalPnL.trim() !== "" && Number.isFinite(Number(form.totalPnL));

    const closeTrade = async (e) => {
        e.preventDefault();
        if (!pnlValid || submitting) return;
        setSubmitting(true);
        try {
            await http(`/trades/updateTrade/${t._id}`, {
                method: "PUT",
                body: {
                    tradeStatus: "Closed",
                    totalPnL: Number(form.totalPnL),
                    description: form.description || t.description,
                    lowTf: form.lowTf || t.lowTf,
                    midTf: form.midTf || t.midTf,
                    highTf: form.highTf || t.highTf,
                    riskRewardRatio: t.riskRewardRatio,
                },
            });
            toast.success("Trade closed", { description: `${t.tradeSymbol} · ${money(Number(form.totalPnL))}` });
            await onUpdated();
        } catch (error) {
            console.error("Error closing trade:", error);
            toast.error("Could not close trade");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={!!trade}
            onClose={onClose}
            wide
            busy={submitting}
            className="trade-dialog"
            icon={<MarketIcon symbol={t.tradeSymbol} size={40} />}
            title={<PairTitle symbol={t.tradeSymbol} />}
            sub={
                <SubLine
                    items={[
                        longDate(t),
                        t.tradeType ? `${t.tradeType} account` : null,
                        t.isLowerTf ? "Lower TF" : "Higher TF",
                        live ? (
                            <>
                                <i className="live-dot" aria-hidden="true" />
                                Open
                            </>
                        ) : null,
                    ]}
                />
            }
        >
            <div className="modal-body">
                <dl className="brief three trade-facts">
                    <div className="brief-cell">
                        <dt>P&amp;L</dt>
                        <dd className={`brief-num sm ${live && !pnl ? "" : sideOf(pnl)}`}>{live && !pnl ? <span className="muted">Open</span> : money(pnl)}</dd>
                    </div>
                    <div className="brief-cell">
                        <dt>Risk : reward</dt>
                        <dd className="brief-num sm">{rrText(t.riskRewardRatio)}</dd>
                    </div>
                    <div className="brief-cell">
                        <dt>Grade</dt>
                        <dd className="brief-num sm grade-cell">
                            <GradeChip pct={t.totalPercentage || 0} />
                            {t.totalPercentage ? (
                                <span>
                                    {t.totalPercentage}
                                    <small>%</small>
                                </span>
                            ) : (
                                <span className="muted brief-hint">No checklist</span>
                            )}
                        </dd>
                    </div>
                </dl>

                {t.totalPercentage ? (
                    <Checks responses={t.responses} score={t.totalPercentage} />
                ) : (
                    <p className="note is-info">A counter trade, so it wasn’t scored against the checklist.</p>
                )}

                {t.description && !live ? (
                    <section>
                        <div className="section-title">
                            <h3>Notes</h3>
                        </div>
                        <p className="note">{t.description}</p>
                    </section>
                ) : null}

                {shots.length > 0 && !live && (
                    <section>
                        <div className="section-title">
                            <h3>Charts</h3>
                            <span>Choose one to see it full screen</span>
                        </div>
                        <div className="shots">
                            {shots.map(([label, src], i) => (
                                <button key={label} type="button" className="shot fade-in" onClick={() => setViewing(i)} aria-label={`View the ${label} chart full screen`}>
                                    <Image src={src} alt="" width={640} height={360} sizes="(max-width: 600px) 100vw, 220px" />
                                    <span className="shot-cap">
                                        {label}
                                        <Maximize2 aria-hidden="true" />
                                    </span>
                                </button>
                            ))}
                        </div>
                        <ChartViewer
                            shots={shots}
                            index={viewing}
                            title={t.tradeSymbol}
                            sub={longDate(t)}
                            onIndex={setViewing}
                            onClose={() => setViewing(null)}
                        />
                    </section>
                )}

                {live && (
                    <form className="close-trade" onSubmit={closeTrade}>
                        <div className="section-title">
                            <h3>Close this trade</h3>
                            <span>The result, chart snapshots and what you learned</span>
                        </div>
                        <fieldset className="bare form" disabled={submitting}>
                            <div className="field">
                                <label htmlFor="ct-pnl">Result (USD)</label>
                                <div className="pf">
                                    <span className="pf-affix" aria-hidden="true">
                                        $
                                    </span>
                                    <input
                                        id="ct-pnl"
                                        className="pf-input"
                                        inputMode="decimal"
                                        value={form.totalPnL}
                                        onChange={set("totalPnL")}
                                        placeholder="240 for a win, -85 for a loss"
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
                            <div className="form-grid form-grid-3">
                                {[
                                    ["lowTf", labels[0]],
                                    ["midTf", labels[1]],
                                    ["highTf", labels[2]],
                                ].map(([k, l]) => (
                                    <div className="field" key={k}>
                                        <label htmlFor={`ct-${k}`}>{l} chart</label>
                                        <input id={`ct-${k}`} className="input mono" value={form[k]} onChange={set(k)} placeholder="TradingView link" autoComplete="off" />
                                    </div>
                                ))}
                            </div>
                            <div className="field">
                                <label htmlFor="ct-desc">Notes</label>
                                <Notes id="ct-desc" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="What happened, what you'd repeat, what you wouldn't" prompts={["What happened", "Repeat", "Avoid"]} />
                            </div>
                        </fieldset>
                        <button type="submit" className={`btn btn-primary btn-block${submitting ? " is-busy" : ""}`} disabled={!pnlValid || submitting}>
                            {submitting ? "Closing…" : "Close trade"}
                        </button>
                    </form>
                )}
            </div>
        </Modal>
    );
}
