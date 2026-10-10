"use client";

import { ChartPie, Landmark, Wallet } from "lucide-react";
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

/** Which platform a name belongs to ("Groww mutual funds" → groww), if it's one with a logo here. */
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

const GLYPHS = { bank: Landmark, fund: ChartPie, wallet: Wallet };

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
    if (glyph === "trading") return <Candles />;
    const Icon = GLYPHS[glyph] || Wallet;
    return (
        <span className="mk-logo mk-glyph" style={{ "--k": 0.72 }}>
            <Icon />
        </span>
    );
}

// Material Symbols "candlestick_chart", filled (Google, Apache License 2.0)
const CANDLES =
    "M280-190v-60h-50q-12.75 0-21.37-8.63Q200-267.25 200-280v-400q0-12.75 8.63-21.38Q217.25-710 230-710h50v-60q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v60h50q12.75 0 21.38 8.62Q420-692.75 420-680v400q0 12.75-8.62 21.37Q402.75-250 390-250h-50v60q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63-8.5-8.62-8.5-21.37Zm340 0v-180h-50q-12.75 0-21.37-8.63Q540-387.25 540-400v-200q0-12.75 8.63-21.38Q557.25-630 570-630h50v-140q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v140h50q12.75 0 21.38 8.62Q760-612.75 760-600v200q0 12.75-8.62 21.37Q742.75-370 730-370h-50v180q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63-8.5-8.62-8.5-21.37Z";

/**
 * The trading's own mark, set like a brand's logo so it sits with the banks' rather than as a UI
 * icon: a solid disc in the page's blue with two white candles in it.
 */
function Candles() {
    return (
        <span className="mk-logo mk-candles" style={{ "--k": 0.875 }}>
            <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="12" />
                <svg x="4.5" y="4.5" width="15" height="15" viewBox="0 -960 960 960">
                    <path d={CANDLES} />
                </svg>
            </svg>
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
    // where it's held, when that isn't the mark itself (a fund on Groww): a small round badge on its
    // corner, only where the mark is big enough to carry one
    const badge = mark?.badge && size >= 28 ? Math.round(size * 0.56) : 0;
    return (
        <span className={`mk${badge ? " has-badge" : ""}`} style={{ "--ms": `${size}px` }} aria-hidden="true">
            <Logo mark={mark} />
            {badge ? (
                <span className="mk-badge" style={{ "--ms": `${badge}px` }}>
                    <Logo mark={mark.badge} />
                </span>
            ) : null}
        </span>
    );
}
