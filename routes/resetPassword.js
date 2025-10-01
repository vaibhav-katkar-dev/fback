const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const nodemailer = require("nodemailer");

const router = express.Router();

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY); // put your Resend API key in .env

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ message: "If an account exists, a reset link has been sent" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save();

    const resetURL = `${process.env.CLIENT_URL}/html/reset-password.html?token=${encodeURIComponent(resetToken)}`;

    const html = `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetURL}">${resetURL}</a>
      <p><b>Note:</b> Link expires in 15 minutes.</p>
    `;

    // Send email using Resend
    const emailResponse = await resend.emails.send({
      from: "Form2Chat <no-reply@form2chat.me>",
      to: user.email,
      subject: 'Password Reset Request',
      html: html,
    });

    console.log("Resend email response:", emailResponse);

    res.json({ message: "Password reset link sent ✅" });
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
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) return res.status(400).json({ message: "Token missing" });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ message: "Password reset successful ✅" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
