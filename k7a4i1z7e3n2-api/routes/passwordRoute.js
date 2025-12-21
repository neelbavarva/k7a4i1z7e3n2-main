const express = require("express");
const router = express.Router();
const Password = require("../schema/Passowrd");
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
        body("key").isString().isLength({ min: 8, max: 128 }),
        body("email").optional().isEmail().isLength({ max: 320 }),
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
    [body("key").isString().isLength({ min: 8, max: 128 })],
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
        body("key").optional().isString().isLength({ min: 8, max: 128 }),
        body("email").optional().isEmail().isLength({ max: 320 }),
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

module.exports = router;
