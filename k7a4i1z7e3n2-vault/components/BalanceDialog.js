"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { Banknote, ChartPie, Check, ChevronDown, Ellipsis, HandCoins, Landmark, PiggyBank, Trash2, TrendingUp } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { toast } from "sonner";
import { http } from "@/lib/http";
import { findBank } from "@/lib/cards";
import Modal from "./k7/Modal";
import Seg from "./k7/Seg";
import BankPicker from "./k7/BankPicker";
import FundPicker from "./k7/FundPicker";
import { fundOf, houseOf } from "@/lib/funds";
import { useFundList } from "@/lib/fundList";
import { BANKS } from "@/lib/cards";
import { inr } from "@/lib/kite";
import { grouped, regroup } from "@/lib/money";
import { Mark, bankIn, brandFor } from "./k7/Marks";

// A balance typed in by hand (a bank account, a deposit, cash, an investment account like Merrill,
// mutual funds on Groww, a loan), added the way the vault
// adds a card: the card fills in above as you go, the bank comes from the same picker, and the
// rest is a few fields. Opening one that exists edits it.

export const BALANCE_KINDS = [
    { value: "bank", label: "Savings", icon: <Landmark aria-hidden="true" />, line: "Savings account", hint: "A savings or current account" },
    { value: "deposit", label: "Deposit", icon: <PiggyBank aria-hidden="true" />, line: "Fixed deposit", hint: "A fixed or recurring deposit" },
    { value: "cash", label: "Cash", icon: <Banknote aria-hidden="true" />, line: "Cash", hint: "In hand, or in a wallet app" },
    { value: "invest", label: "Investments", icon: <TrendingUp aria-hidden="true" />, line: "Investment account", hint: "A brokerage account, like Merrill" },
    { value: "funds", label: "Mutual funds", icon: <ChartPie aria-hidden="true" />, line: "Mutual funds", hint: "Funds on Groww or elsewhere" },
    { value: "loan", label: "Loan", icon: <HandCoins aria-hidden="true" />, line: "Loan outstanding", hint: "Owed: it comes off the total" },
    { value: "other", label: "Other", icon: <Ellipsis aria-hidden="true" />, line: "Other asset", hint: "Anything else of value" },
];
const LINE = Object.fromEntries(BALANCE_KINDS.map((k) => [k.value, k.line]));
LINE.crypto = "Crypto";
LINE.property = "Property";

const bankById = (id) => BANKS.find((b) => b.id === id) || null;

/**
 * What a stored balance shows: its bank (listed or typed), a title and the line under it.
 * `known`, for a mutual fund, is what's known of it from AMFI ({ category, house }), if anything.
 */
export function balanceInfo(e, known) {
    // the bank picked; for a balance saved without one, the bank its name mentions ("HDFC savings")
    const listed = bankById(e.bank) || findBank(e.bank) || (!e.bank ? bankIn(e.name) : null) || null;
    const typed = !listed && e.bank ? e.bank : "";
    const short = listed?.short || typed;
    const kindWord = { bank: "Savings", deposit: "Deposit", cash: "Cash", invest: "Investments", funds: "Mutual funds", loan: "Loan", other: "", crypto: "Crypto", property: "Property" }[e.kind] || "";
    // a mutual fund: its house's logo and its category, from AMFI when we have it, else from the
    // well-known funds, else the house its name starts with
    const wellKnown = e.kind === "funds" ? fundOf(e.name) : null;
    const fund =
        e.kind === "funds"
            ? {
                  category: known?.category || wellKnown?.category || "",
                  house: (typeof known?.house === "string" ? houseOf(known.house) : known?.house) || wellKnown?.house || houseOf(e.name),
              }
            : null;
    return {
        bank: listed,
        bankName: typed,
        fund,
        // a platform typed in that has a logo here (Groww), when it isn't a bank
        brand: listed ? null : brandFor(typed || e.name),
        title: e.name?.trim() || [short, kindWord].filter(Boolean).join(" ") || "Balance",
        line: (e.kind === "funds" ? [fund.category || "Mutual fund", short] : [LINE[e.kind] || "", e.note]).filter(Boolean).join(" · "),
    };
}

/** A balance's mark: its bank's logo, a platform's (Groww), or a plain bank glyph. */
export const markOf = (info) => (info.fund?.house ? info.fund.house.mark : info.bank ? { bank: info.bank } : info.brand ? { brand: info.brand } : { glyph: "bank" });

