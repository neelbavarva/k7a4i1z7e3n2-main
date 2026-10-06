import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

const http = vi.fn();
vi.mock("@/lib/http", () => ({ http: (...a) => http(...a) }));

import AddTrade from "@/components/AddTrade";

const LOWER = [
    {
        _id: "sync",
        name: "All time frame in sync (15min, 1H, 4H)",
        percentage: 30,
        secondaryStrategyPoints: [
            { _id: "h4", name: "4H Sync", percentage: 12 },
            { _id: "h1", name: "1H Sync", percentage: 10 },
            { _id: "m15", name: "15 min Sync", percentage: 8 },
        ],
    },
    { _id: "aoi", name: "Retesting AOI - 4H", percentage: 10, secondaryStrategyPoints: null },
];

afterEach(() => vi.useRealTimers());

beforeEach(() => {
    http.mockReset();
    http.mockImplementation(async (path) => {
        if (path === "/trades/getStrategySecondaryPoints") return LOWER;
        if (path === "/trades/getStrategyPoints") return [{ _id: "x", name: "Higher point", percentage: 100 }];
        return { ok: true };
    });
});

const box = (name) => screen.getByRole("checkbox", { name: new RegExp(name.replace(/[()]/g, "\\$&")) });
const score = () => document.querySelector(".grade-top b").textContent;

async function openForm() {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<AddTrade open onClose={onClose} onSaved={onSaved} />);
    await screen.findByText("4H Sync");
    return { onSaved, onClose };
}

describe("New trade checklist", () => {
    it("shows a point's parts under it, and a partly ticked point as mixed", async () => {
        await openForm();
        fireEvent.click(box("4H Sync"));
        expect(box("All time frame in sync").getAttribute("aria-checked")).toBe("mixed");
        expect(score()).toBe("12%");
        fireEvent.click(box("1H Sync"));
        fireEvent.click(box("15 min Sync"));
        // every part ticked: the whole point counts
        expect(box("All time frame in sync").getAttribute("aria-checked")).toBe("true");
        expect(score()).toBe("30%");
        fireEvent.click(box("Retesting AOI"));
        expect(score()).toBe("40%");
    });

    it("starts the score over when the time frame changes", async () => {
        await openForm();
        fireEvent.click(box("Retesting AOI"));
        expect(score()).toBe("10%");
        fireEvent.click(screen.getByRole("button", { name: "Higher time frame" }));
        expect(score()).toBe("0%");
        expect(screen.getByText("Higher point")).toBeTruthy();
    });
});

