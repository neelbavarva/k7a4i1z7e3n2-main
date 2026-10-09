const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator");
const ManualAsset = require("../schema/ManualAsset");
const WorthSnapshot = require("../schema/WorthSnapshot");
const { apiKeyMiddleware } = require("../middleware");
const market = require("../market");
const funds = require("../funds");

// The net worth page's own parts: the dollar rate, and the entries typed in by hand.

// the dollar rate (`rate`, rupees per dollar) and every currency the page can be shown in (`rates`, each per dollar)
router.get("/fx", apiKeyMiddleware, async (req, res) => {
    try {
        const fx = await market.fxRates();
        res.json({ rate: fx.rates.INR, date: fx.date, source: fx.source, rates: fx.rates });
    } catch {
        res.status(502).json({ code: "fx", message: "The dollar rate didn't load" });
    }
});

const KINDS = ["bank", "cash", "deposit", "invest", "funds", "crypto", "property", "other", "loan"];
const fields = [
    body("name").isString().trim().isLength({ min: 1, max: 60 }),
    body("kind").isIn(KINDS),
    body("amount").isFloat({ min: 0, max: 1e12 }).toFloat(),
    body("currency").isIn(["INR", "USD"]),
    body("note").optional().isString().trim().isLength({ max: 120 }),
    body("bank").optional().isString().trim().isLength({ max: 40 }),
    body("scheme").optional({ values: "null" }).isInt({ min: 1, max: 99999999 }).toInt(),
];
const pick = (b) => ({ name: b.name, kind: b.kind, amount: b.amount, currency: b.currency, note: b.note || "", bank: b.bank || "", scheme: b.scheme ?? null });
const invalid = (req, res, message = "Check the name, kind, amount and currency") => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return false;
    res.status(400).json({ code: "input", message });
    return true;
};

router.get("/manual", apiKeyMiddleware, async (req, res) => {
    try {
        res.json(await ManualAsset.find().sort({ kind: 1, name: 1 }).lean());
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/manual", apiKeyMiddleware, fields, async (req, res) => {
    if (invalid(req, res)) return;
    try {
        res.status(201).json(await ManualAsset.create(pick(req.body)));
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.put("/manual/:id", apiKeyMiddleware, [param("id").isMongoId(), ...fields], async (req, res) => {
    if (invalid(req, res)) return;
    try {
        const before = await ManualAsset.findById(req.params.id).lean();
        if (!before) return res.status(404).json({ message: "Not found" });
        const next = pick(req.body);
        const update = { $set: next };
        // a new figure: the one it replaces joins the trail, with when it was typed
        if (Math.abs((before.amount || 0) - next.amount) >= 0.005 || (before.currency || "INR") !== next.currency) {
            update.$push = { history: { $each: [{ at: before.updatedAt || before.createdAt || new Date(), amount: before.amount, currency: before.currency || "INR" }], $slice: -60 } };
        }
        const doc = await ManualAsset.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
        if (!doc) return res.status(404).json({ message: "Not found" });
        res.json(doc);
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.delete("/manual/:id", apiKeyMiddleware, [param("id").isMongoId()], async (req, res) => {
    if (invalid(req, res)) return;
    try {
        const doc = await ManualAsset.findByIdAndDelete(req.params.id).lean();
        if (!doc) return res.status(404).json({ message: "Not found" });
        res.json({ ok: true });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

// ---------- mutual funds: the list to pick from, and one fund's returns ----------

/** Every Direct Growth plan and ETF, from AMFI's daily NAV file. */
router.get("/funds", apiKeyMiddleware, async (req, res) => {
    try {
        res.set("Cache-Control", "private, max-age=3600");
        res.json(await funds.allFunds());
    } catch {
        res.status(502).json({ code: "funds", message: "AMFI's fund list didn't load" });
    }
});

/** One fund by its AMFI scheme code: latest NAV and its 1, 3 and 5 year returns. */
router.get("/funds/:code", apiKeyMiddleware, [param("code").matches(/^\d{3,8}$/)], async (req, res) => {
    if (invalid(req, res, "A scheme code is a number")) return;
    try {
        const fund = await funds.fundDetail(req.params.code);
        if (!fund) return res.status(404).json({ code: "fund", message: "No NAV history for that scheme" });
        res.json(fund);
    } catch {
        res.status(502).json({ code: "funds", message: "The fund's history didn't load" });
    }
});

// ---------- history: one snapshot a day ----------

const indiaDate = (ms = Date.now()) => new Date(ms + 5.5 * 36e5).toISOString().slice(0, 10);
const PART_KEYS = ["stocks", "funds", "cash", "forex", "crypto", "bank", "other", "loans"];

/** Today's total, sent by the vault once it has added everything up. */
router.post(
    "/history",
    apiKeyMiddleware,
    [body("total").isFloat({ min: -1e13, max: 1e13 }).toFloat(), body("parts").optional().isObject(), body("sources").optional().isInt({ min: 0, max: 100 }).toInt()],
    async (req, res) => {
        if (invalid(req, res, "Send a total")) return;
        const parts = {};
        for (const k of PART_KEYS) {
            const v = Number(req.body.parts?.[k]);
            if (Number.isFinite(v)) parts[k] = Math.round(v * 100) / 100;
        }
        try {
            const doc = await WorthSnapshot.findByIdAndUpdate(
                indiaDate(),
                { $set: { total: Math.round(req.body.total * 100) / 100, parts, sources: req.body.sources ?? null } },
                { upsert: true, new: true }
            ).lean();
            res.json({ date: doc._id, total: doc.total });
        } catch {
            res.status(500).json({ message: "Server error" });
        }
    }
);

/** The last `days` snapshots, oldest first. */
router.get("/history", apiKeyMiddleware, async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 365, 1), 3650);
    try {
        const docs = await WorthSnapshot.find({ _id: { $gte: indiaDate(Date.now() - days * 864e5) } })
            .sort({ _id: 1 })
            .lean();
        res.json(docs.map((d) => ({ date: d._id, total: d.total, parts: d.parts || {} })));
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
