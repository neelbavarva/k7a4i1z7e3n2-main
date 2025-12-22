const express = require("express");
const router = express.Router();
const Block = require("../schema/Block");
const { apiKeyMiddleware } = require("../middleware");
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
    apiKeyMiddleware,
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
    apiKeyMiddleware,
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

module.exports = router;
