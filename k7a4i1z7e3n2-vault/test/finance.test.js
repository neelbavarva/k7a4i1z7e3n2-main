import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const http = vi.fn();
// the pauses between retries go by at once here
vi.mock("@/lib/http", () => ({ http: (...a) => http(...a), RETRIES: 3, waitToRetry: () => Promise.resolve() }));

import Finance, { AddMenu } from "@/components/Finance";

const TRADES = [
    { _id: "t1", tradeSymbol: "EURUSD", dateOfTrade: "2 October 2026", tradeType: "Real", totalPnL: 0, totalPercentage: 80, riskRewardRatio: "2", isLowerTf: true, tradeStatus: "Open" },
    { _id: "t2", tradeSymbol: "XAUUSD", dateOfTrade: "1 October 2026", tradeType: "Funded", totalPnL: 120, totalPercentage: 90, riskRewardRatio: "3", isLowerTf: false, tradeStatus: "Closed" },
    { _id: "t3", tradeSymbol: "GBPUSD", dateOfTrade: "12 September 2026", tradeType: "Real", totalPnL: -40, totalPercentage: 50, riskRewardRatio: "2", isLowerTf: true, tradeStatus: "Closed" },
];

let trades = [];
let wallets = () => ({ wallets: [] });
let manual = [];
let kite = null; // a Zerodha account to answer /kite/account with, signed in for the day

const wallet = (error) => ({
    _id: "w1",
    name: "Trust Wallet",
    kind: "trust",
    addresses: [{ chain: "evm", address: "0xAD2caA44a1b2c3d4e5f60718293a4b5c62AE2Fa1F", holdings: [], inr: 0, usd: 0, error }],
    holdings: [],
    inr: 0,
    usd: 0,
    error,
});

beforeEach(() => {
    trades = [];
    wallets = () => ({ wallets: [] });
    manual = [];
    kite = null;
    localStorage.setItem("worthListOpen", "1"); // the accounts list open, unless a test shuts it
    // the figures are checked in rupees, at 96.7, unless a test says otherwise; the page itself starts
    // in dollars (see "The page's currency"), and no rates are kept from a test before
    localStorage.setItem("financeCurrency", "INR");
    localStorage.removeItem("worthFx");
    localStorage.removeItem("kiteSession");
    http.mockReset();
    http.mockImplementation(async (path) => {
        if (path === "/trades/getTrades") return trades;
        if (path === "/kite/status") return { configured: false };
        if (path === "/kite/account") return kite;
        if (path === "/worth/fx") return { rate: 96.7, rates: { USD: 1, INR: 96.7 }, date: "2026-10-09" };
        if (path === "/worth/manual") return manual;
        if (path.startsWith("/crypto/wallets")) return wallets(path);
        if (path.startsWith("/worth/history")) return [];
        return {};
    });
});

const tabs = () => within(screen.getByRole("navigation", { name: "Finance sections" })).getAllByRole("button").map((b) => b.textContent);

async function renderFinance(props = {}) {
    const onNewTrade = vi.fn();
    const view = render(<Finance refreshKey={0} ask={null} onNewTrade={onNewTrade} {...props} />);
    await act(async () => {});
    return { ...view, onNewTrade };
}

/** Once the headline figures have counted up to where they're going. */
const counted = () => act(() => new Promise((r) => setTimeout(r, 750)));

