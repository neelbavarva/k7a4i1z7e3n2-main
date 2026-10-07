import { afterEach, describe, expect, it, vi } from "vitest";
import { CONNECT_MESSAGE, connectInWindow } from "@/lib/wallets";

// The vault in the split view's frame connects a wallet through a window of its own; these check
// that only that window, on this site, can hand addresses back.

const EVM = "0x52908400098527886E0F7030069857D2E4169EE7";
const SOL = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

function fakeWindow() {
    const popup = { closed: false };
    vi.spyOn(window, "open").mockReturnValue(popup);
    return popup;
}
const send = (data, { origin = window.location.origin, source } = {}) => window.dispatchEvent(new MessageEvent("message", { data, origin, source }));

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe("connecting a wallet from a frame", () => {
    it("opens the connect window and takes the addresses it sends back", async () => {
        const popup = fakeWindow();
        const done = connectInWindow("phantom", "app.phantom");
        expect(window.open).toHaveBeenCalledWith("/connect?wallet=phantom&rdns=app.phantom", "k7-connect", expect.any(String));
        send({ type: CONNECT_MESSAGE, addresses: [EVM, SOL, "not an address"], problems: [] }, { source: popup });
        const r = await done;
        expect(r.addresses.map((a) => a.chain).sort()).toEqual(["evm", "sol"]);
        expect(r.problems).toEqual([]);
    });

    it("ignores messages from another site or another window", async () => {
        vi.useFakeTimers();
        const popup = fakeWindow();
        const done = connectInWindow("trust", "");
        send({ type: CONNECT_MESSAGE, addresses: [EVM] }, { source: popup, origin: "https://evil.example" });
        send({ type: CONNECT_MESSAGE, addresses: [EVM] }, { source: {} });
        popup.closed = true;
        vi.advanceTimersByTime(700);
        const r = await done;
        expect(r.addresses).toEqual([]);
        expect(r.problems[0]).toMatch(/closed/);
    });

    it("says so when the browser blocks the window", async () => {
        vi.spyOn(window, "open").mockReturnValue(null);
        const r = await connectInWindow("trust", "");
        expect(r.addresses).toEqual([]);
        expect(r.problems[0]).toMatch(/pop-ups/);
    });
});
