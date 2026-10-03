"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Archive,
    ArrowDownUp,
    Check,
    ChevronRight,
    Copy,
    CreditCard,
    Globe,
    KeyRound,
    Mail,
    Search,
    Trash2,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { PASSWORD_CATEGORIES } from "@/lib/categories";
import { http } from "@/lib/http";
import { fmtAgo, fmtDate } from "@/lib/format";
import Modal from "./k7/Modal";
import Seg from "./k7/Seg";
import { useKey } from "./k7/hooks";

const CAT_ICON = { "web-app": Globe, email: Mail, banking: CreditCard };
const catLabel = (v) => PASSWORD_CATEGORIES.find((c) => c.value === v)?.label || "Others";
const catKey = (v) => (PASSWORD_CATEGORIES.some((c) => c.value === v) ? v : "other");
const isLocked = (x) => x?.lockedUntil && new Date(x.lockedUntil).getTime() > Date.now();
const SORTS = { none: "Default order", desc: "Newest first", asc: "Oldest first" };
const NEXT_SORT = { none: "desc", desc: "asc", asc: "none" };

/** Decrypt errors, said plainly. Returns true when handled. */
function decryptError(err, what) {
    if (err?.status === 401) toast.error("Wrong key", { description: `${what} decryption failed. Check your key.` });
    else if (err?.status === 423)
        toast.error("Too many attempts", { description: `${what} is locked for now after failed attempts.` });
    else toast.error("Decrypt error", { description: `Could not decrypt ${what.toLowerCase()}${err?.status ? ` (${err.status})` : ""}.` });
}

