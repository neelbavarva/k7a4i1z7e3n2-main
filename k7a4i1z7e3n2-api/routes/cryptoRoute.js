const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator");
const CryptoWallet = require("../schema/CryptoWallet");
const { apiKeyMiddleware } = require("../middleware");
const crypto = require("../crypto");

// Crypto wallets for the net worth page: a name and its public addresses (paste them all at once),
// and every coin they hold with its value in rupees and dollars. Read only; no keys ever.

const MAX_ADDRESSES = 20;

/** A wallet's addresses, whichever shape it was saved in. */
const addressesOf = (w) => (w.addresses?.length ? w.addresses : w.address ? [{ chain: w.chain, address: w.address }] : []);

// The first version kept one address per wallet under a unique index; wallets now hold a list,
// so that index has to go. Done once, the first time the route is used.
let indexesSynced = null;
const syncIndexes = () => (indexesSynced ||= CryptoWallet.syncIndexes?.().catch(() => null) || Promise.resolve());

/**
 * Checks a pasted list: every address must be a Bitcoin, EVM, Tron or Solana one, none twice, and
 * none already in another wallet. Returns { list } or { error }.
 */
async function checkAddresses(raw, exceptId) {
    const items = (Array.isArray(raw) ? raw : String(raw || "").split(/[\s,;]+/)).map((a) => String(a).trim()).filter(Boolean);
    if (!items.length) return { error: "Add at least one address" };
    if (items.length > MAX_ADDRESSES) return { error: `Up to ${MAX_ADDRESSES} addresses a wallet` };
    const bad = items.filter((a) => !crypto.detect(a));
    if (bad.length) return { error: `Not a Bitcoin, EVM (0x…), Tron (T…) or Solana address: ${bad.slice(0, 3).join(", ")}` };
    const seen = new Set();
    const list = [];
    for (const address of items) {
        const key = /^0x/i.test(address) ? address.toLowerCase() : address; // EVM addresses ignore case
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({ chain: crypto.detect(address), address });
    }
    const others = (await CryptoWallet.find().lean()).filter((w) => String(w._id) !== String(exceptId));
    const taken = new Set(others.flatMap(addressesOf).map((a) => (/^0x/i.test(a.address) ? a.address.toLowerCase() : a.address)));
    const clash = list.find((a) => taken.has(/^0x/i.test(a.address) ? a.address.toLowerCase() : a.address));
    if (clash) return { error: `Already in another wallet: ${clash.address}`, code: "exists" };
    return { list };
}

const failed = (req, res, message) => {
    if (validationResult(req).isEmpty()) return false;
    res.status(400).json({ code: "input", message });
    return true;
};

/** Every wallet, each address with its coins, and the wallet's coins added up. */
router.get("/wallets", apiKeyMiddleware, async (req, res) => {
    try {
        await syncIndexes();
        const wallets = await CryptoWallet.find().sort({ createdAt: 1 }).lean();
        let px = {};
        let priceError = null;
        try {
            px = await crypto.prices();
        } catch (err) {
            priceError = err.message;
        }
        const fresh = req.query.fresh === "1";
        const value = (h) => {
            const p = px[h.symbol] || {};
            return { ...h, inr: p.inr != null ? h.amount * p.inr : null, usd: p.usd != null ? h.amount * p.usd : null, change24h: p.change24h ?? null };
        };
        const add = (list, k) => list.reduce((a, h) => a + (h[k] || 0), 0);

        const out = await Promise.all(
            wallets.map(async (w) => {
                const addresses = await Promise.all(
                    addressesOf(w).map(async ({ chain, address }) => {
                        try {
                            const { holdings, errors } = await crypto.readWallet(chain, address, { fresh });
                            const valued = holdings.map(value).sort((x, y) => (y.inr || 0) - (x.inr || 0));
                            return { chain, address, holdings: valued, inr: add(valued, "inr"), usd: add(valued, "usd"), error: errors.length ? errors.join("; ") : null };
                        } catch (err) {
                            return { chain, address, holdings: [], inr: 0, usd: 0, error: err.message };
                        }
                    })
                );
                const holdings = addresses.flatMap((a) => a.holdings).sort((x, y) => (y.inr || 0) - (x.inr || 0));
                const errors = addresses.filter((a) => a.error).map((a) => a.error);
                return {
                    _id: w._id,
                    name: w.name,
                    createdAt: w.createdAt,
                    addresses,
                    holdings,
                    inr: add(addresses, "inr"),
                    usd: add(addresses, "usd"),
                    error: errors.length ? errors.join("; ") : null,
                };
            })
        );
        res.json({ fetchedAt: new Date().toISOString(), priceError, wallets: out });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

const nameRule = body("name").isString().trim().isLength({ min: 1, max: 40 });

/** A wallet from a name and its addresses (a list, or one pasted block). */
router.post("/wallets", apiKeyMiddleware, [nameRule], async (req, res) => {
    if (failed(req, res, "Give the wallet a name")) return;
    try {
        await syncIndexes();
        const raw = req.body.addresses ?? req.body.address;
        const { list, error, code } = await checkAddresses(raw);
        if (error) return res.status(code === "exists" ? 409 : 400).json({ code: code || "address", message: error });
        res.status(201).json(await CryptoWallet.create({ name: req.body.name.trim(), addresses: list }));
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

/** Rename a wallet, or replace its list of addresses. */
router.put("/wallets/:id", apiKeyMiddleware, [param("id").isMongoId(), nameRule.optional()], async (req, res) => {
    if (failed(req, res, "Check the name")) return;
    try {
        const set = {};
        if (req.body.name !== undefined) set.name = req.body.name.trim();
        if (req.body.addresses !== undefined) {
            const { list, error, code } = await checkAddresses(req.body.addresses, req.params.id);
            if (error) return res.status(code === "exists" ? 409 : 400).json({ code: code || "address", message: error });
            set.addresses = list;
        }
        const update = { $set: set };
        if (set.addresses) update.$unset = { address: "", chain: "" }; // an older wallet moves to the list
        const doc = await CryptoWallet.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
        if (!doc) return res.status(404).json({ message: "Not found" });
        res.json(doc);
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.delete("/wallets/:id", apiKeyMiddleware, [param("id").isMongoId()], async (req, res) => {
    if (failed(req, res, "Unknown wallet")) return;
    try {
        const doc = await CryptoWallet.findByIdAndDelete(req.params.id).lean();
        if (!doc) return res.status(404).json({ message: "Not found" });
        res.json({ ok: true });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
