// The full list of mutual funds (about 2,000, from AMFI through the API), loaded the first time a
// fund picker opens and kept for the tab's session, so it's asked for once. Until it's in, or if
// the API can't give it, the picker shows the well-known funds in lib/funds.js.

import { useEffect, useSyncExternalStore } from "react";
import { http } from "./http";
import { fromApi } from "./funds";

const KEY = "k7-funds";
const KEEP_MS = 12 * 60 * 60 * 1000;

let state = { status: "idle", list: null, date: null };
const subs = new Set();
const set = (next) => {
    state = { ...state, ...next };
    subs.forEach((f) => f());
};
const subscribe = (f) => {
    subs.add(f);
    return () => subs.delete(f);
};

function load() {
    if (state.status === "loading" || state.status === "ready") return;
    try {
        const kept = JSON.parse(sessionStorage.getItem(KEY) || "null");
        if (kept && Date.now() - kept.at < KEEP_MS && Array.isArray(kept.funds)) {
            set({ status: "ready", list: kept.funds.map(fromApi), date: kept.date });
            return;
        }
    } catch {
        // storage off or full: ask the server
    }
    set({ status: "loading" });
    http("/worth/funds").then(
        (data) => {
            const funds = Array.isArray(data?.funds) ? data.funds : [];
            if (!funds.length) return set({ status: "failed" });
            try {
                sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), date: data.date, funds }));
            } catch {
                // too big for this browser's storage: it's asked for again next session
            }
            set({ status: "ready", list: funds.map(fromApi), date: data.date || null });
        },
        () => set({ status: "failed" })
    );
}

/** { status: "idle" | "loading" | "ready" | "failed", list, date }; `on` false waits to load. */
export function useFundList(on = true) {
    const s = useSyncExternalStore(subscribe, () => state, () => state);
    useEffect(() => {
        if (on) load();
    }, [on]);
    return s;
}
