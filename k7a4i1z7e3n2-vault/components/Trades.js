"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Archive, ArchiveRestore, Check, ChevronRight, ChevronDown, Download, Maximize2, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/http";
import { TRADE_TYPES, money, pnlOf, sideOf } from "@/lib/format";
import { byMonth, dayLabel, inPnl, isArchived, isOpen, longDate, newestFirst, rrText, statsOf, tfLabels } from "@/lib/trades";
import { getMarketSession } from "@/lib/session";
import { TradeSymbolIconMap } from "./TradeSymbols";
import { Breakdown, TradingDash } from "./StrategyAnalysis";
import ChartViewer from "./k7/ChartViewer";
import MarketIcon, { splitPair } from "./k7/MarketIcon";
import Modal from "./k7/Modal";
import Notes from "./k7/Notes";
import PairPicker from "./k7/PairPicker";
import Seg from "./k7/Seg";
import { GradeChip, TfTag, TypeTag } from "./k7/TradeTags";
import { useKey, useNow } from "./k7/hooks";
import { useUsd } from "./k7/Money";

// The trades on the Finance page. What the filtered trades add up to sits in the one card on top
// (TradingStrip, with the account switch); under the accounts, the time frame and pair filters in
// the heading, the trades' breakdown by grade and pair, and the journal of every one. Results are logged in dollars and shown in the page's currency (k7/Money.js).

const TF_OPTIONS = [
    { value: "all", label: "All time frames" },
    { value: "lower", label: "Lower" },
    { value: "higher", label: "Higher" },
];

const byTf = (tf) => (t) => (tf === "lower" ? t.isLowerTf : tf === "higher" ? !t.isLowerTf : true);

/** The journal's trades, loaded here once for the whole page (its tabs need to know if there are any). */
export function useJournal(refreshKey = 0) {
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const load = useCallback(async () => {
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
    }, []);
    useEffect(() => {
        load();
    }, [refreshKey, load]);
    const retry = () => {
        setLoading(true);
        load();
    };
    return { trades, loading, failed, reload: load, retry };
}

/** The forex session, as a quiet note beside the Trading heading. Nothing while the market is shut. */
function MarketNow() {
    useNow(30000);
    const s = getMarketSession();
    if (!s) return null;
    return (
        <span className={`fin-live${s.active ? "" : " is-idle"}`} role="status">
            <i aria-hidden="true" />
            <span>
                <b>{s.name}</b> · {s.detail}
            </span>
        </span>
    );
}

/** account, onAccount: the account filter, kept by Finance (the net worth's trading line sets it). */
/**
 * The trades' filters (account, time frame, pair) and what they pick, kept by Finance: the account
 * is chosen in the top card, the time frame and pair in the Trades heading, and both follow them.
 */
export function useTradeView(trades) {
    const [account, setAccount] = useState("all");
    const [tf, setTf] = useState("all");
    const [pair, setPair] = useState("all");

    // time frame + account: what the pair breakdown compares across
    const byTfAndType = useMemo(
        () => trades.filter(byTf(tf)).filter((t) => account === "all" || String(t.tradeType) === account),
        [trades, tf, account]
    );
    // and the pair: what everything else shows
    const filtered = useMemo(
        () => newestFirst(byTfAndType.filter((t) => pair === "all" || String(t.tradeSymbol) === pair)),
        [byTfAndType, pair]
    );
    const typeCounts = useMemo(() => {
        const c = { all: 0 };
        for (const t of trades.filter(byTf(tf))) {
            c.all++;
            c[t.tradeType] = (c[t.tradeType] || 0) + 1;
        }
        return c;
    }, [trades, tf]);

    const filterKey = `${tf}-${account}-${pair}`;
    // what the figures are of, in words, for the top of the results
    const scope =
        [account !== "all" && `${account} account`, pair !== "all" && pair, tf !== "all" && `${tf === "lower" ? "lower" : "higher"} time frames`]
            .filter(Boolean)
            .join(" · ") || "every trade";
    const clear = () => {
        setTf("all");
        setAccount("all");
        setPair("all");
    };
    return { account, setAccount, tf, setTf, pair, setPair, byTfAndType, filtered, typeCounts, filterKey, scope, filtering: filterKey !== "all-all-all", clear };
}

/**
 * The trading, under the net worth in the same card and laid out like it (TradingDash): the account
 * switch, with Real (the one counted in the total) marked, takes the globe's place.
 */
