// One place for the backend URL and key, so every screen calls the API the same way.

const BASE = (process.env.NEXT_PUBLIC_PROD_LINK || "https://k7a4i1z7e3n2.onrender.com").replace(/\/$/, "");
const KEY = process.env.NEXT_PUBLIC_SERVER_KEY || "";

export class HttpError extends Error {
    constructor(status, message) {
        super(message || `Request failed: ${status}`);
        this.status = status;
    }
}

async function request(path, { method, body, accept }) {
    const headers = { "x-api-key": KEY };
    if (accept) headers.Accept = accept;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new HttpError(res.status);
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

export async function http(path, { method = "GET", body } = {}) {
    return read(await request(path, { method, body }));
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
