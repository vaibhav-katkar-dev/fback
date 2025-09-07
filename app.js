// app.js
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ✅ CORS with whitelist
app.use(cors({
  origin: process.env.CLIENT_URL, // e.g. "https://frontend-roan-two-42.vercel.app"
  credentials: true,
}));

app.use(express.json());

// --------------------
// MongoDB connection
// --------------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

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

// ✅ Signup
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ msg: "All fields required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });

    await newUser.save();

    // Generate JWT with expiry
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ msg: "User registered", token });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ✅ Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid email or password" });

    // Issue fresh JWT every login
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ token });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// ✅ Get Current User
app.get("/api/auth/me", verifyToken, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json(user);
});

// --------------------
// Root Route
// --------------------
app.get("/", (req, res) => {
  res.send("Welcome to the Form API 🚀");
});

// --------------------
// Start Server
// --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
