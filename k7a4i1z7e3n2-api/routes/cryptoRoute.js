const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator");
const CryptoWallet = require("../schema/CryptoWallet");
const { apiKeyMiddleware } = require("../middleware");
const crypto = require("../crypto");

// Crypto wallets for the net worth page: add one by its public address, and read every coin it
// holds with its value in rupees and dollars. Read only; no keys are ever asked for.

const invalid = (req, res, message) => {
    if (validationResult(req).isEmpty()) return false;
    res.status(400).json({ code: "input", message });
    return true;
};

/** Every wallet with its coins, valued. One wallet failing doesn't stop the others. */
router.get("/wallets", apiKeyMiddleware, async (req, res) => {
    try {
        const wallets = await CryptoWallet.find().sort({ createdAt: 1 }).lean();
        let px = {};
        let priceError = null;
        try {
            px = await crypto.prices();
        } catch (err) {
            priceError = err.message;
        }
        const fresh = req.query.fresh === "1";
        const out = await Promise.all(
            wallets.map(async (w) => {
                try {
                    const { holdings, errors } = await crypto.readWallet(w.chain, w.address, { fresh });
                    const valued = holdings.map((h) => {
                        const p = px[h.symbol] || {};
                        return { ...h, inr: p.inr != null ? h.amount * p.inr : null, usd: p.usd != null ? h.amount * p.usd : null, change24h: p.change24h ?? null };
                    });
                    const total = (k) => valued.reduce((a, h) => a + (h[k] || 0), 0);
                    return { ...w, holdings: valued.sort((a, b) => (b.inr || 0) - (a.inr || 0)), inr: total("inr"), usd: total("usd"), error: errors.length ? errors.join("; ") : null };
                } catch (err) {
                    return { ...w, holdings: [], inr: 0, usd: 0, error: err.message };
                }
            })
        );
        res.json({ fetchedAt: new Date().toISOString(), priceError, wallets: out });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.post(
    "/wallets",
    apiKeyMiddleware,
    [
        body("name").isString().trim().isLength({ min: 1, max: 40 }),
        body("address").isString().trim().isLength({ min: 20, max: 100 }),
        body("chain").optional().isIn(["evm", "btc", "tron", "sol"]),
    ],
    async (req, res) => {
        if (invalid(req, res, "Give the wallet a name and an address")) return;
        const address = req.body.address.trim();
        const chain = req.body.chain || crypto.detect(address);
        if (!chain || crypto.detect(address) !== chain) {
            return res.status(400).json({ code: "address", message: "That doesn't look like a Bitcoin, EVM (0x…), Tron (T…) or Solana address" });
        }
        try {
            if (await CryptoWallet.findOne({ address }).lean()) return res.status(409).json({ code: "exists", message: "That wallet is already added" });
            const doc = await CryptoWallet.create({ name: req.body.name.trim(), address, chain });
            res.status(201).json(doc);
        } catch {
            res.status(500).json({ message: "Server error" });
        }
    }
);

router.put("/wallets/:id", apiKeyMiddleware, [param("id").isMongoId(), body("name").isString().trim().isLength({ min: 1, max: 40 })], async (req, res) => {
    if (invalid(req, res, "Give the wallet a name")) return;
    try {
        const doc = await CryptoWallet.findByIdAndUpdate(req.params.id, { $set: { name: req.body.name.trim() } }, { new: true }).lean();
        if (!doc) return res.status(404).json({ message: "Not found" });
        res.json(doc);
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.delete("/wallets/:id", apiKeyMiddleware, [param("id").isMongoId()], async (req, res) => {
    if (invalid(req, res, "Unknown wallet")) return;
    try {
        const doc = await CryptoWallet.findByIdAndDelete(req.params.id).lean();
        if (!doc) return res.status(404).json({ message: "Not found" });
        res.json({ ok: true });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
