const express = require("express");
const router = express.Router();
const Form = require("../models/Form");
const Response = require("../models/Response");
const FormTemplate = require("../models/FormTemplate");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// POST - Save form
router.post("/", async (req, res) => {
  try {
    console.log("Received form data:", req.body);

    const { data, token,userId } = req.body;
    if (!token) return res.status(401).json({ message: "Token missing" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
console.log("dataa",userId);
    const newForm = new Form({
      title: data.title,
      description: data.description,
      fields: data.fields,
      userId:userId, // ✅ store userId instead of raw token
    });

    console.log("New form to save:", newForm);
    await newForm.save();

    res.status(201).json({ message: "Form saved", form: newForm });
  } catch (error) {
    console.error("Error saving form:", error);
    res.status(500).json({ message: "Error saving form", error });
  }
});

// GET - Fetch all forms for a token
router.get("/by-token/:userId", async (req, res) => {
  try {
    const userId= req.params.userId;
    // if (!token) return res.status(400).json({ msg: "Token is required" });

    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // console.log("Decoded token:", decoded);
    // const user = await User.find({ _id: decoded.id });

      // console.log("Forms found:", user);


    // Find all forms belonging to this user
const forms = await Form.find({ userId: userId});
    console.log("Forms found:", forms);
    res.json(forms);
  } catch (err) {
    console.error("Token verification failed:", err.message);
    res.status(401).json({ msg: "Invalid or expired token" });
  }
});

// POST submit form response
router.post("/submit/:formId", async (req, res) => {
  try {
    const formId = req.params.formId;
    const formData = req.body;
    res.status(200).json({ message: "Form data received", data: formData });
  } catch (err) {
    res.status(500).json({ error: "Submit error", details: err });
  }
});

// GET form by ID
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

// PUT /api/forms/by-id/:id
router.put("/by-id/:id", async (req, res) => {
  try {
    const { data, token,userId } = req.body;
    if (!data) return res.status(400).json({ message: "No data provided" });

    let existingForm = await Form.findOne({ _id: req.params.id });
    if (!existingForm) existingForm = await FormTemplate.findOne({ _id: req.params.id });
    if (!existingForm) return res.status(404).json({ message: "Form not found" });

    if (existingForm.status === "template") {
      const newForm = new Form({
        title: data.title || existingForm.title,
        description: data.description || existingForm.description,
        fields: data.fields || existingForm.fields,
      userId:userId, // ✅ store userId instead of raw token
      });

      const savedForm = await newForm.save();
      return res.status(201).json({
        message: "New form created from template",
        form: savedForm,
      });
    }

    const updated = await Form.findOneAndUpdate(
      { _id: req.params.id },
      {
        title: data.title,
        description: data.description,
        fields: data.fields,
        token: token ? jwt.verify(token, process.env.JWT_SECRET).id : existingForm.token,
      },
      { new: true }
    );

    res.json({ message: "Form updated", form: updated });
  } catch (err) {
    console.error("Error updating form:", err);
    res.status(500).json({ message: "Error updating form", error: err.message });
  }
});

// DELETE form
router.delete("/by-id/:id", async (req, res) => {
  try {
    await Form.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Form deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting form", error });
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
router.get("/responses/by-id/:formId", async (req, res) => {
  try {
    const { formId } = req.params;
    const responses = await Response.find({ formId });
    res.json({ responses });
  } catch (err) {
    res.status(500).json({ message: "Error fetching responses", error: err });
  }
});

module.exports = router;
