const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  paymentId: { type: String },
  signature: { type: String },

  // Plan details
  planName: { type: String, required: true }, // Starter / Pro / Enterprise
  planType: { type: String, enum: ["monthly", "yearly"], required: true }, // Monthly / Yearly
  planDuration: { type: Number, default: 30 }, // Days (30 or 365)
  
  // Currency & Amounts
  baseCurrency: { type: String, default: "USD" },
  convertedCurrency: { type: String, default: "INR" },
  amountUSD: { type: Number, required: true },
  amountINR: { type: Number, required: true },

  // User info
  user: {
    name: String,
    email: String,
    contact: String,
  },

  // Plan timing & status
  planStartDate: { type: Date },
  planEndDate: { type: Date },
  isActive: { type: Boolean, default: false },

  // Payment status
  status: { type: String, enum: ["created", "success", "failed"], default: "created" },
  verified: { type: Boolean, default: false },

referredBy: {
    type: String,
    default: null   // <-- THIS IS PERFECT
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Payment", paymentSchema);
