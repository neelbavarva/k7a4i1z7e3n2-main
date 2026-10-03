"use client";

import React, { useState } from "react";
import { ChevronRight, Copy, KeyRound, RefreshCw, ShieldAlert, ShieldCheck, Vault } from "lucide-react";
import { http } from "@/lib/http";
import Modal from "./k7/Modal";
import Seg from "./k7/Seg";
import SecretInput from "./k7/SecretInput";
import ServiceIcon from "./k7/ServiceIcon";

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const times = (n) => (n === 1 ? "once" : `${compact.format(n)} times`);
const catKey = (v) => (["web-app", "email", "banking"].includes(v) ? v : "other");

/** How bad a breach count is: seen a handful of times, or everywhere. */
const severity = (n) => (n >= 10000 ? "high" : n >= 100 ? "medium" : "low");

const MODES = [
    { value: "vault", label: "My vault", icon: <Vault aria-hidden="true" /> },
    { value: "any", label: "Any password", icon: <KeyRound aria-hidden="true" /> },
];

/**
 * Breach count for one password, checked entirely in this browser: SHA-1 with Web Crypto,
 * then Have I Been Pwned's range API with only the first 5 hex characters (k-anonymity).
 * The password never leaves the page, not even to our own server.
 */
async function pwnedCount(password) {
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, { headers: { "Add-Padding": "true" } });
    if (!res.ok) throw new Error(`HIBP ${res.status}`);
    for (const line of (await res.text()).split("\n")) {
        const [suffix, count] = line.trim().split(":");
        if (suffix === hash.slice(5)) return parseInt(count, 10) || 0; // padded rows have count 0
    }
    return 0;
}

/**
 * Compromised password check. The server decrypts every password with the key (an
 * entry under a different key is skipped, never counted as a failed attempt), hashes
 * it and asks Have I Been Pwned using only the first 5 characters of the hash.
 * Plaintext never leaves the server; this page only ever sees names and counts.
 */
