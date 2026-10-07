const mongoose = require("mongoose");

// The latest report from the Kaizen Reporter add-on running in an MT5 terminal: one document per
// account (server + login), replaced every time the add-on sends.
const mt5SnapshotSchema = new mongoose.Schema(
    {
        _id: { type: String }, // "<server>:<login>"
        login: String,
        server: String,
        company: String,
        name: String,
        currency: String,
        leverage: Number,
        balance: Number,
        equity: Number,
        margin: Number,
        freeMargin: Number,
        marginLevel: Number,
        positions: { type: Array, default: [] },
        updatedAt: Date,
    },
    { versionKey: false }
);

module.exports = mongoose.model("Mt5Snapshot", mt5SnapshotSchema);
