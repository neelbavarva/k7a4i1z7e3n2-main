"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/http";
import { hasHandoff, inr, num, pct } from "@/lib/kite";
import { sideOf } from "@/lib/format";
import { combine, cryptoWorth, growwWorth, manualWorth, mt5Worth, perUnit, zerodhaWorth } from "@/lib/worth";
import { demoCrypto, demoFx, demoGroww, demoHistory, demoManual, demoMt5 } from "@/lib/worthDemo";
import { CHAIN_INFO, CHAIN_SHORT, NETWORK_KEY, chainOf, shortAddress } from "@/lib/wallets";
import { CoinIcon, NetworkStack } from "./k7/CryptoIcons";
import { Mark, bankIn, brandFor } from "./k7/Marks";
import { BANKS } from "@/lib/cards";
import Zerodha, { Rupees, SideTag, Sym, Table, useZerodha } from "./Zerodha";
import AddWallet from "./AddWallet";
import BalanceDialog, { balanceInfo } from "./BalanceDialog";

import Seg from "./k7/Seg";
import { useCountUp } from "./k7/hooks";

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

const bankById = (id) => BANKS.find((b) => b.id === id);

/** An account's mark, from its `mark` description (see components/k7/Marks.js). */
function SourceMark({ source, size = 40 }) {
    return <Mark mark={source.mark} size={size} />;
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
    const [balance, setBalance] = useState(null); // null | "new" | a balance being edited
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
        mark: { brand: "zerodha" },
        worth: zw,
        status: zw ? `Holdings ${inrShort(zw.parts.stocks)} · cash ${inrShort(zw.parts.cash)}` : { loading: "Loading…", connect: "Connect for today", unset: "Not set up yet", offline: "Server didn’t answer" }[z.phase] || "",
        tone: zw ? "ok" : z.phase === "loading" ? "" : "warn",
    });

    const gw = ready(groww) && groww.data ? growwWorth(groww.data.sections) : null;
    sources.push({
        id: "groww",
        name: "Groww",
        kind: "Stocks and F&O",
        mark: { brand: "groww" },
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
                mark: brandFor(`${a.label} ${a.server} ${a.info?.broker}`) ? { brand: brandFor(`${a.label} ${a.server} ${a.info?.broker}`) } : { glyph: "forex" },
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
            mark: { brand: "exness" },
            name: "Exness",
            kind: "Exness and other MT5 brokers",
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
                mark: { wallet: w.kind || "other" },
                worth: cryptoWorth({ wallets: [w] }),
                status: w.error ? "Some chains didn’t answer" : coins.length ? coins.slice(0, 4).join(", ") + (coins.length > 4 ? "…" : "") : "Nothing on these addresses yet",
                tone: w.error ? "warn" : "ok",
                cryptoWallet: w,
            });
        }
    } else {
        sources.push({
            id: "crypto",
            mark: { stack: [{ wallet: "trust" }, { wallet: "metamask" }, { wallet: "phantom" }] },
            name: "Crypto wallets",
            kind: "Trust Wallet, MetaMask, Phantom…",
            worth: ready(wallets) ? cryptoWorth(wallets.data) : null,
            status: { loading: "Loading…", error: wallets.message, unset: "Server didn’t answer" }[wallets.state] || "Add a wallet: no keys, read only",
            tone: "",
        });
    }

    const entries = manual.data || [];
    const mw = ready(manual) ? manualWorth(entries, rate) : null;
    sources.push({
        id: "manual",
        mark: (() => {
            const banks = [...new Set(entries.map((e) => bankIn(e.name)?.id).filter(Boolean))].map(bankById);
            return { stack: (banks.length ? banks : ["hdfc", "sbi", "icici"].map(bankById)).filter(Boolean).map((bank) => ({ bank })) };
        })(),
        name: "Bank and cash",
        kind: "Typed in by hand",
        worth: mw,
        status: mw ? (entries.length ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}${entries.some((e) => e.kind === "loan") ? ", loans taken off" : ""}` : "Add HDFC, SBI and the rest") : { loading: "Loading…", error: manual.message, unset: "Server didn’t answer" }[manual.state],
        tone: mw && entries.length ? "ok" : "",
    });

    const totals = combine(sources.map((s) => s.worth));
    const hidden = []; // accounts on the page but not counted (funded ones)
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

    // ---- every account as one line of the picture and the ledger ----
    for (const s of sources) if (s.account && !s.worth) hidden.push(s); // not counted (a funded account)
    const lines = [];
    const stateOf = (s) => (s.worth ? "ready" : /Loading/.test(s.status || "") ? "loading" : "off");
    for (const s of sources) {
        if (s.id === "manual" || (s.account && !s.worth)) continue;
        const group = s.id === "zerodha" || s.id === "groww" ? "brokerage" : s.id.startsWith("mt5") ? "forex" : "crypto";
        if (s.id === "crypto") continue; // no wallets yet: the crypto group shows its add line instead
        lines.push({ id: s.id, pick: s.id, group, mark: s.mark, name: s.name, note: s.status, tone: s.tone, value: s.worth ? s.worth.total : null, state: stateOf(s) });
    }
    for (const e of entries) {
        const info = balanceInfo(e);
        const value = (e.amount || 0) * (e.currency === "USD" ? rate || 0 : 1);
        lines.push({
            id: `bal:${e._id}`,
            balance: e,
            group: BALANCE_GROUP[e.kind] || "other",
            mark: info.bank ? { bank: info.bank } : { glyph: e.kind === "loan" ? "bank" : "bank" },
            name: info.title,
            note: [info.line, e.currency === "USD" ? usd(e.amount) : null].filter(Boolean).join(" · "),
            tone: "ok",
            value: e.kind === "loan" ? -value : value,
            state: "ready",
        });
    }
    const balancesState = ready(manual) ? "ready" : manual.state === "loading" ? "loading" : "off";
    const walletsState = ready(wallets) ? "ready" : wallets.state === "loading" ? "loading" : "off";
    const openLine = (l) => (l.balance ? setBalance(l.balance) : setPick(l.pick));
    const showDetail = !current.id.startsWith("manual") && current.id !== "crypto";

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

            <Hero totals={totals} rate={rate} points={points} counted={counted} sources={sources.length} demo={demo} onPreview={preview} onRefresh={refreshAll} />

            <Picture lines={lines} gross={totals.gross} current={current.id} onOpen={openLine} />

            <Ledger
                lines={lines}
                hidden={hidden}
                totals={totals}
                current={current.id}
                balancesState={balancesState}
                walletsState={walletsState}
                onOpen={openLine}
                onPick={setPick}
                onAddWallet={() => setAdding("new")}
                onAddBalance={() => setBalance("new")}
            />

            {showDetail && (
                <section className="group nw-detail" aria-labelledby="nw-detail">
                    <div className="nw-detail-head">
                        <SourceMark source={current} size={44} />
                        <div>
                            <h2 id="nw-detail">{current.name}</h2>
                            <p>{current.kind}</p>
                        </div>
                        {current.worth ? <Fig value={current.worth.total} className="nw-detail-value" /> : null}
                    </div>
                    {current.id === "zerodha" ? (
                        <Zerodha z={z} onPreview={preview} />
                    ) : current.id === "groww" ? (
                        <GrowwPanel src={groww} onPreview={preview} />
                    ) : current.id.startsWith("crypto") ? (
                        <WalletPanel wallet={current.cryptoWallet} src={wallets} onAdd={() => setAdding("new")} onEdit={(w) => setAdding(w)} onRemove={removeWallet} />
                    ) : (
                        <Mt5Panel src={mt5} account={current.account} rate={rate} demo={demo} onPreview={preview} />
                    )}
                </section>
            )}

            <AddWallet open={Boolean(adding)} initial={adding && adding !== "new" ? adding : null} onClose={() => !savingWallet && setAdding(null)} onSave={saveWallet} saving={savingWallet} />
            <BalanceDialog
                open={Boolean(balance)}
                initial={balance && balance !== "new" ? balance : null}
                demo={demo}
                onClose={() => setBalance(null)}
                onSaved={(doc, edited) => manual.setData((list = []) => (edited ? list.map((x) => (x._id === doc._id ? doc : x)) : [...list, doc]))}
                onDeleted={(doc) => manual.setData((list = []) => list.filter((x) => x._id !== doc._id))}
            />
        </div>
    );
}

const BALANCE_GROUP = { bank: "cash", cash: "cash", deposit: "cash", crypto: "crypto", property: "other", other: "other", loan: "liabilities" };

const GROUPS = [
    { key: "brokerage", label: "Brokerage" },
    { key: "forex", label: "Forex" },
    { key: "crypto", label: "Crypto" },
    { key: "cash", label: "Cash and deposits" },
    { key: "other", label: "Other assets" },
    { key: "liabilities", label: "Liabilities" },
];

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

/** How tall the picture is for this many blocks: one account is a band, not a wall. */
const mapHeight = (count, narrow) => (count <= 1 ? 112 : count === 2 ? (narrow ? 220 : 170) : count <= 4 ? (narrow ? 300 : 240) : narrow ? 380 : 300);

/**
 * Every account with a value as a block sized by what it holds: one quiet panel split by hairlines,
 * like the screener's figures, each block with the account's logo, name and value.
 */
function Picture({ lines, gross, current, onOpen }) {
    const box = useRef(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const valued = lines.filter((l) => l.value > 0).sort((a, b) => b.value - a.value);
    // a floor so a small account is still a block you can point at
    const floor = gross * 0.025;
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
    const one = valued.length === 1;

    return (
        <section className="pic" aria-labelledby="pic-title">
            <div className="pic-head">
                <h2 id="pic-title">Where it sits</h2>
                {valued.length > 1 && <span className="pic-sub">{valued.length} accounts, sized by value</span>}
            </div>
            <div className={valued.length ? "pic-map" : "pic-empty"} ref={box} style={valued.length ? { height: mapHeight(valued.length, narrow) } : undefined}>
                {valued.length ? (
                    blocks.map((b, i) => {
                        const big = one || (b.w > 170 && b.h > 110);
                        const mid = !big && b.w > 104 && b.h > 92;
                        const tight = !big && !mid && b.w > 104 && b.h > 60;
                        const share = gross ? (b.value / gross) * 100 : 0;
                        return (
                            <button
                                key={b.id}
                                type="button"
                                className={`pic-block${big ? " is-big" : mid ? " is-mid" : tight ? " is-tight" : " is-small"}${one ? " is-one" : ""}${current === b.pick ? " is-on" : ""}`}
                                style={{ left: b.x, top: b.y, width: b.w, height: b.h, "--i": i }}
                                onClick={() => onOpen(b)}
                                title={`${b.name}: ${inr(b.value, { whole: true })} (${pct(share, { sign: false })})`}
                            >
                                <span className="pic-in">
                                    <span className="pic-top">
                                        <Mark mark={b.mark} size={big ? 30 : 24} />
                                        {(big || mid) && !one ? <span className="pic-share">{pct(share, { sign: false }).replace(/\.\d+%/, "%")}</span> : null}
                                    </span>
                                    {big || mid || tight ? (
                                        <span className="pic-text">
                                            {tight ? null : <b>{b.name}</b>}
                                            <Fig value={b.value} short className="pic-val" />
                                            {(one || (big && b.h > 150)) && b.note ? <small className="pic-note">{b.note}</small> : null}
                                        </span>
                                    ) : null}
                                </span>
                            </button>
                        );
                    })
                ) : (
                    <>
                        <p>Your accounts appear here as blocks, each sized by what it holds.</p>
                        <span>Connect an account or add a balance below.</span>
                    </>
                )}
            </div>
        </section>
    );
}

// ---------- the ledger ----------

/** A ledger figure. */
const Amount = ({ value, whole }) => <Fig value={whole ? Math.round(value) : value} short={false} className="lg-amt" />;

function Ledger({ lines, hidden, totals, current, balancesState, walletsState, onOpen, onPick, onAddWallet, onAddBalance }) {
    const gross = totals.gross || 0;
    const groups = GROUPS.map((g) => ({ ...g, lines: lines.filter((l) => l.group === g.key) })).filter((g) => g.lines.length || g.key === "crypto" || g.key === "cash");
    const addRow = (label, sub, onClick, state) => (
        <li>
            <button type="button" className="lg-row lg-add" onClick={onClick} disabled={state === "loading"}>
                <span className="lg-add-icon">{state === "loading" ? <span className="lg-wait" /> : <Plus aria-hidden="true" />}</span>
                <span className="lg-name">
                    <b>{label}</b>
                    <small>{state === "loading" ? "Loading…" : sub}</small>
                </span>
            </button>
        </li>
    );
    return (
        <section className="lg" aria-labelledby="lg-title">
            <div className="lg-head">
                <h2 id="lg-title">Accounts</h2>
                <span className="lg-cols" aria-hidden="true">
                    <span>Share</span>
                    <span>Value</span>
                </span>
            </div>
            {groups.map((g) => {
                const sub = g.lines.reduce((a, l) => a + (l.value || 0), 0);
                return (
                    <div key={g.key} className="lg-group">
                        <div className="lg-group-head">
                            <span className="lg-group-name">{g.label}</span>
                            {g.lines.some((l) => l.value != null) ? <Amount value={sub} whole /> : null}
                        </div>
                        <ul className="lg-rows">
                            {g.lines.map((l) => {
                                const share = l.value != null && gross ? (Math.abs(l.value) / gross) * 100 : null;
                                return (
                                    <li key={l.id}>
                                        <button
                                            type="button"
                                            className={`lg-row${current === l.pick ? " is-on" : ""}${l.state !== "ready" ? " is-off" : ""}`}
                                            onClick={() => onOpen(l)}
                                        >
                                            <Mark mark={l.mark} size={36} />
                                            <span className="lg-name">
                                                <b>{l.name}</b>
                                                <small>
                                                    <i className={`lg-dot tone-${l.state === "ready" ? l.tone || "ok" : l.state === "loading" ? "none" : "warn"}`} aria-hidden="true" />
                                                    {l.note}
                                                </small>
                                            </span>
                                            <span className="lg-share">
                                                {share != null && l.value > 0 ? (
                                                    <>
                                                        <span className="lg-bar" aria-hidden="true">
                                                            <i style={{ width: `${Math.min(100, share)}%` }} />
                                                        </span>
                                                        <span>{pct(share, { sign: false })}</span>
                                                    </>
                                                ) : null}
                                            </span>
                                            <span className="lg-val">
                                                {l.state === "loading" ? <span className="lg-wait" aria-label="Loading" /> : l.value != null ? <Amount value={l.value} /> : <span className="lg-connect">Connect</span>}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                            {g.key === "crypto" && addRow("Add a crypto wallet", "Trust Wallet, MetaMask, Phantom… public addresses only", onAddWallet, walletsState)}
                            {g.key === "cash" && addRow(g.lines.length ? "Add a balance" : "Add a bank balance", `Pick the bank, type the balance. HDFC, SBI and ${BANKS.length - 2} more`, onAddBalance, balancesState)}
                        </ul>
                    </div>
                );
            })}
            <div className="lg-total">
                <span>Net worth</span>
                <Fig value={totals.total} className="lg-total-amt" />
            </div>
            {hidden.length > 0 && (
                <p className="lg-foot">
                    Not counted:{" "}
                    {hidden.map((h, i) => (
                        <React.Fragment key={h.id}>
                            {i ? ", " : ""}
                            <button type="button" className="linkish" onClick={() => onPick(h.id)}>
                                {h.name}
                            </button>
                        </React.Fragment>
                    ))}
                </p>
            )}
        </section>
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

function Hero({ totals, rate, points, counted, sources, demo, onPreview, onRefresh }) {
    const [range, setRange] = useState("3M");
    const days = RANGES.find((r) => r.value === range).days;
    // counted back from the latest point (today's), so rendering stays pure
    const lastDate = points[points.length - 1]?.date;
    const from = Number.isFinite(days) && lastDate ? new Date(Date.parse(`${lastDate}T00:00:00Z`) - days * 864e5).toISOString().slice(0, 10) : "";
    const shown = points.filter((p) => p.date >= from);
    const first = shown[0];
    const change = first && shown.length > 1 ? totals.total - first.total : null;
    const asOf = lastDate ? new Date(`${lastDate}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "";

    return (
        <section className="hx" aria-labelledby="nw-total">
            <div className="hx-bar">
                <p className="hx-eyebrow" id="nw-total">
                    Net worth{asOf ? <span> · {asOf}</span> : null}
                </p>
                <div className="hx-tools">
                    {points.length > 1 && <Seg label="Range" options={RANGES} value={range} onChange={setRange} />}
                    <button type="button" className="btn btn-ghost btn-icon" onClick={onRefresh} title="Read every account again" aria-label="Refresh">
                        <RefreshCw />
                    </button>
                </div>
            </div>
            <div className="hx-top">
                <div className="hx-figure">
                    <p className="hx-big">
                        <BigFig value={totals.total} />
                    </p>
                    <div className="hx-facts">
                        {change != null && (
                            <span className={`hx-change tone-${sideOf(change)}`}>
                                <svg viewBox="0 0 10 10" aria-hidden="true">
                                    <path d={change >= 0 ? "M5 1.5 9 8H1z" : "M5 8.5 1 2h8z"} />
                                </svg>
                                {inrShort(Math.abs(change))}
                                {first.total ? <span> {pct((change / Math.abs(first.total)) * 100)}</span> : null}
                                <span className="muted"> {RANGE_WORDS[range]}</span>
                            </span>
                        )}
                        {rate ? (
                            <span className="hx-fact">
                                {usd(totals.total / rate)} <span className="muted">at ₹{num(rate)}</span>
                            </span>
                        ) : null}
                        {totals.day ? (
                            <span className="hx-fact">
                                <b className={sideOf(totals.day)}>{inr(totals.day, { sign: true, whole: true })}</b> <span className="muted">stocks today</span>
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>
            <History points={shown} total={totals.total} />
            <p className="hx-foot">
                From {counted} of {sources} sources
                {!demo && counted < sources ? (
                    <>
                        {" "}
                        <span className="muted">·</span>{" "}
                        <button type="button" className="linkish" onClick={onPreview}>
                            see it with sample data
                        </button>
                    </>
                ) : null}
            </p>
        </section>
    );
}

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
                <div className="hx-ruler-text">
                    <span className="hx-ruler-today">
                        <b>Day one</b> <Fig value={total} short className="hx-ruler-val" />
                    </span>
                    <span>A point is added each day you open this page, and the line draws itself.</span>
                </div>
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
    const label = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    return (
        <div className={`hx-chart ${up ? "is-up" : "is-down"}`}>
            <div className="hx-plot" ref={plot} onPointerMove={move} onPointerLeave={() => setAt(null)}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    {[25, 50, 75].map((g) => (
                        <line key={g} className="hx-grid" x1="0" x2="100" y1={g} y2={g} />
                    ))}
                    <line className="hx-base" x1="0" x2="100" y1={Y(values[0])} y2={Y(values[0])} />
                    <path className="hx-area" d={`${line}L100 100L0 100Z`} />
                    <path className="hx-line" d={line} />
                    {at != null && <line className="hx-cross" x1={X(at)} x2={X(at)} y1="0" y2="100" />}
                </svg>
                <span className="hx-dot" style={{ left: `${X(i)}%`, top: `${Y(p.total)}%` }} aria-hidden="true" />
                <span className={`hx-tip${X(i) > 70 ? " is-left" : ""}`} style={{ left: `${X(i)}%`, top: `${Y(p.total)}%` }}>
                    <b>{inrShort(p.total)}</b>
                    <span>{label(p.date)}</span>
                </span>
            </div>
            <div className="hx-axis" aria-hidden="true">
                <span>{label(points[0].date)}</span>
                <span>{label(points[Math.floor(n / 2)].date)}</span>
                <span>Today</span>
            </div>
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
                <Mark mark={{ stack: [{ wallet: "trust" }, { wallet: "metamask" }, { wallet: "phantom" }] }} size={52} />
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
