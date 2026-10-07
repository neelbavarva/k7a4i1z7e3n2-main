const express = require("express");
const router = express.Router();
const Block = require("../schema/Block");
const { apiKeyMiddleware, apiKeyOnly } = require("../middleware");
const vault = require("../vaultAuth");
const { body, validationResult } = require("express-validator");

const MAX_FAILED = parseInt(process.env.OTP_MAX_FAILED || "3", 10);
const BLOCK_DURATION_MIN = parseInt(
    process.env.OTP_BLOCK_DURATION_MIN || "1440",
    10
);
const BLOCK_DURATION_MS = BLOCK_DURATION_MIN * 60 * 1000;

function getClientIp(req) {
    return (
        (req.headers && (req.headers["x-forwarded-for"] || "").split(",")[0]) ||
        req.ip ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        "unknown"
    );
}

router.post(
    "/isBlocked",
    apiKeyOnly,
    [body("mac").optional().isString().isLength({ max: 128 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });

        try {
            const ip = getClientIp(req);
            const mac = req.body.mac ? req.body.mac.trim() : null;
            const now = new Date();

            const doc = await Block.findOne({
                $and: [
                    { blocked: true },
                    {
                        $or: [{ ip }, mac ? { mac } : { _id: null }],
                    },
                ],
            });

            if (!doc) return res.json({ blocked: false });

            if (doc.blockedUntil && doc.blockedUntil.getTime() <= Date.now()) {
                // unblock expired
                doc.blocked = false;
                doc.failedAttempts = 0;
                doc.blockedUntil = null;
                await doc.save();
                return res.json({ blocked: false });
            }

            return res.json({
                blocked: true,
                blockedUntil: doc.blockedUntil,
                failedAttempts: doc.failedAttempts,
            });
        } catch {
            res.status(500).json({ message: "Server error" });
        }
    }
);

router.post(
    "/failure",
    apiKeyOnly,
    [body("mac").optional().isString().isLength({ max: 128 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });

        try {
            const ip = getClientIp(req);
            const mac = req.body.mac ? req.body.mac.trim() : null;
            const now = new Date();

            const query = mac ? { $or: [{ ip }, { mac }] } : { ip };
            let doc = await Block.findOne(query);

            if (!doc) {
                doc = new Block({ ip, mac, failedAttempts: 0 });
            }

            doc.failedAttempts = (doc.failedAttempts || 0) + 1;
            doc.lastAttempt = now;

            if (doc.failedAttempts >= MAX_FAILED) {
                doc.blocked = true;
                doc.blockedUntil = new Date(Date.now() + BLOCK_DURATION_MS);
            }

            await doc.save();

            return res.json({
                failedAttempts: doc.failedAttempts,
                blocked: doc.blocked,
                blockedUntil: doc.blockedUntil,
            });
        } catch {
            res.status(500).json({ message: "Server error" });
        }
    }
);

router.post(
    "/reset",
    apiKeyMiddleware,
    [body("mac").optional().isString().isLength({ max: 128 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });

        try {
            const ip = getClientIp(req);
            const mac = req.body.mac ? req.body.mac.trim() : null;
            const query = mac ? { $or: [{ ip }, { mac }] } : { ip };

            const doc = await Block.findOne(query);
            if (!doc) return res.json({ ok: true });

            doc.failedAttempts = 0;
            doc.blocked = false;
            doc.blockedUntil = null;
            await doc.save();
            return res.json({ ok: true });
        } catch {
            res.status(500).json({ message: "Server error" });
        }
    }
);

/**
 * The lock screen's code, checked here. Wrong codes count towards the same block as /failure;
 * a right one clears it and returns the day's session. 503 while VAULT_TOTP_SECRET isn't set,
 * which tells the vault to fall back to its old browser-side check.
 */
router.post(
    "/unlock",
    apiKeyOnly,
    [body("code").isString().isLength({ min: 6, max: 6 })],
    async (req, res) => {
        if (!vault.enforced()) return res.status(503).json({ code: "unset", message: "The server lock isn't set up" });
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ code: "input", message: "Send the 6-digit code" });

        try {
            const ip = getClientIp(req);
            let doc = await Block.findOne({ ip });
            if (doc?.blocked && doc.blockedUntil && doc.blockedUntil.getTime() > Date.now()) {
                return res.status(403).json({ code: "blocked", blocked: true, blockedUntil: doc.blockedUntil, failedAttempts: doc.failedAttempts });
            }

            if (vault.verifyCode(req.body.code)) {
                if (doc) {
                    doc.failedAttempts = 0;
                    doc.blocked = false;
                    doc.blockedUntil = null;
                    await doc.save();
                }
                return res.json(vault.signSession());
            }

            if (!doc) doc = new Block({ ip, failedAttempts: 0 });
            if (doc.blocked) {
                // an old block that has run out: start counting again
                doc.blocked = false;
                doc.failedAttempts = 0;
                doc.blockedUntil = null;
            }
            doc.failedAttempts = (doc.failedAttempts || 0) + 1;
            doc.lastAttempt = new Date();
            if (doc.failedAttempts >= MAX_FAILED) {
                doc.blocked = true;
                doc.blockedUntil = new Date(Date.now() + BLOCK_DURATION_MS);
            }
            await doc.save();
            res.status(doc.blocked ? 403 : 401).json({
                code: doc.blocked ? "blocked" : "wrong",
                blocked: doc.blocked,
                blockedUntil: doc.blockedUntil,
                failedAttempts: doc.failedAttempts,
            });
        } catch {
            res.status(500).json({ message: "Server error" });
        }
    }
);

module.exports = router;
