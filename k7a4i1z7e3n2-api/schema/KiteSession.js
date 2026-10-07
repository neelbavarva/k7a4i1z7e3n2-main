const mongoose = require("mongoose");

// The one Zerodha login this server holds: today's access token (encrypted), when it dies,
// and the short-lived code that hands a browser its session after the login redirect.
// Bumping `generation` signs every browser out.
const kiteSessionSchema = new mongoose.Schema(
    {
        _id: { type: String, default: "kite" },
        userId: String,
        userName: String,
        token: { type: { iv: String, tag: String, data: String }, default: null },
        loginAt: Date,
        expiresAt: Date,
        generation: { type: Number, default: 0 },
        handoff: { type: { hash: String, expiresAt: Date }, default: null },
    },
    { versionKey: false }
);

module.exports = mongoose.model("KiteSession", kiteSessionSchema);
