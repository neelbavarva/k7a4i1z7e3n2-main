import { describe, expect, it } from "vitest";
import { AMCS, FUND_KINDS, FUNDS, fromApi, fundOf, houseOf, searchFunds } from "@/lib/funds";

describe("mutual funds", () => {
    it("knows a fund by its name or an old one, and its house", () => {
        expect(fundOf("SBI Gold Fund")?.house.name).toBe("SBI");
        expect(fundOf("sbi bluechip fund")?.name).toBe("SBI Large Cap Fund");
        expect(fundOf("GOLDBEES")?.name).toBe("Nippon India ETF Gold BeES");
        expect(fundOf("Some fund I typed")).toBe(null);
    });
    it("reads a name the way Groww writes it, plan and all", () => {
        expect(searchFunds("SBI Gold Direct Plan Growth").map((x) => x.name)).toEqual(expect.arrayContaining(["SBI Gold Fund", "SBI Gold ETF"]));
        expect(fundOf("SBI Gold Direct Plan Growth")?.name).toBe("SBI Gold Fund");
        expect(fundOf("Parag Parikh Flexi Cap Fund - Direct Plan - Growth")?.name).toBe("Parag Parikh Flexi Cap Fund");
        // "Growth" that's part of a name still finds it
        expect(searchFunds("growth mid cap").map((x) => x.name)).toContain("Nippon India Growth Mid Cap Fund");
    });
    it("finds funds by any words, and by kind", () => {
        expect(searchFunds("sbi gold").map((x) => x.name)).toEqual(expect.arrayContaining(["SBI Gold Fund", "SBI Gold ETF"]));
        expect(searchFunds("parag").every((x) => x.amc === "ppfas")).toBe(true);
        expect(searchFunds("", "gold").every((x) => x.kind === "gold")).toBe(true);
    });
    it("lists every fund once, each in a known house and kind", () => {
        expect(new Set(FUNDS.map((x) => x.name)).size).toBe(FUNDS.length);
        for (const x of FUNDS) {
            expect(AMCS.some((a) => a.id === x.amc), x.name).toBe(true);
            expect(FUND_KINDS.some((k) => k.id === x.kind), x.name).toBe(true);
        }
        // a house that's a bank's carries that bank's logo
        expect(AMCS.find((a) => a.id === "sbi").mark.bank?.id).toBe("sbi");
    });
    it("knows a house by AMFI's name for it or a fund's own name, and not Quantum for Quant", () => {
        expect(houseOf("Nippon India")?.id).toBe("nippon");
        expect(houseOf("Parag Parikh Flexi Cap Fund")?.id).toBe("ppfas");
        expect(houseOf("quant")?.id).toBe("quant");
        expect(houseOf("Quantum Gold Savings Fund")?.id).toBe("quantum");
        expect(houseOf("Aditya Birla Sun Life")?.id).toBe("absl");
        // one not listed: its own name and a plain mark, no letters
        expect(houseOf("360 ONE")).toMatchObject({ name: "360 ONE", mark: { glyph: "fund" } });
        expect(houseOf("")).toBe(null);
    });
    it("takes the API's funds: house and mark, old names for the well-known ones, best matches first", () => {
        const api = [
            { code: 1, name: "SBI Large Cap Fund", house: "SBI", kind: "equity", category: "Equity Large Cap" },
            { code: 2, name: "Small Fry Large Cap Fund", house: "Small Fry", kind: "equity", category: "Equity Large Cap" },
            { code: 3, name: "Nippon India ETF Gold BeES", house: "Nippon India", kind: "gold", category: "Commodities Gold" },
        ].map(fromApi);
        expect(api[0]).toMatchObject({ code: 1, popular: true, category: "Equity Large Cap" });
        expect(api[0].house.mark.bank?.id).toBe("sbi");
        expect(api[1].popular).toBe(false);
        // found by its old name, and by its category
        expect(fundOf("SBI Bluechip Fund", api)?.code).toBe(1);
        expect(searchFunds("commodities", "all", api).map((x) => x.code)).toEqual([3]);
        // the well-known fund first, though both match
        expect(searchFunds("large cap", "all", api).map((x) => x.code)).toEqual([1, 2]);
        expect(searchFunds("", "gold", api).map((x) => x.code)).toEqual([3]);
    });
    it("gives every well-known fund a category in Groww's words", () => {
        expect(fundOf("SBI Gold Fund").category).toBe("Commodities Gold");
        expect(fundOf("SBI Silver ETF").category).toBe("Commodities Silver");
        expect(fundOf("Nifty BeES").category).toBe("Equity ETF");
        expect(fundOf("Axis ELSS Tax Saver Fund").category).toBe("Equity ELSS");
        expect(FUNDS.every((x) => x.category)).toBe(true);
    });
});
