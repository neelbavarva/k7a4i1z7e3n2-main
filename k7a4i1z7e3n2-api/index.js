const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.set("trust proxy", true);
app.use(cors());
app.use(express.json());

const passwordRoute = require("./routes/passwordRoute");
const cardRoute = require("./routes/cardRoute");
const otpRoute = require("./routes/otpRoute");
const tradeRoute = require("./routes/tradeRoute");
const migrationRoute = require("./routes/migrationRoute2");
app.use("/passwords", passwordRoute);
app.use("/cards", cardRoute);
app.use("/otp", otpRoute);
app.use("/trades", tradeRoute);
app.use("/migration", migrationRoute);

app.get("/", (req, res) => {
    res.status(200).json("Welcome to server project of @k7a4i1z7e3n2");
});

app.get("/health", async (req, res) => {
    try {
        const state = mongoose.connection.readyState;
        let dbStatus = "disconnected";
        if (state === 1) {
            try {
                await mongoose.connection.db.admin().ping();
                dbStatus = "ok";
            } catch {
                dbStatus = "degraded";
            }
        } else if (state === 2) dbStatus = "connecting";
        else if (state === 3) dbStatus = "disconnecting";

        const body = {
            status: state === 1 ? "ok" : "unavailable",
            db: dbStatus,
            uptime: Math.floor(process.uptime()),
        };
        res.status(state === 1 ? 200 : 503).json(body);
    } catch {
        res.status(500).json({ status: "error" });
    }
});

const start = async () => {
    await mongoose.connect(process.env.PROD_LINK, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    const PORT = process.env.PORT || 3001;
    app.listen(PORT);
};

start().catch(() => process.exit(1));

module.exports = app;
