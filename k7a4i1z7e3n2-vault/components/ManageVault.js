"use client";

import React, { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PASSWORD_CATEGORIES } from "@/lib/categories";
import { http } from "@/lib/http";
import Modal from "./k7/Modal";
import Seg from "./k7/Seg";

const MODES = [
    { value: "password", label: "Add password" },
    { value: "card", label: "Add card" },
    { value: "changeKey", label: "Change key" },
];

const SUB = {
    password: "Saved encrypted. You'll need the same key to reveal it later.",
    card: "Number, expiry, CVV and PIN are encrypted with your key.",
    changeKey: "Re-encrypt everything from the old key to a new one.",
};

function generateRandomPassword() {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const special = "!@#$%^&*()_+-=[]{}|;:,.<>?";
    const all = upper + lower + digits + special;
    const pick = (set) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
    const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
    while (chars.length < 32) chars.push(pick(all));
    for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
}

function Field({ label, id, hint, children }) {
    return (
        <div className="field">
            <label htmlFor={id}>{label}</label>
            {children}
            {hint && <span className="field-hint">{hint}</span>}
        </div>
    );
}

export default function ManageVault({ mode, onMode, onClose, onSaved }) {
    const open = !!mode;
    return (
        <Modal open={open} onClose={onClose} title="Manage vault" sub={SUB[mode || "password"]}>
            <div className="modal-body">
                <Seg wide label="What to do" options={MODES} value={mode} onChange={onMode} />
                <div key={mode} className="fade-in">
                    {mode === "card" ? (
                        <CardForm onDone={onSaved} onClose={onClose} />
                    ) : mode === "changeKey" ? (
                        <ChangeKeyForm onDone={onSaved} />
                    ) : (
                        <PasswordForm onDone={onSaved} onClose={onClose} />
                    )}
                </div>
            </div>
        </Modal>
    );
}

