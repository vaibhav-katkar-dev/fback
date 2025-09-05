const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    token: String, // permanent token if needed
    avatar: String,
    provider: { type: String, default: "local" }, // "local" or "google"

    // 🔥 Add these two fields for reset password
    resetPasswordToken: String,
    resetPasswordExpire: Date,
});

module.exports = mongoose.model("User", UserSchema);
