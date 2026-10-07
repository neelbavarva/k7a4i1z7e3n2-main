"use client";

import React, { useState } from "react";
import { Banknote, Ellipsis, HandCoins, Landmark, PiggyBank, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/http";
import { findBank } from "@/lib/cards";
import Modal from "./k7/Modal";
import Seg from "./k7/Seg";
import BankPicker from "./k7/BankPicker";
import { BANKS } from "@/lib/cards";
import { inr } from "@/lib/kite";
import { Mark, bankIn } from "./k7/Marks";

// A balance typed in by hand (a bank account, a deposit, cash, a loan), added the way the vault
// adds a card: the card fills in above as you go, the bank comes from the same picker, and the
// rest is a few fields. Opening one that exists edits it.

export const BALANCE_KINDS = [
    { value: "bank", label: "Savings", icon: <Landmark aria-hidden="true" />, line: "Savings account" },
    { value: "deposit", label: "Deposit", icon: <PiggyBank aria-hidden="true" />, line: "Fixed deposit" },
    { value: "cash", label: "Cash", icon: <Banknote aria-hidden="true" />, line: "Cash" },
    { value: "loan", label: "Loan", icon: <HandCoins aria-hidden="true" />, line: "Loan outstanding" },
    { value: "other", label: "Other", icon: <Ellipsis aria-hidden="true" />, line: "Other asset" },
];
const LINE = Object.fromEntries(BALANCE_KINDS.map((k) => [k.value, k.line]));
LINE.crypto = "Crypto";
LINE.property = "Property";

const bankById = (id) => BANKS.find((b) => b.id === id) || null;

/** What a stored balance shows: its bank (listed or typed), a title and the line under it. */
export function balanceInfo(e) {
    // the bank picked; for a balance saved without one, the bank its name mentions ("HDFC savings")
    const listed = bankById(e.bank) || findBank(e.bank) || (!e.bank ? bankIn(e.name) : null) || null;
    const typed = !listed && e.bank ? e.bank : "";
    const short = listed?.short || typed;
    const kindWord = { bank: "Savings", deposit: "Deposit", cash: "Cash", loan: "Loan", other: "", crypto: "Crypto", property: "Property" }[e.kind] || "";
    return {
        bank: listed,
        bankName: typed,
        title: e.name?.trim() || [short, kindWord].filter(Boolean).join(" ") || "Balance",
        line: [LINE[e.kind] || "", e.note].filter(Boolean).join(" · "),
    };
}

export default function BalanceDialog({ open, initial, demo, onClose, onSaved, onDeleted }) {
    const [busy, setBusy] = useState(false);
    return (
        <Modal open={open} onClose={onClose} busy={busy} title={initial ? "Edit balance" : "Add a balance"} sub="Typed in by hand. Update it when it changes." className="manage">
            <div className="modal-body">{open && <BalanceForm initial={initial} demo={demo} onBusy={setBusy} onClose={onClose} onSaved={onSaved} onDeleted={onDeleted} />}</div>
        </Modal>
    );
}

function BalanceForm({ initial, demo, onBusy, onClose, onSaved, onDeleted }) {
    const start = initial ? balanceInfo(initial) : null;
    const [pick, setPick] = useState(start?.bank ? { id: start.bank.id } : start?.bankName ? { name: start.bankName } : null);
    const [kind, setKind] = useState(initial?.kind && LINE[initial.kind] ? initial.kind : "bank");
    const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
    const [currency, setCurrency] = useState(initial?.currency || "INR");
    const [name, setName] = useState(initial?.name || "");
    const [note, setNote] = useState(initial?.note || "");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const bank = pick?.id ? bankById(pick.id) : null;
    const bankName = bank ? "" : pick?.name?.trim() || "";
    const value = Number(String(amount).replace(/[,\s₹$]/g, ""));
    const okAmount = amount.trim() !== "" && Number.isFinite(value) && value >= 0;
    const draft = { name, kind, bank: bank?.id || bankName, note, amount: okAmount ? value : 0, currency };
    const info = balanceInfo(draft);
    const ready = okAmount && (bank || bankName || name.trim() || kind === "cash");

    const save = async (e) => {
        e.preventDefault();
        if (!ready || saving) return;
        const body = { name: info.title, kind, bank: bank?.id || bankName, amount: value, currency, note: note.trim() };
        setSaving(true);
        onBusy(true);
        setError("");
        try {
            const doc = demo
                ? { ...initial, ...body, _id: initial?._id || `d${Date.now()}`, updatedAt: new Date().toISOString() }
                : initial
                  ? await http(`/worth/manual/${initial._id}`, { method: "PUT", body })
                  : await http("/worth/manual", { method: "POST", body });
            toast.success(initial ? "Balance saved" : "Balance added", { description: info.title });
            onSaved(doc, Boolean(initial));
            onClose();
        } catch (err) {
            setError(err.detail || "It didn’t save. Try again in a moment.");
        } finally {
            setSaving(false);
            onBusy(false);
        }
    };

    const remove = async () => {
        if (!initial || saving) return;
        setSaving(true);
        onBusy(true);
        try {
            if (!demo) await http(`/worth/manual/${initial._id}`, { method: "DELETE" });
            toast(`${info.title} removed`);
            onDeleted(initial);
            onClose();
        } catch {
            setError("It didn’t delete. Try again in a moment.");
        } finally {
            setSaving(false);
            onBusy(false);
        }
    };

    return (
        <form className="form" onSubmit={save}>
            <div className="bal-preview" aria-hidden="true">
                <Mark mark={info.bank ? { bank: info.bank } : { glyph: "bank" }} size={44} />
                <span className="bal-preview-text">
                    <b>{info.title}</b>
                    <small>{info.line || "Pick the bank and type the balance"}</small>
                </span>
                <span className={`bal-preview-amt${kind === "loan" ? " is-neg" : ""}`}>
                    {okAmount ? `${kind === "loan" ? "−" : ""}${currency === "USD" ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : inr(value)}` : "—"}
                </span>
            </div>

            <div className="field">
                <span className="field-label">{kind === "cash" ? "Bank (optional)" : "Bank"}</span>
                <BankPicker value={pick} onChange={setPick} />
            </div>

            <div className="field">
                <span className="field-label">Kind</span>
                <Seg wide className="seg-icons" label="Kind" options={BALANCE_KINDS} value={kind} onChange={setKind} />
            </div>

            <div className="form-grid">
                <div className="field">
                    <label htmlFor="bal-amount" className="field-label">
                        {kind === "loan" ? "Amount owed" : "Balance"}
                    </label>
                    <div className="bal-amount">
                        <input id="bal-amount" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" autoFocus={!initial} />
                        <Seg label="Currency" options={["INR", "USD"]} value={currency} onChange={setCurrency} />
                    </div>
                </div>
                <div className="field">
                    <label htmlFor="bal-name" className="field-label">
                        Name
                    </label>
                    <input id="bal-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={info.title === "Balance" ? "e.g. Salary account" : info.title} maxLength={60} />
                </div>
            </div>

            <div className="field">
                <label htmlFor="bal-note" className="field-label">
                    Note
                </label>
                <input id="bal-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional, e.g. matures in March" maxLength={120} />
            </div>

            <hr className="rule form-rule" />
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={!ready || saving}>
                {saving ? "Saving…" : initial ? "Save balance" : "Add balance"}
            </button>
            {initial && (
                <button type="button" className="btn btn-ghost bal-delete" onClick={remove} disabled={saving}>
                    <Trash2 aria-hidden="true" />
                    Remove this balance
                </button>
            )}
        </form>
    );
}
