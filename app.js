// app.js
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();
  const connectDB = require("./db");

const app = express();

// ✅ CORS with whitelist
app.use(cors({
  origin: ['https://form2chat.me', 'https://www.form2chat.me'], // dono allow
  credentials: true
}));


app.use(express.json());

// --------------------
// MongoDB connection
// --------------------
// mongoose.connect(process.env.MONGO_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// }).then(() => console.log("✅ MongoDB connected"))
//   .catch((err) => console.error("❌ MongoDB error:", err));


(async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error("DB connection failed", err);
    process.exit(1); // exit if DB can't connect
  }
})();

// --------------------
// Models & Routes
// --------------------
const User = require("./models/User");
const formRoutes = require("./routes/formRoutes");
const templateRoutes = require("./routes/templates");
const googleAuthRoutes = require("./googleAuth");
const resetRoutes = require("./routes/resetPassword");

app.use("/api/forms", formRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/auth", resetRoutes);
app.use("/api", googleAuthRoutes);

// --------------------
// JWT Middleware
// --------------------
function verifyToken(req, res, next) {
  let token = req.headers["authorization"];
  if (!token) return res.status(401).json({ msg: "No token provided" });

  if (token.startsWith("Bearer ")) {
    token = token.slice(7).trim();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ msg: "Invalid token" });
  }
}

// --------------------
// Auth Routes
// --------------------


// // ✅ Signup
// app.post("/api/auth/signup", async (req, res) => {
//   try {
//     const { name, email, password } = req.body;
//     if (!name || !email || !password) {
//       return res.status(400).json({ msg: "All fields required" });
//     }

//     const existingUser = await User.findOne({ email });
//     if (existingUser) return res.status(400).json({ msg: "Email already exists" });

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const newUser = new User({
//       name,
//       email,
//       password: hashedPassword,
//       provider: "local", // ✅ set provider
//     });

//     await newUser.save();

//     // Generate JWT with expiry
//     const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

//     res.status(201).json({ msg: "User registered", token, user: { id: newUser._id, name: newUser.name, email: newUser.email, provider: newUser.provider } });
//   } catch (err) {
//     res.status(500).json({ msg: "Server error", error: err.message });
//   }
// });

// =============================
// ✅ RESEND VERIFICATION EMAIL (with rate limit)
// =============================
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });

    // ✅ If already verified, no need to resend
    if (user.isVerified) {
      return res.status(400).json({ msg: "Email already verified" });
    }

    // 🧠 Rate limit check (10 minutes)
    const cooldownMinutes = 10;
    const now = Date.now();
    if (
      user.lastVerificationEmailSent &&
      now - user.lastVerificationEmailSent.getTime() < cooldownMinutes * 60 * 1000
    ) {
      const remaining = Math.ceil(
        (cooldownMinutes * 60 * 1000 - (now - user.lastVerificationEmailSent.getTime())) / 60000
      );
      return res.status(429).json({
        msg: `Please wait ${remaining} minute(s) before requesting another verification email.`,
      });
    }

    // Generate new token
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(verifyToken).digest("hex");

    user.emailVerifyToken = hashedToken;
    user.emailVerifyExpire = Date.now() + 15 * 60 * 1000; // 15 minutes expiry
    user.lastVerificationEmailSent = new Date(); // ✅ record send time
    await user.save();

    // Build verification link
    const verifyURL = `${process.env.CLIENT_URL}/email-verified.html?token=${encodeURIComponent(
      verifyToken
    )}`;

    const html = `
      <h2>Verify Your Email</h2>
      <p>Hello ${user.name || "there"},</p>
      <p>Click below to confirm your email address:</p>
      <a href="${verifyURL}" style="background:#3b82f6;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">Verify Email</a>
      <p>This link expires in 15 minutes.</p>
    `;

    await resend.emails.send({
      from: "Form2Chat <no-reply@form2chat.me>",
      to: user.email,
      subject: "Verify Your Email - Form2Chat",
      html,
    });

    res.json({ msg: "Verification email resent successfully ✅" });
  } catch (err) {
    console.error("Resend verification error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ✅ Get Current User
app.get("/api/auth/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});
// --------------------
// Root Route
// --------------------
app.get("/", (req, res) => {
  res.send("Welcome to the form2chat.me API 🚀",`<br><a href="https://form2chat.me">Click Me</a>`);
});

const path = require("path");

// Set EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// 📌 Route: Get all users
app.get("/users", async (req, res) => {
    try {
        const users = await User.find();
        res.render("profile", { users });
    } catch (err) {
        console.error("❌ Error fetching users:", err);
        res.status(500).send("Error fetching users");
    }
});

// --------------------
// Start Server
// --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});






