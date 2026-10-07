const mongoose = require("mongoose");

// Something the net worth page can't fetch on its own: a bank balance, cash, a deposit, a loan.
// Typed in by hand; `kind: "loan"` counts against the total.
const manualAssetSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 60 },
        kind: { type: String, enum: ["bank", "cash", "deposit", "crypto", "property", "other", "loan"], default: "bank" },
        amount: { type: Number, required: true },
        currency: { type: String, enum: ["INR", "USD"], default: "INR" },
        note: { type: String, trim: true, maxlength: 120, default: "" },
    },
    { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("ManualAsset", manualAssetSchema);
