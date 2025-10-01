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


connectDB();

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

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      provider: "local", // ✅ set provider
    });

    await newUser.save();

    // Generate JWT with expiry
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ msg: "User registered", token, user: { id: newUser._id, name: newUser.name, email: newUser.email, provider: newUser.provider } });
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

    // Prevent password login for Google-only users
    if (user.provider === "google") {
      return res.status(400).json({ msg: "Please login using Google" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid email or password" });

    // Issue fresh JWT every login
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, user: { id: user._id, name: user.name, email: user.email, provider: user.provider } });
  } catch (err) {
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






