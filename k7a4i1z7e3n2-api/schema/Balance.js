const mongoose = require("mongoose");

const balanceSchema = new mongoose.Schema({
    cryptoBalance: { type: Number, default: 0 },
    brokerBalance: { type: Number, default: 0 },
    totalFunded: { type: Number, default: 0 },
    totalFundedPayouts: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Balance", balanceSchema);
