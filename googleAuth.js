// googleAuth.js
const express =require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const router = express.Router();

// Google Client ID (from Google Cloud Console)
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Example user model (replace with your actual Mongoose/User schema)
const User = require("./models/User.js");

// Login with Google
router.post("/auth/google", async (req, res) => {
  try {
    const { token } = req.body; // frontend sends Google token (id_token)
    //console.log("Incoming request body:", req.body); // Debugging

    // 1. Verify token with Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
        //console.log("Google payload:", payload); // Debugging

    const { email, name, picture } = payload;

    // 2. Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name,
        avatar: picture,
        password: null, // no password for Google login
      });
    }

    // 3. Create your own JWT
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
      },
    });
  } catch (err) {
    console.error("Google Auth Error:", err);
    res.status(401).json({ success: false, message: "Invalid Google token" });
  }
});

module.exports = router;
