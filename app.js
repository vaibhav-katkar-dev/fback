const express = require("express");
const mongoose = require("mongoose");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
// in server.js / app.js


// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
const formRoutes = require("./routes/formRoutes");
const templateRoutes = require("./routes/templates");

app.use("/api/forms", formRoutes);

app.use("/api/templates", templateRoutes);

// import googleAuthRoutes from "./googleAuth.js";
const googleAuthRoutes = require("./googleAuth.js");
app.use("/api", googleAuthRoutes);
const User = require("./models/User.js");

const resetRoutes = require("./routes/resetPassword");
app.use("/api/auth", resetRoutes);


// User Schema
// const UserSchema = new mongoose.Schema({
//     name: String,
//     email: { type: String, unique: true },
//     password: String,
//     token: String, // store permanent token here
//       avatar: String,
//   provider: { type: String, default: "local" }, // "local" or "google"


// });

// const User = mongoose.model("User", UserSchema);

// Signup API

// Signup API
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ msg: "All fields are required" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ msg: "Email already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user with hashed password
        const newUser = new User({ name, email, password: hashedPassword });

        // Generate token
        const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET);
        newUser.token = token;

        // Save user
        await newUser.save();

        res.status(201).json({ msg: "User registered successfully", token });
    } catch (err) {
        console.log("Signup error:", err.message);
        res.status(500).json({ msg: "Server error", error: err.message });
    }
});



// Login API
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: "Invalid email or password" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Invalid email or password" });

        // If token already exists in DB, reuse it
        if (!user.token) {
            user.token = jwt.sign({ id: user._id }, process.env.JWT_SECRET); // No expiry for permanent token
            await user.save();
        }

        res.json({ token: user.token });
    } catch (err) {
        res.status(500).json({ msg: "Server error" });
    }
});


// Protected Route Example
app.get("/api/auth/me", verifyToken, async (req, res) => {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
});

function verifyToken(req, res, next) {
    let token = req.headers["authorization"];
    if (!token) return res.status(401).json({ msg: "No token provided" });

    // Extract only the token part if it starts with Bearer
    if (token.startsWith("Bearer ")) {
        token = token.slice(7, token.length).trim();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ msg: "Invalid token" });
        req.user = decoded;
        next();
    });
}


app.get('/', (req, res) => {
    res.send('Welcome to the Form API');
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
