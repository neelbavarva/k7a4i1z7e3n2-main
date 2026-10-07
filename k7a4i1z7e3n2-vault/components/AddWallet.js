"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Clipboard, Loader2, Plus, Puzzle, ScanLine, Smartphone, X } from "lucide-react";
import Modal from "./k7/Modal";
import {
    CHAIN_LONG,
    CHAIN_SHORT,
    WALLETS,
    connectExtension,
    connectPhone,
    deepLink,
    discoverExtensions,
    parseAddresses,
    qrSvg,
    shortAddress,
    uniqueAddresses,
    walletOf,
    wcProjectId,
} from "@/lib/wallets";

// Adding a crypto wallet: pick the app, connect it (extension or phone) so its public addresses
// arrive by themselves, check them, name it, save. Pasting addresses is there as a fallback.
// Editing opens straight at the last step.

/** A wallet's mark: the extension's own icon when it's installed, else its initial on a flat tint. */
export function WalletMark({ id, icon, size = 40 }) {
    const w = walletOf(id);
    return (
        <span className="wm" style={{ "--wc": w.color, "--ws": `${size}px` }} aria-hidden="true">
            {/* the extension's own icon, a data URL it hands over: nothing for next/image to optimise */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {icon ? <img src={icon} alt="" /> : <span>{w.name.slice(0, 1)}</span>}
        </span>
    );
}

const isPhone = () => typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent);

export default function AddWallet({ open, onClose, initial, onSave, saving }) {
    return (
        <Modal open={open} onClose={onClose} wide head={false} label="Add a crypto wallet" className="aw" busy={saving}>
            {open && <Flow initial={initial} onClose={onClose} onSave={onSave} saving={saving} />}
        </Modal>
    );
}

