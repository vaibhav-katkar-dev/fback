const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const Payment = require("../models/Payment");
const { sendInvoiceEmail } = require("../utils/sendInvoiceEmail.js");

const axios = require("axios");
const router = express.Router();

// ✅ Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ Step 1: Your base USD plan prices
const planPricesUSD = {
  Starter: 2,   // $2
  Pro: 6,       // $6
  Business: 15,  // $15
};

// ✅ Step 2: Helper to convert USD → INR dynamically
async function convertUSDToINR(usdAmount) {
  try {
    const response = await axios.get("https://api.exchangerate-api.com/v4/latest/USD");
    const rate = response.data.rates.INR;
    const converted = Math.round(usdAmount * rate);
    return converted; // returns INR amount
  } catch (error) {
    console.error("Currency conversion failed:", error);
    // fallback rate in case API fails
    return Math.round(usdAmount * 83);
  }
}

// ✅ Step 3: Create Order (secure, backend-decided amount)
// 🧾 Create Razorpay Order
router.post("/create-order", async (req, res) => {
  try {
    const { planName, user } = req.body;
    console.log("🛒 Creating order for plan:", planName, "User:", user?.email);

    if (!planName || !planPricesUSD[planName]) {
      return res.status(400).json({ success: false, message: "Invalid plan name" });
    }

    const usdAmount = planPricesUSD[planName];
    const inrAmount = await convertUSDToINR(usdAmount);

    const options = {
      amount: inrAmount * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
      notes: { plan: planName, user_email: user?.email || "N/A" },
    };

    const order = await razorpay.orders.create(options);

    // ✅ Save to DB
    const newPayment = new Payment({
      orderId: order.id,
      planName,
      amountUSD: usdAmount,
      amountINR: inrAmount,
      user,
      status: "created",
    });
    await newPayment.save();

    console.log(`🧾 Order Created: ${order.id} (${planName}) - ₹${inrAmount}`);
    res.json({ success: true, order, amountINR: inrAmount });
  } catch (error) {
    console.error("❌ Order creation failed:", error);
    res.status(500).json({ success: false, message: "Order creation failed" });
  }
});

// ✅ Step 4: Verify payment securely
// 🧩 Verify Payment Securely
router.post("/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // 1️⃣ Find order in DB
    const payment = await Payment.findOne({ orderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // 2️⃣ Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      payment.status = "failed";
      payment.verified = false;
      await payment.save();
      console.warn("⚠️ Payment signature mismatch!");
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    // 3️⃣ Update payment as verified
    payment.paymentId = razorpay_payment_id;
    payment.signature = razorpay_signature;
    payment.status = "success";
    payment.verified = true;
    await payment.save();

    console.log(`✅ VERIFIED PAYMENT for ${payment.planName}`);
    console.log(`💳 Payment ID: ${razorpay_payment_id}`);
    console.log(`👤 User: ${payment.user?.name}`);
    console.log(`💰 Amount: ₹${payment.amountINR}`);
    console.log("--------------------------------");



     try {
      await sendInvoiceEmail(payment);
    } catch (err) {
      console.error("❌ Failed to send invoice email:", err);
    }

    res.json({ success: true, message: "Payment verified successfully" });
  } catch (error) {
    console.error("❌ Payment verification error:", error);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
});

// ✅ Step 5: Get Razorpay Public Key
router.get("/get-key", (req, res) => {
  res.json({ key: process.env.RAZORPAY_KEY_ID });
});

module.exports = router;