export default function BreachCheck({ open, onClose, total, onOpenPassword }) {
    const [key, setKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [report, setReport] = useState(null);
    const [mode, setMode] = useState("vault");

    const run = async (e) => {
        e?.preventDefault();
        if (!key.trim() || loading) return;
        try {
            setLoading(true);
            setError(null);
            setReport(await http("/passwords/breachCheck", { method: "POST", body: { key: key.trim() } }));
        } catch (err) {
            console.error(err);
            setError(
                err?.status === 429
                    ? "Checked a moment ago. Wait a minute and try again."
                    : err?.status === 404
                      ? "The server doesn’t have the breach check yet. Deploy the latest API first."
                      : `The check didn’t finish${err?.status ? ` (${err.status})` : ""}. Try again.`
            );
        } finally {
            setLoading(false);
        }
    };

    const close = () => {
        onClose();
        // forget the key and results once the dialog has animated out
        setTimeout(() => {
            setKey("");
            setReport(null);
            setError(null);
            setMode("vault");
        }, 250);
    };

    return (
        <Modal
            open={open}
            onClose={close}
            wide
            className="breach"
            icon={
                <span className="breach-mark" aria-hidden="true">
                    <ShieldAlert />
                </span>
            }
            title="Breach check"
            sub={
                mode === "any"
                    ? "Check any password against public data breaches, without saving it."
                    : "Find saved passwords that have appeared in public data breaches, and ones you’ve used more than once."
            }
        >
            <div className="modal-body">
                <Seg wide label="What to check" options={MODES} value={mode} onChange={setMode} />
                {mode === "any" ? (
                    <QuickCheck key="any" />
                ) : report ? (
                    <Report report={report} onOpenPassword={onOpenPassword} onAgain={() => setReport(null)} />
                ) : (
                    <form className="form" onSubmit={run}>
                        <ol className="breach-how">
                            <li>
                                <b>Decrypted on the server</b> with your key, the same way Change key does. Passwords under a different
                                key are skipped and never count as a wrong attempt.
                            </li>
                            <li>
                                <b>Only a fingerprint is shared.</b> Each password is hashed (SHA-1) and just the first 5 of its 40
                                characters go to Have I Been Pwned. The match is made on the server.
                            </li>
                            <li>
                                <b>Nothing is revealed here.</b> You get names and breach counts, never the passwords.
                            </li>
                        </ol>
                        <div className="field">
                            <label htmlFor="breach-key">Decryption key</label>
                            <SecretInput id="breach-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="The key your passwords use" autoFocus />
                        </div>
                        {error && <p className="form-error">{error}</p>}
                        <button type="submit" className={`btn btn-primary btn-block${loading ? " is-busy" : ""}`} disabled={loading || !key.trim()}>
                            <ShieldCheck aria-hidden="true" />
                            {loading ? `Checking ${total} passwords…` : `Check ${total} password${total === 1 ? "" : "s"}`}
                        </button>
                        {loading && (
                            <p className="small muted" aria-live="polite">
                                Each password is decrypted with a deliberately slow key function, so this takes a few seconds.
                            </p>
                        )}
                    </form>
                )}
            </div>
        </Modal>
    );
}

/** One password, typed in, checked in the browser. Nothing is stored or sent anywhere but the hash prefix. */
function QuickCheck() {
    const [value, setValue] = useState("");
    const [state, setState] = useState(null); // null | "loading" | { count } | { error }

    const check = async (e) => {
        e.preventDefault();
        if (!value || state === "loading") return;
        setState("loading");
        try {
            setState({ count: await pwnedCount(value) });
        } catch (err) {
            console.error(err);
            setState({ error: true });
        }
    };

    const result = state && state !== "loading" ? state : null;
    return (
        <form className="form fade-in" onSubmit={check}>
            <div className="field">
                <label htmlFor="quick-pw">Password</label>
                <div className="input-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <SecretInput
                            id="quick-pw"
                            mono
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                setState(null);
                            }}
                            placeholder="Type or paste a password"
                            autoFocus
                        />
                    </div>
                    <button type="submit" className={`btn btn-primary${state === "loading" ? " is-busy" : ""}`} disabled={!value || state === "loading"}>
                        <ShieldCheck aria-hidden="true" />
                        {state === "loading" ? "Checking…" : "Check"}
                    </button>
                </div>
                <span className="field-hint">
                    Checked right here in your browser. Only the first 5 characters of its SHA-1 fingerprint go to Have I Been Pwned;
                    the password itself is never sent or saved.
                </span>
            </div>
            {result && (
                <div
                    key={JSON.stringify(result)}
                    className={`quick-result fade-in ${result.error ? "is-error" : result.count ? `is-bad sev-${severity(result.count)}` : "is-good"}`}
                    role="status"
                >
                    {result.count ? <ShieldAlert aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
                    <p>
                        {result.error ? (
                            <>
                                <b>Couldn’t reach Have I Been Pwned.</b> Check your connection and try again.
                            </>
                        ) : result.count ? (
                            <>
                                <b>Found in breaches, seen {times(result.count)}.</b> Don’t use it anywhere; attackers try known breached
                                passwords first.
                            </>
                        ) : (
                            <>
                                <b>Not found in any known breach.</b> That isn’t proof it’s strong, only that it hasn’t leaked publicly.
                            </>
                        )}
                    </p>
                </div>
            )}
        </form>
    );
}