function Flow({ initial, onClose, onSave, saving }) {
    const [step, setStep] = useState(initial ? "review" : "pick");
    const [walletId, setWalletId] = useState(initial?.kind || "trust");
    const [extensions, setExtensions] = useState([]);
    const [found, setFound] = useState(initial ? initial.addresses.map((a) => ({ address: a.address, chain: a.chain })) : []);
    const [name, setName] = useState(initial?.name || "");
    const wallet = walletOf(walletId);

    useEffect(() => discoverExtensions((ext) => setExtensions((list) => [...list, ext])), []);
    const extFor = (w) => extensions.find((e) => w.rdns.includes(e.rdns));

    const pick = (id) => {
        setWalletId(id);
        setName((n) => n || walletOf(id).name);
        setStep("connect");
    };
    const got = (addresses) => {
        setFound((list) => uniqueAddresses([...list, ...addresses].map((a) => a.address)));
        setStep("review");
    };

    return (
        <div className="aw-in">
            <div className="aw-head">
                {step !== "pick" && !initial ? (
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => setStep(step === "review" ? "connect" : "pick")} aria-label="Back">
                        <ArrowLeft />
                    </button>
                ) : null}
                <div className="aw-title">
                    <h2>{initial ? `Edit ${initial.name}` : step === "pick" ? "Add a crypto wallet" : wallet.name}</h2>
                    <p>{step === "pick" ? "Read only: it sees public addresses, never your keys or recovery phrase." : step === "connect" ? "Connect it and its addresses come in by themselves." : "Check the addresses and give it a name."}</p>
                </div>
                <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
                    <X />
                </button>
            </div>

            {step === "pick" && (
                <ul className="aw-grid">
                    {WALLETS.map((w, i) => {
                        const ext = extFor(w);
                        return (
                            <li key={w.id} style={{ "--i": i }}>
                                <button type="button" className="aw-wallet" onClick={() => pick(w.id)}>
                                    <WalletMark id={w.id} icon={ext?.icon} />
                                    <span className="aw-wallet-name">{w.name}</span>
                                    <span className={`aw-wallet-sub${ext ? " is-on" : ""}`}>{ext ? "Installed here" : w.chains.map((c) => CHAIN_SHORT[c]).join(" · ")}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {step === "connect" && <Connect wallet={wallet} ext={extFor(wallet)} extensions={extensions} onGot={got} onPaste={() => setStep("review")} />}

            {step === "review" && (
                <Review
                    wallet={wallet}
                    name={name}
                    setName={setName}
                    found={found}
                    setFound={setFound}
                    saving={saving}
                    editing={Boolean(initial)}
                    onSave={() => onSave({ name: name.trim() || wallet.name, kind: wallet.id, addresses: found.map((a) => a.address) })}
                />
            )}
        </div>
    );
}

function Connect({ wallet, ext, extensions, onGot, onPaste }) {
    const [state, setState] = useState("idle"); // idle | ext | phone
    const [problem, setProblem] = useState("");
    // "Another wallet": any extension that's installed will do
    const exts = ext ? [ext] : wallet.id === "other" ? extensions : [];

    const fromExtension = async (e) => {
        setState("ext");
        setProblem("");
        const { addresses, problems } = await connectExtension(e, wallet.id);
        setState("idle");
        if (addresses.length) onGot(addresses);
        else setProblem(problems.join(" · ") || "The extension didn’t share any addresses.");
    };

    return (
        <div className="aw-ways">
            <div className={`aw-way${exts.length ? "" : " is-off"}`}>
                <span className="aw-way-icon">
                    <Puzzle aria-hidden="true" />
                </span>
                <div className="aw-way-text">
                    <h3>Browser extension</h3>
                    <p>{exts.length ? "One click: it shares its public addresses. Nothing to sign." : `${wallet.name} isn’t installed in this browser.`}</p>
                    {problem && <p className="aw-problem">{problem}</p>}
                </div>
                {exts.map((e) => (
                    <button key={e.uuid} type="button" className="btn btn-primary" onClick={() => fromExtension(e)} disabled={state === "ext"}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {state === "ext" ? <Loader2 className="spin" aria-hidden="true" /> : e.icon ? <img className="aw-ext-icon" src={e.icon} alt="" /> : null}
                        Connect {exts.length > 1 ? e.name : ""}
                    </button>
                ))}
            </div>

            {wallet.phone && <Phone wallet={wallet} onGot={onGot} />}

            <button type="button" className="aw-paste-link" onClick={onPaste}>
                <Clipboard aria-hidden="true" />
                Paste addresses instead
            </button>
        </div>
    );
}

/** Scan with the phone: a WalletConnect QR that only asks to see accounts. */
function Phone({ wallet, onGot }) {
    const [state, setState] = useState("idle"); // idle | waiting | error
    const [svg, setSvg] = useState("");
    const [uri, setUri] = useState("");
    const [error, setError] = useState("");
    const run = useRef(null);

    useEffect(() => () => run.current?.cancel(), []);

    const start = async () => {
        setState("waiting");
        setError("");
        setSvg("");
        const r = connectPhone({
            onUri: async (u) => {
                setUri(u);
                setSvg(await qrSvg(u));
                if (isPhone()) window.location.href = deepLink(wallet.id, u);
            },
        });
        run.current = r;
        try {
            const { addresses } = await r.done;
            if (addresses.length) onGot(addresses);
            else {
                setState("error");
                setError("The wallet connected but shared no addresses.");
            }
        } catch (err) {
            if (String(err?.message) === "cancelled") return;
            setState("error");
            setError(/reject/i.test(String(err?.message)) ? "Declined in the app." : err?.message || "It didn’t connect.");
        }
    };

    if (!wcProjectId)
        return (
            <div className="aw-way is-off">
                <span className="aw-way-icon">
                    <Smartphone aria-hidden="true" />
                </span>
                <div className="aw-way-text">
                    <h3>Scan with your phone</h3>
                    <p>
                        Needs a free WalletConnect project ID: add <code>NEXT_PUBLIC_WC_PROJECT_ID</code> to the vault on Vercel.
                    </p>
                </div>
            </div>
        );

    return (
        <div className={`aw-way aw-phone${state === "waiting" ? " is-waiting" : ""}`}>
            <span className="aw-way-icon">
                <Smartphone aria-hidden="true" />
            </span>
            <div className="aw-way-text">
                <h3>Scan with your phone</h3>
                <p>
                    {state === "waiting"
                        ? `Open ${wallet.name} → scan (or Settings → WalletConnect), then approve. It only shares addresses.`
                        : `Connect ${wallet.name} on your phone over WalletConnect. Read only.`}
                </p>
                {state === "error" && <p className="aw-problem">{error}</p>}
            </div>
            {state === "waiting" ? (
                <div className="aw-qr">
                    {svg ? <span className="aw-qr-code" dangerouslySetInnerHTML={{ __html: svg }} /> : <Loader2 className="spin" aria-label="Making the code" />}
                    {uri && isPhone() && (
                        <a className="btn btn-sm" href={deepLink(wallet.id, uri)}>
                            Open {wallet.name}
                        </a>
                    )}
                </div>
            ) : (
                <button type="button" className="btn" onClick={start}>
                    <ScanLine aria-hidden="true" />
                    Show code
                </button>
            )}
        </div>
    );
}

function Review({ wallet, name, setName, found, setFound, saving, editing, onSave }) {
    const [text, setText] = useState("");
    const parsed = parseAddresses(text);
    const bad = parsed.filter((a) => !a.chain);
    const add = () => {
        if (!parsed.length || bad.length) return;
        setFound((list) => uniqueAddresses([...list, ...parsed].map((a) => a.address)));
        setText("");
    };
    const have = new Set(found.map((a) => a.chain));
    const missing = wallet.chains.filter((c) => !have.has(c));

    return (
        <div className="aw-review">
            <div className="field">
                <label htmlFor="aw-name">Name</label>
                <div className="aw-name">
                    <WalletMark id={wallet.id} size={34} />
                    <input id="aw-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={wallet.name} maxLength={40} />
                </div>
            </div>

            <div className="field">
                <span className="field-label">Addresses</span>
                {found.length ? (
                    <ul className="aw-addrs">
                        {found.map((a) => (
                            <li key={a.address} title={`${a.address}\n${CHAIN_LONG[a.chain]}`}>
                                <span className="aw-chain">{CHAIN_SHORT[a.chain]}</span>
                                <span className="nw-mono">{shortAddress(a.address)}</span>
                                <button type="button" className="aw-x" onClick={() => setFound((list) => list.filter((x) => x.address !== a.address))} aria-label={`Remove ${a.address}`}>
                                    <X />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="aw-none">No addresses yet. Paste one below.</p>
                )}
            </div>

            <div className="field">
                <label htmlFor="aw-more">{found.length ? "Add more" : "Paste addresses"}</label>
                <div className="aw-more">
                    <input
                        id="aw-more"
                        className="input nw-mono"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
                        placeholder={missing.length ? `${missing.map((c) => CHAIN_SHORT[c]).join(", ")} address` : "Another address"}
                        spellCheck={false}
                        autoComplete="off"
                        autoFocus={!found.length}
                    />
                    <button type="button" className="btn" onClick={add} disabled={!parsed.length || bad.length > 0}>
                        <Plus aria-hidden="true" />
                        Add
                    </button>
                </div>
                <span className={`field-hint${bad.length ? " aw-bad" : ""}`}>
                    {bad.length
                        ? "That isn’t a Bitcoin, EVM, Tron or Solana address."
                        : missing.length && found.length
                          ? `Holding ${missing.map((c) => CHAIN_SHORT[c]).join(" or ")} too? In the app: the coin → Receive → copy, and paste it here.`
                          : "One 0x address covers Ethereum, BNB Chain, Polygon, Arbitrum, Base and Optimism."}
                </span>
            </div>

            <div className="aw-foot">
                <span className="muted">Public addresses only. The vault never asks for keys.</span>
                <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving || !found.length}>
                    {saving ? <Loader2 className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                    {editing ? "Save" : "Add wallet"}
                </button>
            </div>
        </div>
    );
}
