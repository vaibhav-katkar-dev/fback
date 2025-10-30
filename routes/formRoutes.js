const express = require("express");
const router = express.Router();
const Form = require("../models/Form");
const Response = require("../models/Response");
const FormTemplate = require("../models/FormTemplate");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const checkPlanLimit = require("../middlewares/checkPlan");

// POST - Save form
router.post("/",  checkPlanLimit("createForm"), async (req, res) => {
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
router.post("/submit/:formId",checkPlanLimit("submitResponse"),  async (req, res) => {
  try {
    const formId = req.params.formId;
    const formData = req.body;
    res.status(200).json({ message: "Form data received", data: formData });
  } catch (err) {
    res.status(500).json({ error: "Submit error", details: err });
  }
});

// GET form by ID


// PUT /api/forms/by-id/:id
router.put("/by-id/:id",checkPlanLimit("createForm"), async (req, res) => {
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
      userId:userId, // ✅ store userId instead of raw token
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


router.get("/responses/by-id/:formId/:userId" ,async (req, res) => {
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