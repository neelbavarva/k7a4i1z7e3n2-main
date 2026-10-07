"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Loader2, Plus, Puzzle, Search, Smartphone, X } from "lucide-react";
import Modal from "./k7/Modal";
import { CoinIcon, NetworkIcon, NetworkStack, WalletIcon } from "./k7/CryptoIcons";
import {
    CHAIN_INFO,
    chainOf,
    connectExtension,
    connectPhone,
    deepLink,
    discoverExtensions,
    qrSvg,
    searchCoins,
    searchWallets,
    shortAddress,
    uniqueAddresses,
    walletOf,
    wcProjectId,
} from "@/lib/wallets";

// Adding a crypto wallet, in two steps. Pick the app from a list you can search. Then either
// connect it (extension or phone) so its addresses arrive by themselves, or add coins one at a
// time: search a coin, paste its receive address. Editing opens straight at the second step.
// Only public addresses ever: nothing here asks a wallet to sign anything.

const isPhone = () => typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent);

export { WalletIcon as WalletMark };

export default function AddWallet({ open, onClose, initial, onSave, saving }) {
    return (
        <Modal open={open} onClose={onClose} head={false} label="Add a crypto wallet" className="aw" busy={saving}>
            {open && <Flow initial={initial} onClose={onClose} onSave={onSave} saving={saving} />}
        </Modal>
    );
}

function Flow({ initial, onClose, onSave, saving }) {
    const [walletId, setWalletId] = useState(initial ? initial.kind || "other" : null);
    const [extensions, setExtensions] = useState([]);
    useEffect(() => discoverExtensions((ext) => setExtensions((list) => [...list, ext])), []);
    const extFor = (w) => extensions.find((e) => w.rdns.includes(e.rdns));

    if (!walletId) return <PickWallet extFor={extFor} onPick={setWalletId} onClose={onClose} />;
    return (
        <SetUp
            wallet={walletOf(walletId)}
            ext={extFor(walletOf(walletId))}
            extensions={extensions}
            initial={initial}
            saving={saving}
            onBack={initial ? null : () => setWalletId(null)}
            onClose={onClose}
            onSave={onSave}
        />
    );
}

// ---------- step 1: which wallet ----------

function PickWallet({ extFor, onPick, onClose }) {
    const [q, setQ] = useState("");
    const list = useMemo(() => {
        const found = searchWallets(q);
        // installed ones first, then the order of the list (most used first)
        return [...found].sort((a, b) => Number(!extFor(a)) - Number(!extFor(b)));
    }, [q, extFor]);

    return (
        <div className="aw-in">
            <Head title="Add a crypto wallet" sub="Read only: it sees public addresses, never your keys or recovery phrase." onClose={onClose} />
            <label className="aw-search">
                <Search aria-hidden="true" />
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && list[0] && onPick(list[0].id)}
                    placeholder="Search wallets"
                    aria-label="Search wallets"
                    autoFocus
                    data-own-escape={q ? "" : undefined}
                />
            </label>
            <ul className="aw-list" role="listbox" aria-label="Wallets">
                {list.map((w, i) => {
                    const ext = extFor(w);
                    return (
                        <li key={w.id} style={{ "--i": i }}>
                            <button type="button" className="aw-row" onClick={() => onPick(w.id)}>
                                <WalletIcon id={w.id} icon={ext?.icon} size={38} />
                                <span className="aw-row-text">
                                    <b>{w.name}</b>
                                    {ext ? <small className="aw-on">Installed in this browser</small> : <small>{w.chains.map((c) => CHAIN_INFO[c].name.replace(" and EVM", "")).join(" · ")}</small>}
                                </span>
                                <span className="aw-row-nets">
                                    <NetworkStack networks={w.chains.map((c) => CHAIN_INFO[c].networks[0])} size={16} />
                                </span>
                                <ChevronRight className="aw-go" aria-hidden="true" />
                            </button>
                        </li>
                    );
                })}
                {!list.length && (
                    <li className="aw-empty">
                        No wallet called “{q}”.{" "}
                        <button type="button" className="linkish" onClick={() => onPick("other")}>
                            Add it as another wallet
                        </button>
                    </li>
                )}
            </ul>
        </div>
    );
}

function Head({ title, sub, onBack, onClose, children }) {
    return (
        <div className="aw-head">
            {onBack && (
                <button type="button" className="btn btn-ghost btn-icon" onClick={onBack} aria-label="Back">
                    <ArrowLeft />
                </button>
            )}
            {children || (
                <div className="aw-title">
                    <h2>{title}</h2>
                    {sub && <p>{sub}</p>}
                </div>
            )}
            <button type="button" className="btn btn-ghost btn-icon aw-close" onClick={onClose} aria-label="Close">
                <X />
            </button>
        </div>
    );
}

// ---------- step 2: its coins ----------