// where mutual funds and investments are held that aren't banks (Zerodha's funds are read on their own)
const PLATFORMS = [{ name: "Groww", brand: "groww", color: "#00a57c" }];

const ADD_TITLE = { invest: "Add an investment account", funds: "Add mutual funds" };

/** What each kind counts as, said in the dialog's foot. */
const COUNTS_AS = { bank: "bank and cash", deposit: "bank and cash", cash: "bank and cash", invest: "stocks", funds: "mutual funds", other: "other assets" };

/**
 * What a balance is: one quiet field showing the kind picked, opening onto the seven, each with a
 * line on what it's for.
 */
function KindField({ value, onChange }) {
    const k = BALANCE_KINDS.find((x) => x.value === value) || BALANCE_KINDS[0];
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button type="button" className="bal-kindfield" aria-labelledby="bal-kind-label bal-kind-now">
                    {k.icon}
                    <span id="bal-kind-now">{k.line}</span>
                    <small>{k.hint}</small>
                    <ChevronDown className="bal-kindfield-chev" aria-hidden="true" />
                </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content className="menu bal-kindmenu" align="start" sideOffset={4} collisionPadding={16}>
                    <DropdownMenu.RadioGroup value={value} onValueChange={onChange} className="bal-kindmenu-grid">
                        {BALANCE_KINDS.map((x) => (
                            <DropdownMenu.RadioItem key={x.value} value={x.value} className="menu-item bal-kindmenu-item">
                                {x.icon}
                                <span className="bal-kindmenu-text">
                                    {x.line}
                                    <small>{x.hint}</small>
                                </span>
                                <DropdownMenu.ItemIndicator className="bal-kindmenu-check">
                                    <Check aria-hidden="true" />
                                </DropdownMenu.ItemIndicator>
                            </DropdownMenu.RadioItem>
                        ))}
                    </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}

/** `kind` starts a new balance as that kind (from the Brokerage or Mutual funds group's +). */
/** `gross`: everything owned, in rupees, and `rate` rupees per dollar, for the preview's share. */
export default function BalanceDialog({ open, initial, kind, demo, gross, rate, onClose, onSaved, onDeleted }) {
    const [busy, setBusy] = useState(false);
    return (
        <Modal open={open} onClose={onClose} busy={busy} title={initial ? "Edit balance" : ADD_TITLE[kind] || "Add a balance"} sub="Typed in by hand. Update it when it changes." className="manage bal">
            <div className="modal-body">{open && <BalanceForm initial={initial} preset={kind} demo={demo} gross={gross} rate={rate} onBusy={setBusy} onClose={onClose} onSaved={onSaved} onDeleted={onDeleted} />}</div>
        </Modal>
    );
}

// the ledger group each kind lands in, for the preview's heading
const GROUP_OF = { bank: "Bank and cash", deposit: "Bank and cash", cash: "Bank and cash", invest: "Brokerage", funds: "Mutual funds", loan: "Owed", other: "Other assets" };