describe("Finance", () => {
    it("has one tab per section; with no trades, the trades are one line that starts the first", async () => {
        const { onNewTrade } = await renderFinance();
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Finance");
        expect(tabs()).toEqual(["Overview", "Accounts", "Trades"]);
        // the status line reads the accounts again; there's no sample data to look at instead
        expect(screen.getByRole("button", { name: /Refresh/ })).toBeTruthy();
        expect(screen.queryByRole("button", { name: /sample/i })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /Log your first trade/ }));
        expect(onNewTrade).toHaveBeenCalledOnce();
        expect(document.querySelector(".jr")).toBeNull();
    });

    it("puts what the trades add up to in the one card, with the account switch, and the journal under the filters", async () => {
        trades = TRADES;
        const { onNewTrade } = await renderFinance();
        await counted();
        // in the card, laid out like the net worth: what every trade adds up to, +$120 won and −$40 lost, in rupees at 96.7
        const card = document.querySelector(".hx-trade");
        expect(card.querySelector("#tx-title").textContent).toBe("Trading · every trade");
        expect(card.querySelector(".tx-big .fig").getAttribute("aria-label")).toBe("plus ₹7,736.00");
        // the journal, a band for the open trades and for each month
        const bands = [...document.querySelectorAll(".jr .lg-group-name")].map((b) => b.firstChild.textContent);
        expect(bands).toEqual(["Open", "October 2026", "September 2026"]);
        // the card's account switch filters the summary and the journal under it
        const accounts = within(card).getByRole("group", { name: "Account" });
        fireEvent.click(within(accounts).getByRole("button", { name: /Real/ }));
        expect(card.querySelector("#tx-title").textContent).toBe("Trading · Real account");
        expect([...document.querySelectorAll(".jr .lg-group-name")].map((b) => b.firstChild.textContent)).toEqual(["Open", "September 2026"]);
        expect(onNewTrade).not.toHaveBeenCalled();
    });

    it("lays out the figures behind the result beside the curve", async () => {
        trades = TRADES;
        await renderFinance();
        await counted();
        // closed: the funded +$120 and the Real −$40, at 96.7; t1 is still open
        const rows = Object.fromEntries(
            [...document.querySelectorAll(".tx-list > div")].map((d) => [d.querySelector("dt").textContent, d.querySelector(".tx-val").textContent])
        );
        expect(rows).toEqual({
            "Win rate": "50.0%",
            "Profit factor": "3.00",
            "Average win / loss": "+₹11,604/−₹3,868",
            "Risk : reward": "1:2.33",
            "Best / worst trade": "+₹11,604/−₹3,868",
            Trades: "1 won · 1 lost · 1 open3",
        });
        expect(document.querySelector(".tx-side .hx-side-head").textContent).toContain("2 closed trades");
    });

    it("follows the time frame and the pair through the card, the breakdown and the journal, and clears them", async () => {
        trades = TRADES;
        await renderFinance();
        const head = within(document.querySelector("#trades .fin-head"));
        const title = () => document.querySelector("#tx-title").textContent;
        const count = () => document.querySelector("#trades .fin-head .count").textContent;

        // lower time frames: t1 (open) and t3
        fireEvent.click(head.getByRole("button", { name: "Lower" }));
        expect(title()).toBe("Trading · lower time frames");
        expect(count()).toBe("2");
        await counted();
        expect(document.querySelector(".tx-big .fig").getAttribute("aria-label")).toBe("minus ₹3,868.00");

        // a pair, picked from the pair breakdown
        fireEvent.click(within(document.querySelector(".breakdown")).getByText("GBPUSD").closest("button"));
        expect(title()).toBe("Trading · GBPUSD · lower time frames");
        expect(count()).toBe("1");

        fireEvent.click(head.getByRole("button", { name: "Clear" }));
        expect(title()).toBe("Trading · every trade");
        expect(count()).toBe("3");
        expect(head.queryByRole("button", { name: "Clear" })).toBeNull();
    });

    it("lights the tab of the section chosen", async () => {
        await renderFinance();
        // (jsdom lays nothing out, so which tab the scrolling would light is left to the browser)
        const nav = within(screen.getByRole("navigation", { name: "Finance sections" }));
        const lit = () => nav.getAllByRole("button").filter((b) => b.getAttribute("aria-current") === "true").map((b) => b.textContent);
        fireEvent.click(nav.getByRole("button", { name: "Accounts" }));
        expect(lit()).toEqual(["Accounts"]);
        fireEvent.click(nav.getByRole("button", { name: "Overview" }));
        expect(lit()).toEqual(["Overview"]);
    });

    it("opens and shuts the accounts list from the top row of its card, and remembers it", async () => {
        localStorage.setItem("worthListOpen", "0");
        await renderFinance();
        const card = document.getElementById("lg-card");
        const fold = within(card).getByRole("button", { expanded: false });
        expect(document.getElementById("lg-list")).toBeNull();
        fireEvent.click(fold);
        expect(fold.getAttribute("aria-expanded")).toBe("true");
        expect(document.getElementById("lg-list")).toBeTruthy();
        expect(localStorage.getItem("worthListOpen")).toBe("1");
    });

    it("opens what the Add menu asks for, but not an ask from before the page was open", async () => {
        const { rerender } = await renderFinance({ ask: { what: "balance", kind: "funds", n: 3 } });
        expect(screen.queryByRole("dialog")).toBeNull();
        await act(async () => rerender(<Finance refreshKey={0} ask={{ what: "balance", kind: "funds", n: 4 }} onNewTrade={() => {}} />));
        expect(screen.getByRole("dialog", { name: "Add mutual funds" })).toBeTruthy();
    });
});

