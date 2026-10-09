"use client";

import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Copy, Eye, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { RETRIES, http, waitToRetry } from "@/lib/http";
import { hasHandoff, inr, num, pct } from "@/lib/kite";
import { fmtAgo, sideOf } from "@/lib/format";
import { countsInWorth, equityOf, statsOf } from "@/lib/trades";
import { combine, cryptoWorth, manualWorth, zerodhaWorth } from "@/lib/worth";
import { demoCrypto, demoFund, demoFx, demoHistory, demoManual } from "@/lib/worthDemo";
import { CHAIN_INFO, CHAIN_SHORT, NETWORK_KEY, chainOf, shortAddress } from "@/lib/wallets";
import { CoinIcon, NetworkStack } from "./k7/CryptoIcons";
import { Mark } from "./k7/Marks";
import MoreMenu from "./k7/MoreMenu";
import Zerodha, { Sym, Table, useZerodha } from "./Zerodha";
import AddWallet from "./AddWallet";
import BalanceDialog, { balanceInfo, markOf } from "./BalanceDialog";
import Seg from "./k7/Seg";
import { BigFig, Fig, Money, useMoneyText } from "./k7/Money";
import { grouped, regroup } from "@/lib/money";
import { useFundList } from "@/lib/fundList";
import { CITIES, landPoints, placeOf, sunVec, toVec } from "@/lib/places";
import { moneyText } from "@/lib/currency";

// Everything you own in one number: Zerodha, crypto wallets, what's typed in by hand (bank balances,
// deposits, loans) and what the Real trading account's closed trades have made. Each source loads
// on its own; the total counts the ones that answered, and the status line says which are still
// coming or need something from you. Every account is a line in one ledger and opens in place,
// under its own line. The page's currency comes from Finance (see k7/Money.js).

