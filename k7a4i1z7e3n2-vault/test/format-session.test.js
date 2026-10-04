import { describe, expect, it } from "vitest";
import { fmtAgo, grade, money, parseTradeDate, pnlOf, sideOf } from "@/lib/format";
import { getMarketSession } from "@/lib/session";

describe("format", () => {
    it("reads trade dates as they are stored", () => {
        expect(parseTradeDate("04 February 2026")).toBe(new Date(2026, 1, 4).getTime());
        expect(parseTradeDate("4 Feb 2026")).toBe(new Date(2026, 1, 4).getTime());
        expect(parseTradeDate("")).toBeNaN();
    });
    it("writes money with a sign and a real minus", () => {
        expect(money(1240)).toBe("+$1,240");
        expect(money(-85.5)).toBe("−$85.50");
        expect(money(0)).toBe("$0");
        expect(money(1240, { sign: false })).toBe("$1,240");
        expect(money("nonsense")).toBe("$0");
    });
    it("reads P&L leniently", () => {
        expect(pnlOf({ totalPnL: "12.5" })).toBe(12.5);
        expect(pnlOf({})).toBe(0);
        expect([sideOf(3), sideOf(-1), sideOf(0)]).toEqual(["up", "down", "flat"]);
    });
    it("grades checklist scores", () => {
        expect([100, 90, 89, 80, 79, 70, 69, 0].map((p) => grade(p).label)).toEqual(["A", "A", "B", "B", "C", "C", "D", "Cntr"]);
    });
    it("says how long ago, then the date", () => {
        const now = new Date(2026, 9, 4, 12).getTime();
        expect(fmtAgo(now - 5 * 6e4, now)).toBe("5 min ago");
        expect(fmtAgo(now - 3 * 36e5, now)).toBe("3 h ago");
        expect(fmtAgo(now - 864e5, now)).toBe("1 day ago");
        expect(fmtAgo("garbage", now)).toBe("");
    });
});

// times below are UTC; the sessions are Asian 00–09, London 09–16, New York 12–21 UTC
const at = (iso) => getMarketSession(new Date(iso));

describe("market sessions", () => {
    it("shows the session open at the time, whatever the viewer's time zone", () => {
        expect(at("2026-10-06T03:00:00Z")).toMatchObject({ name: "Asian session", active: true });
        expect(at("2026-10-06T10:00:00Z")).toMatchObject({ name: "London session", active: true });
        // London and New York overlap: New York shows
        expect(at("2026-10-06T14:00:00Z")).toMatchObject({ name: "New York session", active: true });
        expect(at("2026-10-06T20:30:00Z")).toMatchObject({ name: "New York session", detail: "ends in 30min" });
    });
    it("counts down to the next session in the gap", () => {
        expect(at("2026-10-06T22:00:00Z")).toMatchObject({ name: "Between sessions", detail: "Asian session starts in 2hr 0min", active: false });
    });
    it("shows nothing while the market is shut for the weekend (New York time)", () => {
        expect(at("2026-10-03T12:00:00Z")).toBeNull(); // Saturday
        expect(at("2026-10-02T21:30:00Z")).toBeNull(); // Friday 5:30pm ET
        expect(at("2026-10-04T20:00:00Z")).toBeNull(); // Sunday 4pm ET
        expect(at("2026-10-04T21:30:00Z")).not.toBeNull(); // Sunday 5:30pm ET: open again
        expect(at("2026-10-02T20:30:00Z")).not.toBeNull(); // Friday 4:30pm ET: still open
    });
    it("follows New York's daylight saving for the weekly close", () => {
        // in January New York is UTC-5: Friday 5pm ET is 22:00 UTC
        expect(at("2026-01-09T21:30:00Z")).not.toBeNull();
        expect(at("2026-01-09T22:30:00Z")).toBeNull();
    });
});
