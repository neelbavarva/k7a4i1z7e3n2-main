const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema({
    bankName: { type: String, required: true, trim: true },
    cardName: { type: String, trim: true },
    number: { type: Object, required: true },
    lastOfNumber: { type: String, trim: true },
    validTill: { type: Object, required: true },
    cvv: { type: Object, required: true },
    pin: { type: Object, required: true },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Card", cardSchema);