const usd = (x, { sign = false } = {}) => {
    const n = Number(x) || 0;
    const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${n < 0 ? "−" : sign && n > 0 ? "+" : ""}$${abs}`;
};

/**
 * One source's answer: loading, ready, refreshing, retrying, unset (not configured), or error. A read
 * that fails is retried by http() before it shows here as an error.
 * again: for a source that can answer with parts missing (a wallet's chain that didn't answer):
 * { path, when(data) }. While `when` holds, it's read again from `path` (fresh, past the server's
 * cache) up to three times, a little later each time, before it's shown as it is; meanwhile what
 * did come back is shown, as "retrying". reload({ fresh: true }) starts from `path`.
 */
function useSource(path, demo, sample, again) {
    const [s, setS] = useState({ state: "loading" });
    const [ask, setAsk] = useState({ n: 0, fresh: false }); // a new one to load again
    useEffect(() => {
        let gone = false;
        (async () => {
            try {
                let data = await (demo ? sample() : http(ask.fresh && again ? again.path : path));
                for (let i = 0; !demo && again && i < RETRIES && again.when(data); i++) {
                    if (gone) return;
                    setS({ state: "retrying", data });
                    await waitToRetry(i);
                    if (gone) return;
                    // a try that fails outright keeps the answer before it
                    data = await http(again.path, { retries: 0 }).catch(() => data);
                }
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
    }, [path, demo, sample, again, ask]);
    const reload = ({ fresh = false } = {}) => {
        setS((p) => ({ ...p, state: p.data ? "refreshing" : "loading" }));
        setAsk((a) => ({ n: a.n + 1, fresh }));
    };
    return { ...s, reload, setData: (fn) => setS((p) => ({ ...p, data: fn(p.data) })) };
}

// the wallets come back whole even when a chain or the prices didn't answer: those are read again
const CHAINS_AGAIN = { path: "/crypto/wallets?fresh=1", when: (d) => Boolean(d?.priceError || d?.wallets?.some((w) => w.error)) };

/** What's known of each fund held, by its AMFI scheme code: category, NAV, returns. */
function useFundDetails(codes, demo) {
    const [got, setGot] = useState({});
    const key = codes.join(",");
    useEffect(() => {
        if (demo || !key) return;
        let live = true;
        for (const code of key.split(",")) {
            http(`/worth/funds/${code}`).then(
                (d) => live && setGot((m) => ({ ...m, [code]: d })),
                () => live && setGot((m) => ({ ...m, [code]: { failed: true } }))
            );
        }
        return () => {
            live = false;
        };
    }, [key, demo]);
    return demo ? Object.fromEntries(codes.map((c) => [c, demoFund(c)])) : got;
}

const OPEN_KEY = "worthOpen";
const LIST_KEY = "worthListOpen";
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

const GROUPS = [
    { key: "cash", label: "Bank and cash" },
    { key: "brokerage", label: "Brokerage" },
    { key: "funds", label: "Mutual funds" },
    { key: "crypto", label: "Crypto" },
    { key: "trading", label: "Trading" },
    { key: "other", label: "Other assets" },
    { key: "owed", label: "Owed" },
];
const ALWAYS = ["cash", "brokerage", "funds", "crypto"];
const BALANCE_GROUP = { bank: "cash", cash: "cash", deposit: "cash", invest: "brokerage", funds: "funds", crypto: "crypto", property: "other", other: "other", loan: "owed" };

/** A trade's day ("2026-10-09"), as it was logged: a date in your own calendar. */
const dayOf = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Days since a stamp, or null. */
const daysSince = (t) => {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? Math.floor((Date.now() - ms) / 864e5) : null;
};
/** A typed-in balance this old is probably out of date. */
const STALE_DAYS = 30;

/**
 * What you own, the top half of the Finance page: the status line, the total over its history
 * (section "worth") and the ledger of accounts (section "accounts").
 * ask: { what: "balance" | "wallet", kind, n } from the top bar's Add menu; each new n opens that dialog.
 * fx: the day's rates (Finance loads them for the whole page). journal: the trades (useJournal).
 * band: the trading, under the net worth in the top card (TradingStrip).
 * onShowTrades: to the trading section, filtered to the trades counted here.
 */
export default function NetWorth({ ask, fx, journal, band, onNewTrade, onShowTrades }) {
    const z = useZerodha();
    const demo = Boolean(z.session?.demo);
    const manual = useSource("/worth/manual", demo, demoManual);
    const wallets = useSource("/crypto/wallets", demo, demoCrypto, CHAINS_AGAIN);
    const history = useSource("/worth/history?days=1825", demo, demoHistory);
    // rupees to the dollar; the sample has its own when the server hasn't answered
    const rate = fx.data?.rate || (demo ? demoFx().rate : null);
    const fundInfo = useFundDetails([...new Set((manual.data || []).filter((e) => e.kind === "funds" && e.scheme).map((e) => e.scheme))], demo);
    // the full fund list, if a picker has loaded it this session: a fund's category while its details are still out
    const fundList = useFundList(false).list;
    const fundKnown = (code) => (fundInfo[code]?.category ? fundInfo[code] : fundList?.find((x) => x.code === code) || null);
    const [adding, setAdding] = useState(null); // null | "new" | a wallet being edited
    const [balance, setBalance] = useState(null); // null | "new" | a balance being edited
    const [savingWallet, setSavingWallet] = useState(false);

    // the Add menu's asks; one made before this page was opened (on the other tab) is old news
    const asked = useRef(ask?.n);
    useEffect(() => {
        if (!ask || ask.n === asked.current) return;
        asked.current = ask.n;
        if (ask.what === "wallet") setAdding("new");
        else setBalance(ask.kind ? { kind: ask.kind } : "new");
    }, [ask]);

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

    // the accounts list, shut to its heading until it's asked for; back from the Kite login, open
    const [listOpen, setListOpen] = useState(() => {
        if (typeof window === "undefined") return false;
        if (hasHandoff()) return true;
        try {
            return localStorage.getItem(LIST_KEY) === "1";
        } catch {
            return false;
        }
    });
    useEffect(() => {
        try {
            localStorage.setItem(LIST_KEY, listOpen ? "1" : "0");
        } catch {
            // storage blocked
        }
    }, [listOpen]);

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

    // chains that didn't answer are asked again before the page says so
    const chainsAgain = wallets.state === "retrying";
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
                ? chainsAgain
                    ? "Reading the chains again…"
                    : "Some chains didn’t answer"
                : `${coins.length ? coins.slice(0, 3).join(", ") + (coins.length > 3 ? ` +${coins.length - 3}` : "") : "Empty"} · ${(w.addresses || []).map((a) => CHAIN_SHORT[a.chain]).join(", ")}`,
            tone: w.error ? (chainsAgain ? "wait" : "warn") : "",
            value: worth.total,
            state: "ready",
            wallet: w,
            worth,
        });
    }

    const entries = manual.data || [];
    for (const e of entries) {
        const info = balanceInfo(e, e.kind === "funds" && e.scheme ? fundKnown(e.scheme) : null);
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

    // what the Real account's closed trades have made, in dollars as they were logged, counted like
    // any account at today's rate
    const counting = journal.trades.filter(countsInWorth);
    if (counting.length || journal.failed) {
        const st = statsOf(counting);
        const value = rate && !journal.failed ? st.net * rate : null;
        lines.push({
            id: "trading:real",
            kind: "trading",
            group: "trading",
            mark: { glyph: "trading" },
            name: "Forex trading",
            note: journal.failed
                ? "The trades didn’t load"
                : [`Real account · ${st.closed} closed`, st.open ? `${st.open} open` : "", usd(st.net, { sign: true })].filter(Boolean).join(" · "),
            value,
            state: journal.loading ? "loading" : value == null ? "off" : "ready",
            action: journal.failed ? "Retry" : "",
            stats: st,
            worth: value == null ? null : { parts: { forex: value }, total: value },
        });
    }

    const totals = combine(lines.map((l) => l.worth));
    // the accounts read (the trading line is a result, not an account)
    const counted = lines.filter((l) => l.state === "ready" && l.kind !== "trading").length;
    const loadingNames = [
        z.phase === "loading" && "Zerodha",
        (wallets.state === "loading" || wallets.state === "retrying") && "crypto wallets",
        manual.state === "loading" && "balances",
        journal.loading && "trades",
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

    // the days recorded before the trading was counted didn't have it: each gets what the Real
    // trades closed by then had made, at today's rate, so the line shows the trading as it grew
    // rather than as a jump on the day it was added
    const closes = equityOf(counting)
        .filter((e) => Number.isFinite(e.at))
        .map((e) => [dayOf(e.at), e.sum]);
    const closesKey = closes.map((c) => c.join(":")).join(",");
    const points = useMemo(() => {
        let list = [...(history.data || [])];
        if (!demo && rate && closesKey) {
            const made = closesKey.split(",").map((c) => c.split(":"));
            let i = -1;
            list = list.map((p) => {
                while (i + 1 < made.length && made[i + 1][0] <= p.date) i++;
                return p.parts?.forex != null || i < 0 ? p : { ...p, total: p.total + Number(made[i][1]) * rate };
            });
        }
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
    }, [history.data, demo, rate, closesKey, settled, counted, totals.total]);

    const preview = () => z.preview();
    const refreshAll = () => {
        z.refresh();
        fx.reload();
        manual.reload();
        wallets.reload();
        journal.reload();
    };

    // opening an account from a click brings its line to the top of the screen, the account under it
    const [jump, setJump] = useState(0);
    const openLine = (id, { toggle = true } = {}) => {
        setListOpen(true); // an account asked for from the globe or a dialog opens the list too
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
    const rereadWallets = () => {
        if (!demo) wallets.reload({ fresh: true });
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

    const removeBalance = async (e) => {
        try {
            if (!demo) await http(`/worth/manual/${e._id}`, { method: "DELETE" });
            manual.setData((list = []) => list.filter((x) => x._id !== e._id));
            setOpen(null);
            toast(`${balanceInfo(e).title} removed`);
        } catch {
            toast.error("Didn’t remove it", { description: "Try again in a moment." });
        }
    };

    const detail = (l) => {
        if (l.kind === "zerodha") return <Zerodha z={z} onPreview={preview} />;
        if (l.kind === "setup") return <SetupNote onPreview={preview} />;
        if (l.kind === "trading")
            return <TradingPanel stats={l.stats} rate={rate} left={journal.trades.length - counting.length} failed={journal.failed} onRetry={journal.retry} onShow={() => onShowTrades("Real")} />;
        if (l.kind === "wallet") return <WalletPanel wallet={l.wallet} src={wallets} demo={demo} onEdit={(w) => setAdding(w)} onReread={rereadWallets} onRemove={removeWallet} />;
        return (
            <BalancePanel
                key={`${l.entry._id}:${l.entry.updatedAt}`}
                entry={l.entry}
                fund={l.entry.kind === "funds" && l.entry.scheme ? fundInfo[l.entry.scheme] || { loading: true } : null}
                known={l.entry.kind === "funds" && l.entry.scheme ? fundKnown(l.entry.scheme) : null}
                onRemove={removeBalance}
                rate={rate}
                demo={demo}
                onEdit={() => setBalance(l.entry)}
                onSaved={(doc) => manual.setData((list = []) => list.map((x) => (x._id === doc._id ? doc : x)))}
            />
        );
    };

    return (
        <div className="nw fade-in">
            <Status
                demo={demo}
                loading={loadingNames}
                busy={busy}
                counted={counted}
                readAt={readAt}
                rate={rate}
                lines={lines}
                onRefresh={refreshAll}
                onExit={z.exitPreview}
                onPreview={preview}
            />

            {firstLoad ? (
                <div className="nw-sk" aria-busy="true" aria-label="Reading your accounts">
                    <div className="sk nw-sk-hero" />
                    <div className="sk sk-rows" />
                </div>
            ) : (
                <>
                    <Hero totals={totals} rate={rate} points={points} band={band}>
                        {/* the globe only once the money sits in more than one place */}
                        {lines.filter((l) => l.value > 0).length > 1 && <Globe lines={lines} gross={totals.gross} open={open} onOpen={(id) => openLine(id, { toggle: false })} />}
                    </Hero>
                    <Ledger
                        lines={lines}
                        totals={totals}
                        open={open}
                        jump={jump}
                        shown={listOpen}
                        onShown={setListOpen}
                        detail={detail}
                        onOpen={openLine}
                        onAddWallet={() => setAdding("new")}
                        onNewTrade={onNewTrade}
                        onAddBalance={(kind) => setBalance(kind ? { kind } : "new")}
                    />
                </>
            )}

            <AddWallet open={Boolean(adding)} initial={adding && adding !== "new" ? adding : null} onClose={() => !savingWallet && setAdding(null)} onSave={saveWallet} saving={savingWallet} />
            <BalanceDialog
                gross={totals.gross}
                rate={rate}
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
    const m = useContext(Money);
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
                {m.code !== "INR" ? (
                    <span className="nw-status-rate">
                        {" "}
                        <span className="muted">·</span> {moneyText(1, m)} = ₹{num(1 / m.k)}
                    </span>
                ) : rate ? (
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

// ---------- the top: the total over its history, the globe beside them, the kinds under it ----------

const RANGES = [
    { value: "1M", label: "1M", days: 31 },
    { value: "3M", label: "3M", days: 92 },
    { value: "1Y", label: "1Y", days: 366 },
    { value: "all", label: "All", days: Infinity },
];
const RANGE_WORDS = { "1M": "this month", "3M": "in 3 months", "1Y": "this year", all: "since the start" };

/** children: the globe and the kinds (with money in more than one place); band: the trading, under them. */
function Hero({ totals, rate, points, band, children }) {
    const m = useContext(Money);
    const text = useMoneyText();
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
        <section className={`hx${children ? " has-globe" : ""}`} id="worth" aria-labelledby="nw-total">
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
                            {text(Math.abs(change), { short: true })}
                            {first.total ? <span> {pct((change / Math.abs(first.total)) * 100)}</span> : null}
                            <span className="muted"> {spans ? RANGE_WORDS[range] : `since ${shortDay(first.date)}`}</span>
                        </span>
                    )}
                    {/* the same in the other currency that matters: dollars beside rupees, rupees beside anything else */}
                    {totals.total ? (
                        m.code === "INR" ? (
                            rate ? <span className="hx-fact">{usd(totals.total / rate)}</span> : null
                        ) : (
                            <span className="hx-fact">{inr(totals.total, { whole: Math.abs(totals.total) >= 1000 })}</span>
                        )
                    ) : null}
                    {totals.day ? (
                        <span className="hx-fact">
                            <b className={sideOf(totals.day)}>{text(totals.day, { sign: true, paise: "never" })}</b> <span className="muted">on stocks today</span>
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
            {children}
            {band}
        </section>
    );
}

const shortDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** The total over time, one point a day. Point at it to read a day. */
function History({ points, total }) {
    const text = useMoneyText();
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
                    <b>{text(p.total, { short: true })}</b>
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

// ---------- where it sits: your money on the Earth ----------

const still = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
/** The shortest way round from angle a to angle b. */
const towards = (a, b) => ((((b - a) % TAU) + 3 * Math.PI) % TAU) - Math.PI;
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/** A point turned by yaw (round the poles) then pitch (the north pole tipped towards you), as [x, y, depth]. */
function turn([x, y, z], yaw, pitch) {
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
    const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    return [x1, y * Math.cos(pitch) - z1 * Math.sin(pitch), y * Math.sin(pitch) + z1 * Math.cos(pitch)];
}
const rotX = ([x, y, z], a) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const rotZ = ([x, y, z], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
/** A point on an orbit, as you see it: a ring round the globe tipped towards you by `open` and turned by `tilt`. */
const orbitAt = (o, u) => rotZ(rotX([Math.sin(u) * o.rad, 0, Math.cos(u) * o.rad], o.open), o.tilt);

/** Along the great circle from a to b (unit vectors), t of the way. */
function slerp(a, b, t) {
    const w = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
    if (w < 1e-6) return a;
    const s = Math.sin(w);
    const ka = Math.sin((1 - t) * w) / s;
    const kb = Math.sin(t * w) / s;
    return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
}
const latLonOf = ([x, y, z]) => [Math.asin(clamp(y, -1, 1)), Math.atan2(x, z)];

/**
 * Where the money sits, on the Earth: the land in dots, today's day and night, each account pinned
 * at its city (its bank's, broker's or fund house's), thin threads from where most of the money is
 * to the other cities, and crypto wallets on orbits of their own, since they sit in no city. Drag it
 * round (it carries on a little when let go); left alone it sways gently round your money. Pointing
 * at an account names it and lights its kind under the globe, pointing at a kind lights its
 * accounts, and opening one turns the globe to it. Drawn on a canvas and moved outside React, so it
 * stays smooth. It's the top card's right column, the kinds boxed under it in their own row, so it
 * returns the two as siblings.
 */
function Globe({ lines, gross, open, onOpen }) {
    const text = useMoneyText();
    const box = useRef(null);
    const canvas = useRef(null);
    const nodeEls = useRef({});
    const view = useRef({ yaw: 0, pitch: 0.35, vYaw: 0, vPitch: 0, drag: null, moved: 0, hold: false, idleSince: 0, fly: null, born: 0, aimed: false });
    const [size, setSize] = useState({ w: 0, h: 0 });
    const [focus, setFocus] = useState(null); // { line } or { group }
    const valued = lines.filter((l) => l.value > 0).sort((a, b) => b.value - a.value);
    // the trading has no place on the Earth: it's in the kinds under the globe, not on it
    const placed = valued.filter((l) => l.kind !== "trading");
    const many = valued.length > 1;
    const key = valued.map((l) => `${l.id}:${Math.round(l.value)}`).join("|");

    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
        ro.observe(el);
        return () => ro.disconnect();
    }, [many]);

    // the cities with money in them, the wallets in orbit, and the middle of it all
    const model = useMemo(() => {
        const byCity = new Map();
        const loose = [];
        const sats = [];
        for (const l of placed) {
            const p = placeOf(l.mark);
            if (p === null) sats.push(l);
            else if (!p) loose.push(l);
            else {
                const c = byCity.get(p.key) || { key: p.key, name: p.name, at: p.at, lines: [], sum: 0 };
                c.lines.push(l);
                c.sum += l.value;
                byCity.set(p.key, c);
            }
        }
        // money with no city of its own (cash in hand, a fund house without a bank) joins the city
        // with the most, or Mumbai
        if (loose.length) {
            let hub = [...byCity.values()].sort((a, b) => b.sum - a.sum)[0];
            if (!hub) {
                hub = { key: "mumbai", name: CITIES.mumbai.name, at: CITIES.mumbai.at, lines: [], sum: 0 };
                byCity.set("mumbai", hub);
            }
            for (const l of loose) {
                hub.lines.push(l);
                hub.sum += l.value;
            }
        }
        // home first: the city with the most accounts (then the most money); the threads start there
        const cities = [...byCity.values()]
            .sort((a, b) => b.lines.length - a.lines.length || b.sum - a.sum)
            .map((c, i) => ({ ...c, vec: toVec(c.at), phase: (i * 0.37) % 1 }));
        // cities too close to tell apart at this size (Mumbai and Bengaluru) share one fan of pins,
        // standing over the one with the most
        const near = Math.cos((9 * Math.PI) / 180);
        const fans = [];
        for (const c of [...cities].sort((a, b) => b.sum - a.sum)) {
            const f = fans.find((x) => x.vec[0] * c.vec[0] + x.vec[1] * c.vec[1] + x.vec[2] * c.vec[2] > near);
            if (f) f.items.push(...c.lines.map((line) => ({ line, city: c })));
            else fans.push({ vec: c.vec, items: c.lines.map((line) => ({ line, city: c })) });
        }
        for (const f of fans) f.items.sort((a, b) => b.line.value - a.line.value);
        // the middle of the money, weighted by how much sits where
        const m = cities.reduce((a, c) => [a[0] + c.vec[0] * c.sum, a[1] + c.vec[1] * c.sum, a[2] + c.vec[2] * c.sum], [0, 0, 0]);
        const len = Math.hypot(...m);
        const centre = len > 1e-6 ? latLonOf(m.map((x) => x / len)) : cities[0] ? latLonOf(cities[0].vec) : [0.35, 1.36];
        // each wallet on its own orbit, fixed to your view (so a ring never closes to a line): tipped,
        // turned and timed differently
        const orbits = sats.map((l, i) => ({ line: l, open: [0.3, 0.42, 0.24, 0.36][i % 4], tilt: [0.32, -0.42, 0.12, -0.2][i % 4], rad: 1.1 + (i % 2) * 0.06, speed: 0.16 + 0.03 * (i % 3), phase: i * 2.4 }));
        return { cities, fans, orbits, centre };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    // pointing at something holds the globe still
    useEffect(() => {
        view.current.hold = Boolean(focus);
    }, [focus]);

    // opening an account turns the globe to its city; closing it lets the globe sway again
    useEffect(() => {
        const city = model.cities.find((c) => c.lines.some((l) => l.id === open));
        view.current.fly = city ? latLonOf(city.vec) : null;
        view.current.idleSince = 0;
    }, [open, model]);

    const { w } = size;
    const h = size.h || 360;
    const s = clamp(Math.min(w, h) / 360, 0.72, 1.15); // how big the pins and discs are
    const R = Math.max(70, Math.min(h / 2 - 22 * s, w / 2 - 18 * s) / (model.orbits.length ? 1.15 : 1));
    const cx = w / 2;
    const cy = h / 2 + (model.orbits.length ? 0 : 8 * s); // the pins stand up: a little room above
    const top = valued[0]?.value || 1;
    const radius = (v) => clamp(Math.sqrt(v / top) * 17 * s, 10.5 * s, 17 * s);

    useEffect(() => {
        if (!many || !w) return;
        const c = canvas.current;
        const ctx = c.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const css = getComputedStyle(box.current);
        const tone = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
        const ink = tone("--ink", "#161a16");
        const ink2 = tone("--ink2", "#4b524b");
        const rim = tone("--line", "#e0e4d9");
        const face = tone("--raised", "#ffffff");
        const accent = tone("--bull", "#2a78d6");
        const calm = still();
        const land = landPoints();
        const v = view.current;

        // day and night for now, worked out again each minute
        let sun = sunVec();
        let lit = land.map((p) => p[0] * sun[0] + p[1] * sun[1] + p[2] * sun[2] > -0.04);
        let sunAt = Date.now();

        // to start, facing the money, swinging in as it appears
        if (!v.aimed) {
            v.yaw = -model.centre[1];
            v.pitch = clamp(model.centre[0], -0.6, 0.6) * 0.85;
            v.born = performance.now();
            v.aimed = true;
        }

        let raf = 0;
        let last = performance.now();
        let visible = true;
        const seen = new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            if (visible && !raf) raf = requestAnimationFrame(draw);
        });
        seen.observe(box.current);

        const project = (p) => [cx + p[0] * R, cy - p[1] * R];
        // behind the globe: on the far side and inside its disc
        const hidden = ([x, y, z]) => z < 0 && x * x + y * y < 1;

        function draw(now) {
            raf = 0;
            if (!visible) return;
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            const t = now / 1000;
            if (Date.now() - sunAt > 60000) {
                sun = sunVec();
                lit = land.map((p) => p[0] * sun[0] + p[1] * sun[1] + p[2] * sun[2] > -0.04);
                sunAt = Date.now();
            }

            // the motion: a drag moves it straight; let go, it carries on and slows; left alone a few
            // seconds (or with an account opened), it eases back to sway round the money
            if (!v.drag) {
                const moving = Math.abs(v.vYaw) + Math.abs(v.vPitch) > 0.015;
                if (moving) {
                    v.yaw += v.vYaw * dt;
                    v.pitch = clamp(v.pitch + v.vPitch * dt, -1.2, 1.2);
                    const k = Math.exp(-dt * 2.6);
                    v.vYaw *= k;
                    v.vPitch *= k;
                    if (!v.idleSince) v.idleSince = now;
                } else if (!v.hold) {
                    if (!v.idleSince) v.idleSince = now;
                    const settle = v.fly ? 0 : 5000;
                    if (now - v.idleSince > settle) {
                        const [lat, lon] = v.fly || model.centre;
                        const sway = calm || v.fly ? 0 : 1;
                        const tYaw = -lon + sway * 0.42 * Math.sin(t * 0.21);
                        const tPitch = clamp(lat, -0.6, 0.6) * 0.85 + sway * 0.05 * Math.sin(t * 0.13);
                        const k = 1 - Math.exp(-dt * (v.fly ? 2.2 : 0.9));
                        v.yaw += towards(v.yaw, tYaw) * k;
                        v.pitch += (tPitch - v.pitch) * k;
                    }
                }
            }
            // the first moments: a swing in and a fade up
            const born = calm ? 1 : easeOut((now - v.born) / 1100);
            const yaw = v.yaw - (1 - born) * 1.3;
            const pitch = v.pitch;
            const P = (p) => turn(p, yaw, pitch);

            ctx.clearRect(0, 0, w, h);
            ctx.globalAlpha = born;

            // the globe: a white disc with a hairline rim
            ctx.fillStyle = face;
            ctx.strokeStyle = rim;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, TAU);
            ctx.fill();
            ctx.stroke();

            // the crypto orbits behind the globe go first, so it hides them
            const orbitPts = model.orbits.map((o) => Array.from({ length: 121 }, (_, i) => orbitAt(o, (i / 120) * TAU)));
            ctx.strokeStyle = ink2;
            ctx.lineWidth = 1;
            const strokeWhere = (pts, keep, alpha, dash = []) => {
                ctx.globalAlpha = alpha * born;
                ctx.setLineDash(dash);
                ctx.beginPath();
                let on = false;
                for (const p of pts) {
                    if (keep(p)) {
                        const [px, py] = project(p);
                        if (on) ctx.lineTo(px, py);
                        else ctx.moveTo(px, py);
                        on = true;
                    } else on = false;
                }
                ctx.stroke();
                ctx.setLineDash([]);
            };
            for (const pts of orbitPts) strokeWhere(pts, (p) => p[2] < 0 && !hidden(p), 0.1);

            // latitude and longitude, faint, on the near side
            const ring = (f) => Array.from({ length: 97 }, (_, i) => P(f((i / 96) * TAU)));
            for (const lat of [-1, -0.5, 0, 0.5, 1]) strokeWhere(ring((u) => [Math.cos(u) * Math.cos(lat), Math.sin(lat), Math.sin(u) * Math.cos(lat)]), (p) => p[2] > 0, lat === 0 ? 0.1 : 0.055);
            for (let k = 0; k < 6; k++) {
                const lon = (k * Math.PI) / 6;
                strokeWhere(ring((u) => [Math.cos(u) * Math.sin(lon), Math.sin(u), Math.cos(u) * Math.cos(lon)]), (p) => p[2] > 0, 0.055);
            }

            // the land: dots on the near side, bigger and darker towards you, fainter where it's night
            const bands = 6;
            const day = Array.from({ length: bands }, () => new Path2D());
            const night = Array.from({ length: bands }, () => new Path2D());
            for (let i = 0; i < land.length; i++) {
                const [x, y, z] = P(land[i]);
                if (z < 0.03) continue;
                const b = Math.min(bands - 1, (z * bands) | 0);
                const r = (0.5 + 0.62 * z) * s;
                const px = cx + x * R;
                const py = cy - y * R;
                const path = lit[i] ? day[b] : night[b];
                path.moveTo(px + r, py);
                path.arc(px, py, r, 0, TAU);
            }
            ctx.fillStyle = ink;
            for (let b = 0; b < bands; b++) {
                const a = 0.16 + 0.5 * ((b + 0.5) / bands);
                ctx.globalAlpha = a * born;
                ctx.fill(day[b]);
                ctx.globalAlpha = a * 0.4 * born;
                ctx.fill(night[b]);
            }

            // where day meets night, dashed
            const u0 = Math.abs(sun[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
            const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
            const e1 = cross(sun, u0).map((q, _, arr) => q / Math.hypot(...arr));
            const e2 = cross(sun, e1);
            strokeWhere(
                Array.from({ length: 129 }, (_, i) => {
                    const u = (i / 128) * TAU;
                    return P([e1[0] * Math.cos(u) + e2[0] * Math.sin(u), e1[1] * Math.cos(u) + e2[1] * Math.sin(u), e1[2] * Math.cos(u) + e2[2] * Math.sin(u)]);
                }),
                (p) => p[2] > 0,
                0.22,
                [2, 4]
            );

            // threads from the city with the most money to each of the others, lifted off the
            // surface by how far they go, a glint running along each
            const hub = model.cities[0];
            model.cities.slice(1).forEach((city) => {
                const a = hub.vec;
                const b = city.vec;
                const far = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
                const lift = 0.04 + 0.26 * (far / Math.PI);
                const at = (q) => {
                    const p = slerp(a, b, q);
                    const k = 1 + lift * Math.sin(Math.PI * q);
                    return P([p[0] * k, p[1] * k, p[2] * k]);
                };
                const pts = Array.from({ length: 49 }, (_, i) => at(i / 48));
                ctx.strokeStyle = ink2;
                ctx.lineWidth = 1.1;
                // how much of it faces you: a thread that's round the back fades out
                const facing = clamp((Math.max(...pts.map((p) => p[2])) + 0.1) / 0.5, 0, 1);
                strokeWhere(pts, (p) => !hidden(p) && p[2] > -0.2, 0.34 * facing);
                if (!calm) {
                    const g = (t * 0.42 + city.phase) % 1.6;
                    if (g <= 1.12) {
                        const from = clamp(g - 0.16, 0, 1);
                        const to = clamp(g, 0, 1);
                        const glint = Array.from({ length: 9 }, (_, i) => at(from + ((to - from) * i) / 8));
                        ctx.strokeStyle = accent;
                        ctx.lineWidth = 2;
                        ctx.lineCap = "round";
                        strokeWhere(glint, (p) => !hidden(p) && p[2] > -0.2, 0.85 * facing);
                        ctx.lineCap = "butt";
                    }
                }
            });

            // each city: a dot and a slow pulse, its accounts on stems above it (fanned out when
            // there are a few), the biggest standing tallest
            ctx.lineWidth = 1;
            const place = (el, x, y, r, z, front) => {
                el.style.transform = `translate(${x - r}px, ${y - r}px)`;
                el.style.width = el.style.height = `${r * 2}px`;
                const o = clamp(front, 0, 1) * born;
                el.style.opacity = String(o);
                el.style.zIndex = String(Math.round(500 + z * 400));
                el.style.pointerEvents = o > 0.6 ? "auto" : "none";
                el.style.setProperty("--k", String(clamp(z, 0, 1)));
            };
            model.cities.forEach((city, ci) => {
                const p = P(city.vec);
                const front = (p[2] - 0.04) / 0.22;
                if (front <= 0) return;
                const [ax, ay] = project(p);
                const f = clamp(front, 0, 1) * born;
                if (!calm) {
                    const ph = (t / 2.6 + city.phase) % 1;
                    ctx.globalAlpha = f * 0.5 * (1 - ph);
                    ctx.strokeStyle = ci === 0 ? accent : ink2;
                    ctx.beginPath();
                    ctx.arc(ax, ay, (3 + 13 * ph) * s, 0, TAU);
                    ctx.stroke();
                }
                ctx.globalAlpha = f;
                ctx.fillStyle = ci === 0 ? accent : ink;
                ctx.beginPath();
                ctx.arc(ax, ay, 2.6 * s, 0, TAU);
                ctx.fill();
            });
            model.fans.forEach((fan) => {
                const fp = P(fan.vec);
                const front = (fp[2] - 0.04) / 0.22;
                const [fx, fy] = project(fp);
                const n = fan.items.length;
                const spread = Math.min(0.62, 2.1 / n);
                fan.items.forEach(({ line: l, city }, i) => {
                    const el = nodeEls.current[l.id];
                    if (!el) return;
                    const r = radius(l.value);
                    const ang = (i - (n - 1) / 2) * spread;
                    const stem = (22 + (n > 2 ? 10 : 0)) * s + r;
                    const nx = fx + Math.sin(ang) * stem;
                    const ny = fy - Math.cos(ang) * stem;
                    if (front > 0) {
                        // the stem runs from the account's own city up to its disc
                        const [cx2, cy2] = project(P(city.vec));
                        const dx = nx - cx2;
                        const dy = ny - cy2;
                        const d = Math.hypot(dx, dy) || 1;
                        ctx.globalAlpha = clamp(front, 0, 1) * 0.45 * born;
                        ctx.strokeStyle = ink2;
                        ctx.beginPath();
                        ctx.moveTo(cx2, cy2);
                        ctx.lineTo(nx - (dx / d) * r, ny - (dy / d) * r);
                        ctx.stroke();
                    }
                    place(el, nx, ny, r, fp[2], front);
                });
            });

            // the wallets, riding their orbits; the near half of each orbit drawn over the globe
            for (const pts of orbitPts) strokeWhere(pts, (p) => p[2] >= 0, 0.16);
            model.orbits.forEach((o) => {
                const el = nodeEls.current[o.line.id];
                if (!el) return;
                const u = o.phase + (calm ? 0 : t * o.speed);
                const p = orbitAt(o, u);
                const [px, py] = project(p);
                const behind = p[2] < 0 && Math.hypot(p[0], p[1]) < 1.08;
                place(el, px, py, radius(o.line.value) * 0.9, p[2], behind ? 0 : 1);
            });

            ctx.globalAlpha = 1;
            raf = requestAnimationFrame(draw);
        }
        raf = requestAnimationFrame(draw);
        return () => {
            seen.disconnect();
            cancelAnimationFrame(raf);
            raf = 0;
        };
        // the drawing follows the accounts (model) and the size of the card
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [many, w, h, model]);

    if (!many) return null;

    // dragging: the globe follows the pointer both ways; a short press on an account is a click
    const down = (e) => {
        const v = view.current;
        v.drag = { x: e.clientX, y: e.clientY, t: performance.now() };
        v.moved = 0;
        v.vYaw = v.vPitch = 0;
        v.fly = null;
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
        const v = view.current;
        if (!v.drag) return;
        const dx = e.clientX - v.drag.x;
        const dy = e.clientY - v.drag.y;
        const now = performance.now();
        const dt = Math.max(0.008, (now - v.drag.t) / 1000);
        v.yaw += dx / R;
        v.pitch = clamp(v.pitch + dy / R, -1.2, 1.2);
        // the speed it's let go at, smoothed over the last few moves
        v.vYaw = v.vYaw * 0.4 + (dx / R / dt) * 0.6;
        v.vPitch = v.vPitch * 0.4 + (dy / R / dt) * 0.6;
        v.moved += Math.abs(dx) + Math.abs(dy);
        v.drag = { x: e.clientX, y: e.clientY, t: now };
    };
    const up = () => {
        const v = view.current;
        // held still before letting go: no fling
        if (v.drag && performance.now() - v.drag.t > 90) v.vYaw = v.vPitch = 0;
        v.drag = null;
        v.idleSince = 0;
    };
    // the arrow keys turn it too
    const onKey = (e) => {
        const step = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, -0.2], ArrowDown: [0, 0.2] }[e.key];
        if (!step) return;
        e.preventDefault();
        const v = view.current;
        v.vYaw = step[0] * 4;
        v.vPitch = step[1] * 4;
        v.fly = null;
        v.idleSince = 0;
    };

    const sum = (ls) => ls.reduce((a, l) => a + l.value, 0);
    const kinds = GROUPS.map((g) => ({ ...g, lines: valued.filter((l) => l.group === g.key) }))
        .filter((g) => g.lines.length)
        .sort((a, b) => sum(b.lines) - sum(a.lines));
    const lit = focus?.line ? focus.line.group : focus?.group || null;
    const share = (x) => (gross ? (x / gross) * 100 : 0);
    const pctOf = (x) => `${Math.round(share(x)) || "<1"}%`;
    const cityOf = (id) => model.cities.find((c) => c.lines.some((l) => l.id === id))?.name || "On-chain";

    return (
        <>
            <div className="orb" role="group" aria-label="Where it sits">
                <div className="orb-stage" ref={box} tabIndex={0} aria-label="Globe: drag or use the arrow keys to turn it" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={onKey}>
                    {w > 0 && <canvas ref={canvas} className="orb-canvas" style={{ width: w, height: h }} aria-hidden="true" />}
                    {w > 0 &&
                        placed.map((l) => (
                            <button
                                key={l.id}
                                ref={(el) => (nodeEls.current[l.id] = el)}
                                type="button"
                                className={`orb-node${model.orbits.some((o) => o.line.id === l.id) ? " is-sat" : ""}${open === l.id || focus?.line?.id === l.id ? " is-on" : ""}${lit && lit !== l.group ? " is-dim" : ""}`}
                                style={{ opacity: 0 }}
                                onClick={() => view.current.moved < 6 && onOpen(l.id)}
                                onPointerEnter={() => setFocus({ line: l })}
                                onPointerLeave={() => setFocus(null)}
                                onFocus={() => setFocus({ line: l })}
                                onBlur={() => setFocus(null)}
                                aria-label={`${l.name}, ${cityOf(l.id)}: ${text(l.value, { paise: "never" })}, ${pctOf(l.value)}`}
                            >
                                <Mark mark={l.mark} size={22} />
                                <span className="orb-tag" aria-hidden="true">
                                    <b>{l.name}</b>
                                    <span>
                                        {cityOf(l.id)} · <Fig value={l.value} short className="orb-tag-val" />
                                    </span>
                                </span>
                            </button>
                        ))}
                </div>
            </div>
            {/* under the globe, the kinds as one bar, biggest first, each its own shade of ink, and a
                legend under it that names them; pointing at either lights that kind's accounts on it */}
            <div className="orb-foot">
                <div className={`orb-kinds${lit ? " is-lit" : ""}`}>
                    <div className="orb-stack" aria-hidden="true">
                        {kinds.map((g, i) => (
                            <i
                                key={g.key}
                                className={lit === g.key ? "is-on" : ""}
                                style={{ flexGrow: Math.max(sum(g.lines), gross * 0.006), "--shade": KIND_SHADES[Math.min(i, KIND_SHADES.length - 1)] }}
                                onPointerEnter={() => setFocus({ group: g.key })}
                                onPointerLeave={() => setFocus(null)}
                                onClick={() => onOpen(g.lines[0].id)}
                            />
                        ))}
                    </div>
                    <ul className="orb-legend" aria-label="Kinds">
                        {kinds.map((g, i) => (
                            <li key={g.key}>
                                <button
                                    type="button"
                                    className={lit === g.key ? "is-on" : ""}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onPointerEnter={() => setFocus({ group: g.key })}
                                    onPointerLeave={() => setFocus(null)}
                                    onFocus={() => setFocus({ group: g.key })}
                                    onBlur={() => setFocus(null)}
                                    onClick={() => onOpen(g.lines[0].id)}
                                >
                                    <span className="orb-swatch" style={{ "--shade": KIND_SHADES[Math.min(i, KIND_SHADES.length - 1)] }} aria-hidden="true" />
                                    <span className="orb-kind-name">{g.label}</span>
                                    <span className="orb-kind-pct">{pctOf(sum(g.lines))}</span>
                                    <Fig value={Math.round(sum(g.lines))} className="orb-kind-val" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </>
    );
}

// the kinds' shares of ink in the bar under the globe, biggest first
const KIND_SHADES = ["78%", "54%", "36%", "23%", "14%", "9%"];

// ---------- the ledger ----------

/** A ledger figure. */
const Amount = ({ value, whole }) => <Fig value={whole ? Math.round(value) : value} short={false} className="lg-amt" />;

/**
 * Every account, in one card under a heading that opens and shuts it (shown, onShown). Shut, the
 * heading carries the count and the biggest accounts' marks.
 */
function Ledger({ lines, totals, open, jump, shown, onShown, detail, onOpen, onAddWallet, onAddBalance, onNewTrade }) {
    const gross = totals.gross || 0;
    const sum = (ls) => ls.reduce((a, l) => a + (l.value || 0), 0);
    // what each group adds, from its own heading; an empty group is one line that adds it
    const adders = {
        cash: { label: "Add a bank balance", sub: "Savings, a deposit, cash or a loan, typed in", run: () => onAddBalance() },
        brokerage: { label: "Add an investment account", sub: "A broker the page can’t read, like Merrill, typed in", run: () => onAddBalance("invest") },
        funds: { label: "Add mutual funds", sub: "What they’re worth today, on Groww or anywhere, typed in", run: () => onAddBalance("funds") },
        crypto: { label: "Add a crypto wallet", sub: "Read from its public addresses: no keys, nothing to sign", run: onAddWallet },
        trading: { label: "Log a trade", sub: "A Real-account trade’s result counts here", run: onNewTrade },
        other: { label: "Add an asset", sub: "Anything else you own, typed in", run: () => onAddBalance() },
        owed: { label: "Add a loan", sub: "What you owe, taken off the total", run: () => onAddBalance() },
    };
    // bank, brokerage and crypto are always there to add to; biggest group first, what's owed last;
    // inside a group, biggest account first
    const groups = GROUPS.map((g) => ({ ...g, lines: lines.filter((l) => l.group === g.key).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)) }))
        .filter((g) => g.lines.length || ALWAYS.includes(g.key))
        .sort((a, b) => (a.key === "owed") - (b.key === "owed") || !a.lines.length - !b.lines.length || sum(b.lines) - sum(a.lines));
    const shares = lines.filter((l) => l.value > 0).length > 1;
    // the accounts, not counting the trading (it's in the card above) or what isn't set up yet
    const count = lines.filter((l) => l.state !== "setup" && l.kind !== "trading").length;
    // shut, the card's top row shows the biggest few by their marks, and the first three by name
    const marks = lines
        .filter((l) => l.value > 0 && l.kind !== "trading")
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    const named = Math.min(3, marks.length);
    const names = marks
        .slice(0, named)
        .map((l) => l.name)
        .join(", ");

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
        <section className={`lg fin-sec${shown ? " is-shown" : ""}`} id="accounts" aria-labelledby="lg-title">
            <div className="fin-head">
                <h2 id="lg-title">Accounts</h2>
                {count > 0 && <span className="count">{count}</span>}
            </div>
            <div className="lg-card" id="lg-card">
                {/* the card's top row opens and shuts the list; shut, it's the biggest accounts by name */}
                <button type="button" className="lg-fold" aria-expanded={shown} aria-controls="lg-list" onClick={() => onShown(!shown)}>
                    {!shown && marks.length > 0 && (
                        <span className="lg-fold-marks" aria-hidden="true">
                            {marks.map((l) => (
                                <span key={l.id} className="lg-fold-disc">
                                    <Mark mark={l.mark} size={18} />
                                </span>
                            ))}
                        </span>
                    )}
                    <span className="lg-fold-text">
                        {shown ? (
                            <>Every account, biggest group first</>
                        ) : marks.length ? (
                            <>
                                <b>{names}</b>
                                {count > named ? <span> and {count - named} more</span> : null}
                            </>
                        ) : (
                            <>Nothing added yet</>
                        )}
                    </span>
                    <span className="lg-fold-hint">{shown ? "Hide" : "Show all"}</span>
                    <ChevronDown className="lg-fold-chev" aria-hidden="true" />
                </button>
                {shown && (
                    <div className="lg-list fade-in" id="lg-list">
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
                                                        <Mark mark={l.mark} size={32} />
                                                        <span className="lg-name">
                                                            <b>{l.name}</b>
                                                            <small>
                                                                {l.state === "off" || l.state === "loading" || l.tone ? (
                                                                    <i className={`lg-dot tone-${l.state === "loading" || l.tone === "wait" ? "none" : "warn"}`} aria-hidden="true" />
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
                )}
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

// ---------- the trading ----------

/**
 * The Real account's results, in dollars as they were logged: what's added to the total, and what
 * isn't (the funded, demo and backtest trades, which stay in the journal).
 */
function TradingPanel({ stats: s, rate, left, failed, onRetry, onShow }) {
    if (failed)
        return (
            <Setup title="The trades didn’t load" onRetry={onRetry}>
                The journal didn’t answer after three tries, so the trading isn’t in the total for now.
            </Setup>
        );
    return (
        <div className="kt nw-trade">
            <dl className="brief">
                <div className="brief-cell">
                    <dt>Net P&amp;L</dt>
                    <dd className={`brief-num sm ${sideOf(s.net)}`}>{usd(s.net, { sign: true })}</dd>
                </div>
                <div className="brief-cell">
                    <dt>Won · lost</dt>
                    <dd className="brief-num sm">
                        {s.wins} <span className="muted">·</span> {s.losses}
                    </dd>
                </div>
                <div className="brief-cell">
                    <dt>Win rate</dt>
                    <dd className="brief-num sm">{s.winRate == null ? <span className="muted">—</span> : `${Math.round(s.winRate)}%`}</dd>
                </div>
                <div className="brief-cell">
                    <dt>Open</dt>
                    <dd className="brief-num sm">{s.open}</dd>
                </div>
            </dl>
            <div className="nw-trade-foot">
                <p>
                    The Real account’s closed trades, added at today’s rate{rate ? ` ($1 = ₹${num(rate)})` : ""}.
                    {left ? ` Funded, demo, backtest and archived trades (${left}) stay in the journal, out of the total.` : ""}
                </p>
                <button type="button" className="btn btn-sm" onClick={onShow}>
                    See these trades
                    <ArrowRight aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}

// ---------- a balance typed in by hand ----------

/** The balance a typed figure means: the figure itself, or the old balance with +/− an amount. */
function readBalance(text, was) {
    const m = text.replace(/,/g, "").match(/^([+−]?)(\d*\.?\d*)$/);
    if (!m || !/\d/.test(m[2])) return null;
    const n = parseFloat(m[2]);
    const value = m[1] === "+" ? was + n : m[1] === "−" ? was - n : n;
    if (!Number.isFinite(value) || value < 0 || value > 1e12) return null;
    return { value: Math.round(value * 100) / 100, change: Boolean(m[1]) };
}

/** A fund's return, signed, as Groww shows them. */
const retText = (x) => (x == null ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(2)}%`);