describe("Trading in the net worth", () => {
    it("counts the Real account's closed trades, and nothing else", async () => {
        trades = TRADES;
        await renderFinance();
        const line = [...document.querySelectorAll(".lg-row")].find((r) => r.textContent.includes("Forex trading"));
        // its result is the row's figure, in the page's currency; the note doesn't repeat it in dollars
        expect(line.textContent).toContain("Real account · 1 closed · 1 open");
        expect(line.textContent).not.toContain("$");
        expect(line.querySelector(".mk-candles")).toBeTruthy(); // its own mark, not a bank's
        await counted();
        // nothing else is owned here, so the total is the Real account's −$40 at 96.7; the funded +$120 isn't in it
        expect(document.querySelector(".hx-big .fig").getAttribute("aria-label")).toBe("minus ₹3,868.00");
    });

    it("shows the whole page in the currency picked, trades included", async () => {
        localStorage.setItem("financeCurrency", "USD");
        trades = TRADES;
        await renderFinance();
        await counted();
        expect(document.querySelector(".tx-big .fig").getAttribute("aria-label")).toBe("plus $80.00");
        expect(document.querySelector(".hx-big .fig").getAttribute("aria-label")).toBe("minus $40.00");
    });
});

describe("The page's currency", () => {
    const savings = { _id: "m2", name: "Savings account", kind: "bank", bank: "sbi", amount: 787, currency: "INR", note: "", updatedAt: "2026-10-05T10:00:00Z", history: [] };
    const open = (name) => fireEvent.click([...document.querySelectorAll("#lg-list .lg-row")].find((r) => r.textContent.includes(name)));

    it("is dollars until another is picked, whatever the page kept before", async () => {
        localStorage.removeItem("financeCurrency");
        localStorage.setItem("worthCurrency", "INR"); // written on every visit before, so not a choice
        trades = TRADES;
        await renderFinance();
        await counted();
        expect(document.querySelector(".hx-big .fig").getAttribute("aria-label")).toBe("minus $40.00");
        // the trading's line doesn't repeat its dollars, the row already shows them
        const line = [...document.querySelectorAll(".lg-row")].find((r) => r.textContent.includes("Forex trading"));
        expect(line.textContent).toContain("Real account · 1 closed · 1 open");
        expect(line.textContent).not.toContain("−$40.00");
    });

    it("types a balance in the page's currency and keeps it in the account's own", async () => {
        localStorage.removeItem("financeCurrency");
        manual = [savings];
        // the usual answers, and a save answers with the saved entry
        const answer = http.getMockImplementation();
        http.mockImplementation(async (path, o) => (o?.method === "PUT" ? { ...savings, ...o.body, updatedAt: "2026-10-09T10:00:00Z" } : answer(path, o)));
        await renderFinance();
        // the row is in dollars only, nothing in another currency beside it
        const row = [...document.querySelectorAll("#lg-list .lg-row")].find((r) => r.textContent.includes("Savings account"));
        expect(row.textContent).not.toContain("₹");
        open("Savings account");
        const field = screen.getByLabelText("Balance today");
        expect(field.value).toBe("8.14"); // ₹787 at 96.7
        expect(document.querySelector(".nw-amt-cur").textContent).toBe("$");
        fireEvent.change(field, { target: { value: "10" } });
        expect(document.querySelector(".nw-amt-diff").textContent).toBe("+$1.86");
        expect(document.querySelector(".nw-bal.is-line .nw-bal-hint").textContent).toBe("was $8.14 · keeps ₹967");
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Save" }));
        });
        expect(http).toHaveBeenCalledWith("/worth/manual/m2", expect.objectContaining({ method: "PUT", body: expect.objectContaining({ amount: 967, currency: "INR" }) }));
    });

    it("types it in the account's own currency when the page is in it", async () => {
        manual = [savings];
        await renderFinance();
        open("Savings account");
        expect(screen.getByLabelText("Balance today").value).toBe("787");
        expect(document.querySelector(".nw-amt-cur").textContent).toBe("₹");
    });

    it("shows Zerodha's money in it, prices left as the exchange quotes them", async () => {
        localStorage.removeItem("financeCurrency");
        localStorage.setItem("kiteSession", JSON.stringify({ session: "s", expiresAt: "2999-01-01T00:00:00Z", userName: "Test Trader" }));
        kite = {
            fetchedAt: "2026-10-09T10:00:00Z",
            sections: {
                profile: { data: { user_id: "QX4821", user_name: "Test Trader", exchanges: ["NSE"] } },
                funds: { data: { equity: { enabled: true, net: 48, available: { cash: 48, opening_balance: 48 }, utilised: { debits: 0 } }, commodity: { enabled: false } } },
                holdings: { data: [] },
                positions: { data: { net: [] } },
                orders: { data: [] },
                trades: { data: [] },
                charges: { data: [] },
                gtt: { data: [] },
                alerts: { data: [] },
                mfHoldings: { data: [] },
                sips: { data: [] },
            },
        };
        await renderFinance();
        // ₹48 at 96.7 is 50 cents, not $0
        const row = [...document.querySelectorAll("#lg-list .lg-row")].find((r) => r.textContent.includes("Zerodha"));
        expect(row.textContent).toContain("No holdings · cash $0.50");
        open("Zerodha");
        await counted();
        expect(document.querySelector(".kt .brief-sub").textContent).toBe("Cash $0.50");
    });
});