export default function Passwords({ refreshKey = 0, onManage }) {
    const [cards, setCards] = useState([]);
    const [passwords, setPasswords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState({ cards: null, passwords: null });

    const [categoryFilter, setCategoryFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortDirection, setSortDirection] = useState("none");
    const [deleteMode, setDeleteMode] = useState(false);

    const [openCard, setOpenCard] = useState(null);
    const [openPassword, setOpenPassword] = useState(null);
    const search = useRef(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            const [c, p] = await Promise.allSettled([http("/cards/getCards"), http("/passwords/getPasswords")]);
            if (!alive) return;
            setCards(c.status === "fulfilled" && Array.isArray(c.value) ? c.value : []);
            setPasswords(p.status === "fulfilled" && Array.isArray(p.value) ? p.value : []);
            setError({
                cards: c.status === "rejected" ? "Could not load cards" : null,
                passwords: p.status === "rejected" ? "Could not load passwords" : null,
            });
            setLoading(false);
        })();
        return () => {
            alive = false;
        };
    }, [refreshKey]);

    useKey("/", () => search.current?.focus());

    const counts = useMemo(() => {
        const c = { all: passwords.length };
        for (const p of passwords) c[catKey(p.category)] = (c[catKey(p.category)] || 0) + 1;
        return c;
    }, [passwords]);

    const visible = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        let list = categoryFilter === "all" ? passwords : passwords.filter((p) => catKey(p.category) === categoryFilter);
        if (q)
            list = list.filter((p) =>
                [p.name, p.email, p.category, catLabel(p.category)].some((s) => (s || "").toLowerCase().includes(q))
            );
        if (sortDirection !== "none") {
            list = [...list].sort((a, b) => {
                const ta = new Date(a.createdAt || 0).getTime();
                const tb = new Date(b.createdAt || 0).getTime();
                return sortDirection === "asc" ? ta - tb : tb - ta;
            });
        }
        return list;
    }, [passwords, categoryFilter, searchQuery, sortDirection]);

    const groups = useMemo(() => {
        const cats = categoryFilter === "all" ? PASSWORD_CATEGORIES : PASSWORD_CATEGORIES.filter((c) => c.value === categoryFilter);
        return cats.map((c) => ({ ...c, rows: visible.filter((p) => catKey(p.category) === c.value) })).filter((g) => g.rows.length);
    }, [visible, categoryFilter]);

    if (loading) return <VaultSkeleton />;

    const q = searchQuery.trim();
    const removeCard = (id) => setCards((prev) => prev.filter((c) => c._id !== id));
    const removePassword = (id) => setPasswords((prev) => prev.filter((p) => p._id !== id));

    return (
        <div className={deleteMode ? "delete-mode" : ""}>
            <section className="overview">
                <h1 className="overview-title">Your vault</h1>
                <p className="overview-lede">
                    {passwords.length} password{passwords.length === 1 ? "" : "s"} and {cards.length} card
                    {cards.length === 1 ? "" : "s"}, each encrypted with your key. Open one and enter the key to reveal it.
                </p>
            </section>

            {deleteMode && (
                <div className="statusbar is-idle fade-in" role="status" style={{ borderColor: "color-mix(in srgb, var(--bear) 35%, transparent)" }}>
                    <Trash2 aria-hidden="true" width={14} height={14} color="var(--bear)" />
                    <p>
                        <b>Delete mode is on.</b> Opening a password or card now offers to delete it instead of revealing it.
                    </p>
                    <button type="button" className="btn" style={{ height: 28 }} onClick={() => setDeleteMode(false)}>
                        Done
                    </button>
                </div>
            )}

            {(cards.length > 0 || error.cards) && (
                <section className="group" style={{ marginTop: 6 }} aria-labelledby="g-cards">
                    <div className="group-head">
                        <h2 id="g-cards">Cards</h2>
                        <span className="count">{cards.length}</span>
                    </div>
                    {error.cards && <p className="form-error" style={{ marginTop: 8 }}>{error.cards}</p>}
                    {cards.length > 0 && (
                        <div className="cards-strip stagger">
                            {cards.map((card, i) => (
                                <BankCard key={card._id} card={card} style={{ "--i": i }} onClick={() => setOpenCard(card)} />
                            ))}
                        </div>
                    )}
                </section>
            )}

            <section className="group" aria-labelledby="g-passwords">
                <div className="group-head" style={{ marginBottom: 10 }}>
                    <h2 id="g-passwords">Passwords</h2>
                    <span className="count">{passwords.length}</span>
                </div>

                <div className="searchbar">
                    <Search aria-hidden="true" />
                    <input
                        ref={search}
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                setSearchQuery("");
                                e.currentTarget.blur();
                            }
                            if (e.key === "Enter" && visible[0]) setOpenPassword(visible[0]);
                        }}
                        placeholder="Search by name, email or category…"
                        aria-label="Search passwords"
                        autoComplete="off"
                        spellCheck="false"
                    />
                    {q ? (
                        <button type="button" className="search-clear" onClick={() => setSearchQuery("")} aria-label="Clear search">
                            <X />
                        </button>
                    ) : (
                        <kbd aria-hidden="true">/</kbd>
                    )}
                </div>

                <div className="toolbar">
                    <Seg
                        label="Category"
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        options={[
                            { value: "all", label: "All", count: counts.all },
                            ...PASSWORD_CATEGORIES.map((c) => ({ value: c.value, label: c.label, count: counts[c.value] || 0 })),
                        ]}
                    />
                    <span className="spacer" />
                    <button
                        type="button"
                        className="btn"
                        onClick={() => setSortDirection((s) => NEXT_SORT[s])}
                        title="Sort by date added"
                    >
                        <ArrowDownUp aria-hidden="true" />
                        <span className="btn-label">{SORTS[sortDirection]}</span>
                    </button>
                    <button type="button" className="btn" onClick={() => onManage?.("changeKey")} title="Change encryption key">
                        <KeyRound aria-hidden="true" />
                        <span className="btn-label">Change key</span>
                    </button>
                    <button
                        type="button"
                        className="btn btn-toggle"
                        aria-pressed={deleteMode}
                        onClick={() => setDeleteMode((s) => !s)}
                        title={deleteMode ? "Delete mode: on" : "Delete mode: off"}
                    >
                        <Trash2 aria-hidden="true" />
                        <span className="btn-label">{deleteMode ? "Deleting" : "Delete"}</span>
                    </button>
                </div>

                <p className={`search-hint${q ? " on" : ""}`} aria-live="polite">
                    {q
                        ? visible.length
                            ? `${visible.length} match${visible.length > 1 ? "es" : ""}. Press Enter to open ${visible[0].name}.`
                            : `Nothing matches “${q}”${categoryFilter !== "all" ? " in this category" : ""}.`
                        : ""}
                </p>

                {error.passwords && <p className="form-error" style={{ marginTop: 14 }}>{error.passwords}</p>}

                {!passwords.length && !error.passwords ? (
                    <div className="empty-card fade-in">
                        <h2>Nothing in the vault yet</h2>
                        <p>Add a password or a card. It is encrypted with a key only you know before it leaves this page.</p>
                        <button type="button" className="btn btn-primary" onClick={() => onManage?.("password")}>
                            Add a password
                        </button>
                    </div>
                ) : (
                    groups.map((g) => (
                        <div key={g.value} className="group">
                            <div className="group-head">
                                <h2 style={{ fontSize: 18 }}>{g.label}</h2>
                                <span className="count">{g.rows.length}</span>
                            </div>
                            <div className="rows-card">
                                <div className="row-headings vrow vrow-head" aria-hidden="true">
                                    <span>Name</span>
                                    <span className="col-date">Added</span>
                                    <span />
                                </div>
                                <ul className="rows stagger" key={`${categoryFilter}-${sortDirection}`}>
                                    {g.rows.map((p, i) => (
                                        <PasswordRow
                                            key={p._id}
                                            p={p}
                                            i={i}
                                            deleteMode={deleteMode}
                                            onOpen={() => setOpenPassword(p)}
                                        />
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))
                )}
            </section>

            <CardDialog
                card={openCard}
                deleteMode={deleteMode}
                onClose={() => setOpenCard(null)}
                onDeleted={(id) => {
                    removeCard(id);
                    setOpenCard(null);
                }}
            />
            <PasswordDialog
                password={openPassword}
                deleteMode={deleteMode}
                onClose={() => setOpenPassword(null)}
                onDeleted={(id) => {
                    removePassword(id);
                    setOpenPassword(null);
                }}
            />
        </div>
    );
}

function PasswordRow({ p, i, deleteMode, onOpen }) {
    const Icon = CAT_ICON[p.category] || Archive;
    const locked = isLocked(p);
    return (
        <li style={{ "--i": i }} className={locked ? "is-locked-row" : ""}>
            <button type="button" className="row-btn vrow" onClick={onOpen}>
                <span className="row-main">
                    <span className="tile">
                        <Icon aria-hidden="true" />
                    </span>
                    <span className="row-text">
                        <span className="row-title">
                            {p.name}
                            {locked && (
                                <span className="tag is-locked">
                                    <i />
                                    Locked
                                </span>
                            )}
                        </span>
                        <span className="row-sub">{p.email || "No email"}</span>
                    </span>
                </span>
                <span className="row-meta col-date muted" title={p.createdAt ? fmtDate(p.createdAt) : undefined}>
                    {p.createdAt ? fmtAgo(p.createdAt) : "—"}
                </span>
                {deleteMode ? <Trash2 className="row-go" aria-label="Delete" /> : <ChevronRight className="row-go" aria-hidden="true" />}
            </button>
        </li>
    );
}

function BankCard({ card, data, big, onClick, style }) {
    const locked = isLocked(card);
    const Tag = big ? "div" : "button";
    const exp = data?.validTill
        ? (() => {
              const v = data.validTill.replace(/\D/g, "");
              return v.length >= 2 ? `${v.slice(0, 2)}/${v.slice(2, 4)}` : v;
          })()
        : "••/••";
    const number = data?.number
        ? data.number.replace(/\s/g, "").replace(/(\d{4})(?=\d)/g, "$1 ").trim()
        : `•••• •••• •••• ${card.lastOfNumber || "••••"}`;
    return (
        <Tag
            {...(big ? {} : { type: "button", onClick })}
            className={`bank-card${big ? " is-big" : ""}${locked ? " is-locked" : ""}`}
            style={style}
        >
            <span className="bc-top">
                <span>
                    <span className="bc-name">{card.cardName || "Card"}</span>
                    {locked && (
                        <span className="tag is-locked">
                            <i />
                            Locked
                        </span>
                    )}
                </span>
                <span className="bc-bank">{card.bankName}</span>
            </span>
            <span className="bc-chip" aria-hidden="true" />
            <span className={`bc-number${data?.number ? " reveal" : ""}`} aria-label="Card number">
                {number}
            </span>
            <dl className="bc-facts">
                <div>
                    <dt>PIN</dt>
                    <dd className={data?.pin ? "reveal" : ""}>{data?.pin || "••••"}</dd>
                </div>
                <div>
                    <dt>Expires</dt>
                    <dd className={data?.validTill ? "reveal" : ""}>{exp}</dd>
                </div>
                <div>
                    <dt>CVV</dt>
                    <dd className={data?.cvv ? "reveal" : ""}>{data?.cvv || "•••"}</dd>
                </div>
            </dl>
        </Tag>
    );
}

function KeyForm({ onSubmit, loading, what }) {
    const [key, setKey] = useState("");
    return (
        <form
            className="form"
            onSubmit={(e) => {
                e.preventDefault();
                if (key.trim()) onSubmit(key.trim());
            }}
        >
            <div className="field">
                <label htmlFor="decrypt-key">Decryption key</label>
                <input
                    id="decrypt-key"
                    className="input"
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="Enter your key"
                    autoComplete="off"
                    autoFocus
                />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading || !key.trim()}>
                {loading ? "Decrypting…" : `Reveal ${what}`}
            </button>
        </form>
    );
}

