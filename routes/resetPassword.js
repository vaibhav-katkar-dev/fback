const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User"); // adjust path
const { Resend } = require("resend");
const nodemailer = require("nodemailer");


const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------------------
// FORGOT PASSWORD - send email
// ---------------------------
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Save hashed token + expiration
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save();

    console.log("Token saved to user:", user.email, hashedToken);

    // Create reset URL with query param for frontend HTML
    const resetURL = `${process.env.CLIENT_URL}/html/reset-password.html?token=${resetToken}`;
    console.log("Reset URL:", resetURL);

    // Send email via Resend
    const html = `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetURL}">${resetURL}</a>
      <p><b>Note:</b> Link expires in 15 minutes.</p>
    `;

    // await resend.emails.send({
    //   from: "onboarding@resend.dev",
    //   to: user.email,
    //   subject: "Password Reset Request",
    //   html,
    // });



const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS, // App Password, not your real Gmail password
  },
});

await transporter.sendMail({
  from: process.env.GMAIL_USER,
  to: user.email,
  subject: "Password Reset Request",
  html,
});

    res.json({ message: "Password reset link sent to email" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------------------
// RESET PASSWORD - verify token & update
// ---------------------------
// ---------------------------
// RESET PASSWORD - verify token & update
// ---------------------------
router.post("/reset-password", async (req, res) => {
  try {
    const { token } = req.query;   // <-- use query instead of params
    const { password } = req.body;

    console.log("----- RESET PASSWORD DEBUG -----");
    console.log("Token from URL:", token);

    if (!token) return res.status(400).json({ message: "Token missing" });

    // Hash token to compare with DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    console.log("Hashed token:", hashedToken);

    // Find user with valid token and not expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      console.log("User not found or token expired");
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Update password
    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    console.log("Password reset successful for user:", user.email);
    res.json({ message: "Password reset successful ✅" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
