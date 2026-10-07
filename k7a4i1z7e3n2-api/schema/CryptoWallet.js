const mongoose = require("mongoose");

// A crypto wallet by its public address only: no keys, no seed phrase. Its balances are read from
// the chain every time (crypto.js).
const cryptoWalletSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 40 },
        address: { type: String, required: true, trim: true, unique: true },
        chain: { type: String, enum: ["evm", "btc", "tron", "sol"], required: true },
    },
    { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("CryptoWallet", cryptoWalletSchema);
