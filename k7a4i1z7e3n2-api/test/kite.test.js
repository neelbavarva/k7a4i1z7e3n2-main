// The Zerodha routes, run against an in-memory session store and a fake Kite.
// Run with: npm test
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

// our own keys, set before anything reads the environment (dotenv won't override them)
process.env.SERVER_KEYS = "test-key";
process.env.SERVER_KEY = "test-key";
process.env.KITE_API_KEY = "kitekey";
process.env.KITE_API_SECRET = "kitesecret";
process.env.KITE_USER_ID = "ab1234";
process.env.VAULT_URLS = "https://vault.example";
const KEY = "test-key";

// the session store: one document, kept in memory
let stored = null;
const copy = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const modelPath = require.resolve("../schema/KiteSession");
require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
        findById: () => ({ lean: async () => copy(stored) }),
        findByIdAndUpdate: (id, update) => ({
            lean: async () => {
                stored = { _id: id, ...(stored || {}), ...update.$set };
                return copy(stored);
            },
        }),
    },
};

// a fake Kite: AB1234 is the owner, ZZ9999 a stranger
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const revoked = [];
const chargesAsked = [];
let expireNext = false;
const realFetch = globalThis.fetch;
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ok = (data) => reply(200, { status: "success", data });
const err = (status, type, message) => reply(status, { status: "error", error_type: type, message });

function fakeKite(url, init = {}) {
    const method = init.method || "GET";
    if (url.pathname === "/session/token" && method === "POST") {
        const form = new URLSearchParams(init.body);
        const rt = form.get("request_token");
        if (form.get("checksum") !== sha256(`kitekey${rt}kitesecret`)) return err(403, "TokenException", "Invalid checksum");
        const who = rt === "mine" ? "AB1234" : "ZZ9999";
        return ok({ user_id: who, user_name: who === "AB1234" ? "Owner Name" : "Stranger", access_token: `tok-${rt}` });
    }
    if (url.pathname === "/session/token" && method === "DELETE") {
        revoked.push(url.searchParams.get("access_token"));
        return ok(true);
    }
    if (init.headers?.Authorization !== "token kitekey:tok-mine" || init.headers?.["X-Kite-Version"] !== "3") {
        return err(403, "TokenException", "Invalid api_key or access_token");
    }
    if (expireNext) {
        expireNext = false;
        return err(403, "TokenException", "Token expired");
    }
    switch (url.pathname) {
        case "/user/profile":
            return ok({ user_id: "AB1234", user_name: "Owner Name" });
        case "/user/margins":
            return ok({ equity: { net: 1000 } });
        case "/portfolio/holdings":
            return ok([{ tradingsymbol: "INFY", quantity: 2 }]);
        case "/portfolio/positions":
            return ok({ net: [], day: [] });
        case "/orders":
            return ok([
                { order_id: "1", status: "COMPLETE", filled_quantity: 10, average_price: 100, exchange: "NSE", tradingsymbol: "INFY", transaction_type: "BUY", variety: "regular", product: "CNC", order_type: "MARKET" },
                { order_id: "2", status: "OPEN", filled_quantity: 0, average_price: 0, exchange: "NSE", tradingsymbol: "TCS", transaction_type: "BUY", variety: "regular", product: "CNC", order_type: "LIMIT" },
            ]);
        case "/charges/orders":
            chargesAsked.push(JSON.parse(init.body));
            return ok([{ tradingsymbol: "INFY", charges: { total: 1.5 } }]);
        case "/alerts":
            return err(403, "PermissionException", "Insufficient permission for that call.");
        case "/quote":
            return err(403, "PermissionException", "Insufficient permission for that call.");
        case "/instruments/historical/408065/day":
            return ok({ candles: [["2026-10-06T00:00:00+0530", 1, 2, 0.5, 1.5, 100]] });
        default:
            return ok([]);
    }
}

let server;
let base;
before(async () => {
    globalThis.fetch = (url, init) => (String(url).startsWith("https://api.kite.trade") ? Promise.resolve(fakeKite(new URL(url), init)) : realFetch(url, init));
    const express = require("express");
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.use("/kite", require("../routes/kiteRoute"));
    await new Promise((resolve) => (server = app.listen(0, resolve)));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
    globalThis.fetch = realFetch;
    server?.close();
});

const get = (path, headers = {}) => realFetch(`${base}${path}`, { headers: { "x-api-key": KEY, ...headers }, redirect: "manual" });
const post = (path, body, headers = {}) =>
    realFetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": KEY, ...headers }, body: JSON.stringify(body) });

/** Logs in as `who` through the callback and returns where the browser was sent. */
async function login(who) {
    const res = await get(`/kite/callback?status=success&request_token=${who}&to=${encodeURIComponent("https://vault.example")}`);
    assert.equal(res.status, 302);
    return res.headers.get("location");
}
async function sessionFor(location) {
    const code = location.split("#kite=")[1];
    const res = await post("/kite/session", { code });
    assert.equal(res.status, 200);
    return (await res.json()).session;
}

