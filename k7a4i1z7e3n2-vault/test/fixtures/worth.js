// Made-up hand-typed and crypto data for the tests, shaped like the server's answers, at the size
// of a real retail account rather than a showcase.

export function demoManual() {
    const ago = (days) => new Date(Date.now() - days * 864e5).toISOString();
    return [
        {
            _id: "m1",
            name: "HDFC savings",
            kind: "bank",
            bank: "hdfc",
            amount: 42180,
            currency: "INR",
            note: "",
            updatedAt: ago(2),
            // the figures it had before, oldest first, as the API keeps them
            history: [
                { at: ago(64), amount: 31500, currency: "INR" },
                { at: ago(40), amount: 36920, currency: "INR" },
                { at: ago(21), amount: 34210.5, currency: "INR" },
            ],
        },
        { _id: "m2", name: "SBI savings", kind: "bank", bank: "sbi", amount: 8950.75, currency: "INR", note: "", updatedAt: ago(9) },
        { _id: "m3", name: "SBI fixed deposit", kind: "deposit", bank: "sbi", amount: 25000, currency: "INR", note: "Matures March", updatedAt: ago(41) },
        { _id: "m4", name: "Wise USD balance", kind: "cash", bank: "wise", amount: 120, currency: "USD", note: "", updatedAt: ago(5) },
        { _id: "m6", name: "Merrill", kind: "invest", bank: "bofa", amount: 1840, currency: "USD", note: "", updatedAt: ago(3) },
        { _id: "m7", name: "Parag Parikh Flexi Cap Fund", kind: "funds", bank: "Groww", amount: 31650, currency: "INR", note: "", scheme: 122639, updatedAt: ago(6) },
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
