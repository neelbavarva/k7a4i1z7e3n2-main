const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.set("trust proxy", true);
app.use(cors());
app.use(express.json());

const passwordRoute = require("./routes/passwordRoute");
app.use("/passwords", passwordRoute);

app.get("/", (req, res) => {
    res.status(200).json("Welcome to server project of @k7a4i1z7e3n2");
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
