const mongoose = require("mongoose");

// Today's Groww access token (encrypted) and when it dies.
const growwSessionSchema = new mongoose.Schema(
    {
        _id: { type: String, default: "groww" },
        token: { type: { iv: String, tag: String, data: String }, default: null },
        expiresAt: Date,
    },
    { versionKey: false }
);

module.exports = mongoose.model("GrowwSession", growwSessionSchema);
