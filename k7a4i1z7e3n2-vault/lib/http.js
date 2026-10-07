// One place for the backend URL and key, so every screen calls the API the same way.

import { LOCK_OFF, lock, vaultSession } from "./auth";

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

async function request(path, { method, body, accept, headers: extra }) {
    const headers = { "x-api-key": KEY, ...extra };
    const session = vaultSession();
    if (session) headers["x-vault-session"] = session;
    if (accept) headers.Accept = accept;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
        const info = await res.json().catch(() => ({}));
        // the server's lock wants a fresh unlock: back to the lock screen
        if (res.status === 401 && info?.code === "locked" && !LOCK_OFF) lock();
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

export async function http(path, { method = "GET", body, headers } = {}) {
    return read(await request(path, { method, body, headers }));
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
