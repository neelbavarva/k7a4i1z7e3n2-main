"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { LOGOS } from "@/lib/logos";

// Bank logos live in public/logos/<id>.json, cleaned so one markup draws every version:
// in the bank's own colours; "is-lift", the same with dark lettering turned white for a card;
// or "is-mono", all white. Each is fetched from this site the first time its bank is on
// screen, then kept for the session. Nothing goes elsewhere.

const loaded = new Map();
const loading = new Map();

function load(id) {
    if (!loading.has(id)) {
        loading.set(
            id,
            fetch(`/logos/${id}.json`)
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null)
                .then((logo) => {
                    loaded.set(id, logo);
                    return logo;
                })
        );
    }
    return loading.get(id);
}

/** The logo data for a bank id, or null until it has loaded (or if there is none). */
export function useBankLogo(id) {
    const [got, setGot] = useState(null);
    useEffect(() => {
        if (!id || loaded.has(id)) return;
        let alive = true;
        load(id).then((logo) => alive && setGot({ id, logo }));
        return () => {
            alive = false;
        };
    }, [id]);
    if (!id) return null;
    if (loaded.has(id)) return loaded.get(id);
    return got?.id === id ? got.logo : null;
}

/**
 * A bank's full logo, or with `symbol` just its mark. `mono` draws it all white.
 * Until it loads, an empty box of the same size holds its place.
 */
export default function BankLogo({ id, symbol, mono, className = "", style }) {
    const logo = useBankLogo(id);
    const part = logo && (symbol ? logo.sym : logo.vb ? logo : null);
    const cls = `logo${mono ? " is-mono" : ""} ${className}`;
    if (!part) return <span className={`${cls} is-pending`} style={style} aria-hidden="true" />;
    // cleaned at build time to plain shapes with numeric geometry and colour variables
    const html = { __html: part.svg ?? logo.svg };
    if (!symbol || part.svg)
        return <svg className={cls} style={style} viewBox={part.vb} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={html} />;
    // a symbol cropped from the full logo: an inner viewport clips the rest (a wide symbol in a
    // square tile would otherwise show the lettering beside or under it)
    const [x, y, w, h] = part.vb.split(" ");
    return (
        <svg className={cls} style={style} viewBox={part.vb} aria-hidden="true" focusable="false">
            <svg x={x} y={y} width={w} height={h} viewBox={part.vb} dangerouslySetInnerHTML={html} />
        </svg>
    );
}

/** First letter of a bank's short name or name, for banks without a symbol. */
export const initialOf = (bank, name) => ((bank?.short || name || "").match(/[\p{L}\p{N}]/u)?.[0] || "").toUpperCase();

/**
 * A bank's mark as a small white tile, like an app icon: the logo's symbol in its own colours
 * when there is one, otherwise the initial in the bank's colour. `bank` is a BANKS entry, or
 * null with a `name` for a bank typed in.
 */
export function BankMark({ bank, name, color, size = 28 }) {
    const letter = initialOf(bank, name);
    return (
        <span className="bank-mark" style={{ "--s": `${size}px`, "--tint": color }} aria-hidden="true">
            {LOGOS[bank?.id]?.sym ? (
                <BankLogo id={bank.id} symbol className="bank-mark-sym" />
            ) : letter ? (
                <span className="bank-mark-letter">{letter}</span>
            ) : (
                <Landmark />
            )}
        </span>
    );
}
