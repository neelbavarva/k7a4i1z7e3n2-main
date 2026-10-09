const mongoose = require("mongoose");

const tradeSchema = new mongoose.Schema({
    date: { type: Date, default: Date.now },
    responses: [
        {
            question: { type: String, required: true },
            checked: { type: Boolean, required: true },
            secondaryResponses: {
                type: [
                    {
                        question: { type: String, required: true },
                        checked: { type: Boolean, required: true },
                    },
                ],
                default: null,
            },
        },
    ],
    totalPercentage: { type: Number, required: true },
    riskRewardRatio: { type: String, required: true },
    tradeType: { type: String, required: true },
    dateOfTrade: { type: String, required: true },
    tradeSymbol: { type: String, required: true },
    tradeStatus: { type: String, required: true },
    totalPnL: { type: Number, required: false },
    description: { type: String, required: false },
    isLowerTf: { type: Boolean, required: false },
    lowTf: { type: String, required: false },
    midTf: { type: String, required: false },
    highTf: { type: String, required: false },
    // archived: its result is out of the vault's total P&L (and the net worth); every stat still counts it
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
});

const Trade = mongoose.model("Trade", tradeSchema);

module.exports = Trade;
