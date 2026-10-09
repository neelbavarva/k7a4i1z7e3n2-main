// Mutual funds: AMFI's NAV file read into the picker's list, and a fund's returns from its history.
// Run with: npm test
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.SERVER_KEYS = "test-key";
process.env.SERVER_KEY = "test-key";
const KEY = "test-key";

const funds = require("../funds");
const market = require("../market");

// a slice of NAVAll.txt as AMFI writes it: blocks by category, then by fund house
const NAV_ALL = [
    "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date",
    "",
    "Open Ended Schemes(Equity Scheme - Small Cap Fund)",
    "",
    "Nippon India Mutual Fund",
    "",
    "118778;INF204K01K15;-;Nippon India Small Cap Fund - Direct Plan Growth Plan - Growth Option;190.1234;07-Oct-2026",
    "118777;INF204K01K07;INF204K01K23;Nippon India Small Cap Fund - Direct Plan - IDCW Option;95.4321;07-Oct-2026",
    "113177;INF204K01HY3;-;Nippon India Small Cap Fund - Growth Plan - Growth Option;170.5;07-Oct-2026",
    "",
    "quant Mutual Fund",
    "",
    "120828;INF966L01689;-;quant Small Cap Fund - Growth Option - Direct Plan;290.77;07-Oct-2026",
    "",
    "Open Ended Schemes(Equity Scheme - ELSS)",
    "",
    "SBI Mutual Fund",
    "",
    "119723;INF200K01T51;-;SBI ELSS Tax Saver Fund - DIRECT PLAN -GROWTH;480.2;07-Oct-2026",
    "",
    "Open Ended Schemes(Hybrid Scheme - Dynamic Asset Allocation or Balanced Advantage)",
    "",
    "HDFC Mutual Fund",
    "",
    "118968;INF179K01WM1;-;HDFC Balanced Advantage Fund - Growth Plan - Direct Plan;560.1;07-Oct-2026",
    "",
    "Open Ended Schemes(Other Scheme - Gold ETF)",
    "",
    "Nippon India Mutual Fund",
    "",
    "102350;INF204KB17I5;-;Nippon India ETF Gold BeES;82.1534;07-Oct-2026",
    "",
    "Open Ended Schemes(Other Scheme - FoF Domestic)",
    "",
    "SBI Mutual Fund",
    "",
    "119788;INF200K01UP4;-;SBI Gold Fund - Direct Plan - Growth;32.5;07-Oct-2026",
    "",
    "Open Ended Schemes(Other Scheme - Index Funds)",
    "",
    "UTI Mutual Fund",
    "",
    "120716;INF789F01XA0;-;UTI Nifty 50 Index Fund - Growth Option- Direct;170.4;07-Oct-2026",
    "",
    "Edelweiss Mutual Fund",
    "",
    "149201;INF754K01OY4;-;Edelweiss CRISIL IBX 50:50 Gilt Plus SDL Apr 2037 Index Fund - Direct Plan - Growth;12.1;07-Oct-2026",
    "",
    "Open Ended Schemes(Other Scheme - FoF Overseas)",
    "",
    "Motilal Oswal Mutual Fund",
    "",
    "145552;INF247L01AS4;-;Motilal Oswal Nasdaq 100 Fund of Fund- Direct Plan Growth;41.2;06-Oct-2026",
    "",
    "Open Ended Schemes(Debt Scheme - Liquid Fund)",
    "",
    "360 ONE Mutual Fund (Formerly Known as IIFL Mutual Fund)",
    "",
    "132756;INF579M01AB3;-;360 ONE Liquid Fund Direct Plan-Growth;1980.4;07-Oct-2026",
    "",
    "Close Ended Schemes(Debt Scheme - Fixed Maturity Plan)",
    "",
    "SBI Mutual Fund",
    "",
    "140001;INF200K01ZZ1;-;SBI Fixed Maturity Plan Series 1 - Direct Plan - Growth;11.2;07-Oct-2026",
].join("\r\n");

