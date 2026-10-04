import { describe, expect, it } from "vitest";
import {
    byMonth,
    checklistScore,
    checklistState,
    dayLabel,
    equityOf,
    gradeKey,
    longDate,
    newestFirst,
    rrText,
    rrValue,
    shortDate,
    statsOf,
    storedDate,
    tickPart,
    tickWhole,
    tradeTime,
} from "@/lib/trades";

const trade = (over) => ({ _id: Math.random().toString(36).slice(2), tradeStatus: "Closed", totalPnL: 0, ...over });

describe("risk : reward", () => {
    it("reads the stored plain number and the 1:x form alike", () => {
        expect(rrValue("2.5")).toBe(2.5);
        expect(rrValue("1:2.5")).toBe(2.5);
        expect(rrValue(" 1 : 3 ")).toBe(3);
        expect(rrValue("2:5")).toBe(2.5);
    });
    it("rejects what isn't a ratio", () => {
        expect(rrValue("")).toBeNaN();
        expect(rrValue("abc")).toBeNaN();
        expect(rrValue("0:2")).toBeNaN();
        expect(rrValue(undefined)).toBeNaN();
    });
    it("shows it as 1:x, rounded, or as typed when it isn't a ratio", () => {
        expect(rrText("1.9")).toBe("1:1.9");
        expect(rrText("2.456")).toBe("1:2.46");
        expect(rrText("1.0")).toBe("1:1");
        expect(rrText("tbd")).toBe("tbd");
        expect(rrText("")).toBe("—");
    });
});

describe("trade dates", () => {
    it("uses the trade date, falling back to when it was logged", () => {
        expect(tradeTime({ dateOfTrade: "04 February 2026" })).toBe(new Date(2026, 1, 4).getTime());
        expect(tradeTime({ dateOfTrade: "nonsense", date: "2026-01-02T00:00:00Z" })).toBe(Date.parse("2026-01-02T00:00:00Z"));
        expect(tradeTime({})).toBeNaN();
    });
    it("orders newest first, same-day trades by when they were logged, undated last", () => {
        const a = trade({ dateOfTrade: "01 March 2026", date: "2026-03-01T09:00:00Z" });
        const b = trade({ dateOfTrade: "05 March 2026" });
        const c = trade({ dateOfTrade: "01 March 2026", date: "2026-03-01T15:00:00Z" });
        const d = trade({ dateOfTrade: "" });
        expect(newestFirst([a, d, b, c])).toEqual([b, c, a, d]);
    });
    it("formats the short, row and full forms", () => {
        const t = { dateOfTrade: "26 September 2026" };
        expect(shortDate(tradeTime(t))).toBe("26 Sep");
        expect(dayLabel(t)).toBe("Sat 26");
        expect(dayLabel(t, true)).toBe("26 Sep");
        expect(longDate(t)).toBe("Sat 26 Sep 2026");
        expect(dayLabel({ dateOfTrade: "someday" })).toBe("someday");
    });
    it("stores a date input's day the way trades always have", () => {
        expect(storedDate("2026-10-04")).toBe("04 October 2026");
        expect(storedDate("")).toBe("");
    });
});

describe("statsOf", () => {
    const list = [
        trade({ totalPnL: 300, riskRewardRatio: "2" }),
        trade({ totalPnL: -100, riskRewardRatio: "1:3" }),
        trade({ totalPnL: "100.5", riskRewardRatio: "1" }),
        trade({ totalPnL: 0 }), // breakeven: closed, but neither a win nor a loss
        trade({ tradeStatus: "Open", totalPnL: 0, riskRewardRatio: "x" }),
    ];
    const s = statsOf(list);

    it("counts open and closed trades, and wins and losses among the closed", () => {
        expect(s).toMatchObject({ total: 5, open: 1, closed: 4, wins: 2, losses: 1 });
    });
    it("works out win rate over closed trades only", () => {
        expect(s.winRate).toBe(50);
    });
    it("adds up money won and lost, and the profit factor", () => {
        expect(s.won).toBe(400.5);
        expect(s.lost).toBe(100);
        expect(s.net).toBe(300.5);
        expect(s.profitFactor).toBeCloseTo(4.005);
        expect(s.avgWin).toBe(200.25);
        expect(s.avgLoss).toBe(100);
    });
    it("averages the risk : reward over trades that have one", () => {
        expect(s.avgRR).toBe(2);
        expect(s.rrCount).toBe(3);
    });
    it("handles no trades, and wins with no losses", () => {
        expect(statsOf([])).toMatchObject({ total: 0, winRate: null, profitFactor: null, avgRR: null, net: 0 });
        expect(statsOf([trade({ totalPnL: 50 })]).profitFactor).toBe(Infinity);
    });
});

