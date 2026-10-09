"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Link2, Search } from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/http";
import { TRADE_TYPES, grade } from "@/lib/format";
import { checklistScore, checklistState, rrValue, storedDate, tfLabels, tickPart, tickWhole, todayIso } from "@/lib/trades";
import TradeSymbols from "./TradeSymbols";
import DatePicker from "./k7/DatePicker";
import MarketIcon from "./k7/MarketIcon";
import Modal from "./k7/Modal";
import Notes from "./k7/Notes";
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

/** One line of the details ticket: a label in the left column, the control beside it. */
function Row({ label, htmlFor, id, className = "", children }) {
    return (
        <div className={`tk-row ${className}`}>
            {htmlFor ? (
                <label className="tk-label" htmlFor={htmlFor}>
                    {label}
                </label>
            ) : (
                <span className="tk-label" id={id}>
                    {label}
                </span>
            )}
            <div className="tk-field">{children}</div>
        </div>
    );
}

const RR_PRESETS = ["1.5", "2", "2.5", "3"];
const isLink = (v) => /^https?:\/\/\S+\.\S+/i.test(v.trim());
const usd = (v) => `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** "4 Oct", from "2026-10-04" */
const dayShort = (isoDay) => {
    const [y, m, d] = String(isoDay).split("-").map(Number);
    return y ? new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
};

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
                        <div className="sk" style={{ height: 88, borderRadius: 6 }} />
                        <div className="sk" style={{ height: 220, borderRadius: 6 }} />
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
    const sign = totalPnL.trim().startsWith("-") ? -1 : pnl > 0 ? 1 : 0;
    // Win or Loss only sets the sign of what's typed; Loss on an empty field starts it with a minus
    const setSign = (side) =>
        setTotalPnL((v) => {
            const n = v.trim().replace(/^[-+−]\s*/, "");
            return side === "loss" ? `-${n}` : n;
        });
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
                    <span>The trade itself</span>
                </div>
                {/* an order ticket: a label column on the left, each line ruled off from the next */}
                <div className="ticket">
                    <Row label="Pair" id="nt-pair-label">
                        <button
                            type="button"
                            className={`btn pair-btn pair-field${tried && !tradeSymbol ? " is-invalid" : ""}`}
                            onClick={() => setPickerOpen(true)}
                            aria-labelledby="nt-pair-label nt-pair-value"
                        >
                            {tradeSymbol ? <MarketIcon symbol={tradeSymbol} size={18} /> : <Search className="pair-field-icon" aria-hidden="true" />}
                            <span id="nt-pair-value" className={`pair-field-text${tradeSymbol ? "" : " muted"}`}>
                                {tradeSymbol || "Choose a pair"}
                            </span>
                            <ChevronDown className="chev" aria-hidden="true" />
                        </button>
                    </Row>
                    <Row label="Date" htmlFor="nt-date">
                        <DatePicker id="nt-date" value={day} onChange={setDay} max={todayIso()} invalid={tried && !day} />
                    </Row>
                    <Row label="Account">
                        <Seg
                            wide
                            label="Account"
                            value={tradeType}
                            onChange={setTradeType}
                            className={tried && !tradeType ? "is-invalid" : ""}
                            options={TRADE_TYPES.map((t) => ({ value: t, label: t, icon: <i className={`type-key t-${t.toLowerCase()}`} aria-hidden="true" /> }))}
                        />
                    </Row>
                    <Row label="Status">
                        <Seg
                            wide
                            label="Status"
                            value={tradeStatus}
                            onChange={setTradeStatus}
                            className={tried && !tradeStatus ? "is-invalid" : ""}
                            options={[
                                { value: "Open", label: "Open", icon: <i className="status-key is-open" aria-hidden="true" /> },
                                { value: "Closed", label: "Closed", icon: <i className="status-key is-closed" aria-hidden="true" /> },
                            ]}
                        />
                        <span className="field-hint">
                            {closed ? "Add the result and the charts below." : tradeStatus === "Open" ? "Still running: add the result once it closes." : "Running, or done?"}
                        </span>
                    </Row>
                    <Row label="Risk : reward" htmlFor="nt-rr">
                        <div className={`pf${tried && !(rr > 0) ? " is-invalid" : ""}`}>
                            <span className="pf-affix" aria-hidden="true">
                                1 :
                            </span>
                            <input
                                id="nt-rr"
                                className="pf-input"
                                inputMode="decimal"
                                value={riskRewardRatio}
                                // the "1 :" is already there, so a pasted "1:2.5" keeps just the 2.5
                                onChange={(e) => setRiskRewardRatio(e.target.value.replace(/^\s*1\s*:\s*/, ""))}
                                placeholder="2.5"
                                autoComplete="off"
                            />
                            <div className="pf-picks" role="group" aria-label="Common ratios">
                                {RR_PRESETS.map((v) => (
                                    <button key={v} type="button" aria-pressed={Number(v) === rr} aria-label={`1:${v}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setRiskRewardRatio(v)}>
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </Row>
                    {closed && (
                        <Row label="Result" htmlFor="nt-pnl" className="fade-in">
                            <div className={`pf pnl-field${sign > 0 ? " is-win" : sign < 0 ? " is-loss" : ""}${tried && missing.includes("result") ? " is-invalid" : ""}`}>
                                <span className="pf-affix" aria-hidden="true">
                                    $
                                </span>
                                <input
                                    id="nt-pnl"
                                    className="pf-input"
                                    inputMode="decimal"
                                    value={totalPnL}
                                    onChange={(e) => setTotalPnL(e.target.value)}
                                    placeholder="0.00"
                                    autoComplete="off"
                                />
                                <div className="pf-picks pnl-picks" role="group" aria-label="Win or loss">
                                    {[
                                        { value: "win", label: "Win", on: sign > 0 },
                                        { value: "loss", label: "Loss", on: sign < 0 },
                                    ].map((o) => (
                                        <button key={o.value} type="button" aria-pressed={o.on} onMouseDown={(e) => e.preventDefault()} onClick={() => setSign(o.value)}>
                                            {o.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <span className="field-hint">
                                {Number.isFinite(pnl) && totalPnL.trim() && totalPnL.trim() !== "-"
                                    ? pnl > 0
                                        ? `A win of ${usd(pnl)}.`
                                        : pnl < 0
                                          ? `A loss of ${usd(pnl)}.`
                                          : "Break-even."
                                    : "In USD. Type the amount; Win or Loss sets the sign."}
                            </span>
                        </Row>
                    )}
                    {closed && (
                        <Row label="Charts" className="fade-in">
                            <div className="links">
                                {[
                                    [labels[0], lowTf, setLowTf, "nt-low"],
                                    [labels[1], midTf, setMidTf, "nt-mid"],
                                    [labels[2], highTf, setHighTf, "nt-high"],
                                ].map(([l, v, setV, id]) => (
                                    <div className="lk-row" key={id}>
                                        <span className="lk-tf" aria-hidden="true">
                                            {l}
                                        </span>
                                        <input
                                            id={id}
                                            className="lk-input"
                                            value={v}
                                            onChange={(e) => setV(e.target.value)}
                                            placeholder="Paste a TradingView link"
                                            aria-label={`${l} chart`}
                                            autoComplete="off"
                                            spellCheck={false}
                                        />
                                        {isLink(v) ? (
                                            <a className="lk-open" href={v.trim()} target="_blank" rel="noopener noreferrer" aria-label={`Open the ${l} chart`}>
                                                <ExternalLink aria-hidden="true" />
                                            </a>
                                        ) : (
                                            <span className="lk-open is-empty" aria-hidden="true">
                                                <Link2 />
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Row>
                    )}
                    <Row label="Notes" htmlFor="nt-desc">
                        <Notes id="nt-desc" value={description} onChange={setDescription} placeholder="Why you took it" prompts={["Setup", "Why", "Stop", "Target"]} />
                    </Row>
                </div>
            </fieldset>

            {tried && missing.length > 0 && (
                <p className="form-error fade-in" role="alert">
                    Still needed: {missing.join(", ")}.
                </p>
            )}
            <div className="nt-foot">
                <span className="nt-summary" aria-hidden="true">
                    {!counterTrade && <span className={`grade g-${g.key}`}>{g.label}</span>}
                    <b>{tradeSymbol || "No pair"}</b>
                    {day && <span>{dayShort(day)}</span>}
                    {tradeType && <span>{tradeType}</span>}
                    <span>{rr > 0 ? `1:${+rr.toFixed(2)}` : "1:—"}</span>
                    {closed && Number.isFinite(pnl) && totalPnL.trim() && totalPnL.trim() !== "-" && (
                        <span className={pnl > 0 ? "up" : pnl < 0 ? "down" : ""}>
                            {pnl > 0 ? "+" : pnl < 0 ? "−" : ""}
                            {usd(pnl)}
                        </span>
                    )}
                </span>
                <button type="submit" className={`btn btn-primary nt-submit${loading ? " is-busy" : ""}`} disabled={loading}>
                    {loading ? "Saving…" : "Save trade"}
                </button>
            </div>

            <PairPicker open={pickerOpen} onClose={() => setPickerOpen(false)} pairs={SYMBOLS} value={tradeSymbol} onPick={setTradeSymbol} />
        </form>
    );
}
