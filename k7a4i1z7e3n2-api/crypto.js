// Crypto wallets by public address, read only: nothing here ever needs a key or a seed phrase.
// Balances come from public blockchain endpoints and prices from CoinGecko, all free:
//   Bitcoin  mempool.space
//   EVM      Ethereum, BNB Chain, Polygon, Arbitrum, Base, Optimism: the native coin plus USDT/USDC
//   Tron     TronGrid: TRX plus USDT
//   Solana   public RPC: SOL plus USDT/USDC
// Each chain has a second endpoint to fall back on.

const timeout = (ms) => AbortSignal.timeout(ms);

async function getJson(url, headers = {}) {
    const res = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: timeout(15000) });
    if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
    return res.json();
}

/** A JSON-RPC call, trying each endpoint in turn. */
async function rpc(urls, method, params) {
    let last;
    for (const url of urls) {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
                signal: timeout(12000),
            });
            const out = await res.json();
            if (out.error) throw new Error(out.error.message || "RPC error");
            return out.result;
        } catch (err) {
            last = err;
        }
    }
    throw new Error(`No endpoint answered (${last?.message || "unknown"})`);
}

/** A whole-number amount in a token's smallest unit, as a plain number of tokens. */
function units(raw, decimals) {
    const v = BigInt(raw || 0);
    const base = 10n ** BigInt(decimals);
    return Number(v / base) + Number(v % base) / Number(base);
}

// CoinGecko ids for everything a wallet here can hold
const COINS = {
    BTC: "bitcoin",
    ETH: "ethereum",
    BNB: "binancecoin",
    POL: "polygon-ecosystem-token",
    TRX: "tron",
    SOL: "solana",
    USDT: "tether",
    USDC: "usd-coin",
};

