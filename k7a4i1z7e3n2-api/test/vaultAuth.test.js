// The vault lock checked on the server: codes, the unlock route, and sessions on data routes.
// Run with: npm test
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.SERVER_KEYS = "test-key";
process.env.SERVER_KEY = "test-key";
// RFC 6238's test secret ("12345678901234567890"), in base32
process.env.VAULT_TOTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const KEY = "test-key";

// failed attempts, kept in memory the way the Block model would keep them
const blocks = [];
const blockPath = require.resolve("../schema/Block");
class FakeBlock {
    constructor(fields) {
        Object.assign(this, fields);
    }
    async save() {
        if (!blocks.includes(this)) blocks.push(this);
        return this;
    }
    static async findOne(q) {
        return blocks.find((b) => b.ip === q.ip) || null;
    }
}
require.cache[blockPath] = { id: blockPath, filename: blockPath, loaded: true, exports: FakeBlock };

const vault = require("../vaultAuth");
const { apiKeyMiddleware } = require("../middleware");
const code = () => vault.codeAt(vault.base32(process.env.VAULT_TOTP_SECRET), Math.floor(Date.now() / 30000));

let server;
let base;
before(async () => {
    const express = require("express");
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.use("/otp", require("../routes/otpRoute"));
    app.get("/data", apiKeyMiddleware, (req, res) => res.json({ ok: true }));
    await new Promise((resolve) => (server = app.listen(0, resolve)));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server?.close());

let ip = 0;
const unlock = (c, from = `10.1.0.${++ip}`) =>
    fetch(`${base}/otp/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": KEY, "X-Forwarded-For": from },
        body: JSON.stringify({ code: c }),
    });

test("makes the same codes as an authenticator app (RFC 6238)", () => {
    // RFC 6238 appendix B: T = 59 s gives 94287082; apps show the last six digits
    assert.equal(vault.codeAt(vault.base32(process.env.VAULT_TOTP_SECRET), 1), "287082");
    assert.ok(vault.verifyCode(code()));
    assert.ok(!vault.verifyCode("000000") || code() === "000000");
    assert.ok(!vault.verifyCode("12345"));
});

test("a right code unlocks and gives a day's session", async () => {
    const res = await unlock(code());
    assert.equal(res.status, 200);
    const { session, expiresAt } = await res.json();
    assert.ok(vault.verifySession(session));
    const hours = (new Date(expiresAt) - Date.now()) / 36e5;
    assert.ok(hours > 23.9 && hours <= 24);
});

test("wrong codes count up and then block the address, even for a right code", async () => {
    const from = "10.2.0.1";
    const wrong = code() === "111111" ? "222222" : "111111";
    assert.equal((await unlock(wrong, from)).status, 401);
    assert.equal((await unlock(wrong, from)).status, 401);
    const third = await unlock(wrong, from);
    assert.equal(third.status, 403);
    assert.equal((await third.json()).blocked, true);
    assert.equal((await unlock(code(), from)).status, 403);
});

test("data routes need the session as well as the key", async () => {
    const get = (headers) => fetch(`${base}/data`, { headers: { "x-api-key": KEY, ...headers } });
    assert.equal((await get({})).status, 401);
    assert.equal((await get({ "x-vault-session": "forged.token" })).status, 401);
    const { session } = await (await unlock(code())).json();
    assert.equal((await get({ "x-vault-session": session })).status, 200);
    assert.equal((await fetch(`${base}/data`, { headers: { "x-vault-session": session } })).status, 401); // no key
});

test("an expired session is refused", () => {
    const { session } = vault.signSession(Date.now() - 25 * 36e5);
    assert.equal(vault.verifySession(session), false);
});
