const express = require("express");
const router = express.Router();
const Password = require("../schema/Passoword");
const { apiKeyMiddleware } = require("../middleware");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const argon2 = require("argon2");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = rateLimit;

const decryptLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 6,
    // per address and item; IPv6 addresses count by their /56 block, so one
    // device can't sidestep the limit by hopping addresses in its range
    keyGenerator: (req) =>
        `${ipKeyGenerator(req.ip || req.socket?.remoteAddress || "unknown")}:${req.params?.id || ""}`,
    handler: (req, res) =>
        res.status(429).json({ message: "Too many requests" }),
});

async function deriveKey(passphrase, saltBuffer) {
    const key = await argon2.hash(passphrase, {
        salt: saltBuffer,
        raw: true,
        type: argon2.argon2id,
        memoryCost: 1 << 16,
        timeCost: 3,
        parallelism: 1,
        hashLength: 32,
    });
    return key;
}

async function encryptText(plain, passphrase) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = await deriveKey(passphrase, salt);
    try {
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        const encrypted = Buffer.concat([
            cipher.update(plain, "utf8"),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        return {
            salt: salt.toString("hex"),
            iv: iv.toString("hex"),
            tag: tag.toString("hex"),
            data: encrypted.toString("hex"),
        };
    } finally {
        if (Buffer.isBuffer(key)) key.fill(0);
    }
}

async function decryptText(stored, passphrase) {
    const salt = Buffer.from(stored.salt, "hex");
    const iv = Buffer.from(stored.iv, "hex");
    const tag = Buffer.from(stored.tag, "hex");
    const data = Buffer.from(stored.data, "hex");
    const key = await deriveKey(passphrase, salt);
    try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([
            decipher.update(data),
            decipher.final(),
        ]);
        return decrypted.toString("utf8");
    } finally {
        if (Buffer.isBuffer(key)) key.fill(0);
    }
}

