const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    token: String, // store permanent token here
      avatar: String,
  provider: { type: String, default: "local" }, // "local" or "google"


});

module.exports = mongoose.model("User", UserSchema);
