// Sample Groww, MT5 and hand-typed data, shaped like the server's answers. Nothing here is real.

export const demoFx = () => ({ rate: 96.73, date: new Date().toISOString().slice(0, 10), source: "Sample" });

export function demoGroww() {
    const h = (trading_symbol, quantity, average_price, last_price, close_price) => ({ trading_symbol, isin: `DEMO${trading_symbol}`, quantity, average_price, last_price, close_price });
    return {
        fetchedAt: new Date().toISOString(),
        sections: {
            holdings: {
                data: [
                    h("TCS", 8, 3420, 3561.2, 3540.8),
                    h("BEL", 120, 212.5, 401.35, 398.1),
                    h("IRCTC", 25, 702, 768.9, 772.4),
                    h("ZOMATO", 150, 148.2, 312.6, 309.95),
                    h("SBIN", 40, 590, 817.9, 812.3),
                ],
            },
            positions: { data: [{ trading_symbol: "BANKNIFTY26OCT56000PE", segment: "FNO", quantity: 30, net_price: 412.5, realised_pnl: 0, exchange: "NSE", product: "NRML" }] },
            funds: { data: { clear_cash: 21840.5, net_margin_used: 12375, collateral_available: 0 } },
        },
    };
}

export function demoMt5() {
    return {
        fetchedAt: new Date().toISOString(),
        accounts: [
            {
                id: "mt5-81234567",
                login: "81234567",
                source: "addon",
                live: true,
                updatedAt: new Date().toISOString(),
                label: "Exness",
                server: "Exness-MT5Real8",
                prop: false,
                counted: true,
                info: { name: "Demo Trader", login: 81234567, broker: "Exness Technologies Ltd", server: "Exness-MT5Real8", platform: "mt5", currency: "USD", balance: 2480.12, equity: 2536.84, margin: 412.3, freeMargin: 2124.54, leverage: 500, marginLevel: 615.3 },
                positions: [
                    { id: "1", symbol: "XAUUSD", type: "POSITION_TYPE_BUY", volume: 0.05, openPrice: 2641.2, currentPrice: 2652.9, profit: 58.5, swap: -1.2 },
                    { id: "2", symbol: "EURUSD", type: "POSITION_TYPE_SELL", volume: 0.2, openPrice: 1.0912, currentPrice: 1.0918, profit: -12, swap: 0 },
                ],
                error: null,
            },
            {
                id: "mt5-5512345",
                login: "5512345",
                source: "myfxbook",
                live: false,
                updatedAt: new Date(Date.now() - 6 * 60e3).toISOString(),
                label: "FundingPips",
                server: "FundingPips-Live",
                prop: true,
                counted: false,
                info: { name: "Demo Trader", login: 5512345, broker: "FundingPips", server: "FundingPips-Live", platform: "mt5", currency: "USD", balance: 10412.5, equity: 10388.1, margin: 220, freeMargin: 10168.1, leverage: 100, marginLevel: 4721.8 },
                positions: [{ id: "3", symbol: "GBPJPY", type: "POSITION_TYPE_BUY", volume: 0.3, openPrice: 196.42, currentPrice: 196.31, profit: -24.4, swap: 0 }],
                error: null,
            },
        ],
    };
}

export function demoManual() {
    const now = new Date().toISOString();
    return [
        { _id: "m1", name: "HDFC savings", kind: "bank", amount: 186420, currency: "INR", note: "", updatedAt: now },
        { _id: "m2", name: "SBI savings", kind: "bank", amount: 54210.75, currency: "INR", note: "", updatedAt: now },
        { _id: "m3", name: "SBI fixed deposit", kind: "deposit", amount: 200000, currency: "INR", note: "Matures March", updatedAt: now },
        { _id: "m4", name: "Wise USD balance", kind: "cash", amount: 640, currency: "USD", note: "", updatedAt: now },
        { _id: "m5", name: "Credit card due", kind: "loan", amount: 18750, currency: "INR", note: "", updatedAt: now },
    ];
}
