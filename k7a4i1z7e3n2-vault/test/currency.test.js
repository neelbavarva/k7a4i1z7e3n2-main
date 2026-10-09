// The net worth page's currency: rates from /worth/fx, rupee amounts turned into the one picked.
import { describe, expect, it } from "vitest";
import { currencyOf, moneyText, perRupee, ratesOf } from "@/lib/currency";

const RATES = { USD: 1, INR: 96.73, EUR: 0.894, JPY: 158.3, AED: 3.6725 };

describe("currency", () => {
    it("works out how much of each currency a rupee is", () => {
        expect(perRupee("INR", RATES)).toBe(1);
        expect(perRupee("USD", RATES)).toBeCloseTo(1 / 96.73, 8);
        expect(perRupee("EUR", RATES)).toBeCloseTo(0.894 / 96.73, 8);
        expect(perRupee("GBP", RATES)).toBe(null); // no rate: not offered
    });
    it("falls back to the dollar and the rupee when the server sends only the rate", () => {
        expect(ratesOf({ rate: 96.5 })).toEqual({ USD: 1, INR: 96.5 });
        expect(ratesOf(null)).toEqual({ INR: 1 });
        expect(ratesOf({ rate: 96.5, rates: RATES })).toBe(RATES);
    });
    it("sets rupees in lakh and crore, the rest in thousands and millions", () => {
        const inr = currencyOf("INR");
        const usd = currencyOf("USD");
        expect(moneyText(1843.42, inr)).toBe("₹1,843.42");
        expect(moneyText(422907.46, inr, { short: true })).toBe("₹4.23 L");
        expect(moneyText(12345678, inr, { short: true })).toBe("₹1.23 Cr");
        expect(moneyText(1234567.8, usd)).toBe("$1,234,567.80");
        expect(moneyText(4372.04, usd, { short: true })).toBe("$4,372");
        expect(moneyText(43720.4, usd, { short: true })).toBe("$43.7 K");
        expect(moneyText(2500000, usd, { short: true })).toBe("$2.50 M");
    });
    it("shows cents unless they're nought, yen whole, a code with a space, and signs", () => {
        expect(moneyText(787, currencyOf("INR"))).toBe("₹787");
        expect(moneyText(787, currencyOf("INR"), { paise: "always" })).toBe("₹787.00");
        expect(moneyText(1500.6, currencyOf("JPY"))).toBe("¥1,501");
        expect(moneyText(70.03, currencyOf("AED"))).toBe("AED 70.03");
        expect(moneyText(-12.5, currencyOf("EUR"))).toBe("−€12.50");
        expect(moneyText(189, currencyOf("INR"), { sign: true })).toBe("+₹189");
        // without the cents it's rounded, not cut
        expect(moneyText(1.95, currencyOf("USD"), { paise: "never", sign: true })).toBe("+$2");
        expect(moneyText(4372.5, currencyOf("USD"), { short: true })).toBe("$4,373");
    });
});