test("reads AMFI's file: Direct Growth plans and ETFs, clean names, the house, a category", () => {
    const { date, count, funds: list } = funds.parseNavAll(NAV_ALL);
    assert.equal(date, "2026-10-07");
    const by = Object.fromEntries(list.map((f) => [f.name, f]));
    assert.deepEqual(Object.keys(by).sort(), [
        "360 ONE Liquid Fund",
        "Edelweiss CRISIL IBX 50:50 Gilt Plus SDL Apr 2037 Index Fund",
        "HDFC Balanced Advantage Fund",
        "Motilal Oswal Nasdaq 100 Fund of Fund",
        "Nippon India ETF Gold BeES",
        "Nippon India Small Cap Fund",
        "Quant Small Cap Fund",
        "SBI ELSS Tax Saver Fund",
        "SBI Gold Fund",
        "UTI Nifty 50 Index Fund",
    ]);
    assert.equal(count, 10);
    // the Direct Growth plan, not IDCW or Regular
    assert.equal(by["Nippon India Small Cap Fund"].code, 118778);
    assert.equal(by["Nippon India Small Cap Fund"].nav, 190.1234);
    assert.equal(by["Nippon India Small Cap Fund"].house, "Nippon India");
    assert.deepEqual([by["Nippon India Small Cap Fund"].kind, by["Nippon India Small Cap Fund"].category], ["equity", "Equity Small Cap"]);
    assert.equal(by["Quant Small Cap Fund"].house, "quant");
    assert.deepEqual([by["SBI ELSS Tax Saver Fund"].kind, by["SBI ELSS Tax Saver Fund"].category], ["elss", "Equity ELSS"]);
    assert.deepEqual([by["HDFC Balanced Advantage Fund"].kind, by["HDFC Balanced Advantage Fund"].category], ["hybrid", "Hybrid Balanced Advantage"]);
    // gold, whether an ETF or a fund of funds
    assert.deepEqual([by["Nippon India ETF Gold BeES"].kind, by["Nippon India ETF Gold BeES"].category], ["gold", "Commodities Gold"]);
    assert.deepEqual([by["SBI Gold Fund"].kind, by["SBI Gold Fund"].category], ["gold", "Commodities Gold"]);
    assert.deepEqual([by["UTI Nifty 50 Index Fund"].kind, by["UTI Nifty 50 Index Fund"].category], ["index", "Equity Index"]);
    assert.deepEqual([by["Edelweiss CRISIL IBX 50:50 Gilt Plus SDL Apr 2037 Index Fund"].kind, by["Edelweiss CRISIL IBX 50:50 Gilt Plus SDL Apr 2037 Index Fund"].category], ["debt", "Debt Index"]);
    assert.deepEqual([by["Motilal Oswal Nasdaq 100 Fund of Fund"].kind, by["Motilal Oswal Nasdaq 100 Fund of Fund"].category], ["global", "Equity International"]);
    assert.equal(by["Motilal Oswal Nasdaq 100 Fund of Fund"].date, "2026-10-06");
    // a house's "(Formerly Known as …)" dropped; close-ended schemes left out
    assert.equal(by["360 ONE Liquid Fund"].house, "360 ONE");
    assert.deepEqual([by["360 ONE Liquid Fund"].kind, by["360 ONE Liquid Fund"].category], ["debt", "Debt Liquid"]);
    assert.ok(!list.some((f) => /fixed maturity/i.test(f.name)));
});

test("names the plan out of the many ways AMFI writes it", () => {
    assert.equal(funds.planName("Parag Parikh Flexi Cap Fund - Direct Plan - Growth"), "Parag Parikh Flexi Cap Fund");
    assert.equal(funds.planName("HDFC Flexi Cap Fund - Growth Option - Direct Plan"), "HDFC Flexi Cap Fund");
    assert.equal(funds.planName("Motilal Oswal Midcap Fund-Direct Plan-Growth Option"), "Motilal Oswal Midcap Fund");
    assert.equal(funds.planName("Nippon India Growth Mid Cap Fund - Direct Plan Growth Plan - Growth Option"), "Nippon India Growth Mid Cap Fund");
    assert.equal(funds.planName("Axis Growth Opportunities Fund - Direct Plan - Growth"), "Axis Growth Opportunities Fund");
    assert.equal(funds.planName("Bandhan Value Fund (Formerly known as Bandhan Sterling Value Fund) - Direct Plan - Growth"), "Bandhan Value Fund");
    assert.equal(funds.planName("Axis Liquid Fund - Direct Plan - Daily IDCW"), null);
    assert.equal(funds.planName("ICICI Prudential Bluechip Fund - Growth"), null); // Regular
    assert.equal(funds.planName("Kotak Gold ETF", true), "Kotak Gold ETF");
    assert.equal(funds.planName("SBI Nifty 50 ETF - Growth", true), "SBI Nifty 50 ETF");
});