describe("Saving a trade", () => {
    it("says what's missing instead of sending an incomplete trade", async () => {
        await openForm();
        await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save trade" })));
        expect(screen.getByRole("alert").textContent).toBe("Still needed: pair, account, status, risk : reward.");
        expect(http).not.toHaveBeenCalledWith("/trades/newTrade", expect.anything());
    });

    it("saves in the stored format: date, plain ratio, parts as ticked", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 9, 6, 12));
        const { onSaved, onClose } = await openForm();
        fireEvent.click(box("4H Sync"));
        fireEvent.click(box("Retesting AOI"));

        fireEvent.click(screen.getByRole("button", { name: /Choose a pair/ }));
        const search = await screen.findByLabelText("Search pairs");
        fireEvent.change(search, { target: { value: "gbpusd" } });
        fireEvent.keyDown(search, { key: "Enter" });

        const account = screen.getByRole("group", { name: "Account" });
        fireEvent.click(within(account).getByRole("button", { name: "Backtest" }));
        const status = screen.getByRole("group", { name: "Status" });
        fireEvent.click(within(status).getByRole("button", { name: "Closed" }));
        fireEvent.change(screen.getByLabelText("Risk : reward"), { target: { value: "1:2.4" } });
        // the day comes from the calendar: open it, and pick the 4th
        fireEvent.click(screen.getByLabelText("Date"));
        fireEvent.click(await screen.findByRole("gridcell", { name: "Sunday 4 October 2026" }));
        fireEvent.change(screen.getByLabelText("Result"), { target: { value: "-120.5" } });

        await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save trade" })));

        const call = http.mock.calls.find(([p]) => p === "/trades/newTrade");
        expect(call).toBeTruthy();
        const body = call[1].body;
        expect(body).toMatchObject({
            tradeSymbol: "GBP/USD",
            tradeType: "Backtest",
            tradeStatus: "Closed",
            riskRewardRatio: "2.4",
            dateOfTrade: "04 October 2026",
            totalPnL: -120.5,
            totalPercentage: 22,
            isLowerTf: true,
        });
        expect(body.responses[0]).toMatchObject({
            question: LOWER[0].name,
            checked: false,
            secondaryResponses: [
                { question: "4H Sync", checked: true, _id: "h4" },
                { question: "1H Sync", checked: false, _id: "h1" },
                { question: "15 min Sync", checked: false, _id: "m15" },
            ],
        });
        expect(body.responses[1]).toMatchObject({ question: "Retesting AOI - 4H", checked: true });
        expect(onSaved).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    it("saves an open trade with no result or charts", async () => {
        await openForm();
        fireEvent.click(screen.getByRole("button", { name: /Choose a pair/ }));
        const search = await screen.findByLabelText("Search pairs");
        fireEvent.change(search, { target: { value: "eurusd" } });
        fireEvent.keyDown(search, { key: "Enter" });
        fireEvent.click(within(screen.getByRole("group", { name: "Account" })).getByRole("button", { name: "Real" }));
        fireEvent.click(within(screen.getByRole("group", { name: "Status" })).getByRole("button", { name: "Open" }));
        expect(screen.queryByLabelText("Result")).toBeNull();
        fireEvent.change(screen.getByLabelText("Risk : reward"), { target: { value: "3" } });

        await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save trade" })));
        const body = http.mock.calls.find(([p]) => p === "/trades/newTrade")[1].body;
        expect(body).toMatchObject({ tradeStatus: "Open", totalPnL: 0, lowTf: "", midTf: "", highTf: "", riskRewardRatio: "3" });
    });
});

describe("The details", () => {
    it("lets Win and Loss set the result's sign, and the presets fill the ratio", async () => {
        await openForm();
        fireEvent.click(within(screen.getByRole("group", { name: "Status" })).getByRole("button", { name: "Closed" }));
        const result = screen.getByLabelText("Result");
        const side = () => screen.getByRole("group", { name: "Win or loss" });

        fireEvent.change(result, { target: { value: "85" } });
        expect(within(side()).getByRole("button", { name: "Win" }).getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(within(side()).getByRole("button", { name: "Loss" }));
        expect(result.value).toBe("-85");
        expect(screen.getByText("A loss of $85.00.")).toBeTruthy();
        fireEvent.click(within(side()).getByRole("button", { name: "Win" }));
        expect(result.value).toBe("85");

        fireEvent.click(within(screen.getByRole("group", { name: "Common ratios" })).getByRole("button", { name: "1:2.5" }));
        expect(screen.getByLabelText("Risk : reward").value).toBe("2.5");
    });

    it("offers to open a chart once its link is in", async () => {
        await openForm();
        fireEvent.click(within(screen.getByRole("group", { name: "Status" })).getByRole("button", { name: "Closed" }));
        expect(screen.queryByRole("link", { name: /Open the .* chart/ })).toBeNull();
        fireEvent.change(screen.getByLabelText("15min chart"), { target: { value: "https://www.tradingview.com/x/abc123/" } });
        const open = screen.getByRole("link", { name: "Open the 15min chart" });
        expect(open.getAttribute("href")).toBe("https://www.tradingview.com/x/abc123/");
        expect(open.getAttribute("target")).toBe("_blank");
    });
});
