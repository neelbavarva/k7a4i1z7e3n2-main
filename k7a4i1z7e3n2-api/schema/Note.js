const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
    {
        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: 10000,
            set: (text) =>
                typeof text === "string"
                    ? text.replace(/\s+/g, " ").trim()
                    : text,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Note", noteSchema);
