"use client";

import { CandlestickChart, Landmark, Wallet } from "lucide-react";
import { BANKS } from "@/lib/cards";
import { BankMark } from "./BankLogo";
import { WalletIcon } from "./CryptoIcons";

// The marks on the net worth page: each broker's own logo (public/brands), the bank logos the
// vault already draws for cards, and wallet icons, as app-style tiles. A few can overlap in a stack.

const BRANDS = {
    zerodha: { src: "/brands/zerodha.svg", name: "Zerodha" },
    groww: { src: "/brands/groww.png", name: "Groww" },
    exness: { src: "/brands/exness.png", name: "Exness" },
};

/** Which broker a name, server or company belongs to, if it's one with a logo here. */
export function brandFor(text = "") {
    const t = String(text).toLowerCase().replace(/[^a-z]/g, "");
    return Object.keys(BRANDS).find((k) => t.includes(k)) || null;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The bank in an entry's name ("HDFC savings" → HDFC Bank), if the vault knows it. */
export function bankIn(name) {
    const n = norm(name);
    if (!n) return null;
    const words = n.split(" ");
    return BANKS.find((b) => words.includes(norm(b.short)) || n.startsWith(norm(b.name)) || (b.aliases || []).some((a) => n.includes(norm(a)))) || null;
}

/** A broker's logo on a white app tile; `full` ones fill the tile edge to edge. */
export function BrandMark({ brand, size = 40 }) {
    const b = BRANDS[brand];
    return (
        <span className={`brm${b?.full ? " is-full" : ""}`} style={{ "--ms": `${size}px` }} aria-hidden="true">
            {/* a small local file; nothing for next/image to gain */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {b ? <img src={b.src} alt="" /> : <CandlestickChart />}
        </span>
    );
}

/** A mark for anything without a logo: a symbol on a soft tile. */
export function GlyphMark({ glyph, size = 40 }) {
    const Icon = { bank: Landmark, forex: CandlestickChart, wallet: Wallet }[glyph] || Wallet;
    return (
        <span className="brm is-glyph" style={{ "--ms": `${size}px` }} aria-hidden="true">
            <Icon />
        </span>
    );
}

/**
 * One mark from a description: { brand }, { wallet }, { bank } (a BANKS entry), { glyph },
 * or { stack: [marks] } for a few side by side, overlapping.
 */
export function Mark({ mark, size = 40 }) {
    if (!mark) return <GlyphMark size={size} />;
    if (mark.stack?.length) {
        const small = Math.round(size * (mark.stack.length > 1 ? 0.78 : 1));
        return (
            <span className="mstack" style={{ "--ms": `${small}px` }} aria-hidden="true">
                {mark.stack.slice(0, 3).map((m, i) => (
                    <span key={i} className="mstack-item" style={{ zIndex: 3 - i }}>
                        <Mark mark={m} size={small} />
                    </span>
                ))}
            </span>
        );
    }
    if (mark.brand) return <BrandMark brand={mark.brand} size={size} />;
    if (mark.wallet) return <WalletIcon id={mark.wallet} size={size} />;
    if (mark.bank) return <BankMark bank={mark.bank} color={mark.bank.color} size={size} />;
    return <GlyphMark glyph={mark.glyph} size={size} />;
}