test("login sends the browser to Kite, and only ever back to a known vault or a local one", async () => {
    let res = await get(`/kite/login?to=${encodeURIComponent("http://localhost:3001")}`);
    assert.equal(res.status, 302);
    const url = new URL(res.headers.get("location"));
    assert.equal(url.origin + url.pathname, "https://kite.zerodha.com/connect/login");
    assert.equal(url.searchParams.get("api_key"), "kitekey");
    assert.equal(url.searchParams.get("redirect_params"), "to=http%3A%2F%2Flocalhost%3A3001");

    res = await get(`/kite/login?to=${encodeURIComponent("https://evil.example/x")}`);
    assert.equal(new URL(res.headers.get("location")).searchParams.get("redirect_params"), "to=https%3A%2F%2Fvault.example");
});

test("a stranger's Zerodha account is turned away and its session ended", async () => {
    const location = await login("theirs");
    assert.equal(location, "https://vault.example/#kite-error=wrong-account");
    assert.deepEqual(revoked, ["tok-theirs"]);
    assert.equal(stored, null);
});

test("the owner's login is stored encrypted and handed over once", async () => {
    const location = await login("mine");
    assert.match(location, /^https:\/\/vault\.example\/#kite=[\w-]{20,}$/);
    assert.doesNotMatch(JSON.stringify(stored), /tok-mine/);
    assert.equal(new Date(stored.expiresAt).getUTCHours(), 0); // 6:00 AM India time
    assert.equal(new Date(stored.expiresAt).getUTCMinutes(), 30);

    const code = location.split("#kite=")[1];
    const first = await post("/kite/session", { code });
    assert.equal(first.status, 200);
    const body = await first.json();
    assert.equal(body.userName, "Owner Name");
    assert.ok(body.session);
    assert.equal((await post("/kite/session", { code })).status, 401); // used up

    const status = await (await get("/kite/status")).json();
    assert.deepEqual([status.configured, status.connected], [true, true]);
});

test("reads need the server key and this browser's session", async () => {
    const session = await sessionFor(await login("mine"));
    assert.equal((await get("/kite/account", { "x-api-key": "wrong", "x-kite-session": session })).status, 401);
    assert.equal((await get("/kite/account")).status, 401);
    assert.equal((await get("/kite/account", { "x-kite-session": `${session.split(".")[0]}.forged` })).status, 401);
});

test("the account comes back in parts, with today's charges for filled orders only", async () => {
    const session = await sessionFor(await login("mine"));
    chargesAsked.length = 0;
    const res = await get("/kite/account", { "x-kite-session": session });
    assert.equal(res.status, 200);
    const { sections } = await res.json();
    assert.equal(sections.profile.data.user_name, "Owner Name");
    assert.equal(sections.holdings.data[0].tradingsymbol, "INFY");
    assert.equal(sections.charges.data[0].charges.total, 1.5);
    assert.deepEqual(sections.alerts.error.code, "plan");
    assert.equal(chargesAsked.length, 1);
    assert.deepEqual(chargesAsked[0].map((o) => [o.order_id, o.quantity]), [["1", 10]]);
});

test("market data the plan doesn't cover says so; candles come back as objects", async () => {
    const session = await sessionFor(await login("mine"));
    const quote = await get("/kite/quote?i=NSE:INFY", { "x-kite-session": session });
    assert.equal(quote.status, 403);
    assert.equal((await quote.json()).code, "plan");
    assert.equal((await get("/kite/quote?i=nonsense", { "x-kite-session": session })).status, 400);

    const candles = await (await get("/kite/candles/408065?interval=day&days=5", { "x-kite-session": session })).json();
    assert.deepEqual(candles.candles[0], { t: "2026-10-06T00:00:00+0530", o: 1, h: 2, l: 0.5, c: 1.5, v: 100 });
    assert.equal((await get("/kite/candles/408065?interval=week", { "x-kite-session": session })).status, 400);
});

test("an expired Kite token clears the login and asks to connect again", async () => {
    const session = await sessionFor(await login("mine"));
    expireNext = true;
    const res = await get("/kite/quote?i=NSE:INFY", { "x-kite-session": session });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).code, "expired");
    assert.equal(stored.token, null);
});

test("disconnecting ends the login at Kite and signs every browser out", async () => {
    const location = await login("mine");
    const a = await sessionFor(location);
    revoked.length = 0;
    assert.equal((await post("/kite/logout", {}, { "x-kite-session": a })).status, 200);
    assert.deepEqual(revoked, ["tok-mine"]);

    // a fresh login doesn't revive the old session
    await login("mine");
    assert.equal((await get("/kite/account", { "x-kite-session": a })).status, 401);
});