const EVM = [
    { network: "Ethereum", native: "ETH", rpc: ["https://eth.drpc.org", "https://ethereum-rpc.publicnode.com"], tokens: { USDT: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", 6], USDC: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6] } },
    { network: "BNB Chain", native: "BNB", rpc: ["https://bsc-rpc.publicnode.com", "https://bsc.drpc.org"], tokens: { USDT: ["0x55d398326f99059fF775485246999027B3197955", 18], USDC: ["0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", 18] } },
    { network: "Polygon", native: "POL", rpc: ["https://polygon.drpc.org", "https://polygon-bor-rpc.publicnode.com"], tokens: { USDT: ["0xc2132D05D31c914a87C6611C10748AEb04B58e8F", 6], USDC: ["0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", 6] } },
    { network: "Arbitrum", native: "ETH", rpc: ["https://arbitrum-one-rpc.publicnode.com", "https://arbitrum.drpc.org"], tokens: { USDT: ["0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", 6], USDC: ["0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 6] } },
    { network: "Base", native: "ETH", rpc: ["https://base-rpc.publicnode.com", "https://base.drpc.org"], tokens: { USDC: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 6] } },
    { network: "Optimism", native: "ETH", rpc: ["https://optimism-rpc.publicnode.com", "https://optimism.drpc.org"], tokens: { USDT: ["0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", 6], USDC: ["0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", 6] } },
];

const TRON_USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const SOL_RPC = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"];
const SOL_TOKENS = { USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" };

/** Which chain an address belongs to, from its format. Solana's are longer than Bitcoin's. */
function detect(address) {
    const a = String(address || "").trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(a)) return "evm";
    if (/^bc1[02-9ac-hj-np-z]{11,71}$/.test(a)) return "btc";
    if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return "tron";
    if (/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a)) return "btc";
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return "sol";
    return null;
}

const balanceOf = (address) => `0x70a08231${"0".repeat(24)}${address.slice(2).toLowerCase()}`;

async function readEvm(address) {
    const out = [];
    const errors = [];
    await Promise.all(
        EVM.map(async (c) => {
            try {
                const [native, ...tokens] = await Promise.all([
                    rpc(c.rpc, "eth_getBalance", [address, "latest"]),
                    ...Object.values(c.tokens).map(([contract]) => rpc(c.rpc, "eth_call", [{ to: contract, data: balanceOf(address) }, "latest"])),
                ]);
                out.push({ network: c.network, symbol: c.native, amount: units(native, 18) });
                Object.entries(c.tokens).forEach(([symbol, [, dec]], i) => out.push({ network: c.network, symbol, amount: units(tokens[i] === "0x" ? 0 : tokens[i], dec) }));
            } catch (err) {
                errors.push(`${c.network}: ${err.message}`);
            }
        })
    );
    return { holdings: out, errors };
}

async function readBtc(address) {
    const j = await getJson(`https://mempool.space/api/address/${encodeURIComponent(address)}`);
    const sats = (j.chain_stats?.funded_txo_sum || 0) - (j.chain_stats?.spent_txo_sum || 0) + (j.mempool_stats?.funded_txo_sum || 0) - (j.mempool_stats?.spent_txo_sum || 0);
    return { holdings: [{ network: "Bitcoin", symbol: "BTC", amount: sats / 1e8 }], errors: [] };
}

async function readTron(address) {
    const key = (process.env.TRONGRID_KEY || "").trim();
    const j = await getJson(`https://api.trongrid.io/v1/accounts/${encodeURIComponent(address)}`, key ? { "TRON-PRO-API-KEY": key } : {});
    const acc = j.data?.[0]; // missing until the address has ever received anything
    const usdt = (acc?.trc20 || []).reduce((a, t) => a + (t[TRON_USDT] ? units(t[TRON_USDT], 6) : 0), 0);
    return {
        holdings: [
            { network: "Tron", symbol: "TRX", amount: (acc?.balance || 0) / 1e6 },
            { network: "Tron", symbol: "USDT", amount: usdt },
        ],
        errors: [],
    };
}

async function readSol(address) {
    const [lamports, ...tokens] = await Promise.all([
        rpc(SOL_RPC, "getBalance", [address]),
        ...Object.values(SOL_TOKENS).map((mint) => rpc(SOL_RPC, "getTokenAccountsByOwner", [address, { mint }, { encoding: "jsonParsed" }])),
    ]);
    const sum = (r) => (r?.value || []).reduce((a, t) => a + (t.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0), 0);
    return {
        holdings: [
            { network: "Solana", symbol: "SOL", amount: (lamports?.value || 0) / 1e9 },
            ...Object.keys(SOL_TOKENS).map((symbol, i) => ({ network: "Solana", symbol, amount: sum(tokens[i]) })),
        ],
        errors: [],
    };
}

const READERS = { evm: readEvm, btc: readBtc, tron: readTron, sol: readSol };

let priceCache = null; // { at, value }: the last good prices
let pricing = null; // the request in flight, shared by every wallet read at once

const PRICE_TTL = 5 * 60 * 1000;

/** CoinGecko: rupee and dollar prices with the day's change, in one call. */
async function geckoPrices() {
    const key = (process.env.COINGECKO_KEY || "").trim();
    const j = await getJson(
        `https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(COINS).join(",")}&vs_currencies=inr,usd&include_24hr_change=true`,
        key ? { "x-cg-demo-api-key": key } : {}
    );
    return Object.fromEntries(
        Object.entries(COINS).map(([sym, id]) => [sym, { inr: j[id]?.inr ?? null, usd: j[id]?.usd ?? null, change24h: j[id]?.inr_24h_change ?? j[id]?.usd_24h_change ?? null }])
    );
}

/**
 * Binance's public market data (no key, not region-locked): each coin against USDT, turned into
 * rupees at the day's USD/INR. For when CoinGecko's free tier is rate-limiting this server.
 */
async function binancePrices() {
    const pairs = Object.keys(COINS).filter((s) => s !== "USDT").map((s) => `${s}USDT`);
    const [list, fx] = await Promise.all([
        getJson(`https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(pairs))}`),
        require("./market").usdInr(),
    ]);
    const bySym = new Map((Array.isArray(list) ? list : []).map((t) => [t.symbol, t]));
    return Object.fromEntries(
        Object.keys(COINS).map((sym) => {
            if (sym === "USDT") return [sym, { usd: 1, inr: fx.rate, change24h: 0 }];
            const t = bySym.get(`${sym}USDT`);
            const usd = t ? Number(t.lastPrice) : null;
            return [sym, { usd, inr: usd != null ? usd * fx.rate : null, change24h: t ? Number(t.priceChangePercent) : null }];
        })
    );
}

/**
 * Each coin's price in rupees and dollars, with its 24-hour change. Cached for five minutes; from
 * CoinGecko, else Binance; if both fail, the last good prices rather than none.
 */
async function prices() {
    if (priceCache && Date.now() - priceCache.at < PRICE_TTL) return priceCache.value;
    if (!pricing) {
        pricing = (async () => {
            const problems = [];
            for (const source of [geckoPrices, binancePrices]) {
                try {
                    const value = await source();
                    if (Object.values(value).some((p) => p.inr != null)) {
                        priceCache = { at: Date.now(), value };
                        return value;
                    }
                    problems.push(`${source.name}: no prices`);
                } catch (err) {
                    problems.push(err.message);
                }
            }
            if (priceCache) return priceCache.value; // stale beats nothing
            throw new Error(problems.join("; "));
        })().finally(() => {
            pricing = null;
        });
    }
    return pricing;
}

const balanceCache = new Map(); // "chain:address" → { at, value }

/** One wallet's coins with their value; zero balances left out. Cached for five minutes. */
async function readWallet(chain, address, { fresh = false } = {}) {
    const key = `${chain}:${address}`;
    const hit = balanceCache.get(key);
    if (!fresh && hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;
    const read = READERS[chain];
    if (!read) throw new Error("Unknown chain");
    const value = await read(address);
    value.holdings = value.holdings.filter((h) => h.amount > 0);
    balanceCache.set(key, { at: Date.now(), value });
    return value;
}

const clearCaches = () => {
    priceCache = null;
    pricing = null;
    balanceCache.clear();
};

module.exports = { detect, readWallet, prices, units, COINS, EVM, clearCaches };
