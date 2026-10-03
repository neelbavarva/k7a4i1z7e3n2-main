// One place for the backend URL and key, so every screen calls the API the same way.

const BASE = (process.env.NEXT_PUBLIC_PROD_LINK || "https://k7a4i1z7e3n2.onrender.com").replace(/\/$/, "");
const KEY = process.env.NEXT_PUBLIC_SERVER_KEY || "";

export class HttpError extends Error {
    constructor(status, message) {
        super(message || `Request failed: ${status}`);
        this.status = status;
    }
}

export async function http(path, { method = "GET", body } = {}) {
    const headers = { "x-api-key": KEY };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new HttpError(res.status);
    const text = await res.text();
    try {
        return text ? JSON.parse(text) : null;
    } catch {
        return text;
    }
}
