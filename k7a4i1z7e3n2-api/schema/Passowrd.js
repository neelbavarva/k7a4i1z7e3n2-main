const mongoose = require("mongoose");

const passwordSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 256,
    },
    email: {
        type: String,
        trim: true,
        maxlength: 320,
    },
    password: {
        salt: { type: String, required: true },
        iv: { type: String, required: true },
        tag: { type: String, required: true },
        data: { type: String, required: true },
    },
    category: {
        type: String,
        trim: true,
        maxlength: 64,
    },
    archive: {
        type: Boolean,
        default: false,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
    },
    failedAttempts: {
        type: Number,
        default: 0,
    },
    lockedUntil: {
        type: Date,
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("Password", passwordSchema);
