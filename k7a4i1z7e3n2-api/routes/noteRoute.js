const express = require("express");
const router = express.Router();
const Note = require("../schema/Note");
const { apiKeyMiddleware } = require("../middlewares");

const sanitize = (req, res, next) => {
    if (req.body && typeof req.body.text === "string") {
        req.body.text = req.body.text.replace(/\s+/g, " ").trim();
    }
    next();
};

const requireText = (req, res, next) => {
    if (
        !req.body ||
        typeof req.body.text !== "string" ||
        req.body.text.trim() === ""
    ) {
        return res.status(400).json({ message: "text is required" });
    }
    next();
};

router.get("/", apiKeyMiddleware, async (req, res) => {
    try {
        const note = await Note.findOne().lean();
        if (!note) return res.status(404).json({ message: "Not found" });
        res.json(note);
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/", apiKeyMiddleware, sanitize, requireText, async (req, res) => {
    try {
        const note = await Note.findOneAndUpdate(
            {},
            { text: req.body.text },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).lean();
        res.status(200).json(note);
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.put("/", apiKeyMiddleware, sanitize, requireText, async (req, res) => {
    try {
        const note = await Note.findOneAndUpdate(
            {},
            { text: req.body.text },
            { new: true, upsert: true }
        ).lean();
        res.json(note);
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
