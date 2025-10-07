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

// 🎟️ Create verification token BEFORE saving
const verifyToken = crypto.randomBytes(32).toString("hex");
const hashedToken = crypto.createHash("sha256").update(verifyToken).digest("hex");

newUser.emailVerifyToken = hashedToken;
newUser.emailVerifyExpire = Date.now() + 24 * 60 * 60 * 1000; // 24h

await newUser.save(); // ✅ Only save once — everything included

// 🔗 Email verification link
const verifyURL = `${process.env.CLIENT_URL}/email-verified.html?token=${encodeURIComponent(verifyToken)}`;

const html = `
  <h2>Email Verification</h2>
  <p>Hi ${name},</p>
  <p>Thanks for signing up! Please verify your email by clicking the link below:</p>
  <a href="${verifyURL}" target="_blank">${verifyURL}</a>
  <p>This link will expire in 24 hours.</p>
`;

await resend.emails.send({
  from: "Form2Chat <no-reply@form2chat.me>",
  to: email,
  subject: "Verify your email address",
  html,
});

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
// =============================
// ✅ VERIFY EMAIL ROUTE (POST)
// =============================
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, msg: "Missing token" });

    // 🔑 Hash token to match DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // 🔍 Find valid user
    const user = await User.findOne({
      emailVerifyToken: hashedToken,
      emailVerifyExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, msg: "Invalid or expired verification link" });
    }

    // ✅ Verify user
    user.isVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpire = undefined;
    await user.save();

     token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
res.json({ success: true, msg: "Email verified successfully", token });

  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});






// ✅ LOGIN ROUTE/
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ msg: "Invalid email or password" });

    // Prevent password login for Google-only users
    if (user.provider === "google") {
      return res.status(400).json({ msg: "Please login using Google" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid email or password" });

    // ===========================
    // 🛑 EMAIL NOT VERIFIED — smart auto resend with cooldown
    // ===========================
    if (!user.isVerified) {
      const cooldownMinutes = 10;
      const now = Date.now();

      if (
        !user.lastVerificationEmailSent ||
        now - user.lastVerificationEmailSent.getTime() > cooldownMinutes * 60 * 1000
      ) {
        // ✅ Can resend
        const verifyToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(verifyToken).digest("hex");

        user.emailVerifyToken = hashedToken;
        user.emailVerifyExpire = Date.now() + 15 * 60 * 1000; // 15 min
        user.lastVerificationEmailSent = new Date();
        await user.save();

        const verifyURL = `${process.env.CLIENT_URL}/email-verified.html?token=${encodeURIComponent(
          verifyToken
        )}`;

        const html = `
          <h2>Verify Your Email</h2>
          <p>Hello ${user.name || "there"},</p>
          <p>You tried to log in, but your email isn't verified yet.</p>
          <p>Click below to confirm your email:</p>
          <a href="${verifyURL}" style="background:#3b82f6;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">Verify Email</a>
          <p>This link expires in 15 minutes.</p>
        `;

        try {
          await resend.emails.send({
            from: "Form2Chat <no-reply@form2chat.me>",
            to: user.email,
            subject: "Verify Your Email - Form2Chat",
            html,
          });
        } catch (emailErr) {
          console.error("Resend email failed:", emailErr);
        }

        return res.status(403).json({
          msg: "Please verify your email. A new verification link has been sent.",
          resent: true,
        });
      } else {
        // 🧊 Rate limit active
        const remaining = Math.ceil(
          (cooldownMinutes * 60 * 1000 - (now - user.lastVerificationEmailSent.getTime())) / 60000
        );
        return res.status(429).json({
          msg: `Your email is not verified. Please wait ${remaining} minute(s) before requesting another verification link.`,
          resent: false,
        });
      }
    }

    // ✅ If verified — issue token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        provider: user.provider,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});
// #----------------------------------------------------------------

module.exports = router;
