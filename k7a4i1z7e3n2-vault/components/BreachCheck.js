"use client";

import React, { useEffect, useState } from "react";
import { ChevronRight, Copy, EyeOff, Fingerprint, KeyRound, Lock, RefreshCw, ShieldAlert, ShieldCheck, Vault } from "lucide-react";
import { httpStream } from "@/lib/http";
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

/** A SHA-1 fingerprint in upper-case hex, worked out in this browser with Web Crypto. */
async function sha1(text) {
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * One password checked entirely in this browser: Have I Been Pwned's range API is asked only for
 * the first 5 characters of its fingerprint (k-anonymity) and answers with every leaked fingerprint
 * that starts that way. `count`: how often this one was seen; `among`: how many it hid among.
 * The password never leaves the page, not even to our own server.
 */
async function pwnedCheck(password) {
    const hash = await sha1(password);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, { headers: { "Add-Padding": "true" } });
    if (!res.ok) throw new Error(`HIBP ${res.status}`);
    let count = 0;
    let among = 0;
    for (const line of (await res.text()).split("\n")) {
        const [suffix, n] = line.trim().split(":");
        const seen = parseInt(n, 10) || 0; // padded rows have count 0
        if (seen) among++;
        if (suffix === hash.slice(5)) count = seen;
    }
    return { count, among, prefix: hash.slice(0, 5) };
}

/** How a check works, in three short points: each a bold line and a quiet one under it. */
function How({ items }) {
    return (
        <ul className="bx-how">
            {items.map(([Icon, title, line]) => (
                <li key={title}>
                    <Icon aria-hidden="true" />
                    <span>
                        <b>{title}</b>
                        {line}
                    </span>
                </li>
            ))}
        </ul>
    );
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
    const [progress, setProgress] = useState(null); // while checking: { start, done?, total?, since?, at? }
    const [mode, setMode] = useState("vault");

    const run = async (e) => {
        e?.preventDefault();
        if (!key.trim() || loading) return;
        try {
            setLoading(true);
            setError(null);
            setProgress({ start: Date.now() });
            // the server reports each password as it's done; since: when it started counting
            const onMessage = (m) => {
                if (m.type !== "progress") return;
                const at = Date.now();
                setProgress((p) => ({ ...p, done: m.done, total: m.total, since: p.since ?? at, at }));
            };
            setReport(await httpStream("/passwords/breachCheck", { body: { key: key.trim() }, onMessage }));
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
        if (loading) return;
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
            busy={loading}
            className="breach"
            icon={
                <span className="breach-mark" aria-hidden="true">
                    <ShieldAlert />
                </span>
            }
            title="Breach check"
            sub={
                mode === "any" ? "Any password against every public breach, without saving it." : "Your saved passwords against every public breach, and the ones you’ve used twice."
            }
        >
            <div className="modal-body">
                <fieldset className="bare" disabled={loading}>
                    <Seg wide label="What to check" options={MODES} value={mode} onChange={setMode} />
                </fieldset>
                {mode === "any" ? (
                    <QuickCheck key="any" />
                ) : report ? (
                    <Report report={report} onOpenPassword={onOpenPassword} onAgain={() => setReport(null)} />
                ) : (
                    <form className="form bx" onSubmit={run}>
                        <fieldset className="bare field" disabled={loading}>
                            <label className="field-label" htmlFor="breach-key">
                                Decryption key
                            </label>
                            <div className="input-row">
                                <div className="bx-key">
                                    <SecretInput id="breach-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="The key your passwords use" autoFocus />
                                </div>
                                {!loading && (
                                    <button type="submit" className="btn btn-primary" disabled={!key.trim()} aria-label={`Check ${total} password${total === 1 ? "" : "s"}`}>
                                        <ShieldCheck aria-hidden="true" />
                                        Check {total}
                                    </button>
                                )}
                            </div>
                            {!loading && <p className="bx-fine">Passwords saved under another key are skipped, not counted as wrong attempts.</p>}
                        </fieldset>
                        {error && <p className="form-error">{error}</p>}
                        {loading ? (
                            <BreachProgress total={total} progress={progress} />
                        ) : (
                            <How
                                items={[
                                    [Lock, "Decrypted on the server", "with the key you type"],
                                    [Fingerprint, "5 of 40 characters sent", "of each password’s fingerprint"],
                                    [EyeOff, "Names and counts back", "never the passwords"],
                                ]}
                            />
                        )}
                    </form>
                )}
            </div>
        </Modal>
    );
}

const clock = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Roughly how long is left, from how fast the passwords so far went; null until that's clear. */
function timeLeft({ done, total, since, at }, now) {
    if (done < 3 || at - since < 2000) return null;
    const left = ((at - since) / done) * (total - done) - Math.max(0, now - at);
    if (left < 10_000) return "Almost done";
    if (left < 55_000) return `About ${Math.round(left / 10_000) * 10} sec left`;
    return `About ${Math.max(1, Math.round(left / 60_000))} min left`;
}

/** While the vault check runs: how far it has got, how long is left, and that everything else waits. */
function BreachProgress({ total, progress }) {
    const [now, setNow] = useState(null);
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(id);
    }, []);

    const elapsed = Math.max(0, (now ?? progress.start) - progress.start);
    const counting = progress.done !== undefined;
    // an older API says nothing until it has finished: after a moment, just show it's working
    const waiting = !counting && elapsed >= 1500;
    const of = counting ? progress.total : total;
    const done = progress.done ?? 0;
    const left = counting ? timeLeft(progress, now ?? progress.at) : null;
    return (
        <div className="breach-progress fade-in" role="status">
            <div className="bp-head">
                <span className="bp-icon" aria-hidden="true">
                    <ShieldCheck />
                </span>
                <span className="bp-text">
                    <b>
                        Checking {of} password{of === 1 ? "" : "s"}…
                    </b>
                    <span>Each one is decrypted with a deliberately slow key function, then looked up by its fingerprint.</span>
                </span>
                {waiting ? (
                    <span className="bp-time num-tab" aria-hidden="true">
                        {clock(elapsed)}
                    </span>
                ) : (
                    // the hidden copy keeps it as wide as it will get, so the text beside it never reflows
                    <span className="bp-count num-tab" aria-hidden="true">
                        <span>
                            {done}
                            <small>/{of}</small>
                        </span>
                        <span className="bp-sizer">
                            {of}
                            <small>/{of}</small>
                        </span>
                    </span>
                )}
            </div>
            <div className="bp-track">
                <div
                    className={`bp-bar${waiting ? " is-waiting" : ""}`}
                    role="progressbar"
                    aria-label="Passwords checked"
                    aria-valuemin={0}
                    aria-valuemax={of}
                    aria-valuenow={waiting ? undefined : done}
                    aria-valuetext={waiting ? undefined : `${done} of ${of} checked`}
                >
                    <i style={waiting ? undefined : { width: `${of ? (done / of) * 100 : 0}%` }} />
                </div>
                {!waiting && (
                    <div className="bp-meta num-tab" aria-hidden="true">
                        <span>{clock(elapsed)} elapsed</span>
                        {left && <span>{left}</span>}
                    </div>
                )}
            </div>
            <p className="bp-note">
                <Lock aria-hidden="true" />
                The vault is locked until the check finishes. Keep this tab open.
            </p>
        </div>
    );
}

