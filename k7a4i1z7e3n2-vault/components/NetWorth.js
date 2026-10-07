"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CandlestickChart, Landmark, Pencil, Plus, RefreshCw, Trash2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/http";
import { hasHandoff, inr, num, pct } from "@/lib/kite";
import { sideOf } from "@/lib/format";
import { CATS, combine, cryptoWorth, growwWorth, manualWorth, mt5Worth, perUnit, zerodhaWorth } from "@/lib/worth";
import { demoCrypto, demoFx, demoGroww, demoHistory, demoManual, demoMt5 } from "@/lib/worthDemo";
import { CHAIN_INFO, CHAIN_SHORT, NETWORK_KEY, chainOf, shortAddress, walletOf } from "@/lib/wallets";
import { CoinIcon, NetworkStack, WalletIcon } from "./k7/CryptoIcons";
import Zerodha, { Rupees, SideTag, Sym, Table, useZerodha } from "./Zerodha";
import AddWallet from "./AddWallet";
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
const POSTED_KEY = "worthPosted";

/** Rupees the short way for big totals: ₹21.86 L, ₹1.24 Cr. */
const inrShort = (x) => {
    const n = Math.abs(Number(x) || 0);
    const sign = x < 0 ? "−" : "";
    if (n >= 1e7) return `${sign}₹${(n / 1e7).toFixed(2)} Cr`;
    if (n >= 1e5) return `${sign}₹${(n / 1e5).toFixed(2)} L`;
    return `${sign}${inr(n, { whole: true })}`;
};

// brand-ish flat colours for the marks; only a tint and an initial, no logos
const SOURCE_COLOR = { zerodha: "#387ED1", groww: "#00A67E", mt5: "#C9971C", prop: "#7C5CE0", manual: "#2F8F8A", crypto: "#D0782C" };

/** An account's mark: a wallet's own icon, or a solid brand tile with an initial or a symbol. */
function SourceMark({ source, size = 38 }) {
    if (source.wallet) return <WalletIcon id={source.wallet} size={size} />;
    const glyph = source.glyph === "bank" ? <Landmark /> : source.glyph === "forex" ? <CandlestickChart /> : source.glyph === "wallet" ? <Wallet /> : <span>{source.name.slice(0, 1)}</span>;
    return (
        <span className="bm" style={{ "--bc": source.color, "--bs": `${size}px` }} aria-hidden="true">
            {glyph}
        </span>
    );
}

