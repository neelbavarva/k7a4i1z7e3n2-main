"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, KeyRound, Lock, Plus, Search, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PASSWORD_CATEGORIES } from "@/lib/categories";
import { http } from "@/lib/http";
import { fmtAgo, fmtDate } from "@/lib/format";
import { bankColor, cardFace, detectNetwork, parseBankName, rowFaces } from "@/lib/cards";
import BreachCheck from "./BreachCheck";
import Modal from "./k7/Modal";
import BankLogo, { BankMark } from "./k7/BankLogo";
import NetworkMark, { markRatio } from "./k7/NetworkMark";
import Seg from "./k7/Seg";
import SecretInput from "./k7/SecretInput";
import ServiceIcon, { CATEGORY_ICON } from "./k7/ServiceIcon";
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

    // each card's colours, so the strip and the dialog agree and neighbours never match
    const faces = useMemo(() => rowFaces(cards), [cards]);

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
                <div className="overview-row">
                    <h1 className="overview-title">Your vault</h1>
                    <div className="overview-actions">
                        <button
                            type="button"
                            className="btn"
                            onClick={() => setBreachOpen(true)}
                            aria-label="Breach check"
                            title="Check passwords against known breaches"
                        >
                            <ShieldAlert aria-hidden="true" />
                            <span className="btn-label">Breach check</span>
                        </button>
                        <button type="button" className="btn" onClick={() => onManage?.("changeKey")} aria-label="Change key" title="Change encryption key">
                            <KeyRound aria-hidden="true" />
                            <span className="btn-label">Change key</span>
                        </button>
                        <button
                            type="button"
                            className="btn btn-toggle"
                            aria-pressed={deleteMode}
                            onClick={() => setDeleteMode((s) => !s)}
                            aria-label="Delete mode"
                            title={deleteMode ? "Delete mode: on" : "Delete mode: off"}
                        >
                            <Trash2 aria-hidden="true" />
                            <span className="btn-label">{deleteMode ? "Deleting" : "Delete"}</span>
                        </button>
                    </div>
                </div>
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

            <CardStrip cards={cards} faces={faces} error={error.cards} onOpen={setOpenCard} onAdd={() => onManage?.("card")} />

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
                faces={faces}
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

/** Prev / next for a sideways scroller whose scrollbar is hidden, and which ends have more. */
function useScroller(count) {
    const ref = useRef(null);
    const [edges, setEdges] = useState({ start: true, end: true });
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const update = () =>
            setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
        update();
        el.addEventListener("scroll", update, { passive: true });
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => {
            el.removeEventListener("scroll", update);
            ro.disconnect();
        };
    }, [count]);
    /** Scroll a page of whole cards, so the snap lands on a card edge. */
    const page = (dir) => {
        const el = ref.current;
        const item = el?.firstElementChild;
        if (!item) return;
        const step = item.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || 0);
        el.scrollBy({ left: dir * step * Math.max(1, Math.floor((el.clientWidth - 64) / step)), behavior: "smooth" });
    };
    return { ref, edges, page };
}

