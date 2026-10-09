"use client";

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, LogOut, RefreshCw, Search } from "lucide-react";
import MoreMenu from "./k7/MoreMenu";
import { toast } from "sonner";
import { API_BASE, http } from "@/lib/http";
import {
    HANDOFF_ERRORS,
    chargesSummary,
    clearSession,
    clock,
    connectUrl,
    holdingsSummary,
    instrumentOf,
    kiteGet,
    kitePost,
    loadSession,
    num,
    orderCounts,
    orderState,
    pct,
    positionsSummary,
    saveSession,
    shortDay,
    takeHandoff,
} from "@/lib/kite";
import { sideOf } from "@/lib/format";
import { moneyText } from "@/lib/currency";
import { Money } from "./k7/Money";
import Seg from "./k7/Seg";
import { useCountUp, useNow } from "./k7/hooks";

// The Zerodha account, read through the API server: funds, today's trading, holdings,
// mutual funds, GTTs and alerts, plus quotes and charts when the Kite plan includes market data.

/** The Zerodha connection: the login hand-off, this device's session and the account it reads. */
export function useZerodha() {
    const [phase, setPhase] = useState("loading"); // loading | unset | offline | connect | ready
    const [session, setSession] = useState(null); // { session, expiresAt, userName }
    const [account, setAccount] = useState(null);
    const [busy, setBusy] = useState(false);
    const started = useRef(false);

    const toConnect = useCallback(() => {
        clearSession();
        setSession(null);
        setAccount(null);
        setPhase("connect");
    }, []);

    const load = useCallback(
        async (s) => {
            try {
                setAccount(await kiteGet("/kite/account", s.session));
                setPhase("ready");
            } catch (e) {
                if (e.status === 401) {
                    toConnect();
                    if (e.code === "expired") toast("Your Zerodha login has ended", { description: "Kite logins last until 6 AM. Connect again." });
                    return;
                }
                toast.error("Zerodha didn't load", { description: e.detail || "Try again in a moment." });
                setPhase((p) => (p === "loading" ? "offline" : p));
            }
        },
        [toConnect]
    );

    const check = useCallback(async () => {
        try {
            const st = await http("/kite/status");
            setPhase(st?.configured ? "connect" : "unset");
        } catch (e) {
            setPhase(e.status === 404 ? "unset" : "offline"); // 404: the server doesn't have the Zerodha routes yet
        }
    }, []);

    useEffect(() => {
        if (started.current) return; // once, even when effects run twice in development
        started.current = true;
        (async () => {
            const handoff = takeHandoff();
            if (handoff?.error) toast.error(HANDOFF_ERRORS[handoff.error] || "The Zerodha login didn't finish.");
            if (handoff?.code) {
                try {
                    const s = await http("/kite/session", { method: "POST", body: { code: handoff.code } });
                    saveSession(s);
                    setSession(s);
                    toast.success("Zerodha connected", { description: "This device can read your account until 6 AM." });
                    await load(s);
                    return;
                } catch {
                    toast.error("That sign-in link has expired", { description: "Connect again; it only works for two minutes." });
                }
            }
            const saved = loadSession();
            if (saved) {
                setSession(saved);
                await load(saved);
                return;
            }
            await check();
        })();
    }, [load, check]);

    const refresh = async () => {
        if (!session || busy) return;
        setBusy(true);
        await load(session);
        setBusy(false);
    };

    const disconnect = async () => {
        setBusy(true);
        try {
            await kitePost("/kite/logout", session.session);
            toast("Zerodha disconnected", { description: "The login is ended at Kite and on every device." });
        } catch {
            // already gone at the server: still sign this device out
        }
        setBusy(false);
        toConnect();
    };

    return { phase, session, account, busy, refresh, disconnect, check };
}

/** The Zerodha account in full, from useZerodha(). */
export default function Zerodha({ z }) {
    const { phase, session, account, busy, refresh, disconnect, check } = z;
    if (phase === "loading") {
        return (
            <div className="skeleton" aria-busy="true" aria-label="Loading Zerodha">
                <div className="sk kt-sk-bar" />
                <div className="sk sk-perf" />
                <div className="sk sk-rows" />
            </div>
        );
    }
    if (phase !== "ready" || !account) return <Connect phase={phase} onRetry={check} />;

    return <Account account={account} session={session} busy={busy} onRefresh={refresh} onDisconnect={disconnect} />;
}

/** Before there's an account to show: set up, the server waking up, or today's login. */
function Connect({ phase, onRetry }) {
    if (phase === "unset")
        return (
            <div className="src fade-in">
                <div className="src-head">
                    <div>
                        <h3>Zerodha isn’t set up yet</h3>
                        <p>
                            Add <code>KITE_API_KEY</code>, <code>KITE_API_SECRET</code> and <code>KITE_USER_ID</code> to the API server, and set the Kite app’s redirect URL to{" "}
                            <code>{API_BASE}/kite/callback</code>.
                        </p>
                    </div>
                </div>
            </div>
        );
    if (phase === "offline")
        return (
            <div className="src fade-in">
                <div className="src-head">
                    <div>
                        <h3>The server didn’t answer</h3>
                        <p>It sleeps when no one’s used it for a while and takes up to a minute to wake. Try again in a moment.</p>
                    </div>
                    <button type="button" className="btn btn-primary" onClick={onRetry}>
                        Try again
                    </button>
                </div>
            </div>
        );
    return <TodaysLogin />;
}

const DAY_MS = 864e5;

/** The next 6:00 AM India time, when every Kite login ends (00:30 UTC). */
export function nextKiteReset(now = Date.now()) {
    const d = new Date(now);
    let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 30);
    if (t <= now) t += DAY_MS;
    return t;
}