export default function NetWorth() {
    const z = useZerodha();
    const demo = Boolean(z.session?.demo);
    const fx = useSource("/worth/fx", demo, demoFx);
    const groww = useSource("/groww/account", demo, demoGroww);
    const mt5 = useSource("/mt5/accounts", demo, demoMt5);
    const manual = useSource("/worth/manual", demo, demoManual);
    const wallets = useSource("/crypto/wallets", demo, demoCrypto);
    const history = useSource("/worth/history?days=1825", demo, demoHistory);
    const rate = fx.data?.rate || null;
    const [adding, setAdding] = useState(null); // null | "new" | a wallet being edited
    const [savingWallet, setSavingWallet] = useState(false);

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

    const ready = (s) => s.state === "ready" || s.state === "refreshing";

    // ---- every source as a tile ----
    const sources = [];
    const zw = z.phase === "ready" && z.account ? zerodhaWorth(z.account) : null;
    sources.push({
        id: "zerodha",
        name: "Zerodha",
        kind: "Stocks, F&O, Coin funds",
        color: SOURCE_COLOR.zerodha,
        worth: zw,
        status: zw ? `Holdings ${inrShort(zw.parts.stocks)} · cash ${inrShort(zw.parts.cash)}` : { loading: "Loading…", connect: "Connect for today", unset: "Not set up yet", offline: "Server didn’t answer" }[z.phase] || "",
        tone: zw ? "ok" : z.phase === "loading" ? "" : "warn",
    });

    const gw = ready(groww) && groww.data ? growwWorth(groww.data.sections) : null;
    sources.push({
        id: "groww",
        name: "Groww",
        kind: "Stocks and F&O",
        color: SOURCE_COLOR.groww,
        worth: gw,
        status: gw
            ? `${groww.data.sections.holdings?.data?.length || 0} holdings · delayed prices`
            : { loading: "Loading…", unset: "Not set up yet", approve: "Approve today on Groww Cloud", error: groww.message }[groww.state],
        tone: gw ? "ok" : groww.state === "loading" ? "" : "warn",
    });

    if (mt5.data?.accounts?.length) {
        for (const a of mt5.data.accounts) {
            const w = mt5Worth(a, rate);
            sources.push({
                id: `mt5:${a.id || a.label}`,
                name: a.label,
                kind: w.counted ? "MT5 forex" : "MT5 · funded, not counted",
                color: w.counted ? SOURCE_COLOR.mt5 : SOURCE_COLOR.prop,
                worth: w.counted ? w : null,
                shown: w.value,
                account: a,
                status: a.error
                    ? a.error
                    : `${a.info?.currency === "USC" ? `${num(a.info.equity)} US¢` : usd(a.info?.equity)} · ${a.positions.length} open · ${a.source === "addon" ? (a.live ? "live" : "add-on offline") : a.source === "myfxbook" ? "Myfxbook" : "MetaApi"}`,
                tone: a.error ? "warn" : a.source === "addon" && a.live ? "live" : "ok",
            });
        }
    } else {
        sources.push({
            id: "mt5",
            glyph: "forex",
            name: "MT5 accounts",
            kind: "Exness, FundingPips",
            color: SOURCE_COLOR.mt5,
            worth: null,
            status: { loading: "Loading…", unset: "Not set up yet", error: mt5.message }[mt5.state] || "No accounts yet",
            tone: mt5.state === "loading" ? "" : "warn",
        });
    }

    const walletList = wallets.data?.wallets || [];
    if (walletList.length) {
        for (const w of walletList) {
            const coins = [...new Set((w.holdings || []).map((h) => h.symbol))];
            sources.push({
                id: `crypto:${w._id}`,
                name: w.name,
                kind: `Crypto · ${(w.addresses || []).map((a) => CHAIN_SHORT[a.chain]).join(", ")}`,
                wallet: w.kind || "other",
                worth: cryptoWorth({ wallets: [w] }),
                status: w.error ? "Some chains didn’t answer" : coins.length ? coins.slice(0, 4).join(", ") + (coins.length > 4 ? "…" : "") : "Nothing on these addresses yet",
                tone: w.error ? "warn" : "ok",
                cryptoWallet: w,
            });
        }
    } else {
        sources.push({
            id: "crypto",
            glyph: "wallet",
            name: "Crypto wallets",
            kind: "Trust Wallet, MetaMask, Phantom…",
            color: SOURCE_COLOR.crypto,
            worth: ready(wallets) ? cryptoWorth(wallets.data) : null,
            status: { loading: "Loading…", error: wallets.message, unset: "Server didn’t answer" }[wallets.state] || "Add a wallet: no keys, read only",
            tone: "",
        });
    }

    const entries = manual.data || [];
    const mw = ready(manual) ? manualWorth(entries, rate) : null;
    sources.push({
        id: "manual",
        glyph: "bank",
        name: "Bank and cash",
        kind: "Typed in by hand",
        color: SOURCE_COLOR.manual,
        worth: mw,
        status: mw ? (entries.length ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}${entries.some((e) => e.kind === "loan") ? ", loans taken off" : ""}` : "Add HDFC, SBI and the rest") : { loading: "Loading…", error: manual.message, unset: "Server didn’t answer" }[manual.state],
        tone: mw && entries.length ? "ok" : "",
    });

    const totals = combine(sources.map((s) => s.worth));
    const counted = sources.filter((s) => s.worth && s.worth.total).length;
    const current = sources.find((s) => s.id === pick) || sources[0];
    const settled = z.phase !== "loading" && [fx, groww, mt5, manual, wallets].every((s) => s.state !== "loading" && s.state !== "refreshing");

    // ---- today's point on the history line, sent once things have settled ----
    useEffect(() => {
        if (demo || !settled || !counted) return;
        let last = null;
        try {
            last = JSON.parse(localStorage.getItem(POSTED_KEY) || "null");
        } catch {
            // nothing remembered
        }
        const fresh = last && Date.now() - last.at < 30 * 60 * 1000 && Math.abs(last.total - totals.total) < Math.max(1, Math.abs(totals.total) * 0.002);
        if (fresh) return;
        http("/worth/history", { method: "POST", body: { total: totals.total, parts: totals.parts, sources: counted } })
            .then(() => {
                try {
                    localStorage.setItem(POSTED_KEY, JSON.stringify({ at: Date.now(), total: totals.total }));
                } catch {
                    // storage blocked
                }
            })
            .catch(() => {});
    }, [demo, settled, counted, totals.total, totals.parts]);

    const points = useMemo(() => {
        const list = [...(history.data || [])];
        const today = new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
        if (settled && counted) {
            if (list.length && list[list.length - 1].date === today) list[list.length - 1] = { ...list[list.length - 1], total: totals.total };
            else list.push({ date: today, total: totals.total });
        }
        return list;
    }, [history.data, settled, counted, totals.total]);

    const preview = () => z.preview();
    const exitPreview = () => z.exitPreview();
    const refreshAll = () => {
        z.refresh();
        fx.reload();
        groww.reload();
        mt5.reload();
        manual.reload();
        wallets.reload();
    };

    const saveWallet = async (fields) => {
        setSavingWallet(true);
        try {
            const editing = adding && adding !== "new" ? adding : null;
            if (demo) {
                const addresses = fields.addresses.map((address) => ({ address, chain: chainOf(address), holdings: [], inr: 0, usd: 0, error: null }));
                const id = editing?._id || `d${Date.now()}`;
                wallets.setData((d) => ({
                    ...d,
                    wallets: editing
                        ? d.wallets.map((w) => (w._id === editing._id ? { ...w, ...fields, addresses } : w))
                        : [...d.wallets, { _id: id, ...fields, addresses, holdings: [], inr: 0, usd: 0, error: null }],
                }));
                setPick(`crypto:${id}`);
            } else if (editing) {
                await http(`/crypto/wallets/${editing._id}`, { method: "PUT", body: fields });
                wallets.reload();
            } else {
                const doc = await http("/crypto/wallets", { method: "POST", body: fields });
                setPick(`crypto:${doc._id}`);
                wallets.reload();
            }
            toast.success(editing ? "Wallet saved" : "Wallet added", { description: "Reading its balances from the chains." });
            setAdding(null);
        } catch (err) {
            toast.error("Didn’t save", { description: err.detail || "Try again in a moment." });
        } finally {
            setSavingWallet(false);
        }
    };

    const removeWallet = async (w) => {
        try {
            if (!demo) await http(`/crypto/wallets/${w._id}`, { method: "DELETE" });
            wallets.setData((d) => ({ ...d, wallets: d.wallets.filter((x) => x._id !== w._id) }));
            setPick("zerodha");
        } catch {
            toast.error("Didn’t remove it", { description: "Try again in a moment." });
        }
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

            <Hero totals={totals} rate={rate} points={points} counted={counted} sources={sources.length} demo={demo} onPreview={preview} />

            <section className="group" aria-labelledby="nw-sources">
                <div className="group-head nw-tiles-head">
                    <h2 id="nw-sources">Accounts</h2>
                    <span className="count">{sources.length}</span>
                    <div className="nw-tiles-actions">
                        <button type="button" className="btn btn-sm" onClick={() => setAdding("new")}>
                            <Plus aria-hidden="true" />
                            <span className="btn-label">Crypto wallet</span>
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={refreshAll} title="Refresh everything">
                            <RefreshCw aria-hidden="true" />
                            <span className="btn-label">Refresh</span>
                        </button>
                    </div>
                </div>
                <ul className="nw-tiles stagger">
                    {sources.map((s, i) => {
                        const value = s.worth ? s.worth.total : s.shown;
                        const share = s.worth && totals.gross ? Math.max(0, (s.worth.total / totals.gross) * 100) : 0;
                        return (
                            <li key={s.id} style={{ "--i": i }}>
                                <button type="button" className="nw-tile" aria-pressed={current.id === s.id} onClick={() => setPick(s.id)}>
                                    <span className="nw-tile-top">
                                        <SourceMark source={s} />
                                        <span className="nw-tile-name">
                                            <b>{s.name}</b>
                                            <small>{s.kind}</small>
                                        </span>
                                        <i className={`nw-dot tone-${s.tone || "none"}`} aria-hidden="true" />
                                    </span>
                                    <span className={`nw-tile-value${value == null ? " muted" : ""}${s.worth ? "" : " is-off"}`}>
                                        {value == null ? "—" : s.worth ? inrShort(value) : <s title="Not counted">{inrShort(value)}</s>}
                                        {s.worth && share >= 0.5 ? <small>{pct(share, { sign: false })}</small> : null}
                                    </span>
                                    <span className="nw-tile-bar" aria-hidden="true">
                                        <i style={{ width: `${Math.min(100, share)}%`, background: s.color || walletOf(s.wallet).color }} />
                                    </span>
                                    <span className="nw-tile-status">{s.status}</span>
                                </button>
                            </li>
                        );
                    })}
                    <li style={{ "--i": sources.length }}>
                        <button type="button" className="nw-tile nw-tile-add" onClick={() => setAdding("new")}>
                            <span className="nw-add-icon">
                                <Plus aria-hidden="true" />
                            </span>
                            <b>Add a crypto wallet</b>
                            <small>Trust Wallet, MetaMask, Phantom… read only</small>
                        </button>
                    </li>
                </ul>
            </section>

            <section className="group nw-detail" aria-labelledby="nw-detail">
                <div className="nw-detail-head">
                    <SourceMark source={current} size={44} />
                    <div>
                        <h2 id="nw-detail">{current.name}</h2>
                        <p>{current.kind}</p>
                    </div>
                    {current.worth ? <span className="nw-detail-value">{inr(current.worth.total, { whole: true })}</span> : null}
                </div>
                {current.id === "zerodha" ? (
                    <Zerodha z={z} onPreview={preview} />
                ) : current.id === "groww" ? (
                    <GrowwPanel src={groww} onPreview={preview} />
                ) : current.id.startsWith("crypto") ? (
                    <WalletPanel wallet={current.cryptoWallet} src={wallets} onAdd={() => setAdding("new")} onEdit={(w) => setAdding(w)} onRemove={removeWallet} />
                ) : current.id.startsWith("mt5") ? (
                    <Mt5Panel src={mt5} account={current.account} rate={rate} demo={demo} onPreview={preview} />
                ) : (
                    <ManualPanel src={manual} demo={demo} rate={rate} />
                )}
            </section>

            <AddWallet open={Boolean(adding)} initial={adding && adding !== "new" ? adding : null} onClose={() => !savingWallet && setAdding(null)} onSave={saveWallet} saving={savingWallet} />
        </div>
    );
}

// ---------- the top: total, history, split ----------

const RANGES = [
    { value: "1M", label: "1M", days: 31 },
    { value: "3M", label: "3M", days: 92 },
    { value: "1Y", label: "1Y", days: 366 },
    { value: "all", label: "All", days: Infinity },
];

function Hero({ totals, rate, points, counted, sources, demo, onPreview }) {
    const [range, setRange] = useState("3M");
    const days = RANGES.find((r) => r.value === range).days;
    // counted back from the latest point (today's), so rendering stays pure
    const lastDate = points[points.length - 1]?.date;
    const from = Number.isFinite(days) && lastDate ? new Date(Date.parse(`${lastDate}T00:00:00Z`) - days * 864e5).toISOString().slice(0, 10) : "";
    const shown = points.filter((p) => p.date >= from);
    const first = shown[0];
    const change = first && shown.length > 1 ? totals.total - first.total : null;

    return (
        <section className="nw-hero" aria-labelledby="nw-total">
            <div className="nw-main">
                <span className="perf-label" id="nw-total">
                    Net worth
                </span>
                <span className="nw-num">
                    <Rupees value={totals.total} />
                </span>
                <div className="nw-pills">
                    {rate ? (
                        <span className="nw-pill">
                            {usd(totals.total / rate)} <span className="muted">· ₹{num(rate)}/$</span>
                        </span>
                    ) : null}
                    {change != null && (
                        <span className={`nw-pill tone-${sideOf(change)}`}>
                            {change >= 0 ? "+" : "−"}
                            {inrShort(Math.abs(change)).replace("−", "")} {first.total ? `(${pct((change / Math.abs(first.total)) * 100)})` : ""}
                            <span className="muted"> · {range === "all" ? "all time" : range}</span>
                        </span>
                    )}
                    {totals.day ? (
                        <span className={`nw-pill tone-${sideOf(totals.day)}`}>
                            {inr(totals.day, { sign: true, whole: true })} <span className="muted">stocks today</span>
                        </span>
                    ) : null}
                </div>
                <History points={shown} range={range} setRange={setRange} />
                <span className="nw-foot">
                    From {counted} of {sources} sources
                    {!demo && counted < sources ? (
                        <>
                            {" "}
                            <span className="muted">·</span>{" "}
                            <button type="button" className="linkish" onClick={onPreview}>
                                preview with sample data
                            </button>
                        </>
                    ) : null}
                </span>
            </div>
            <Ring parts={totals.parts} gross={totals.gross} />
        </section>
    );
}

/** The total over time, one point a day. Point at it to read a day. */
function History({ points, range, setRange }) {
    const [at, setAt] = useState(null);
    const plot = useRef(null);
    const head = (
        <div className="nw-hist-head">
            <span className="perf-label">History</span>
            <Seg label="Range" options={RANGES} value={range} onChange={setRange} />
        </div>
    );
    if (points.length < 2) {
        return (
            <div className="nw-hist">
                {head}
                <div className="nw-hist-empty">
                    <span className="nw-hist-line" aria-hidden="true" />
                    <p>Your history starts today. A point is added each day you open this page.</p>
                </div>
            </div>
        );
    }
    const values = points.map((p) => p.total);
    const lo0 = Math.min(...values);
    const hi0 = Math.max(...values);
    const pad = (hi0 - lo0) * 0.12 || Math.abs(hi0) * 0.02 || 1;
    const lo = lo0 - pad;
    const hi = hi0 + pad;
    const n = points.length - 1;
    const X = (i) => (i / n) * 100;
    const Y = (v) => ((hi - v) / (hi - lo)) * 100;
    const line = values.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(3)} ${Y(v).toFixed(3)}`).join("");
    const up = values[n] >= values[0];
    const i = at == null ? n : at;
    const p = points[i];
    const move = (e) => {
        const r = plot.current.getBoundingClientRect();
        setAt(Math.round(Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * n));
    };
    return (
        <div className={`nw-hist ${up ? "is-up" : "is-down"}`}>
            {head}
            <div className="nw-hist-read">
                <b>{inrShort(p.total)}</b>
                <span className="muted">{new Date(`${p.date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
            <div className="nw-hist-plot" ref={plot} onPointerMove={move} onPointerLeave={() => setAt(null)}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <path className="nw-hist-area" d={`${line}L100 100L0 100Z`} />
                    <path className="nw-hist-path" d={line} />
                    {at != null && <line className="kt-cross" x1={X(at)} x2={X(at)} y1="0" y2="100" />}
                </svg>
                <span className="kt-dot" style={{ left: `${X(i)}%`, top: `${Y(p.total)}%` }} aria-hidden="true" />
            </div>
        </div>
    );
}

/** The split by kind as a ring, the biggest share in the middle, and the list beside it. */
function Ring({ parts, gross }) {
    const cats = CATS.filter((c) => c.key !== "loans" && parts[c.key] > 0).sort((a, b) => parts[b.key] - parts[a.key]);
    const [hover, setHover] = useState(null);
    const r = 42;
    const C = 2 * Math.PI * r;
    const gap = cats.length > 1 ? 1.2 : 0; // a hairline between slices
    // where each slice starts around the ring
    const starts = cats.reduce((acc, c, i) => [...acc, i ? acc[i - 1] + (parts[cats[i - 1].key] / gross) * C : 0], []);
    const lead = cats.find((c) => c.key === hover) || cats[0];
    return (
        <div className="nw-ring-wrap">
            {gross ? (
                <div className="nw-ring">
                    <svg viewBox="0 0 100 100" aria-hidden="true">
                        <circle cx="50" cy="50" r={r} className="nw-ring-track" />
                        {cats.map((c, i) => (
                            <circle
                                key={c.key}
                                cx="50"
                                cy="50"
                                r={r}
                                className={`nw-ring-slice cat-${c.key}${hover && hover !== c.key ? " is-dim" : ""}`}
                                strokeDasharray={`${Math.max(0, (parts[c.key] / gross) * C - gap)} ${C}`}
                                strokeDashoffset={-starts[i]}
                                onPointerEnter={() => setHover(c.key)}
                                onPointerLeave={() => setHover(null)}
                            />
                        ))}
                    </svg>
                    {lead && (
                        <span className="nw-ring-mid">
                            <b>{pct((parts[lead.key] / gross) * 100, { sign: false })}</b>
                            <small>{lead.label}</small>
                        </span>
                    )}
                </div>
            ) : null}
            <ul className="nw-cats" aria-label="By kind">
                {CATS.filter((c) => parts[c.key]).map((c) => (
                    <li key={c.key} className={`nw-cat cat-${c.key}${hover === c.key ? " is-on" : ""}`} onPointerEnter={() => setHover(c.key)} onPointerLeave={() => setHover(null)}>
                        <i aria-hidden="true" />
                        <span>{c.label}</span>
                        <b className={c.key === "loans" ? "down" : ""}>
                            {c.key === "loans" ? "−" : ""}
                            {inrShort(parts[c.key])}
                        </b>
                    </li>
                ))}
                {!CATS.some((c) => parts[c.key]) && <li className="nw-cat-empty">Nothing counted yet. Connect an account below.</li>}
            </ul>
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

// ---------- Crypto wallets ----------

const amount = (x) => (x >= 1000 ? num(x, 2) : x >= 1 ? num(x, 4) : num(x, 8));

/** One crypto wallet: its addresses, and every coin across them. */
function WalletPanel({ wallet, src, onAdd, onEdit, onRemove }) {
    if (src.state === "loading") return <div className="sk sk-rows" aria-busy="true" />;
    if (src.state === "error" || src.state === "unset")
        return (
            <Setup title="Wallets didn’t load" onRetry={src.reload}>
                {src.message}
            </Setup>
        );
    if (!wallet)
        return (
            <div className="kt-connect nw-setup nw-crypto-empty">
                <h2>Bring in your crypto</h2>
                <p>Pick your wallet app and connect it: its public addresses come in by themselves, and every coin on them is counted at today’s price. No keys, no recovery phrase, nothing to sign.</p>
                <div className="kt-connect-actions">
                    <button type="button" className="btn btn-primary" onClick={onAdd}>
                        <Plus aria-hidden="true" />
                        Add a crypto wallet
                    </button>
                </div>
            </div>
        );

    const w = wallet;
    return (
        <div className="kt">
            <div className="nw-wallet-bar">
                <ul className="nw-wallet-addrs" aria-label="Addresses">
                    {(w.addresses || []).map((a) => {
                        const info = CHAIN_INFO[a.chain];
                        return (
                            <li key={a.address} className={a.error ? "is-warn" : ""} title={`${a.address}\n${info.coins}${a.error ? `\n${a.error}` : ""}`}>
                                {a.chain === "evm" ? <NetworkStack networks={info.networks.slice(0, 3)} size={20} /> : <CoinIcon token={info.token} size={20} />}
                                <span className="nw-mono">{shortAddress(a.address)}</span>
                                <b>{inrShort(a.inr || 0)}</b>
                            </li>
                        );
                    })}
                </ul>
                <div className="nw-wallet-actions">
                    <button type="button" className="btn btn-sm" onClick={() => onEdit(w)}>
                        <Pencil aria-hidden="true" />
                        Edit
                    </button>
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onRemove(w)} aria-label={`Remove ${w.name}`} title="Remove">
                        <Trash2 aria-hidden="true" />
                    </button>
                </div>
            </div>
            {src.data?.priceError && <p className="kt-note">Prices didn’t load ({src.data.priceError}), so values may be missing.</p>}
            {w.error && <p className="kt-note">Some chains didn’t answer: {w.error}</p>}
            {w.holdings?.length ? (
                <Table
                    label={`${w.name} coins`}
                    cols="minmax(0, 1.3fr) 8rem 7rem 7.5rem 5rem"
                    colsSm="minmax(0, 1fr) 7rem"
                    hide={[1, 2, 4]}
                    head={["Coin", "Amount", "Dollars", "Rupees", "24h"]}
                    rows={w.holdings}
                    rowKey={(h) => `${h.network}:${h.symbol}`}
                    render={(h) => [
                        <span key="s" className="nw-coin">
                            <CoinIcon token={h.symbol} network={NETWORK_KEY[h.network]} size={30} />
                            <Sym title={h.symbol} sub={h.network} />
                        </span>,
                        <span key="a" className="kt-num">{amount(h.amount)}</span>,
                        <span key="u" className="kt-num">{h.usd != null ? usd(h.usd) : "—"}</span>,
                        <span key="i" className="kt-num">{h.inr != null ? inr(h.inr, { whole: true }) : "—"}</span>,
                        <span key="c" className={`kt-num ${sideOf(h.change24h)}`}>{/^USD[TC]$/.test(h.symbol) ? "—" : pct(h.change24h)}</span>,
                    ]}
                />
            ) : (
                !w.error && <p className="empty-note">Nothing on these addresses yet, or only coins this page doesn’t read.</p>
            )}
            <p className="nw-fine">
                Read from public chains: Bitcoin; Ethereum, BNB Chain, Polygon, Arbitrum, Base and Optimism (the main coin, USDT, USDC); Tron (TRX, USDT); Solana (SOL, USDT, USDC). Prices from CoinGecko.
            </p>
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
