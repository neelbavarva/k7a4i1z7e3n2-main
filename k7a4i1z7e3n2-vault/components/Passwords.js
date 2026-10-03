"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Copy, KeyRound, Nfc, Plus, Search, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PASSWORD_CATEGORIES } from "@/lib/categories";
import { http } from "@/lib/http";
import { fmtAgo, fmtDate } from "@/lib/format";
import { detectNetwork, groupNumber, parseBankName } from "@/lib/cards";
import BreachCheck from "./BreachCheck";
import Modal from "./k7/Modal";
import NetworkMark from "./k7/NetworkMark";
import Seg from "./k7/Seg";
import SecretInput from "./k7/SecretInput";
import ServiceIcon, { CATEGORY_ICON, tintFor } from "./k7/ServiceIcon";
import { useKey } from "./k7/hooks";

const catLabel = (v) => PASSWORD_CATEGORIES.find((c) => c.value === v)?.label || "Others";
const catKey = (v) => (PASSWORD_CATEGORIES.some((c) => c.value === v) ? v : "other");
const CatIcon = ({ cat }) => {
    const Icon = CATEGORY_ICON[cat] || KeyRound;
    return <Icon aria-hidden="true" />;
};
const isLocked = (x) => x?.lockedUntil && new Date(x.lockedUntil).getTime() > Date.now();
const SORTS = [
    { value: "none", label: "Default" },
    { value: "desc", label: "Newest" },
    { value: "asc", label: "Oldest" },
];
/** A revealed secret hides itself again after this long. */
const REVEAL_SECONDS = 30;

/** Decrypt errors, said plainly. */
function decryptError(err, what) {
    if (err?.status === 401) toast.error("Wrong key", { description: `${what} decryption failed. Check your key.` });
    else if (err?.status === 423)
        toast.error("Too many attempts", { description: `${what} is locked for now after failed attempts.` });
    else toast.error("Decrypt error", { description: `Could not decrypt ${what.toLowerCase()}${err?.status ? ` (${err.status})` : ""}.` });
}

/** Seconds left before a revealed secret hides itself; calls onHide at zero. */
function useAutoHide(active, onHide) {
    const [left, setLeft] = useState(REVEAL_SECONDS);
    const hide = useRef(onHide);
    useEffect(() => {
        hide.current = onHide;
    });
    useEffect(() => {
        if (!active) return;
        const started = Date.now();
        const id = setInterval(() => {
            const l = REVEAL_SECONDS - Math.floor((Date.now() - started) / 1000);
            setLeft(l);
            if (l <= 0) {
                clearInterval(id);
                hide.current();
            }
        }, 250);
        return () => {
            clearInterval(id);
            setLeft(REVEAL_SECONDS);
        };
    }, [active]);
    return left;
}