test("works out 1, 3 and 5 year returns, a year on average past one", () => {
    const day = (ms) => new Date(ms).toISOString().slice(0, 10);
    const end = Date.UTC(2026, 9, 7);
    const yr = 365 * 864e5;
    const hist = [
        { day: day(end - 5 * yr), nav: 10 },
        { day: day(end - 3 * yr - 2 * 864e5), nav: 12 }, // a holiday on the day itself: the NAV before it
        { day: day(end - yr), nav: 16 },
        { day: day(end), nav: 20 },
    ];
    const r = funds.returnsOf(hist);
    assert.equal(r["1Y"], 25);
    assert.equal(r["3Y"], Math.round((Math.pow(20 / 12, 1 / 3) - 1) * 1e4) / 100);
    assert.equal(r["5Y"], Math.round((Math.pow(2, 1 / 5) - 1) * 1e4) / 100);
    // younger than three years: no 3 or 5 year figure
    const young = funds.returnsOf(hist.slice(2));
    assert.equal(young["1Y"], 25);
    assert.equal(young["3Y"], null);
    assert.equal(young["5Y"], null);
});

// ---------- the routes ----------

let navCalls = 0;
let firstUrlDown = false;
const realFetch = globalThis.fetch;
const reply = (status, body, type = "application/json") => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": type } });
function outside(url) {
    const u = new URL(url);
    if (u.pathname === "/spages/NAVAll.txt") {
        navCalls++;
        if (u.host === "www.amfiindia.com" && firstUrlDown) return reply(503, "busy", "text/plain");
        return reply(200, NAV_ALL + "\r\n" + Array.from({ length: 120 }, (_, i) => `Open Ended Schemes(Equity Scheme - Flexi Cap Fund)\r\nTest Mutual Fund\r\n${900000 + i};-;-;Test Flexi ${i} Fund - Direct Plan - Growth;10;07-Oct-2026`).join("\r\n"), "text/plain");
    }
    if (u.host === "api.mfapi.in") {
        if (u.pathname === "/mf/118778")
            return reply(200, {
                meta: { fund_house: "Nippon India Mutual Fund", scheme_category: "Equity Scheme - Small Cap Fund", scheme_name: "Nippon India Small Cap Fund - Direct Plan Growth Plan - Growth Option" },
                data: [
                    { date: "07-10-2026", nav: "190.12340" },
                    { date: "07-10-2025", nav: "158.43617" },
                    { date: "07-10-2021", nav: "60.00000" },
                    { date: "01-01-2013", nav: "20.00000" },
                ],
            });
        return reply(200, { meta: {}, data: [] });
    }
    return reply(599, { message: `unexpected ${url}` });
}

let server;
let base;
before(async () => {
    globalThis.fetch = (url, init) => (String(url).startsWith("http://127.0.0.1") ? realFetch(url, init) : Promise.resolve(outside(url, init)));
    const express = require("express");
    const app = express();
    app.use(express.json());
    app.use("/worth", require("../routes/worthRoute"));
    await new Promise((resolve) => (server = app.listen(0, resolve)));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
    globalThis.fetch = realFetch;
    server?.close();
});

const req = (path, { key = KEY } = {}) => realFetch(`${base}${path}`, { headers: { "x-api-key": key } });

test("serves the list, read once and cached, from AMFI's other address if the first is down", async () => {
    market.clearCache();
    firstUrlDown = true;
    navCalls = 0;
    assert.equal((await req("/worth/funds", { key: "wrong" })).status, 401);
    const r = await req("/worth/funds");
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.count, 130);
    assert.ok(body.funds.some((f) => f.name === "SBI Gold Fund" && f.kind === "gold"));
    assert.equal(navCalls, 2);
    await req("/worth/funds");
    assert.equal(navCalls, 2); // cached
    firstUrlDown = false;
});

test("gives one fund's returns by its scheme code", async () => {
    market.clearCache();
    const r = await req("/worth/funds/118778");
    assert.equal(r.status, 200);
    const f = await r.json();
    assert.equal(f.house, "Nippon India");
    assert.equal(f.name, "Nippon India Small Cap Fund");
    assert.deepEqual([f.kind, f.category], ["equity", "Equity Small Cap"]);
    assert.equal(f.nav, 190.1234);
    assert.equal(f.date, "2026-10-07");
    assert.equal(f.since, "2013-01-01");
    assert.equal(f.returns["1Y"], 20);
    assert.equal(f.returns["3Y"], null); // nothing within a month of three years ago
    assert.equal(f.returns["5Y"], Math.round((Math.pow(190.1234 / 60, 1 / 5) - 1) * 1e4) / 100);
    assert.equal((await req("/worth/funds/abc")).status, 400);
    assert.equal((await req("/worth/funds/999999")).status, 404);
});