function SetUp({ wallet, ext, extensions, initial, saving, onBack, onClose, onSave }) {
    const [name, setName] = useState(initial?.name || wallet.name);
    const [addresses, setAddresses] = useState(initial ? initial.addresses.map((a) => ({ address: a.address, chain: a.chain })) : []);
    const [adding, setAdding] = useState(!initial);
    const exts = ext ? [ext] : wallet.id === "other" ? extensions : [];

    const got = (list) => {
        setAddresses((cur) => uniqueAddresses([...cur, ...list].map((a) => a.address)).filter((a) => a.chain));
        setAdding(false);
    };
    const covered = new Map(addresses.map((a) => [a.chain, a.address]));

    return (
        <div className="aw-in">
            <Head onBack={onBack} onClose={onClose}>
                <div className="aw-ident">
                    <WalletIcon id={wallet.id} icon={ext?.icon} size={46} />
                    <div className="aw-ident-text">
                        <input className="aw-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Wallet name" />
                        <p>{initial ? "Edit its coins and name" : "Add its coins: connect it, or paste a receive address"}</p>
                    </div>
                </div>
            </Head>

            {(exts.length > 0 || (wallet.phone && wcProjectId)) && <Connect wallet={wallet} exts={exts} onGot={got} />}

            <section className="aw-coins">
                <div className="aw-coins-head">
                    <h3>Coins</h3>
                    <span className="count">{addresses.length ? `${addresses.length} ${addresses.length === 1 ? "address" : "addresses"}` : ""}</span>
                </div>
                {addresses.length > 0 ? (
                    <ul className="aw-addrs">
                        {addresses.map((a) => {
                            const info = CHAIN_INFO[a.chain];
                            return (
                                <li key={a.address}>
                                    <CoinIcon token={info.token} size={34} />
                                    <span className="aw-addr-text">
                                        <b>{info.name}</b>
                                        <small>
                                            {a.chain === "evm" && <NetworkStack networks={info.networks} size={14} />}
                                            {info.coins}
                                        </small>
                                    </span>
                                    <span className="nw-mono aw-addr-short" title={a.address}>
                                        {shortAddress(a.address)}
                                    </span>
                                    <button type="button" className="aw-x" onClick={() => setAddresses((list) => list.filter((x) => x.address !== a.address))} aria-label={`Remove ${a.address}`}>
                                        <X />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    !adding && <p className="aw-none">No coins yet.</p>
                )}

                {adding ? (
                    <CoinPicker covered={covered} onAdd={(a) => got([a])} onCancel={addresses.length ? () => setAdding(false) : null} />
                ) : (
                    <button type="button" className="aw-add" onClick={() => setAdding(true)}>
                        <Plus aria-hidden="true" />
                        Add a coin
                    </button>
                )}
            </section>

            <div className="aw-foot">
                <span className="muted">Public addresses only. Nothing is ever signed.</span>
                <button type="button" className="btn btn-primary" onClick={() => onSave({ name: name.trim() || wallet.name, kind: wallet.id, addresses: addresses.map((a) => a.address) })} disabled={saving || !addresses.length}>
                    {saving ? <Loader2 className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                    {initial ? "Save" : "Add wallet"}
                </button>
            </div>
        </div>
    );
}

/** The quick way: an installed extension shares its addresses, or the phone does over WalletConnect. */
function Connect({ wallet, exts, onGot }) {
    const [busy, setBusy] = useState("");
    const [problem, setProblem] = useState("");
    const [qr, setQr] = useState(null); // { svg, uri } while waiting for the phone
    const run = useRef(null);
    useEffect(() => () => run.current?.cancel(), []);

    const fromExtension = async (e) => {
        setBusy(e.uuid);
        setProblem("");
        const { addresses, problems } = await connectExtension(e, wallet.id);
        setBusy("");
        if (addresses.length) onGot(addresses);
        else setProblem(problems.join(" · ") || "The extension didn’t share any addresses.");
    };

    const fromPhone = async () => {
        if (qr) {
            run.current?.cancel();
            setQr(null);
            return;
        }
        setProblem("");
        setQr({ svg: "", uri: "" });
        const r = connectPhone({
            onUri: async (uri) => {
                setQr({ uri, svg: await qrSvg(uri) });
                if (isPhone()) window.location.href = deepLink(wallet.id, uri);
            },
        });
        run.current = r;
        try {
            const { addresses } = await r.done;
            setQr(null);
            if (addresses.length) onGot(addresses);
            else setProblem("The wallet connected but shared no addresses.");
        } catch (err) {
            if (String(err?.message) === "cancelled") return;
            setQr(null);
            setProblem(/reject/i.test(String(err?.message)) ? "Declined in the app." : err?.message || "It didn’t connect.");
        }
    };

    return (
        <section className="aw-connect">
            <div className="aw-connect-row">
                <span className="aw-connect-text">
                    <b>Connect</b>
                    <small>The addresses come in by themselves. Read only.</small>
                </span>
                <div className="aw-connect-actions">
                    {exts.map((e) => (
                        <button key={e.uuid} type="button" className="btn" onClick={() => fromExtension(e)} disabled={Boolean(busy)}>
                            {busy === e.uuid ? <Loader2 className="spin" aria-hidden="true" /> : <Puzzle aria-hidden="true" />}
                            {exts.length > 1 ? e.name : "Extension"}
                        </button>
                    ))}
                    {wallet.phone && wcProjectId && (
                        <button type="button" className={`btn${qr ? " btn-toggle" : ""}`} aria-pressed={Boolean(qr)} onClick={fromPhone}>
                            <Smartphone aria-hidden="true" />
                            {qr ? "Cancel" : "Phone"}
                        </button>
                    )}
                </div>
            </div>
            {problem && <p className="aw-problem">{problem}</p>}
            {qr && (
                <div className="aw-qr">
                    {qr.svg ? <span className="aw-qr-code" dangerouslySetInnerHTML={{ __html: qr.svg }} /> : <Loader2 className="spin" aria-label="Making the code" />}
                    <p>
                        Open {wallet.name}, scan this (Settings → WalletConnect), and approve. It only shares addresses.
                        {qr.uri && isPhone() && (
                            <>
                                {" "}
                                <a href={deepLink(wallet.id, qr.uri)}>Open {wallet.name}</a>
                            </>
                        )}
                    </p>
                </div>
            )}
        </section>
    );
}

/** Search a coin, then paste its receive address; an address already there covers its whole chain. */
function CoinPicker({ covered, onAdd, onCancel }) {
    const [q, setQ] = useState("");
    const [coin, setCoin] = useState(null);
    const [address, setAddress] = useState("");
    const list = useMemo(() => searchCoins(q), [q]);
    const input = useRef(null);

    useEffect(() => {
        if (coin) input.current?.focus();
    }, [coin]);

    if (coin) {
        const info = CHAIN_INFO[coin.chain];
        const have = covered.get(coin.chain);
        const chain = chainOf(address);
        const ok = chain === coin.chain;
        const wrong = address.trim() && !ok;
        const add = () => ok && onAdd({ address: address.trim(), chain });
        return (
            <div className="aw-picker">
                <div className="aw-coin-chosen">
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setCoin(null)} aria-label="Pick another coin">
                        <ArrowLeft />
                    </button>
                    <CoinIcon token={coin.token} network={coin.network} size={30} />
                    <span className="aw-row-text">
                        <b>
                            {coin.symbol} <span className="muted">{coin.net || coin.name}</span>
                        </b>
                        <small>{have ? "Already read through this wallet’s address" : `Paste your ${coin.symbol} receive address`}</small>
                    </span>
                </div>
                {have ? (
                    <div className="aw-covered">
                        <Check aria-hidden="true" />
                        <span>
                            Covered by <span className="nw-mono">{shortAddress(have)}</span>, which also reads {info.coins}.
                        </span>
                        <button type="button" className="btn btn-sm" onClick={() => setCoin(null)}>
                            Done
                        </button>
                    </div>
                ) : (
                    <>
                        <div className={`aw-address${ok ? " is-ok" : wrong ? " is-bad" : ""}`}>
                            <input
                                ref={input}
                                className="nw-mono"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
                                placeholder={`${coin.symbol} address (${info.example})`}
                                spellCheck={false}
                                autoComplete="off"
                                aria-label={`${coin.symbol} address`}
                            />
                            {ok && <Check className="aw-address-ok" aria-hidden="true" />}
                            <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={!ok}>
                                Add
                            </button>
                        </div>
                        <p className={`aw-hint${wrong ? " is-bad" : ""}`}>
                            {wrong
                                ? `That isn’t a ${info.name.replace(" and EVM", "")} address: it ${info.hint}.`
                                : ok
                                  ? `Good. It also reads ${info.coins}${coin.chain === "evm" ? " on all six networks" : ""}.`
                                  : `In the wallet app: ${coin.symbol} → Receive → copy.${coin.chain === "evm" ? " One 0x address covers every EVM coin." : ""}`}
                        </p>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="aw-picker">
            <div className="aw-picker-head">
                <label className="aw-search">
                    <Search aria-hidden="true" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && list[0] && setCoin(list[0])}
                        placeholder="Search coins: BTC, USDT TRC20, SOL…"
                        aria-label="Search coins"
                        autoFocus
                        data-own-escape={q ? "" : undefined}
                    />
                </label>
                {onCancel && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
                        Cancel
                    </button>
                )}
            </div>
            <ul className="aw-list aw-coin-list" role="listbox" aria-label="Coins">
                {list.map((c, i) => {
                    const have = covered.has(c.chain);
                    return (
                        <li key={c.id} style={{ "--i": i }}>
                            <button type="button" className="aw-row" onClick={() => setCoin(c)}>
                                <CoinIcon token={c.token} network={c.network} size={32} />
                                <span className="aw-row-text">
                                    <b>{c.symbol}</b>
                                    <small>
                                        {c.name}
                                        {c.net ? (
                                            <>
                                                {" · "}
                                                <NetworkIcon network={c.network} size={12} /> {c.net}
                                            </>
                                        ) : null}
                                    </small>
                                </span>
                                {have ? <span className="aw-pill">Covered</span> : <ChevronRight className="aw-go" aria-hidden="true" />}
                            </button>
                        </li>
                    );
                })}
                {!list.length && <li className="aw-empty">No coin like “{q}” yet. This reads Bitcoin, the EVM chains, Tron and Solana.</li>}
            </ul>
        </div>
    );
}