function Report({ report, onOpenPassword, onAgain }) {
    const { summary, results } = report;
    const breached = results.filter((r) => r.breachCount > 0).sort((a, b) => b.breachCount - a.breachCount);
    const groups = Object.values(
        results.reduce((acc, r) => {
            if (r.reuseGroup) (acc[r.reuseGroup] ||= []).push(r);
            return acc;
        }, {})
    ).sort((a, b) => b.length - a.length);
    const clean = summary.checked - summary.breached - (summary.unknown || 0);

    if (!summary.checked) {
        return (
            <div className="breach-empty">
                <h3>That key didn’t open any passwords</h3>
                <p>
                    None of your {summary.processed} passwords are encrypted with it. Check the key and try again; nothing was
                    locked.
                </p>
                <button type="button" className="btn" onClick={onAgain}>
                    Try another key
                </button>
            </div>
        );
    }

    return (
        <div className="breach-report fade-in">
            <dl className="breach-tiles">
                <div className={`breach-tile${summary.breached ? " is-bad" : " is-good"}`}>
                    <dt>Breached</dt>
                    <dd>{summary.breached}</dd>
                </div>
                <div className={`breach-tile${summary.reused ? " is-warn" : ""}`}>
                    <dt>Reused</dt>
                    <dd>{summary.reused}</dd>
                </div>
                <div className="breach-tile is-good">
                    <dt>Clean</dt>
                    <dd>{clean}</dd>
                </div>
                <div className="breach-tile">
                    <dt>Skipped</dt>
                    <dd>{summary.skipped}</dd>
                </div>
            </dl>
            {summary.skipped > 0 && (
                <p className="small muted">
                    {summary.skipped} password{summary.skipped === 1 ? " isn’t" : "s aren’t"} encrypted with this key, so{" "}
                    {summary.skipped === 1 ? "it wasn’t" : "they weren’t"} checked.
                </p>
            )}
            {summary.unknown > 0 && (
                <p className="form-error">
                    Have I Been Pwned didn’t answer for {summary.unknown} password{summary.unknown === 1 ? "" : "s"}. Run the check again
                    to finish them.
                </p>
            )}

            {breached.length ? (
                <section className="breach-section">
                    <h3>
                        <ShieldAlert aria-hidden="true" />
                        Found in breaches
                    </h3>
                    <p className="small muted">Change these first. A breached password is tried automatically against other sites.</p>
                    <ul className="breach-list">
                        {breached.map((r) => (
                            <li key={r.id}>
                                <button type="button" className="breach-row" onClick={() => onOpenPassword(r.id)}>
                                    <ServiceIcon name={r.name} category={catKey(r.category)} size={32} />
                                    <span className="row-text">
                                        <span className="row-title">{r.name}</span>
                                        <span className="row-sub">{r.email || "No email"}</span>
                                    </span>
                                    <span className={`breach-count sev-${severity(r.breachCount)}`}>Seen {times(r.breachCount)}</span>
                                    <ChevronRight className="row-go" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : (
                <div className="breach-clear">
                    <ShieldCheck aria-hidden="true" />
                    <p>
                        <b>No breached passwords.</b> None of the {summary.checked} checked passwords appear in Have I Been Pwned’s list of{" "}
                        known breached passwords.
                    </p>
                </div>
            )}

            {groups.length > 0 && (
                <section className="breach-section">
                    <h3>
                        <Copy aria-hidden="true" />
                        Used more than once
                    </h3>
                    <p className="small muted">If one of these sites leaks, the others are open too. Give each its own password.</p>
                    <ul className="reuse-list">
                        {groups.map((g, i) => (
                            <li key={i}>
                                <span className="reuse-n">{g.length}×</span>
                                <span className="reuse-names">
                                    {g.map((r) => (
                                        <button type="button" key={r.id} className="reuse-chip" onClick={() => onOpenPassword(r.id)}>
                                            <ServiceIcon name={r.name} category={catKey(r.category)} size={20} />
                                            {r.name}
                                        </button>
                                    ))}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="breach-foot">
                <span className="small muted">
                    Checked {summary.checked} of {summary.processed} against{" "}
                    <a href="https://haveibeenpwned.com/Passwords" target="_blank" rel="noreferrer">
                        Have I Been Pwned
                    </a>
                    .
                </span>
                <button type="button" className="btn btn-sm" onClick={onAgain}>
                    <RefreshCw aria-hidden="true" />
                    Check again
                </button>
            </div>
        </div>
    );
}
