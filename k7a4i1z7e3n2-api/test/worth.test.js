// Net worth sources: the dollar rate, hand-typed entries, Groww and MT5 through MetaApi.
// Run with: npm test
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

process.env.SERVER_KEYS = "test-key";
process.env.SERVER_KEY = "test-key";
process.env.GROWW_API_KEY = "groww-key";
process.env.GROWW_API_SECRET = "groww-secret";
process.env.METAAPI_TOKEN = "meta-token";
process.env.METAAPI_ACCOUNTS = "Exness:acc-exness-1, FundingPips:acc-fp-0001";
process.env.METAAPI_REGION = "london";
const KEY = "test-key";

const fake = (path, exports) => {
    const p = require.resolve(path);
    require.cache[p] = { id: p, filename: p, loaded: true, exports };
};

// Groww's token store: one document in memory
let growwDoc = null;
const copy = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
fake("../schema/GrowwSession", {
    findById: () => ({ lean: async () => copy(growwDoc) }),
    findByIdAndUpdate: (id, u) => ({ lean: async () => (growwDoc = { _id: id, ...(growwDoc || {}), ...u.$set }) }),
});

// hand-typed entries in memory
let manual = [];
let nextId = 1;
const oid = () => String(nextId++).padStart(24, "0");
fake("../schema/ManualAsset", {
    find: () => ({ sort: () => ({ lean: async () => copy(manual) }) }),
    create: async (f) => {
        const doc = { _id: oid(), ...f };
        manual.push(doc);
        return doc;
    },
    findByIdAndUpdate: (id, u) => ({
        lean: async () => {
            const doc = manual.find((m) => m._id === id);
            if (doc) Object.assign(doc, u.$set);
            return copy(doc) || null;
        },
    }),
    findByIdAndDelete: (id) => ({
        lean: async () => {
            const doc = manual.find((m) => m._id === id);
            manual = manual.filter((m) => m._id !== id);
            return doc || null;
        },
    }),
});

// the outside world
let approved = true;
let issued = 0;
const seenGroww = [];
const realFetch = globalThis.fetch;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function outside(url, init = {}) {
    const u = new URL(url);
    if (u.host === "api.frankfurter.dev") return json(200, { base: "USD", date: "2026-10-07", rates: { INR: 96.5 } });
    if (u.host === "query1.finance.yahoo.com") {
        const sym = decodeURIComponent(u.pathname.split("/").pop());
        if (sym === "RELIANCE.NS") return json(200, { chart: { result: [{ meta: { regularMarketPrice: 1400, chartPreviousClose: 1390, regularMarketTime: 1791366301 } }] } });
        if (sym === "SMALLCO.BO") return json(200, { chart: { result: [{ meta: { regularMarketPrice: 55, chartPreviousClose: 50 } }] } });
        return json(404, { chart: { result: null } });
    }
    if (u.host === "api.groww.in") {
        seenGroww.push({ path: u.pathname, auth: init.headers?.Authorization, version: init.headers?.["X-API-VERSION"] });
        if (u.pathname === "/v1/token/api/access") {
            const body = JSON.parse(init.body);
            const ok = body.checksum === crypto.createHash("sha256").update("groww-secret" + body.timestamp).digest("hex");
            if (!approved || !ok || init.headers.Authorization !== "Bearer groww-key") return json(401, { status: "FAILURE", error: { code: "GA005", message: "Not approved" } });
            issued++;
            return json(200, { token: `tok-${issued}`, isActive: true });
        }
        if (!/^Bearer tok-\d+$/.test(init.headers?.Authorization || "")) return json(401, { status: "FAILURE", error: { message: "Bad token" } });
        if (u.pathname === "/v1/holdings/user")
            return json(200, { status: "SUCCESS", payload: { holdings: [{ trading_symbol: "RELIANCE", isin: "INE002A01018", quantity: 10, average_price: 1300 }, { trading_symbol: "SMALLCO", quantity: 100, average_price: 40 }, { trading_symbol: "GHOST", quantity: 1, average_price: 10 }] } });
        if (u.pathname === "/v1/positions/user")
            return json(200, { status: "SUCCESS", payload: { positions: u.searchParams.get("segment") === "FNO" ? [{ trading_symbol: "NIFTY", quantity: 75, realised_pnl: 1200 }] : [] } });
        if (u.pathname === "/v1/margins/detail/user") return json(200, { status: "SUCCESS", payload: { clear_cash: 5000, net_margin_used: 1000 } });
    }
    if (u.host === "mt-client-api-v1.london.agiliumtrade.ai") {
        assert.equal(init.headers["auth-token"], "meta-token");
        if (u.pathname.includes("acc-fp-0001")) return json(404, { message: "Not found" });
        if (u.pathname.endsWith("/account-information")) return json(200, { balance: 1000, equity: 1050.5, currency: "USD", broker: "Exness", login: 123 });
        if (u.pathname.endsWith("/positions")) return json(200, [{ symbol: "EURUSD", type: "POSITION_TYPE_BUY", volume: 0.1, profit: 50.5 }]);
    }
    return json(599, { message: `unexpected ${url}` });
}

