// Trades: archiving one keeps it in the journal and only changes that flag.
// Run with: npm test
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.SERVER_KEYS = "test-key";
process.env.SERVER_KEY = "test-key";
const KEY = "test-key";

const fake = (path, exports) => {
    const p = require.resolve(path);
    require.cache[p] = { id: p, filename: p, loaded: true, exports };
};

// the trades in memory
const trades = new Map();
fake("../schema/Trade", {
    findByIdAndUpdate: async (id, u) => {
        const doc = trades.get(id);
        if (!doc) return null;
        Object.assign(doc, u.$set || u);
        return { ...doc };
    },
});
fake("../schema/StrategyPoint", {});
fake("../schema/StrategyPointSecondary", {});

let server;
let base;
before(async () => {
    const express = require("express");
    const app = express();
    app.use(express.json());
    app.use("/trades", require("../routes/tradeRoute"));
    await new Promise((resolve) => (server = app.listen(0, resolve)));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server?.close());

const put = (path, body, key = KEY) =>
    fetch(`${base}${path}`, { method: "PUT", headers: { "Content-Type": "application/json", "x-api-key": key }, body: JSON.stringify(body) });

test("archives a trade and brings it back, touching nothing else", async () => {
    trades.set("t1", { _id: "t1", tradeSymbol: "EURUSD", tradeType: "Real", tradeStatus: "Closed", totalPnL: 42.5, archived: false, archivedAt: null });

    const on = await (await put("/trades/archiveTrade/t1", { archived: true })).json();
    assert.equal(on.updatedTrade.archived, true);
    assert.ok(on.updatedTrade.archivedAt, "when it was archived");
    assert.equal(on.updatedTrade.totalPnL, 42.5); // the result is left as it was

    const off = await (await put("/trades/archiveTrade/t1", { archived: false })).json();
    assert.equal(off.updatedTrade.archived, false);
    assert.equal(off.updatedTrade.archivedAt, null);
});

test("refuses anything but true or false, an unknown trade, and a missing key", async () => {
    assert.equal((await put("/trades/archiveTrade/t1", { archived: "yes" })).status, 400);
    assert.equal((await put("/trades/archiveTrade/nope", { archived: true })).status, 404);
    assert.equal((await put("/trades/archiveTrade/t1", { archived: true }, "wrong")).status, 401);
});
