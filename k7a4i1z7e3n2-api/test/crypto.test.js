// Crypto wallets by public address: telling chains apart, adding wallets, and valuing what they hold.
// Run with: npm test
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.SERVER_KEYS = "test-key";
process.env.SERVER_KEY = "test-key";
const KEY = "test-key";

// wallets in memory
let wallets = [];
let n = 1;
const copy = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const p = require.resolve("../schema/CryptoWallet");
require.cache[p] = {
    id: p,
    filename: p,
    loaded: true,
    exports: {
        find: () => ({ sort: () => ({ lean: async () => copy(wallets) }) }),
        findOne: (q) => ({ lean: async () => copy(wallets.find((w) => w.address === q.address)) || null }),
        create: async (f) => {
            const doc = { _id: String(n++).padStart(24, "0"), ...f, createdAt: new Date().toISOString() };
            wallets.push(doc);
            return doc;
        },
        findByIdAndUpdate: (id, u) => ({
            lean: async () => {
                const w = wallets.find((x) => x._id === id);
                if (w) Object.assign(w, u.$set);
                return copy(w) || null;
            },
        }),
        findByIdAndDelete: (id) => ({
            lean: async () => {
                const w = wallets.find((x) => x._id === id);
                wallets = wallets.filter((x) => x._id !== id);
                return w || null;
            },
        }),
    },
};

const EVM = "0x1111111111111111111111111111111111111111";
const BTC = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
const TRON = "TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL";
const SOL = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

// the chains and the price feed
const realFetch = globalThis.fetch;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
let ethDown = false;
function outside(url, init = {}) {
    const u = new URL(url);
    if (u.host === "api.coingecko.com") {
        return json({ bitcoin: { inr: 8000000, usd: 80000 }, ethereum: { inr: 250000, usd: 2500 }, binancecoin: { inr: 75000, usd: 750 }, "polygon-ecosystem-token": { inr: 10, usd: 0.1 }, tron: { inr: 30, usd: 0.3 }, solana: { inr: 11000, usd: 110 }, tether: { inr: 96, usd: 1 }, "usd-coin": { inr: 96, usd: 1 } });
    }
    if (u.host === "mempool.space") return json({ chain_stats: { funded_txo_sum: 150000000, spent_txo_sum: 50000000 }, mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 } });
    if (u.host === "api.trongrid.io") return json({ success: true, data: [{ balance: 2500000, trc20: [{ TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t: "12500000" }] }] });
    const body = init.body ? JSON.parse(init.body) : {};
    if (/solana/.test(u.host)) {
        if (body.method === "getBalance") return json({ result: { value: 2500000000 } });
        const mint = body.params[1].mint;
        return json({ result: { value: [{ account: { data: { parsed: { info: { tokenAmount: { uiAmount: mint.startsWith("EPj") ? 40 : 0 } } } } } }] } });
    }
    // EVM: Ethereum's first endpoint is down when asked, to check the fallback
    if (u.host === "eth.drpc.org" && ethDown) return Promise.reject(new Error("down"));
    if (body.method === "eth_getBalance") return json({ result: u.host.includes("eth") ? "0xde0b6b3a7640000" : "0x0" }); // 1 ETH on Ethereum only
    if (body.method === "eth_call") {
        const usdtEth = body.params[0].to === "0xdAC17F958D2ee523a2206206994597C13D831ec7";
        return json({ result: usdtEth ? "0x" + (250n * 10n ** 6n).toString(16).padStart(64, "0") : "0x" + "0".repeat(64) });
    }
    return json({ error: { message: `unexpected ${url}` } });
}

let server;
let base;
before(async () => {
    globalThis.fetch = (url, init) => (String(url).startsWith("http://127.0.0.1") ? realFetch(url, init) : Promise.resolve().then(() => outside(url, init)));
    const express = require("express");
    const app = express();
    app.use(express.json());
    app.use("/crypto", require("../routes/cryptoRoute"));
    await new Promise((resolve) => (server = app.listen(0, resolve)));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
    globalThis.fetch = realFetch;
    server?.close();
});

const req = (path, { method = "GET", body } = {}) =>
    realFetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", "x-api-key": KEY }, body: body ? JSON.stringify(body) : undefined });

test("tells chains apart by address format", () => {
    const { detect } = require("../crypto");
    assert.equal(detect(EVM), "evm");
    assert.equal(detect(BTC), "btc");
    assert.equal(detect("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"), "btc");
    assert.equal(detect("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"), "btc");
    assert.equal(detect(TRON), "tron");
    assert.equal(detect(SOL), "sol");
    assert.equal(detect("hello"), null);
    assert.equal(detect("0x123"), null);
});

test("adds wallets by address, refusing bad and repeated ones", async () => {
    for (const [name, address] of [["Trust EVM", EVM], ["Cold BTC", BTC], ["Tron USDT", TRON], ["Phantom", SOL]]) {
        assert.equal((await req("/crypto/wallets", { method: "POST", body: { name, address } })).status, 201);
    }
    assert.equal((await req("/crypto/wallets", { method: "POST", body: { name: "Again", address: EVM } })).status, 409);
    assert.equal((await req("/crypto/wallets", { method: "POST", body: { name: "Bad", address: "not-an-address-at-all-really" } })).status, 400);
    assert.equal((await req("/crypto/wallets", { method: "POST", body: { name: "Mismatch", address: TRON, chain: "evm" } })).status, 400);
    assert.equal((await req("/crypto/wallets", { method: "POST", body: { name: "", address: BTC } })).status, 400);
    assert.deepEqual(wallets.map((w) => w.chain), ["evm", "btc", "tron", "sol"]);
});

test("values every coin in rupees and dollars, leaving out empty ones", async () => {
    ethDown = true; // Ethereum's first endpoint fails; the second one answers
    const { wallets: out } = await (await req("/crypto/wallets")).json();
    const by = Object.fromEntries(out.map((w) => [w.name, w]));

    const evm = by["Trust EVM"];
    assert.deepEqual(evm.holdings.map((h) => `${h.network}:${h.symbol}`).sort(), ["Ethereum:ETH", "Ethereum:USDT"]);
    assert.equal(evm.inr, 250000 + 250 * 96);
    assert.equal(evm.usd, 2500 + 250);
    assert.equal(evm.error, null);

    assert.equal(by["Cold BTC"].holdings[0].amount, 1);
    assert.equal(by["Cold BTC"].inr, 8000000);
    assert.deepEqual(by["Tron USDT"].holdings.map((h) => [h.symbol, h.amount]), [["USDT", 12.5], ["TRX", 2.5]]);
    assert.deepEqual(by.Phantom.holdings.map((h) => [h.symbol, h.amount]), [["SOL", 2.5], ["USDC", 40]]);
});

test("renames and removes a wallet", async () => {
    const id = wallets[0]._id;
    assert.equal((await (await req(`/crypto/wallets/${id}`, { method: "PUT", body: { name: "Trust main" } })).json()).name, "Trust main");
    assert.equal((await req(`/crypto/wallets/${id}`, { method: "DELETE" })).status, 200);
    assert.equal((await req(`/crypto/wallets/${id}`, { method: "DELETE" })).status, 404);
});
