"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/http";
import { TRADE_TYPES, grade } from "@/lib/format";
import { checklistScore, checklistState, rrValue, storedDate, tfLabels, tickPart, tickWhole, todayIso } from "@/lib/trades";
import TradeSymbols from "./TradeSymbols";
import MarketIcon from "./k7/MarketIcon";
import Modal from "./k7/Modal";
import PairPicker from "./k7/PairPicker";
import Seg from "./k7/Seg";

const SYMBOLS = TradeSymbols.map((s) => s.symbol);

/** A checkbox square: ticked, partly ticked (some of its parts), or empty. */
function Box({ state }) {
    return (
        <span className={`check${state === "on" ? " on" : state === "part" ? " part" : ""}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                {state === "part" ? <path d="M6 12h12" /> : <path d="M20 6 9 17l-5-5" />}
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
    const [saving, setSaving] = useState(false);

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
        <Modal open={open} onClose={onClose} wide busy={saving} className="new-trade" title="New trade" sub="Grade it against your checklist, then log the details.">
            <div className="modal-body">
                {!ready ? (
                    <div className="skeleton" aria-busy="true" aria-label="Loading checklist" style={{ display: "grid", gap: 12 }}>
                        <div className="sk" style={{ height: 34 }} />
                        <div className="sk" style={{ height: 88, borderRadius: 12 }} />
                        <div className="sk" style={{ height: 220, borderRadius: 12 }} />
                    </div>
                ) : failed ? (
                    <div className="empty-card" style={{ marginTop: 0 }}>
                        <h2>The checklist didn’t load</h2>
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
                        onSaving={setSaving}
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

function TradeForm({ strategy, secondaryStrategy, onSaving, onDone }) {
    const [selected, setSelected] = useState({});
    const [loading, setLoading] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [tried, setTried] = useState(false);

    const [tradeSymbol, setTradeSymbol] = useState("");
    const [tradeType, setTradeType] = useState("");
    const [day, setDay] = useState(todayIso);
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

    const switchTimeFrame = (tf) => {
        // a different checklist, so the score starts over
        setTimeFrame(tf);
        setSelected({});
    };

    const toggle = (item) => setSelected((prev) => tickWhole(prev, item));
    const toggleChild = (item, child) => setSelected((prev) => tickPart(prev, item, child));

    const totalPercentage = counterTrade ? 0 : checklistScore(selected, points);
    const closed = tradeStatus === "Closed";
    const rr = rrValue(riskRewardRatio);
    const pnl = Number(totalPnL);
    const missing = [
        !tradeSymbol && "pair",
        !day && "date",
        !tradeType && "account",
        !tradeStatus && "status",
        !(rr > 0) && "risk : reward",
        closed && (totalPnL.trim() === "" || !Number.isFinite(pnl)) && "result",
    ].filter(Boolean);

    const addNewTrade = async (e) => {
        e.preventDefault();
        setTried(true);
        if (missing.length || loading) return;
        setLoading(true);
        onSaving(true);
        const responses = points.map((item) => ({
            question: item.name,
            checked: !counterTrade && !!selected[item._id],
            secondaryResponses: (item.secondaryStrategyPoints || []).map((child) => ({
                question: child.name,
                checked: !counterTrade && !!selected[child._id],
                _id: child._id,
            })),
        }));

        const payload = {
            responses,
            riskRewardRatio: String(+rr.toFixed(2)),
            tradeType,
            dateOfTrade: storedDate(day),
            tradeSymbol,
            tradeStatus,
            totalPercentage,
            totalPnL: closed ? pnl : 0,
            description: description.trim(),
            isLowerTf: timeFrame === "lower",
            lowTf: closed ? lowTf.trim() : "",
            midTf: closed ? midTf.trim() : "",
            highTf: closed ? highTf.trim() : "",
        };

        try {
            await http("/trades/newTrade", { method: "POST", body: payload });
            toast.success("Trade saved", { description: [tradeSymbol, tradeType, tradeStatus].filter(Boolean).join(" · ") });
            onSaving(false);
            onDone();
        } catch (error) {
            console.error("Error in POST trade:", error);
            toast.error("Could not save trade", { description: "Check the details and try again." });
            onSaving(false);
        } finally {
            setLoading(false);
        }
    };

    const g = grade(totalPercentage || 1);
    const pct = Math.max(0, Math.min(100, totalPercentage));
    const labels = tfLabels(timeFrame === "lower");
    const ticked = points.filter((item) => checklistState(selected, item) === "on").length;

    return (
        <form className="form" onSubmit={addNewTrade} noValidate>
            <fieldset className="bare form" disabled={loading}>
                <div className="toolbar" style={{ marginTop: 0 }}>
                    <Seg
                        label="Time frame"
                        value={timeFrame}
                        onChange={switchTimeFrame}
                        options={[
                            { value: "lower", label: "Lower time frame" },
                            { value: "higher", label: "Higher time frame" },
                        ]}
                    />
                    <span className="spacer" />
                    <label className="switch-row">
                        Counter trade
                        <button type="button" role="switch" aria-checked={counterTrade} className="switch" onClick={() => setCounterTrade((c) => !c)} />
                    </label>
                </div>

                {counterTrade ? (
                    <p className="note is-info fade-in">Counter trade: the checklist is skipped and the trade is saved without a grade.</p>
                ) : (
                    <div className="fade-in checklist-block">
                        <div className="grade-panel">
                            <div className={`grade-big g-${g.key}`} aria-hidden="true">
                                <span key={g.label}>{g.label}</span>
                            </div>
                            <div>
                                <div className="grade-top">
                                    <span>
                                        Checklist score <span className="muted">· {ticked} of {points.length} ticked</span>
                                    </span>
                                    <b aria-live="polite" aria-label={`Score ${totalPercentage}%, grade ${g.label}`}>
                                        {totalPercentage}%
                                    </b>
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
                            {points.map((item, i) => {
                                const state = checklistState(selected, item);
                                const kids = item.secondaryStrategyPoints || [];
                                return (
                                    <li key={item._id} style={{ "--i": i }}>
                                        <button
                                            type="button"
                                            className="cl-item"
                                            role="checkbox"
                                            aria-checked={state === "on" ? true : state === "part" ? "mixed" : false}
                                            onClick={() => toggle(item)}
                                        >
                                            <Box state={state} />
                                            <span className="cl-name">{item.name}</span>
                                            <span className="lead" />
                                            <span className="pct">{item.percentage}%</span>
                                        </button>
                                        {kids.length > 0 && (
                                            <ul className="cl-kids" aria-label={`Parts of ${item.name}`}>
                                                {kids.map((child) => {
                                                    const on = state === "on" || !!selected[child._id];
                                                    return (
                                                        <li key={child._id}>
                                                            <button
                                                                type="button"
                                                                className="cl-item"
                                                                role="checkbox"
                                                                aria-checked={on}
                                                                onClick={() => toggleChild(item, child)}
                                                            >
                                                                <Box state={on ? "on" : "off"} />
                                                                <span className="cl-name">{child.name}</span>
                                                                <span className="lead" />
                                                                <span className="pct">{child.percentage}%</span>
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                <div className="section-title" style={{ margin: "6px 0 0" }}>
                    <h3>Details</h3>
                </div>
                <div className="form-grid">
                    <Field label="Pair">
                        <button
                            type="button"
                            className={`btn pair-btn pair-field${tried && !tradeSymbol ? " is-invalid" : ""}`}
                            onClick={() => setPickerOpen(true)}
                        >
                            {tradeSymbol ? <MarketIcon symbol={tradeSymbol} size={18} /> : null}
                            <span className={`pair-field-text${tradeSymbol ? "" : " muted"}`}>{tradeSymbol || "Choose a pair"}</span>
                            <ChevronDown className="chev" aria-hidden="true" />
                        </button>
                    </Field>
                    <Field label="Date of trade" id="nt-date">
                        <input
                            id="nt-date"
                            type="date"
                            className={`input${tried && !day ? " is-invalid" : ""}`}
                            value={day}
                            max={todayIso()}
                            onChange={(e) => setDay(e.target.value)}
                        />
                    </Field>
                    <Field label="Account" className="span-2">
                        <Seg wide label="Account" options={TRADE_TYPES} value={tradeType} onChange={setTradeType} className={tried && !tradeType ? "is-invalid" : ""} />
                    </Field>
                    <Field label="Status">
                        <Seg wide label="Status" options={["Open", "Closed"]} value={tradeStatus} onChange={setTradeStatus} className={tried && !tradeStatus ? "is-invalid" : ""} />
                    </Field>
                    <Field label="Risk : reward" id="nt-rr">
                        <div className="input-affix is-wide">
                            <span aria-hidden="true">1 :</span>
                            <input
                                id="nt-rr"
                                className={`input num-tab${tried && !(rr > 0) ? " is-invalid" : ""}`}
                                inputMode="decimal"
                                value={riskRewardRatio}
                                // the "1 :" is already there, so a pasted "1:2.5" keeps just the 2.5
                                onChange={(e) => setRiskRewardRatio(e.target.value.replace(/^\s*1\s*:\s*/, ""))}
                                placeholder="2.5"
                                autoComplete="off"
                            />
                        </div>
                    </Field>
                    {closed && (
                        <>
                            <Field label="Result (USD)" id="nt-pnl" className="span-2 fade-in">
                                <div className="input-affix">
                                    <span aria-hidden="true">$</span>
                                    <input
                                        id="nt-pnl"
                                        className={`input num-tab${tried && missing.includes("result") ? " is-invalid" : ""}`}
                                        inputMode="decimal"
                                        value={totalPnL}
                                        onChange={(e) => setTotalPnL(e.target.value)}
                                        placeholder="240 for a win, -85 for a loss"
                                        autoComplete="off"
                                    />
                                </div>
                            </Field>
                            <div className="form-grid form-grid-3 span-2 fade-in">
                                {[
                                    [labels[0], lowTf, setLowTf, "nt-low"],
                                    [labels[1], midTf, setMidTf, "nt-mid"],
                                    [labels[2], highTf, setHighTf, "nt-high"],
                                ].map(([l, v, setV, id]) => (
                                    <Field key={id} label={`${l} chart`} id={id}>
                                        <input id={id} className="input mono" value={v} onChange={(e) => setV(e.target.value)} placeholder="TradingView link" autoComplete="off" />
                                    </Field>
                                ))}
                            </div>
                        </>
                    )}
                    <Field label="Notes" id="nt-desc" className="span-2">
                        <textarea id="nt-desc" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why you took it" />
                    </Field>
                </div>
            </fieldset>

            <div className="save-row">
                {tried && missing.length > 0 && (
                    <p className="form-error fade-in" role="alert">
                        Still needed: {missing.join(", ")}.
                    </p>
                )}
                <button type="submit" className={`btn btn-primary btn-block${loading ? " is-busy" : ""}`} disabled={loading}>
                    {loading ? "Saving…" : "Save trade"}
                </button>
            </div>

            <PairPicker open={pickerOpen} onClose={() => setPickerOpen(false)} pairs={SYMBOLS} value={tradeSymbol} onPick={setTradeSymbol} />
        </form>
    );
}
