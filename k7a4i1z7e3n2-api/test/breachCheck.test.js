// The breach check route, run against an in-memory vault and a fake Have I Been Pwned.
// Run with: npm test
const { test, before, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const https = require("https");
const { Readable } = require("stream");
const { EventEmitter } = require("events");

// a key of our own, set before the middleware reads the environment (dotenv won't override it)
process.env.SERVER_KEYS = "test-key";
process.env.SERVER_KEY = "test-key";
const KEY = "test-key";

// the vault: the route asks the model for its documents; this one answers from memory
const docs = [];
const modelPath = require.resolve("../schema/Passoword");
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: { find: async () => docs } };

const argon2 = require("argon2");
const express = require("express");

/** Encrypted exactly the way the route stores passwords. */
async function encrypt(plain, passphrase) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = await argon2.hash(passphrase, { salt, raw: true, type: argon2.argon2id, memoryCost: 1 << 16, timeCost: 3, parallelism: 1, hashLength: 32 });
    const c = crypto.createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
    return { salt: salt.toString("hex"), iv: iv.toString("hex"), tag: c.getAuthTag().toString("hex"), data: data.toString("hex") };
}
const sha1 = (s) => crypto.createHash("sha1").update(s, "utf8").digest("hex").toUpperCase();

// Have I Been Pwned: "password" has been seen 9,999 times; everything else never.
// A prefix in `failing` answers 503, as if the lookup service were down.
const failing = new Set();
const asked = [];
function fakeHibp() {
    mock.method(https, "get", (options, onResponse) => {
        const prefix = options.path.split("/").pop();
        asked.push(prefix);
        const req = new EventEmitter();
        req.destroy = () => {};
        setImmediate(() => {
            const leaked = sha1("password");
            const lines = ["0000000000000000000000000000000000A:0"]; // padding, count 0
            if (leaked.startsWith(prefix)) lines.push(`${leaked.slice(5)}:9999`);
            const res = Readable.from([lines.join("\r\n")]);
            res.statusCode = failing.has(prefix) ? 503 : 200;
            onResponse(res);
        });
        return req;
    });
}

let server;
let base;
let ip = 0;
/** Each request from its own address, so the per-address rate limit only bites where a test wants it. */
const call = (headers = {}, body = { key: "right key" }, from = `10.0.0.${++ip}`) =>
    fetch(`${base}/passwords/breachCheck`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": KEY, "X-Forwarded-For": from, ...headers },
        body: JSON.stringify(body),
    });

before(async () => {
    fakeHibp();
    const plains = ["password", "correct horse battery staple", "password", "hunter2"];
    for (let i = 0; i < plains.length; i++) {
        docs.push({
            _id: { toString: () => `id${i}` },
            name: `Site ${i}`,
            email: i ? "" : "me@example.com",
            category: "web-app",
            // the last one is under a different key, so it's skipped, never failed
            password: await encrypt(plains[i], i === 3 ? "other key" : "right key"),
        });
    }
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.use("/passwords", require("../routes/passwordRoute"));
    await new Promise((resolve) => (server = app.listen(0, resolve)));
    base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

const check = (json) => {
    const { summary, results } = json;
    assert.equal(summary.processed, 4);
    assert.equal(summary.checked, 3);
    assert.equal(summary.skipped, 1);
    assert.equal(summary.breached, 2);
    assert.equal(summary.reused, 2);
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));
    assert.equal(byId.id0.breachCount, 9999);
    assert.equal(byId.id1.breachCount, 0);
    assert.equal(byId.id0.reuseGroup, byId.id2.reuseGroup);
    assert.notEqual(byId.id0.reuseGroup, null);
    assert.equal(byId.id1.reuseGroup, null);
    assert.equal(byId.id3, undefined);
    // nothing that could reveal a password leaves the server
    assert.doesNotMatch(JSON.stringify(json), /hunter2|correct horse|"password"/);
};

test("answers in one go to a plain request", async () => {
    const res = await call();
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /application\/json/);
    check(await res.json());
});

test("streams progress, then the same report, to a client that asks for events", async () => {
    const res = await call({ Accept: "text/event-stream" });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/event-stream/);
    assert.match(res.headers.get("cache-control"), /no-transform/);
    const messages = (await res.text())
        .split("\n\n")
        .filter(Boolean)
        .map((block) => JSON.parse(block.replace(/^data: /, "")));
    const progress = messages.filter((m) => m.type === "progress");
    assert.deepEqual(
        progress.map((m) => m.done),
        [0, 1, 2, 3, 4]
    );
    assert.ok(progress.every((m) => m.total === 4));
    const last = messages[messages.length - 1];
    assert.equal(last.type, "result");
    check(last);
});

test("only sends hash prefixes to Have I Been Pwned, once per prefix", async () => {
    asked.length = 0;
    await (await call()).json();
    assert.ok(asked.every((p) => /^[0-9A-F]{5}$/.test(p)));
    assert.equal(new Set(asked).size, asked.length);
    assert.ok(asked.includes(sha1("password").slice(0, 5)));
});

test("marks passwords it couldn't look up as unknown, not clean", async () => {
    failing.add(sha1("password").slice(0, 5));
    try {
        const { summary, results } = await (await call()).json();
        assert.equal(summary.unknown, 2);
        assert.equal(summary.lookupFailed, 1);
        assert.equal(results.find((r) => r.id === "id0").breachCount, null);
    } finally {
        failing.clear();
    }
});

test("a wrong key checks nothing and fails nothing", async () => {
    const { summary } = await (await call({}, { key: "nobody's key" })).json();
    assert.equal(summary.checked, 0);
    assert.equal(summary.skipped, 4);
});

test("refuses requests without the API key or without a key to decrypt with", async () => {
    assert.equal((await call({ "x-api-key": "wrong" })).status, 401);
    assert.equal((await call({}, {})).status, 400);
    assert.equal((await call({}, { key: "" })).status, 400);
});

test("allows three checks a minute from one address", async () => {
    const statuses = [];
    for (let i = 0; i < 4; i++) {
        const res = await call({}, { key: "nobody's key" }, "10.9.9.9");
        statuses.push(res.status);
        await res.text();
    }
    assert.deepEqual(statuses, [200, 200, 200, 429]);
});