let server;
let base;
before(async () => {
    globalThis.fetch = (url, init) => (String(url).startsWith("http://127.0.0.1") ? realFetch(url, init) : Promise.resolve(outside(url, init)));
    const express = require("express");
    const app = express();
    app.use(express.json());
    app.use("/worth", require("../routes/worthRoute"));
    app.use("/groww", require("../routes/growwRoute"));
    app.use("/mt5", require("../routes/mt5Route"));
    await new Promise((resolve) => (server = app.listen(0, resolve)));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
    globalThis.fetch = realFetch;
    server?.close();
});

const req = (path, { method = "GET", body, key = KEY } = {}) =>
    realFetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", "x-api-key": key }, body: body ? JSON.stringify(body) : undefined });

test("gives the dollar rate", async () => {
    const r = await (await req("/worth/fx")).json();
    assert.equal(r.rate, 96.5);
});

test("keeps hand-typed entries: add, change, list, remove, and checks what's sent", async () => {
    const add = await req("/worth/manual", { method: "POST", body: { name: "HDFC savings", kind: "bank", amount: 125000.5, currency: "INR" } });
    assert.equal(add.status, 201);
    const { _id } = await add.json();
    assert.equal((await req("/worth/manual", { method: "POST", body: { name: "", kind: "bank", amount: 1, currency: "INR" } })).status, 400);
    assert.equal((await req("/worth/manual", { method: "POST", body: { name: "x", kind: "gold", amount: 1, currency: "INR" } })).status, 400);
    assert.equal((await req("/worth/manual", { method: "POST", body: { name: "x", kind: "bank", amount: -5, currency: "INR" } })).status, 400);

    const put = await req(`/worth/manual/${_id}`, { method: "PUT", body: { name: "HDFC savings", kind: "bank", amount: 99000, currency: "INR", note: "after rent" } });
    assert.equal((await put.json()).amount, 99000);
    const list = await (await req("/worth/manual")).json();
    assert.deepEqual(list.map((m) => [m.name, m.amount, m.note]), [["HDFC savings", 99000, "after rent"]]);
    assert.equal((await req(`/worth/manual/${_id}`, { method: "DELETE" })).status, 200);
    assert.equal((await req(`/worth/manual/${_id}`, { method: "DELETE" })).status, 404);
    assert.equal((await req("/worth/manual", { key: "wrong" })).status, 401);
});

test("Groww: asks for today's approval until it's given", async () => {
    approved = false;
    const r = await req("/groww/account");
    assert.equal(r.status, 401);
    assert.equal((await r.json()).code, "approve");
    approved = true;
});

test("Groww: trades the key for a token once, encrypts it, and values holdings with delayed prices", async () => {
    const r = await req("/groww/account");
    assert.equal(r.status, 200);
    const { sections } = await r.json();
    const by = Object.fromEntries(sections.holdings.data.map((h) => [h.trading_symbol, h]));
    assert.equal(by.RELIANCE.last_price, 1400);
    assert.equal(by.RELIANCE.close_price, 1390);
    assert.equal(by.SMALLCO.last_price, 55); // only on BSE
    assert.equal(by.GHOST.last_price, null);
    assert.deepEqual(sections.positions.data.map((p) => [p.trading_symbol, p.segment]), [["NIFTY", "FNO"]]);
    assert.equal(sections.funds.data.clear_cash, 5000);
    assert.doesNotMatch(JSON.stringify(growwDoc), /tok-/);
    assert.ok(seenGroww.filter((s) => s.path !== "/v1/token/api/access").every((s) => s.version === "1.0"));

    const before = issued;
    await req("/groww/account");
    assert.equal(issued, before); // the stored token is reused
    const status = await (await req("/groww/status")).json();
    assert.deepEqual([status.configured, status.connected], [true, true]);
});

test("MT5: reads each account, marks the prop one, and reports one that fails on its own", async () => {
    const r = await (await req("/mt5/accounts")).json();
    const [ex, fp] = r.accounts;
    assert.equal(ex.label, "Exness");
    assert.equal(ex.prop, false);
    assert.equal(ex.info.equity, 1050.5);
    assert.equal(ex.positions[0].symbol, "EURUSD");
    assert.equal(fp.label, "FundingPips");
    assert.equal(fp.prop, true);
    assert.match(fp.error, /not deployed/);
});
