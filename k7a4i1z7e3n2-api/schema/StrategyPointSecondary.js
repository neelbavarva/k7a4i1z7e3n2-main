const mongoose = require("mongoose");

const strategyPointSecondarySchema = new mongoose.Schema({
    name: String,
    percentage: Number,
    secondaryStrategyPoints: {
        type: [{ name: String, percentage: Number }],
        default: null,
    },
});

const StrategyPointSecondary = mongoose.model(
    "StrategyPointSecondary",
    strategyPointSecondarySchema
);

module.exports = StrategyPointSecondary;
