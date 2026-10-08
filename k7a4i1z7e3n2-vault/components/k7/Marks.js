"use client";

import { Landmark, Wallet } from "lucide-react";
import { BANKS } from "@/lib/cards";
import { LOGOS } from "@/lib/logos";
import { WALLETS as WALLET_LOGOS } from "@/lib/icons";
import { walletOf } from "@/lib/wallets";
import BankLogo, { initialOf } from "./BankLogo";

// The marks on the net worth page: each account's own logo in its own colours, bare (no tile,
// no border), every one scaled so they look the same size whatever their shape.

// `k`: the logo's size as a share of the mark's box. A filled disc carries more weight than an
// open shape, so it's drawn a little smaller.
const BRANDS = {
    zerodha: { src: "/brands/zerodha.svg", name: "Zerodha", k: 0.72 },
    groww: { src: "/brands/groww.png", name: "Groww", k: 0.84 },
};

const norm = (s) =>
    String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

/** The bank in an entry's name ("HDFC savings" → HDFC Bank), if the vault knows it. */
export function bankIn(name) {
    const n = norm(name);
    if (!n) return null;
    const words = n.split(" ");
    return BANKS.find((b) => words.includes(norm(b.short)) || n.startsWith(norm(b.name)) || (b.aliases || []).some((a) => n.includes(norm(a)))) || null;
}

const GLYPHS = { bank: Landmark, wallet: Wallet };

function Logo({ mark }) {
    if (mark?.brand && BRANDS[mark.brand]) {
        const b = BRANDS[mark.brand];
        return (
            <span className="mk-logo" style={{ "--k": b.k }}>
                {/* a small local file; nothing for next/image to gain */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.src} alt="" />
            </span>
        );
    }
    if (mark?.wallet) {
        const w = walletOf(mark.wallet);
        const svg = w.icon && WALLET_LOGOS[w.icon];
        // the wallet logos sit in a 24-unit box with room around them: drawn at full size to match
        if (svg) return <span className="mk-logo" style={{ "--k": 1 }} dangerouslySetInnerHTML={{ __html: svg }} />;
        return <Glyph glyph="wallet" />;
    }
    if (mark?.bank) {
        const b = mark.bank;
        if (LOGOS[b.id]?.sym)
            return (
                <span className="mk-logo" style={{ "--k": 0.8 }}>
                    <BankLogo id={b.id} symbol />
                </span>
            );
        return (
            <span className="mk-letter" style={{ color: b.color }}>
                {initialOf(b)}
            </span>
        );
    }
    return <Glyph glyph={mark?.glyph} />;
}

function Glyph({ glyph }) {
    const Icon = GLYPHS[glyph] || Wallet;
    return (
        <span className="mk-logo mk-glyph" style={{ "--k": 0.72 }}>
            <Icon />
        </span>
    );
}

/**
 * One mark from a description: { brand }, { wallet }, { bank } (a BANKS entry), { glyph }, or
 * { stack: [marks] } for a few side by side.
 */
export function Mark({ mark, size = 32 }) {
    if (mark?.stack?.length) {
        const small = Math.round(size * (mark.stack.length > 1 ? 0.72 : 1));
        return (
            <span className="mstack" style={{ "--ms": `${small}px` }} aria-hidden="true">
                {mark.stack.slice(0, 3).map((m, i) => (
                    <Mark key={i} mark={m} size={small} />
                ))}
            </span>
        );
    }
    return (
        <span className="mk" style={{ "--ms": `${size}px` }} aria-hidden="true">
            <Logo mark={mark} />
        </span>
    );
}