function BalanceForm({ initial, preset, demo, gross, rate, onBusy, onClose, onSaved, onDeleted }) {
    const start = initial ? balanceInfo(initial) : null;
    const [kind, setKind] = useState(initial?.kind && LINE[initial.kind] ? initial.kind : LINE[preset] ? preset : "bank");
    // mutual funds are usually on Groww: a new holding starts there
    const [pick, setPick] = useState(start?.bank ? { id: start.bank.id } : start?.bankName ? { name: start.bankName } : kind === "funds" ? { name: "Groww" } : null);
    // a mutual fund needs only where it's held, what it's worth and which fund: no kinds to pick from
    const fundsOnly = kind === "funds" && (preset === "funds" || initial?.kind === "funds");
    const held = kind === "invest" || kind === "funds"; // held with a broker or a platform, not only a bank
    const [currency, setCurrency] = useState(initial?.currency || "INR");
    const dollars = currency === "USD";
    const [amount, setAmount] = useState(() => (initial ? grouped(Number.isInteger(initial.amount) ? String(initial.amount) : initial.amount.toFixed(2), dollars) : ""));
    const [name, setName] = useState(initial?.name || "");
    // a fund picked from AMFI's list: its scheme code, kept for its NAV and returns
    const [scheme, setScheme] = useState(initial?.scheme ?? null);
    const [picked, setPicked] = useState(null);
    const [note, setNote] = useState(initial?.note || "");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false); // asked to remove: the foot asks to be sure
    const field = useRef(null);
    const caret = useRef(null);
    useLayoutEffect(() => {
        if (caret.current == null || !field.current) return;
        field.current.setSelectionRange(caret.current, caret.current);
        caret.current = null;
    });

    const bank = pick?.id ? bankById(pick.id) : null;
    const bankName = bank ? "" : pick?.name?.trim() || "";
    const value = Number(String(amount).replace(/,/g, ""));
    const okAmount = amount.trim() !== "" && Number.isFinite(value) && value >= 0 && value <= 1e12;
    const draft = { name, kind, bank: bank?.id || bankName, note, amount: okAmount ? value : 0, currency };
    // the fund's category and house: the one just picked, or the saved one found in AMFI's list
    // (the picker loads it whenever a fund is shown)
    const funds = useFundList(false);
    const info = balanceInfo(draft, picked || (scheme && funds.list?.find((x) => x.code === scheme)) || null);
    const ready = okAmount && (kind === "funds" ? name.trim() : bank || bankName || name.trim() || kind === "cash");
    const money = (x) => (dollars ? `$${x.toLocaleString("en-US", { minimumFractionDigits: x % 1 ? 2 : 0, maximumFractionDigits: 2 })}` : inr(x));
    const platform = PLATFORMS.find((p) => p.name.toLowerCase() === bankName.toLowerCase());
    // its share of everything owned once it's in: this one's rupees over the total with it (an edit
    // takes its old figure out first); a loan has no share
    const inRupees = (amt, cur) => (amt || 0) * (cur === "USD" ? rate || 0 : 1);
    const now = okAmount ? inRupees(value, currency) : 0;
    const without = Math.max(0, (gross || 0) - (initial && initial.kind !== "loan" ? inRupees(initial.amount, initial.currency) : 0));
    const share = kind === "loan" || !gross || !(now + without > 0) ? null : (now / (now + without)) * 100;
    // the figure set the ledger's way, its paise a shade lighter; nothing typed yet shows a quiet zero
    const shown = okAmount ? money(value) : dollars ? "$0" : "₹0";
    const cut = shown.indexOf(".");
    const figure = { int: cut < 0 ? shown : shown.slice(0, cut), frac: cut < 0 ? "" : shown.slice(cut) };

    const type = (e) => {
        const next = regroup(e.target.value, e.target.selectionStart ?? e.target.value.length, dollars, { signs: false });
        caret.current = next.caret;
        setAmount(next.text);
    };
    const switchCurrency = (c) => {
        setCurrency(c);
        // the same figure, grouped the new currency's way
        setAmount((t) => grouped(t.replace(/,/g, ""), c === "USD"));
    };

    const save = async (e) => {
        e.preventDefault();
        if (!ready || saving) return;
        const body = { name: info.title, kind, bank: bank?.id || bankName, amount: value, currency, note: note.trim(), scheme: kind === "funds" ? scheme : null };
        setSaving(true);
        onBusy(true);
        setError("");
        try {
            const doc = demo
                ? { ...initial, ...body, _id: initial?._id || `d${Date.now()}`, updatedAt: new Date().toISOString() }
                : initial
                  ? await http(`/worth/manual/${initial._id}`, { method: "PUT", body })
                  : await http("/worth/manual", { method: "POST", body });
            toast.success(initial ? "Balance saved" : "Balance added", { description: `${info.title}: ${money(value)}` });
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
            setRemoving(false);
        } finally {
            setSaving(false);
            onBusy(false);
        }
    };

    return (
        <form className="form bal-form" onSubmit={save}>
            {/* how it will sit in the ledger: its group's heading, then its row, its share filling in as
                the figure is typed */}
            <div className="bal-preview" aria-hidden="true">
                <div className="bal-preview-head">{GROUP_OF[kind] || "Other assets"}</div>
                <div className="bal-preview-row">
                    <Mark mark={markOf(info)} size={32} />
                    <span className="bal-preview-text">
                        <b>{info.title}</b>
                        <small>{info.line || (held ? "Pick where it’s held and type what it’s worth" : "Pick the bank and type the balance")}</small>
                    </span>
                    {share != null && (
                        <span className="bal-preview-share">
                            <i>
                                <b style={{ width: `${Math.max(share, 1.5)}%` }} />
                            </i>
                            {share >= 1 || share === 0 ? `${Math.round(share)}%` : "<1%"}
                        </span>
                    )}
                    <span className={`bal-preview-amt${kind === "loan" && okAmount ? " is-neg" : ""}${okAmount ? "" : " is-empty"}`}>
                        {kind === "loan" && okAmount ? "−" : ""}
                        {figure.int}
                        {figure.frac ? <span className="bal-preview-frac">{figure.frac}</span> : null}
                    </span>
                </div>
            </div>

            {!fundsOnly && (
                <div className="field">
                    <span className="field-label" id="bal-kind-label">
                        What it is
                    </span>
                    <KindField value={kind} onChange={setKind} />
                </div>
            )}

            <div className="field">
                <span className="field-label">
                    {held ? "Held with" : "Bank"}
                    {held || kind === "cash" ? <span className="field-note">{held ? "a bank, or type the platform" : "optional"}</span> : null}
                </span>
                <BankPicker value={pick} onChange={setPick} platforms={held ? PLATFORMS : []} mine={kind === "invest" ? ["bofa"] : []} />
            </div>

            <div className="field">
                <label htmlFor="bal-amount" className="field-label">
                    {kind === "loan" ? "Owed today" : held ? "Worth today" : "Balance today"}
                </label>
                <div className={`bal-figure${okAmount ? " is-set" : ""}`} onClick={() => field.current?.focus()}>
                    <span className="bal-figure-cur" aria-hidden="true">
                        {dollars ? "$" : "₹"}
                    </span>
                    <input
                        ref={field}
                        id="bal-amount"
                        inputMode="decimal"
                        autoComplete="off"
                        spellCheck={false}
                        value={amount}
                        onChange={type}
                        placeholder="0"
                        autoFocus={!initial}
                    />
                    <Seg label="Currency" options={["INR", "USD"]} value={currency} onChange={switchCurrency} />
                </div>
            </div>

            {kind === "funds" ? (
                <div className="field">
                    <span className="field-label">Fund</span>
                    <FundPicker
                        value={name}
                        scheme={scheme}
                        onChange={(n, f) => {
                            setName(n);
                            setScheme(f?.code ?? null);
                            setPicked(f);
                        }}
                    />
                </div>
            ) : (
                <div className="form-grid">
                    <div className="field">
                        <label htmlFor="bal-name" className="field-label">
                            Name <span className="field-note">optional</span>
                        </label>
                        <input id="bal-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={info.title === "Balance" ? "e.g. Salary account" : info.title} maxLength={60} />
                    </div>
                    <div className="field">
                        <label htmlFor="bal-note" className="field-label">
                            Note <span className="field-note">optional</span>
                        </label>
                        <input id="bal-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "deposit" ? "e.g. matures in March" : "e.g. the joint account"} maxLength={120} />
                    </div>
                </div>
            )}

            {error && <p className="form-error">{error}</p>}

            {/* the foot stays in view: what it counts as, and the button */}
            <div className="nt-foot bal-foot">
                {removing ? (
                    <>
                        <span className="nt-summary">
                            Remove <b>{info.title}</b> from your net worth?
                        </span>
                        <button type="button" className="btn" onClick={() => setRemoving(false)} disabled={saving}>
                            Keep it
                        </button>
                        <button type="button" className="btn btn-danger" onClick={remove} disabled={saving}>
                            <Trash2 aria-hidden="true" />
                            Remove
                        </button>
                    </>
                ) : (
                    <>
                        <span className="nt-summary">
                            {kind === "loan" ? (
                                <>
                                    Taken off your <b>net worth</b>
                                </>
                            ) : kind === "funds" && !name.trim() ? (
                                <>Pick the fund to add it</>
                            ) : (
                                <>
                                    Counts as <b>{COUNTS_AS[kind] || "other assets"}</b>
                                </>
                            )}
                            {dollars ? <span>in dollars, at the day’s rate</span> : null}
                            {platform || bank ? <span>{platform?.name || bank.short}</span> : null}
                        </span>
                        {initial && (
                            <button type="button" className="btn btn-ghost bal-remove" onClick={() => setRemoving(true)} disabled={saving}>
                                <Trash2 aria-hidden="true" />
                                Remove
                            </button>
                        )}
                        <button type="submit" className="btn btn-primary bal-go" disabled={!ready || saving}>
                            {saving ? "Saving…" : initial ? `Save${okAmount ? ` ${money(value)}` : ""}` : `Add${okAmount ? ` ${money(value)}` : ""}`}
                        </button>
                    </>
                )}
            </div>
        </form>
    );
}
