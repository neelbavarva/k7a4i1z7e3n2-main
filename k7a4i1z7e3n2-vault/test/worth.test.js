import { describe, expect, it } from "vitest";
import { combine, cryptoWorth, manualWorth, zerodhaWorth } from "@/lib/worth";
import { demoAccount } from "@/lib/kiteDemo";
import { demoCrypto, demoManual } from "@/lib/worthDemo";

describe("net worth", () => {
    it("values Zerodha as holdings, Coin funds, and opening cash plus today's position P&L", () => {
        const w = zerodhaWorth(demoAccount());
        expect(w.parts.stocks).toBeCloseTo(60 * 288.6 + 6 * 1688.5 + 80 * 98.4 + 4 * 1402.6 + 8 * 712.3 + 10 * 409.8);
        expect(w.parts.funds).toBeCloseTo(182.406 * 86.94 + 61.38 * 168.2);
        expect(w.parts.cash).toBeCloseTo(12000 + 480 + 128);
        expect(w.total).toBeCloseTo(w.parts.stocks + w.parts.funds + w.parts.cash);
    });
    it("counts typed-in entries in rupees and takes loans off", () => {
        const w = manualWorth(demoManual(), 100);
        expect(w.parts.bank).toBe(42180 + 8950.75 + 25000 + 12000);
        expect(w.parts.stocks).toBe(1840 * 100); // Merrill, in dollars
        expect(w.parts.funds).toBe(31650); // mutual funds on Groww
        expect(w.parts.loans).toBe(6420);
        expect(w.total).toBeCloseTo(w.parts.bank + w.parts.stocks + w.parts.funds - 6420);
    });
    it("adds the sources up, skipping ones that didn't load", () => {
        const all = combine([zerodhaWorth(demoAccount()), null, manualWorth(demoManual(), 100)]);
        expect(all.total).toBeCloseTo(all.gross - all.parts.loans);
        expect(all.parts.stocks).toBeCloseTo(zerodhaWorth(demoAccount()).parts.stocks + 1840 * 100); // Zerodha, and Merrill typed in
    });
    it("counts crypto wallets, and a typed-in crypto entry, as crypto", () => {
        const c = cryptoWorth(demoCrypto());
        expect(c.parts.crypto).toBeCloseTo(demoCrypto().wallets.reduce((a, w) => a + w.inr, 0));
        expect(manualWorth([{ kind: "crypto", amount: 100, currency: "USD" }], 90).parts.crypto).toBe(9000);
        expect(combine([c, null]).parts.crypto).toBe(c.parts.crypto);
    });
});
