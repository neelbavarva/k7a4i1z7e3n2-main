const express = require("express");
const router = express.Router();
const Balance = require("../schema/Balance");
const { apiKeyMiddleware } = require("../middleware");

// Get balance
router.get("/", apiKeyMiddleware, async (req, res) => {
    try {
        const balance = await Balance.findOne().lean();
        if (!balance) {
            return res.status(404).json({ message: "Balance not found" });
        }
        res.json(balance);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Create or update balance
router.post("/", apiKeyMiddleware, async (req, res) => {
    try {
        const { cryptoBalance, brokerBalance, totalFunded, totalFundedPayouts } = req.body;
        
        const updateData = { updatedAt: Date.now() };
        if (typeof cryptoBalance === 'number') updateData.cryptoBalance = cryptoBalance;
        if (typeof brokerBalance === 'number') updateData.brokerBalance = brokerBalance;
        if (typeof totalFunded === 'number') updateData.totalFunded = totalFunded;
        if (typeof totalFundedPayouts === 'number') updateData.totalFundedPayouts = totalFundedPayouts;

        const balance = await Balance.findOneAndUpdate(
            {},
            updateData,
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).lean();
        
        res.status(200).json(balance);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Update balance (PUT)
router.put("/", apiKeyMiddleware, async (req, res) => {
    try {
        const { cryptoBalance, brokerBalance, totalFunded, totalFundedPayouts } = req.body;
        
        const updateData = { updatedAt: Date.now() };
        if (typeof cryptoBalance === 'number') updateData.cryptoBalance = cryptoBalance;
        if (typeof brokerBalance === 'number') updateData.brokerBalance = brokerBalance;
        if (typeof totalFunded === 'number') updateData.totalFunded = totalFunded;
        if (typeof totalFundedPayouts === 'number') updateData.totalFundedPayouts = totalFundedPayouts;

        const balance = await Balance.findOneAndUpdate(
            {},
            updateData,
            { new: true, upsert: true }
        ).lean();
        
        res.json(balance);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Delete balance
router.delete("/", apiKeyMiddleware, async (req, res) => {
    try {
        const result = await Balance.deleteMany({});
        res.json({ message: "Balance deleted", deletedCount: result.deletedCount });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
