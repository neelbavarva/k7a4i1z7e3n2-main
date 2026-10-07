// Sample Zerodha data, shaped exactly like the server's /kite/account answer, so the view can be
// seen before Kite is set up. Nothing here is real.

const holding = (tradingsymbol, quantity, average_price, last_price, close_price, extra = {}) => ({
    tradingsymbol,
    exchange: "NSE",
    product: "CNC",
    quantity,
    t1_quantity: 0,
    average_price,
    last_price,
    close_price,
    pnl: +(quantity * (last_price - average_price)).toFixed(2),
    day_change: +(last_price - close_price).toFixed(2),
    day_change_percentage: +(((last_price - close_price) / close_price) * 100).toFixed(2),
    ...extra,
});

const order = (order_id, time, tradingsymbol, exchange, transaction_type, product, order_type, quantity, price, status, extra = {}) => ({
    order_id,
    order_timestamp: `${today()} ${time}`,
    exchange_timestamp: `${today()} ${time}`,
    tradingsymbol,
    exchange,
    transaction_type,
    product,
    order_type,
    variety: "regular",
    quantity,
    filled_quantity: status === "COMPLETE" ? quantity : 0,
    pending_quantity: status === "OPEN" ? quantity : 0,
    price: order_type === "MARKET" ? 0 : price,
    average_price: status === "COMPLETE" ? price : 0,
    status,
    status_message: null,
    ...extra,
});

const charge = (tradingsymbol, total, brokerage, transaction_tax, gst, stamp_duty) => ({
    tradingsymbol,
    charges: { total, brokerage, transaction_tax, gst: { total: gst }, stamp_duty, exchange_turnover_charge: 0, sebi_turnover_charge: 0 },
});

function today() {
    const d = new Date(Date.now() + 5.5 * 36e5); // India date
    return d.toISOString().slice(0, 10);
}

function inDays(n) {
    return new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
}

