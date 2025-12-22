const express = require("express");
const router = express.Router();
const Card = require("../schema/Card");
const { apiKeyMiddleware } = require("../middleware");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const argon2 = require("argon2");
const rateLimit = require("express-rate-limit");

const decryptLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 6,
    keyGenerator: (req) => {
        const ip =
            req.ip ||
            (req.headers &&
                (req.headers["x-forwarded-for"] || "").split(",")[0]) ||
            req.connection?.remoteAddress ||
            req.socket?.remoteAddress ||
            "unknown";
        return `${ip}:${req.params?.id || ""}`;
    },
    handler: (req, res) =>
        res.status(429).json({ message: "Too many requests" }),
});

async function deriveKey(passphrase, saltBuffer) {
    return await argon2.hash(passphrase, {
        salt: saltBuffer,
        raw: true,
        type: argon2.argon2id,
        memoryCost: 1 << 16,
        timeCost: 3,
        parallelism: 1,
        hashLength: 32,
    });
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

router.get("/getCards", apiKeyMiddleware, async (req, res) => {
    try {
        const query = {};
        if (req.user) query.owner = req.user;
        const cards = await Card.find(query).select(
            "-number -validTill -cvv -pin"
        );
        res.json(cards);
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/:id", apiKeyMiddleware, async (req, res) => {
    try {
        const doc = await Card.findById(req.params.id).select(
            "-number -validTill -cvv -pin"
        );
        if (!doc) return res.status(404).json({ message: "Not found" });
        if (req.user && doc.owner && doc.owner.toString() !== req.user)
            return res.status(403).json({ message: "Forbidden" });
        res.json(doc);
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.post(
    "/newCard",
    apiKeyMiddleware,
    [
        body("bankName").isString().isLength({ min: 1, max: 256 }),
        body("cardName").optional().isString().isLength({ max: 256 }),
        body("number").isString().isLength({ min: 6, max: 30 }),
        body("validTill").isString().isLength({ min: 3, max: 16 }),
        body("cvv").isString().isLength({ min: 3, max: 4 }),
        body("pin").isString().isLength({ min: 3, max: 10 }),
        body("key").isString().isLength({ min: 1, max: 128 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });

        try {
            const { bankName, cardName, number, validTill, cvv, pin, key } =
                req.body;
            const encNumber = await encryptText(number, key);
            const encValid = await encryptText(validTill, key);
            const encCvv = await encryptText(cvv, key);
            const encPin = await encryptText(pin, key);

            const cardDoc = new Card({
                bankName,
                cardName,
                lastOfNumber: number.slice(-4),
                number: encNumber,
                validTill: encValid,
                cvv: encCvv,
                pin: encPin,
            });
            if (req.user) cardDoc.owner = req.user;
            const newCard = await cardDoc.save();
            const output = newCard.toObject();
            delete output.number;
            delete output.validTill;
            delete output.cvv;
            delete output.pin;
            res.status(201).json(output);
        } catch {
            res.status(400).json({ message: "Invalid input" });
        }
    }
);

router.post(
    "/decryptCard/:id",
    apiKeyMiddleware,
    decryptLimiter,
    [body("key").isString().isLength({ min: 1, max: 128 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });

        try {
            const doc = await Card.findById(req.params.id);
            if (!doc) return res.status(404).json({ message: "Not found" });
            if (req.user && doc.owner && doc.owner.toString() !== req.user)
                return res.status(403).json({ message: "Forbidden" });

            if (doc.lockedUntil && doc.lockedUntil.getTime() > Date.now())
                return res
                    .status(423)
                    .json({ message: "Too many failed attempts, try later" });

            try {
                const number = await decryptText(doc.number, req.body.key);
                const validTill = await decryptText(
                    doc.validTill,
                    req.body.key
                );
                const cvv = await decryptText(doc.cvv, req.body.key);
                const pin = await decryptText(doc.pin, req.body.key);

                doc.failedAttempts = 0;
                doc.lockedUntil = null;
                await doc.save();

                res.status(200).json({ number, validTill, cvv, pin });
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
    "/editCard",
    apiKeyMiddleware,
    [
        body("id").isString(),
        body("bankName").optional().isString().isLength({ min: 1, max: 256 }),
        body("cardName").optional().isString().isLength({ max: 256 }),
        body("number").optional().isString().isLength({ min: 6, max: 30 }),
        body("validTill").optional().isString().isLength({ min: 3, max: 16 }),
        body("cvv").optional().isString().isLength({ min: 3, max: 4 }),
        body("pin").optional().isString().isLength({ min: 3, max: 10 }),
        body("key").optional().isString().isLength({ min: 1, max: 128 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });

        try {
            const id = req.body.id;
            const doc = await Card.findById(id);
            if (!doc) return res.status(404).json({ message: "Not found" });
            if (req.user && doc.owner && doc.owner.toString() !== req.user)
                return res.status(403).json({ message: "Forbidden" });

            if (req.body.bankName) doc.bankName = req.body.bankName;
            if (req.body.cardName) doc.cardName = req.body.cardName;

            if (req.body.number) {
                if (!req.body.key)
                    return res.status(400).json({
                        message: "Key required to update sensitive fields",
                    });
                doc.number = await encryptText(req.body.number, req.body.key);
                doc.lastOfNumber = req.body.number.slice(-4);
            }
            if (req.body.validTill) {
                if (!req.body.key)
                    return res.status(400).json({
                        message: "Key required to update sensitive fields",
                    });
                doc.validTill = await encryptText(
                    req.body.validTill,
                    req.body.key
                );
            }
            if (req.body.cvv) {
                if (!req.body.key)
                    return res.status(400).json({
                        message: "Key required to update sensitive fields",
                    });
                doc.cvv = await encryptText(req.body.cvv, req.body.key);
            }
            if (req.body.pin) {
                if (!req.body.key)
                    return res.status(400).json({
                        message: "Key required to update sensitive fields",
                    });
                doc.pin = await encryptText(req.body.pin, req.body.key);
            }

            const updated = await doc.save();
            const output = updated.toObject();
            delete output.number;
            delete output.validTill;
            delete output.cvv;
            delete output.pin;
            res.json(output);
        } catch {
            res.status(500).json({ message: "Server error" });
        }
    }
);

router.delete("/deleteCard/:id", apiKeyMiddleware, async (req, res) => {
    try {
        const doc = await Card.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: "Not found" });
        if (req.user && doc.owner && doc.owner.toString() !== req.user)
            return res.status(403).json({ message: "Forbidden" });
        await Card.findByIdAndDelete(req.params.id);
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

            const cursor = Card.find(query).cursor();
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
                let numberPlain, validPlain, cvvPlain, pinPlain;
                try {
                    numberPlain = await decryptText(
                        doc.number,
                        req.body.oldKey
                    );
                    validPlain = await decryptText(
                        doc.validTill,
                        req.body.oldKey
                    );
                    cvvPlain = await decryptText(doc.cvv, req.body.oldKey);
                    pinPlain = await decryptText(doc.pin, req.body.oldKey);
                } catch (err) {
                    skipped++;
                    return;
                }

                try {
                    doc.number = await encryptText(
                        numberPlain,
                        req.body.newKey
                    );
                    doc.validTill = await encryptText(
                        validPlain,
                        req.body.newKey
                    );
                    doc.cvv = await encryptText(cvvPlain, req.body.newKey);
                    doc.pin = await encryptText(pinPlain, req.body.newKey);
                    doc.failedAttempts = 0;
                    doc.lockedUntil = null;
                    await doc.save();
                    updated++;
                    if (changedSample.length < 100)
                        changedSample.push({
                            id: doc._id.toString(),
                            bankName: doc.bankName,
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

module.exports = router;