describe("Every figure and form in the page's currency", () => {
    const EUR_FX = { rate: 96.7, rates: { USD: 1, INR: 96.7, EUR: 0.9 }, date: "2026-10-09" };
    const savings = { _id: "m2", name: "Savings account", kind: "bank", bank: "sbi", amount: 787, currency: "INR", note: "", updatedAt: "2026-10-05T10:00:00Z", history: [] };
    const bofa = { _id: "m6", name: "BofA Investments", kind: "invest", bank: "bofa", amount: 100, currency: "USD", note: "", updatedAt: "2026-10-05T10:00:00Z", history: [] };
    /** The usual answers, with some of them answered by `extra` first. */
    const also = (extra) => {
        const base = http.getMockImplementation();
        http.mockImplementation(async (path, o) => (await extra(path, o)) ?? base(path, o));
    };
    const saves = () => also((path, o) => (o?.method === "PUT" || o?.method === "POST" ? { ...manual.find((m) => path.endsWith(m._id)), _id: "new", ...o.body, updatedAt: "2026-10-09T10:00:00Z" } : undefined));
    // what was sent to save a balance (the history the page posts isn't one)
    const sent = (method) => http.mock.calls.filter(([path, o]) => o?.method === method && path.startsWith("/worth/manual")).map(([path, o]) => [path, o.body.amount, o.body.currency]);
    const row = (name) => [...document.querySelectorAll("#lg-list .lg-row")].find((r) => r.textContent.includes(name));
    const amountField = () => document.querySelector("#bal-amount");
    const typeIn = (field, value) => fireEvent.change(field, { target: { value, selectionStart: value.length } });
    const pickCurrency = async (code) => {
        fireEvent.click(document.querySelector(".nw-cur-field"));
        const option = await screen.findByRole("option", { name: new RegExp(code) });
        fireEvent.click(option);
    };
    const save = () =>
        act(async () => {
            fireEvent.click(document.querySelector(".bal-go"));
        });
    /** The balance's own panel, then its Edit balance, from its more menu. */
    const edit = async (name) => {
        if (row(name).getAttribute("aria-expanded") !== "true") fireEvent.click(row(name)); // it may be open already: the page remembers

        fireEvent.keyDown(screen.getByRole("button", { name: `${name}: more` }), { key: "Enter" });
        fireEvent.click(await screen.findByRole("menuitem", { name: /Edit balance/ }));
        return screen.findByRole("dialog", { name: "Edit balance" });
    };

    it("shows every account and coin in it, and nothing in another currency", async () => {
        localStorage.setItem("financeCurrency", "EUR");
        also((path) => (path === "/worth/fx" ? EUR_FX : undefined));
        manual = [savings, bofa];
        wallets = () => ({
            wallets: [{ _id: "w1", name: "Trust Wallet", kind: "trust", addresses: [], holdings: [{ network: "Tron", symbol: "USDT", amount: 3.2, usd: 3.2, inr: 309.44, change24h: 0 }], inr: 309.44, usd: 3.2, error: null }],
        });
        await renderFinance();
        await counted();
        // ₹787 + $100 + the wallet's ₹309.44, all in euros at 96.7 / 0.9
        expect(document.querySelector(".hx-big .fig").getAttribute("aria-label")).toBe(`€${((787 + 9670 + 309.44) * (0.9 / 96.7)).toFixed(2)}`);
        expect(row("Savings account").textContent).toContain("€7.32");
        expect(row("BofA Investments").textContent).toContain("€90");
        expect(document.querySelector("#lg-list").textContent).not.toMatch(/[₹$]/);
        // a wallet's coins: their value in euros, in one column
        fireEvent.click(row("Trust Wallet"));
        const table = within(screen.getByRole("table", { name: "Trust Wallet coins" }));
        expect(table.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Coin", "Amount", "Value", "24h"]);
        expect(table.getByText("€2.88")).toBeTruthy();
    });

    it("starts a new balance in it; a figure typed stays as typed when the currency is changed", async () => {
        localStorage.setItem("financeCurrency", "EUR");
        also((path) => (path === "/worth/fx" ? EUR_FX : undefined));
        saves();
        const { rerender } = await renderFinance({ ask: { what: "balance", kind: "bank", n: 1 } });
        await act(async () => rerender(<Finance refreshKey={0} ask={{ what: "balance", kind: "bank", n: 2 }} onNewTrade={() => {}} />));
        const dialog = screen.getByRole("dialog", { name: "Add a balance" });
        expect(dialog.querySelector(".nw-cur-field").textContent).toBe("EUR");
        expect(dialog.querySelector(".bal-figure-cur").textContent).toBe("€");
        typeIn(amountField(), "500");
        await pickCurrency("USD");
        expect(amountField().value).toBe("500");
        expect(dialog.querySelector(".bal-figure-cur").textContent).toBe("$");
        // shown as the page will show it: $500 is €450
        expect(dialog.querySelector(".bal-preview-amt").textContent).toBe("€450.00");
        expect(dialog.querySelector(".bal-figure-note").textContent).toBe("€450 on the page, at today’s rate");
        typeIn(dialog.querySelector("#bal-name"), "Chase");
        await save();
        expect(sent("POST")).toEqual([["/worth/manual", 500, "USD"]]);
    });

    it("edits a balance in it, and leaves the figure exactly as it was when only the name changes", async () => {
        localStorage.removeItem("financeCurrency"); // the page as it starts: in dollars
        manual = [savings];
        saves();
        await renderFinance();
        const dialog = await edit("Savings account");
        // ₹787 at 96.7 to the dollar, the page's currency
        expect(dialog.querySelector(".nw-cur-field").textContent).toBe("USD");
        expect(amountField().value).toBe("8.14");
        expect(dialog.querySelector(".bal-preview-amt").textContent).toBe("$8.14");
        expect(dialog.querySelector(".bal-figure-note").textContent).toBe("Kept in its own currency: ₹787, at today’s rate");
        typeIn(dialog.querySelector("#bal-name"), "Salary account");
        await save();
        expect(sent("PUT")).toEqual([["/worth/manual/m2", 787, "INR"]]);
    });

    it("keeps a figure typed in the page's currency in the balance's own", async () => {
        localStorage.removeItem("financeCurrency"); // the page as it starts: in dollars
        manual = [savings];
        saves();
        await renderFinance();
        const dialog = await edit("Savings account");
        typeIn(amountField(), "10");
        expect(dialog.querySelector(".bal-figure-note").textContent).toBe("Kept in its own currency: ₹967, at today’s rate");
        await save();
        expect(sent("PUT")).toEqual([["/worth/manual/m2", 967, "INR"]]);
    });

    it("shows a balance's own figure when its currency is picked, and moves it into another one picked", async () => {
        localStorage.removeItem("financeCurrency"); // the page as it starts: in dollars
        manual = [savings];
        saves();
        await renderFinance();
        let dialog = await edit("Savings account");
        // picked back into rupees, untouched: its own figure, exactly
        await pickCurrency("INR");
        expect(amountField().value).toBe("787");
        expect(dialog.querySelector(".bal-figure-note").textContent).toBe("$8.14 on the page, at today’s rate");
        await save();
        expect(sent("PUT")).toEqual([["/worth/manual/m2", 787, "INR"]]);

        // the dollars picked on purpose: from now on it's kept in them
        cleanup();
        http.mockClear();
        await renderFinance();
        dialog = await edit("Savings account");
        await pickCurrency("USD");
        expect(dialog.querySelector(".bal-figure-note").textContent).toBe("Kept in USD from now on, not INR");
        await save();
        expect(sent("PUT")).toEqual([["/worth/manual/m2", 8.14, "USD"]]);
    });

    it("waits for its rate in rupees, and says so", async () => {
        localStorage.removeItem("financeCurrency");
        also((path) => (path === "/worth/fx" ? Promise.reject(Object.assign(new Error("down"), { status: 502 })) : undefined));
        manual = [savings];
        await renderFinance();
        await counted();
        expect(document.querySelector(".nw-status").textContent).toContain("in rupees until today’s USD rate is in");
        expect(document.querySelector(".hx-big .fig").getAttribute("aria-label")).toBe("₹787.00");
    });
});

describe("Hiding the amounts, funds and wallets", () => {
    const savings = { _id: "m2", name: "Savings account", kind: "bank", bank: "sbi", amount: 787, currency: "INR", note: "", updatedAt: "2026-10-05T10:00:00Z", history: [] };
    const gold = { _id: "f1", name: "SBI Gold Fund", kind: "funds", bank: "Groww", amount: 1000, currency: "INR", note: "", scheme: 119788, updatedAt: "2026-10-09T10:00:00Z", history: [] };
    const also = (extra) => {
        const base = http.getMockImplementation();
        http.mockImplementation(async (path, o) => (await extra(path, o)) ?? base(path, o));
    };
    const row = (name) => [...document.querySelectorAll("#lg-list .lg-row")].find((r) => r.textContent.includes(name));

    it("hides every amount behind the eye, and remembers it", async () => {
        trades = TRADES;
        manual = [savings];
        await renderFinance();
        await counted();
        expect(document.querySelector(".hx-big .fig").getAttribute("aria-label")).toBe("minus ₹3,081.00"); // ₹787 and the Real −$40 at 96.7
        fireEvent.click(screen.getByRole("button", { name: "Hide the amounts" }));
        // the total, the trading, every account: its sign and dots, nothing else
        expect(document.querySelector(".hx-big .fig").getAttribute("aria-label")).toBe("Amount hidden");
        expect(document.querySelector(".tx-big .fig").getAttribute("aria-label")).toBe("Amount hidden");
        const figs = [...document.querySelectorAll(".fig")];
        expect(figs.length).toBeGreaterThan(3);
        for (const f of figs) expect(f.textContent).not.toMatch(/\d/);
        expect(row("Savings account").textContent).toContain("₹••••");
        // a stat that isn't an amount still shows
        expect(document.querySelector(".tx-pct").textContent).toBe("50.0%");
        expect(localStorage.getItem("financeHidden")).toBe("1");
        expect(screen.getByRole("button", { name: "Show the amounts" }).getAttribute("aria-pressed")).toBe("true");
        // H shows them again
        fireEvent.keyDown(window, { key: "h" });
        expect(document.querySelector(".hx-big .fig").getAttribute("aria-label")).toBe("minus ₹3,081.00");
        expect(localStorage.getItem("financeHidden")).toBe("0");
    });

    it("keeps them hidden next time, and the balance's own field too", async () => {
        localStorage.setItem("financeHidden", "1");
        manual = [savings];
        await renderFinance();
        fireEvent.click(row("Savings account"));
        // no figure to read or type in while they're hidden
        expect(document.querySelector(".nw-amt.is-masked").textContent).toBe("₹••••");
        expect(screen.queryByLabelText("Balance today")).toBeNull();
        localStorage.removeItem("financeHidden");
    });

    it("gives a fund held on Groww its house's mark with Groww's on its corner, and one line of what the row doesn't say", async () => {
        also((path) =>
            path === "/worth/funds/119788" ? { code: 119788, name: "SBI Gold Fund", house: "SBI", kind: "gold", category: "Commodities Gold", nav: 45.3154, date: "2026-10-08", returns: { "1Y": 20.66, "3Y": 35.89, "5Y": 24.87 } } : undefined
        );
        manual = [gold];
        await renderFinance();
        const line = row("SBI Gold Fund");
        expect(line.querySelector(".mk-badge img").getAttribute("src")).toBe("/brands/groww.png");
        await act(async () => {
            fireEvent.click(line);
        });
        const panel = document.querySelector(".nw-bal.is-fund");
        expect(panel.querySelector(".nw-rets").textContent).toBe("1Y+20.7%3Y+35.9%5Y+24.9%");
        expect(panel.querySelector(".nw-nav").textContent).toBe("NAV ₹45.32");
        expect(panel.textContent).toContain("Updated");
        // its category and where it's held are the row's, not said again
        expect(line.textContent).toContain("Groww");
        expect(panel.textContent).not.toContain("Commodities Gold");
    });

    it("names the kinds under the globe with what each comes to, the bar showing their shares", async () => {
        manual = [savings, { ...savings, _id: "m6", name: "BofA Investments", kind: "invest", bank: "bofa", amount: 100, currency: "USD" }];
        await renderFinance();
        const kinds = [...document.querySelectorAll(".orb-legend button")];
        expect(kinds.map((k) => k.querySelector(".orb-kind-name").textContent)).toEqual(["Brokerage", "Bank and cash"]);
        for (const k of kinds) {
            expect(k.textContent).not.toContain("%");
            expect(k.getAttribute("title")).toMatch(/%/);
        }
    });

    it("previews a wallet in its dialog the way the ledger shows it", async () => {
        wallets = () => ({ wallets: [{ ...wallet(null), inr: 967 }] });
        await renderFinance();
        fireEvent.click(row("Trust Wallet"));
        fireEvent.keyDown(screen.getByRole("button", { name: "Trust Wallet: more" }), { key: "Enter" });
        fireEvent.click(await screen.findByRole("menuitem", { name: /Edit wallet/ }));
        const dialog = await screen.findByRole("dialog", { name: "Edit Trust Wallet" });
        expect(dialog.querySelector(".bal-preview-head").textContent).toBe("Crypto");
        const preview = dialog.querySelector(".bal-preview-row");
        expect(preview.querySelector(".bal-preview-text b").textContent).toBe("Trust Wallet");
        expect(preview.querySelector(".bal-preview-amt").textContent).toBe("₹967.00");
    });
});

describe("Archived trades", () => {
    // t3, the Real account's −$40, archived: its result leaves the total P&L, every stat still counts it
    const withArchived = () => TRADES.map((t) => (t._id === "t3" ? { ...t, archived: true } : t));

    it("are out of the total P&L and the net worth, and still in every stat and the journal", async () => {
        trades = withArchived();
        await renderFinance();
        await counted();
        // the P&L: only the funded +$120 is left, at 96.7; it says why
        expect(document.querySelector(".tx-big .fig").getAttribute("aria-label")).toBe("plus ₹11,604.00");
        expect(document.querySelector(".tx-main").textContent).toContain("1 archived, out of the P&L");
        // the stats still count it: one win and one loss of two closed
        expect(document.querySelector(".tx-pct").textContent).toBe("50.0%");
        // the Real account has no result left in the P&L, so the trading adds nothing to the net worth
        const line = [...document.querySelectorAll(".lg-row")].find((r) => r.textContent.includes("Forex trading"));
        expect(line.textContent).toContain("Real account · 0 closed · 1 open");
        expect(document.querySelector(".hx-big .fig").getAttribute("aria-label")).toBe("₹0.00");
        // the journal keeps it in its month, tagged; the pair analysis still counts it
        const bands = [...document.querySelectorAll(".jr .lg-group-name")].map((b) => b.firstChild.textContent);
        expect(bands).toEqual(["Open", "October 2026", "September 2026"]);
        const row = document.querySelector(".jr .jrow.is-archived");
        expect(row.textContent).toContain("GBPUSD");
        expect(row.querySelector(".arch-tag").textContent).toBe("Archived");
        expect(within(document.querySelector(".breakdown")).getByText("GBPUSD")).toBeTruthy();
    });

    it("are archived and restored from the trade's own dialog", async () => {
        trades = TRADES;
        await renderFinance();
        const journal = () => within(document.querySelector(".jr"));
        fireEvent.click(journal().getByText("GBPUSD").closest("button"));
        fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
        await act(async () => {});
        expect(http).toHaveBeenCalledWith("/trades/archiveTrade/t3", { method: "PUT", body: { archived: true } });

        trades = withArchived();
        cleanup();
        await renderFinance();
        fireEvent.click(journal().getByText("GBPUSD").closest("button"));
        fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
        await act(async () => {});
        expect(http).toHaveBeenCalledWith("/trades/archiveTrade/t3", { method: "PUT", body: { archived: false } });
    });
});

describe("Wallet chains that don't answer", () => {
    const fresh = () => http.mock.calls.filter(([p]) => p === "/crypto/wallets?fresh=1").length;

    it("are read again, fresh, and never shown as failing if a retry answers", async () => {
        let n = 0;
        wallets = (path) => ({ wallets: [wallet(path.includes("fresh") && ++n === 2 ? null : "Ethereum: timed out")] });
        await renderFinance();
        await act(async () => {});
        expect(fresh()).toBe(2);
        expect(screen.queryByText("Some chains didn’t answer")).toBeNull();
    });

    it("are shown as not answering once three retries are spent", async () => {
        wallets = () => ({ wallets: [wallet("Ethereum: timed out")] });
        await renderFinance();
        await act(async () => {});
        expect(fresh()).toBe(3);
        expect(screen.getByText("Some chains didn’t answer")).toBeTruthy();
    });
});

describe("Add menu", () => {
    it("offers a trade first, then everything that counts towards the net worth", () => {
        render(<AddMenu open onOpenChange={() => {}} onTrade={() => {}} onAsk={() => {}} />);
        const items = screen.getAllByRole("menuitem").map((i) => i.querySelector("span").firstChild.textContent);
        expect(items).toEqual(["Trade", "Bank balance", "Mutual funds", "Investment account", "Crypto wallet", "Loan"]);
    });
});
