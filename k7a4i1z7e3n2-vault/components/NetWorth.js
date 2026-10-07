"use client";

import React, { useEffect, useState } from "react";
import { ChevronRight, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/http";
import { hasHandoff } from "@/lib/kite";
import { inr, num, pct } from "@/lib/kite";
import { sideOf } from "@/lib/format";
import { CATS, combine, growwWorth, manualWorth, mt5Worth, perUnit, zerodhaWorth } from "@/lib/worth";
import { demoFx, demoGroww, demoManual, demoMt5 } from "@/lib/worthDemo";
import Zerodha, { Rupees, SideTag, Sym, Table, useZerodha } from "./Zerodha";
import Seg from "./k7/Seg";

// Everything you own in one number: Zerodha, Groww, the MT5 forex accounts and what's typed in
// by hand (bank balances, deposits, loans). Each source loads on its own; the total counts the
// ones that answered and says which didn't.

const usd = (x, { sign = false } = {}) => {
    const n = Number(x) || 0;
    const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${n < 0 ? "−" : sign && n > 0 ? "+" : ""}$${abs}`;
};

/** One source's answer: loading, ready, unset (not configured), approve (Groww), or error. */
function useSource(path, demo, sample) {
    const [s, setS] = useState({ state: "loading" });
    const [ask, setAsk] = useState(0); // bumped to load again
    useEffect(() => {
        let gone = false;
        (async () => {
            try {
                const data = await (demo ? sample() : http(path));
                if (!gone) setS({ state: "ready", data });
            } catch (e) {
                if (gone) return;
                const state = e.status === 503 || e.status === 404 ? "unset" : e.code === "approve" ? "approve" : "error";
                setS({ state, message: e.detail || "Didn’t load" });
            }
        })();
        return () => {
            gone = true;
        };
    }, [path, demo, sample, ask]);
    const reload = () => {
        setS((p) => ({ ...p, state: p.data ? "refreshing" : "loading" }));
        setAsk((n) => n + 1);
    };
    return { ...s, reload, setData: (fn) => setS((p) => ({ ...p, data: fn(p.data) })) };
}

const PICK_KEY = "worthSource";

export default function NetWorth() {
    const z = useZerodha();
    const demo = Boolean(z.session?.demo);
    const fx = useSource("/worth/fx", demo, demoFx);
    const groww = useSource("/groww/account", demo, demoGroww);
    const mt5 = useSource("/mt5/accounts", demo, demoMt5);
    const manual = useSource("/worth/manual", demo, demoManual);
    const rate = fx.data?.rate || null;

    const [pick, setPick] = useState(() => {
        if (typeof window === "undefined" || hasHandoff()) return "zerodha";
        try {
            return localStorage.getItem(PICK_KEY) || "zerodha";
        } catch {
            return "zerodha";
        }
    });
    useEffect(() => {
        try {
            localStorage.setItem(PICK_KEY, pick);
        } catch {
            // storage blocked
        }
    }, [pick]);

    const sources = (() => {
        const list = [];
        const zw = z.phase === "ready" && z.account ? zerodhaWorth(z.account) : null;
        list.push({
            id: "zerodha",
            name: "Zerodha",
            kind: "Stocks, F&O, Coin funds",
            worth: zw,
            status: zw ? `Holdings ${inr(zw.parts.stocks, { whole: true })} · cash ${inr(zw.parts.cash, { whole: true })}` : { loading: "Loading…", connect: "Connect for today", unset: "Not set up yet", offline: "Server didn’t answer" }[z.phase] || "",
            tone: zw ? "ok" : z.phase === "loading" ? "" : "warn",
        });

        const gw = groww.state === "ready" || groww.state === "refreshing" ? (groww.data ? growwWorth(groww.data.sections) : null) : null;
        list.push({
            id: "groww",
            name: "Groww",
            kind: "Stocks and F&O",
            worth: gw,
            status: gw
                ? `${groww.data.sections.holdings?.data?.length || 0} holdings · delayed prices${gw.unpriced ? ` · ${gw.unpriced} at cost` : ""}`
                : { loading: "Loading…", unset: "Not set up yet", approve: "Approve the API key on Groww Cloud for today", error: groww.message }[groww.state],
            tone: gw ? "ok" : groww.state === "loading" ? "" : "warn",
        });

        if (mt5.data?.accounts?.length) {
            for (const a of mt5.data.accounts) {
                const w = mt5Worth(a, rate);
                list.push({
                    id: `mt5:${a.id || a.label}`,
                    name: a.label,
                    kind: w.counted ? "MT5 forex" : "MT5 · not counted",
                    worth: w.counted ? w : null,
                    shown: w.value,
                    account: a,
                    status: a.error
                        ? a.error
                        : `${a.info?.currency === "USC" ? `${num(a.info.equity)} US¢` : usd(a.info?.equity)} equity · ${a.positions.length} open · ${a.source === "addon" ? (a.live ? "live" : "add-on offline") : a.source === "myfxbook" ? "Myfxbook" : "MetaApi"}${w.counted ? "" : " · not counted"}`,
                    tone: a.error ? "warn" : w.counted ? "ok" : "",
                });
            }
        } else {
            list.push({
                id: "mt5",
                name: "MT5 accounts",
                kind: "Exness, FundingPips",
                worth: null,
                status: { loading: "Loading…", unset: "Not set up yet", error: mt5.message }[mt5.state] || "No accounts on MetaApi yet",
                tone: mt5.state === "loading" ? "" : "warn",
            });
        }

        const entries = manual.data || [];
        const mw = manual.state === "ready" || manual.state === "refreshing" ? manualWorth(entries, rate) : null;
        list.push({
            id: "manual",
            name: "Bank and cash",
            kind: "Typed in by hand",
            worth: mw,
            status: mw ? (entries.length ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}${entries.some((e) => e.kind === "loan") ? ", loans taken off" : ""}` : "Add HDFC, SBI and anything else") : { loading: "Loading…", error: manual.message, unset: "Server didn’t answer" }[manual.state],
            tone: mw && entries.length ? "ok" : "",
        });
        return list;
    })();

    const totals = combine(sources.map((s) => s.worth));
    const counted = sources.filter((s) => s.worth).length;
    const current = sources.find((s) => s.id === pick) || sources[0];

    const preview = () => z.preview();
    const exitPreview = () => z.exitPreview();
    const refreshAll = () => {
        z.refresh();
        fx.reload();
        groww.reload();
        mt5.reload();
        manual.reload();
    };

    return (
        <div className="nw fade-in">
            {demo && (
                <div className="statusbar kt-bar is-idle" role="status">
                    <i aria-hidden="true" />
                    <p>
                        <b>Sample data</b> <span className="muted">·</span> nothing here is from your accounts
                    </p>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={exitPreview}>
                        <X aria-hidden="true" />
                        <span className="btn-label">Exit preview</span>
                    </button>
                </div>
            )}

            <section className="nw-hero" aria-labelledby="nw-total">
                <div className="nw-main">
                    <span className="perf-label" id="nw-total">
                        Net worth
                    </span>
                    <span className="nw-num">
                        <Rupees value={totals.total} />
                    </span>
                    <span className="perf-sub">
                        {rate ? (
                            <>
                                {usd(totals.total / rate)} <span className="muted">at ₹{num(rate)} a dollar</span>
                            </>
                        ) : (
                            <span className="muted">Dollar rate unavailable; dollar accounts aren’t counted</span>
                        )}
                    </span>
                    {totals.day ? (
                        <span className="perf-sub">
                            Stocks today <b className={sideOf(totals.day)}>{inr(totals.day, { sign: true, whole: true })}</b>
                        </span>
                    ) : null}
                    <Split parts={totals.parts} gross={totals.gross} />
                    <span className="nw-foot">
                        From {counted} of {sources.length} sources
                        {!demo && counted < sources.length ? (
                            <>
                                {" "}
                                <span className="muted">·</span>{" "}
                                <button type="button" className="linkish" onClick={preview}>
                                    preview with sample data
                                </button>
                            </>
                        ) : null}
                    </span>
                </div>
                <ul className="nw-cats" aria-label="By kind">
                    {CATS.filter((c) => totals.parts[c.key]).map((c) => (
                        <li key={c.key} className={`nw-cat cat-${c.key}`}>
                            <i aria-hidden="true" />
                            <span>{c.label}</span>
                            <b className={c.key === "loans" ? "down" : ""}>
                                {c.key === "loans" ? "−" : ""}
                                {inr(totals.parts[c.key], { whole: true })}
                            </b>
                            <small>{totals.gross ? pct((totals.parts[c.key] / totals.gross) * 100, { sign: false }) : ""}</small>
                        </li>
                    ))}
                    {!CATS.some((c) => totals.parts[c.key]) && <li className="nw-cat-empty">Nothing counted yet. Connect a source below.</li>}
                </ul>
            </section>

            <section className="group" aria-labelledby="nw-sources">
                <div className="group-head">
                    <h2 id="nw-sources">Accounts</h2>
                    <span className="count">{sources.length}</span>
                    <button type="button" className="btn btn-ghost btn-sm nw-refresh" onClick={refreshAll} title="Refresh everything">
                        <RefreshCw aria-hidden="true" />
                        <span className="btn-label">Refresh</span>
                    </button>
                </div>
                <div className="rows-card">
                    <ul className="rows stagger">
                        {sources.map((s, i) => (
                            <li key={s.id} style={{ "--i": i }}>
                                <button type="button" className="row-btn nw-row" aria-pressed={current.id === s.id} onClick={() => setPick(s.id)}>
                                    <span className="row-main">
                                        <span className={`nw-mark tone-${s.tone || "none"}`} aria-hidden="true">
                                            {s.name.slice(0, 1)}
                                        </span>
                                        <span className="row-text">
                                            <span className="row-title">
                                                {s.name} <span className="nw-kind">{s.kind}</span>
                                            </span>
                                            <span className="row-sub">{s.status}</span>
                                        </span>
                                    </span>
                                    <span className={`row-num nw-value${s.worth || s.shown != null ? "" : " muted"}`}>
                                        {s.worth ? inr(s.worth.total, { whole: true }) : s.shown != null ? <s title="Not counted">{inr(s.shown, { whole: true })}</s> : "—"}
                                    </span>
                                    <ChevronRight className="row-go" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <section className="group nw-detail" aria-labelledby="nw-detail">
                <div className="group-head">
                    <h2 id="nw-detail">{current.name}</h2>
                    <span className="group-note">{current.kind}</span>
                </div>
                {current.id === "zerodha" ? (
                    <Zerodha z={z} onPreview={preview} />
                ) : current.id === "groww" ? (
                    <GrowwPanel src={groww} onPreview={preview} />
                ) : current.id.startsWith("mt5") ? (
                    <Mt5Panel src={mt5} account={current.account} rate={rate} demo={demo} onPreview={preview} />
                ) : (
                    <ManualPanel src={manual} demo={demo} rate={rate} />
                )}
            </section>
        </div>
    );
}

/** The total split by kind, as one flat bar. */
function Split({ parts, gross }) {
    if (!gross) return null;
    return (
        <div className="nw-split" aria-hidden="true">
            {CATS.filter((c) => c.key !== "loans" && parts[c.key] > 0).map((c) => (
                <span key={c.key} className={`cat-${c.key}`} style={{ flexGrow: parts[c.key] }} title={c.label} />
            ))}
        </div>
    );
}

/** When a source can't be shown: why, and what to do about it. */
function Setup({ title, children, onPreview, onRetry }) {
    return (
        <div className="kt-connect nw-setup">
            <h2>{title}</h2>
            <p>{children}</p>
            <div className="kt-connect-actions">
                {onRetry && (
                    <button type="button" className="btn btn-primary" onClick={onRetry}>
                        Try again
                    </button>
                )}
                {onPreview && (
                    <button type="button" className="btn btn-ghost" onClick={onPreview}>
                        Preview with sample data
                    </button>
                )}
            </div>
        </div>
    );
}

// ---------- Groww ----------

function GrowwPanel({ src, onPreview }) {
    if (src.state === "loading") return <div className="sk sk-rows" aria-busy="true" />;
    if (src.state === "unset")
        return (
            <Setup title="Groww isn’t set up yet" onPreview={onPreview}>
                Create an API key on Groww Cloud (the free tier is enough), then add <code>GROWW_API_KEY</code> and <code>GROWW_API_SECRET</code> to the API server.
            </Setup>
        );
    if (src.state === "approve")
        return (
            <Setup title="Approve Groww for today" onRetry={src.reload} onPreview={onPreview}>
                Groww needs the API key approved once a day. Approve it on Groww Cloud’s API keys page, then try again.
            </Setup>
        );
    if (src.state === "error" || !src.data)
        return (
            <Setup title="Groww didn’t load" onRetry={src.reload}>
                {src.message}
            </Setup>
        );

    const s = src.data.sections;
    const list = [...(s.holdings?.data || [])].sort((a, b) => (b.last_price ?? b.average_price) * b.quantity - (a.last_price ?? a.average_price) * a.quantity);
    const invested = list.reduce((a, x) => a + x.quantity * x.average_price, 0);
    const w = growwWorth(s);
    const pnl = w.parts.stocks - invested;
    const f = s.funds?.data || {};
    const positions = s.positions?.data || [];

    return (
        <div className="kt">
            <dl className="brief kt-brief">
                <div className="brief-cell">
                    <dt>Holdings value</dt>
                    <dd className="brief-num sm">
                        <Rupees value={w.parts.stocks} />
                    </dd>
                    <dd className="brief-sub">Delayed prices{w.unpriced ? `, ${w.unpriced} at cost` : ""}</dd>
                </div>
                <div className="brief-cell">
                    <dt>P&amp;L</dt>
                    <dd className={`brief-num sm ${sideOf(pnl)}`}>{inr(pnl, { sign: true, whole: true })}</dd>
                    <dd className="brief-sub">
                        {pct(invested ? (pnl / invested) * 100 : null)} on {inr(invested, { whole: true })}
                    </dd>
                </div>
                <div className="brief-cell">
                    <dt>Today</dt>
                    <dd className={`brief-num sm ${sideOf(w.day)}`}>{inr(w.day, { sign: true, whole: true })}</dd>
                    <dd className="brief-sub">Against yesterday’s close</dd>
                </div>
                <div className="brief-cell">
                    <dt>Cash</dt>
                    <dd className="brief-num sm">
                        <Rupees value={f.clear_cash || 0} />
                    </dd>
                    <dd className="brief-sub">Margin used {inr(f.net_margin_used || 0, { whole: true })}</dd>
                </div>
            </dl>
            {s.holdings?.error && <p className="kt-note">Groww didn’t send holdings: {s.holdings.error.message}</p>}
            {list.length > 0 && (
                <Table
                    label="Groww holdings"
                    cols="minmax(0, 1.6fr) 4rem 6rem 6rem 7rem 7.5rem"
                    colsSm="minmax(0, 1fr) 7rem"
                    hide={[1, 2, 3, 4]}
                    head={["Instrument", "Qty", "Avg cost", "Price", "Value", "P&L"]}
                    rows={list}
                    rowKey={(r) => r.isin || r.trading_symbol}
                    render={(r) => {
                        const priced = r.last_price != null;
                        const value = r.quantity * (priced ? r.last_price : r.average_price);
                        const gain = priced ? r.quantity * (r.last_price - r.average_price) : null;
                        return [
                            <Sym key="s" title={r.trading_symbol} sub={priced && r.close_price ? `Today ${pct(((r.last_price - r.close_price) / r.close_price) * 100)}` : `${num(r.quantity, 0)} shares`} />,
                            <span key="q" className="kt-num">{num(r.quantity, 0)}</span>,
                            <span key="a" className="kt-num">{num(r.average_price)}</span>,
                            <span key="l" className={`kt-num${priced ? "" : " muted"}`}>{priced ? num(r.last_price) : "No price"}</span>,
                            <span key="v" className="kt-num">{inr(value, { whole: true })}</span>,
                            <span key="p" className={`kt-num pnl ${sideOf(gain)}`}>
                                {gain == null ? "—" : inr(gain, { sign: true, whole: true })}
                                {gain != null && <small>{pct(((r.last_price - r.average_price) / r.average_price) * 100)}</small>}
                            </span>,
                        ];
                    }}
                />
            )}
            {positions.length > 0 && (
                <>
                    <div className="kt-sub-head">
                        <h3 className="group-title">Positions</h3>
                        <span className="count">{positions.length}</span>
                    </div>
                    <Table
                        label="Groww positions"
                        cols="minmax(0, 1.6fr) 5rem 5rem 6.5rem 7.5rem"
                        colsSm="minmax(0, 1fr) 3.5rem 6.5rem"
                        hide={[1, 3]}
                        head={["Instrument", "Segment", "Qty", "Avg", "Booked"]}
                        rows={positions}
                        rowKey={(r) => `${r.segment}:${r.trading_symbol}:${r.product}`}
                        render={(r) => [
                            <Sym key="s" title={r.trading_symbol} sub={[r.exchange, r.product].filter(Boolean).join(" · ")} />,
                            <span key="g" className="kt-meta">{r.segment === "FNO" ? "F&O" : "Cash"}</span>,
                            <span key="q" className="kt-num">{num(r.quantity, 0)}</span>,
                            <span key="a" className="kt-num">{r.net_price ? num(r.net_price) : "—"}</span>,
                            <span key="p" className={`kt-num pnl ${sideOf(r.realised_pnl)}`}>{inr(r.realised_pnl || 0, { sign: true })}</span>,
                        ]}
                    />
                </>
            )}
            <p className="nw-fine">Groww’s free API has no prices, so holdings are valued with delayed NSE and BSE prices from Yahoo Finance.</p>
        </div>
    );
}

// ---------- MT5 ----------

function Mt5Panel({ src, account, rate, demo, onPreview }) {
    if (src.state === "loading") return <div className="sk sk-rows" aria-busy="true" />;
    if (src.state === "unset" || (src.state === "ready" && !account))
        return (
            <Setup title={src.state === "unset" ? "MT5 accounts aren’t set up yet" : "No MT5 accounts yet"} onPreview={onPreview}>
                Two free, read-only ways, use either or both: <b>Myfxbook</b> (connect your accounts there with their investor passwords, then add <code>MYFXBOOK_EMAIL</code> and{" "}
                <code>MYFXBOOK_PASSWORD</code> to the API server), or the{" "}
                <a href="/KaizenReporter.mq5" download>
                    Kaizen Reporter add-on
                </a>{" "}
                for MT5 (live while MT5 is open; set <code>MT5_PUSH_TOKEN</code> on the server and paste the same token into the add-on).
            </Setup>
        );
    if (src.state === "error" || !account)
        return (
            <Setup title="MT5 accounts didn’t load" onRetry={src.reload}>
                {src.message}
            </Setup>
        );
    if (account.error)
        return (
            <>
                <AccountSettings key={account.id} src={src} account={account} demo={demo} />
                <Setup title={`${account.label} didn’t load`} onRetry={src.reload}>
                    {account.error}
                </Setup>
                <AddMt5 />
            </>
        );

    const a = account.info;
    const k = perUnit(a.currency, rate);
    const money = (x, o) => (a.currency === "USC" ? `${num(x)} US¢` : a.currency === "INR" ? inr(x, o) : usd(x, o));
    const floating = (a.equity || 0) - (a.balance || 0);
    const has = (x) => x != null;
    return (
        <div className="kt">
            <AccountSettings key={account.id} src={src} account={account} demo={demo} />
            <p className={`nw-source${account.source === "addon" && !account.live ? " is-stale" : ""}`}>
                <i aria-hidden="true" />
                {sourceLine(account)}
            </p>
            {!account.counted && account.prop && (
                <p className="kt-note nw-prop">A funded account trades the firm’s money, so it isn’t counted in your net worth. Only your profit split is yours once it’s paid out.</p>
            )}
            <dl className="brief kt-brief">
                <div className="brief-cell">
                    <dt>Equity</dt>
                    <dd className="brief-num sm">{money(a.equity)}</dd>
                    <dd className="brief-sub">{k ? `${inr(a.equity * k, { whole: true })}` : "No rupee rate for this currency"}</dd>
                </div>
                <div className="brief-cell">
                    <dt>Balance</dt>
                    <dd className="brief-num sm">{money(a.balance)}</dd>
                    <dd className="brief-sub">Closed trades only</dd>
                </div>
                <div className="brief-cell">
                    <dt>Floating P&amp;L</dt>
                    <dd className={`brief-num sm ${sideOf(floating)}`}>{money(floating, { sign: true })}</dd>
                    <dd className="brief-sub">{account.positions.length} open</dd>
                </div>
                <div className="brief-cell">
                    <dt>Free margin</dt>
                    <dd className="brief-num sm">{has(a.freeMargin) ? money(a.freeMargin) : <span className="muted">—</span>}</dd>
                    <dd className="brief-sub">
                        {has(a.margin) ? (
                            <>
                                Used {money(a.margin)}
                                {a.marginLevel ? ` · level ${num(a.marginLevel, 0)}%` : ""}
                            </>
                        ) : (
                            "Myfxbook doesn’t report margin"
                        )}
                    </dd>
                </div>
            </dl>
            <p className="nw-fine">
                {[a.broker, a.server, a.login ? `login ${a.login}` : "", a.leverage ? `1:${a.leverage}` : ""].filter(Boolean).join(" · ")}
            </p>
            {account.positions.length > 0 ? (
                <Table
                    label={`${account.label} positions`}
                    cols="minmax(0, 1.3fr) 4rem 4.5rem 6.5rem 6.5rem 7rem"
                    colsSm="minmax(0, 1fr) 3.2rem 6rem"
                    hide={[2, 3, 4]}
                    head={["Symbol", "Side", "Lots", "Open", "Now", "Profit"]}
                    rows={account.positions}
                    rowKey={(r) => r.id}
                    render={(r) => [
                        <Sym key="s" title={r.symbol} sub={r.swap ? `Swap ${money(r.swap, { sign: true })}` : ""} />,
                        <SideTag key="d" side={String(r.type).includes("BUY") ? "BUY" : "SELL"} />,
                        <span key="v" className="kt-num">{num(r.volume)}</span>,
                        <span key="o" className="kt-num">{has(r.openPrice) ? num(r.openPrice, 5) : "—"}</span>,
                        <span key="c" className="kt-num">{has(r.currentPrice) ? num(r.currentPrice, 5) : "—"}</span>,
                        <span key="p" className={`kt-num pnl ${sideOf(r.profit)}`}>{money(r.profit, { sign: true })}</span>,
                    ]}
                />
            ) : (
                <p className="empty-note">No open positions.</p>
            )}
            <AddMt5 />
        </div>
    );
}

/** How to bring in another MT5 account; shown under every account so the add-on is always at hand. */
function AddMt5() {
    return (
        <p className="nw-fine">
            Another MT5 account: connect it on Myfxbook with its investor password, or run the{" "}
            <a href="/KaizenReporter.mq5" download>
                Kaizen Reporter add-on
            </a>{" "}
            in MT5 (any broker or server, live while MT5 is open).
        </p>
    );
}

/** Where this account's numbers came from, and how fresh they are. */
function sourceLine(a) {
    const when = a.updatedAt ? new Date(a.updatedAt) : null;
    const at = when && Number.isFinite(when.getTime()) ? when.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
    if (a.source === "addon") return a.live ? "Live from your MT5, through the Kaizen Reporter add-on" : `Last sent by the add-on ${at}; MT5 isn’t running it right now`;
    if (a.source === "myfxbook") return `From Myfxbook${at ? `, updated ${at}` : ""}; it refreshes every few minutes`;
    return "From MetaApi";
}

/** This vault's settings for one MT5 account: its name here, and whether it counts. */
function AccountSettings({ src, account, demo }) {
    const [name, setName] = useState(account.label);
    const [saving, setSaving] = useState(false);
    const save = async (fields) => {
        setSaving(true);
        try {
            if (!demo) await http(`/mt5/accounts/${encodeURIComponent(account.id)}`, { method: "PUT", body: fields });
            src.setData((d) => ({
                ...d,
                accounts: d.accounts.map((x) => (x.id === account.id ? { ...x, ...fields, ...(fields.counted != null ? { prop: !fields.counted } : {}) } : x)),
            }));
        } catch {
            toast.error("Didn’t save", { description: "Try again in a moment." });
        } finally {
            setSaving(false);
        }
    };
    const rename = (e) => {
        e.preventDefault();
        const label = name.trim();
        if (label && label !== account.label) save({ label });
    };
    return (
        <div className="nw-acc-settings">
            <form className="nw-acc-name" onSubmit={rename}>
                <label htmlFor={`nw-acc-${account.id}`} className="field-label">
                    Name here
                </label>
                <input id={`nw-acc-${account.id}`} className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={rename} maxLength={40} disabled={saving} />
            </form>
            <div className="nw-acc-count">
                <span className="field-label">In net worth</span>
                <Seg
                    label="Count in net worth"
                    value={account.counted ? "yes" : "no"}
                    onChange={(v) => save({ counted: v === "yes" })}
                    options={[
                        { value: "yes", label: "Counted" },
                        { value: "no", label: "Not counted" },
                    ]}
                />
            </div>
            <p className="nw-fine nw-acc-meta">{[account.server, account.login ? `login ${account.login}` : "", account.region].filter(Boolean).join(" · ")}</p>
        </div>
    );
}

// ---------- Typed in by hand ----------

const KINDS = [
    { value: "bank", label: "Bank" },
    { value: "cash", label: "Cash" },
    { value: "deposit", label: "Deposit" },
    { value: "crypto", label: "Crypto" },
    { value: "property", label: "Property" },
    { value: "other", label: "Other" },
    { value: "loan", label: "Loan" },
];
const kindLabel = (k) => KINDS.find((x) => x.value === k)?.label || k;
const BLANK = { name: "", kind: "bank", amount: "", currency: "INR", note: "" };

function ManualPanel({ src, demo, rate }) {
    const [editing, setEditing] = useState(null); // null | "new" | an entry's _id
    const [form, setForm] = useState(BLANK);
    const [saving, setSaving] = useState(false);
    const entries = src.data || [];

    if (src.state === "loading") return <div className="sk sk-rows" aria-busy="true" />;
    if (src.state === "error" || src.state === "unset")
        return (
            <Setup title="Entries didn’t load" onRetry={src.reload}>
                {src.message}
            </Setup>
        );

    const open = (entry) => {
        setEditing(entry ? entry._id : "new");
        setForm(entry ? { name: entry.name, kind: entry.kind, amount: String(entry.amount), currency: entry.currency, note: entry.note || "" } : BLANK);
    };
    const close = () => {
        setEditing(null);
        setForm(BLANK);
    };
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

    const save = async (e) => {
        e.preventDefault();
        const amount = Number(String(form.amount).replace(/[,\s₹$]/g, ""));
        if (!form.name.trim() || !Number.isFinite(amount) || amount < 0) {
            toast.error("Add a name and an amount");
            return;
        }
        const body = { ...form, name: form.name.trim(), amount, note: form.note.trim() };
        setSaving(true);
        try {
            if (demo) {
                const doc = { ...body, _id: editing === "new" ? `d${Date.now()}` : editing, updatedAt: new Date().toISOString() };
                src.setData((list = []) => (editing === "new" ? [...list, doc] : list.map((x) => (x._id === editing ? doc : x))));
            } else if (editing === "new") {
                const doc = await http("/worth/manual", { method: "POST", body });
                src.setData((list = []) => [...list, doc]);
            } else {
                const doc = await http(`/worth/manual/${editing}`, { method: "PUT", body });
                src.setData((list = []) => list.map((x) => (x._id === editing ? doc : x)));
            }
            close();
        } catch {
            toast.error("Didn’t save", { description: "Try again in a moment." });
        } finally {
            setSaving(false);
        }
    };

    const remove = async (entry) => {
        try {
            if (!demo) await http(`/worth/manual/${entry._id}`, { method: "DELETE" });
            src.setData((list = []) => list.filter((x) => x._id !== entry._id));
            if (editing === entry._id) close();
        } catch {
            toast.error("Didn’t delete", { description: "Try again in a moment." });
        }
    };

    const form_ = (
        <form className="nw-form" onSubmit={save}>
            <div className="nw-form-grid">
                <div className="field">
                    <label htmlFor="nw-name">Name</label>
                    <input id="nw-name" className="input" value={form.name} onChange={set("name")} placeholder="HDFC savings" maxLength={60} autoFocus />
                </div>
                <div className="field">
                    <label htmlFor="nw-amount">Amount</label>
                    <input id="nw-amount" className="input" value={form.amount} onChange={set("amount")} inputMode="decimal" placeholder="0" />
                </div>
                <div className="field nw-span">
                    <span className="field-label">Kind</span>
                    <Seg label="Kind" options={KINDS} value={form.kind} onChange={set("kind")} />
                </div>
                <div className="field">
                    <span className="field-label">Currency</span>
                    <Seg label="Currency" options={["INR", "USD"]} value={form.currency} onChange={set("currency")} />
                </div>
                <div className="field">
                    <label htmlFor="nw-note">Note</label>
                    <input id="nw-note" className="input" value={form.note} onChange={set("note")} placeholder="Optional" maxLength={120} />
                </div>
            </div>
            <div className="nw-form-actions">
                <button type="button" className="btn btn-ghost" onClick={close}>
                    Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {editing === "new" ? "Add" : "Save"}
                </button>
            </div>
        </form>
    );

    return (
        <div className="kt">
            <div className="kt-sub-head nw-manual-head">
                <span className="group-note">Bank balances, deposits, cash, and loans to take off. Update them when they change.</span>
                {editing !== "new" && (
                    <button type="button" className="btn btn-sm" onClick={() => open(null)}>
                        <Plus aria-hidden="true" />
                        Add
                    </button>
                )}
            </div>
            {editing === "new" && form_}
            {entries.length > 0 ? (
                <div className="rows-card kt-table">
                    <ul className="rows">
                        {entries.map((e) =>
                            editing === e._id ? (
                                <li key={e._id} className="nw-editing">
                                    {form_}
                                </li>
                            ) : (
                                <li key={e._id} className="kt-row nw-entry">
                                    <span className="kt-cell">
                                        <Sym title={e.name} sub={[kindLabel(e.kind), e.note, e.updatedAt ? `updated ${new Date(e.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""].filter(Boolean).join(" · ")} />
                                    </span>
                                    <span className="kt-cell kt-r">
                                        <span className={`kt-num${e.kind === "loan" ? " down" : ""}`}>
                                            {e.kind === "loan" ? "−" : ""}
                                            {e.currency === "USD" ? usd(e.amount) : inr(e.amount)}
                                            {e.currency === "USD" && rate ? <small>{inr(e.amount * rate, { whole: true })}</small> : null}
                                        </span>
                                    </span>
                                    <span className="kt-cell kt-r nw-entry-actions">
                                        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => open(e)} aria-label={`Edit ${e.name}`}>
                                            <Pencil aria-hidden="true" />
                                        </button>
                                        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(e)} aria-label={`Delete ${e.name}`}>
                                            <Trash2 aria-hidden="true" />
                                        </button>
                                    </span>
                                </li>
                            )
                        )}
                    </ul>
                </div>
            ) : (
                editing !== "new" && <p className="empty-note">Nothing yet. Add your HDFC and SBI balances to count them.</p>
            )}
            <p className="nw-fine">HDFC and SBI don’t offer APIs for personal accounts, so these are typed in. Reading their alert emails could fill them in later.</p>
        </div>
    );
}
