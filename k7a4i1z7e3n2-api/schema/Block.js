const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema({
    ip: { type: String, trim: true, index: true },
    mac: { type: String, trim: true, index: true },
    failedAttempts: { type: Number, default: 0 },
    blocked: { type: Boolean, default: false },
    blockedUntil: { type: Date, default: null },
    lastAttempt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Block", blockSchema);
