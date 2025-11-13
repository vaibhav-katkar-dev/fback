// models/View.js
const mongoose = require("mongoose");

const viewSchema = new mongoose.Schema({
  formId: { type: mongoose.Schema.Types.ObjectId, ref: "Form" },
  userAgent: String,
  ip: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("View", viewSchema);
//not using