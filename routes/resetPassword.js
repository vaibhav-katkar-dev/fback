const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const connectDB = require("../db"); // import

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
router.post("/reset-password", async (req, res) => {
  try {
    await connectDB(); // ensure MongoDB connection

    const { token, password } = req.body;
    console.error("Reset password token:", token, "Password:", password);

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

    console.log("User found for reset:", user);
    res.json({ message: "Password reset successful ✅" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});






// #----------------------------------------------------------------
// Forgot Route-



router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 🧩 Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ msg: "All fields required" });
    }

    // 🔍 Check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🧱 Create user (unverified initially)
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      provider: "local",
      isVerified: false,
    });
    await newUser.save();

    // 🎟️ Create verification token
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(verifyToken).digest("hex");

    newUser.emailVerifyToken = hashedToken;
    newUser.emailVerifyExpire = Date.now() + 24 * 60 * 60 * 1000; // 24h
    await newUser.save();

    // 🔗 Email verification link
    const verifyURL = `${process.env.CLIENT_URL}/api/auth/verify-email?token=${encodeURIComponent(verifyToken)}`;

    const html = `
      <h2>Email Verification</h2>
      <p>Hi ${name},</p>
      <p>Thanks for signing up! Please verify your email by clicking the link below:</p>
      <a href="${verifyURL}" target="_blank">${verifyURL}</a>
      <p>This link will expire in 24 hours.</p>
    `;

    // 📧 Send email via Resend
    await resend.emails.send({
      from: "Form2Chat <no-reply@form2chat.me>",
      to: email,
      subject: "Verify your email address",
      html: html,
    });

    // ✅ Response to frontend
    res.status(201).json({
      msg: "Signup successful! Please check your email to verify your account.",
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});



// =============================
// ✅ VERIFY EMAIL ROUTE
// =============================
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send("Missing token");

    // 🔑 Hash token to match DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // 🔍 Find valid user
    const user = await User.findOne({
      emailVerifyToken: hashedToken,
      emailVerifyExpire: { $gt: Date.now() },
    });

    if (!user) return res.status(400).send("Invalid or expired verification link");

    // ✅ Verify user
    user.isVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpire = undefined;
    await user.save();

    // Redirect to frontend confirmation page (optional)
    return res.redirect(`${process.env.CLIENT_URL}/html/email-verified.html`);
  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).send("Server error");
  }
});


// #----------------------------------------------------------------

module.exports = router;
