const mongoose = require("mongoose");

// What the vault remembers about one MetaApi account: the name to show and whether it counts in
// net worth. The account itself (login, server, region) comes from MetaApi every time.
const mt5SettingSchema = new mongoose.Schema(
    {
        _id: { type: String }, // the MetaApi account id
        label: { type: String, trim: true, maxlength: 40, default: "" },
        counted: { type: Boolean, default: null }, // null: decide from the server name
    },
    { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("Mt5Setting", mt5SettingSchema);
