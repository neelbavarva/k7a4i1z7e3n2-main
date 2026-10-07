// Zerodha Kite Connect: the HTTP client, the day's access token (encrypted at rest), and the
// signed sessions that let a browser read through this server without ever seeing that token.
//
// Needs KITE_API_KEY, KITE_API_SECRET and KITE_USER_ID (your Zerodha client ID: only that account
// may connect, since any Zerodha user can log in to a Kite Connect app).
require("dotenv").config();
const crypto = require("crypto");

const API = "https://api.kite.trade";
const LOGIN = "https://kite.zerodha.com/connect/login";

function config() {
    return {
        apiKey: (process.env.KITE_API_KEY || "").trim(),
        apiSecret: (process.env.KITE_API_SECRET || "").trim(),
        userId: (process.env.KITE_USER_ID || "").trim().toUpperCase(),
    };
}

const isConfigured = () => {
    const c = config();
    return Boolean(c.apiKey && c.apiSecret && c.userId);
};

class KiteError extends Error {
    constructor(status, message, type) {
        super(message);
        this.status = status;
        this.type = type || "";
    }
    /** The day's token has expired or was revoked: everything needs a fresh login. */
    get expired() {
        return this.type === "TokenException";
    }
    /** Kite refused a call the plan doesn't cover (market data on the free Personal plan). */
    get notInPlan() {
        return this.status === 403 && !this.expired;
    }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * At most `perSecond` calls start in any second, in the order they were asked for. Kite allows
 * 10 a second on most endpoints, 3 on historical candles and 1 on quotes.
 */
function limiter(perSecond) {
    const started = [];
    let queue = Promise.resolve();
    const turn = async () => {
        for (;;) {
            const now = Date.now();
            while (started.length && now - started[0] >= 1000) started.shift();
            if (started.length < perSecond) {
                started.push(now);
                return;
            }
            await sleep(1000 - (now - started[0]) + 5);
        }
    };
    return (fn) => {
        const mine = queue.then(turn);
        queue = mine;
        return mine.then(fn);
    };
}

const buckets = { general: limiter(8), historical: limiter(3), quote: limiter(1) };

/** One Kite call. Resolves with its `data`; anything else throws a KiteError. */
async function call(path, { token, method = "GET", query, form, json, bucket = "general" } = {}) {
    const { apiKey } = config();
    const url = new URL(API + path);
    for (const [k, v] of Object.entries(query || {})) {
        for (const one of [].concat(v)) url.searchParams.append(k, String(one));
    }
    const headers = { "X-Kite-Version": "3" };
    if (token) headers.Authorization = `token ${apiKey}:${token}`;
    let body;
    if (form) {
        body = new URLSearchParams(form).toString();
        headers["Content-Type"] = "application/x-www-form-urlencoded";
    } else if (json !== undefined) {
        body = JSON.stringify(json);
        headers["Content-Type"] = "application/json";
    }

    let res;
    try {
        res = await buckets[bucket](() => fetch(url, { method, headers, body, signal: AbortSignal.timeout(15000) }));
    } catch {
        throw new KiteError(504, "Kite didn't answer in time", "NetworkException");
    }
    let out = null;
    try {
        out = await res.json();
    } catch {
        // not JSON: handled below
    }
    if (!res.ok || out?.status !== "success") {
        throw new KiteError(res.status, out?.message || `Kite answered ${res.status}`, out?.error_type);
    }
    return out.data;
}

/** Where the Kite login starts; Kite hands `params` back to the callback untouched. */
function loginUrl(params = {}) {
    const url = new URL(LOGIN);
    url.searchParams.set("v", "3");
    url.searchParams.set("api_key", config().apiKey);
    const extra = new URLSearchParams(params).toString();
    if (extra) url.searchParams.set("redirect_params", extra);
    return url.toString();
}

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

/** Trades the one-time request token from the login redirect for the day's session. */
function exchange(requestToken) {
    const { apiKey, apiSecret } = config();
    return call("/session/token", {
        method: "POST",
        form: { api_key: apiKey, request_token: requestToken, checksum: sha256(apiKey + requestToken + apiSecret) },
    });
}

/** Ends the session at Kite, so the access token stops working everywhere. */
function revoke(accessToken) {
    return call("/session/token", {
        method: "DELETE",
        query: { api_key: config().apiKey, access_token: accessToken },
    });
}

/** Kite tokens die at 6:00 AM India time (00:30 UTC) the morning after login. */
function nextReset(now = Date.now()) {
    const d = new Date(now);
    const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 30);
    return today > now ? today : today + 864e5;
}

// Two keys from the API secret: one encrypts the stored token, the other signs browser sessions.
const keyFor = (purpose) => crypto.createHash("sha256").update(`kaizen-kite-${purpose}:${config().apiSecret}`).digest();

function seal(plain) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv("aes-256-gcm", keyFor("token"), iv);
    const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
    return { iv: iv.toString("hex"), tag: c.getAuthTag().toString("hex"), data: data.toString("hex") };
}

function open(box) {
    const d = crypto.createDecipheriv("aes-256-gcm", keyFor("token"), Buffer.from(box.iv, "hex"));
    d.setAuthTag(Buffer.from(box.tag, "hex"));
    return Buffer.concat([d.update(Buffer.from(box.data, "hex")), d.final()]).toString("utf8");
}

const b64 = (buf) => Buffer.from(buf).toString("base64url");
const mac = (body) => crypto.createHmac("sha256", keyFor("session")).update(body).digest();

/** A browser's pass for the day: which login generation it belongs to and when it ends. */
function signSession(payload) {
    const body = b64(JSON.stringify(payload));
    return `${body}.${b64(mac(body))}`;
}

function verifySession(token) {
    const [body, sig] = String(token || "").split(".");
    if (!body || !sig) return null;
    const want = mac(body);
    const got = Buffer.from(sig, "base64url");
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
        return payload && payload.exp > Date.now() ? payload : null;
    } catch {
        return null;
    }
}

const randomCode = () => crypto.randomBytes(24).toString("base64url");

module.exports = {
    KiteError,
    config,
    isConfigured,
    call,
    loginUrl,
    exchange,
    revoke,
    nextReset,
    seal,
    open,
    signSession,
    verifySession,
    randomCode,
    sha256,
};
