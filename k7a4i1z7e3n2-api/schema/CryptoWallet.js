const mongoose = require("mongoose");

// A crypto wallet as a name and its public addresses, one per chain it holds coins on (Trust Wallet
// has an EVM, a Bitcoin, a Tron and a Solana address, say). No keys, no seed phrase. Balances are
// read from the chains every time (crypto.js). Wallets saved before addresses were grouped have a
// single `address` and `chain` instead; the route reads both shapes.
const cryptoWalletSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 40 },
        addresses: {
            type: [{ _id: false, chain: { type: String, enum: ["evm", "btc", "tron", "sol"] }, address: { type: String, trim: true } }],
            default: [],
        },
        address: { type: String, trim: true }, // older single-address wallets
        chain: { type: String, enum: ["evm", "btc", "tron", "sol"] },
    },
    { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("CryptoWallet", cryptoWalletSchema);
