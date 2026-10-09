// The net worth page's currency: rates from /worth/fx, rupee amounts turned into the one picked.
import { describe, expect, it } from "vitest";
import { convert, currencyOf, fromRupees, moneyText, perRupee, ratesOf, roundIn, toRupees } from "@/lib/currency";

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
    it("turns any currency into rupees and back, through the day's rates", () => {
        // $1 is ₹96.73; €1 is ₹96.73 / 0.894
        expect(toRupees(100, "USD", RATES)).toBeCloseTo(9673);
        expect(toRupees(100, "EUR", RATES)).toBeCloseTo(9673 / 0.894);
        expect(toRupees(787, "INR", RATES)).toBe(787);
        expect(toRupees(5, undefined, RATES)).toBe(5); // a balance from before currencies: rupees
        expect(fromRupees(9673, "USD", RATES)).toBeCloseTo(100);
        expect(fromRupees(787, "INR", RATES)).toBe(787);
        // there and back comes to what it was
        for (const code of ["USD", "EUR", "JPY", "AED"]) expect(fromRupees(toRupees(123.45, code, RATES), code, RATES)).toBeCloseTo(123.45, 9);
    });
    it("turns one currency into another, the same one untouched", () => {
        expect(convert(100, "USD", "INR", RATES)).toBeCloseTo(9673);
        expect(convert(9673, "INR", "USD", RATES)).toBeCloseTo(100);
        expect(convert(100, "USD", "EUR", RATES)).toBeCloseTo(89.4);
        expect(convert(89.4, "EUR", "USD", RATES)).toBeCloseTo(100);
        expect(convert(100, "USD", "JPY", RATES)).toBeCloseTo(15830);
        expect(convert(11750.26, "USD", "USD", RATES)).toBe(11750.26);
        expect(convert("42.5", "INR", "INR", RATES)).toBe(42.5);
    });
    it("gives no figure, never a wrong one, for a currency without a rate", () => {
        expect(toRupees(100, "GBP", RATES)).toBe(null);
        expect(fromRupees(100, "GBP", RATES)).toBe(null);
        expect(convert(100, "GBP", "USD", RATES)).toBe(null);
        expect(convert(100, "USD", "GBP", RATES)).toBe(null);
        // with only the rupee known (the rates not in yet), nothing but rupees turns
        expect(toRupees(100, "USD", ratesOf(null))).toBe(null);
        expect(convert(100, "INR", "INR", ratesOf(null))).toBe(100);
    });
    it("rounds an amount the way its currency is written", () => {
        expect(roundIn(8.13856, "USD")).toBe(8.14);
        expect(roundIn(967.3049, "INR")).toBe(967.3);
        expect(roundIn(15830.6, "JPY")).toBe(15831);
        expect(roundIn(0.005, "EUR")).toBe(0.01);
        expect(roundIn(undefined, "USD")).toBe(0);
    });
});
