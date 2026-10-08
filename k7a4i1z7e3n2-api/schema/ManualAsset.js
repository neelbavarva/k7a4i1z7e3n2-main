const mongoose = require("mongoose");

// Something the net worth page can't fetch on its own: a bank balance, cash, a deposit, a loan.
// Typed in by hand; `kind: "loan"` counts against the total. "invest" is a brokerage or investment
// account (Merrill, say), "funds" mutual funds (on Groww, say): accounts the server can't read.
const manualAssetSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 60 },
        kind: { type: String, enum: ["bank", "cash", "deposit", "invest", "funds", "crypto", "property", "other", "loan"], default: "bank" },
        amount: { type: Number, required: true },
        currency: { type: String, enum: ["INR", "USD"], default: "INR" },
        note: { type: String, trim: true, maxlength: 120, default: "" },
        bank: { type: String, trim: true, maxlength: 40, default: "" }, // a bank id from the vault's list, or a name typed in
    },
    { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("ManualAsset", manualAssetSchema);
