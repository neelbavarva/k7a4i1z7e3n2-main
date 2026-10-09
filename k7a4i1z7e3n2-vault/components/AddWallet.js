"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Loader2, Plus, Puzzle, Search, Smartphone, X } from "lucide-react";
import Modal from "./k7/Modal";
import { CoinIcon, NetworkIcon, NetworkStack, WalletIcon } from "./k7/CryptoIcons";
import {
    CHAIN_INFO,
    WALLETS,
    chainOf,
    connectExtension,
    connectInWindow,
    connectPhone,
    deepLink,
    discoverExtensions,
    isFramed,
    qrSvg,
    searchCoins,
    searchWallets,
    shortAddress,
    uniqueAddresses,
    walletOf,
    wcProjectId,
} from "@/lib/wallets";

// Adding a crypto wallet, laid out like the vault's add-card form: the wallet's card fills in at
// the top as you go; under it, the wallet app (four tiles and a search of the rest, like the bank
// picker), a quick connect where the app allows it, and the coins (search one, paste its receive
// address). It's named for its app. Only public addresses ever: nothing here asks a wallet to sign anything.

const isPhone = () => typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent);

export { WalletIcon as WalletMark };

export default function AddWallet({ open, onClose, initial, onSave, saving }) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            busy={saving}
            title={initial ? `Edit ${initial.name}` : "Add a crypto wallet"}
            sub="Read only: it sees public addresses, never your keys or recovery phrase."
            className="manage aw"
        >
            <div className="modal-body">{open && <WalletForm initial={initial} onSave={onSave} saving={saving} />}</div>
        </Modal>
    );
}

