const mongoose = require("mongoose");

const strategyPointSchema = new mongoose.Schema({
    name: String,
    percentage: Number,
    secondaryStrategyPoints: {
        type: [{ name: String, percentage: Number }],
        default: null,
    },
});

const StrategyPoint = mongoose.model("StrategyPoint", strategyPointSchema);

module.exports = StrategyPoint;