export function demoAccount() {
    const orders = [
        order("D101", "09:21:04", "SBIN", "NSE", "BUY", "MIS", "MARKET", 100, 812.4, "COMPLETE"),
        order("D102", "10:02:47", "NIFTY26OCT25000CE", "NFO", "BUY", "NRML", "LIMIT", 75, 182.4, "COMPLETE"),
        order("D103", "11:38:12", "GOLDM26NOVFUT", "MCX", "BUY", "NRML", "LIMIT", 1, 121450, "COMPLETE"),
        order("D104", "12:14:55", "TATAMOTORS", "NSE", "SELL", "CNC", "LIMIT", 10, 730, "REJECTED", {
            status_message: "Insufficient holdings to sell",
        }),
        order("D105", "13:05:30", "SBIN", "NSE", "SELL", "MIS", "MARKET", 100, 818.8, "COMPLETE"),
        order("D106", "14:22:09", "INFY", "NSE", "BUY", "CNC", "LIMIT", 5, 1500, "OPEN"),
    ];
    const done = orders.filter((o) => o.status === "COMPLETE");

    return {
        fetchedAt: new Date().toISOString(),
        expiresAt: null,
        sections: {
            profile: {
                data: {
                    user_id: "AB1234",
                    user_name: "Demo Trader",
                    user_shortname: "Demo",
                    broker: "ZERODHA",
                    exchanges: ["NSE", "BSE", "NFO", "CDS", "MCX", "MF"],
                    products: ["CNC", "NRML", "MIS"],
                },
            },
            funds: {
                data: {
                    equity: {
                        enabled: true,
                        net: 184320.55,
                        available: { cash: 245000, opening_balance: 245000, live_balance: 184320.55, collateral: 52000, intraday_payin: 0 },
                        utilised: { debits: 60679.45, span: 38200, exposure: 12100, option_premium: 13680, m2m_realised: 640, m2m_unrealised: 2415 },
                    },
                    commodity: {
                        enabled: true,
                        net: 48210,
                        available: { cash: 60000, opening_balance: 60000, live_balance: 48210, collateral: 0, intraday_payin: 0 },
                        utilised: { debits: 11790, span: 9800, exposure: 1990, option_premium: 0, m2m_realised: 0, m2m_unrealised: -4700 },
                    },
                },
            },
            holdings: {
                data: [
                    holding("RELIANCE", 15, 1310, 1402.6, 1394.2),
                    holding("HDFCBANK", 20, 1602, 1688.5, 1679.1),
                    holding("INFY", 12, 1480.2, 1532.4, 1521),
                    holding("TATAMOTORS", 30, 980, 712.3, 718.9),
                    holding("GOLDBEES", 100, 62.1, 98.4, 97.6),
                    holding("NIFTYBEES", 40, 241, 288.6, 286.9),
                    holding("ITC", 50, 418, 409.8, 411.2, { t1_quantity: 0 }),
                ],
            },
            positions: {
                data: {
                    net: [
                        { tradingsymbol: "NIFTY26OCT25000CE", exchange: "NFO", product: "NRML", quantity: 75, average_price: 182.4, last_price: 214.6, pnl: 2415, realised: 0, unrealised: 2415, multiplier: 1 },
                        { tradingsymbol: "GOLDM26NOVFUT", exchange: "MCX", product: "NRML", quantity: 1, average_price: 121450, last_price: 120980, pnl: -4700, realised: 0, unrealised: -4700, multiplier: 10 },
                        { tradingsymbol: "EURINR26OCTFUT", exchange: "CDS", product: "NRML", quantity: 1, average_price: 103.21, last_price: 103.36, pnl: 150, realised: 0, unrealised: 150, multiplier: 1000 },
                        { tradingsymbol: "SBIN", exchange: "NSE", product: "MIS", quantity: 0, average_price: 0, last_price: 817.9, pnl: 640, realised: 640, unrealised: 0, multiplier: 1 },
                    ],
                    day: [],
                },
            },
            orders: { data: orders },
            trades: {
                data: done.map((o, i) => ({
                    trade_id: `T${i + 1}`,
                    order_id: o.order_id,
                    tradingsymbol: o.tradingsymbol,
                    exchange: o.exchange,
                    transaction_type: o.transaction_type,
                    product: o.product,
                    quantity: o.quantity,
                    average_price: o.average_price,
                    fill_timestamp: o.order_timestamp,
                })),
            },
            charges: {
                data: [
                    charge("SBIN", 21.86, 20, 0, 3.67, 0),
                    charge("NIFTY26OCT25000CE", 47.12, 20, 0, 4.98, 0.41),
                    charge("GOLDM26NOVFUT", 31.97, 20, 0, 4.24, 2.43),
                    charge("SBIN", 44.21, 20, 20.47, 3.74, 0),
                ],
            },
            gtt: {
                data: [
                    {
                        id: 1001,
                        type: "single",
                        status: "active",
                        created_at: `${inDays(-12)} 10:15:00`,
                        expires_at: `${inDays(353)} 10:15:00`,
                        condition: { exchange: "NSE", tradingsymbol: "INFY", trigger_values: [1420], last_price: 1532.4 },
                        orders: [{ transaction_type: "BUY", quantity: 10, price: 1421, order_type: "LIMIT", product: "CNC" }],
                    },
                    {
                        id: 1002,
                        type: "two-leg",
                        status: "active",
                        created_at: `${inDays(-30)} 09:40:00`,
                        expires_at: `${inDays(335)} 09:40:00`,
                        condition: { exchange: "NSE", tradingsymbol: "HDFCBANK", trigger_values: [1580, 1820], last_price: 1688.5 },
                        orders: [
                            { transaction_type: "SELL", quantity: 20, price: 1578, order_type: "LIMIT", product: "CNC" },
                            { transaction_type: "SELL", quantity: 20, price: 1818, order_type: "LIMIT", product: "CNC" },
                        ],
                    },
                    {
                        id: 1003,
                        type: "single",
                        status: "triggered",
                        created_at: `${inDays(-40)} 11:02:00`,
                        expires_at: `${inDays(325)} 11:02:00`,
                        condition: { exchange: "NSE", tradingsymbol: "TATAMOTORS", trigger_values: [720], last_price: 712.3 },
                        orders: [{ transaction_type: "BUY", quantity: 10, price: 721, order_type: "LIMIT", product: "CNC" }],
                    },
                ],
            },
            alerts: {
                data: [
                    { uuid: "a1", name: "Nifty below 24,800", status: "enabled", lhs_exchange: "INDICES", lhs_tradingsymbol: "NIFTY 50", lhs_attribute: "LastTradedPrice", operator: "<=", rhs_type: "constant", rhs_constant: 24800, alert_count: 0 },
                    { uuid: "a2", name: "Gold mini above 1,25,000", status: "enabled", lhs_exchange: "MCX", lhs_tradingsymbol: "GOLDM26NOVFUT", lhs_attribute: "LastTradedPrice", operator: ">=", rhs_type: "constant", rhs_constant: 125000, alert_count: 2 },
                    { uuid: "a3", name: "Reliance breakout", status: "disabled", lhs_exchange: "NSE", lhs_tradingsymbol: "RELIANCE", lhs_attribute: "LastTradedPrice", operator: ">", rhs_type: "constant", rhs_constant: 1450, alert_count: 1 },
                ],
            },
            mfHoldings: {
                data: [
                    { tradingsymbol: "INF879O01027", fund: "Parag Parikh Flexi Cap Fund - Direct Plan", folio: "1234567/89", quantity: 412.533, average_price: 68.21, last_price: 86.94, pnl: 7726.75 },
                    { tradingsymbol: "INF789F1AUX7", fund: "UTI Nifty 50 Index Fund - Direct Plan", folio: "7654321/12", quantity: 820.112, average_price: 141.3, last_price: 168.2, pnl: 22061.01 },
                    { tradingsymbol: "INF179KC1BQ5", fund: "HDFC Liquid Fund - Direct Plan", folio: "5551234/00", quantity: 9.84, average_price: 4810.5, last_price: 5023.7, pnl: 2097.89 },
                ],
            },
            sips: {
                data: [
                    { sip_id: "S1", fund: "Parag Parikh Flexi Cap Fund - Direct Plan", instalment_amount: 10000, frequency: "monthly", status: "ACTIVE", next_instalment: inDays(3), completed_instalments: 26 },
                    { sip_id: "S2", fund: "UTI Nifty 50 Index Fund - Direct Plan", instalment_amount: 5000, frequency: "monthly", status: "ACTIVE", next_instalment: inDays(8), completed_instalments: 18 },
                    { sip_id: "S3", fund: "Quant Small Cap Fund - Direct Plan", instalment_amount: 3000, frequency: "monthly", status: "PAUSED", next_instalment: null, completed_instalments: 9 },
                ],
            },
        },
    };
}

