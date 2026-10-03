"use client";

import { getMarketSession } from "@/lib/session";
import { useNow } from "./hooks";

/** One quiet line about the forex session. Shows nothing while the market is shut. */
export default function SessionBar() {
    useNow(30000);
    const s = getMarketSession();
    if (!s) return null;
    return (
        <div className={`statusbar fade-in${s.active ? "" : " is-idle"}`} role="status">
            <i aria-hidden="true" />
            <p>
                <b>{s.name}</b> <span className="muted">·</span> {s.detail}
            </p>
        </div>
    );
}
