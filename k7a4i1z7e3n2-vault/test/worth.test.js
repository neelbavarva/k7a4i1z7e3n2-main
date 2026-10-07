import { describe, expect, it } from "vitest";
import { combine, cryptoWorth, growwWorth, manualWorth, mt5Worth, perUnit, zerodhaWorth } from "@/lib/worth";
import { demoAccount } from "@/lib/kiteDemo";
import { demoCrypto, demoGroww, demoManual, demoMt5 } from "@/lib/worthDemo";

describe("net worth", () => {
    it("values Zerodha as holdings, Coin funds, and opening cash plus today's position P&L", () => {
        const w = zerodhaWorth(demoAccount());
        expect(w.parts.stocks).toBeCloseTo(136440.8);
        expect(w.parts.funds).toBeGreaterThan(0);
        expect(w.parts.cash).toBeCloseTo(245000 + 60000 - 1495);
        expect(w.total).toBeCloseTo(w.parts.stocks + w.parts.funds + w.parts.cash);
    });
    it("values Groww holdings at price, or at cost when there's no price", () => {
        const w = growwWorth({
            holdings: { data: [{ quantity: 10, average_price: 100, last_price: 120, close_price: 110 }, { quantity: 5, average_price: 40, last_price: null }] },
            funds: { data: { clear_cash: 500 } },
        });
        expect(w.parts.stocks).toBe(1200 + 200);
        expect(w.parts.cash).toBe(500);
        expect(w.day).toBe(100);
        expect(w.unpriced).toBe(1);
    });
    it("converts MT5 equity to rupees, US cents too, and leaves prop accounts out", () => {
        expect(perUnit("USD", 90)).toBe(90);
        expect(perUnit("USC", 90)).toBe(0.9);
        expect(perUnit("INR", 90)).toBe(1);
        expect(perUnit("EUR", 90)).toBe(null);
        const [mine] = demoMt5().accounts;
        const funded = { ...mine, prop: true, counted: false, info: { ...mine.info, equity: 10388.1 } };
        const [own, prop] = [mine, funded].map((a) => mt5Worth(a, 100));
        expect(own.total).toBeCloseTo(253684);
        expect(own.counted).toBe(true);
        expect(prop.total).toBe(0);
        expect(prop.value).toBeCloseTo(1038810);
        expect(prop.counted).toBe(false);
    });
    it("counts typed-in entries in rupees and takes loans off", () => {
        const w = manualWorth(demoManual(), 100);
        expect(w.parts.bank).toBe(186420 + 54210.75 + 200000 + 64000);
        expect(w.parts.loans).toBe(18750);
        expect(w.total).toBeCloseTo(w.parts.bank - 18750);
    });
    it("adds the sources up, skipping ones that didn't load", () => {
        const all = combine([zerodhaWorth(demoAccount()), growwWorth(demoGroww().sections), null, manualWorth(demoManual(), 100)]);
        expect(all.total).toBeCloseTo(all.gross - all.parts.loans);
        expect(all.parts.stocks).toBeGreaterThan(136440);
    });
    it("counts crypto wallets, and a typed-in crypto entry, as crypto", () => {
        const c = cryptoWorth(demoCrypto());
        expect(c.parts.crypto).toBeCloseTo(demoCrypto().wallets.reduce((a, w) => a + w.inr, 0));
        expect(manualWorth([{ kind: "crypto", amount: 100, currency: "USD" }], 90).parts.crypto).toBe(9000);
        expect(combine([c, null]).parts.crypto).toBe(c.parts.crypto);
    });
});