/** A made-up but steady quote and candles for whatever's asked, so the chart can be tried. */
export function demoQuote(instrument) {
    let seed = [...instrument].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const base = 200 + rand() * 2800;
    const close = +(base * (0.97 + rand() * 0.06)).toFixed(2);
    const last = +(close * (0.985 + rand() * 0.03)).toFixed(2);
    const high = +Math.max(last, close) * (1 + rand() * 0.01);
    const low = +Math.min(last, close) * (1 - rand() * 0.01);
    const depth = (side) =>
        Array.from({ length: 5 }, (_, i) => ({
            price: +(last + (side === "buy" ? -1 : 1) * (i + 1) * 0.05).toFixed(2),
            quantity: Math.round(50 + rand() * 900),
            orders: Math.round(1 + rand() * 12),
        }));
    return {
        [instrument]: {
            instrument_token: 400000 + (seed % 99999),
            last_price: last,
            net_change: +(last - close).toFixed(2),
            volume: Math.round(1e5 + rand() * 4e6),
            ohlc: { open: +(close * (0.995 + rand() * 0.01)).toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close },
            depth: { buy: depth("buy"), sell: depth("sell") },
            last_trade_time: new Date().toISOString(),
        },
    };
}

/** Candles that wander but end at `last`, so the chart agrees with the quote beside it. */
export function demoCandles(instrument, interval, days, last) {
    let seed = [...`${instrument}${interval}`].reduce((a, ch) => (a * 33 + ch.charCodeAt(0)) >>> 0, 11);
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const step = { "15minute": 15 * 6e4, "60minute": 36e5, day: 864e5 }[interval] || 864e5;
    const count = Math.min(400, Math.round((days * 864e5) / step / (interval === "day" ? 1 : 3.4)));
    let price = 1000 + rand() * 600;
    const candles = [];
    const end = Date.now();
    for (let i = count; i > 0; i--) {
        const o = price;
        price = price * (1 + (rand() - 0.485) * 0.02);
        candles.push({ t: new Date(end - i * step).toISOString(), o, h: Math.max(o, price) * 1.004, l: Math.min(o, price) * 0.996, c: price, v: Math.round(rand() * 1e5) });
    }
    if (last && candles.length) {
        const k = last / candles[candles.length - 1].c;
        for (const c of candles) for (const f of ["o", "h", "l", "c"]) c[f] *= k;
    }
    return { interval, days, candles };
}
