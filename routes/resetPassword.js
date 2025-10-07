// routes/resetPassword.js
const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const connectDB = require("../db"); // ensure your db.js exports a connect function
const { Resend } = require("resend");

const router = express.Router();

// ensure router can parse JSON (helps in serverless / subrouter contexts)
router.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);

// optional: ensure DB connected once (if your app entry already connects, this is safe)
(async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error("DB connection failed:", err);
    // don't exit here; let the app continue and handle connection errors elsewhere
  }
})();

// ----------------------
// FORGOT PASSWORD
// ----------------------
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });

    // respond generically to avoid leaking account existence
    if (!user) {
      return res.json({ message: "If an account exists, a reset link has been sent" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    const resetURL = `${process.env.CLIENT_URL}/html/reset-password.html?token=${encodeURIComponent(
      resetToken
    )}`;

    const html = `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetURL}">${resetURL}</a>
      <p><b>Note:</b> Link expires in 15 minutes.</p>
    `;

    await resend.emails.send({
      from: "Form2Chat <no-reply@form2chat.me>",
      to: user.email,
      subject: "Password Reset Request",
      html,
    });

    res.json({ message: "Password reset link sent ✅" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ----------------------
// RESET PASSWORD - update
// ----------------------
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "Token and password required" });

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

// ----------------------
// SIGNUP (with verification)
// ----------------------
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ msg: "All fields required" });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      provider: "local",
      isVerified: false,
    });

    // Generate verification token (raw to send in email; hashed stored)
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(verifyToken).digest("hex");

    newUser.emailVerifyToken = hashedToken;
    newUser.emailVerifyExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await newUser.save();

    const verifyURL = `${process.env.CLIENT_URL}/email-verified.html?token=${encodeURIComponent(
      verifyToken
    )}`;

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

    // do not send sensitive data in response
    res.status(201).json({ msg: "Signup successful! Please check your email to verify your account." });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ----------------------
// VERIFY EMAIL
// ----------------------
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, msg: "Missing token" });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      emailVerifyToken: hashedToken,
      emailVerifyExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, msg: "Invalid or expired verification link" });
    }

    if (user.isVerified) {
      return res.status(200).json({ success: true, msg: "Email already verified" });
    }

    user.isVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpire = undefined;
    await user.save();

    const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ success: true, msg: "Email verified successfully", token: jwtToken });
  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

// ----------------------
// LOGIN (with auto-resend & cooldown)
// ----------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ msg: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Invalid email or password" });

    if (user.provider === "google") return res.status(400).json({ msg: "Please login using Google" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid email or password" });

    if (!user.isVerified) {
      const cooldownMinutes = 10;
      const now = Date.now();

      if (!user.lastVerificationEmailSent || now - user.lastVerificationEmailSent.getTime() > cooldownMinutes * 60 * 1000) {
        const verifyToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(verifyToken).digest("hex");

        user.emailVerifyToken = hashedToken;
        user.emailVerifyExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
        user.lastVerificationEmailSent = new Date();
        await user.save();

        const verifyURL = `${process.env.CLIENT_URL}/email-verified.html?token=${encodeURIComponent(verifyToken)}`;

        const html = `
          <h2>Verify Your Email</h2>
          <p>Hello ${user.name || "there"},</p>
          <p>You tried to log in, but your email isn't verified yet.</p>
          <a href="${verifyURL}" style="background:#3b82f6;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">Verify Email</a>
          <p>This link expires in 15 minutes.</p>
        `;

        await resend.emails.send({
          from: "Form2Chat <no-reply@form2chat.me>",
          to: user.email,
          subject: "Verify Your Email - Form2Chat",
          html,
        });

        return res.status(403).json({
          msg: "Please verify your email. A new verification link has been sent.",
          resent: true,
        });
      } else {
        const remaining = Math.ceil((cooldownMinutes * 60 * 1000 - (now - user.lastVerificationEmailSent.getTime())) / 60000);
        return res.status(429).json({
          msg: `Your email is not verified. Please wait ${remaining} minute(s) before requesting another verification link.`,
          resent: false,
        });
      }
    }

    // verified => issue token
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

module.exports = router;
