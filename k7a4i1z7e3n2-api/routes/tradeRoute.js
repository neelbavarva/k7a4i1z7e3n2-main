const express = require("express");
const router = express.Router();
const StrategyPoint = require("../schema/StrategyPoint");
const StrategyPointSecondary = require("../schema/StrategyPointSecondary");
const Trade = require("../schema/Trade");
const { apiKeyMiddleware } = require("../middleware");

router.get("/getStrategyPoints", apiKeyMiddleware, async (req, res) => {
    try {
        const strategyPoints = await StrategyPoint.find();
        res.json(strategyPoints);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch strategy points" });
    }
});

router.get(
    "/getStrategySecondaryPoints",
    apiKeyMiddleware,
    async (req, res) => {
        try {
            const strategyPoints = await StrategyPointSecondary.find();
            res.json(strategyPoints);
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch strategy points" });
        }
    }
);

router.post("/newTrade", apiKeyMiddleware, async (req, res) => {
    try {
        const {
            responses,
            riskRewardRatio,
            tradeType,
            dateOfTrade,
            tradeSymbol,
            tradeStatus,
            totalPnL,
            totalPercentage,
            description,
            isLowerTf,
            lowTf,
            midTf,
            highTf,
        } = req.body;

        if (
            !riskRewardRatio ||
            !tradeType ||
            !dateOfTrade ||
            !tradeSymbol ||
            !tradeStatus ||
            totalPnL === undefined
        ) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const newTrade = new Trade({
            responses,
            totalPercentage,
            riskRewardRatio,
            tradeType,
            dateOfTrade,
            tradeSymbol,
            tradeStatus,
            totalPnL,
            description,
            isLowerTf,
            lowTf,
            midTf,
            highTf,
        });

        await newTrade.save();
        res.json({ message: "Trade saved successfully", totalPercentage });
    } catch (error) {
        console.error("Error saving trade:", error);
        res.status(500).json({ error: "Failed to save trade" });
    }
});

router.get("/getTrades/:id", apiKeyMiddleware, async (req, res) => {
    try {
        const trade = await Trade.findById(req.params.id);
        if (!trade) {
            return res.status(404).json({ error: "Trade not found" });
        }

        const strategyPoints = await StrategyPoint.find();

        const responseData = strategyPoints.map((point) => {
            const userResponse = trade.responses.find(
                (r) => r.question === point.name
            );
            return {
                question: point.name,
                checked: userResponse ? userResponse.checked : false,
                percentage: point.percentage,
            };
        });

        res.json({
            totalPercentage: trade.totalPercentage,
            responses: responseData,
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch trade" });
    }
});

router.get("/getTrades", apiKeyMiddleware, async (req, res) => {
    try {
        const trades = await Trade.find().sort({ date: -1 });
        res.json(trades);
    } catch (error) {
        console.error("Error fetching trades:", error);
        res.status(500).json({ error: "Failed to fetch trades" });
    }
});

router.put("/updateTrade/:id", apiKeyMiddleware, async (req, res) => {
    try {
        const {
            totalPnL,
            tradeStatus,
            riskRewardRatio,
            description,
            lowTf,
            midTf,
            highTf,
        } = req.body;

        if (totalPnL === undefined || !tradeStatus) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const updatedTrade = await Trade.findByIdAndUpdate(
            req.params.id,
            {
                totalPnL,
                tradeStatus,
                riskRewardRatio,
                description,
                lowTf,
                midTf,
                highTf,
            },
            { new: true }
        );

        if (!updatedTrade) {
            return res.status(404).json({ error: "Trade not found" });
        }

        res.json({ message: "Trade updated successfully", updatedTrade });
    } catch (error) {
        console.error("Error updating trade:", error);
        res.status(500).json({ error: "Failed to update trade" });
    }
});

module.exports = router;
