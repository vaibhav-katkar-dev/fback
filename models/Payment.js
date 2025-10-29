const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  paymentId: { type: String },
  signature: { type: String },
  planName: { type: String, required: true },
  baseCurrency: { type: String, default: "USD" },
  convertedCurrency: { type: String, default: "INR" },
  amountUSD: { type: Number, required: true },
  amountINR: { type: Number, required: true },
  user: {
    name: String,
    email: String,
    contact: String,
  },
  status: { type: String, enum: ["created", "success", "failed"], default: "created" },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Payment", paymentSchema);
