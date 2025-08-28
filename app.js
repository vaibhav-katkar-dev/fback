const express = require("express");
const mongoose = require("mongoose");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

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





// User Schema
const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    token: String // store permanent token here


});

const User = mongoose.model("User", UserSchema);

// Signup API
// Signup API
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ msg: "Email already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user first (Mongo will give it an _id)
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();

        // Now generate a token using that user's _id
        const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET);

        // Save token permanently in DB
        newUser.token = token;
        await newUser.save();

        res.json({ msg: "User registered successfully", token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server error" });
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

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