describe("equityOf", () => {
    it("runs the total over closed trades, oldest first", () => {
        const curve = equityOf([
            trade({ dateOfTrade: "03 March 2026", totalPnL: -50 }),
            trade({ dateOfTrade: "01 March 2026", totalPnL: 100 }),
            trade({ dateOfTrade: "04 March 2026", tradeStatus: "Open", totalPnL: 0 }),
            trade({ dateOfTrade: "02 March 2026", totalPnL: 25 }),
        ]);
        expect(curve.map((p) => p.sum)).toEqual([100, 125, 75]);
    });
});

describe("byMonth", () => {
    it("groups trades into calendar months, in the order given", () => {
        const list = newestFirst([
            trade({ dateOfTrade: "02 October 2026" }),
            trade({ dateOfTrade: "30 September 2026" }),
            trade({ dateOfTrade: "01 September 2026" }),
            trade({ dateOfTrade: "" }),
        ]);
        const months = byMonth(list);
        expect(months.map((m) => [m.label, m.rows.length])).toEqual([
            ["October 2026", 1],
            ["September 2026", 2],
            ["Undated", 1],
        ]);
    });
});

describe("grades", () => {
    it("bands checklist scores into A to D, and 0 as a counter trade", () => {
        expect([95, 90, 85, 75, 60, 0].map((p) => gradeKey({ totalPercentage: p }))).toEqual(["a", "a", "b", "c", "d", "x"]);
    });
});

describe("checklist ticking", () => {
    const sync = {
        _id: "sync",
        percentage: 30,
        secondaryStrategyPoints: [
            { _id: "h4", percentage: 12 },
            { _id: "h1", percentage: 10 },
            { _id: "m15", percentage: 8 },
        ],
    };
    const aoi = { _id: "aoi", percentage: 10, secondaryStrategyPoints: null };
    const points = [sync, aoi];
    const [h4, h1, m15] = sync.secondaryStrategyPoints;

    it("ticks a plain point on and off", () => {
        let sel = tickWhole({}, aoi);
        expect(checklistState(sel, aoi)).toBe("on");
        expect(checklistScore(sel, points)).toBe(10);
        sel = tickWhole(sel, aoi);
        expect(checklistState(sel, aoi)).toBe("off");
    });
    it("counts some parts as a partly ticked point", () => {
        const sel = tickPart(tickPart({}, sync, h4), sync, h1);
        expect(checklistState(sel, sync)).toBe("part");
        expect(checklistScore(sel, points)).toBe(22);
    });
    it("turns the last part into the whole, saved the way old trades were", () => {
        const sel = tickPart(tickPart(tickPart({}, sync, h4), sync, h1), sync, m15);
        expect(sel).toEqual({ sync: true });
        expect(checklistScore(sel, points)).toBe(30);
    });
    it("keeps the other parts when one is unticked from a whole", () => {
        const sel = tickPart({ sync: true }, sync, h1);
        expect(sel).toEqual({ h4: true, m15: true });
        expect(checklistScore(sel, points)).toBe(20);
    });
    it("ticks a partly ticked point as a whole, and clears a whole", () => {
        const whole = tickWhole({ h4: true }, sync);
        expect(whole).toEqual({ sync: true });
        expect(tickWhole(whole, sync)).toEqual({});
    });
});
