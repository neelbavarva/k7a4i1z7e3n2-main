// The globe's places: cities on the land the globe draws, accounts in their cities, the sun.
import { describe, expect, it } from "vitest";
import { CITIES, landPoints, placeOf, toVec, sunVec } from "@/lib/places";
import { BANKS } from "@/lib/cards";
describe("places", () => {
    it("puts every city on land", () => {
        const land = landPoints();
        const far = Object.entries(CITIES).map(([k, c]) => {
            const v = toVec(c.at);
            const best = Math.max(...land.map((p) => p[0] * v[0] + p[1] * v[1] + p[2] * v[2]));
            return [k, +((Math.acos(Math.min(1, best)) * 180) / Math.PI).toFixed(2)];
        });
        expect(far.every(([, d]) => d < 2.5)).toBe(true);
    });
    it("places marks", () => {
        const b = (id) => ({ bank: BANKS.find((x) => x.id === id) });
        expect(placeOf(b("hdfc")).key).toBe("mumbai");
        expect(placeOf(b("bofa")).key).toBe("charlotte");
        expect(placeOf({ brand: "zerodha" }).key).toBe("bengaluru");
        expect(placeOf({ wallet: "trust" })).toBe(null);
        expect(placeOf({ glyph: "bank" })).toBe(undefined);
        // at the June solstice's noon in Greenwich, overhead on the Tropic of Cancer at longitude 0
        const s = sunVec(new Date("2026-06-21T12:00:00Z"));
        expect(Math.asin(s[1]) * (180 / Math.PI)).toBeCloseTo(23.4, 0);
        expect(Math.abs(s[0])).toBeLessThan(0.01);    });
});
