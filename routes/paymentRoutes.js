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

// ✅ Plan Prices (USD)
const planPricesUSD = {
  Starter: { monthly: 0.10, yearly: 20 },
  Pro: { monthly: 6, yearly: 60 },
  Business: { monthly: 15, yearly: 150 },
};

// ✅ Plan Rank for Upgrade Rules
const planRank = { free: 0, Starter: 1, Pro: 2, Business: 3 };

// ✅ Convert USD → INR
async function convertUSDToINR(usdAmount) {
  try {
    const response = await axios.get("https://api.exchangerate-api.com/v4/latest/USD");
    const rate = response.data.rates.INR;
    return Math.round(usdAmount * rate);
  } catch (error) {
    console.error("Currency API failed. Using fallback INR rate.");
    return Math.round(usdAmount * 83);
  }
}

// ✅ Create Razorpay Order
router.post("/create-order", async (req, res) => {
  try {
    const { planName, planType, user } = req.body;
    console.log("🛒 Create order request:", planName, planType, "User:", user?.email);

    // Validate inputs
    if (!planName || !planPricesUSD[planName])
      return res.status(400).json({ success: false, message: "Invalid plan" });

    if (!planType || !["monthly", "yearly"].includes(planType))
      return res.status(400).json({ success: false, message: "Invalid plan type" });

    // ✅ Check existing active plan
    const existingPlan = await Payment.findOne({
      "user.email": user.email,
      verified: true,
      planEndDate: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    // ✅ If user already has a plan
    if (existingPlan) {
      const currentPlan = existingPlan.planName;

      // Only allow upgrade (higher tiers)
      if (planRank[planName] <= planRank[currentPlan]) {
        return res.status(400).json({
          success: false,
          message: `You already have ${currentPlan} plan. Upgrade to higher plan only.`,
        });
      }

      console.log(`⚡ Upgrade triggered: ${currentPlan} → ${planName}`);
      req.body.isUpgrade = true;
      req.body.oldPlan = currentPlan;
    }

    // ✅ Calculate amount
    const usdAmount =
      planType === "monthly"
        ? planPricesUSD[planName].monthly
        : planPricesUSD[planName].yearly;

    const inrAmount = await convertUSDToINR(usdAmount);

    // Create Razorpay order
    const options = {
      amount: inrAmount * 100,
      currency: "INR",
      receipt: "rcpt_" + Date.now(),
      notes: { plan: planName, type: planType, user_email: user?.email },
    };

    const order = await razorpay.orders.create(options);

    // Save Payment
    const newPayment = new Payment({
      orderId: order.id,
      planName,
      planType,
      amountUSD: usdAmount,
      amountINR: inrAmount,
      user,
      status: "created",
      isUpgrade: req.body.isUpgrade || false,
      upgradedFrom: req.body.oldPlan || null,
    });

    await newPayment.save();

    res.json({ success: true, order, amountINR: inrAmount });

  } catch (error) {
    console.error("❌ Order error:", error);
    res.status(500).json({ success: false, message: "Order creation failed" });
  }
});

// ✅ Verify Payment
router.post("/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const payment = await Payment.findOne({ orderId: razorpay_order_id });
    if (!payment) return res.status(404).json({ success: false, message: "Order not found" });

    // Signature Check
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      payment.status = "failed";
      payment.verified = false;
      await payment.save();
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    // ✅ Mark Payment Success
    payment.paymentId = razorpay_payment_id;
    payment.signature = razorpay_signature;
    payment.status = "success";
    payment.verified = true;

    // ✅ Assign Plan Duration
    const durationDays = payment.planType === "yearly" ? 365 : 30;

    payment.planStartDate = new Date();
    payment.planEndDate = new Date(Date.now() + durationDays * 86400000);
    payment.planDuration = durationDays;
    payment.isActive = true;

    await payment.save();

    // ✅ Send Invoice Email
    try { await sendInvoiceEmail(payment); } catch (err) {
      console.error("Invoice Email Failed:", err);
    }

    res.json({
      success: true,
      message: payment.isUpgrade
        ? `Plan upgraded successfully to ${payment.planName}`
        : `Plan activated successfully`,
      plan: {
        name: payment.planName,
        upgradedFrom: payment.upgradedFrom || null,
        start: payment.planStartDate,
        end: payment.planEndDate,
      }
    });

  } catch (error) {
    console.error("❌ Verify error:", error);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
});

// ✅ Get Razorpay Public Key
router.get("/get-key", (req, res) => {
  res.json({ key: process.env.RAZORPAY_KEY_ID });
});

module.exports = router;
