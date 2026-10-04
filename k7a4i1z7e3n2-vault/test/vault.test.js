import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

const http = vi.fn();
const httpStream = vi.fn();
vi.mock("@/lib/http", () => ({ http: (...a) => http(...a), httpStream: (...a) => httpStream(...a) }));

import BreachCheck from "@/components/BreachCheck";
import Passwords from "@/components/Passwords";

/** A promise to settle from the test. */
function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => ((resolve = res), (reject = rej)));
    return { promise, resolve, reject };
}

const REPORT = {
    summary: { processed: 25, checked: 25, skipped: 0, breached: 1, reused: 0, unknown: 0, lookupFailed: 0 },
    results: [{ id: "p1", name: "GitHub", email: "dev@example.com", category: "web-app", breachCount: 12, reuseGroup: null }],
};

async function startCheck() {
    render(<BreachCheck open total={25} onClose={() => {}} onOpenPassword={() => {}} />);
    fireEvent.change(screen.getByLabelText("Decryption key"), { target: { value: "my key" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Check 25 passwords/ })));
}

describe("Breach check progress", () => {
    afterEach(() => vi.useRealTimers());

    it("counts passwords as the server reports them, then shows the report", async () => {
        const run = deferred();
        let report;
        httpStream.mockImplementation((path, { body, onMessage }) => {
            expect(path).toBe("/passwords/breachCheck");
            expect(body).toEqual({ key: "my key" });
            report = onMessage;
            return run.promise;
        });
        await startCheck();

        act(() => report({ type: "progress", done: 3, total: 25 }));
        const bar = screen.getByRole("progressbar", { name: "Passwords checked" });
        expect(bar.getAttribute("aria-valuenow")).toBe("3");
        expect(bar.getAttribute("aria-valuetext")).toBe("3 of 25 checked");
        expect(bar.querySelector("i").style.width).toBe("12%");

        await act(async () => run.resolve(REPORT));
        expect(screen.getByText("Found in breaches")).toBeTruthy();
        expect(screen.getByText("Seen 12 times")).toBeTruthy();
    });

    it("falls back to a running bar when the server can't report progress", async () => {
        vi.useFakeTimers();
        httpStream.mockImplementation(() => new Promise(() => {}));
        render(<BreachCheck open total={25} onClose={() => {}} onOpenPassword={() => {}} />);
        fireEvent.change(screen.getByLabelText("Decryption key"), { target: { value: "k" } });
        act(() => fireEvent.click(screen.getByRole("button", { name: /Check 25 passwords/ })));

        const bar = screen.getByRole("progressbar");
        expect(bar.className).not.toContain("is-waiting"); // a moment's grace for the first report
        act(() => vi.advanceTimersByTime(2000));
        expect(screen.getByRole("progressbar").className).toContain("is-waiting");
        expect(screen.getByRole("progressbar").hasAttribute("aria-valuenow")).toBe(false);
    });

    it("explains a rate limit", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        httpStream.mockRejectedValue(Object.assign(new Error("429"), { status: 429 }));
        await startCheck();
        expect(screen.getByText(/Checked a moment ago/)).toBeTruthy();
    });
});

describe("Revealing a password", () => {
    const PASSWORDS = [
        { _id: "a", name: "GitHub", email: "dev@example.com", category: "web-app", createdAt: "2026-10-01T00:00:00Z" },
        { _id: "b", name: "Figma", email: "design@example.com", category: "web-app", createdAt: "2026-09-01T00:00:00Z" },
    ];
    let pending;

    beforeEach(() => {
        pending = {};
        http.mockReset();
        http.mockImplementation(async (path) => {
            if (path === "/cards/getCards") return [];
            if (path === "/passwords/getPasswords") return PASSWORDS;
            const m = path.match(/decryptPassword\/(\w+)/);
            if (m) {
                pending[m[1]] = deferred();
                return pending[m[1]].promise;
            }
            return null;
        });
    });

    const openRow = async (name) => {
        fireEvent.click(await screen.findByRole("button", { name: new RegExp(name) }));
        return screen.findByRole("dialog");
    };
    const reveal = async (dialog, key) => {
        fireEvent.change(within(dialog).getByLabelText("Decryption key"), { target: { value: key } });
        await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: /Reveal password/ })));
    };

    it("shows the password once the key opens it", async () => {
        render(<Passwords />);
        const dialog = await openRow("GitHub");
        await reveal(dialog, "k");
        await act(async () => pending.a.resolve({ password: "hunter2-github" }));
        expect(within(dialog).getByText("hunter2-github")).toBeTruthy();
    });

    it("never shows an answer that arrives after moving on to another password", async () => {
        render(<Passwords />);
        let dialog = await openRow("GitHub");
        await reveal(dialog, "k");
        // close before the server answers, and open a different password
        await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Close" })));
        dialog = await openRow("Figma");
        await act(async () => pending.a.resolve({ password: "hunter2-github" }));

        expect(screen.queryByText("hunter2-github")).toBeNull();
        expect(within(dialog).getByRole("button", { name: /Reveal password/ })).toBeTruthy();
        expect(within(dialog).getByRole("button", { name: /Reveal password/ }).textContent).not.toContain("Decrypting");
    });
});
