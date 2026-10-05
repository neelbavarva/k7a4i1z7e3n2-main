import { describe, expect, it } from "vitest";
import {
    BANKS,
    CARD_FACES,
    composeBankName,
    detectNetwork,
    findBank,
    groupNumber,
    luhnValid,
    parseBankName,
    REGIONS,
    banksOf,
    regionsOf,
    rowFaces,
    searchBanks,
} from "@/lib/cards";

const net = (n) => detectNetwork(n)?.id ?? null;

describe("detectNetwork", () => {
    it("knows the common networks from their first digits", () => {
        expect(net("4111 1111 1111 1111")).toBe("visa");
        expect(net("5555555555554444")).toBe("mastercard");
        expect(net("2223000048400011")).toBe("mastercard"); // the 2-series range
        expect(net("378282246310005")).toBe("amex");
        expect(net("30569309025904")).toBe("diners");
        expect(net("6011111111111117")).toBe("discover");
        expect(net("3530111333300000")).toBe("jcb");
        expect(net("6200000000000005")).toBe("unionpay");
        expect(net("6759649826438453")).toBe("maestro");
    });
    it("prefers the longest matching prefix: RuPay over Discover's 65", () => {
        expect(net("6521500000000000")).toBe("rupay");
        expect(net("6500000000000000")).toBe("discover");
        expect(net("6080010000000000")).toBe("rupay");
    });
    it("works on a number still being typed, and gives up on nothing", () => {
        expect(net("4")).toBe("visa");
        expect(net("37")).toBe("amex");
        expect(net("")).toBeNull();
        expect(net("0000")).toBeNull();
    });
});

describe("luhnValid", () => {
    it("passes real test numbers and catches a typo", () => {
        expect(luhnValid("4111111111111111")).toBe(true);
        expect(luhnValid("378282246310005")).toBe(true);
        expect(luhnValid("4111111111111112")).toBe(false);
    });
    it("ignores spaces and refuses numbers too short to be cards", () => {
        expect(luhnValid("4111 1111 1111 1111")).toBe(true);
        expect(luhnValid("4111")).toBe(false);
    });
});

describe("groupNumber", () => {
    it("groups in fours, and Amex as 4-6-5", () => {
        expect(groupNumber("4111111111111111")).toBe("4111 1111 1111 1111");
        expect(groupNumber("378282246310005", detectNetwork("37"))).toBe("3782 822463 10005");
        expect(groupNumber("41111")).toBe("4111 1");
    });
});

describe("bankName", () => {
    it("joins bank, type and network, leaving out what's missing", () => {
        expect(composeBankName({ bank: "HDFC Bank", type: "Credit", network: "Visa" })).toBe("HDFC Bank · Credit · Visa");
        expect(composeBankName({ bank: "HDFC Bank" })).toBe("HDFC Bank");
    });
    it("reads them back, knowing the bank", () => {
        const p = parseBankName("HDFC Bank · Credit · Visa");
        expect(p.bank).toBe("HDFC Bank");
        expect(p.type).toBe("Credit");
        expect(p.network.id).toBe("visa");
        expect(p.known.id).toBe("hdfc");
    });
    it("keeps old cards with just a bank, and banks it doesn't know", () => {
        expect(parseBankName("SBI")).toMatchObject({ bank: "SBI", type: null, network: null });
        expect(parseBankName("SBI").known.id).toBe("sbi");
        expect(parseBankName("My Credit Union · Debit")).toMatchObject({ bank: "My Credit Union", type: "Debit", known: null });
        expect(parseBankName("")).toMatchObject({ bank: "", known: null });
    });
});

describe("finding banks", () => {
    it("matches full names, short names and aliases, any case", () => {
        expect(findBank("state bank")?.id).toBe("sbi");
        expect(findBank("hdfc")?.id).toBe("hdfc");
        expect(findBank("Indian Overseas Bank")?.id).toBe("iob");
        expect(findBank("nope")).toBeNull();
    });
    it("ranks a short-name match first", () => {
        expect(searchBanks("axis")[0].id).toBe("axis");
        expect(searchBanks("")).toEqual([]);
    });
    it("keeps the four most used banks on top", () => {
        expect(BANKS.filter((b) => b.top).map((b) => b.id)).toEqual(["hdfc", "sbi", "iob", "axis"]);
    });
});

describe("rowFaces", () => {
    it("never gives two neighbouring cards the same colours", () => {
        const cards = ["HDFC Bank", "HDFC Bank", "HDFC Bank", "Axis Bank", "Axis Bank"].map((b, i) => ({ _id: String(i), bankName: b }));
        const faces = cards.map((c) => rowFaces(cards).get(c._id));
        for (let i = 1; i < faces.length; i++) expect(faces[i]).not.toBe(faces[i - 1]);
        faces.forEach((f) => expect(CARD_FACES).toContain(f));
    });
});

describe("banks around the world", () => {
    it("lists the Indian banks first, so existing cards keep their faces", () => {
        const firstWorld = BANKS.findIndex((b) => b.region);
        expect(firstWorld).toBeGreaterThan(0);
        expect(BANKS.slice(firstWorld).every((b) => b.region)).toBe(true);
        expect(BANKS.slice(0, firstWorld).map((b) => b.id).slice(0, 4)).toEqual(["hdfc", "sbi", "iob", "axis"]);
    });
    it("has unique ids, and every region has banks", () => {
        const ids = BANKS.map((b) => b.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const r of REGIONS) expect(BANKS.some((b) => regionsOf(b).includes(r.id))).toBe(true);
    });
    it("lists India's foreign banks in their home regions too", () => {
        expect(regionsOf(findBank("HSBC"))).toEqual(["in", "gb"]);
        expect(regionsOf(findBank("Citibank"))).toContain("us");
    });
});

describe("smart bank search", () => {
    const top = (q, region) => searchBanks(q, region)[0]?.id;
    it("knows initials, with and without small words", () => {
        expect(top("boa")).toBe("bofa");
        expect(top("rbc")).toBe("rbc");
        expect(top("cba")).toBe("commbank");
    });
    it("ignores accents and forgives one typo", () => {
        expect(top("societe generale")).toBe("socgen");
        expect(top("barlcays")).toBe("barclays");
    });
    it("only guesses at typos when nothing matched properly", () => {
        expect(searchBanks("hdfc").map((b) => b.id)).toEqual(["hdfc"]);
    });
    it("puts banks from your region first among equal matches", () => {
        expect(top("national", "ca")).toBe("nbc");
        expect(top("national", "apac")).toBe("nab");
        expect(top("national", "me")).toBe("nbk");
    });
});

describe("banksOf", () => {
    it("lists the banks someone has cards with, most cards first", () => {
        const cards = ["Axis Bank · Credit", "HDFC Bank · Debit", "HDFC Bank · Credit", "My Credit Union"].map((bankName, i) => ({ _id: String(i), bankName }));
        expect(banksOf(cards)).toEqual(["hdfc", "axis"]);
        expect(banksOf([])).toEqual([]);
    });
});
