"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/http";
import { TRADE_TYPES, grade } from "@/lib/format";
import TradeSymbols from "./TradeSymbols";
import MarketIcon from "./k7/MarketIcon";
import Modal from "./k7/Modal";
import PairPicker from "./k7/PairPicker";
import Seg from "./k7/Seg";
import { tfLabels } from "./Trades";

const today = () => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
const SYMBOLS = TradeSymbols.map((s) => s.symbol);

function Box({ on }) {
    return (
        <span className={`check${on ? " on" : ""}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
            </svg>
        </span>
    );
}

function Field({ label, id, className = "", children }) {
    return (
        <div className={`field ${className}`}>
            {id ? <label htmlFor={id}>{label}</label> : <span className="field-label">{label}</span>}
            {children}
        </div>
    );
}

/** New-trade dialog: grade against the checklist, then log the details. */
export default function AddTrade({ open, onClose, onSaved }) {
    const [strategy, setStrategy] = useState(null);
    const [secondaryStrategy, setSecondaryStrategy] = useState(null);

    const load = () => {
        http("/trades/getStrategyPoints")
            .then(setStrategy)
            .catch(() => setStrategy("network_error"));
        http("/trades/getStrategySecondaryPoints")
            .then(setSecondaryStrategy)
            .catch(() => setSecondaryStrategy("network_error"));
    };

    useEffect(() => {
        if (open && (strategy == null || strategy === "network_error" || secondaryStrategy === "network_error")) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const ready = strategy != null && secondaryStrategy != null;
    const failed = strategy === "network_error" || secondaryStrategy === "network_error";

    return (
        <Modal open={open} onClose={onClose} wide title="New trade" sub="Grade it against your checklist, then log the details.">
            <div className="modal-body">
                {!ready ? (
                    <div className="skeleton" aria-busy="true" aria-label="Loading checklist" style={{ display: "grid", gap: 12 }}>
                        <div className="sk" style={{ height: 34 }} />
                        <div className="sk" style={{ height: 88, borderRadius: 12 }} />
                        <div className="sk" style={{ height: 220, borderRadius: 12 }} />
                    </div>
                ) : failed ? (
                    <div className="empty-card" style={{ marginTop: 0 }}>
                        <h2>The checklist didn&apos;t load</h2>
                        <p>The server may be waking up. Try again in a moment.</p>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                                setStrategy(null);
                                setSecondaryStrategy(null);
                                load();
                            }}
                        >
                            Try again
                        </button>
                    </div>
                ) : (
                    <TradeForm
                        strategy={strategy}
                        secondaryStrategy={secondaryStrategy}
                        onDone={() => {
                            onSaved?.();
                            onClose();
                        }}
                    />
                )}
            </div>
        </Modal>
    );
}

function TradeForm({ strategy, secondaryStrategy, onDone }) {
    const [selected, setSelected] = useState({});
    const [totalPercentage, setTotalPercentage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);

    const [tradeSymbol, setTradeSymbol] = useState("");
    const [tradeType, setTradeType] = useState("");
    const [dateOfTrade, setDateOfTrade] = useState(today);
    const [riskRewardRatio, setRiskRewardRatio] = useState("");
    const [tradeStatus, setTradeStatus] = useState("");
    const [totalPnL, setTotalPnL] = useState("");
    const [description, setDescription] = useState("");
    const [counterTrade, setCounterTrade] = useState(false);
    const [timeFrame, setTimeFrame] = useState("lower");
    const [lowTf, setLowTf] = useState("");
    const [midTf, setMidTf] = useState("");
    const [highTf, setHighTf] = useState("");

    const points = useMemo(() => {
        const p = timeFrame === "lower" ? secondaryStrategy : strategy;
        return Array.isArray(p) ? p : [];
    }, [timeFrame, strategy, secondaryStrategy]);

    // switching time frame swaps the checklist, so start the score over
    useEffect(() => {
        setSelected({});
        setTotalPercentage(0);
    }, [timeFrame]);

    const handleCheckboxChange = (id) => {
        setSelected((prev) => {
            const nextSel = { ...prev, [id]: !prev[id] };
            let total = 0;
            points.forEach((item) => {
                if (item._id === id && !prev[id]) {
                    (item.secondaryStrategyPoints || []).forEach((child) => {
                        delete nextSel[child._id];
                    });
                } else if ((item.secondaryStrategyPoints || []).some((child) => child._id === id)) {
                    const allChildren = (item.secondaryStrategyPoints || []).every((child) => nextSel[child._id]);
                    if (allChildren) {
                        (item.secondaryStrategyPoints || []).forEach((child) => {
                            delete nextSel[child._id];
                        });
                        nextSel[item._id] = true;
                    } else {
                        delete nextSel[item._id];
                    }
                }
                if (nextSel[item._id]) total += item.percentage;
                (item.secondaryStrategyPoints || []).forEach((child) => {
                    if (nextSel[child._id]) total += child.percentage;
                });
            });
            setTotalPercentage(total);
            return nextSel;
        });
    };

    const addNewTrade = async (e) => {
        e.preventDefault();
        setLoading(true);
        const responses = points.map((item) => ({
            question: item.name,
            checked: !!selected[item._id],
            secondaryResponses: (item.secondaryStrategyPoints || []).map((child) => ({
                question: child.name,
                checked: !!selected[child._id],
                _id: child._id,
            })),
        }));

        const payload = {
            responses,
            riskRewardRatio,
            tradeType,
            dateOfTrade,
            tradeSymbol,
            tradeStatus,
            totalPercentage,
            totalPnL: parseFloat(totalPnL) || 0,
            description,
            isLowerTf: timeFrame === "lower",
            lowTf,
            midTf,
            highTf,
        };

        try {
            await http("/trades/newTrade", { method: "POST", body: payload });
            toast.success("Trade saved", { description: [tradeSymbol, tradeType, tradeStatus].filter(Boolean).join(" · ") });
            onDone();
        } catch (error) {
            console.error("Error in POST trade:", error);
            toast.error("Could not save trade", { description: "Check the details and try again." });
        } finally {
            setLoading(false);
        }
    };

    const g = grade(totalPercentage || 1);
    const pct = Math.max(0, Math.min(100, totalPercentage));
    const labels = tfLabels(timeFrame === "lower");

    return (
        <form className="form" onSubmit={addNewTrade}>
            <div className="toolbar" style={{ marginTop: 0 }}>
                <Seg
                    label="Time frame"
                    value={timeFrame}
                    onChange={setTimeFrame}
                    options={[
                        { value: "lower", label: "Lower time frame" },
                        { value: "higher", label: "Higher time frame" },
                    ]}
                />
                <span className="spacer" />
                <label className="switch-row">
                    Counter trade
                    <button
                        type="button"
                        role="switch"
                        aria-checked={counterTrade}
                        className="switch"
                        onClick={() => setCounterTrade((c) => !c)}
                    />
                </label>
            </div>

            {counterTrade ? (
                <p className="note fade-in">Counter trade: the checklist is skipped and the trade is saved without a grade.</p>
            ) : (
                <div className="fade-in" style={{ display: "grid", gap: 12 }}>
                    <div className="grade-panel">
                        <div className={`grade-big g-${g.key}`} aria-label={`Grade ${g.label}`}>
                            <span key={g.label}>{g.label}</span>
                        </div>
                        <div>
                            <div className="grade-top">
                                <span>Checklist score</span>
                                <b>{totalPercentage}%</b>
                            </div>
                            <div className="meter lg" aria-hidden="true">
                                <div
                                    className={`meter-fill ${g.key === "a" ? "ok" : g.key === "b" ? "warn" : "down"}`}
                                    style={{ width: `${pct}%` }}
                                />
                                {[70, 80, 90].map((x) => (
                                    <span key={x} className="meter-tick" style={{ left: `${x}%` }} />
                                ))}
                            </div>
                            <div className="grade-scale" aria-hidden="true">
                                <span className={g.key === "d" ? "on" : ""} style={{ left: 0 }}>
                                    D
                                </span>
                                <span className={g.key === "c" ? "on" : ""} style={{ left: "75%" }}>
                                    C
                                </span>
                                <span className={g.key === "b" ? "on" : ""} style={{ left: "85%" }}>
                                    B
                                </span>
                                <span className={g.key === "a" ? "on" : ""} style={{ left: "95%" }}>
                                    A
                                </span>
                            </div>
                        </div>
                    </div>

                    <ul className="checklist stagger" key={timeFrame} aria-label="Checklist">
                        {points.map((item, i) => (
                            <li key={item._id} style={{ "--i": i }}>
                                <button
                                    type="button"
                                    className="cl-item"
                                    role="checkbox"
                                    aria-checked={!!selected[item._id]}
                                    onClick={() => handleCheckboxChange(item._id)}
                                >
                                    <Box on={!!selected[item._id]} />
                                    <span>{item.name}</span>
                                    <span className="lead" />
                                    <span className="pct">{item.percentage}%</span>
                                </button>
                                {!selected[item._id] && item.secondaryStrategyPoints?.length > 0 && (
                                    <ul className="cl-sub cl-child">
                                        {item.secondaryStrategyPoints.map((child) => (
                                            <li key={child._id}>
                                                <button
                                                    type="button"
                                                    className="cl-item"
                                                    role="checkbox"
                                                    aria-checked={!!selected[child._id]}
                                                    onClick={() => handleCheckboxChange(child._id)}
                                                >
                                                    <Box on={!!selected[child._id]} />
                                                    <span>{child.name}</span>
                                                    <span className="lead" />
                                                    <span className="pct">{child.percentage}%</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="section-title" style={{ marginBottom: 0 }}>
                <h3>Details</h3>
            </div>
            <div className="form-grid">
                <Field label="Pair">
                    <button type="button" className="btn pair-btn" style={{ height: 38, justifyContent: "flex-start" }} onClick={() => setPickerOpen(true)}>
                        {tradeSymbol ? <MarketIcon symbol={tradeSymbol} size={18} /> : null}
                        <span style={{ flex: 1, textAlign: "left", color: tradeSymbol ? "var(--ink)" : "var(--muted)" }}>
                            {tradeSymbol || "Choose a pair"}
                        </span>
                        <ChevronDown className="chev" aria-hidden="true" />
                    </button>
                </Field>
                <Field label="Date of trade" id="nt-date">
                    <input id="nt-date" className="input" value={dateOfTrade} onChange={(e) => setDateOfTrade(e.target.value)} placeholder="25 June 2025" />
                </Field>
                <Field label="Account" className="span-2">
                    <Seg wide label="Account" options={TRADE_TYPES} value={tradeType} onChange={setTradeType} />
                </Field>
                <Field label="Status">
                    <Seg wide label="Status" options={["Open", "Closed"]} value={tradeStatus} onChange={setTradeStatus} />
                </Field>
                <Field label="Risk / reward" id="nt-rr">
                    <input id="nt-rr" className="input num-tab" value={riskRewardRatio} onChange={(e) => setRiskRewardRatio(e.target.value)} placeholder="e.g. 1:3" />
                </Field>
                <Field label="Total P&L (USD)" id="nt-pnl" className="span-2">
                    <input id="nt-pnl" className="input num-tab" inputMode="decimal" value={totalPnL} onChange={(e) => setTotalPnL(e.target.value)} placeholder="0 while open" />
                </Field>
                {tradeStatus === "Closed" &&
                    [
                        [labels[0], lowTf, setLowTf, "nt-low"],
                        [labels[1], midTf, setMidTf, "nt-mid"],
                        [labels[2], highTf, setHighTf, "nt-high"],
                    ].map(([l, v, setV, id]) => (
                        <Field key={id} label={`${l} chart`} id={id} className="span-2 fade-in">
                            <input
                                id={id}
                                className="input mono"
                                value={v}
                                onChange={(e) => setV(e.target.value)}
                                placeholder="https://s3.tradingview.com/snapshots/X/XXXXXXXX.png"
                            />
                        </Field>
                    ))}
                <Field label="Notes" id="nt-desc" className="span-2">
                    <textarea id="nt-desc" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why you took it" />
                </Field>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? "Saving…" : "Save trade"}
            </button>

            <PairPicker open={pickerOpen} onClose={() => setPickerOpen(false)} pairs={SYMBOLS} value={tradeSymbol} onPick={setTradeSymbol} />
        </form>
    );
}