/**
 * One password, typed in, checked in the browser: only the first 5 characters of its fingerprint
 * leave. Nothing is stored or sent but those.
 */
function QuickCheck() {
    const [value, setValue] = useState("");
    const [state, setState] = useState(null); // null | "loading" | { count, among, prefix } | { error }

    const check = async (e) => {
        e.preventDefault();
        if (!value || state === "loading") return;
        setState("loading");
        try {
            setState(await pwnedCheck(value));
        } catch (err) {
            console.error(err);
            setState({ error: true });
        }
    };

    const result = state && state !== "loading" ? state : null;
    return (
        <form className="form bx fade-in" onSubmit={check}>
            <div className="field">
                <label htmlFor="quick-pw" className="field-label">
                    Password
                </label>
                <div className="input-row">
                    <div className="bx-key">
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
                                <b>Leaked, seen {times(result.count)}.</b> Don’t use it anywhere: attackers try known breached passwords first.
                            </>
                        ) : (
                            <>
                                <b>Not in any known breach.</b> That isn’t proof it’s strong, only that it hasn’t leaked publicly.
                            </>
                        )}
                        {!result.error && result.among ? (
                            <span className="quick-among">
                                It hid among {compact.format(result.among)} leaked fingerprints starting <code>{result.prefix}</code>; the other 35 characters never left this page.
                            </span>
                        ) : null}
                    </p>
                </div>
            )}
            {!result && (
                <How
                    items={[
                        [Lock, "Fingerprinted here", "in this browser, never sent"],
                        [Fingerprint, "5 of 40 characters sent", "to Have I Been Pwned"],
                        [EyeOff, "Nothing saved", "not even on our server"],
                    ]}
                />
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
