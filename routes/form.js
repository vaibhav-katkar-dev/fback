const express = require("express");
const router = express.Router();
const Form = require("../models/Form");
const Response = require("../models/Response");


router.get("/by-id/:id", async (req, res) => {
  try {
    const form = await Form.findById(req.params.id) || await FormTemplate.findById(req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found" });
    res.status(200).json(form);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});



// POST form responses


router.post("/:formId/responses", async (req, res) => {
  const { formId } = req.params;
  const userResponses = req.body;

  try {
    const form = await Form.findById(formId);
    if (!form) return res.status(404).json({ message: "Form not found" });

    const newResponse = new Response({ formId, answers: userResponses });
    await newResponse.save();
    console.log("Response saved successfully", newResponse);

    res.status(200).json({ message: "Response saved" });
  } catch (err) {
    res.status(500).json({ message: "Error saving response", error: err });
  }
});

// GET responses by formId
// auth middleware should set req.user = { id: '...' }

module.exports = router;
