"use client";

import { CandlestickChart, Landmark, Wallet } from "lucide-react";
import { BANKS } from "@/lib/cards";
import { LOGOS } from "@/lib/logos";
import { WALLETS_MONO } from "@/lib/icons";
import { walletOf } from "@/lib/wallets";
import BankLogo, { initialOf } from "./BankLogo";

// The marks on the net worth page: each account's own logo in its own colours, bare (no tile,
// no border), every one scaled so they look the same size whatever their shape.

// `k`: the logo's size as a share of the mark's box. A filled disc carries more weight than an
// open shape, so it's drawn a little smaller.
const BRANDS = {
    zerodha: { src: "/brands/zerodha.svg", name: "Zerodha", k: 0.8 },
    groww: { src: "/brands/groww.png", name: "Groww", k: 0.84 },
    exness: { src: "/brands/exness.png", name: "Exness", k: 0.84 },
};

/** Which broker a name, server or company belongs to, if it's one with a logo here. */
export function brandFor(text = "") {
    const t = String(text).toLowerCase().replace(/[^a-z]/g, "");
    return Object.keys(BRANDS).find((k) => t.includes(k)) || null;
}

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

// wallet logos are drawn flat in one brand colour (no gradients); a few colours set by hand where
// the brand's own is too loud on the page
const WALLET_INK = { trust: "#3375bb", safe: "#12a35a", okx: "#161a16", ledger: "#161a16", trezor: "#161a16", bitbox: "#161a16" };

const GLYPHS = { bank: Landmark, forex: CandlestickChart, wallet: Wallet };

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
        const svg = w.icon && WALLETS_MONO[w.icon];
        if (svg) return <span className="mk-logo" style={{ "--k": 1, color: WALLET_INK[w.id] || w.color }} dangerouslySetInnerHTML={{ __html: svg }} />;
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
