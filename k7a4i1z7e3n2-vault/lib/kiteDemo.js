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
        order("D101", "09:21:04", "SBIN", "NSE", "BUY", "MIS", "MARKET", 20, 812.4, "COMPLETE"),
        order("D102", "10:02:47", "NIFTY26OCT25500CE", "NFO", "BUY", "NRML", "LIMIT", 75, 36.4, "COMPLETE"),
        order("D104", "12:14:55", "TATAMOTORS", "NSE", "SELL", "CNC", "LIMIT", 10, 730, "REJECTED", {
            status_message: "Insufficient holdings to sell",
        }),
        order("D105", "13:05:30", "SBIN", "NSE", "SELL", "MIS", "MARKET", 20, 818.8, "COMPLETE"),
        order("D106", "14:22:09", "INFY", "NSE", "BUY", "CNC", "LIMIT", 2, 1500, "OPEN"),
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
                    exchanges: ["NSE", "BSE", "NFO", "MF"],
                    products: ["CNC", "NRML", "MIS"],
                },
            },
            funds: {
                data: {
                    equity: {
                        enabled: true,
                        net: 9142.8,
                        available: { cash: 12000, opening_balance: 12000, live_balance: 9142.8, collateral: 0, intraday_payin: 0 },
                        utilised: { debits: 2857.2, span: 0, exposure: 0, option_premium: 2730, m2m_realised: 128, m2m_unrealised: 480 },
                    },
                    commodity: { enabled: false, net: 0, available: { cash: 0, opening_balance: 0 }, utilised: { debits: 0 } },
                },
            },
            holdings: {
                data: [
                    holding("NIFTYBEES", 60, 241, 288.6, 286.9),
                    holding("HDFCBANK", 6, 1602, 1688.5, 1679.1),
                    holding("GOLDBEES", 80, 62.1, 98.4, 97.6),
                    holding("RELIANCE", 4, 1310, 1402.6, 1394.2),
                    holding("TATAMOTORS", 8, 980, 712.3, 718.9),
                    holding("ITC", 10, 418, 409.8, 411.2),
                ],
            },
            positions: {
                data: {
                    net: [
                        { tradingsymbol: "NIFTY26OCT25500CE", exchange: "NFO", product: "NRML", quantity: 75, average_price: 36.4, last_price: 42.8, pnl: 480, realised: 0, unrealised: 480, multiplier: 1 },
                        { tradingsymbol: "SBIN", exchange: "NSE", product: "MIS", quantity: 0, average_price: 0, last_price: 817.9, pnl: 128, realised: 128, unrealised: 0, multiplier: 1 },
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
                data: [charge("SBIN", 6.42, 4.87, 0, 0.92, 0.02), charge("NIFTY26OCT25500CE", 25.11, 20, 0, 3.75, 0.08), charge("SBIN", 10.66, 4.91, 4.09, 0.95, 0)],
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
                        orders: [{ transaction_type: "BUY", quantity: 3, price: 1421, order_type: "LIMIT", product: "CNC" }],
                    },
                    {
                        id: 1002,
                        type: "two-leg",
                        status: "active",
                        created_at: `${inDays(-30)} 09:40:00`,
                        expires_at: `${inDays(335)} 09:40:00`,
                        condition: { exchange: "NSE", tradingsymbol: "HDFCBANK", trigger_values: [1580, 1820], last_price: 1688.5 },
                        orders: [
                            { transaction_type: "SELL", quantity: 6, price: 1578, order_type: "LIMIT", product: "CNC" },
                            { transaction_type: "SELL", quantity: 6, price: 1818, order_type: "LIMIT", product: "CNC" },
                        ],
                    },
                ],
            },
            alerts: {
                data: [
                    { uuid: "a1", name: "Nifty below 24,800", status: "enabled", lhs_exchange: "INDICES", lhs_tradingsymbol: "NIFTY 50", lhs_attribute: "LastTradedPrice", operator: "<=", rhs_type: "constant", rhs_constant: 24800, alert_count: 0 },
                    { uuid: "a2", name: "Reliance breakout", status: "disabled", lhs_exchange: "NSE", lhs_tradingsymbol: "RELIANCE", lhs_attribute: "LastTradedPrice", operator: ">", rhs_type: "constant", rhs_constant: 1450, alert_count: 1 },
                ],
            },
            mfHoldings: {
                data: [
                    { tradingsymbol: "INF879O01027", fund: "Parag Parikh Flexi Cap Fund - Direct Plan", folio: "1234567/89", quantity: 182.406, average_price: 74.21, last_price: 86.94, pnl: 2322.03 },
                    { tradingsymbol: "INF789F1AUX7", fund: "UTI Nifty 50 Index Fund - Direct Plan", folio: "7654321/12", quantity: 61.38, average_price: 152.3, last_price: 168.2, pnl: 975.94 },
                ],
            },
            sips: {
                data: [
                    { sip_id: "S1", fund: "Parag Parikh Flexi Cap Fund - Direct Plan", instalment_amount: 1000, frequency: "monthly", status: "ACTIVE", next_instalment: inDays(3), completed_instalments: 14 },
                    { sip_id: "S2", fund: "UTI Nifty 50 Index Fund - Direct Plan", instalment_amount: 500, frequency: "monthly", status: "ACTIVE", next_instalment: inDays(8), completed_instalments: 9 },
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
