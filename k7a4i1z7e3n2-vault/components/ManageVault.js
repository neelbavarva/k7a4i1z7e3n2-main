"use client";

import React, { useEffect, useState } from "react";
import { CreditCard, KeyRound, Lock, RotateCcwKey, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PASSWORD_CATEGORIES } from "@/lib/categories";
import { http } from "@/lib/http";
import Modal from "./k7/Modal";
import Seg from "./k7/Seg";
import SecretInput from "./k7/SecretInput";
import ServiceIcon, { CATEGORY_ICON } from "./k7/ServiceIcon";
import { BankCard } from "./Passwords";
import BankPicker from "./k7/BankPicker";
import NetworkMark from "./k7/NetworkMark";
import { BANKS, CARD_TYPES, bankColor, cardFace, composeBankName, detectNetwork, groupNumber, luhnValid } from "@/lib/cards";

const MODES = [
    { value: "password", label: "Add password", icon: <KeyRound aria-hidden="true" /> },
    { value: "card", label: "Add card", icon: <CreditCard aria-hidden="true" /> },
    { value: "changeKey", label: "Change key", icon: <RotateCcwKey aria-hidden="true" /> },
];

const SUB = {
    password: "Encrypted with your key before it’s saved. You’ll need the same key to reveal it.",
    card: "Number, expiry, CVV and PIN are encrypted with your key before they’re saved.",
    changeKey: "Re-encrypts everything under a new key. The old key stops working.",
};

const CATEGORY_OPTIONS = PASSWORD_CATEGORIES.map((c) => {
    const Icon = CATEGORY_ICON[c.value] || KeyRound;
    return { ...c, icon: <Icon aria-hidden="true" /> };
});

const digits = (v, max) => v.replace(/\D/g, "").slice(0, max);

/** "MM/YY" with a real month. */
export const validExpiry = (v) => /^(0[1-9]|1[0-2])\/\d{2}$/.test(v);

/** A failed save, said plainly. */
function saveError(err, what) {
    if (err?.status === 400) return `The server didn’t accept this ${what}. Check the fields and try again.`;
    if (err?.status === 401) return "The server refused the request. Lock and unlock the app, then try again.";
    if (err?.status === 429) return "Too many requests just now. Wait a minute and try again.";
    return `Could not save the ${what}${err?.status ? ` (${err.status})` : ""}. Check your connection and try again.`;
}

function generateRandomPassword() {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const nums = "0123456789";
    const special = "!@#$%^&*()_+-=[]{}|;:,.<>?";
    const all = upper + lower + nums + special;
    const pick = (set) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
    const chars = [pick(upper), pick(lower), pick(nums), pick(special)];
    while (chars.length < 32) chars.push(pick(all));
    for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
}

/** 0–4 from length and character variety; good enough to nudge, not to certify. */
function strength(pw) {
    if (!pw) return 0;
    const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
    let s = pw.length >= 8 ? 1 : 0;
    if (pw.length >= 12) s++;
    if (pw.length >= 16) s++;
    if (kinds >= 3) s++;
    return Math.min(4, Math.max(1, s));
}
const STRENGTH = ["", "Weak", "Fair", "Strong", "Very strong"];

function Field({ label, id, hint, aside, children }) {
    return (
        <div className="field">
            <div className="field-top">
                <label htmlFor={id}>{label}</label>
                {aside}
            </div>
            {children}
            {hint && <span className="field-hint">{hint}</span>}
        </div>
    );
}

function KeyHint() {
    return <span className="field-hint">Never stored. If you lose it, nothing it encrypted can be recovered.</span>;
}

function Submit({ loading, ready, idle, busy }) {
    return (
        <button type="submit" className="btn btn-primary btn-block" disabled={loading || !ready}>
            <Lock aria-hidden="true" />
            {loading ? busy : idle}
        </button>
    );
}

export default function ManageVault({ mode, onMode, onClose, onSaved, myBanks = [] }) {
    const open = !!mode;
    // while something saves (or re-encrypts), the dialog stays open and the tabs stay put
    const [busy, setBusy] = useState(false);
    return (
        <Modal open={open} onClose={onClose} busy={busy} title="Manage vault" sub={SUB[mode || "password"]} className="manage">
            <div className="modal-body">
                <fieldset className="bare" disabled={busy}>
                    <Seg wide label="What to do" options={MODES} value={mode} onChange={onMode} />
                </fieldset>
                <div key={mode} className="fade-in">
                    {mode === "card" ? (
                        <CardForm onDone={onSaved} onClose={onClose} onBusy={setBusy} myBanks={myBanks} />
                    ) : mode === "changeKey" ? (
                        <ChangeKeyForm onDone={onSaved} onBusy={setBusy} />
                    ) : (
                        <PasswordForm onDone={onSaved} onClose={onClose} onBusy={setBusy} />
                    )}
                </div>
            </div>
        </Modal>
    );
}

