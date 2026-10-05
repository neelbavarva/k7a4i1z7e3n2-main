import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { BANKS, NETWORKS, findBank, searchBanks } from "@/lib/cards";
import { LOGOS } from "@/lib/logos";
import { BankCard, logoSize } from "@/components/Passwords";
import BankLogo from "@/components/k7/BankLogo";
import { markSize } from "@/components/k7/NetworkMark";

const DIR = path.join(process.cwd(), "public/logos");
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
const read = (id) => JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), "utf8"));
const vbOk = (vb) => typeof vb === "string" && vb.trim().split(/\s+/).length === 4 && vb.trim().split(/\s+/).every((n) => Number.isFinite(+n));

describe("bank logos", () => {
    it("every measured logo belongs to a listed bank and has its file", () => {
        const ids = new Set(BANKS.map((b) => b.id));
        for (const [id, m] of Object.entries(LOGOS)) {
            expect(ids.has(id), id).toBe(true);
            expect(files, id).toContain(`${id}.json`);
            expect(m.r, id).toBeGreaterThan(0);
            expect(m.d, id).toBeGreaterThan(0);
            expect(m.d, id).toBeLessThanOrEqual(1);
        }
    });

    it("every logo file is a measured bank's, with a box and a symbol where it says so", () => {
        for (const f of files) {
            const id = f.replace(/\.json$/, "");
            expect(LOGOS[id], id).toBeTruthy();
            const logo = read(id);
            expect(vbOk(logo.vb), id).toBe(true);
            expect(!!logo.sym, id).toBe(!!LOGOS[id].sym);
            if (logo.sym) expect(vbOk(logo.sym.vb), id).toBe(true);
        }
    });

    it("logo files are plain shapes only: nothing that runs, loads or styles", () => {
        const TAGS = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
        for (const f of files) {
            const logo = read(f.replace(/\.json$/, ""));
            for (const svg of [logo.svg, logo.sym?.svg].filter(Boolean)) {
                const tags = [...svg.matchAll(/<\/?\s*([a-zA-Z][\w:-]*)/g)].map((m) => m[1]);
                for (const t of tags) expect(TAGS.has(t), `${f}: <${t}>`).toBe(true);
                expect(svg, f).not.toMatch(/\son\w+\s*=|javascript:|href|url\(|<style|<script|@import/i);
            }
        }
    });
});

describe("J.P. Morgan and Chase", () => {
    it("are two banks, each found by its own name", () => {
        expect(findBank("J.P. Morgan")?.id).toBe("jpmorgan");
        expect(findBank("jp morgan")?.id).toBe("jpmorgan");
        expect(findBank("Chase")?.id).toBe("chase");
        expect(findBank("JPMorgan Chase")?.id).toBe("chase");
        expect(searchBanks("jp morgan")[0].id).toBe("jpmorgan");
        expect(searchBanks("chase")[0].id).toBe("chase");
    });
});

describe("logos on cards", () => {
    it("every listed bank has a logo, with its lettering measured where it has any", () => {
        for (const b of BANKS) {
            const m = LOGOS[b.id];
            expect(m, b.id).toBeTruthy();
            if (m.t !== undefined) {
                expect(m.t, b.id).toBeGreaterThan(0);
                expect(m.t, b.id).toBeLessThanOrEqual(1);
            }
        }
    });

    it("prints every bank's logo in the top corner, within its room", () => {
        for (const b of BANKS) {
            const { container } = render(<BankCard card={{ _id: b.id, bankName: `${b.name} · Credit · Visa`, cardName: "" }} />);
            expect(container.querySelector(".bc-logo"), b.id).toBeTruthy();
            expect(container.querySelector(".bc-wordmark"), b.id).toBeNull();
            const { w, h } = logoSize(LOGOS[b.id]);
            expect(w, b.id).toBeGreaterThan(8);
            expect(w, b.id).toBeLessThanOrEqual(44);
            expect(h, b.id).toBeGreaterThan(3.5);
            expect(h, b.id).toBeLessThanOrEqual(11);
            cleanup();
        }
    });

    it("gives a bank typed in a lockup of its initial and name instead", () => {
        const { container } = render(<BankCard card={{ _id: "x", bankName: "Saraswat Co-operative Bank · Debit · RuPay", cardName: "" }} />);
        expect(container.querySelector(".bc-logo")).toBeNull();
        expect(container.querySelector(".bc-monogram").textContent).toBe("S");
        expect(container.querySelector(".bc-wordmark-name").textContent).toBe("Saraswat Co-operative Bank");
    });

    it("sizes every network's mark to the bottom corner", () => {
        for (const n of NETWORKS) {
            const { width, height } = markSize(n);
            expect(parseFloat(width), n.id).toBeLessThanOrEqual(25);
            expect(parseFloat(height), n.id).toBeLessThanOrEqual(9.8);
            expect(parseFloat(width) * parseFloat(height), n.id).toBeGreaterThan(60);
        }
    });
});

describe("bank tiles", () => {
    it("clip a symbol cropped from the full logo to its crop", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ vb: "0 0 100 20", svg: '<rect width="100" height="20"/>', sym: { vb: "0 0 20 20" } }) });
        const { container } = render(<BankLogo id="test-crop" symbol />);
        await waitFor(() => expect(container.querySelector("svg svg")).toBeTruthy());
        const inner = container.querySelector("svg svg");
        expect(inner.getAttribute("viewBox")).toBe("0 0 20 20");
        expect(inner.getAttribute("width")).toBe("20");
    });
});