/** `fund`: the held fund's NAV and returns; `known`: what's known of it (category, house). */
function BalancePanel({ entry, fund, known, rate, demo, onEdit, onSaved, onRemove }) {
    const info = balanceInfo(entry, known);
    const [confirm, setConfirm] = useState(false); // asked to remove: the panel asks to be sure
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
        const body = { name: entry.name, kind: entry.kind, bank: entry.bank || "", amount: read.value, currency: entry.currency || "INR", note: entry.note || "", scheme: entry.scheme ?? null };
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

    if (confirm)
        return (
            <div className="nw-confirm" role="group" aria-label={`Remove ${info.title}`}>
                <span>
                    Take <b>{info.title}</b> off your net worth? {loan ? "The loan itself isn’t touched." : "Nothing changes at the bank or platform."}
                </span>
                <button type="button" className="btn btn-sm" onClick={() => setConfirm(false)} autoFocus>
                    Keep it
                </button>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => onRemove(entry)}>
                    Remove
                </button>
            </div>
        );

    const figureId = `nw-bal-${entry._id}`;
    const bad = read == null && text;
    const label = loan ? "Owed today" : entry.kind === "invest" || entry.kind === "funds" ? "Value today" : "Balance today";
    // the figure set the way the total is, its paise a shade lighter, even as it's typed: the
    // input's own text is clear and a copy of it underneath does the showing
    const dot = text.indexOf(".");

    // the figure, edited where it stands; Save and Cancel appear once it's changed
    const figure = (
        <div className={`nw-bal-fig${changed ? " is-changed" : ""}`}>
            <span className="nw-bal-cur" aria-hidden="true">
                {dollars ? "$" : "₹"}
            </span>
            <span className="nw-bal-type">
                <span className="nw-bal-mirror" aria-hidden="true">
                    {dot < 0 ? text : text.slice(0, dot)}
                    {dot < 0 ? null : <span className="fig-frac">{text.slice(dot)}</span>}
                </span>
                <input
                    ref={field}
                    id={figureId}
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
                    title="Type the new figure, or + or − an amount to adjust it"
                />
            </span>
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
    );
    const hint = (
        <p className="nw-bal-hint" id={`nw-bal-hint-${entry._id}`} aria-live="polite">
            {bad ? (
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
            ) : dollars && rate ? (
                <>
                    ≈ {inr(was * rate, { whole: true })} at ₹{num(rate)}
                </>
            ) : null}
        </p>
    );
    const menu = (
        <MoreMenu
            label={`${info.title}: more`}
            items={[
                {
                    label: entry.kind === "funds" ? "Edit holding" : "Edit balance",
                    hint: entry.kind === "funds" ? "Where it’s held and the fund" : entry.kind === "invest" ? "Where it’s held, its name and currency" : "Bank, kind, name and note",
                    icon: Pencil,
                    run: onEdit,
                },
                "-",
                { label: entry.kind === "loan" ? "Remove loan…" : entry.kind === "funds" ? "Remove holding…" : "Remove balance…", icon: Trash2, run: () => setConfirm(true), danger: true },
            ]}
        />
    );
    const updated = <span className={`nw-bal-when${stale ? " is-stale" : ""}`}>{entry.updatedAt ? `Updated ${fmtAgo(entry.updatedAt)}` : "Not updated yet"}</span>;

    // a balance (a bank, cash, a deposit, an investment account, a loan): the row above already
    // says what and where, so opening it is one line to change the figure, its trail if it has
    // one, and when it was last typed
    if (entry.kind !== "funds")
        return (
            <form className="nw-bal is-line" onSubmit={save}>
                <label className="visually-hidden" htmlFor={figureId}>
                    {label}
                </label>
                {figure}
                {hint}
                <Trail entry={entry} />
                <span className="nw-bal-end">
                    {updated}
                    {menu}
                </span>
            </form>
        );

    // a mutual fund: the figure, then what the fund is and how it has done
    return (
        <form className="nw-bal is-fund" onSubmit={save}>
            <div className="nw-bal-main">
                <label className="nw-bal-label" htmlFor={figureId}>
                    {label}
                </label>
                {figure}
                {hint}
            </div>
            <dl className="nw-bal-facts">
                {info.fund?.category ? (
                    <div>
                        <dt>Category</dt>
                        <dd>{info.fund.category}</dd>
                    </div>
                ) : null}
                <div>
                    <dt>Returns</dt>
                    {!entry.scheme ? (
                        <dd className="nw-bal-quiet">Pick it from the list to see them</dd>
                    ) : fund?.returns ? (
                        <dd className="nw-rets" title="3 and 5 years: a year on average">
                            {["1Y", "3Y", "5Y"].map((k) => (
                                <span key={k}>
                                    <i>{k}</i>
                                    <b className={fund.returns[k] == null ? "" : sideOf(fund.returns[k])}>{retText(fund.returns[k])}</b>
                                </span>
                            ))}
                        </dd>
                    ) : (
                        <dd className="nw-bal-quiet">{fund?.loading ? "Reading…" : "Didn’t load"}</dd>
                    )}
                </div>
                {fund?.nav ? (
                    <div>
                        <dt>NAV</dt>
                        <dd>
                            ₹{fund.nav.toLocaleString("en-IN", { maximumFractionDigits: 4 })} <span className="muted">on {new Date(`${fund.date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                        </dd>
                    </div>
                ) : null}
                <div>
                    <dt>Last updated</dt>
                    <dd className={stale ? "is-stale" : ""}>{entry.updatedAt ? fmtAgo(entry.updatedAt) : "—"}</dd>
                </div>
            </dl>
            <span className="nw-bal-end">{menu}</span>
        </form>
    );
}

/**
 * A typed-in balance's trail, small, on its line: every figure it has had as steps (a balance
 * holds until the next figure is typed), the latest at the right, and the change since the first.
 * Point at it to read one. Nothing at all until there's a figure before today's.
 */
function Trail({ entry }) {
    const [at, setAt] = useState(null);
    const plot = useRef(null);
    const currency = entry.currency || "INR";
    const money = (x) => (currency === "USD" ? usd(x) : inr(x));
    // a figure kept in another currency can't sit on the same line
    const points = [...(entry.history || []).filter((h) => (h.currency || "INR") === currency), { at: entry.updatedAt || entry.createdAt, amount: entry.amount || 0 }]
        .map((p) => ({ t: Date.parse(p.at), v: Number(p.amount) || 0 }))
        .filter((p) => Number.isFinite(p.t));
    if (points.length < 2) return null;

    const t0 = points[0].t;
    const span = Math.max(1, points[points.length - 1].t - t0);
    const values = points.map((p) => p.v);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const X = (t) => ((t - t0) / span) * 100;
    const Y = (v) => (hi === lo ? 50 : 86 - ((v - lo) / (hi - lo)) * 72);
    const path = points.map((p, i) => (i ? `H${X(p.t).toFixed(2)}V${Y(p.v).toFixed(2)}` : `M0 ${Y(p.v).toFixed(2)}`)).join("");
    const first = points[0];
    const change = points[points.length - 1].v - first.v;
    const loan = entry.kind === "loan";
    const day = (t) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    const move = (e) => {
        const r = plot.current.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        let best = 0;
        points.forEach((p, i) => {
            if (Math.abs(X(p.t) - x) < Math.abs(X(points[best].t) - x)) best = i;
        });
        setAt(best);
    };
    const shown = at == null ? null : points[at];

    return (
        <span className="nw-trail">
            <span className="nw-trail-plot" ref={plot} onPointerMove={move} onPointerLeave={() => setAt(null)}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <path d={path} />
                </svg>
                {points.map((p, i) => (
                    <i key={i} className={i === points.length - 1 ? "is-last" : at === i ? "is-on" : ""} style={{ left: `${X(p.t)}%`, top: `${Y(p.v)}%` }} aria-hidden="true" />
                ))}
            </span>
            <span className="nw-trail-read" aria-live="polite">
                {shown ? (
                    <>
                        <b>{money(shown.v)}</b> on {day(shown.t)}
                    </>
                ) : (
                    <>
                        <b className={change ? sideOf(loan ? -change : change) : ""}>
                            {change > 0 ? "+" : change < 0 ? "−" : ""}
                            {money(Math.abs(change))}
                        </b>{" "}
                        since {day(first.t)}
                    </>
                )}
            </span>
        </span>
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
/** An address as long as its chip allows: whole on its own, shortened as more share the line. */
const addressFor = (a, count) => (count === 1 || a.length <= 16 ? a : count === 2 ? `${a.slice(0, 10)}…${a.slice(-8)}` : shortAddress(a));

/** The chains named in the server's "Ethereum: …; BNB Chain: …" */
const failedChains = (error) => {
    const names = [...new Set(String(error).split(/;\s*/).map((x) => x.split(":")[0].trim()).filter(Boolean))];
    return names.length ? names : ["Some chains"];
};

function WalletPanel({ wallet: w, src, demo, onEdit, onReread, onRemove }) {
    const [confirm, setConfirm] = useState(false);
    // read again (or still being asked again, after a chain didn't answer): no warnings meanwhile
    const reading = src.state === "refreshing" || src.state === "retrying";
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
    return (
        <div className="kt nw-wal">
            {confirm ? (
                <div className="nw-confirm" role="group" aria-label={`Remove ${w.name}`}>
                    <span>
                        Take <b>{w.name}</b> off this page? The coins stay where they are.
                    </span>
                    <button type="button" className="btn btn-sm" onClick={() => setConfirm(false)}>
                        Keep it
                    </button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => onRemove(w)}>
                        Remove
                    </button>
                </div>
            ) : (
                // the addresses along one line, filling it, and the wallet's menu at its end
                <div className="nw-wal-bar">
                    <ul className="nw-addrs" aria-label="Addresses">
                        {addresses.map((a) => {
                            const info = CHAIN_INFO[a.chain];
                            const held = (a.holdings || []).length;
                            return (
                                <li key={a.address}>
                                    <button
                                        type="button"
                                        className={`nw-addr${a.error && !reading ? " is-warn" : ""}`}
                                        onClick={() => copy(a.address, "Address copied")}
                                        title={`${a.address}\n${info.coins}${a.error ? `\n${a.error}` : ""}\nClick to copy`}
                                    >
                                        {a.chain === "evm" ? <NetworkStack networks={info.networks.slice(0, 3)} size={18} /> : <CoinIcon token={info.token} size={18} />}
                                        <span className="nw-addr-chain">{a.chain === "evm" ? "EVM" : CHAIN_SHORT[a.chain]}</span>
                                        <span className="nw-addr-text">{addressFor(a.address, addresses.length)}</span>
                                        {a.error ? (
                                            reading ? (
                                                <span className="nw-addr-state">reading…</span>
                                            ) : (
                                                <span className="nw-addr-state is-warn">didn’t answer</span>
                                            )
                                        ) : !held ? (
                                            <span className="nw-addr-state">empty</span>
                                        ) : null}
                                        <Copy className="nw-addr-copy" aria-hidden="true" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    <MoreMenu
                        label={`${w.name}: more`}
                        items={[
                            { label: "Edit wallet", hint: "Its app and addresses", icon: Pencil, run: () => onEdit(w) },
                            { label: reading ? "Reading the chains…" : "Read again", hint: demo ? "Not in the sample" : "Fresh balances from every chain", icon: RefreshCw, run: onReread, disabled: reading || demo },
                            { label: addresses.length > 1 ? "Copy all addresses" : "Copy the address", hint: "One a line", icon: Copy, run: () => copy(addresses.map((a) => a.address).join("\n"), "Addresses copied") },
                            "-",
                            { label: "Remove wallet…", icon: Trash2, run: () => setConfirm(true), danger: true },
                        ]}
                    />
                </div>
            )}
            {/* what didn't load, in plain words (the server's reasons on hover), and a way to ask again */}
            {(w.error || src.data?.priceError) && !reading && (
                <div className="kt-note nw-retry" title={[w.error, src.data?.priceError].filter(Boolean).join("\n")}>
                    <span>
                        {w.error ? `${list(failedChains(w.error))} didn’t answer, so ${failedChains(w.error).length === 1 ? "its" : "their"} coins aren’t in the total.` : ""}
                        {w.error && src.data?.priceError ? " " : ""}
                        {src.data?.priceError ? "Prices didn’t load, so some values are missing." : ""}
                    </span>
                    {!demo && (
                        <button type="button" className="btn btn-sm" onClick={onReread}>
                            <RefreshCw aria-hidden="true" />
                            Try again
                        </button>
                    )}
                </div>
            )}
            {(w.holdings || []).length ? (
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
        </div>
    );
}