router.get("/getAllPasswords", apiKeyMiddleware, async (req, res) => {
    try {
        const query = {};
        if (req.user) query.owner = req.user;
        const passwords = await Password.find(query).select("-password");
        res.json(passwords);
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/getPasswords", apiKeyMiddleware, async (req, res) => {
    try {
        const query = { archive: false };
        if (req.user) query.owner = req.user;
        const passwords = await Password.find(query).select("-password");
        res.json(passwords);
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/getArchivePasswords", apiKeyMiddleware, async (req, res) => {
    try {
        const query = { archive: true };
        if (req.user) query.owner = req.user;
        const passwords = await Password.find(query).select("-password");
        res.json(passwords);
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/getNonBankingPasswords", apiKeyMiddleware, async (req, res) => {
    try {
        const query = {
            archive: false,
            category: { $in: ["web-app", "email", "other"] },
        };
        if (req.user) query.owner = req.user;
        const passwords = await Password.find(query).select("-password");
        res.json(passwords);
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.get(
    "/getNonBankingArchivePasswords",
    apiKeyMiddleware,
    async (req, res) => {
        try {
            const query = {
                archive: true,
                category: { $in: ["web-app", "email", "other"] },
            };
            if (req.user) query.owner = req.user;
            const passwords = await Password.find(query).select("-password");
            res.json(passwords);
        } catch {
            res.status(500).json({ message: "Server error" });
        }
    }
);

router.get("/getBankingPasswords", apiKeyMiddleware, async (req, res) => {
    try {
        const query = { archive: false, category: "banking" };
        if (req.user) query.owner = req.user;
        const passwords = await Password.find(query).select("-password");
        res.json(passwords);
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.get(
    "/getBankingArchivePasswords",
    apiKeyMiddleware,
    async (req, res) => {
        try {
            const query = { archive: true, category: "banking" };
            if (req.user) query.owner = req.user;
            const passwords = await Password.find(query).select("-password");
            res.json(passwords);
        } catch {
            res.status(500).json({ message: "Server error" });
        }
    }
);

router.get("/:id", apiKeyMiddleware, async (req, res) => {
    try {
        const doc = await Password.findById(req.params.id).select("-password");
        if (!doc) return res.status(404).json({ message: "Not found" });
        if (req.user && doc.owner && doc.owner.toString() !== req.user)
            return res.status(403).json({ message: "Forbidden" });
        res.json(doc);
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.post(
    "/newPassword",
    apiKeyMiddleware,
    [
        body("name").isString().isLength({ min: 1, max: 256 }),
        body("password").isString().isLength({ min: 1, max: 1024 }),
        body("key").isString().isLength({ min: 1, max: 128 }),
        body("email").optional().isString().isLength({ max: 320 }),
        body("category").optional().isString().isLength({ max: 64 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });
        try {
            const encrypted = await encryptText(
                req.body.password,
                req.body.key
            );
            const passwordDoc = new Password({
                name: req.body.name,
                email: req.body.email,
                category: req.body.category,
                password: encrypted,
                archive: req.body.archive,
            });
            if (req.user) passwordDoc.owner = req.user;
            const newPassword = await passwordDoc.save();
            const output = newPassword.toObject();
            delete output.password;
            res.status(201).json(output);
        } catch {
            res.status(400).json({ message: "Invalid input" });
        }
    }
);

router.post(
    "/decryptPassword/:id",
    apiKeyMiddleware,
    decryptLimiter,
    [body("key").isString().isLength({ min: 1, max: 128 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });
        try {
            const doc = await Password.findById(req.params.id);
            if (!doc) return res.status(404).json({ message: "Not found" });
            if (req.user && doc.owner && doc.owner.toString() !== req.user)
                return res.status(403).json({ message: "Forbidden" });

            if (doc.lockedUntil && doc.lockedUntil.getTime() > Date.now())
                return res
                    .status(423)
                    .json({ message: "Too many failed attempts, try later" });

            try {
                const decrypted = await decryptText(doc.password, req.body.key);
                doc.failedAttempts = 0;
                doc.lockedUntil = null;
                await doc.save();
                res.status(200).json({ password: decrypted });
            } catch {
                doc.failedAttempts = (doc.failedAttempts || 0) + 1;
                if (doc.failedAttempts >= 5) {
                    doc.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
                }
                await doc.save();
                res.status(401).json({ message: "Decryption failed" });
            }
        } catch {
            res.status(500).json({ message: "Server error" });
        }
    }
);

router.put(
    "/editPassword",
    apiKeyMiddleware,
    [
        body("id").isString(),
        body("name").optional().isString().isLength({ min: 1, max: 256 }),
        body("password").optional().isString().isLength({ min: 1, max: 1024 }),
        body("key").optional().isString().isLength({ min: 1, max: 128 }),
        body("email").optional().isString().isLength({ max: 320 }),
        body("category").optional().isString().isLength({ max: 64 }),
        body("archive").optional().isBoolean(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });
        try {
            const id = req.body.id;
            const doc = await Password.findById(id);
            if (!doc) return res.status(404).json({ message: "Not found" });
            if (req.user && doc.owner && doc.owner.toString() !== req.user)
                return res.status(403).json({ message: "Forbidden" });
            if (req.body.password) {
                if (!req.body.key)
                    return res
                        .status(400)
                        .json({ message: "Key required to update password" });
                doc.password = await encryptText(
                    req.body.password,
                    req.body.key
                );
            }
            if (req.body.name) doc.name = req.body.name;
            if (req.body.email) doc.email = req.body.email;
            if (typeof req.body.archive === "boolean")
                doc.archive = req.body.archive;
            if (req.body.category) doc.category = req.body.category;
            const updated = await doc.save();
            const output = updated.toObject();
            delete output.password;
            res.json(output);
        } catch {
            res.status(500).json({ message: "Server error" });
        }
    }
);

router.delete("/deletePassword/:id", apiKeyMiddleware, async (req, res) => {
    try {
        const doc = await Password.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: "Not found" });
        if (req.user && doc.owner && doc.owner.toString() !== req.user)
            return res.status(403).json({ message: "Forbidden" });
        await Password.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.post(
    "/changeKey",
    apiKeyMiddleware,
    [
        body("oldKey").isString().isLength({ min: 1, max: 128 }),
        body("newKey").isString().isLength({ min: 1, max: 128 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });

        if (req.body.oldKey === req.body.newKey)
            return res
                .status(400)
                .json({ message: "oldKey and newKey must be different" });

        try {
            const query = {};
            if (req.user) query.owner = req.user;

            const cursor = Password.find(query).cursor();
            let concurrency =
                parseInt(process.env.CHANGE_KEY_CONCURRENCY, 10) || 10;
            concurrency = Math.max(1, Math.min(concurrency, 100));

            const pool = new Set();

            let processed = 0;
            let updated = 0;
            let skipped = 0;
            let failed = 0;
            const changedSample = [];

            async function processDoc(doc) {
                processed++;
                let plain;
                try {
                    plain = await decryptText(doc.password, req.body.oldKey);
                } catch (err) {
                    skipped++;
                    return;
                }

                try {
                    doc.password = await encryptText(plain, req.body.newKey);
                    doc.failedAttempts = 0;
                    doc.lockedUntil = null;
                    await doc.save();
                    updated++;
                    if (changedSample.length < 100)
                        changedSample.push({
                            id: doc._id.toString(),
                            name: doc.name,
                        });
                } catch (err) {
                    failed++;
                }
            }

            for (
                let doc = await cursor.next();
                doc != null;
                doc = await cursor.next()
            ) {
                const p = processDoc(doc);
                pool.add(p);
                p.finally(() => pool.delete(p));
                if (pool.size >= concurrency) await Promise.race(pool);
            }

            await Promise.all(Array.from(pool));

            const summary = {
                processed,
                updated,
                skipped,
                failed,
                changedSample,
            };
            res.json({ summary });
        } catch {
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ---------------------------------------------------------------------------
// Breach check: decrypt every password with the given key (like changeKey, a
// wrong key just skips an entry and never counts as a failed attempt), then
// look each one up in Have I Been Pwned's Pwned Passwords range API.
// k-anonymity: only the first 5 hex characters of each SHA-1 hash leave this
// server; the matching is done here. Plaintext never leaves the server.
// Free, no API key: https://haveibeenpwned.com/API/v3#PwnedPasswords
// A client that accepts text/event-stream hears how many passwords are done
// while it runs ({ type: "progress", done, total }), then gets the report as
// the last message ({ type: "result", summary, results }). Anyone else gets
// the report in one go, as before.
// ---------------------------------------------------------------------------

const https = require("https");

const breachLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    handler: (req, res) =>
        res.status(429).json({ message: "Too many requests" }),
});

/** All breached suffixes for a 5-character SHA-1 prefix: Map(suffix -> count). */
function pwnedRange(prefix) {
    return new Promise((resolve, reject) => {
        const req = https.get(
            {
                host: "api.pwnedpasswords.com",
                path: `/range/${prefix}`,
                // padding hides how many real matches a prefix has from anyone watching
                headers: {
                    "Add-Padding": "true",
                    "User-Agent": "k7a4i1z7e3n2-vault-breach-check",
                },
                timeout: 10_000,
            },
            (res) => {
                if (res.statusCode !== 200) {
                    res.resume();
                    return reject(new Error(`HIBP ${res.statusCode}`));
                }
                let body = "";
                res.setEncoding("utf8");
                res.on("data", (c) => (body += c));
                res.on("end", () => {
                    const map = new Map();
                    for (const line of body.split("\n")) {
                        const [suffix, count] = line.trim().split(":");
                        const n = parseInt(count, 10);
                        if (suffix && n > 0) map.set(suffix, n); // padded rows have count 0
                    }
                    resolve(map);
                });
            }
        );
        req.on("timeout", () => req.destroy(new Error("HIBP timeout")));
        req.on("error", reject);
    });
}

async function runPool(items, limit, fn) {
    const pool = new Set();
    for (const item of items) {
        const p = fn(item);
        pool.add(p);
        p.finally(() => pool.delete(p));
        if (pool.size >= limit) await Promise.race(pool);
    }
    await Promise.all(Array.from(pool));
}

router.post(
    "/breachCheck",
    apiKeyMiddleware,
    breachLimiter,
    [body("key").isString().isLength({ min: 1, max: 128 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });

        // stop decrypting for a client that has gone (tab closed or reloaded)
        let gone = false;
        res.on("close", () => {
            if (!res.writableFinished) gone = true;
        });

        let send = null;
        if (req.accepts(["json", "text/event-stream"]) === "text/event-stream") {
            res.set({
                "Content-Type": "text/event-stream",
                // proxies must pass each message on as it is written
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
            });
            res.flushHeaders();
            send = (msg) => {
                if (!gone) res.write(`data: ${JSON.stringify(msg)}\n\n`);
            };
        }

        try {
            const query = { archive: false };
            if (req.user) query.owner = req.user;
            const docs = await Password.find(query);
            const total = docs.length;
            let done = 0;
            send?.({ type: "progress", done, total });

            let concurrency =
                parseInt(process.env.CHANGE_KEY_CONCURRENCY, 10) || 10;
            concurrency = Math.max(1, Math.min(concurrency, 100));

            // one range lookup per distinct prefix, shared by every password with it
            const ranges = new Map(); // prefix -> Promise<Map | null>
            let lookupFailed = 0;
            const rangeFor = (prefix) => {
                if (!ranges.has(prefix))
                    ranges.set(
                        prefix,
                        pwnedRange(prefix).catch(() => {
                            lookupFailed++;
                            return null; // null: this prefix couldn't be checked
                        })
                    );
                return ranges.get(prefix);
            };

            // 1. decrypt, hash and look up each password; keep only the hash.
            // A password counts as done once it's looked up, or skipped.
            const hashed = []; // { doc, hash, range }
            let skipped = 0;
            await runPool(docs, concurrency, async (doc) => {
                if (gone) return;
                try {
                    let plain;
                    try {
                        plain = await decryptText(doc.password, req.body.key);
                    } catch {
                        skipped++;
                        return;
                    }
                    const hash = crypto
                        .createHash("sha1")
                        .update(plain, "utf8")
                        .digest("hex")
                        .toUpperCase();
                    plain = null;
                    const range = await rangeFor(hash.slice(0, 5));
                    hashed.push({ doc, hash, range });
                } finally {
                    send?.({ type: "progress", done: ++done, total });
                }
            });
            if (gone) return;

            // 2. reuse: the same password under more than one entry
            const byHash = new Map();
            for (const h of hashed)
                byHash.set(h.hash, (byHash.get(h.hash) || 0) + 1);
            const groupOf = new Map();
            let g = 0;
            for (const [hash, n] of byHash) if (n > 1) groupOf.set(hash, ++g);

            const results = hashed.map(({ doc, hash, range }) => ({
                id: doc._id.toString(),
                name: doc.name,
                email: doc.email || "",
                category: doc.category || "",
                // null when the lookup for this prefix failed
                breachCount: range ? range.get(hash.slice(5)) || 0 : null,
                reuseGroup: groupOf.get(hash) || null,
            }));

            const summary = {
                processed: total,
                checked: hashed.length,
                skipped, // not encrypted with this key
                breached: results.filter((r) => r.breachCount > 0).length,
                reused: results.filter((r) => r.reuseGroup).length,
                unknown: results.filter((r) => r.breachCount === null).length,
                lookupFailed,
                checkedAt: new Date().toISOString(),
            };
            if (!send) return res.json({ summary, results });
            send({ type: "result", summary, results });
            res.end();
        } catch {
            if (gone) return;
            if (!send) return res.status(500).json({ message: "Server error" });
            send({ type: "error", message: "Server error" });
            res.end();
        }
    }
);

module.exports = router;
