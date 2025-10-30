const express = require("express");
const router = express.Router();
const Form = require("../models/Form");
const Response = require("../models/Response");


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
router.get("/responses/by-id/:formId/:userId", async (req, res) => {
  try {
    const { formId, userId } = req.params;

    // better: use findOne and check object existence
    const form = await Form.findOne({ _id: formId, userId: userId });
    if (!form) {
      return res.status(404).json({ message: "Form not found or access denied" });
    }

    const responses = await Response.find({ formId });
    return res.json({ responses });
  } catch (err) {
    console.error("Error fetching responses:", err);
    return res.status(500).json({ message: "Error fetching responses", error: err.message });
  }
});


module.exports = router;