function PasswordForm({ onDone, onClose, onBusy }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [category, setCategory] = useState("");
    const [password, setPassword] = useState("");
    const [key, setKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const ready = name.trim() && password.trim() && key.trim() && category;
    const score = strength(password);

    const submit = async (e) => {
        e.preventDefault();
        if (!ready) return;
        try {
            setLoading(true);
            onBusy(true);
            setError(null);
            const body = { name: name.trim(), password, key: key.trim(), category };
            if (email.trim()) body.email = email.trim();
            await http("/passwords/newPassword", { method: "POST", body });
            toast.success("Password saved", { description: name.trim() });
            onBusy(false);
            onDone();
            onClose();
        } catch (err) {
            console.error(err);
            setError(saveError(err, "password"));
        } finally {
            setLoading(false);
            onBusy(false);
        }
    };

    return (
        <form className="form" onSubmit={submit}>
            {/* how the row will look in the list, as you type */}
            <div className="preview-row" aria-hidden="true">
                <ServiceIcon name={name || "?"} category={category || "other"} />
                <span className="row-text">
                    <span className={`row-title${name.trim() ? "" : " is-empty"}`}>{name.trim() || "New password"}</span>
                    <span className="row-sub">{email.trim() || "No email"}</span>
                </span>
                <span className="preview-tag">Preview</span>
            </div>

            <div className="form-grid">
                <Field label="Name" id="pw-name">
                    <input id="pw-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GitHub" autoFocus />
                </Field>
                <Field label="Email or username" id="pw-email">
                    <input id="pw-email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
                </Field>
            </div>
            <div className="field">
                <span className="field-label">Category</span>
                <Seg wide className="seg-icons" label="Category" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
            </div>
            <Field
                label="Password"
                id="pw-password"
                aside={
                    <button
                        type="button"
                        className="linkish field-action"
                        onClick={() => {
                            setPassword(generateRandomPassword());
                            toast.success("Password generated", { description: "32 random characters." });
                        }}
                        title="Generate a secure password"
                    >
                        <Sparkles aria-hidden="true" />
                        Generate
                    </button>
                }
            >
                <SecretInput id="pw-password" mono value={password} onChange={(e) => setPassword(e.target.value)} placeholder="The password to encrypt" />
                <div className={`pw-meter s${score}`} aria-live="polite">
                    <span className="pw-meter-bars" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                    </span>
                    <span className="pw-meter-label">{password ? `${STRENGTH[score]} · ${password.length} characters` : "Strength shows as you type"}</span>
                </div>
            </Field>

            <hr className="rule form-rule" />

            <Field label="Encryption key" id="pw-key">
                <SecretInput id="pw-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Key used to encrypt and decrypt" />
                <KeyHint />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <Submit loading={loading} ready={ready} idle="Encrypt and save" busy="Saving…" />
        </form>
    );
}

function CardForm({ onDone, onClose, onBusy, myBanks }) {
    const [pick, setPick] = useState(null); // { id } of a listed bank, or { name } typed in
    const [type, setType] = useState("");
    const [cardName, setCardName] = useState("");
    const [number, setNumber] = useState("");
    const [validTill, setValidTill] = useState("");
    const [cvv, setCvv] = useState("");
    const [pin, setPin] = useState("");
    const [key, setKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const raw = number.replace(/\D/g, "");
    const network = detectNetwork(raw);
    const fullLength = network ? network.lengths.includes(raw.length) : raw.length >= 13;
    const typo = fullLength && !luhnValid(raw);
    const cvvLength = network?.id === "amex" ? 4 : 3;
    const known = pick?.id ? BANKS.find((b) => b.id === pick.id) : null;
    const bank = known?.name || pick?.name?.trim() || "";
    const bankName = composeBankName({ bank, type, network: network?.name });
    const badExpiry = validTill.length === 5 && !validExpiry(validTill);
    const ready = bank && type && raw.length >= 12 && validExpiry(validTill) && cvv.length >= 3 && pin.length >= 4 && key.trim();

    const submit = async (e) => {
        e.preventDefault();
        if (!ready) return;
        try {
            setLoading(true);
            onBusy(true);
            setError(null);
            await http("/cards/newCard", {
                method: "POST",
                body: {
                    bankName,
                    cardName: cardName.trim() || undefined,
                    number: raw, // digits only; spaces are only for display
                    validTill: validTill.trim(),
                    cvv: cvv.trim(),
                    pin: pin.trim(),
                    key: key.trim(),
                },
            });
            toast.success("Card saved", { description: [cardName.trim() || bank, type, network?.name].filter(Boolean).join(" · ") });
            onBusy(false);
            onDone();
            onClose();
        } catch (err) {
            console.error(err);
            setError(saveError(err, "card"));
        } finally {
            setLoading(false);
            onBusy(false);
        }
    };

    // the card fills in as you go, and takes its colours once a bank is picked; CVV and PIN stay masked
    const preview = {
        card: { cardName: cardName.trim(), lastOfNumber: raw.slice(-4) },
        info: { bank, known, bankLabel: bank || "Your bank", type, network, color: known?.color || bankColor(bank), face: cardFace(known, bank) },
        data: {
            number: raw ? raw.padEnd(network?.id === "amex" ? 15 : 16, "•") : "",
            validTill: validTill,
            cvv: cvv ? "•".repeat(cvv.length) : "",
            pin: pin ? "•".repeat(pin.length) : "",
        },
    };

    return (
        <form className="form" onSubmit={submit}>
            <div className="card-preview" aria-hidden="true">
                <BankCard card={preview.card} info={preview.info} data={preview.data} big />
            </div>

            <div className="field">
                <span className="field-label">Bank</span>
                <BankPicker value={pick} onChange={setPick} mine={myBanks} />
            </div>

            <div className="form-grid">
                <div className="field">
                    <span className="field-label">Type</span>
                    <Seg wide label="Card type" options={CARD_TYPES} value={type} onChange={setType} />
                </div>
                <Field label="Card name" id="c-name">
                    <input id="c-name" className="input" value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Optional, e.g. Regalia" />
                </Field>
            </div>

            <Field
                label="Card number"
                id="c-number"
                aside={network && <span className="field-note fade-in">{network.name}</span>}
            >
                <div className="input-wrap">
                    <input
                        id="c-number"
                        className={`input num-tab${typo ? " is-invalid" : ""}`}
                        inputMode="numeric"
                        value={number}
                        onChange={(e) => {
                            const d = digits(e.target.value, 19);
                            setNumber(groupNumber(d.slice(0, detectNetwork(d)?.id === "amex" ? 15 : 19), detectNetwork(d)));
                        }}
                        placeholder="1234 5678 9012 3456"
                        autoComplete="off"
                        style={{ paddingRight: 64 }}
                    />
                    <span className="input-net" aria-hidden="true">
                        {network ? <NetworkMark key={network.id} network={network} className="pop-in" /> : <CreditCard />}
                    </span>
                </div>
                {typo && <span className="field-hint is-warn">This number doesn’t pass the card check digit. Check it for a typo.</span>}
            </Field>

            <div className="form-grid form-grid-3">
                <Field label="Valid till" id="c-exp">
                    <input
                        id="c-exp"
                        className={`input num-tab${badExpiry ? " is-invalid" : ""}`}
                        inputMode="numeric"
                        value={validTill}
                        onChange={(e) => {
                            let v = digits(e.target.value, 4);
                            if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
                            setValidTill(v);
                        }}
                        placeholder="MM/YY"
                        maxLength={5}
                    />
                </Field>
                <Field label="CVV" id="c-cvv">
                    <SecretInput id="c-cvv" value={cvv} onChange={(e) => setCvv(digits(e.target.value, 4))} placeholder={cvvLength === 4 ? "1234" : "123"} />
                </Field>
                <Field label="PIN" id="c-pin">
                    <SecretInput id="c-pin" value={pin} onChange={(e) => setPin(digits(e.target.value, 6))} placeholder="••••" />
                </Field>
            </div>
            {badExpiry && <p className="field-hint is-warn expiry-hint fade-in">The month in “Valid till” should be 01 to 12.</p>}

            <hr className="rule form-rule" />

            <Field label="Encryption key" id="c-key">
                <SecretInput id="c-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Key used to encrypt and decrypt" />
                <KeyHint />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <Submit loading={loading} ready={ready} idle="Encrypt and save card" busy="Saving…" />
        </form>
    );
}

/** A selectable tile with an icon, for what the new key applies to. */
function ApplyTile({ checked, onChange, icon, title, sub }) {
    return (
        <label className={`apply-tile${checked ? " on" : ""}`}>
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <span className="apply-icon" aria-hidden="true">
                {icon}
            </span>
            <span className="apply-text">
                <b>{title}</b>
                <span>{sub}</span>
            </span>
            <span className={`check${checked ? " on" : ""}`} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                </svg>
            </span>
        </label>
    );
}

function ChangeKeyForm({ onDone, onBusy }) {
    const [oldKey, setOldKey] = useState("");
    const [newKey, setNewKey] = useState("");
    const [confirmKey, setConfirmKey] = useState("");
    const [doPasswords, setDoPasswords] = useState(true);
    const [doCards, setDoCards] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    // a typo in the new key would re-encrypt everything under a key nobody knows
    const mismatch = confirmKey.length > 0 && confirmKey !== newKey;
    const same = newKey.trim() && newKey.trim() === oldKey.trim();
    const ready = oldKey.trim() && newKey.trim() && confirmKey === newKey && !same && (doPasswords || doCards);

    useEffect(() => setResult(null), [oldKey, newKey]);

    const submit = async (e) => {
        e.preventDefault();
        if (!ready) return;
        try {
            setLoading(true);
            onBusy(true);
            setError(null);
            setResult(null);
            const body = { oldKey: oldKey.trim(), newKey: newKey.trim() };
            const out = {};
            if (doPasswords) {
                const d = await http("/passwords/changeKey", { method: "POST", body }).catch((err) => {
                    throw new Error(`Re-encrypting passwords didn’t finish${err.status ? ` (${err.status})` : ""}. Run it again with the same keys: anything already on the new key is skipped.`);
                });
                out.passwords = d?.summary || d;
            }
            if (doCards) {
                const d = await http("/cards/changeKey", { method: "POST", body }).catch((err) => {
                    throw new Error(`Re-encrypting cards didn’t finish${err.status ? ` (${err.status})` : ""}. Run it again with the same keys: anything already on the new key is skipped.`);
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
            onBusy(false);
        }
    };

    return (
        <form className="form" onSubmit={submit}>
            <ol className="key-steps" aria-hidden="true">
                <li className={oldKey.trim() ? "done" : ""}>Current key</li>
                <li className={newKey.trim() && confirmKey === newKey && !same ? "done" : ""}>New key, twice</li>
                <li className={doPasswords || doCards ? "done" : ""}>What to re-encrypt</li>
            </ol>

            <Field label="Current key" id="ck-old">
                <SecretInput id="ck-old" value={oldKey} onChange={(e) => setOldKey(e.target.value)} placeholder="The key you use now" autoFocus />
            </Field>
            <div className="form-grid">
                <Field label="New key" id="ck-new">
                    <SecretInput id="ck-new" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="New key" />
                </Field>
                <Field label="Confirm new key" id="ck-confirm">
                    <SecretInput id="ck-confirm" value={confirmKey} onChange={(e) => setConfirmKey(e.target.value)} placeholder="Type it again" />
                </Field>
            </div>
            {(mismatch || same) && (
                <p className="form-error" role="alert">
                    {same ? "The new key is the same as the current one." : "The two new keys don’t match yet."}
                </p>
            )}

            <div className="field">
                <span className="field-label">Re-encrypt</span>
                <div className="apply-grid">
                    <ApplyTile checked={doPasswords} onChange={setDoPasswords} icon={<KeyRound />} title="Passwords" sub="Every saved login" />
                    <ApplyTile checked={doCards} onChange={setDoCards} icon={<CreditCard />} title="Cards" sub="Number, expiry, CVV, PIN" />
                </div>
            </div>

            {result && (
                <dl className="brief" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))", boxShadow: "none" }}>
                    {["passwords", "cards"].map((k) =>
                        result[k] ? (
                            <div className="brief-cell fade-in" key={k}>
                                <dt>
                                    <ShieldCheck aria-hidden="true" width={13} height={13} color="var(--ok)" style={{ verticalAlign: -2, marginRight: 5 }} />
                                    {k === "passwords" ? "Passwords" : "Cards"} re-encrypted
                                </dt>
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
            <Submit loading={loading} ready={ready} idle="Re-encrypt with the new key" busy="Re-encrypting…" />
        </form>
    );
}
