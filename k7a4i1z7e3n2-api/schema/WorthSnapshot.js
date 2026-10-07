const mongoose = require("mongoose");

// The net worth total once a day (India date), with its split by kind, for the history line.
// The vault sends it after a visit; a later visit the same day replaces it.
const worthSnapshotSchema = new mongoose.Schema(
    {
        _id: { type: String }, // "2026-10-08"
        total: Number,
        parts: { type: Map, of: Number, default: {} },
        sources: Number,
    },
    { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("WorthSnapshot", worthSnapshotSchema);