function DangerZone({ what, onDelete, loading }) {
    return (
        <div className="danger-zone">
            <p>Delete mode is on. This removes the {what} from the vault for good.</p>
            <button type="button" className="btn btn-danger btn-block" onClick={onDelete} disabled={loading}>
                <Trash2 aria-hidden="true" />
                {loading ? "Deleting…" : `Delete ${what}`}
            </button>
        </div>
    );
}

function LockedNote({ item }) {
    if (!isLocked(item)) return null;
    return (
        <p className="note" style={{ borderLeftColor: "var(--bear)" }}>
            Locked after too many wrong keys, until {new Date(item.lockedUntil).toLocaleString()}.
        </p>
    );
}

function CardDialog({ card, deleteMode, onClose, onDeleted }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const shown = useRef(card);
    if (card) shown.current = card;
    const c = shown.current;

    useEffect(() => {
        if (card) setData(null);
    }, [card]);

    if (!c) return null;

    const decrypt = async (key) => {
        try {
            setLoading(true);
            setData(await http(`/cards/decryptCard/${c._id}`, { method: "POST", body: { key } }));
        } catch (err) {
            console.error(err);
            decryptError(err, "Card");
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    const remove = async () => {
        try {
            setDeleting(true);
            await http(`/cards/deleteCard/${c._id}`, { method: "DELETE" });
            toast.success("Card deleted");
            onDeleted(c._id);
        } catch (err) {
            console.error(err);
            toast.error("Could not delete card");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Modal
            open={!!card}
            onClose={onClose}
            title={c.lastOfNumber ? `Card ending ${c.lastOfNumber}` : c.cardName || "Card"}
            sub={[c.cardName, c.bankName].filter(Boolean).join(" · ")}
        >
            <div className="modal-body">
                <BankCard card={c} data={data} big />
                <LockedNote item={c} />
                {deleteMode ? (
                    <DangerZone what="card" onDelete={remove} loading={deleting} />
                ) : data ? (
                    <button type="button" className="btn btn-block" onClick={() => setData(null)}>
                        Hide details
                    </button>
                ) : (
                    <KeyForm what="card" onSubmit={decrypt} loading={loading} />
                )}
            </div>
        </Modal>
    );
}

function PasswordDialog({ password, deleteMode, onClose, onDeleted }) {
    const [value, setValue] = useState(null);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [copied, setCopied] = useState(false);
    const shown = useRef(password);
    if (password) shown.current = password;
    const p = shown.current;

    useEffect(() => {
        if (password) {
            setValue(null);
            setCopied(false);
        }
    }, [password]);

    if (!p) return null;

    const decrypt = async (key) => {
        try {
            setLoading(true);
            const data = await http(`/passwords/decryptPassword/${p._id}`, { method: "POST", body: { key } });
            setValue(data?.password ?? null);
        } catch (err) {
            console.error(err);
            decryptError(err, "Password");
            setValue(null);
        } finally {
            setLoading(false);
        }
    };

    const remove = async () => {
        try {
            setDeleting(true);
            await http(`/passwords/deletePassword/${p._id}`, { method: "DELETE" });
            toast.success("Password deleted");
            onDeleted(p._id);
        } catch (err) {
            console.error(err);
            toast.error("Could not delete password");
        } finally {
            setDeleting(false);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            toast.error("Could not copy");
        }
    };

    return (
        <Modal
            open={!!password}
            onClose={onClose}
            title={p.name || "Password"}
            sub={[p.email, catLabel(p.category)].filter(Boolean).join(" · ")}
        >
            <div className="modal-body">
                <div className="secret">
                    {value ? (
                        <span className="secret-value reveal" key={value}>
                            {value}
                        </span>
                    ) : (
                        <span className="secret-value masked" aria-label="Hidden">
                            ••••••••••••
                        </span>
                    )}
                    {value && (
                        <button type="button" className="btn" onClick={copy} aria-label="Copy password">
                            {copied ? <Check aria-hidden="true" color="var(--ok)" /> : <Copy aria-hidden="true" />}
                            {copied ? "Copied" : "Copy"}
                        </button>
                    )}
                </div>
                <LockedNote item={p} />
                {deleteMode ? (
                    <DangerZone what="password" onDelete={remove} loading={deleting} />
                ) : value ? (
                    <button type="button" className="btn btn-block" onClick={() => setValue(null)}>
                        Hide password
                    </button>
                ) : (
                    <KeyForm what="password" onSubmit={decrypt} loading={loading} />
                )}
                {p.createdAt && <p className="small muted">Added {fmtDate(p.createdAt)}</p>}
            </div>
        </Modal>
    );
}

function VaultSkeleton() {
    return (
        <div className="skeleton overview" aria-busy="true" aria-label="Loading vault">
            <div className="sk" style={{ width: 280, maxWidth: "70%", height: 46 }} />
            <div className="sk sk-line" style={{ marginTop: 16 }} />
            <div className="sk-cards" style={{ marginTop: 30 }}>
                <div className="sk sk-card" />
                <div className="sk sk-card" />
            </div>
            <div className="sk sk-search" />
            <div className="sk sk-rows" />
        </div>
    );
}
