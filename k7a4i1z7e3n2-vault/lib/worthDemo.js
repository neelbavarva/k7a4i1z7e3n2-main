// Sample MT5, hand-typed and crypto data, shaped like the server's answers, at the size of a
// real retail account rather than a showcase. Nothing here is real.

export const demoFx = () => ({ rate: 96.73, date: new Date().toISOString().slice(0, 10), source: "Sample" });

export function demoMt5() {
    const ago = (ms) => new Date(Date.now() - ms).toISOString();
    return {
        fetchedAt: new Date().toISOString(),
        sources: { addon: { ok: true, accounts: 2 } },
        accounts: [
            {
                id: "mt5-81234567",
                login: "81234567",
                source: "addon",
                live: true,
                updatedAt: ago(40e3),
                label: "Exness",
                server: "Exness-MT5Real8",
                prop: false,
                counted: true,
                info: { broker: "Exness Technologies Ltd", server: "Exness-MT5Real8", login: 81234567, currency: "USD", balance: 412.6, equity: 431.15, margin: 21.4, freeMargin: 409.75, leverage: 500, marginLevel: 2014.7 },
                positions: [{ id: "1", symbol: "XAUUSD", type: "POSITION_TYPE_BUY", volume: 0.01, openPrice: 2641.2, currentPrice: 2659.75, profit: 18.55, swap: -0.12 }],
                error: null,
            },
            {
                id: "mt5-20935336",
                login: "20935336",
                source: "addon",
                live: false,
                updatedAt: ago(5 * 36e5),
                label: "FundingPips 20935336",
                server: "FundingPips-SIM1",
                prop: true,
                counted: false,
                info: { broker: "FundingPips", server: "FundingPips-SIM1", login: 20935336, currency: "USD", balance: 5000, equity: 5000, margin: 0, freeMargin: 5000, leverage: 100, marginLevel: 0 },
                positions: [],
                error: null,
            },
        ],
    };
}

export function demoManual() {
    const ago = (days) => new Date(Date.now() - days * 864e5).toISOString();
    return [
        { _id: "m1", name: "HDFC savings", kind: "bank", bank: "hdfc", amount: 42180, currency: "INR", note: "", updatedAt: ago(2) },
        { _id: "m2", name: "SBI savings", kind: "bank", bank: "sbi", amount: 8950.75, currency: "INR", note: "", updatedAt: ago(9) },
        { _id: "m3", name: "SBI fixed deposit", kind: "deposit", bank: "sbi", amount: 25000, currency: "INR", note: "Matures March", updatedAt: ago(41) },
        { _id: "m4", name: "Wise USD balance", kind: "cash", bank: "wise", amount: 120, currency: "USD", note: "", updatedAt: ago(5) },
        { _id: "m5", name: "Credit card due", kind: "loan", bank: "icici", amount: 6420, currency: "INR", note: "", updatedAt: ago(1) },
    ];
}

export function demoCrypto() {
    const h = (network, symbol, amount, inr, usd, change24h = 0) => ({ network, symbol, amount, inr: amount * inr, usd: amount * usd, change24h });
    const at = (chain, address, holdings) => ({ chain, address, holdings, inr: holdings.reduce((a, x) => a + x.inr, 0), usd: holdings.reduce((a, x) => a + x.usd, 0), error: null });
    const wallet = (_id, name, kind, addresses) => {
        const holdings = addresses.flatMap((a) => a.holdings).sort((x, y) => y.inr - x.inr);
        return { _id, name, kind, addresses, holdings, inr: addresses.reduce((a, x) => a + x.inr, 0), usd: addresses.reduce((a, x) => a + x.usd, 0), error: null };
    };
    return {
        fetchedAt: new Date().toISOString(),
        priceError: null,
        wallets: [
            wallet("c1", "Trust Wallet", "trust", [
                at("evm", "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE", [
                    h("BNB Chain", "USDT", 85, 96.7, 1),
                    h("Ethereum", "ETH", 0.012, 248832, 2571.86, -4.3),
                    h("BNB Chain", "BNB", 0.15, 74590, 770.94, -1.1),
                ]),
                at("btc", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", [h("Bitcoin", "BTC", 0.0009, 8082449, 83538, -2)]),
                at("tron", "TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL", [h("Tron", "USDT", 30, 96.7, 1), h("Tron", "TRX", 35.2, 32.45, 0.335)]),
            ]),
            wallet("c2", "Phantom", "phantom", [at("sol", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", [h("Solana", "SOL", 0.6, 11323.64, 117.04, 1.8), h("Solana", "USDC", 20, 96.7, 1)])]),
        ],
    };
}

/** Five months of daily totals that wander upwards; the page scales them to end at the sample's total. */
export function demoHistory() {
    let seed = 42;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const out = [];
    let v = 100;
    for (let i = 150; i >= 1; i--) {
        v *= 1 + (rand() - 0.46) * 0.018;
        out.push({ date: new Date(Date.now() + 5.5 * 36e5 - i * 864e5).toISOString().slice(0, 10), total: v });
    }
    return out;
}
