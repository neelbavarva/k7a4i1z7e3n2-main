"use client";

import { useLayoutEffect, useRef } from "react";
import { KeyRound, WalletMinimal } from "lucide-react";
import { getMarketSession } from "@/lib/session";
import { useNow } from "./hooks";

const SECTIONS = [
    { value: "passwords", label: "Vault", key: "1", Icon: KeyRound, title: "Passwords and cards" },
    { value: "finance", label: "Finance", key: "2", Icon: WalletMinimal, title: "Net worth, accounts and trades" },
];

/**
 * The top bar's switch between the vault and finance: a white pill slides to the section you're in,
 * each with its mark (its key, 1 or 2, in its tooltip); Finance carries a small live dot while a
 * forex session is open. As tall as the plain switch it replaces, so the top bar keeps its place
 * beside the other Kaizen sites in the split view.
 */
export default function SectionTabs({ value, onChange }) {
    const box = useRef(null);
    const ink = useRef(null);
    const now = useNow(60000);
    const session = getMarketSession(new Date(now));
    const live = Boolean(session?.active);

    // the pill under the section you're in, moved straight on the element (no re-render); it
    // only glides once it's been placed, so it doesn't fly in from the left on load
    useLayoutEffect(() => {
        const el = box.current;
        const pill = ink.current;
        if (!el || !pill) return;
        const place = () => {
            const on = el.querySelector('[aria-pressed="true"]');
            if (!on) return;
            pill.style.width = `${on.offsetWidth}px`;
            pill.style.transform = `translateX(${on.offsetLeft}px)`;
        };
        place();
        const id = requestAnimationFrame(() => el.classList.add("is-placed"));
        const ro = new ResizeObserver(place);
        ro.observe(el);
        return () => {
            cancelAnimationFrame(id);
            ro.disconnect();
        };
    }, [value]);

    return (
        <div className="seg tabs stabs" role="group" aria-label="Section" ref={box}>
            <span className="stabs-ink" ref={ink} aria-hidden="true" />
            {SECTIONS.map(({ value: v, label, key, Icon, title }) => (
                <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} title={`${title} (${key})`}>
                    <Icon aria-hidden="true" />
                    <span className="stabs-label">{label}</span>
                    {v === "finance" && live ? <i className="stabs-live" title={`${session.name} · ${session.detail}`} aria-label={`${session.name} is open`} /> : null}
                </button>
            ))}
        </div>
    );
}
