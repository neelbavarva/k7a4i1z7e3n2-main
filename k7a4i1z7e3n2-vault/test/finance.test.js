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
    localStorage.setItem("worthListOpen", "1"); // the accounts list open, unless a test shuts it
    http.mockReset();
    http.mockImplementation(async (path) => {
        if (path === "/trades/getTrades") return trades;
        if (path === "/kite/status") return { configured: false };
        if (path === "/worth/fx") return { rate: 96.7, rates: { USD: 1, INR: 96.7 }, date: "2026-10-09" };
        if (path === "/worth/manual") return [];
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
        expect(line.textContent).toContain("Real account · 1 closed · 1 open · −$40.00");
        expect(line.querySelector(".mk-candles")).toBeTruthy(); // its own mark, not a bank's
        await counted();
        // nothing else is owned here, so the total is the Real account's −$40 at 96.7; the funded +$120 isn't in it
        expect(document.querySelector(".hx-big .fig").getAttribute("aria-label")).toBe("minus ₹3,868.00");
    });

    it("shows the whole page in the currency picked, trades included", async () => {
        localStorage.setItem("worthCurrency", "USD");
        trades = TRADES;
        await renderFinance();
        await counted();
        expect(document.querySelector(".tx-big .fig").getAttribute("aria-label")).toBe("plus $80.00");
        expect(document.querySelector(".hx-big .fig").getAttribute("aria-label")).toBe("minus $40.00");
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