function CardStrip({ cards, faces, error, onOpen, onAdd }) {
    const { ref, edges, page } = useScroller(cards.length);
    const scrolls = !(edges.start && edges.end);
    return (
        <section className="group cards-group" aria-labelledby="g-cards">
            <div className="group-head">
                <h2 id="g-cards">Cards</h2>
                <span className="count">{cards.length}</span>
                {scrolls && (
                    <span className="strip-nav fade-in">
                        <button type="button" className="btn btn-icon" onClick={() => page(-1)} disabled={edges.start} aria-label="Previous cards">
                            <ChevronLeft />
                        </button>
                        <button type="button" className="btn btn-icon" onClick={() => page(1)} disabled={edges.end} aria-label="Next cards">
                            <ChevronRight />
                        </button>
                    </span>
                )}
            </div>
            {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
            <div ref={ref} className={`cards-strip stagger${edges.start ? "" : " more-start"}${edges.end ? "" : " more-end"}`}>
                {cards.map((card, i) => (
                    <BankCard key={card._id} card={card} face={faces.get(card._id)} style={{ "--i": i }} onClick={() => onOpen(card)} />
                ))}
                <button type="button" className="add-card" style={{ "--i": cards.length }} onClick={onAdd}>
                    <span className="add-card-plus" aria-hidden="true">
                        <Plus />
                    </span>
                    Add a card
                </button>
            </div>
        </section>
    );
}

/** Bank, type and network from the stored bankName, the bank's tile colour and the card's face. */
export function cardInfo(card, number) {
    const info = parseBankName(card?.bankName || "");
    return {
        ...info,
        bankLabel: info.known?.name || info.bank || "Card",
        network: info.network || detectNetwork(number) || null,
        color: info.known?.color || bankColor(info.bank || card?.cardName),
        face: cardFace(info.known, info.bank),
    };
}

/** Hidden characters as round dots; the font's own bullet is small and square. */
function Dots({ n }) {
    return (
        <span className="dots" aria-hidden="true">
            {Array.from({ length: n }, (_, k) => (
                <i key={k} />
            ))}
        </span>
    );
}
/** Text with its runs of "•" drawn as Dots. */
const dotted = (text) =>
    String(text)
        .split(/(•+)/)
        .filter(Boolean)
        .map((part, i) => (part[0] === "•" ? <Dots key={i} n={part.length} /> : part));

/** Split for display: Amex is 4-6-5, everything else in fours. Works on dots as well as digits. */
const groupsOf = (s, network) =>
    network?.id === "amex" ? [s.slice(0, 4), s.slice(4, 10), s.slice(10, 15)].filter(Boolean) : s.match(/.{1,4}/g) || [];

/** Sizes a mark of this shape (width / height) to about `area` cqw², so wide and tall ones weigh the same. */
function fitArea(ratio, area, { minH, maxH, maxW }) {
    let h = Math.min(maxH, Math.max(minH, Math.sqrt(area / ratio)));
    const w = Math.min(maxW, h * ratio);
    h = w / ratio;
    return { width: `${w}cqw`, height: `${h}cqw` };
}

const startsWith = (text, prefix) => !!prefix && text.toLowerCase().startsWith(prefix.toLowerCase());

/**
 * What a card is called on its face, the way a card app names it: the bank's short name and
 * the product ("HDFC Regalia"), or the bank and the type when it has no name ("SBI Debit").
 * The line under the number then adds what the title didn't say.
 */
function cardWords(info, cardName) {
    const known = info.known;
    const short = known?.short || info.bank || "";
    const name = (cardName || "").trim();
    if (name) {
        const named = [known?.short, known?.name, info.bank].some((b) => startsWith(name, b));
        return { title: named || !short ? name : `${short} ${name}`, line: info.type ? `${info.type} card` : info.bankLabel };
    }
    if (!short) return { title: info.type ? `${info.type} card` : "New card", line: "" };
    return {
        title: info.type ? `${short} ${info.type}` : short,
        line: known && known.name !== known.short ? known.name : "",
    };
}

/** Top right of a card: the bank's logo, in its colours with dark lettering turned white. */
function CardLogo({ info }) {
    const bank = info.known;
    if (!bank) return null;
    const [ratio, symbol] = bank.logo || [0, false];
    if (ratio > 0) return <BankLogo id={bank.id} className="bc-logo is-lift" style={fitArea(ratio, 190, { minH: 4.8, maxH: 10, maxW: 36 })} />;
    // a symbol without a wordmark, or no logo at all: the name set in type
    return (
        <span className="bc-wordmark">
            {symbol && <BankLogo id={bank.id} symbol className="bc-sym is-lift" />}
            <span>{bank.name}</span>
        </span>
    );
}

/**
 * A card in the manner of a card app: what it is in bold capitals top left, the bank's logo
 * top right, the number and a spaced line under it bottom left, the network's mark bottom
 * right. The face is a quiet colour pair with faint contour lines. Everything is sized in
 * container units, so the strip's card and the dialog's bigger one are one design at two
 * scales. `info` overrides what's read from the card (the add-card preview).
 */
export function BankCard({ card, data, info: given, face, big, onClick, style }) {
    const locked = isLocked(card);
    const Tag = big ? "div" : "button";
    const info = given || cardInfo(card, data?.number);
    const amex = info.network?.id === "amex";
    const words = cardWords(info, card.cardName);
    const exp = data?.validTill
        ? (() => {
              const v = data.validTill.replace(/\D/g, "");
              return v.length >= 2 ? `${v.slice(0, 2)}/${v.slice(2, 4)}` : v;
          })()
        : "••/••";
    const shown = String(data?.number || "").replace(/\s/g, "") || "•".repeat(amex ? 11 : 12) + (card.lastOfNumber || "••••");
    const [c1, c2] = face || info.face;
    return (
        <Tag
            {...(big
                ? {}
                : {
                      type: "button",
                      onClick,
                      "aria-label": [card.cardName || "Card", info.bankLabel, info.type, info.network?.name, card.lastOfNumber && `ending ${card.lastOfNumber}`, locked && "locked"]
                          .filter(Boolean)
                          .join(", "),
                  })}
            className={`bank-card${big ? " is-big" : ""}${locked ? " is-locked" : ""}`}
            style={{ ...style, "--c1": c1, "--c2": c2 }}
        >
            <span className="bc-top">
                <span className="bc-head">
                    <span className="bc-title">{words.title}</span>
                    {locked && (
                        <span className="bc-locked">
                            <Lock aria-hidden="true" />
                            Locked
                        </span>
                    )}
                </span>
                <CardLogo info={info} />
            </span>
            <span className="bc-bottom">
                <span className="bc-lines">
                    <span className={`bc-number${data?.number ? " reveal" : ""}`} aria-label="Card number">
                        {groupsOf(shown, info.network).map((g, i) => (
                            <span key={i}>{dotted(g)}</span>
                        ))}
                    </span>
                    {big ? (
                        <span className="bc-line bc-facts">
                            <span>
                                <i>Valid thru</i> <b className={data?.validTill ? "reveal" : ""}>{dotted(exp)}</b>
                            </span>
                            <span>
                                <i>CVV</i> <b className={data?.cvv ? "reveal" : ""}>{dotted(data?.cvv || (amex ? "••••" : "•••"))}</b>
                            </span>
                            <span>
                                <i>PIN</i> <b className={data?.pin ? "reveal" : ""}>{dotted(data?.pin || "••••")}</b>
                            </span>
                        </span>
                    ) : (
                        words.line && <span className="bc-line">{words.line}</span>
                    )}
                </span>
                {info.network && (
                    <NetworkMark network={info.network} light className="bc-net" style={fitArea(markRatio(info.network), 85, { minH: 4.2, maxH: 8.6, maxW: 19 })} />
                )}
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

/** A dialog subtitle made of short facts, separated by dots. Empty items are left out. */
function SubLine({ items }) {
    return items.filter(Boolean).map((item, i) => (
        <span key={i} className="sub-item">
            {item}
        </span>
    ));
}

function CardDialog({ card, faces, deleteMode, onClose, onDeleted }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const shown = useRef(card);
    if (card) shown.current = card;
    const c = shown.current;
    const left = useAutoHide(!!data, () => setData(null));
    // a reveal answered after the dialog closed or moved to another card is dropped
    const request = useRef(0);

    useEffect(() => {
        request.current++;
        if (card) {
            setData(null);
            setLoading(false);
        }
    }, [card]);

    if (!c) return null;
    const cinfo = cardInfo(c, data?.number);

    const decrypt = async (key) => {
        const id = ++request.current;
        try {
            setLoading(true);
            const got = await http(`/cards/decryptCard/${c._id}`, { method: "POST", body: { key } });
            if (id === request.current) setData(got);
        } catch (err) {
            console.error(err);
            if (id !== request.current) return;
            decryptError(err, "Card");
            setData(null);
        } finally {
            if (id === request.current) setLoading(false);
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
            icon={<BankMark bank={cinfo.known} name={cinfo.bank} color={cinfo.color} size={42} />}
            title={c.cardName || cinfo.bankLabel}
            sub={
                <SubLine
                    items={[
                        cinfo.bankLabel,
                        cinfo.type,
                        c.lastOfNumber && `ending ${c.lastOfNumber}`,
                        c.createdAt && <span title={fmtDate(c.createdAt)}>Added {fmtAgo(c.createdAt)}</span>,
                    ]}
                />
            }
        >
            <div className="modal-body">
                <BankCard card={c} data={data} face={faces.get(c._id)} big />
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
    // a reveal answered after the dialog closed or moved to another password is dropped
    const request = useRef(0);

    useEffect(() => {
        request.current++;
        if (password) {
            setValue(null);
            setLoading(false);
        }
    }, [password]);

    if (!p) return null;

    const decrypt = async (key) => {
        const id = ++request.current;
        try {
            setLoading(true);
            const data = await http(`/passwords/decryptPassword/${p._id}`, { method: "POST", body: { key } });
            if (id === request.current) setValue(data?.password ?? null);
        } catch (err) {
            console.error(err);
            if (id !== request.current) return;
            decryptError(err, "Password");
            setValue(null);
        } finally {
            if (id === request.current) setLoading(false);
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
            sub={
                <SubLine
                    items={[
                        <>
                            <CatIcon cat={cat} />
                            {catLabel(p.category)}
                        </>,
                        p.createdAt && <span title={fmtDate(p.createdAt)}>Added {fmtAgo(p.createdAt)}</span>,
                    ]}
                />
            }
        >
            <div className="modal-body">
                <div className="cred">
                    {p.email && (
                        <div className="cred-row">
                            <span className="cred-text">
                                <span className="cred-label">Email or username</span>
                                <span className="cred-value">{p.email}</span>
                            </span>
                            <CopyButton value={p.email} what="username" />
                        </div>
                    )}
                    <div className={`cred-row is-secret${value ? " is-open" : ""}`}>
                        <span className="cred-text">
                            <span className="cred-label">Password</span>
                            {value ? (
                                <span className="cred-value reveal" key={value}>
                                    {value}
                                </span>
                            ) : (
                                <span className="cred-value cred-masked" aria-label="Hidden">
                                    <Dots n={12} />
                                </span>
                            )}
                        </span>
                        {value ? (
                            <CopyButton value={value} what="password" />
                        ) : (
                            <span className="cred-state">
                                <Lock aria-hidden="true" />
                                Encrypted
                            </span>
                        )}
                    </div>
                </div>
                <LockedNote item={p} />
                {deleteMode ? (
                    <DangerZone what="password" onDelete={remove} loading={deleting} />
                ) : value ? (
                    <HideTimer left={left} onHide={() => setValue(null)} />
                ) : (
                    <KeyForm what="password" onSubmit={decrypt} loading={loading} />
                )}
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
