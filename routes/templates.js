const express = require("express");
const router = express.Router();
const FormTemplate = require("../models/FormTemplate");

// Get all templates
router.get("/", async (req, res) => {
  try {
    const templates = await FormTemplate.find();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// // Create new template (Admin use only)
// router.post("/", async (req, res) => {
//   try {
//     const newTemplate = new FormTemplate(req.body);
//     await newTemplate.save();
//     res.json({ message: "Template added successfully", template: newTemplate });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

module.exports = router;