/** "3 h 12 min", "48 min" */
function span(ms) {
    const m = Math.max(1, Math.round(ms / 6e4));
    const h = Math.floor(m / 60);
    return h ? `${h} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`;
}

/**
 * Kite's day runs from 6 AM to 6 AM, and a login lasts until the end of it. The day as a ruler,
 * now marked on it, says how long a login made now would last: a full day, or only until 6 AM.
 */
function TodaysLogin() {
    const now = useNow(30000);
    const end = nextKiteReset(now);
    const start = end - DAY_MS;
    const at = ((now - start) / DAY_MS) * 100;
    const left = end - now;
    const when = (t) => new Date(t).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
    const hours = Array.from({ length: 25 }, (_, h) => h);
    return (
        <div className="src fade-in">
            <div className="src-head">
                <div>
                    <h3>Log in to Kite for today</h3>
                    <p>Zerodha ends every app’s login at 6:00 AM. Log in once and this browser can read the account until then. Read only: nothing here can place an order.</p>
                </div>
                <a className="btn btn-primary" href={connectUrl()}>
                    Log in at Kite
                    <ArrowUpRight aria-hidden="true" />
                </a>
            </div>
            <div className="src-day" role="img" aria-label={`A login now would last ${span(left)}, until ${when(end)}.`}>
                {/* over its mark; near either end it hangs off the mark inwards, so it stays in the box */}
                <span className={`src-now${at > 80 ? " is-end" : at < 20 ? " is-start" : ""}`} style={{ left: `${at}%` }}>
                    Now <b>· lasts {span(left)}</b>
                </span>
                <div className="src-bar">
                    {hours.map((h) => (
                        <i key={h} className={h % 6 === 0 ? "is-major" : ""} style={{ left: `${(h / 24) * 100}%` }} />
                    ))}
                    <span className="src-left" style={{ left: `${at}%` }} />
                    <span className="src-mark" style={{ left: `${at}%` }} />
                </div>
                <div className="src-axis">
                    <span>{when(start)}</span>
                    <span>{when(end)}</span>
                </div>
            </div>
            <p className="src-fine">
                {left < 3 * 36e5 ? `Close to 6 AM: a login now ends in ${span(left)}, and you’ll log in again after that. ` : ""}
                Reads funds, positions, orders, holdings, mutual funds, GTTs and alerts.
            </p>
        </div>
    );
}

/**
 * A rupee amount as text in the page's currency (Finance's, see k7/Money.js), with inr()'s options:
 * `sign` puts a + on a gain, `whole` drops the paise or cents, though not under a hundred, where
 * they're most of it (₹48 is $0.50, not $0). Prices stay in rupees, as the exchange quotes them
 * (num()); amounts follow the page.
 */
function useCash() {
    const m = useContext(Money);
    return (x, { sign = false, whole = false } = {}) => {
        const v = (Number(x) || 0) * m.k;
        return moneyText(v, m, { sign, paise: whole && Math.abs(v) >= 100 ? "never" : "auto" });
    };
}

/** A rupee amount in the page's currency, counting up to a new value. */
export function Amount({ value, sign }) {
    const v = useCountUp(value);
    const cash = useCash();
    return <>{cash(Math.round(v * 100) / 100, { sign })}</>;
}

/** A section that Kite didn't send says why, instead of the whole page failing. */
function Missing({ what, section }) {
    if (!section?.error) return null;
    const plan = section.error.code === "plan";
    return (
        <p className="kt-note">
            {plan ? `${what} isn’t part of this Kite plan.` : `Kite didn’t send ${what.toLowerCase()}: ${section.error.message}`}
        </p>
    );
}

