const mongoose = require("mongoose");

const fieldSchema = new mongoose.Schema({
  type: String,
  label: String,
  placeholder: String,
  required: Boolean,
  options: [String]
});

const FormSchema = new mongoose.Schema({
  title: String,
  description: String,
  fields: [fieldSchema],
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // ✅ store actual userId
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Form", FormSchema);