export function TradingStrip({ journal, view, onNew }) {
    const { trades, loading, failed } = journal;
    if (failed) return null; // said in the Trades section, with its retry
    if (loading || !trades.length)
        return (
            <div className="hx-trade is-plain" role="group" aria-labelledby="tx-title">
                <p className="hx-eyebrow" id="tx-title">
                    Trading
                </p>
                {loading ? (
                    <div className="sk sk-trade" aria-busy="true" aria-label="Loading trades" />
                ) : (
                    <p className="hx-trade-none">
                        No trades yet.{" "}
                        <button type="button" className="linkish" onClick={onNew}>
                            Log the first
                        </button>
                        ; a Real-account trade’s result counts in the total.
                    </p>
                )}
            </div>
        );
    const head = (
        <div className="tx-head">
            <Seg
                label="Account"
                value={view.account}
                onChange={view.setAccount}
                options={[
                    { value: "all", label: "All", count: view.typeCounts.all || 0 },
                    ...TRADE_TYPES.map((t) => ({
                        value: t,
                        label: t,
                        count: view.typeCounts[t] || 0,
                        icon: t === "Real" ? <i className="hx-in" aria-hidden="true" /> : null,
                        title: t === "Real" ? "Counted in the net worth" : "Not counted in the net worth",
                    })),
                ]}
            />
        </div>
    );
    return <TradingDash trades={view.filtered} replay={view.filterKey} scope={view.scope} head={head} />;
}

