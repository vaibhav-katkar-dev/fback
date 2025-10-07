// googleAuth.js
const express =require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const router = express.Router();

// Google Client ID (from Google Cloud Console)
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Example user model (replace with your actual Mongoose/User schema)
const User = require("./models/User.js");
router.post("/auth/google", async (req, res) => {
  try {
    const { token } = req.body; // frontend sends Google id_token

    if (!token) {
      return res.status(400).json({ success: false, message: "Token missing" });
    }

    // 1. Verify token with Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
     // ✅ FIX: destructure email_verified here
    const { email, name, picture, email_verified } = payload;

    if (!email) {
      return res.status(400).json({ success: false, message: "Google payload missing email" });
    }

    // 2. Find user
    let user = await User.findOne({ email });

    if (!user) {
      // 2a. Create if not exists
      user = await User.create({
        email,
        name,
        token,
        avatar: picture,
        password: null, // no password for Google login
        provider: "google",
        isVerified: email_verified || true, // ✅ mark verified

      });
    } else {
      // 2b. Update existing Google user (sync latest data)
      user.name = name || user.name;
      user.avatar = picture || user.avatar;
      user.provider = "google"; // force provider update
      user.isVerified = true; // ✅ ensure verified stays true
      await user.save();
    }

    // 3. Create JWT
    const jwtToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 4. Send response
    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
      },
    });
  } catch (err) {
    console.error("Google Auth Error:", err.message);
    res.status(401).json({ success: false, message: "Invalid Google token" });
  }
});

module.exports = router;