function WalletForm({ initial, onSave, saving }) {
    const [walletId, setWalletId] = useState(initial?.kind || "trust");
    const [extensions, setExtensions] = useState([]);
    const [addresses, setAddresses] = useState(initial ? initial.addresses.map((a) => ({ address: a.address, chain: a.chain })) : []);
    const [adding, setAdding] = useState(!initial);
    useEffect(() => discoverExtensions((ext) => setExtensions((list) => [...list, ext])), []);

    const wallet = walletOf(walletId);
    const extFor = (w) => extensions.find((e) => w.rdns.includes(e.rdns));
    const ext = extFor(wallet);
    const exts = ext ? [ext] : wallet.id === "other" ? extensions : [];
    const covered = new Map(addresses.map((a) => [a.chain, a.address]));
    const got = (list) => {
        setAddresses((cur) => uniqueAddresses([...cur, ...list].map((a) => a.address)).filter((a) => a.chain));
        setAdding(false);
    };
    // named for its app; one saved under a name of its own keeps it while it stays that app
    const title = initial && initial.kind === walletId ? initial.name : wallet.name;
    const coins = addresses.flatMap((a) => CHAIN_INFO[a.chain].coins.split(", "));

    const submit = (e) => {
        e.preventDefault();
        if (addresses.length) onSave({ name: title, kind: wallet.id, addresses: addresses.map((a) => a.address) });
    };

    return (
        <form className="form" onSubmit={submit}>
            <div className="bal-preview" aria-hidden="true">
                <WalletIcon id={wallet.id} icon={ext?.icon} size={44} />
                <span className="bal-preview-text">
                    <b>{title}</b>
                    <small>{coins.length ? [...new Set(coins)].slice(0, 6).join(" · ") : "Add its coins below"}</small>
                </span>
                {addresses.length > 0 && (
                    <span className="acc-coins">
                        {addresses.slice(0, 4).map((a) => (
                            <CoinIcon key={a.address} token={CHAIN_INFO[a.chain].token} size={24} />
                        ))}
                    </span>
                )}
            </div>

            <div className="field">
                <span className="field-label">Wallet</span>
                <WalletPicker value={walletId} onChange={setWalletId} extFor={extFor} />
            </div>

            {(exts.length > 0 || (wallet.phone && wcProjectId)) && <Connect wallet={wallet} exts={exts} onGot={got} />}

            <div className="field">
                <span className="field-label">
                    Coins{addresses.length ? <span className="field-note">{`${addresses.length} ${addresses.length === 1 ? "address" : "addresses"}`}</span> : null}
                </span>
                {addresses.length > 0 && (
                    <ul className="aw-addrs">
                        {addresses.map((a) => {
                            const info = CHAIN_INFO[a.chain];
                            return (
                                <li key={a.address}>
                                    <CoinIcon token={info.token} size={32} />
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
                )}
                {adding ? (
                    <CoinPicker covered={covered} onAdd={(a) => got([a])} onCancel={addresses.length ? () => setAdding(false) : null} />
                ) : (
                    <button type="button" className="aw-add" onClick={() => setAdding(true)}>
                        <Plus aria-hidden="true" />
                        Add a coin
                    </button>
                )}
            </div>

            <hr className="rule form-rule" />
            <button type="submit" className="btn btn-primary btn-block" disabled={saving || !addresses.length}>
                {saving ? <Loader2 className="spin" aria-hidden="true" /> : null}
                {initial ? "Save wallet" : addresses.length ? "Add wallet" : "Add a coin to continue"}
            </button>
        </form>
    );
}

const TILES = ["trust", "metamask", "phantom", "coinbase"];

/** The wallet app: four tiles, and the rest behind a search, the way the bank picker works. */
function WalletPicker({ value, onChange, extFor }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [active, setActive] = useState(0);
    const wrap = useRef(null);
    // installed ones lead the tiles
    const installed = WALLETS.filter((w) => extFor(w)).map((w) => w.id);
    const tiles = [...new Set([...installed, ...TILES])].slice(0, 4);
    const fromMore = !tiles.includes(value);
    const list = useMemo(() => searchWallets(q), [q]);

    useEffect(() => {
        if (!open) return;
        const away = (e) => !wrap.current?.contains(e.target) && setOpen(false);
        document.addEventListener("pointerdown", away);
        return () => document.removeEventListener("pointerdown", away);
    }, [open]);

    const choose = (id) => {
        if (!id) return;
        onChange(id);
        setOpen(false);
        setQ("");
        setActive(0);
    };
    const onKey = (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.min(list.length - 1, Math.max(0, a + (e.key === "ArrowDown" ? 1 : -1))));
        } else if (e.key === "Enter") {
            e.preventDefault();
            choose(list[active]?.id);
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    };
    const more = walletOf(value);

    return (
        <div className="bank-picker" ref={wrap}>
            <div className="bank-tiles" role="group" aria-label="Wallet">
                {tiles.map((id) => {
                    const w = walletOf(id);
                    return (
                        <button key={id} type="button" aria-pressed={value === id} className="bank-option" onClick={() => choose(id)} title={extFor(w) ? `${w.name}: installed here` : w.name}>
                            <WalletIcon id={id} icon={extFor(w)?.icon} size={26} />
                            <span className="bank-option-label">{w.name.replace(" Wallet", "")}</span>
                        </button>
                    );
                })}
                <button type="button" aria-pressed={fromMore} aria-expanded={open} className={`bank-option is-more${open ? " is-open" : ""}`} onClick={() => setOpen((o) => !o)}>
                    {fromMore ? (
                        <WalletIcon id={value} size={26} />
                    ) : (
                        <span className="bank-more-icon" aria-hidden="true">
                            <Search />
                        </span>
                    )}
                    <span className="bank-option-label">{fromMore ? more.name.replace(" Wallet", "") : `${WALLETS.length - tiles.length} more`}</span>
                </button>
            </div>
            {open && (
                <div className="bank-browser pop-down" data-own-escape>
                    <div className="bank-search">
                        <Search aria-hidden="true" />
                        <input autoFocus value={q} onChange={(e) => (setQ(e.target.value), setActive(0))} onKeyDown={onKey} placeholder={`Search ${WALLETS.length} wallets`} aria-label="Search wallets" autoComplete="off" spellCheck="false" />
                        <kbd aria-hidden="true">esc</kbd>
                    </div>
                    <div className="bank-list" role="listbox" aria-label="Wallets">
                        <div className="bank-items is-results">
                            {list.map((w, i) => (
                                <div
                                    key={w.id}
                                    role="option"
                                    aria-selected={i === active}
                                    className={`bank-item${i === active ? " is-active" : ""}`}
                                    onPointerMove={() => setActive(i)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => choose(w.id)}
                                >
                                    <WalletIcon id={w.id} icon={extFor(w)?.icon} size={24} />
                                    <span className="bank-item-name">{w.name}</span>
                                    <span className="bank-item-group">{extFor(w) ? "Installed" : w.chains.map((c) => CHAIN_INFO[c].name.replace(" and EVM", "")).join(", ")}</span>
                                    {value === w.id && <Check className="bank-item-check" aria-hidden="true" />}
                                </div>
                            ))}
                            {!list.length && (
                                <div className="bank-item is-custom" onClick={() => choose("other")} role="option" aria-selected="false">
                                    <span className="bank-add" aria-hidden="true">
                                        <Plus />
                                    </span>
                                    <span className="bank-item-name">
                                        Use another wallet for “<b>{q}</b>”
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <p className="bank-foot">↑ ↓ to move, Enter to pick. Not listed? Pick “Another wallet”.</p>
                </div>
            )}
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
        // in the split view's frame the extension won't connect: a window of the vault's own does it
        const { addresses, problems } = isFramed() ? await connectInWindow(wallet.id, e.rdns) : await connectExtension(e, wallet.id);
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
