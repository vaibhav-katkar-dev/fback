// models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true, index: true },
  password: String,
  token: String, // permanent token if needed
  avatar: String,
  provider: { type: String, default: "local" }, // "local" or "google"

  // Password reset
  resetPasswordToken: String,
  resetPasswordExpire: Date,

  // Email verification
  isVerified: { type: Boolean, default: false },
  emailVerifyToken: String,
  emailVerifyExpire: Date,

  // Rate limiting for resend
  lastVerificationEmailSent: { type: Date, default: null },
},
{
  timestamps: true,
});

module.exports = mongoose.model("User", UserSchema);
