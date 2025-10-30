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
// ✅ Monthly / Yearly plan prices (USD)
const planPricesUSD = {
  Starter: { monthly: 2, yearly: 20 },
  Pro: { monthly: 6, yearly: 60 },
  Business: { monthly: 15, yearly: 150 },
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
    const { planName, planType, user } = req.body;
    console.log("🛒 Creating order:", planName, planType, "User:", user?.email);

    // ✅ Check if user already has an active subscription
const existingActivePlan = await Payment.findOne({
  "user.email": user.email,
  verified: true,
  planEndDate: { $gt: new Date() } // plan not expired
});

if (existingActivePlan) {
  return res.status(400).json({
    success: false,
    message: `You already have an active plan (${existingActivePlan.planName} - ${existingActivePlan.planType}). Please wait until expiry.`,
    activePlan: {
      plan: existingActivePlan.planName,
      type: existingActivePlan.planType,
      expires: existingActivePlan.planEndDate,
    }
  });
}

    // ✅ Validate Plan
    if (!planName || !planPricesUSD[planName]) {
      return res.status(400).json({ success: false, message: "Invalid plan name" });
    }

    if (!planType || !["monthly"].includes(planType)) {
      return res.status(400).json({ success: false, message: "Invalid plan type" });
    }

    // ✅ Select price by planType
    const usdAmount =
  planType === "monthly"
    ? planPricesUSD[planName].monthly
    : planPricesUSD[planName].yearly;

    const inrAmount = await convertUSDToINR(usdAmount);

    const options = {
      amount: inrAmount * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
      notes: { plan: planName, type: planType, user_email: user?.email || "N/A" },
    };

    const order = await razorpay.orders.create(options);

    // ✅ Save initial Payment Data
    const newPayment = new Payment({
      orderId: order.id,
      planName,
      planType,
      amountUSD: usdAmount,
      amountINR: inrAmount,
      user,
      status: "created",
    });

    await newPayment.save();

    console.log(`🧾 Order Created: ${order.id} | ${planName} (${planType}) - ₹${inrAmount}`);
    res.json({ success: true, order, amountINR: inrAmount });

  } catch (error) {
    console.error("❌ Order creation failed:", error);
    res.status(500).json({ success: false, message: "Order creation failed" });
  }
});

// ✅ Step 4: Verify payment securely
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

    if (expectedSignature !== razorpay_signature) {
      payment.status = "failed";
      payment.verified = false;
      await payment.save();
      console.warn("⚠️ Payment signature mismatch!");
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    // ✅ Payment is authentic
    payment.paymentId = razorpay_payment_id;
    payment.signature = razorpay_signature;
    payment.status = "success";
    payment.verified = true;

    // 3️⃣ Activate plan + set duration
    let durationDays = payment.planType === "yearly" ? 365 : 30;

    payment.planDuration = durationDays;
    payment.planStartDate = new Date();
payment.planEndDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    payment.isActive = true;

    await payment.save();

    console.log(`✅ VERIFIED PAYMENT for ${payment.planName} (${payment.planType})`);
    console.log(`📅 From: ${payment.planStartDate}`);
    console.log(`⏳ To:   ${payment.planEndDate}`);
    console.log(`👤 User: ${payment.user?.email}`);
    console.log(`💰 Amount: ₹${payment.amountINR}`);
    console.log("--------------------------------");

    // 4️⃣ Send Invoice Email
    try {
      await sendInvoiceEmail(payment);
    } catch (err) {
      console.error("❌ Failed to send invoice email:", err);
    }

    res.json({
      success: true,
      message: "Payment verified & plan activated successfully",
      plan: {
        type: payment.planType,
        start: payment.planStartDate,
        end: payment.planEndDate
      }
    });

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
