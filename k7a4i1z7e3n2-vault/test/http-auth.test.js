import { afterEach, describe, expect, it, vi } from "vitest";
import { http, httpStream } from "@/lib/http";
import { UNLOCK_MS, lock, subscribe, unlock, unlockedAt } from "@/lib/auth";

/** A fetch Response whose body arrives in the given chunks. */
function streamed(chunks, type = "text/event-stream") {
    const enc = new TextEncoder();
    const body = new ReadableStream({
        start(c) {
            for (const ch of chunks) c.enqueue(enc.encode(ch));
            c.close();
        },
    });
    return new Response(body, { status: 200, headers: { "Content-Type": type } });
}

afterEach(() => vi.unstubAllGlobals());

describe("http", () => {
    it("sends the API key and JSON, and parses the answer", async () => {
        const fetch = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
        vi.stubGlobal("fetch", fetch);
        expect(await http("/x", { method: "POST", body: { a: 1 } })).toEqual({ ok: true });
        const [, init] = fetch.mock.calls[0];
        expect(init.headers["Content-Type"]).toBe("application/json");
        expect("x-api-key" in init.headers).toBe(true);
        expect(init.body).toBe('{"a":1}');
    });
    it("throws the status for a failed request", async () => {
        vi.stubGlobal("fetch", async () => new Response("no", { status: 429 }));
        await expect(http("/x")).rejects.toMatchObject({ status: 429 });
    });
});

describe("http retries", () => {
    afterEach(() => vi.useRealTimers());

    /** Runs a request while the clock moves on through every pause between tries. */
    async function settle(promise) {
        const out = promise.then(
            (v) => ({ v }),
            (e) => ({ e })
        );
        await vi.runAllTimersAsync();
        return out;
    }

    it("asks again three times when the server doesn't answer, then gives up", async () => {
        vi.useFakeTimers();
        const fetch = vi.fn(async () => new Response("{}", { status: 502 }));
        vi.stubGlobal("fetch", fetch);
        const { e } = await settle(http("/crypto/wallets"));
        expect(e).toMatchObject({ status: 502 });
        expect(fetch).toHaveBeenCalledTimes(4);
    });

    it("takes the answer from a later try, offline at first included", async () => {
        vi.useFakeTimers();
        const fetch = vi
            .fn()
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(new Response("{}", { status: 504 }))
            .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
        vi.stubGlobal("fetch", fetch);
        expect(await settle(http("/kite/status"))).toEqual({ v: { ok: true } });
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("never repeats a write, or an answer that won't change", async () => {
        vi.useFakeTimers();
        const fetch = vi.fn(async () => new Response("{}", { status: 500 }));
        vi.stubGlobal("fetch", fetch);
        expect((await settle(http("/worth/manual", { method: "POST", body: {} }))).e).toMatchObject({ status: 500 });
        expect(fetch).toHaveBeenCalledTimes(1);

        for (const [status, body] of [[503, '{"code":"unset"}'], [404, "{}"], [400, "{}"]]) {
            fetch.mockClear();
            fetch.mockImplementation(async () => new Response(body, { status }));
            expect((await settle(http("/kite/status"))).e).toMatchObject({ status });
            expect(fetch).toHaveBeenCalledTimes(1);
        }
    });
});

describe("httpStream", () => {
    it("asks for events, passes on progress and resolves with the result", async () => {
        const fetch = vi.fn(async () =>
            streamed([
                'data: {"type":"progress","done":0,"total":3}\n\n',
                // a message split across chunks, and two in one chunk
                'data: {"type":"progress","do',
                'ne":1,"total":3}\n\ndata: {"type":"progress","done":3,"total":3}\n\n',
                'data: {"type":"result","summary":{"checked":3},"results":[]}\n\n',
            ])
        );
        vi.stubGlobal("fetch", fetch);
        const seen = [];
        const out = await httpStream("/passwords/breachCheck", { body: { key: "k" }, onMessage: (m) => seen.push(m.done) });
        expect(fetch.mock.calls[0][1].headers.Accept).toBe("text/event-stream");
        expect(seen).toEqual([0, 1, 3]);
        expect(out.summary).toEqual({ checked: 3 });
        expect(out.results).toEqual([]);
    });
    it("takes an older server's one-go JSON answer as the result", async () => {
        vi.stubGlobal("fetch", async () => new Response('{"summary":{"checked":2},"results":[]}', { status: 200, headers: { "Content-Type": "application/json" } }));
        const onMessage = vi.fn();
        expect(await httpStream("/x", { body: {}, onMessage })).toEqual({ summary: { checked: 2 }, results: [] });
        expect(onMessage).not.toHaveBeenCalled();
    });
    it("fails on an error message, or a stream that ends without a result", async () => {
        vi.stubGlobal("fetch", async () => streamed(['data: {"type":"error","message":"Server error"}\n\n']));
        await expect(httpStream("/x", { body: {} })).rejects.toMatchObject({ status: 500 });
        vi.stubGlobal("fetch", async () => streamed(['data: {"type":"progress","done":1,"total":9}\n\n']));
        await expect(httpStream("/x", { body: {} })).rejects.toMatchObject({ status: 0 });
    });
    it("fails with the status when the request itself fails", async () => {
        vi.stubGlobal("fetch", async () => new Response("", { status: 404 }));
        await expect(httpStream("/x", { body: {} })).rejects.toMatchObject({ status: 404 });
    });
});

describe("auth", () => {
    it("is locked until unlocked, and the unlock lasts a day", () => {
        expect(unlockedAt()).toBe(0);
        const t = Date.now();
        unlock(t);
        expect(unlockedAt(t + 1000)).toBe(t);
        expect(unlockedAt(t + UNLOCK_MS + 1)).toBe(0);
        lock();
        expect(unlockedAt()).toBe(0);
    });
    it("tells subscribers when this tab or another one locks", () => {
        const cb = vi.fn();
        const off = subscribe(cb);
        unlock();
        lock();
        window.dispatchEvent(new StorageEvent("storage", { key: "auth" }));
        window.dispatchEvent(new StorageEvent("storage", { key: "something-else" }));
        expect(cb).toHaveBeenCalledTimes(3);
        off();
        unlock();
        expect(cb).toHaveBeenCalledTimes(3);
    });
});

describe("server lock", () => {
    afterEach(() => lock());
    it("sends the day's session with every request once unlocked with one", async () => {
        const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
        vi.stubGlobal("fetch", fetch);
        unlock(Date.now(), "signed.session");
        await http("/x");
        expect(fetch.mock.calls[0][1].headers["x-vault-session"]).toBe("signed.session");
        lock();
        await http("/x");
        expect("x-vault-session" in fetch.mock.calls[1][1].headers).toBe(false);
    });
    it("goes back to the lock screen when the server says the session is gone", async () => {
        vi.stubGlobal("fetch", async () => new Response('{"code":"locked"}', { status: 401 }));
        unlock(Date.now(), "old.session");
        await expect(http("/x")).rejects.toMatchObject({ status: 401, code: "locked" });
        expect(unlockedAt()).toBe(0);
    });
});
