// app.js
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");

require("dotenv").config();
  const connectDB = require("./db");

const app = express();

// ✅ CORS with whitelist
app.use(cors({
  origin: ['https://form2chat.me', 'https://www.form2chat.me','http://127.0.0.1:5502'], // dono allow
  credentials: true
}));


app.use(express.json());

// -------------------- Security Middlewares --------------------
app.use(helmet()); // Security Headers

// Prevent MongoDB injection
app.use(mongoSanitize());

// Prevent XSS attacks
app.use(xss());

// Rate limiting to stop spam/bruteforce
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // max 200 req per 15 minutes
  message: { msg: "Too many requests. Please slow down ⛔" },
});
app.use("/api", apiLimiter);




// --------------------
// MongoDB connection
// --------------------
// mongoose.connect(process.env.MONGO_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// }).then(() => console.log("✅ MongoDB connected"))
//   .catch((err) => console.error("❌ MongoDB error:", err));


// 

async function connectWithRetry() {
  try {
    await connectDB();
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection failed. Retrying in 5 seconds...", err.message);
    setTimeout(connectWithRetry, 5000);
  }
}
connectWithRetry();



// --------------------
// Models & Routes
// --------------------
const form = require("./routes/form");
const User = require("./models/User");
const formRoutes = require("./routes/formRoutes");
const templateRoutes = require("./routes/templates");
const googleAuthRoutes = require("./googleAuth");
const resetRoutes = require("./routes/resetPassword");
const paymentRoutes = require("./routes/paymentRoutes");




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
app.use("/api/forms",form);

app.use("/api/forms",verifyToken,formRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/auth", resetRoutes);
app.use("/api", googleAuthRoutes);
// 🔹 Use payment routes
app.use("/api/payment", paymentRoutes);




// --------------------
// Auth Routes
// --------------------



const Payment = require("./models/Payment");


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


app.get("/api/plan/", verifyToken, async (req, res) => {
  try {
    const email = req.user.email;

    // ✅ Find latest active or last subscription
    const payment = await Payment.findOne({ "user.email": email })
      .sort({ planEndDate: -1, createdAt: -1 });

    if (!payment) {
      return res.json({
        success: true,
        email,
        planName: "Free",
         isExpired: false,
    expiresOn: null
      });
    }

    // ✅ Check expiry
    const now = new Date();
    const isExpired = payment.planEndDate && payment.planEndDate < now;

    res.json({
      success: true,
      email: payment.user.email,
      planName: isExpired ? "Free" : payment.planName,
      expiresOn: payment.planEndDate,
      isExpired
    });

  } catch (error) {
    console.error("Error fetching plan:", error);
    res.status(500).json({ success: false, message: "Server error" });
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



// Handle async errors that aren't caught anywhere
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Promise Rejection:", err);
  // Optional: give time for logs before exit
  setTimeout(() => process.exit(1), 1000);
});

// Handle unexpected exceptions
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
  setTimeout(() => process.exit(1), 1000);
});