function PasswordForm({ onDone, onClose }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [category, setCategory] = useState("");
    const [password, setPassword] = useState("");
    const [key, setKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const ready = name.trim() && password.trim() && key.trim() && category;

    const submit = async (e) => {
        e.preventDefault();
        if (!ready) return;
        try {
            setLoading(true);
            setError(null);
            const body = { name: name.trim(), password, key: key.trim(), category };
            if (email.trim()) body.email = email.trim();
            await http("/passwords/newPassword", { method: "POST", body });
            toast.success("Password saved", { description: name.trim() });
            onDone();
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.message || "Could not add password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form className="form" onSubmit={submit}>
            <Field label="Name" id="pw-name">
                <input id="pw-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Label for this password" autoFocus />
            </Field>
            <Field label="Email or username" id="pw-email">
                <input id="pw-email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
            </Field>
            <div className="field">
                <span className="field-label">Category</span>
                <Seg wide label="Category" options={PASSWORD_CATEGORIES} value={category} onChange={setCategory} />
            </div>
            <Field label="Password" id="pw-password">
                <div className="input-row">
                    <input
                        id="pw-password"
                        className="input mono"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter a password to encrypt"
                        autoComplete="off"
                        spellCheck="false"
                    />
                    <button
                        type="button"
                        className="btn"
                        style={{ height: 38 }}
                        onClick={() => {
                            setPassword(generateRandomPassword());
                            toast.success("Password generated", { description: "A secure 32-character password." });
                        }}
                        title="Generate a secure password"
                    >
                        <Sparkles aria-hidden="true" />
                        <span className="btn-label">Generate</span>
                    </button>
                </div>
            </Field>
            <Field label="Encryption key" id="pw-key">
                <input id="pw-key" className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Key used to encrypt and decrypt" autoComplete="off" />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading || !ready}>
                {loading ? "Saving…" : "Save password"}
            </button>
        </form>
    );
}

function CardForm({ onDone, onClose }) {
    const [bankName, setBankName] = useState("");
    const [cardName, setCardName] = useState("");
    const [number, setNumber] = useState("");
    const [validTill, setValidTill] = useState("");
    const [cvv, setCvv] = useState("");
    const [pin, setPin] = useState("");
    const [key, setKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const ready = bankName.trim() && number.trim() && validTill.trim() && cvv.trim() && pin.trim() && key.trim();

    const submit = async (e) => {
        e.preventDefault();
        if (!ready) return;
        try {
            setLoading(true);
            setError(null);
            await http("/cards/newCard", {
                method: "POST",
                body: {
                    bankName: bankName.trim(),
                    cardName: cardName.trim() || undefined,
                    number: number.trim(),
                    validTill: validTill.trim(),
                    cvv: cvv.trim(),
                    pin: pin.trim(),
                    key: key.trim(),
                },
            });
            toast.success("Card saved", { description: cardName.trim() || bankName.trim() });
            onDone();
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.message || "Could not add card");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form className="form" onSubmit={submit}>
            <div className="form-grid">
                <Field label="Bank" id="c-bank">
                    <input id="c-bank" className="input" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" autoFocus />
                </Field>
                <Field label="Card name" id="c-name">
                    <input id="c-name" className="input" value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Optional label" />
                </Field>
                <div className="span-2">
                    <Field label="Card number" id="c-number">
                        <input
                            id="c-number"
                            className="input num-tab"
                            inputMode="numeric"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            placeholder="1234 5678 9012 3456"
                            autoComplete="off"
                        />
                    </Field>
                </div>
                <Field label="Valid till" id="c-exp">
                    <input
                        id="c-exp"
                        className="input num-tab"
                        inputMode="numeric"
                        value={validTill}
                        onChange={(e) => {
                            let v = e.target.value.replace(/\D/g, "");
                            if (v.length >= 2) v = v.slice(0, 2) + "/" + v.slice(2, 4);
                            setValidTill(v.slice(0, 5));
                        }}
                        placeholder="MM/YY"
                        maxLength={5}
                    />
                </Field>
                <Field label="CVV" id="c-cvv">
                    <input id="c-cvv" className="input num-tab" inputMode="numeric" value={cvv} onChange={(e) => setCvv(e.target.value)} placeholder="123" autoComplete="off" />
                </Field>
                <Field label="PIN" id="c-pin">
                    <input id="c-pin" className="input num-tab" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" autoComplete="off" />
                </Field>
                <Field label="Encryption key" id="c-key">
                    <input id="c-key" className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Your key" autoComplete="off" />
                </Field>
            </div>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading || !ready}>
                {loading ? "Saving…" : "Save card"}
            </button>
        </form>
    );
}

function Tick({ checked, onChange, children }) {
    return (
        <label>
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <span className={`check${checked ? " on" : ""}`} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                </svg>
            </span>
            {children}
        </label>
    );
}

function ChangeKeyForm({ onDone }) {
    const [oldKey, setOldKey] = useState("");
    const [newKey, setNewKey] = useState("");
    const [doPasswords, setDoPasswords] = useState(true);
    const [doCards, setDoCards] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const ready = oldKey.trim() && newKey.trim() && (doPasswords || doCards);

    useEffect(() => setResult(null), [oldKey, newKey]);

    const submit = async (e) => {
        e.preventDefault();
        if (!ready) return;
        try {
            setLoading(true);
            setError(null);
            setResult(null);
            const body = { oldKey: oldKey.trim(), newKey: newKey.trim() };
            const out = {};
            if (doPasswords) {
                const d = await http("/passwords/changeKey", { method: "POST", body }).catch((err) => {
                    throw new Error(`Passwords changeKey failed: ${err.status}`);
                });
                out.passwords = d?.summary || d;
            }
            if (doCards) {
                const d = await http("/cards/changeKey", { method: "POST", body }).catch((err) => {
                    throw new Error(`Cards changeKey failed: ${err.status}`);
                });
                out.cards = d?.summary || d;
            }
            const lines = [];
            if (out.passwords) lines.push(`Passwords updated: ${out.passwords.updated} / processed: ${out.passwords.processed}`);
            if (out.cards) lines.push(`Cards updated: ${out.cards.updated} / processed: ${out.cards.processed}`);
            toast.success("Keys changed", { description: lines.join("\n") });
            setResult(out);
            onDone();
        } catch (err) {
            console.error(err);
            setError(err.message || "Change key failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form className="form" onSubmit={submit}>
            <Field label="Old key" id="ck-old">
                <input id="ck-old" className="input" type="password" value={oldKey} onChange={(e) => setOldKey(e.target.value)} placeholder="Current key" autoComplete="off" autoFocus />
            </Field>
            <Field label="New key" id="ck-new">
                <input id="ck-new" className="input" type="password" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="New key" autoComplete="off" />
            </Field>
            <div className="field">
                <span className="field-label">Apply to</span>
                <div className="checkline">
                    <Tick checked={doPasswords} onChange={setDoPasswords}>
                        Passwords
                    </Tick>
                    <Tick checked={doCards} onChange={setDoCards}>
                        Cards
                    </Tick>
                </div>
            </div>
            {result && (
                <dl className="brief" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))", boxShadow: "none" }}>
                    {["passwords", "cards"].map((k) =>
                        result[k] ? (
                            <div className="brief-cell fade-in" key={k}>
                                <dt>{k === "passwords" ? "Passwords" : "Cards"} updated</dt>
                                <dd className="brief-num sm">
                                    {result[k].updated}
                                    <small>of {result[k].processed}</small>
                                </dd>
                            </div>
                        ) : null
                    )}
                </dl>
            )}
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading || !ready}>
                {loading ? "Changing…" : "Change key"}
            </button>
        </form>
    );
}