/** Copy to the clipboard with a brief "Copied" state on the button. */
function CopyButton({ value, label = "Copy", what }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            className="btn btn-sm"
            aria-label={`Copy ${what || label}`}
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(value);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                } catch {
                    toast.error("Could not copy");
                }
            }}
        >
            {copied ? <Check aria-hidden="true" color="var(--ok)" /> : <Copy aria-hidden="true" />}
            {copied ? "Copied" : label}
        </button>
    );
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
    const [breachOpen, setBreachOpen] = useState(false);
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
                <hr className="rule" />
            </section>

            {deleteMode && (
                <div className="statusbar is-danger fade-in" role="status">
                    <Trash2 aria-hidden="true" />
                    <p>
                        <b>Delete mode is on.</b> Opening a password or card now offers to delete it instead of revealing it.
                    </p>
                    <button type="button" className="btn btn-sm" onClick={() => setDeleteMode(false)}>
                        Done
                    </button>
                </div>
            )}

            <section className="group" style={{ marginTop: 22 }} aria-labelledby="g-cards">
                <div className="group-head">
                    <h2 id="g-cards">Cards</h2>
                    <span className="count">{cards.length}</span>
                </div>
                {error.cards && <p className="form-error" style={{ marginTop: 8 }}>{error.cards}</p>}
                <div className="cards-strip stagger">
                    {cards.map((card, i) => (
                        <BankCard key={card._id} card={card} style={{ "--i": i }} onClick={() => setOpenCard(card)} />
                    ))}
                    <button type="button" className="add-card" style={{ "--i": cards.length }} onClick={() => onManage?.("card")}>
                        <span className="add-card-plus" aria-hidden="true">
                            <Plus />
                        </span>
                        Add a card
                    </button>
                </div>
            </section>

            <section className="group" style={{ marginTop: 4 }} aria-labelledby="g-passwords">
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
                        className="seg-icons"
                        label="Category"
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        options={[
                            { value: "all", label: "All", count: counts.all },
                            ...PASSWORD_CATEGORIES.map((c) => ({
                                value: c.value,
                                label: c.label,
                                count: counts[c.value] || 0,
                                icon: <CatIcon cat={c.value} />,
                            })),
                        ]}
                    />
                    <span className="spacer" />
                    <Seg label="Sort by date added" options={SORTS} value={sortDirection} onChange={setSortDirection} />
                    <button type="button" className="btn" onClick={() => setBreachOpen(true)} title="Check passwords against known breaches">
                        <ShieldAlert aria-hidden="true" />
                        <span className="btn-label">Breach check</span>
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
                                <span className="group-icon" aria-hidden="true">
                                    <CatIcon cat={g.value} />
                                </span>
                                <h3 className="group-title">{g.label}</h3>
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

            {/* rendered before the password dialog, so a password opened from the report stacks on top of it */}
            <BreachCheck
                open={breachOpen}
                onClose={() => setBreachOpen(false)}
                total={passwords.length}
                onOpenPassword={(id) => {
                    const p = passwords.find((x) => x._id === id);
                    if (p) setOpenPassword(p);
                }}
            />
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
    const locked = isLocked(p);
    return (
        <li style={{ "--i": i }} className={locked ? "is-locked-row" : ""}>
            <button type="button" className="row-btn vrow" onClick={onOpen}>
                <span className="row-main">
                    <ServiceIcon name={p.name} category={catKey(p.category)} locked={locked} />
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

/** Bank, type and network from the stored bankName, plus the colour to draw the card in. */
export function cardInfo(card, number) {
    const info = parseBankName(card?.bankName || "");
    const bankLabel = info.known?.name || info.bank || "Card";
    return {
        ...info,
        bankLabel,
        network: info.network || detectNetwork(number) || null,
        tint: info.known?.color || tintFor(info.bank || card?.cardName),
    };
}

/** The bank's monogram in its colour: a known bank's short name, otherwise its first letter. */
export function BankMark({ card, size = 28 }) {
    const info = cardInfo(card);
    const text = ((info.known?.short || info.bank).match(/[\p{L}\p{N}]/u)?.[0] || "?").toUpperCase();
    return (
        <span className="svc bank-mark" style={{ "--svc": `${size}px`, "--tint": info.tint }} aria-hidden="true">
            <span className="svc-coin">{text}</span>
        </span>
    );
}

export function BankCard({ card, data, big, onClick, style }) {
    const locked = isLocked(card);
    const Tag = big ? "div" : "button";
    const info = cardInfo(card, data?.number);
    const exp = data?.validTill
        ? (() => {
              const v = data.validTill.replace(/\D/g, "");
              return v.length >= 2 ? `${v.slice(0, 2)}/${v.slice(2, 4)}` : v;
          })()
        : "••/••";
    const raw = String(data?.number || "").replace(/\s/g, "");
    const number = raw
        ? /^\d+$/.test(raw)
            ? groupNumber(raw, info.network)
            : raw.replace(/(.{4})(?=.)/g, "$1 ") // the add-card preview pads with dots
        : `•••• •••• •••• ${card.lastOfNumber || "••••"}`;
    return (
        <Tag
            {...(big
                ? {}
                : {
                      type: "button",
                      onClick,
                      "aria-label": [card.cardName || "Card", info.bankLabel, info.type, info.network?.name, card.lastOfNumber && `ending ${card.lastOfNumber}`]
                          .filter(Boolean)
                          .join(", "),
                  })}
            className={`bank-card${big ? " is-big" : ""}${locked ? " is-locked" : ""}`}
            style={{ ...style, "--tint": info.tint }}
        >
            <span className="bc-top">
                <BankMark card={card} />
                <span className="bc-id">
                    <span className="bc-name">{card.cardName || info.bankLabel}</span>
                    <span className="bc-bank">
                        {card.cardName ? info.bankLabel : null}
                        {info.type && <span className={`bc-type${card.cardName ? "" : " is-first"}`}>{info.type}</span>}
                    </span>
                </span>
                {locked && (
                    <span className="tag is-locked">
                        <i />
                        Locked
                    </span>
                )}
            </span>
            <span className="bc-mid" aria-hidden="true">
                <span className="bc-chip" />
                <Nfc className="bc-nfc" />
            </span>
            <span className={`bc-number${data?.number ? " reveal" : ""}`} aria-label="Card number">
                {number}
            </span>
            <span className="bc-bottom">
                <dl className="bc-facts">
                    <div>
                        <dt>Expires</dt>
                        <dd className={data?.validTill ? "reveal" : ""}>{exp}</dd>
                    </div>
                    <div>
                        <dt>CVV</dt>
                        <dd className={data?.cvv ? "reveal" : ""}>{data?.cvv || "•••"}</dd>
                    </div>
                    <div>
                        <dt>PIN</dt>
                        <dd className={data?.pin ? "reveal" : ""}>{data?.pin || "••••"}</dd>
                    </div>
                </dl>
                <NetworkMark network={info.network} className="bc-net" />
            </span>
        </Tag>
    );
}

function KeyForm({ onSubmit, loading, what }) {
    const [key, setKey] = useState("");
    return (
        <form
            className="form key-form"
            onSubmit={(e) => {
                e.preventDefault();
                if (key.trim()) onSubmit(key.trim());
            }}
        >
            <div className="field">
                <label htmlFor="decrypt-key">Decryption key</label>
                <SecretInput id="decrypt-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Enter your key" autoFocus />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading || !key.trim()}>
                <KeyRound aria-hidden="true" />
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
    return <p className="note is-danger">Locked after too many wrong keys, until {new Date(item.lockedUntil).toLocaleString()}.</p>;
}

/** A thin bar that runs down while a secret is visible, with the seconds left. */
function HideTimer({ left, onHide }) {
    return (
        <div className="hide-timer">
            <span className="hide-bar" aria-hidden="true">
                <i style={{ transform: `scaleX(${Math.max(0, left) / REVEAL_SECONDS})` }} />
            </span>
            <span className="hide-text">Hides in {Math.max(0, left)}s</span>
            <button type="button" className="linkish" onClick={onHide}>
                Hide now
            </button>
        </div>
    );
}

/** Small facts under the secret: label on the left, value (and maybe an action) on the right. */
function Facts({ rows }) {
    return (
        <dl className="facts">
            {rows.filter(Boolean).map(([k, v, action]) => (
                <div key={k}>
                    <dt>{k}</dt>
                    <dd>
                        <span>{v}</span>
                        {action}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

function CardDialog({ card, deleteMode, onClose, onDeleted }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const shown = useRef(card);
    if (card) shown.current = card;
    const c = shown.current;
    const left = useAutoHide(!!data, () => setData(null));

    useEffect(() => {
        if (card) setData(null);
    }, [card]);

    if (!c) return null;
    const cinfo = cardInfo(c, data?.number);

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
            icon={<BankMark card={c} size={42} />}
            title={c.cardName || cinfo.bankLabel}
            sub={[cinfo.bankLabel, cinfo.type, c.lastOfNumber && `ending ${c.lastOfNumber}`].filter(Boolean).join(" · ")}
        >
            <div className="modal-body">
                <BankCard card={c} data={data} big />
                <LockedNote item={c} />
                {deleteMode ? (
                    <DangerZone what="card" onDelete={remove} loading={deleting} />
                ) : data ? (
                    <div className="revealed fade-in">
                        <div className="copy-row">
                            <CopyButton value={String(data.number || "").replace(/\s/g, "")} label="Copy number" what="card number" />
                            {data.cvv && <CopyButton value={String(data.cvv)} label="Copy CVV" what="CVV" />}
                        </div>
                        <HideTimer left={left} onHide={() => setData(null)} />
                    </div>
                ) : (
                    <KeyForm what="card" onSubmit={decrypt} loading={loading} />
                )}
                <Facts
                    rows={[
                        ["Bank", cinfo.bankLabel],
                        cinfo.type && ["Type", cinfo.type],
                        cinfo.network && ["Network", <NetworkMark key="n" network={cinfo.network} className="fact-net" />],
                        c.cardName && ["Card", c.cardName],
                        c.createdAt && ["Added", fmtDate(c.createdAt)],
                    ]}
                />
            </div>
        </Modal>
    );
}

function PasswordDialog({ password, deleteMode, onClose, onDeleted }) {
    const [value, setValue] = useState(null);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const shown = useRef(password);
    if (password) shown.current = password;
    const p = shown.current;
    const left = useAutoHide(value !== null, () => setValue(null));

    useEffect(() => {
        if (password) setValue(null);
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

    const cat = catKey(p.category);

    return (
        <Modal
            open={!!password}
            onClose={onClose}
            icon={<ServiceIcon name={p.name} category={cat} locked={isLocked(p)} size={42} />}
            title={p.name || "Password"}
            sub={p.email || "No email or username"}
        >
            <div className="modal-body">
                <div className={`secret${value ? " is-open" : ""}`}>
                    <KeyRound className="secret-icon" aria-hidden="true" />
                    {value ? (
                        <span className="secret-value reveal" key={value}>
                            {value}
                        </span>
                    ) : (
                        <span className="secret-value masked" aria-label="Hidden">
                            ••••••••••••
                        </span>
                    )}
                    {value && <CopyButton value={value} what="password" />}
                </div>
                <LockedNote item={p} />
                {deleteMode ? (
                    <DangerZone what="password" onDelete={remove} loading={deleting} />
                ) : value ? (
                    <HideTimer left={left} onHide={() => setValue(null)} />
                ) : (
                    <KeyForm what="password" onSubmit={decrypt} loading={loading} />
                )}
                <Facts
                    rows={[
                        p.email && ["Username", p.email, <CopyButton key="c" value={p.email} what="username" />],
                        [
                            "Category",
                            <span className="fact-cat" key="cat">
                                <CatIcon cat={cat} />
                                {catLabel(p.category)}
                            </span>,
                        ],
                        p.createdAt && ["Added", `${fmtDate(p.createdAt)} · ${fmtAgo(p.createdAt)}`],
                    ]}
                />
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