export default function Trades({ journal, view, onNew }) {
    const { trades, loading, failed } = journal;
    const { tf: tfFilter, setTf: setTfFilter, pair: pairFilter, setPair: setPairFilter, byTfAndType, filtered, filterKey, filtering, clear: clearFilters } = view;
    const [pickerOpen, setPickerOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const any = trades.length > 0;

    useKey("p", () => setPickerOpen(true), any);

    const allPairs = useMemo(() => {
        const fromTrades = Array.from(new Set(trades.map((t) => t.tradeSymbol).filter((s) => typeof s === "string" && s))).sort();
        return fromTrades.length ? fromTrades : Object.keys(TradeSymbolIconMap).sort();
    }, [trades]);

    const pairCounts = useMemo(() => {
        const c = { all: byTfAndType.length };
        for (const t of byTfAndType) c[t.tradeSymbol] = (c[t.tradeSymbol] || 0) + 1;
        return c;
    }, [byTfAndType]);

    const open = filtered.filter(isOpen);
    const months = useMemo(() => byMonth(filtered.filter((t) => !isOpen(t))), [filtered]);

    return (
        <>
            <section className="fin-sec" id="trades" aria-labelledby="fin-trades">
                <div className="fin-head">
                    <h2 id="fin-trades">Trades</h2>
                    {any && <span className="count">{filtered.length}</span>}
                    <MarketNow />
                    {any && (
                        <div className="fin-tools">
                            <Seg label="Time frame" options={TF_OPTIONS} value={tfFilter} onChange={setTfFilter} />
                            <button type="button" className="btn pair-btn" onClick={() => setPickerOpen(true)} aria-haspopup="dialog">
                                {pairFilter === "all" ? null : <MarketIcon symbol={pairFilter} size={18} />}
                                {pairFilter === "all" ? "All pairs" : pairFilter}
                                <ChevronDown className="chev" aria-hidden="true" />
                                <kbd>P</kbd>
                            </button>
                            {filtering && (
                                <button type="button" className="btn btn-ghost fade-in" onClick={clearFilters}>
                                    <X aria-hidden="true" />
                                    Clear
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="skeleton" aria-busy="true" aria-label="Loading trades">
                        <div className="sk sk-rows" />
                    </div>
                ) : failed ? (
                    <div className="lg-card fin-line fade-in">
                        <p>
                            <b>Trades didn’t load.</b> The server didn’t answer after three tries.
                        </p>
                        <button type="button" className="btn btn-sm" onClick={journal.retry}>
                            Try again
                        </button>
                    </div>
                ) : !any ? (
                    <div className="lg-card fade-in">
                        <button type="button" className="lg-row lg-addrow" onClick={onNew}>
                            <span className="lg-addmark" aria-hidden="true">
                                <Plus />
                            </span>
                            <span className="lg-name">
                                <b>Log your first trade</b>
                                <small>
                                    <span>Graded against your checklist; the results and the journal appear here</span>
                                </small>
                            </span>
                        </button>
                    </div>
                ) : (
                    <>
                        <Breakdown trades={filtered} pairTrades={byTfAndType} pair={pairFilter} onPair={setPairFilter} />

                        <div className="lg-card jr" aria-label="Journal">
                            <div className="jrow jr-colhead" aria-hidden="true">
                                <span>Trade</span>
                                <span className="col-date">Date</span>
                                <span className="col-grade">Grade</span>
                                <span className="col-type">Account</span>
                                <span className="col-tf">Time frame</span>
                                <span className="col-rr">R:R</span>
                                <span className="col-pnl">P&amp;L</span>
                                <span />
                            </div>
                            {!filtered.length && (
                                <p className="jr-none">
                                    Nothing was logged for this mix of time frame, account and pair.{" "}
                                    <button type="button" className="linkish" onClick={clearFilters}>
                                        Clear the filters
                                    </button>
                                </p>
                            )}
                            {open.length > 0 && <TradeGroup key={`open-${filterKey}`} title="Open" rows={open} note="Close them with the result and charts" withMonth onOpen={setSelected} />}
                            {months.map((m) => (
                                <TradeGroup key={`${m.key}-${filterKey}`} title={m.label} rows={m.rows} onOpen={setSelected} />
                            ))}
                            <p className="jr-foot">
                                <span>Trades from before this journal</span>
                                <a className="linkish" href="/Forex.zip" download>
                                    <Download aria-hidden="true" />
                                    Download them (zip)
                                </a>
                            </p>
                        </div>
                    </>
                )}
            </section>

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
                    await journal.reload();
                    setSelected(null);
                }}
            />
        </>
    );
}

/** A month (or the open trades): a band of the journal with its count and net, then its rows. */
function TradeGroup({ title, rows, note, withMonth, onOpen }) {
    const s = statsOf(rows);
    // the band's net is P&L, so an archived trade's result isn't in it; its win or loss still is
    const net = statsOf(rows.filter(inPnl)).net;
    const usd = useUsd();
    return (
        <div className="lg-group">
            <div className="jr-head">
                <span className="lg-group-name">
                    {title}
                    <span className="lg-group-count">{rows.length}</span>
                </span>
                {note ? (
                    <span className="jr-note">{note}</span>
                ) : (
                    <span className="jr-sum">
                        <span>
                            {s.wins}W {s.losses}L
                        </span>
                        <b className={sideOf(net)}>{usd.text(net)}</b>
                    </span>
                )}
            </div>
            <ul className="lg-rows stagger">
                {rows.map((t, i) => (
                    <TradeRow key={t._id} t={t} i={i} withMonth={withMonth} onOpen={() => onOpen(t)} />
                ))}
            </ul>
        </div>
    );
}

function TradeRow({ t, i, withMonth, onOpen }) {
    const pnl = pnlOf(t);
    const usd = useUsd();
    const pending = isOpen(t) && !pnl;
    return (
        <li style={{ "--i": i }}>
            <button type="button" className={`row-btn jrow${isArchived(t) ? " is-archived" : ""}`} onClick={onOpen}>
                <span className="row-main col-pair">
                    <MarketIcon symbol={t.tradeSymbol} size={26} />
                    <span className="row-text">
                        <span className="row-title">{t.tradeSymbol}</span>
                        <span className="row-sub">
                            {isArchived(t) && <span className="arch-tag">Archived</span>}
                            {t.description || "No notes"}
                        </span>
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
                <span className={`row-num pnl col-pnl ${sideOf(pnl)}`}>{pending ? <span className="open-tag">Open</span> : usd.text(pnl)}</span>
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
    const [archiving, setArchiving] = useState(false);
    const [viewing, setViewing] = useState(null); // index of the chart open full screen
    const usd = useUsd();
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

    // archived, a trade's result is out of the total P&L (and the net worth); every stat still counts it
    const archived = isArchived(t);
    const toggleArchive = async () => {
        if (archiving) return;
        setArchiving(true);
        try {
            await http(`/trades/archiveTrade/${t._id}`, { method: "PUT", body: { archived: !archived } });
            toast.success(archived ? "Trade restored" : "Trade archived", {
                description: archived ? `${t.tradeSymbol}’s result counts in the total P&L again` : `${t.tradeSymbol}’s result is out of the total P&L`,
            });
            await onUpdated();
        } catch (error) {
            console.error("Error archiving trade:", error);
            toast.error(archived ? "Could not restore the trade" : "Could not archive the trade");
        } finally {
            setArchiving(false);
        }
    };
    const archiveRow = (
        <div className={`trade-archive${archived ? " is-on" : ""}`}>
            <p>
                <b>{archived ? "Archived" : "Archive this trade"}</b>
                <span>{archived ? "Its result is out of the total P&L and the net worth. Every stat still counts it." : "Takes its result out of the total P&L and the net worth. Every stat still counts it."}</span>
            </p>
            <button type="button" className={`btn btn-sm${archiving ? " is-busy" : ""}`} onClick={toggleArchive} disabled={archiving}>
                {archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
                {archived ? "Restore" : "Archive"}
            </button>
        </div>
    );

    return (
        <Modal
            open={!!trade}
            onClose={onClose}
            wide
            busy={submitting || archiving}
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
                        archived ? "Archived" : null,
                    ]}
                />
            }
        >
            <div className="modal-body">
                {archived && archiveRow}
                <dl className="brief three trade-facts">
                    <div className="brief-cell">
                        <dt>P&amp;L</dt>
                        <dd className={`brief-num sm ${live && !pnl ? "" : sideOf(pnl)}`}>{live && !pnl ? <span className="muted">Open</span> : usd.text(pnl)}</dd>
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

                {!archived && archiveRow}
            </div>
        </Modal>
    );
}
