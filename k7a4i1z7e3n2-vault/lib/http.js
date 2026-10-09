// One place for the backend URL and key, so every screen calls the API the same way.

import { lock, vaultSession } from "./auth";

const BASE = (process.env.NEXT_PUBLIC_PROD_LINK || "https://k7a4i1z7e3n2.onrender.com").replace(/\/$/, "");
const KEY = process.env.NEXT_PUBLIC_SERVER_KEY || "";

export class HttpError extends Error {
    constructor(status, message, info = {}) {
        super(message || `Request failed: ${status}`);
        this.status = status;
        this.code = info.code || ""; // the server's reason, when it gave one
        this.detail = info.message || "";
        this.info = info;
    }
}

export const API_BASE = BASE;

// A read that fails because the server, or something behind it (a chain, a broker), didn't answer
// is asked again three times, a little later each time, before the failure reaches the page:
// Render wakes the server slowly, and the chains drop a request now and then. A write is never
// sent twice on its own, and an answer that won't change (locked, not set up, not found) isn't
// asked for again.
export const RETRIES = 3;
const WAITS = [1000, 2000, 4000];

/** The pause before retry `i` (0, 1, 2). */
export const waitToRetry = (i) => new Promise((r) => setTimeout(r, WAITS[Math.min(i, WAITS.length - 1)]));

/** No answer at all, a timeout, or the server failing; a 503 that says "not set up" stays as it is. */
export const retryable = (e) => e?.status === 0 || e?.status === 408 || (e?.status >= 500 && e.code !== "unset");

async function request(path, { method, body, accept, headers: extra }) {
    const headers = { "x-api-key": KEY, ...extra };
    const session = vaultSession();
    if (session) headers["x-vault-session"] = session;
    if (accept) headers.Accept = accept;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let res;
    try {
        res = await fetch(`${BASE}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        // offline, or the server didn't answer at all
        throw new HttpError(0, "The server didn’t answer");
    }
    if (!res.ok) {
        const info = await res.json().catch(() => ({}));
        // the server's lock wants a fresh unlock: back to the lock screen
        if (res.status === 401 && info?.code === "locked") lock();
        throw new HttpError(res.status, undefined, info && typeof info === "object" ? info : {});
    }
    return res;
}

async function read(res) {
    const text = await res.text();
    try {
        return text ? JSON.parse(text) : null;
    } catch {
        return text;
    }
}

/** retries: how many more times to ask if it fails for a reason worth retrying; reads only, by default. */
export async function http(path, { method = "GET", body, headers, retries = method === "GET" ? RETRIES : 0 } = {}) {
    for (let i = 0; ; i++) {
        try {
            return read(await request(path, { method, body, headers }));
        } catch (e) {
            if (i >= retries || !retryable(e)) throw e;
            await waitToRetry(i);
        }
    }
}

/**
 * For a route that reports as it works: asks for Server-Sent Events, hands each message
 * to onMessage as it arrives and resolves with the final `{ type: "result" }` one. A server
 * that answers in one go instead resolves with that answer.
 */
export async function httpStream(path, { method = "POST", body, onMessage } = {}) {
    const res = await request(path, { method, body, accept: "text/event-stream" });
    if (!res.headers.get("content-type")?.startsWith("text/event-stream")) return read(res);

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let end;
        // a message is "data: <json>" lines ending in a blank line
        while ((end = buffer.indexOf("\n\n")) >= 0) {
            const data = buffer
                .slice(0, end)
                .split("\n")
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.slice(5).trim())
                .join("\n");
            buffer = buffer.slice(end + 2);
            if (!data) continue;
            const msg = JSON.parse(data);
            if (msg.type === "result") return msg;
            if (msg.type === "error") throw new HttpError(500, msg.message);
            onMessage?.(msg);
        }
    }
    // the connection closed before the result arrived
    throw new HttpError(0, "Stream ended early");
}
