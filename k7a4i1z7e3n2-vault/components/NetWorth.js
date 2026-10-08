"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Copy, Eye, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/http";
import { hasHandoff, inr, num, pct } from "@/lib/kite";
import { fmtAgo, sideOf } from "@/lib/format";
import { combine, cryptoWorth, manualWorth, zerodhaWorth } from "@/lib/worth";
import { demoCrypto, demoFx, demoHistory, demoManual } from "@/lib/worthDemo";
import { CHAIN_INFO, CHAIN_SHORT, NETWORK_KEY, chainOf, shortAddress } from "@/lib/wallets";
import { CoinIcon, NetworkStack } from "./k7/CryptoIcons";
import { Mark } from "./k7/Marks";
import Zerodha, { Sym, Table, useZerodha } from "./Zerodha";
import AddWallet from "./AddWallet";
import BalanceDialog, { balanceInfo, markOf } from "./BalanceDialog";
import Seg from "./k7/Seg";
import { useCountUp } from "./k7/hooks";

// Everything you own in one number: Zerodha, crypto wallets and what's typed in by hand
// (bank balances, deposits, loans). Each source loads on its own; the total counts the ones that
// answered, and the status line says which are still coming or need something from you.
// Every account is a line in one ledger and opens in place, under its own line.

const usd = (x, { sign = false } = {}) => {
    const n = Number(x) || 0;
    const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${n < 0 ? "−" : sign && n > 0 ? "+" : ""}$${abs}`;
};

/** One source's answer: loading, ready, refreshing, unset (not configured), or error. */
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

const OPEN_KEY = "worthOpen";
const POSTED_KEY = "worthPosted";

/** Rupees the short way for big sums: ₹21.86 L, ₹1.24 Cr; whole rupees below a lakh. */
const inrShort = (x) => {
    const n = Math.abs(Number(x) || 0);
    const sign = x < 0 ? "−" : "";
    if (n >= 1e7) return `${sign}₹${(n / 1e7).toFixed(2)} Cr`;
    if (n >= 1e5) return `${sign}₹${(n / 1e5).toFixed(2)} L`;
    return `${sign}${inr(n, { whole: true })}`;
};

/** Whole rupees for a line in a table; a few paise of dust reads as "<₹1", not "₹0". */
const rupees = (x) => (x > 0 && x < 1 ? "<₹1" : inr(x, { whole: true }));

/** "a, b and c" */
const list = (items) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items[0] || "");

const fmt2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Money set for reading, in the figures font (Literata, see --figs): lining, tabular figures and
 * its own rupee sign. `short` uses lakh and crore (₹6.63 L); `paise` is "auto" (shown unless
 * .00), "always" or "never".
 */
function Fig({ value, short, paise = "auto", className = "" }) {
    const n = Number(value) || 0;
    const a = Math.abs(n);
    let int;
    let frac = "";
    let unit = "";
    if (short && a >= 1e5) {
        [int, frac] = (a >= 1e7 ? a / 1e7 : a / 1e5).toFixed(2).split(".");
        frac = `.${frac}`;
        unit = a >= 1e7 ? "Cr" : "L";
    } else {
        [int, frac] = fmt2.format(a).split(".");
        frac = paise === "never" || short || (paise === "auto" && frac === "00") ? "" : `.${frac}`;
    }
    return (
        <span className={`fig ${className}${n < 0 ? " is-neg" : ""}`} aria-label={`${n < 0 ? "minus " : ""}₹${int}${frac}${unit ? ` ${unit === "L" ? "lakh" : "crore"}` : ""}`}>
            <span aria-hidden="true">
                {n < 0 ? <span className="fig-sign">−</span> : null}
                <span className="fig-cur">₹</span>
                <span className="fig-int">{int}</span>
                {/* paise a shade lighter; the decimals of a short figure (6.63 L) are part of it */}
                {frac ? <span className={unit ? "fig-dec" : "fig-frac"}>{frac}</span> : null}
                {unit ? <span className="fig-unit">{unit}</span> : null}
            </span>
        </span>
    );
}

/** The total, counting up to a new value the way the journal's figures do. */
function BigFig({ value }) {
    const v = useCountUp(value);
    return <Fig value={Math.round(v * 100) / 100} paise="always" className="fig-big" />;
}

const GROUPS = [
    { key: "cash", label: "Bank and cash" },
    { key: "brokerage", label: "Brokerage" },
    { key: "funds", label: "Mutual funds" },
    { key: "crypto", label: "Crypto" },
    { key: "other", label: "Other assets" },
    { key: "owed", label: "Owed" },
];
const ALWAYS = ["cash", "brokerage", "funds", "crypto"];
const BALANCE_GROUP = { bank: "cash", cash: "cash", deposit: "cash", invest: "brokerage", funds: "funds", crypto: "crypto", property: "other", other: "other", loan: "owed" };

/** Days since a stamp, or null. */
const daysSince = (t) => {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? Math.floor((Date.now() - ms) / 864e5) : null;
};
/** A typed-in balance this old is probably out of date. */
const STALE_DAYS = 30;

export default function NetWorth() {
    const z = useZerodha();
    const demo = Boolean(z.session?.demo);
    const fx = useSource("/worth/fx", demo, demoFx);
    const manual = useSource("/worth/manual", demo, demoManual);
    const wallets = useSource("/crypto/wallets", demo, demoCrypto);
    const history = useSource("/worth/history?days=1825", demo, demoHistory);
    const rate = fx.data?.rate || null;
    const [adding, setAdding] = useState(null); // null | "new" | a wallet being edited
    const [balance, setBalance] = useState(null); // null | "new" | a balance being edited
    const [savingWallet, setSavingWallet] = useState(false);

    // the account open in the ledger; back from the Kite login, Zerodha
    const [open, setOpen] = useState(() => {
        if (typeof window === "undefined") return null;
        if (hasHandoff()) return "zerodha";
        try {
            return localStorage.getItem(OPEN_KEY) || null;
        } catch {
            return null;
        }
    });
    useEffect(() => {
        try {
            if (open) localStorage.setItem(OPEN_KEY, open);
            else localStorage.removeItem(OPEN_KEY);
        } catch {
            // storage blocked
        }
    }, [open]);

    // ---- every account as a line of the ledger ----
    const lines = [];
    // a broker the API server isn't set up for: a line of its own that opens to what it needs
    const unset = (id, name, needs) => ({ id, kind: "setup", group: "brokerage", mark: { brand: id }, name, note: `Not set up: needs ${needs} on the API server`, value: null, state: "setup", action: "Set up" });

    const zw = z.phase === "ready" && z.account ? zerodhaWorth(z.account) : null;
    if (z.phase === "unset") lines.push(unset("zerodha", "Zerodha", "a Kite Connect app"));
    else if (z.phase !== "loading" || z.session) {
        const p = zw?.parts;
        lines.push({
            id: "zerodha",
            kind: "zerodha",
            group: "brokerage",
            mark: { brand: "zerodha" },
            name: "Zerodha",
            note: zw
                ? [p.stocks ? `Holdings ${inrShort(p.stocks)}` : "No holdings", p.funds ? `funds ${inrShort(p.funds)}` : "", `cash ${inrShort(p.cash)}`].filter(Boolean).join(" · ")
                : { loading: "Reading…", connect: "Log in for today: Kite logins end at 6 AM", offline: "The server didn’t answer" }[z.phase] || "",
            value: zw ? zw.total : null,
            state: zw ? "ready" : z.phase === "loading" ? "loading" : "off",
            action: z.phase === "connect" ? "Log in" : z.phase === "offline" ? "Retry" : "",
            worth: zw,
        });
    }

    for (const w of wallets.data?.wallets || []) {
        const coins = [...new Set((w.holdings || []).map((h) => h.symbol))];
        const worth = cryptoWorth({ wallets: [w] });
        lines.push({
            id: `crypto:${w._id}`,
            kind: "wallet",
            group: "crypto",
            mark: { wallet: w.kind || "other" },
            name: w.name,
            note: w.error
                ? "Some chains didn’t answer"
                : `${coins.length ? coins.slice(0, 3).join(", ") + (coins.length > 3 ? ` +${coins.length - 3}` : "") : "Empty"} · ${(w.addresses || []).map((a) => CHAIN_SHORT[a.chain]).join(", ")}`,
            tone: w.error ? "warn" : "",
            value: worth.total,
            state: "ready",
            wallet: w,
            worth,
        });
    }

    const entries = manual.data || [];
    for (const e of entries) {
        const info = balanceInfo(e);
        const dollars = e.currency === "USD";
        const value = (e.amount || 0) * (dollars ? rate || 0 : 1);
        const age = daysSince(e.updatedAt);
        lines.push({
            id: `bal:${e._id}`,
            kind: "balance",
            group: BALANCE_GROUP[e.kind] || "other",
            mark: markOf(info),
            name: info.title,
            note: [info.line, dollars ? usd(e.amount) : "", age != null && age >= STALE_DAYS ? `updated ${age} days ago` : ""].filter(Boolean).join(" · "),
            tone: age != null && age >= STALE_DAYS ? "warn" : "",
            value: e.kind === "loan" ? -value : value,
            state: "ready",
            entry: e,
            worth: manualWorth([e], rate),
        });
    }

    const totals = combine(lines.map((l) => l.worth));
    const counted = lines.filter((l) => l.state === "ready").length;
    const loadingNames = [
        z.phase === "loading" && "Zerodha",
        wallets.state === "loading" && "crypto wallets",
        manual.state === "loading" && "balances",
    ].filter(Boolean);
    const busy = [fx, manual, wallets].some((s) => s.state === "refreshing") || z.busy;
    const settled = loadingNames.length === 0 && !busy;
    const firstLoad = loadingNames.length > 0 && !lines.some((l) => l.state === "ready");

    // when everything last finished reading, for the status line
    const [readAt, setReadAt] = useState(null);
    useEffect(() => {
        if (settled) setReadAt(Date.now());
    }, [settled]);

    // ---- today's point on the history line, sent once things have settled ----
    // (keyed on the parts' text, not the object, which is new on every render; one send at a time)
    const partsKey = JSON.stringify(totals.parts);
    const posting = useRef(false);
    useEffect(() => {
        if (demo || !settled || !counted || posting.current) return;
        let last = null;
        try {
            last = JSON.parse(localStorage.getItem(POSTED_KEY) || "null");
        } catch {
            // nothing remembered
        }
        const fresh = last && Date.now() - last.at < 30 * 60 * 1000 && Math.abs(last.total - totals.total) < Math.max(1, Math.abs(totals.total) * 0.002);
        if (fresh) return;
        posting.current = true;
        http("/worth/history", { method: "POST", body: { total: totals.total, parts: JSON.parse(partsKey), sources: counted } })
            .then(() => {
                try {
                    localStorage.setItem(POSTED_KEY, JSON.stringify({ at: Date.now(), total: totals.total }));
                } catch {
                    // storage blocked
                }
            })
            .catch(() => {})
            .finally(() => {
                posting.current = false;
            });
    }, [demo, settled, counted, totals.total, partsKey]);

    const points = useMemo(() => {
        let list = [...(history.data || [])];
        // the sample's line is drawn to scale: it ends where the sample's total is
        if (demo && list.length && settled && totals.total) {
            const k = totals.total / list[list.length - 1].total;
            list = list.map((p) => ({ ...p, total: p.total * k }));
        }
        const today = new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
        if (settled && counted) {
            if (list.length && list[list.length - 1].date === today) list[list.length - 1] = { ...list[list.length - 1], total: totals.total };
            else list.push({ date: today, total: totals.total });
        }
        return list;
    }, [history.data, demo, settled, counted, totals.total]);

    const preview = () => z.preview();
    const refreshAll = () => {
        z.refresh();
        fx.reload();
        manual.reload();
        wallets.reload();
    };

    // opening an account from a click brings its line to the top of the screen, the account under it
    const [jump, setJump] = useState(0);
    const openLine = (id, { toggle = true } = {}) => {
        setOpen((cur) => (toggle && cur === id ? null : id));
        setJump((n) => n + 1);
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
                openLine(`crypto:${id}`, { toggle: false });
            } else if (editing) {
                await http(`/crypto/wallets/${editing._id}`, { method: "PUT", body: fields });
                wallets.reload();
            } else {
                const doc = await http("/crypto/wallets", { method: "POST", body: fields });
                openLine(`crypto:${doc._id}`, { toggle: false });
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

    // the chains read again now, past the server's five-minute cache
    const rereadWallets = async () => {
        if (demo) return;
        try {
            const data = await http("/crypto/wallets?fresh=1");
            wallets.setData(() => data);
        } catch (err) {
            toast.error("The chains didn’t answer", { description: err.detail || "Try again in a moment." });
        }
    };

    const removeWallet = async (w) => {
        try {
            if (!demo) await http(`/crypto/wallets/${w._id}`, { method: "DELETE" });
            wallets.setData((d) => ({ ...d, wallets: d.wallets.filter((x) => x._id !== w._id) }));
            setOpen(null);
        } catch {
            toast.error("Didn’t remove it", { description: "Try again in a moment." });
        }
    };

    const detail = (l) => {
        if (l.kind === "zerodha") return <Zerodha z={z} onPreview={preview} />;
        if (l.kind === "setup") return <SetupNote onPreview={preview} />;
        if (l.kind === "wallet") return <WalletPanel wallet={l.wallet} src={wallets} demo={demo} onEdit={(w) => setAdding(w)} onReread={rereadWallets} onRemove={removeWallet} />;
        return (
            <BalancePanel
                key={`${l.entry._id}:${l.entry.updatedAt}`}
                entry={l.entry}
                rate={rate}
                demo={demo}
                onEdit={() => setBalance(l.entry)}
                onSaved={(doc) => manual.setData((list = []) => list.map((x) => (x._id === doc._id ? doc : x)))}
            />
        );
    };

    return (
        <div className="nw fade-in">
            <Status demo={demo} loading={loadingNames} busy={busy} counted={counted} readAt={readAt} rate={rate} lines={lines} onRefresh={refreshAll} onExit={z.exitPreview} onPreview={preview} />

            {firstLoad ? (
                <div className="nw-sk" aria-busy="true" aria-label="Reading your accounts">
                    <div className="sk nw-sk-hero" />
                    <div className="sk sk-rows" />
                </div>
            ) : (
                <>
                    <Hero totals={totals} rate={rate} points={points} />
                    <Picture lines={lines} gross={totals.gross} open={open} onOpen={(id) => openLine(id, { toggle: false })} />
                    <Ledger
                        lines={lines}
                        totals={totals}
                        open={open}
                        jump={jump}
                        detail={detail}
                        onOpen={openLine}
                        onAddWallet={() => setAdding("new")}
                        onAddBalance={(kind) => setBalance(kind ? { kind } : "new")}
                    />
                </>
            )}

            <AddWallet open={Boolean(adding)} initial={adding && adding !== "new" ? adding : null} onClose={() => !savingWallet && setAdding(null)} onSave={saveWallet} saving={savingWallet} />
            <BalanceDialog
                open={Boolean(balance)}
                initial={balance?._id ? balance : null}
                kind={balance?._id ? undefined : balance?.kind}
                demo={demo}
                onClose={() => setBalance(null)}
                onSaved={(doc, edited) => {
                    manual.setData((list = []) => (edited ? list.map((x) => (x._id === doc._id ? doc : x)) : [...list, doc]));
                    if (!edited) openLine(`bal:${doc._id}`, { toggle: false });
                }}
                onDeleted={(doc) => {
                    manual.setData((list = []) => list.filter((x) => x._id !== doc._id));
                    setOpen(null);
                }}
            />
        </div>
    );
}

// ---------- the status line ----------

/** What's been read and when, what's still coming, and what needs you: one line, as on the other Kaizen sites. */
function Status({ demo, loading, busy, counted, readAt, rate, lines, onRefresh, onExit, onPreview }) {
    const needs = lines.filter((l) => l.state === "off").map((l) => l.name); // not "setup": an optional broker that was never set up doesn’t need you
    const tone = demo || loading.length || busy ? " is-idle" : needs.length ? " is-warn" : "";
    const at = readAt ? new Date(readAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
    return (
        <div className={`statusbar nw-status${tone}`} role="status">
            <i aria-hidden="true" />
            <p>
                {demo ? (
                    <>
                        <b>Sample data</b> <span className="muted">·</span> nothing here is from your accounts
                    </>
                ) : loading.length ? (
                    <>Reading {list(loading)}…</>
                ) : busy ? (
                    <>Reading every account again…</>
                ) : !counted ? (
                    <>
                        <b>Nothing added yet</b>
                        {needs.length ? (
                            <>
                                {" "}
                                <span className="muted">·</span> {list(needs)} {needs.length === 1 ? "needs" : "need"} you
                            </>
                        ) : null}
                    </>
                ) : (
                    <>
                        <b>
                            {counted} {counted === 1 ? "account" : "accounts"}
                        </b>{" "}
                        read at {at}
                        {needs.length ? (
                            <>
                                {" "}
                                <span className="muted">·</span> {list(needs)} {needs.length === 1 ? "needs" : "need"} you
                            </>
                        ) : null}
                    </>
                )}
                {rate ? (
                    <span className="nw-status-rate">
                        {" "}
                        <span className="muted">·</span> $1 = ₹{num(rate)}
                    </span>
                ) : null}
            </p>
            {demo ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={onExit}>
                    <X aria-hidden="true" />
                    <span className="btn-label">Exit preview</span>
                </button>
            ) : (
                <>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={onPreview} title="See the page filled in with sample accounts; nothing is saved">
                        <Eye aria-hidden="true" />
                        <span className="btn-label">Sample</span>
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={busy || loading.length > 0} title="Read every account again">
                        <RefreshCw className={busy ? "spin" : ""} aria-hidden="true" />
                        <span className="btn-label">Refresh</span>
                    </button>
                </>
            )}
        </div>
    );
}

// ---------- the top: the total and its history ----------

const RANGES = [
    { value: "1M", label: "1M", days: 31 },
    { value: "3M", label: "3M", days: 92 },
    { value: "1Y", label: "1Y", days: 366 },
    { value: "all", label: "All", days: Infinity },
];
const RANGE_WORDS = { "1M": "this month", "3M": "in 3 months", "1Y": "this year", all: "since the start" };

function Hero({ totals, rate, points }) {
    const [range, setRange] = useState("3M");
    const days = RANGES.find((r) => r.value === range).days;
    // counted back from the latest point (today's), so rendering stays pure
    const lastDate = points[points.length - 1]?.date;
    const from = Number.isFinite(days) && lastDate ? new Date(Date.parse(`${lastDate}T00:00:00Z`) - days * 864e5).toISOString().slice(0, 10) : "";
    const shown = points.filter((p) => p.date >= from);
    const first = shown[0];
    const change = first && shown.length > 1 ? totals.total - first.total : null;
    const asOf = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    // the range buttons only once there's more history than the shortest range shows
    const spans = points.length > 1 && Date.parse(points[points.length - 1].date) - Date.parse(points[0].date) > 31 * 864e5;

    return (
        <section className="hx" aria-labelledby="nw-total">
            <div className="hx-main">
                <p className="hx-eyebrow" id="nw-total">
                    Net worth <span>· {asOf}</span>
                </p>
                <p className="hx-big">
                    <BigFig value={totals.total} />
                </p>
                <div className="hx-facts">
                    {change != null && Math.abs(change) >= 0.5 && (
                        <span className={`hx-change tone-${sideOf(change)}`}>
                            <svg viewBox="0 0 10 10" aria-hidden="true">
                                <path d={change >= 0 ? "M5 1.5 9 8H1z" : "M5 8.5 1 2h8z"} />
                            </svg>
                            {inrShort(Math.abs(change))}
                            {first.total ? <span> {pct((change / Math.abs(first.total)) * 100)}</span> : null}
                            <span className="muted"> {spans ? RANGE_WORDS[range] : `since ${shortDay(first.date)}`}</span>
                        </span>
                    )}
                    {rate && totals.total ? <span className="hx-fact">{usd(totals.total / rate)}</span> : null}
                    {totals.day ? (
                        <span className="hx-fact">
                            <b className={sideOf(totals.day)}>{inr(totals.day, { sign: true, whole: true })}</b> <span className="muted">on stocks today</span>
                        </span>
                    ) : null}
                </div>
            </div>
            <div className="hx-side">
                <div className="hx-side-head">
                    <span>{points.length > 1 ? `${points.length} days recorded` : "History"}</span>
                    {spans && <Seg label="Range" options={RANGES} value={range} onChange={setRange} />}
                </div>
                <History points={shown} total={totals.total} />
            </div>
        </section>
    );
}

const shortDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** The total over time, one point a day. Point at it to read a day. */
function History({ points, total }) {
    const [at, setAt] = useState(null);
    const plot = useRef(null);
    if (points.length < 2) {
        // day one: the month ahead as a ruler, today's mark lit at its start
        return (
            <div className="hx-chart is-empty">
                <div className="hx-ruler" aria-hidden="true">
                    {Array.from({ length: 31 }, (_, d) => (
                        <i key={d} className={d === 0 ? "is-today" : d % 7 === 0 ? "is-week" : ""} />
                    ))}
                </div>
                <p className="hx-ruler-text">
                    <b>Day one</b> at <Fig value={total} short className="hx-ruler-val" />. A point is added each day you open this page, and the line draws itself.
                </p>
            </div>
        );
    }
    const values = points.map((p) => p.total);
    const lo0 = Math.min(...values);
    const hi0 = Math.max(...values);
    const pad = (hi0 - lo0) * 0.14 || Math.abs(hi0) * 0.02 || 1;
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
        <div className={`hx-chart ${up ? "is-up" : "is-down"}`}>
            <div className="hx-plot" ref={plot} onPointerMove={move} onPointerLeave={() => setAt(null)}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    {[33.3, 66.6].map((g) => (
                        <line key={g} className="hx-grid" x1="0" x2="100" y1={g} y2={g} />
                    ))}
                    <line className="hx-base" x1="0" x2="100" y1={Y(values[0])} y2={Y(values[0])} />
                    <path className="hx-area" d={`${line}L100 100L0 100Z`} />
                    <path className="hx-line" d={line} />
                    {at != null && <line className="hx-cross" x1={X(at)} x2={X(at)} y1="0" y2="100" />}
                </svg>
                {n < 40 && values.map((v, k) => <span key={k} className="hx-pt" style={{ left: `${X(k)}%`, top: `${Y(v)}%` }} aria-hidden="true" />)}
                <span className="hx-dot" style={{ left: `${X(i)}%`, top: `${Y(p.total)}%` }} aria-hidden="true" />
                <span className={`hx-tip${X(i) > 60 ? " is-left" : ""}${Y(p.total) < 30 ? " is-below" : ""}`} style={{ left: `${X(i)}%`, top: `${Y(p.total)}%` }}>
                    <b>{inrShort(p.total)}</b>
                    <span>{i === n ? "Today" : shortDay(p.date)}</span>
                </span>
            </div>
            <div className="hx-axis" aria-hidden="true">
                <span>{shortDay(points[0].date)}</span>
                {n > 2 && <span>{shortDay(points[Math.floor(n / 2)].date)}</span>}
                <span>Today</span>
            </div>
        </div>
    );
}

// ---------- where it sits: a treemap of every account ----------

/**
 * Squarified treemap (Bruls, Huizing, van Wijk): lays the items out in rows along the shorter
 * side, adding to a row while that keeps its blocks closer to square.
 */
function squarify(items, x, y, w, h) {
    const total = items.reduce((a, i) => a + i.size, 0);
    if (!total || w <= 0 || h <= 0) return [];
    const scale = (w * h) / total;
    let rest = items.map((i) => ({ ...i, area: i.size * scale }));
    const out = [];
    const worst = (row, side) => {
        const s = row.reduce((a, r) => a + r.area, 0);
        const max = Math.max(...row.map((r) => r.area));
        const min = Math.min(...row.map((r) => r.area));
        return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
    };
    while (rest.length) {
        const side = Math.min(w, h);
        let row = [rest[0]];
        let i = 1;
        while (i < rest.length && worst([...row, rest[i]], side) <= worst(row, side)) row = [...row, rest[i++]];
        const s = row.reduce((a, r) => a + r.area, 0);
        if (w >= h) {
            const cw = s / h;
            let cy = y;
            for (const r of row) {
                const rh = r.area / cw;
                out.push({ ...r, x, y: cy, w: cw, h: rh });
                cy += rh;
            }
            x += cw;
            w -= cw;
        } else {
            const rh = s / w;
            let cx = x;
            for (const r of row) {
                const rw = r.area / rh;
                out.push({ ...r, x: cx, y, w: rw, h: rh });
                cx += rw;
            }
            y += rh;
            h -= rh;
        }
        rest = rest.slice(row.length);
    }
    return out;
}

/** How tall the picture is: as short as its blocks allow, so it's a band across the page, not a wall. */
const mapHeight = (count, narrow) => (count === 2 ? (narrow ? 112 : 84) : count <= 4 ? (narrow ? 156 : 112) : narrow ? 188 : 132);

/**
 * Every account with a value as a block sized by what it holds: one quiet panel split by hairlines,
 * each block with the account's logo, name and value, laid out across when the block is wide and
 * short. Clicking one opens its account in the ledger.
 */
function Picture({ lines, gross, open, onOpen }) {
    const box = useRef(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    const valued = lines.filter((l) => l.value > 0).sort((a, b) => b.value - a.value);
    const many = valued.length > 1;
    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
        ro.observe(el);
        return () => ro.disconnect();
    }, [many]);
    // one account is all of it: the ledger says so, a block of 100% adds nothing
    if (!many) return null;

    // a floor so a small account is still a block you can point at
    const floor = gross * 0.03;
    // laid out 1px past the panel's right and bottom, so the hairline after the last block is
    // under the panel's own edge
    const blocks = squarify(
        valued.map((l) => ({ ...l, size: Math.max(l.value, floor) })),
        0,
        0,
        size.w + 1,
        size.h + 1
    );
    const narrow = size.w > 0 && size.w < 560;

    return (
        <section className="pic" aria-label="Where it sits">
            <div className="pic-map" ref={box} style={{ height: mapHeight(valued.length, narrow) }}>
                {blocks.map((b, i) => {
                    const share = gross ? (b.value / gross) * 100 : 0;
                    // one layout for every block, centred in it, so names and values line up across
                    // the band: across (logo, then name over value) wherever it fits, the logo over
                    // the value in a narrow block, the logo alone in a sliver
                    const fit = b.w >= 150 && b.h >= 48 ? "row" : b.w >= 84 && b.h >= 64 ? "stack" : "logo";
                    return (
                        <button
                            key={b.id}
                            type="button"
                            className={`pic-block is-${fit}${open === b.id ? " is-on" : ""}`}
                            style={{ left: b.x, top: b.y, width: b.w, height: b.h, "--i": i }}
                            onClick={() => onOpen(b.id)}
                            title={`${b.name}: ${inr(b.value)} (${pct(share, { sign: false })})`}
                        >
                            <span className="pic-in">
                                <Mark mark={b.mark} size={fit === "row" ? 26 : 22} />
                                {fit !== "logo" && (
                                    <span className="pic-text">
                                        {fit === "row" && <b>{b.name}</b>}
                                        <Fig value={b.value} short className="pic-val" />
                                    </span>
                                )}
                                {fit === "row" && b.w >= 240 ? <span className="pic-share">{share < 1 ? "<1%" : `${Math.round(share)}%`}</span> : null}
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

// ---------- the ledger ----------

/** A ledger figure. */
const Amount = ({ value, whole }) => <Fig value={whole ? Math.round(value) : value} short={false} className="lg-amt" />;

function Ledger({ lines, totals, open, jump, detail, onOpen, onAddWallet, onAddBalance }) {
    const gross = totals.gross || 0;
    const sum = (ls) => ls.reduce((a, l) => a + (l.value || 0), 0);
    // what each group adds, from its own heading; an empty group is one line that adds it
    const adders = {
        cash: { label: "Add a bank balance", sub: "Savings, a deposit, cash or a loan, typed in", run: () => onAddBalance() },
        brokerage: { label: "Add an investment account", sub: "A broker the page can’t read, like Merrill, typed in", run: () => onAddBalance("invest") },
        funds: { label: "Add mutual funds", sub: "What they’re worth today, on Groww or anywhere, typed in", run: () => onAddBalance("funds") },
        crypto: { label: "Add a crypto wallet", sub: "Read from its public addresses: no keys, nothing to sign", run: onAddWallet },
        other: { label: "Add an asset", sub: "Anything else you own, typed in", run: () => onAddBalance() },
        owed: { label: "Add a loan", sub: "What you owe, taken off the total", run: () => onAddBalance() },
    };
    // bank, brokerage and crypto are always there to add to; biggest group first, what's owed last;
    // inside a group, biggest account first
    const groups = GROUPS.map((g) => ({ ...g, lines: lines.filter((l) => l.group === g.key).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)) }))
        .filter((g) => g.lines.length || ALWAYS.includes(g.key))
        .sort((a, b) => (a.key === "owed") - (b.key === "owed") || !a.lines.length - !b.lines.length || sum(b.lines) - sum(a.lines));
    const shares = lines.filter((l) => l.value > 0).length > 1;

    // the opened line comes up to the top of the screen, unless it's already near there
    const rows = useRef({});
    useLayoutEffect(() => {
        if (!jump || !open) return;
        const el = rows.current[open];
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        if (top < 72 || top > window.innerHeight * 0.32) {
            const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            el.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jump]);

    return (
        <section className="lg" aria-labelledby="lg-title">
            <h2 id="lg-title" className="lg-title">
                Accounts
                {lines.length > 0 && <span className="count">{lines.filter((l) => l.state !== "setup").length}</span>}
            </h2>
            <div className="lg-card">
                <div className="lg-row lg-colhead" aria-hidden="true">
                    <span className="lg-colhead-name">Account</span>
                    <span>{shares ? "Share" : ""}</span>
                    <span>Value</span>
                    <span />
                </div>
                {groups.map((g) => {
                    const subtotal = sum(g.lines);
                    const add = adders[g.key];
                    const valued = g.lines.some((l) => l.value != null);
                    return (
                        <div key={g.key} className="lg-group">
                            <div className="lg-group-head">
                                <span className="lg-group-name">
                                    {g.label}
                                    {g.lines.length > 1 && <span className="lg-group-count">{g.lines.length}</span>}
                                </span>
                                <span className="lg-group-sum">{valued ? <Amount value={subtotal} whole={Math.abs(subtotal) >= 1000} /> : null}</span>
                                {add && g.lines.length ? (
                                    <button type="button" className="lg-plus" onClick={add.run} aria-label={add.label} title={add.label}>
                                        <Plus aria-hidden="true" />
                                    </button>
                                ) : (
                                    <span />
                                )}
                            </div>
                            <ul className="lg-rows">
                                {g.lines.map((l) => {
                                    const on = open === l.id;
                                    const share = shares && l.value > 0 && gross ? (l.value / gross) * 100 : null;
                                    return (
                                        <li key={l.id} className={on ? "is-open" : ""}>
                                            <button
                                                type="button"
                                                ref={(el) => (rows.current[l.id] = el)}
                                                className={`lg-row${l.state !== "ready" ? " is-off" : ""}`}
                                                aria-expanded={on}
                                                aria-controls={`lg-open-${l.id}`}
                                                onClick={() => onOpen(l.id)}
                                            >
                                                <Mark mark={l.mark} size={34} />
                                                <span className="lg-name">
                                                    <b>{l.name}</b>
                                                    <small>
                                                        {l.state === "off" || l.state === "loading" || l.tone ? (
                                                            <i className={`lg-dot tone-${l.state === "loading" ? "none" : "warn"}`} aria-hidden="true" />
                                                        ) : null}
                                                        <span>{l.note}</span>
                                                    </small>
                                                </span>
                                                <span className="lg-share">
                                                    {share != null ? (
                                                        <>
                                                            <span className="lg-bar" aria-hidden="true">
                                                                <i style={{ width: `${Math.max(2, Math.min(100, share))}%` }} />
                                                            </span>
                                                            <span>{share < 1 ? "<1%" : `${Math.round(share)}%`}</span>
                                                        </>
                                                    ) : null}
                                                </span>
                                                <span className="lg-val">
                                                    {l.state === "loading" ? (
                                                        <span className="lg-wait" aria-label="Loading" />
                                                    ) : l.value != null ? (
                                                        <Amount value={l.value} />
                                                    ) : (
                                                        <span className="lg-action">{l.action || "Open"}</span>
                                                    )}
                                                </span>
                                                <ChevronDown className="lg-chev" aria-hidden="true" />
                                            </button>
                                            {on && (
                                                <div className="lg-open" id={`lg-open-${l.id}`}>
                                                    {detail(l)}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                                {!g.lines.length && add && (
                                    <li>
                                        <button type="button" className="lg-row lg-addrow" onClick={add.run}>
                                            <span className="lg-addmark" aria-hidden="true">
                                                <Plus />
                                            </span>
                                            <span className="lg-name">
                                                <b>{add.label}</b>
                                                <small>
                                                    <span>{add.sub}</span>
                                                </small>
                                            </span>
                                        </button>
                                    </li>
                                )}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

/** How to turn on Zerodha when the API server isn't set up for it. */
function SetupNote({ onPreview }) {
    return (
        <div className="src">
            <div className="src-head">
                <div>
                    <h3>Zerodha isn’t set up yet</h3>
                    <p>
                        Zerodha is read through a Kite Connect app. Create one at developers.kite.trade, then add <code>KITE_API_KEY</code>, <code>KITE_API_SECRET</code> and{" "}
                        <code>KITE_USER_ID</code> to the API server.
                    </p>
                </div>
                <button type="button" className="btn" onClick={onPreview}>
                    <Eye aria-hidden="true" />
                    Preview with sample data
                </button>
            </div>
        </div>
    );
}

// ---------- a balance typed in by hand ----------

/** Digits grouped the way the currency writes them: 4,21,805.5 in rupees, 421,805.5 in dollars. */
function grouped(digits, dollars) {
    const [int = "", dec] = digits.split(".");
    const whole = int.replace(/^0+(?=\d)/, "");
    const out = whole ? BigInt(whole).toLocaleString(dollars ? "en-US" : "en-IN") : dec != null ? "0" : "";
    return dec != null ? `${out}.${dec.slice(0, 2)}` : out;
}

/**
 * What's typed, tidied as it's typed: a leading + or − (an amount to add or take off), then the
 * figure grouped, at most two decimals. The caret stays after the same digit it was after.
 */
function regroup(raw, caret, dollars) {
    const keep = (t) => t.replace(/[^\d.+\-−]/g, "");
    const clean = keep(raw);
    // the last sign typed wins, wherever it was typed: "+" after a figure turns it into an amount to add
    const signs = clean.match(/[+\-−]/g);
    const sign = signs ? (signs[signs.length - 1] === "+" ? "+" : "−") : "";
    const body = clean.replace(/[+\-−]/g, "");
    const dot = body.indexOf(".");
    const digits = dot < 0 ? body : `${body.slice(0, dot)}.${body.slice(dot + 1).replace(/\./g, "")}`;
    const text = sign + grouped(digits, dollars);
    // the caret: after as many significant characters as were before it
    const before = keep(raw.slice(0, caret)).length;
    let at = 0;
    for (let seen = 0; at < text.length && seen < before; at++) if (/[\d.+−]/.test(text[at])) seen++;
    return { text, caret: at };
}

/** The balance a typed figure means: the figure itself, or the old balance with +/− an amount. */
function readBalance(text, was) {
    const m = text.replace(/,/g, "").match(/^([+−]?)(\d*\.?\d*)$/);
    if (!m || !/\d/.test(m[2])) return null;
    const n = parseFloat(m[2]);
    const value = m[1] === "+" ? was + n : m[1] === "−" ? was - n : n;
    if (!Number.isFinite(value) || value < 0 || value > 1e12) return null;
    return { value: Math.round(value * 100) / 100, change: Boolean(m[1]) };
}

function BalancePanel({ entry, rate, demo, onEdit, onSaved }) {
    const info = balanceInfo(entry);
    const dollars = entry.currency === "USD";
    const loan = entry.kind === "loan";
    const was = entry.amount || 0;
    const start = () => grouped(Number.isInteger(was) ? String(was) : was.toFixed(2), dollars);
    const [text, setText] = useState(start);
    const [saving, setSaving] = useState(false);
    const field = useRef(null);
    const caret = useRef(null);
    useLayoutEffect(() => {
        if (caret.current == null || !field.current) return;
        field.current.setSelectionRange(caret.current, caret.current);
        caret.current = null;
    });

    const read = readBalance(text, was);
    const changed = read != null && Math.abs(read.value - was) >= 0.005;
    const diff = changed ? read.value - was : 0;
    const money = (x) => (dollars ? usd(x) : inr(x));
    const age = daysSince(entry.updatedAt);
    const stale = age != null && age >= STALE_DAYS;
    const held = info.bank?.name || info.bankName;
    const reset = () => setText(start());

    const type = (e) => {
        const next = regroup(e.target.value, e.target.selectionStart ?? e.target.value.length, dollars);
        caret.current = next.caret;
        setText(next.text);
    };

    // the new figure alone; the server wants the whole entry back, so the rest goes as it was
    const save = async (e) => {
        e.preventDefault();
        if (!changed || saving) return;
        const body = { name: entry.name, kind: entry.kind, bank: entry.bank || "", amount: read.value, currency: entry.currency || "INR", note: entry.note || "" };
        setSaving(true);
        try {
            const doc = demo ? { ...entry, ...body, updatedAt: new Date().toISOString() } : await http(`/worth/manual/${entry._id}`, { method: "PUT", body });
            onSaved(doc);
            toast.success("Balance updated", { description: `${info.title}: ${money(read.value)}` });
        } catch (err) {
            toast.error("Didn’t save", { description: err.detail || "Try again in a moment." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <form className="nw-bal" onSubmit={save}>
            <div className="nw-bal-main">
                <label className="nw-bal-label" htmlFor={`nw-bal-${entry._id}`}>
                    {loan ? "Owed today" : entry.kind === "invest" || entry.kind === "funds" ? "Value today" : "Balance today"}
                </label>
                <div className={`nw-bal-fig${changed ? " is-changed" : ""}`}>
                    <span className="nw-bal-cur" aria-hidden="true">
                        {dollars ? "$" : "₹"}
                    </span>
                    <input
                        ref={field}
                        id={`nw-bal-${entry._id}`}
                        inputMode="decimal"
                        autoComplete="off"
                        spellCheck={false}
                        value={text}
                        onChange={type}
                        onKeyDown={(e) => {
                            if (e.key !== "Escape" || text === start()) return;
                            e.preventDefault();
                            reset();
                        }}
                        onFocus={(e) => e.target.select()}
                        disabled={saving}
                        aria-describedby={`nw-bal-hint-${entry._id}`}
                    />
                    {changed && (
                        <span className="nw-bal-go">
                            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                                {saving ? "Saving…" : "Save"}
                            </button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={saving}>
                                Cancel
                            </button>
                        </span>
                    )}
                </div>
                <p className="nw-bal-hint" id={`nw-bal-hint-${entry._id}`} aria-live="polite">
                    {read == null && text ? (
                        <span className="is-bad">That isn’t a balance</span>
                    ) : changed && read.change ? (
                        <>
                            {money(was)} {diff > 0 ? "+" : "−"} {money(Math.abs(diff))} = <b>{money(read.value)}</b>
                        </>
                    ) : changed ? (
                        <>
                            Was {money(was)}{" "}
                            <b className={sideOf(loan ? -diff : diff)}>
                                {diff > 0 ? "+" : "−"}
                                {money(Math.abs(diff))}
                            </b>
                        </>
                    ) : (
                        <>
                            Type the new figure, or <kbd>+</kbd> or <kbd>−</kbd> an amount to adjust it
                        </>
                    )}
                </p>
            </div>
            <dl className="nw-bal-facts">
                <div>
                    <dt>{info.line ? info.line.split(" · ")[0] : "Balance"}</dt>
                    <dd>
                        {info.bank || info.brand ? <Mark mark={markOf(info)} size={18} /> : null}
                        {held || "Not tied to a bank"}
                    </dd>
                </div>
                <div>
                    <dt>Last updated</dt>
                    <dd className={stale ? "is-stale" : ""}>{entry.updatedAt ? fmtAgo(entry.updatedAt) : "—"}</dd>
                </div>
                {dollars && rate ? (
                    <div>
                        <dt>In rupees</dt>
                        <dd>
                            {inr(was * rate, { whole: true })} <span className="muted">at ₹{num(rate)}</span>
                        </dd>
                    </div>
                ) : null}
                {entry.note ? (
                    <div>
                        <dt>Note</dt>
                        <dd>{entry.note}</dd>
                    </div>
                ) : null}
            </dl>
            <button type="button" className="btn btn-sm nw-bal-edit" onClick={onEdit} title="Bank, kind, name, currency and note">
                <Pencil aria-hidden="true" />
                Details
            </button>
        </form>
    );
}

/** When a source can't be shown: why, and what to do about it. */
function Setup({ title, children, onPreview, onRetry }) {
    return (
        <div className="src fade-in">
            <div className="src-head">
                <div>
                    <h3>{title}</h3>
                    <p>{children}</p>
                </div>
                {onRetry ? (
                    <button type="button" className="btn btn-primary" onClick={onRetry}>
                        Try again
                    </button>
                ) : null}
            </div>
            {onPreview && (
                <p className="src-fine">
                    <button type="button" className="linkish" onClick={onPreview}>
                        Preview with sample data
                    </button>
                </p>
            )}
        </div>
    );
}

// ---------- Crypto wallets ----------

const amount = (x) => (x >= 1000 ? num(x, 2) : x >= 1 ? num(x, 4) : num(x, 8));

/** One crypto wallet: its addresses, and every coin across them. */
/** An address as long as its tile allows: whole on its own, shortened as more share the row. */
const addressFor = (a, count) => (count === 1 || a.length <= 16 ? a : count === 2 ? `${a.slice(0, 10)}…${a.slice(-8)}` : shortAddress(a));

function WalletPanel({ wallet: w, src, demo, onEdit, onReread, onRemove }) {
    const [confirm, setConfirm] = useState(false);
    const [reading, setReading] = useState(false);
    if (src.state === "loading") return <div className="sk sk-rows" aria-busy="true" />;
    if (src.state === "error" || src.state === "unset")
        return (
            <Setup title="Wallets didn’t load" onRetry={src.reload}>
                {src.message}
            </Setup>
        );
    const addresses = w.addresses || [];
    const copy = async (text, what) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success(what, { description: text.includes("\n") ? `${addresses.length} addresses, one a line` : shortAddress(text) });
        } catch {
            toast.error("Couldn’t copy", { description: "The browser didn’t allow it." });
        }
    };
    const reread = async () => {
        setReading(true);
        await onReread();
        setReading(false);
    };
    const coins = (w.holdings || []).length;
    return (
        <div className="kt nw-wal">
            <ul className="nw-addrs" data-count={Math.min(addresses.length, 4)} aria-label="Addresses">
                {addresses.map((a) => {
                    const info = CHAIN_INFO[a.chain];
                    const held = (a.holdings || []).length;
                    return (
                        <li key={a.address}>
                            <button
                                type="button"
                                className={`nw-addr${a.error ? " is-warn" : !held ? " is-empty" : ""}`}
                                onClick={() => copy(a.address, "Address copied")}
                                title={`${a.address}\n${info.coins}${a.error ? `\n${a.error}` : ""}\nClick to copy`}
                            >
                                {a.chain === "evm" ? <NetworkStack networks={info.networks.slice(0, 3)} size={22} /> : <CoinIcon token={info.token} size={22} />}
                                <span className="nw-addr-text">
                                    <small>{a.chain === "evm" ? `EVM · ${info.networks.length} networks` : CHAIN_SHORT[a.chain]}</small>
                                    <span>{addressFor(a.address, addresses.length)}</span>
                                </span>
                                <span className="nw-addr-end">
                                    {a.error ? (
                                        <small className="is-warn">Didn’t answer</small>
                                    ) : held ? (
                                        <>
                                            <b>{rupees(a.inr || 0)}</b>
                                            <small>
                                                {held} {held === 1 ? "coin" : "coins"}
                                            </small>
                                        </>
                                    ) : (
                                        <small>Empty</small>
                                    )}
                                </span>
                                <Copy className="nw-addr-copy" aria-hidden="true" />
                            </button>
                        </li>
                    );
                })}
            </ul>
            {src.data?.priceError && <p className="kt-note">Prices didn’t load ({src.data.priceError}), so values may be missing.</p>}
            {w.error && <p className="kt-note">Some chains didn’t answer: {w.error}</p>}
            {coins ? (
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
                        <span key="u" className="kt-num">{h.usd == null ? "—" : h.usd > 0 && h.usd < 0.01 ? "<$0.01" : usd(h.usd)}</span>,
                        <span key="i" className="kt-num">{h.inr == null ? "—" : rupees(h.inr)}</span>,
                        <span key="c" className={`kt-num ${sideOf(h.change24h)}`}>{/^USD[TC]$/.test(h.symbol) ? "—" : pct(h.change24h)}</span>,
                    ]}
                />
            ) : (
                !w.error && <p className="empty-note">Nothing on these addresses yet, or only coins this page doesn’t read.</p>
            )}
            <div className="nw-wal-foot">
                {confirm ? (
                    <div className="nw-confirm" role="group" aria-label={`Remove ${w.name}`}>
                        <span>
                            Take <b>{w.name}</b> off this page? The coins stay where they are.
                        </span>
                        <button type="button" className="btn btn-sm" onClick={() => setConfirm(false)}>
                            Keep it
                        </button>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => onRemove(w)}>
                            <Trash2 aria-hidden="true" />
                            Remove
                        </button>
                    </div>
                ) : (
                    <div className="tb" role="toolbar" aria-label={`${w.name}`}>
                        <button type="button" className="tb-btn" onClick={() => onEdit(w)} title="Its name, app and addresses">
                            <Pencil aria-hidden="true" />
                            <span>Edit</span>
                        </button>
                        <button type="button" className="tb-btn" onClick={reread} disabled={reading || demo} title={demo ? "Not in the sample" : "Read every chain again now"}>
                            <RefreshCw className={reading ? "spin" : ""} aria-hidden="true" />
                            <span>{reading ? "Reading…" : "Read again"}</span>
                        </button>
                        <button type="button" className="tb-btn" onClick={() => copy(addresses.map((a) => a.address).join("\n"), "Addresses copied")} title="Every address, one a line">
                            <Copy aria-hidden="true" />
                            <span>Copy {addresses.length > 1 ? "all" : "address"}</span>
                        </button>
                        <button type="button" className="tb-btn is-danger" onClick={() => setConfirm(true)} aria-label={`Remove ${w.name}`} title="Remove from this page">
                            <Trash2 aria-hidden="true" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
