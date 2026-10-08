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
let synced = 0;
const copy = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const p = require.resolve("../schema/CryptoWallet");
require.cache[p] = {
    id: p,
    filename: p,
    loaded: true,
    exports: {
        find: () => ({ sort: () => ({ lean: async () => copy(wallets) }), lean: async () => copy(wallets) }),
        syncIndexes: async () => {
            synced++;
        },
        create: async (f) => {
            const doc = { _id: String(n++).padStart(24, "0"), ...f, createdAt: new Date().toISOString() };
            wallets.push(doc);
            return doc;
        },
        findByIdAndUpdate: (id, u) => ({
            lean: async () => {
                const w = wallets.find((x) => x._id === id);
                if (w) {
                    Object.assign(w, u.$set);
                    for (const k of Object.keys(u.$unset || {})) delete w[k];
                }
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
let geckoLimited = false; // CoinGecko's free tier saying 429
let binanceDown = false;
function outside(url, init = {}) {
    const u = new URL(url);
    if (u.host === "api.coingecko.com" && geckoLimited) return json({ status: { error_code: 429 } }, 429);
    if (u.host === "data-api.binance.vision") {
        if (binanceDown) return Promise.reject(new Error("down"));
        const t = (symbol, lastPrice, priceChangePercent) => ({ symbol, lastPrice: String(lastPrice), priceChangePercent: String(priceChangePercent) });
        return json([t("BTCUSDT", 80000, -2.5), t("ETHUSDT", 2500, 1.5), t("SOLUSDT", 110, 3), t("USDCUSDT", 1, 0)]);
    }
    if (u.host === "api.frankfurter.dev") return json({ date: "2026-10-08", rates: { INR: 96 } });
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

test("adds a wallet with all its addresses pasted at once, each told apart", async () => {
    const r = await req("/crypto/wallets", { method: "POST", body: { name: "Trust Wallet", addresses: `${EVM}\n${BTC}, ${TRON}  ${SOL}\n${EVM.toUpperCase().replace("0X", "0x")}` } });
    assert.equal(r.status, 201);
    const w = await r.json();
    assert.deepEqual(w.addresses.map((a) => a.chain), ["evm", "btc", "tron", "sol"]); // the repeated EVM one only once
    assert.equal(synced, 1); // the old unique index is dropped before the first write
});

test("refuses a bad address, an empty list, and an address already in another wallet", async () => {
    const bad = await req("/crypto/wallets", { method: "POST", body: { name: "Bad", addresses: [EVM.replace("0x1", "0x2"), "not-an-address-at-all"] } });
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).message, /not-an-address-at-all/);
    assert.equal((await req("/crypto/wallets", { method: "POST", body: { name: "Empty", addresses: "  " } })).status, 400);
    assert.equal((await req("/crypto/wallets", { method: "POST", body: { name: "Again", addresses: [BTC] } })).status, 409);
    assert.equal((await req("/crypto/wallets", { method: "POST", body: { name: "", addresses: [BTC] } })).status, 400);
});

test("values every coin across a wallet's addresses, leaving out empty ones", async () => {
    ethDown = true; // Ethereum's first endpoint fails; the second one answers
    const { wallets: out } = await (await req("/crypto/wallets")).json();
    const w = out.find((x) => x.name === "Trust Wallet");
    assert.equal(w.addresses.length, 4);
    const by = Object.fromEntries(w.addresses.map((a) => [a.chain, a]));
    assert.deepEqual(by.evm.holdings.map((h) => `${h.network}:${h.symbol}`).sort(), ["Ethereum:ETH", "Ethereum:USDT"]);
    assert.equal(by.evm.inr, 250000 + 250 * 96);
    assert.equal(by.btc.inr, 8000000);
    assert.deepEqual(by.tron.holdings.map((h) => [h.symbol, h.amount]), [["USDT", 12.5], ["TRX", 2.5]]);
    assert.deepEqual(by.sol.holdings.map((h) => [h.symbol, h.amount]), [["SOL", 2.5], ["USDC", 40]]);
    assert.equal(w.inr, by.evm.inr + by.btc.inr + by.tron.inr + by.sol.inr);
    assert.equal(w.holdings[0].symbol, "BTC"); // the wallet's coins together, biggest first
    assert.equal(w.error, null);
});

test("reads a wallet saved before addresses were grouped, and moves it to the list when edited", async () => {
    wallets.push({ _id: "f".repeat(24), name: "Old BTC", address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", chain: "btc", createdAt: new Date().toISOString() });
    const { wallets: out } = await (await req("/crypto/wallets")).json();
    const old = out.find((x) => x.name === "Old BTC");
    assert.deepEqual(old.addresses.map((a) => a.chain), ["btc"]);
    const put = await req(`/crypto/wallets/${"f".repeat(24)}`, { method: "PUT", body: { addresses: ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"] } });
    assert.equal(put.status, 200);
    const doc = wallets.find((x) => x.name === "Old BTC");
    assert.equal(doc.address, undefined);
    assert.equal(doc.addresses.length, 2);
});

test("renames and removes a wallet", async () => {
    const id = wallets[0]._id;
    assert.equal((await (await req(`/crypto/wallets/${id}`, { method: "PUT", body: { name: "Trust main" } })).json()).name, "Trust main");
    assert.equal((await req(`/crypto/wallets/${id}`, { method: "PUT", body: { addresses: [TRON, "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"] } })).status, 409); // that one's in Old BTC
    assert.equal((await req(`/crypto/wallets/${id}`, { method: "DELETE" })).status, 200);
    assert.equal((await req(`/crypto/wallets/${id}`, { method: "DELETE" })).status, 404);
});

test("prices: CoinGecko rate-limited falls back to Binance, and both down keeps the last good prices", async () => {
    const crypto = require("../crypto");
    crypto.clearCaches();
    geckoLimited = true;
    try {
        const p = await crypto.prices();
        assert.equal(p.BTC.usd, 80000);
        assert.equal(p.BTC.inr, 80000 * 96);
        assert.equal(p.BTC.change24h, -2.5);
        assert.equal(p.USDT.inr, 96);
        // later, with both sources down and the cache past its five minutes: the last good prices
        binanceDown = true;
        const realNow = Date.now;
        Date.now = () => realNow() + 10 * 60 * 1000;
        try {
            const stale = await crypto.prices();
            assert.equal(stale.BTC.usd, 80000);
        } finally {
            Date.now = realNow;
        }
        // nothing ever loaded: an error that says why
        crypto.clearCaches();
        await assert.rejects(crypto.prices(), /429/);
    } finally {
        geckoLimited = false;
        binanceDown = false;
        crypto.clearCaches();
    }
});
