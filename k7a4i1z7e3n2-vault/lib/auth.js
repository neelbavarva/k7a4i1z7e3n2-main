// Whether this browser is unlocked, kept in localStorage as the time it was unlocked.
// An unlock lasts a day. Locking or unlocking tells every open tab: other tabs hear it
// through the "storage" event, this one through its own event.

export const UNLOCK_MS = 24 * 60 * 60 * 1000;
const KEY = "auth";
const SESSION = "vaultSession"; // the server's signed pass for the day, sent with every request
const EVENT = "k7-auth";
let held = 0; // the unlock time, when localStorage can't be used
let heldSession = "";

/** When this browser was unlocked, or 0 if it's locked (or the day is up). */
export function unlockedAt(now = Date.now()) {
    let ts;
    try {
        ts = Number(localStorage.getItem(KEY));
    } catch {
        ts = held; // storage blocked: use what this page holds
    }
    if (ts && now - ts < UNLOCK_MS) return ts;
    return 0;
}

export function unlock(now = Date.now(), session = "") {
    held = now;
    heldSession = session;
    try {
        localStorage.setItem(KEY, String(now));
        if (session) localStorage.setItem(SESSION, session);
        else localStorage.removeItem(SESSION);
    } catch {
        // storage blocked: the unlock lasts until the page is closed
    }
    window.dispatchEvent(new Event(EVENT));
}

/** The server session from the last unlock, or "" (the old browser-only lock had none). */
export function vaultSession() {
    try {
        return localStorage.getItem(SESSION) || "";
    } catch {
        return heldSession;
    }
}

export function lock() {
    held = 0;
    heldSession = "";
    try {
        localStorage.removeItem(KEY);
        localStorage.removeItem(SESSION);
    } catch {
        // nothing stored to remove
    }
    window.dispatchEvent(new Event(EVENT));
}

/**
 * For useSyncExternalStore: calls back when any tab locks or unlocks, and when this tab
 * comes back into view (a laptop that slept past the day should find it locked).
 */
export function subscribe(callback) {
    const onStorage = (e) => {
        if (e.key === KEY || e.key === null) callback();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT, callback);
    document.addEventListener("visibilitychange", callback);
    return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(EVENT, callback);
        document.removeEventListener("visibilitychange", callback);
    };
}