function Account({ account, session, busy, onRefresh, onDisconnect }) {
    const s = account.sections;
    const profile = s.profile?.data;
    const has = (section) => Boolean(section?.error) || (Array.isArray(section?.data) ? section.data.length > 0 : false);
    const today = has(s.orders) || has(s.trades) || Boolean(s.positions?.error) || (s.positions?.data?.net || []).length > 0;

    // what the account doesn't have, said once at the end instead of a heading over each empty box
    const none = [
        !today && "no positions or orders today",
        !has(s.holdings) && "no holdings",
        !has(s.mfHoldings) && !has(s.sips) && "no mutual funds",
        !has(s.gtt) && "no GTT orders",
        !has(s.alerts) && "no alerts",
    ].filter(Boolean);

    return (
        <div className="kt fade-in">
            {/* who's signed in, and the account's menu at the end of the line, as a wallet has it */}
            <div className="kt-top">
                <div className="statusbar kt-bar" role="status">
                    <i aria-hidden="true" />
                    <p>
                        <b>{profile?.user_name || session?.userName || "Zerodha"}</b>
                        {profile?.user_id ? <span className="muted"> {profile.user_id}</span> : null} <span className="muted">·</span> signed in until 6:00 AM{" "}
                        <span className="muted">·</span>{" "}
                        {busy ? "reading again…" : `updated ${new Date(account.fetchedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
                    </p>
                </div>
                <MoreMenu
                    label="Zerodha: more"
                    items={[
                        { label: busy ? "Reading…" : "Read again", hint: "Fresh figures from Kite", icon: RefreshCw, run: onRefresh, disabled: busy },
                        "-",
                        { label: "Disconnect", hint: "Ends the Kite login everywhere", icon: LogOut, run: onDisconnect, disabled: busy, danger: true },
                    ]}
                />
            </div>

            <Funds funds={s.funds} profile={profile} />
            {today && <Today positions={s.positions} orders={s.orders} trades={s.trades} charges={s.charges} />}
            {has(s.holdings) && <Holdings holdings={s.holdings} />}
            <Funds2 mf={s.mfHoldings} sips={s.sips} />
            {(has(s.gtt) || has(s.alerts)) && <Triggers gtt={s.gtt} alerts={s.alerts} />}
            {none.length > 0 && (
                <p className="kt-none">
                    {none.length === 5 ? "Nothing else on the account: " : "Nothing else: "}
                    {list(none)}.
                </p>
            )}
            <Market session={session} holdings={s.holdings?.data || []} />
        </div>
    );
}

/** "a, b and c" */
const list = (items) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items[0] || "");

// ---------- Funds ----------

function Funds({ funds, profile }) {
    const cash = useCash();
    const eq = funds?.data?.equity;
    const co = funds?.data?.commodity;
    const used = eq?.utilised?.debits || 0;
    const opening = eq?.available?.opening_balance || 0;
    // only the figures that say something: no margin box at ₹0, no commodity box when it's off
    const cells = eq
        ? [
              <div key="net" className="brief-cell">
                  <dt>Available to trade</dt>
                  <dd className="brief-num sm">
                      <Amount value={eq.net} />
                  </dd>
                  <dd className="brief-sub">
                      Cash {cash(eq.available?.cash, { whole: true })}
                      {eq.available?.collateral ? <> · collateral {cash(eq.available.collateral, { whole: true })}</> : null}
                  </dd>
              </div>,
              used > 0 && (
                  <div key="used" className="brief-cell">
                      <dt>Margin used</dt>
                      <dd className="brief-num sm">
                          <Amount value={used} />
                      </dd>
                      <dd className="meter" aria-hidden="true">
                          <span className="meter-fill" style={{ width: `${Math.min(100, (used / ((eq.net || 0) + used || 1)) * 100)}%` }} />
                      </dd>
                      <dd className="brief-sub">
                          {[
                              eq.utilised?.span ? `SPAN ${cash(eq.utilised.span, { whole: true })}` : "",
                              eq.utilised?.exposure ? `exposure ${cash(eq.utilised.exposure, { whole: true })}` : "",
                              eq.utilised?.option_premium ? `premium ${cash(eq.utilised.option_premium, { whole: true })}` : "",
                          ]
                              .filter(Boolean)
                              .join(" · ")}
                      </dd>
                  </div>
              ),
              <div key="open" className="brief-cell">
                  <dt>Opening balance</dt>
                  <dd className="brief-num sm">
                      <Amount value={opening} />
                  </dd>
                  <dd className="brief-sub">{Math.abs(opening - eq.net) < 0.005 ? "Untouched today" : "Equity, at the start of today"}</dd>
              </div>,
              co?.enabled !== false && (
                  <div key="co" className="brief-cell">
                      <dt>Commodity</dt>
                      <dd className="brief-num sm">
                          <Amount value={co?.net || 0} />
                      </dd>
                      <dd className="brief-sub">Used {cash(co?.utilised?.debits || 0, { whole: true })}</dd>
                  </div>
              ),
          ].filter(Boolean)
        : [];
    return (
        <section className="group" aria-labelledby="kt-funds">
            <div className="group-head">
                <h2 id="kt-funds">Funds</h2>
                {profile?.exchanges?.length ? <span className="group-note">{profile.exchanges.join(" · ")}</span> : null}
            </div>
            <Missing what="Funds" section={funds} />
            {cells.length > 0 && (
                <dl className="brief kt-brief" style={{ "--n": cells.length }}>
                    {cells}
                </dl>
            )}
        </section>
    );
}

// ---------- Today ----------

function Today({ positions, orders, trades, charges }) {
    const cash = useCash();
    const net = positions?.data?.net || [];
    const p = positionsSummary(net);
    const list = orders?.data || [];
    const counts = orderCounts(list);
    const fees = chargesSummary(charges?.data || []);
    const [view, setView] = useState("orders");
    const tradeList = trades?.data || [];

    return (
        <section className="group" aria-labelledby="kt-today">
            <div className="group-head">
                <h2 id="kt-today">Today</h2>
                <span className="group-note">Orders and trades only last the day at Zerodha</span>
            </div>
            <div className="perf kt-perf">
                <div className="perf-main">
                    <span className="perf-label">Positions P&amp;L</span>
                    <span className={`perf-net ${sideOf(p.pnl)}`}>
                        <Amount value={p.pnl} sign />
                    </span>
                    <span className="perf-sub">
                        <span className={sideOf(p.realised)}>{cash(p.realised, { sign: true })}</span> booked <span className="muted">·</span>{" "}
                        <span className={sideOf(p.unrealised)}>{cash(p.unrealised, { sign: true })}</span> open
                    </span>
                    {fees.total > 0 && (
                        <span className="perf-sub">
                            After charges <b className={sideOf(p.pnl - fees.total)}>{cash(p.pnl - fees.total, { sign: true })}</b>
                        </span>
                    )}
                </div>
                <dl className="perf-stats">
                    <div className="perf-stat">
                        <dt>Open positions</dt>
                        <dd className="perf-num">{p.open}</dd>
                        <dd className="perf-note">{p.total - p.open ? `${p.total - p.open} closed today` : "None closed today"}</dd>
                    </div>
                    <div className="perf-stat">
                        <dt>Orders</dt>
                        <dd className="perf-num">{list.length}</dd>
                        <dd className="perf-note">
                            {counts.done} done · {counts.open} open · {counts.failed} failed
                        </dd>
                    </div>
                    <div className="perf-stat">
                        <dt>Charges</dt>
                        <dd className="perf-num">{cash(fees.total)}</dd>
                        <dd className="perf-note">{fees.total ? `Brokerage ${cash(fees.brokerage)} · taxes ${cash(fees.taxes)}` : "Nothing filled yet"}</dd>
                    </div>
                    <div className="perf-stat">
                        <dt>Trades</dt>
                        <dd className="perf-num">{tradeList.length}</dd>
                        <dd className="perf-note">Fills across {new Set(tradeList.map((t) => t.order_id)).size} orders</dd>
                    </div>
                </dl>
            </div>
            <Missing what="Positions" section={positions} />
            <Missing what="Charges" section={charges} />

            {net.length > 0 && (
                <Table
                    label="Positions"
                    cols="minmax(0, 1.6fr) 5rem 6.5rem 6.5rem 7.5rem"
                    colsSm="minmax(0, 1fr) 3.5rem 6.5rem"
                    hide={[2, 3]}
                    head={["Instrument", "Qty", "Avg", "LTP", "P&L"]}
                    rows={[...net].sort((a, b) => Math.abs(b.quantity) - Math.abs(a.quantity))}
                    rowKey={(r) => `${r.exchange}:${r.tradingsymbol}:${r.product}`}
                    render={(r) => [
                        <Sym key="s" title={r.tradingsymbol} sub={`${r.exchange} · ${r.product}${r.quantity ? "" : " · closed"}`} />,
                        <span key="q" className={`kt-num${r.quantity ? "" : " muted"}`}>{num(r.quantity, 0)}</span>,
                        <span key="a" className="kt-num">{r.quantity ? num(r.average_price) : "—"}</span>,
                        <span key="l" className="kt-num">{num(r.last_price)}</span>,
                        <span key="p" className={`kt-num pnl ${sideOf(r.pnl)}`}>{cash(r.pnl, { sign: true })}</span>,
                    ]}
                />
            )}

            <div className="kt-sub-head">
                <Seg
                    label="Today's list"
                    value={view}
                    onChange={setView}
                    options={[
                        { value: "orders", label: "Orders", count: list.length },
                        { value: "trades", label: "Trades", count: tradeList.length },
                    ]}
                />
            </div>
            {view === "orders" ? (
                <>
                    <Missing what="Orders" section={orders} />
                    {list.length ? (
                        <Table
                            label="Orders"
                            cols="4.5rem minmax(0, 1.6fr) 4rem 5.5rem 6.5rem 6.5rem"
                            colsSm="3.6rem minmax(0, 1fr) 3.2rem 5.4rem"
                            hide={[3, 4]}
                            left={2}
                            head={["Time", "Instrument", "Side", "Qty", "Price", "Status"]}
                            rows={[...list].sort((a, b) => String(b.order_timestamp).localeCompare(String(a.order_timestamp)))}
                            rowKey={(r) => r.order_id}
                            render={(r) => [
                                <span key="t" className="kt-meta">{clock(r.order_timestamp)}</span>,
                                <Sym key="s" title={r.tradingsymbol} sub={`${r.exchange} · ${r.product} · ${r.order_type}`} />,
                                <SideTag key="d" side={r.transaction_type} />,
                                <span key="q" className="kt-num">
                                    {r.filled_quantity && r.filled_quantity !== r.quantity ? `${num(r.filled_quantity, 0)}/` : ""}
                                    {num(r.quantity, 0)}
                                </span>,
                                <span key="p" className="kt-num">{r.average_price ? num(r.average_price) : r.price ? num(r.price) : "Market"}</span>,
                                <State key="st" order={r} />,
                            ]}
                        />
                    ) : (
                        !orders?.error && <p className="empty-note">No orders today.</p>
                    )}
                </>
            ) : (
                <>
                    <Missing what="Trades" section={trades} />
                    {tradeList.length ? (
                        <Table
                            label="Trades"
                            cols="4.5rem minmax(0, 1.6fr) 4rem 5.5rem 6.5rem 7.5rem"
                            colsSm="3.6rem minmax(0, 1fr) 3.2rem 5.6rem"
                            hide={[3, 4]}
                            left={2}
                            head={["Time", "Instrument", "Side", "Qty", "Price", "Value"]}
                            rows={[...tradeList].sort((a, b) => String(b.fill_timestamp).localeCompare(String(a.fill_timestamp)))}
                            rowKey={(r) => r.trade_id}
                            render={(r) => [
                                <span key="t" className="kt-meta">{clock(r.fill_timestamp)}</span>,
                                <Sym key="s" title={r.tradingsymbol} sub={`${r.exchange} · ${r.product}`} />,
                                <SideTag key="d" side={r.transaction_type} />,
                                <span key="q" className="kt-num">{num(r.quantity, 0)}</span>,
                                <span key="p" className="kt-num">{num(r.average_price)}</span>,
                                <span key="v" className="kt-num">{cash(r.quantity * r.average_price, { whole: true })}</span>,
                            ]}
                        />
                    ) : (
                        !trades?.error && <p className="empty-note">No trades today.</p>
                    )}
                </>
            )}
        </section>
    );
}

// ---------- Holdings ----------

function Holdings({ holdings }) {
    const cash = useCash();
    const list = useMemo(
        () => [...(holdings?.data || [])].sort((a, b) => b.last_price * b.quantity - a.last_price * a.quantity),
        [holdings]
    );
    const h = holdingsSummary(list);
    return (
        <section className="group" aria-labelledby="kt-holdings">
            <div className="group-head">
                <h2 id="kt-holdings">Holdings</h2>
                <span className="count">{list.length}</span>
            </div>
            <Missing what="Holdings" section={holdings} />
            {list.length > 0 && (
                <>
                    <div className="perf kt-perf">
                        <div className="perf-main">
                            <span className="perf-label">Current value</span>
                            <span className="perf-net">
                                <Amount value={h.current} />
                            </span>
                            <span className="perf-sub">
                                {cash(h.invested, { whole: true })} invested <span className="muted">·</span>{" "}
                                <span className={sideOf(h.pnl)}>
                                    {cash(h.pnl, { sign: true, whole: true })} ({pct(h.pnlPct)})
                                </span>
                            </span>
                            <Allocation list={list} total={h.current} />
                        </div>
                        <dl className="perf-stats">
                            <div className="perf-stat">
                                <dt>Total P&amp;L</dt>
                                <dd className={`perf-num ${sideOf(h.pnl)}`}>{pct(h.pnlPct)}</dd>
                                <dd className="perf-note">{cash(h.pnl, { sign: true })}</dd>
                            </div>
                            <div className="perf-stat">
                                <dt>Today</dt>
                                <dd className={`perf-num ${sideOf(h.day)}`}>{pct(h.dayPct)}</dd>
                                <dd className="perf-note">{cash(h.day, { sign: true })}</dd>
                            </div>
                            <div className="perf-stat">
                                <dt>In profit</dt>
                                <dd className="perf-num">
                                    {list.filter((x) => x.last_price > x.average_price).length}
                                    <small>/{list.length}</small>
                                </dd>
                                <dd className="perf-note">Holdings above their average cost</dd>
                            </div>
                            <div className="perf-stat">
                                <dt>Largest</dt>
                                <dd className="perf-num">{h.current ? pct(((list[0].last_price * list[0].quantity) / h.current) * 100, { sign: false }) : "—"}</dd>
                                <dd className="perf-note">{list[0].tradingsymbol} of the portfolio</dd>
                            </div>
                        </dl>
                    </div>
                    <Table
                        label="Holdings"
                        cols="minmax(0, 1.5fr) 6.5rem 6.5rem 7.5rem 8rem 5.5rem"
                        colsSm="minmax(0, 1fr) 7rem"
                        hide={[1, 2, 3, 5]}
                        head={["Instrument", "Avg cost", "LTP", "Value", "P&L", "Today"]}
                        rows={list}
                        rowKey={(r) => r.isin || instrumentOf(r)}
                        render={(r) => {
                            const qty = (r.quantity || 0) + (r.t1_quantity || 0);
                            const pnl = qty * (r.last_price - r.average_price);
                            return [
                                <Sym key="s" title={r.tradingsymbol} sub={`${r.exchange} · ${num(qty, 0)} shares${r.t1_quantity ? ` · ${r.t1_quantity} T1` : ""}`} />,
                                <span key="a" className="kt-num">{num(r.average_price)}</span>,
                                <span key="l" className="kt-num">{num(r.last_price)}</span>,
                                <span key="v" className="kt-num">{cash(qty * r.last_price, { whole: true })}</span>,
                                <span key="p" className={`kt-num pnl ${sideOf(pnl)}`}>
                                    {cash(pnl, { sign: true, whole: true })}
                                    <small>{pct(r.average_price ? ((r.last_price - r.average_price) / r.average_price) * 100 : null)}</small>
                                </span>,
                                <span key="d" className={`kt-num ${sideOf(r.day_change_percentage)}`}>{pct(r.day_change_percentage)}</span>,
                            ];
                        }}
                    />
                </>
            )}
            {!list.length && !holdings?.error && <p className="empty-note">No holdings.</p>}
        </section>
    );
}

/** How the portfolio splits by value: one thin bar, a step lighter per holding. */
function Allocation({ list, total }) {
    if (!total) return null;
    const top = list.slice(0, 6);
    const rest = total - top.reduce((a, x) => a + x.last_price * x.quantity, 0);
    const parts = [...top.map((x) => ({ name: x.tradingsymbol, v: x.last_price * x.quantity })), ...(rest > 0.5 ? [{ name: "Others", v: rest }] : [])];
    return (
        <div className="kt-alloc">
            <div className="kt-alloc-bar" aria-hidden="true">
                {parts.map((p, i) => (
                    <span key={p.name} style={{ flexGrow: p.v, "--k": `${Math.max(14, 70 - i * 11)}%` }} title={`${p.name} ${pct((p.v / total) * 100, { sign: false })}`} />
                ))}
            </div>
            <ul className="kt-alloc-key">
                {parts.map((p, i) => (
                    <li key={p.name} style={{ "--k": `${Math.max(14, 70 - i * 11)}%` }}>
                        <i aria-hidden="true" />
                        {p.name} <span className="muted">{pct((p.v / total) * 100, { sign: false })}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ---------- Mutual funds ----------

function Funds2({ mf, sips }) {
    const cash = useCash();
    const list = mf?.data || [];
    const sipList = sips?.data || [];
    const invested = list.reduce((a, x) => a + x.quantity * x.average_price, 0);
    const current = list.reduce((a, x) => a + x.quantity * x.last_price, 0);
    const monthly = sipList.filter((x) => x.status === "ACTIVE" && x.frequency === "monthly").reduce((a, x) => a + x.instalment_amount, 0);
    if (!list.length && !sipList.length && !mf?.error && !sips?.error) return null;
    return (
        <section className="group" aria-labelledby="kt-mf">
            <div className="group-head">
                <h2 id="kt-mf">Mutual funds</h2>
                <span className="count">{list.length}</span>
                {list.length > 0 && (
                    <span className="group-sum">
                        <span className="muted">{cash(current, { whole: true })}</span>
                        <b className={sideOf(current - invested)}>
                            {cash(current - invested, { sign: true, whole: true })} ({pct(invested ? ((current - invested) / invested) * 100 : null)})
                        </b>
                    </span>
                )}
            </div>
            <Missing what="Mutual funds" section={mf} />
            {list.length > 0 && (
                <Table
                    label="Mutual fund holdings"
                    cols="minmax(0, 2fr) 6.5rem 6rem 7.5rem 8rem"
                    colsSm="minmax(0, 1fr) 7rem"
                    hide={[1, 2, 3]}
                    head={["Fund", "Units", "NAV", "Value", "P&L"]}
                    rows={[...list].sort((a, b) => b.quantity * b.last_price - a.quantity * a.last_price)}
                    rowKey={(r) => `${r.folio}:${r.tradingsymbol}`}
                    render={(r) => {
                        const pnl = r.quantity * (r.last_price - r.average_price);
                        return [
                            <Sym key="s" title={fundName(r.fund)} sub={`Folio ${r.folio} · avg NAV ${num(r.average_price)}`} />,
                            <span key="u" className="kt-num">{num(r.quantity, 3)}</span>,
                            <span key="n" className="kt-num">{num(r.last_price)}</span>,
                            <span key="v" className="kt-num">{cash(r.quantity * r.last_price, { whole: true })}</span>,
                            <span key="p" className={`kt-num pnl ${sideOf(pnl)}`}>
                                {cash(pnl, { sign: true, whole: true })}
                                <small>{pct(r.average_price ? ((r.last_price - r.average_price) / r.average_price) * 100 : null)}</small>
                            </span>,
                        ];
                    }}
                />
            )}
            {sipList.length > 0 && (
                <>
                    <div className="kt-sub-head">
                        <h3 className="group-title">SIPs</h3>
                        {monthly > 0 && <span className="group-note">{cash(monthly)} a month</span>}
                    </div>
                    <Table
                        label="SIPs"
                        cols="minmax(0, 2fr) 6.5rem 5.5rem 5.5rem 6rem"
                        colsSm="minmax(0, 1fr) 5.5rem 5rem"
                        hide={[2, 3]}
                        head={["Fund", "Amount", "Next", "Done", "Status"]}
                        rows={sipList}
                        rowKey={(r) => r.sip_id}
                        render={(r) => [
                            <Sym key="s" title={fundName(r.fund)} sub={capital(r.frequency)} />,
                            <span key="a" className="kt-num">{cash(r.instalment_amount)}</span>,
                            <span key="n" className="kt-num">{r.next_instalment ? shortDay(r.next_instalment) : "—"}</span>,
                            <span key="c" className="kt-num">{r.completed_instalments ?? "—"}</span>,
                            <Chip key="st" tone={r.status === "ACTIVE" ? "done" : r.status === "PAUSED" ? "open" : "failed"}>
                                {capital(r.status)}
                            </Chip>,
                        ]}
                    />
                </>
            )}
            <Missing what="SIPs" section={sips} />
        </section>
    );
}

const fundName = (s = "") => s.replace(/\s*-\s*Direct Plan.*$/i, "").replace(/\s*Direct Growth$/i, "");
const capital = (s = "") => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : "");

// ---------- GTT and alerts ----------

const OPS = { "<=": "≤", ">=": "≥", "<": "<", ">": ">", "==": "=" };

function Triggers({ gtt, alerts }) {
    const g = gtt?.data || [];
    const a = alerts?.data || [];
    // each its own section, side by side when there are both; no heading over the pair
    const showG = g.length > 0 || Boolean(gtt?.error);
    const showA = a.length > 0 || Boolean(alerts?.error);
    const gttPart = (
        <section className="group" aria-labelledby="kt-gtt">
            <div className="group-head">
                <h2 id="kt-gtt">GTT orders</h2>
                <span className="count">{g.filter((x) => x.status === "active").length} active</span>
            </div>
            <Missing what="GTT orders" section={gtt} />
            {g.length > 0 && (
                <Table
                    label="GTT orders"
                    cols="minmax(0, 1.3fr) minmax(0, 1fr) 5.5rem"
                    head={["Instrument", "Trigger", "Status"]}
                    rows={g}
                    rowKey={(r) => r.id}
                    render={(r) => {
                        const c = r.condition || {};
                        const o = r.orders?.[0] || {};
                        return [
                            <Sym key="s" title={c.tradingsymbol} sub={`${r.type === "two-leg" ? "OCO" : "Single"} · ${o.transaction_type || ""} ${num(o.quantity, 0)}`} />,
                            <span key="t" className="kt-trig">
                                <b>{(c.trigger_values || []).map((v) => num(v)).join(" / ")}</b>
                                <small>LTP {num(c.last_price)}</small>
                            </span>,
                            <Chip key="st" tone={r.status === "active" ? "done" : r.status === "triggered" ? "open" : "failed"}>
                                {capital(r.status)}
                            </Chip>,
                        ];
                    }}
                />
            )}
        </section>
    );
    const alertPart = (
        <section className="group" aria-labelledby="kt-alerts">
            <div className="group-head">
                <h2 id="kt-alerts">Alerts</h2>
                <span className="count">{a.filter((x) => x.status === "enabled").length} on</span>
            </div>
            <Missing what="Alerts" section={alerts} />
            {a.length > 0 && (
                <Table
                    label="Alerts"
                    cols="minmax(0, 1.6fr) 4.5rem 5.5rem"
                    head={["Alert", "Hits", "Status"]}
                    rows={a}
                    rowKey={(r) => r.uuid}
                    render={(r) => [
                        <Sym key="s" title={r.name} sub={`${r.lhs_tradingsymbol} ${OPS[r.operator] || r.operator} ${r.rhs_type === "constant" ? num(r.rhs_constant) : r.rhs_tradingsymbol}`} />,
                        <span key="h" className="kt-num">{r.alert_count ?? 0}</span>,
                        <Chip key="st" tone={r.status === "enabled" ? "done" : "muted"}>
                            {r.status === "enabled" ? "On" : "Off"}
                        </Chip>,
                    ]}
                />
            )}
        </section>
    );
    if (showG && showA)
        return (
            <div className="kt-pair">
                {gttPart}
                {alertPart}
            </div>
        );
    return showG ? gttPart : alertPart;
}

// ---------- Quote and chart ----------

const RANGES = [
    { value: "1W", label: "1W", interval: "15minute", days: 7 },
    { value: "1M", label: "1M", interval: "60minute", days: 30 },
    { value: "1Y", label: "1Y", interval: "day", days: 365 },
    { value: "5Y", label: "5Y", interval: "day", days: 1825 },
];

function Market({ session, holdings }) {
    const picks = useMemo(() => ["NSE:NIFTY 50", ...holdings.slice(0, 5).map(instrumentOf)], [holdings]);
    const [input, setInput] = useState(picks[0]);
    const [asked, setAsked] = useState(picks[0]);
    const [range, setRange] = useState("1M");
    const [quote, setQuote] = useState(null);
    const [candles, setCandles] = useState(null);
    const [state, setState] = useState("idle"); // idle | loading | plan | error

    useEffect(() => {
        let gone = false;
        (async () => {
            setState("loading");
            try {
                const q = await kiteGet(`/kite/quote?i=${encodeURIComponent(asked)}`, session.session);
                const one = q?.[asked];
                if (gone) return;
                if (!one) {
                    setQuote(null);
                    setState("error");
                    return;
                }
                setQuote(one);
                setState("idle");
            } catch (e) {
                if (gone) return;
                setQuote(null);
                setState(e.code === "plan" ? "plan" : "error");
            }
        })();
        return () => {
            gone = true;
        };
    }, [asked, session]);

    const token = quote?.instrument_token;
    useEffect(() => {
        if (!token) return;
        let gone = false;
        const r = RANGES.find((x) => x.value === range);
        (async () => {
            setCandles(null);
            try {
                const c = await kiteGet(`/kite/candles/${token}?interval=${r.interval}&days=${r.days}`, session.session);
                if (!gone) setCandles(c.candles || []);
            } catch {
                if (!gone) setCandles([]);
            }
        })();
        return () => {
            gone = true;
        };
    }, [token, range, session]);

    const submit = (e) => {
        e.preventDefault();
        const v = input.trim().toUpperCase();
        if (!v) return;
        setAsked(v.includes(":") ? v : `NSE:${v}`);
    };

    const change = quote ? quote.net_change || quote.last_price - (quote.ohlc?.close || quote.last_price) : 0;
    const changePct = quote?.ohlc?.close ? (change / quote.ohlc.close) * 100 : null;

    // not in this plan: a line of fine print under the account, not a section of its own
    if (state === "plan")
        return <p className="kt-fine">Live quotes and charts come with the paid Kite Connect plan: ₹500 a month, covered by Zerodha in a month you pay ₹2,000 or more in brokerage.</p>;

    return (
        <section className="group" aria-labelledby="kt-market">
            <div className="group-head">
                <h2 id="kt-market">Quote and chart</h2>
            </div>
            <div className="kt-market">
                <div className="kt-market-head">
                    <form className="kt-search" onSubmit={submit} role="search">
                        <Search aria-hidden="true" />
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="NSE:INFY"
                            aria-label="Instrument, like NSE:INFY"
                            spellCheck={false}
                            autoCapitalize="characters"
                        />
                        <button type="submit" className="btn btn-sm">
                            Quote
                        </button>
                    </form>
                    <div className="kt-picks">
                        {picks.map((p) => (
                            <button
                                key={p}
                                type="button"
                                className="kt-pick"
                                aria-pressed={asked === p}
                                onClick={() => {
                                    setInput(p);
                                    setAsked(p);
                                }}
                            >
                                {p.split(":")[1]}
                            </button>
                        ))}
                    </div>
                </div>

                {state === "error" ? (
                    <div className="kt-plan">
                        <h3>No quote for {asked}</h3>
                        <p>Check the exchange and symbol, like NSE:INFY, NFO:NIFTY26OCTFUT or MCX:GOLDM26NOVFUT.</p>
                    </div>
                ) : (
                    <div className={`kt-quote${state === "loading" ? " is-loading" : ""}`}>
                        <div className="kt-quote-main">
                            <span className="perf-label">{asked}</span>
                            <span className="kt-ltp">{quote ? num(quote.last_price) : "—"}</span>
                            <span className={`kt-change ${sideOf(change)}`}>
                                {quote ? `${change > 0 ? "+" : change < 0 ? "−" : ""}${num(Math.abs(change))} (${pct(changePct)})` : ""}
                            </span>
                            {quote?.ohlc && (
                                <dl className="kt-ohlc">
                                    {["open", "high", "low", "close"].map((k) => (
                                        <div key={k}>
                                            <dt>{capital(k)}</dt>
                                            <dd>{num(quote.ohlc[k])}</dd>
                                        </div>
                                    ))}
                                    <div>
                                        <dt>Volume</dt>
                                        <dd>{quote.volume ? num(quote.volume, 0) : "—"}</dd>
                                    </div>
                                </dl>
                            )}
                            <Depth depth={quote?.depth} />
                        </div>
                        <div className="kt-chart-wrap">
                            <div className="kt-chart-head">
                                <Seg label="Range" options={RANGES} value={range} onChange={setRange} />
                            </div>
                            <Chart candles={candles} intraday={range === "1W" || range === "1M"} />
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

/** The best five bids and offers, each with a flat bar for its size. */
function Depth({ depth }) {
    if (!depth?.buy?.length) return null;
    const max = Math.max(...depth.buy.map((d) => d.quantity), ...depth.sell.map((d) => d.quantity), 1);
    const side = (rows, kind) =>
        rows.slice(0, 5).map((d, i) => (
            <li key={`${kind}${i}`} className={kind}>
                <span className="kt-depth-bar" style={{ width: `${(d.quantity / max) * 100}%` }} aria-hidden="true" />
                <span>{num(d.price)}</span>
                <span className="muted">{num(d.quantity, 0)}</span>
            </li>
        ));
    return (
        <div className="kt-depth" aria-label="Market depth">
            <ul>
                <li className="kt-depth-head">
                    <span>Bid</span>
                    <span>Qty</span>
                </li>
                {side(depth.buy, "buy")}
            </ul>
            <ul>
                <li className="kt-depth-head">
                    <span>Offer</span>
                    <span>Qty</span>
                </li>
                {side(depth.sell, "sell")}
            </ul>
        </div>
    );
}

/** Closing prices as one line over a dashed start level. Point at it to read a candle. */
function Chart({ candles, intraday }) {
    const [at, setAt] = useState(null);
    const plot = useRef(null);
    if (candles == null) return <div className="kt-chart is-loading" aria-busy="true" />;
    if (candles.length < 2) return <div className="kt-chart kt-chart-empty">No candles for this range.</div>;

    const closes = candles.map((c) => c.c);
    const lo0 = Math.min(...candles.map((c) => c.l));
    const hi0 = Math.max(...candles.map((c) => c.h));
    const pad = (hi0 - lo0) * 0.08 || 1;
    const lo = lo0 - pad;
    const hi = hi0 + pad;
    const n = closes.length - 1;
    const X = (i) => (i / n) * 100;
    const Y = (v) => ((hi - v) / (hi - lo)) * 100;
    const line = closes.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(3)} ${Y(v).toFixed(3)}`).join("");
    const area = `${line}L100 100L0 100Z`;
    const up = closes[n] >= closes[0];
    const point = at == null ? n : at;
    const c = candles[point];
    const when = new Date(c.t);
    const label = intraday
        ? when.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
        : when.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    const move = (e) => {
        const r = plot.current.getBoundingClientRect();
        const x = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
        setAt(Math.round(x * n));
    };
    const fromStart = ((c.c - closes[0]) / closes[0]) * 100;

    return (
        <div className={`kt-chart ${up ? "is-up" : "is-down"}`}>
            <div className="kt-chart-read">
                <b>{num(c.c)}</b>
                <span className={sideOf(fromStart)}>{pct(fromStart)}</span>
                <span className="muted">{label}</span>
                <span className="muted kt-hide-sm">
                    O {num(c.o)} · H {num(c.h)} · L {num(c.l)}
                </span>
            </div>
            <div className="kt-plot" ref={plot} onPointerMove={move} onPointerLeave={() => setAt(null)}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <line className="kt-base" x1="0" x2="100" y1={Y(closes[0])} y2={Y(closes[0])} />
                    <path className="kt-area" d={area} />
                    <path className="kt-line" d={line} />
                    {at != null && <line className="kt-cross" x1={X(at)} x2={X(at)} y1="0" y2="100" />}
                </svg>
                <span className="kt-dot" style={{ left: `${X(point)}%`, top: `${Y(c.c)}%` }} aria-hidden="true" />
                <span className="kt-axis kt-axis-hi">{num(hi0)}</span>
                <span className="kt-axis kt-axis-lo">{num(lo0)}</span>
            </div>
        </div>
    );
}

// ---------- Small parts ----------

/**
 * A table as a card of grid rows. `cols` is the grid shared by the head and every row; on a
 * phone the `hide` columns drop out and `colsSm` takes over. The first `left` columns read
 * left to right, the rest line up on the right.
 */
export function Table({ label, cols, colsSm, hide = [], left = 1, head, rows, rowKey, render }) {
    const cls = (i) => `kt-cell${i >= left ? " kt-r" : ""}${hide.includes(i) ? " kt-hide-sm" : ""}`;
    return (
        <div className="rows-card kt-table" style={{ "--cols": cols, "--cols-sm": colsSm || cols }} role="table" aria-label={label}>
            <div className="kt-row kt-head" role="row">
                {head.map((h, i) => (
                    <span key={h} role="columnheader" className={cls(i)}>
                        {h}
                    </span>
                ))}
            </div>
            <ul className="rows stagger" role="rowgroup">
                {rows.map((r, i) => (
                    <li key={rowKey(r)} className="kt-row" role="row" style={{ "--i": i }}>
                        {render(r).map((cell, j) => (
                            <span key={j} role="cell" className={cls(j)}>
                                {cell}
                            </span>
                        ))}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function Sym({ title, sub }) {
    return (
        <span className="kt-sym">
            <span className="row-title">{title}</span>
            {sub ? <span className="row-sub">{sub}</span> : null}
        </span>
    );
}

export function SideTag({ side }) {
    const buy = String(side).toUpperCase() === "BUY";
    return <span className={`kt-chip ${buy ? "buy" : "sell"}`}>{buy ? "Buy" : "Sell"}</span>;
}

function State({ order }) {
    const s = orderState(order);
    const label = { done: "Done", open: capital(order.status || "Open").replace(/_/g, " "), failed: capital(order.status) }[s];
    return (
        <Chip tone={s} title={order.status_message || undefined}>
            {label}
        </Chip>
    );
}

export function Chip({ tone, title, children }) {
    return (
        <span className={`kt-chip ${tone}`} title={title}>
            {children}
        </span>
    );
}
