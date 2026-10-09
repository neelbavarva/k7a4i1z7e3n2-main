import { afterEach, describe, expect, it } from "vitest";
import { chargesSummary, clock, holdingsSummary, inr, loadSession, orderCounts, pct, positionsSummary, saveSession, takeHandoff } from "@/lib/kite";

afterEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
});

describe("rupees and percentages", () => {
    it("groups the Indian way, with a real minus and an optional plus", () => {
        expect(inr(123456.5)).toBe("₹1,23,456.50");
        expect(inr(-85)).toBe("−₹85");
        expect(inr(2415, { sign: true })).toBe("+₹2,415");
        expect(inr(1999.6, { whole: true })).toBe("₹2,000");
        expect(inr(0, { sign: true })).toBe("₹0");
    });
    it("shows percentages with two places and a dash when there's nothing to compare", () => {
        expect(pct(1.254)).toBe("+1.25%");
        expect(pct(-0.4)).toBe("−0.40%");
        expect(pct(null)).toBe("—");
    });
    it("reads Kite's India-time stamps", () => {
        expect(clock("2026-10-07 09:21:04")).toBe(new Date("2026-10-07T09:21:04+05:30").toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
        expect(clock("")).toBe("");
    });
});

describe("sums", () => {
    it("adds holdings up, counting T1 shares and today's move", () => {
        const h = holdingsSummary([
            { quantity: 10, t1_quantity: 0, average_price: 100, last_price: 110, day_change: 2 },
            { quantity: 5, t1_quantity: 5, average_price: 50, last_price: 40, day_change: -1 },
        ]);
        expect(h.invested).toBe(1500);
        expect(h.current).toBe(1500);
        expect(h.pnl).toBe(0);
        expect(h.pnlPct).toBe(0);
        expect(h.day).toBe(10);
        expect(h.dayPct).toBeCloseTo((10 / 1490) * 100);
        expect(holdingsSummary([]).pnlPct).toBe(null);
    });
    it("splits position P&L into booked and open", () => {
        const p = positionsSummary([
            { quantity: 0, pnl: 640, realised: 640, unrealised: 0 },
            { quantity: 75, pnl: 2415, realised: 0, unrealised: 2415 },
        ]);
        expect(p).toEqual({ pnl: 3055, realised: 640, unrealised: 2415, open: 1, total: 2 });
    });
    it("totals charges by kind and orders by how they ended", () => {
        const c = chargesSummary([{ charges: { total: 10, brokerage: 4, transaction_tax: 3, gst: { total: 1 }, stamp_duty: 0.5 } }]);
        expect(c).toEqual({ total: 10, brokerage: 4, taxes: 4.5, other: 1.5 });
        expect(orderCounts([{ status: "COMPLETE" }, { status: "OPEN" }, { status: "TRIGGER PENDING" }, { status: "REJECTED" }, { status: "CANCELLED" }])).toEqual({ done: 1, open: 2, failed: 2 });
    });
});

describe("session", () => {
    it("keeps a session until it expires", () => {
        saveSession({ session: "s", expiresAt: new Date(Date.now() + 60e3).toISOString(), userName: "Me" });
        expect(loadSession()?.session).toBe("s");
        expect(loadSession(Date.now() + 120e3)).toBe(null);
    });
    it("takes the login's result from the fragment and clears it", () => {
        window.history.replaceState(null, "", "/?x=1#kite=abc-123");
        expect(takeHandoff()).toEqual({ code: "abc-123" });
        expect(window.location.hash).toBe("");
        expect(window.location.search).toBe("?x=1");
        window.history.replaceState(null, "", "/#kite-error=wrong-account");
        expect(takeHandoff()).toEqual({ error: "wrong-account" });
        expect(takeHandoff()).toBe(null);
    });
});
