const express = require("express");
const router = express.Router();
const Form = require("../models/Form");
const Response = require("../models/Response");
const authMiddleware = require("./authMiddleware");
const FormTemplate = require("../models/FormTemplate");


const jwt = require("jsonwebtoken");

// POST - Save form
// routes/forms.js
router.post("/", async (req, res) => {
  try {
    console.log("Received form data:", req.body); // ✅ already working

    const { data, token } = req.body;

    
    const newForm = new Form({ title:data.title, description:data.description, fields:data.fields, token });
    console.log("New form to save:", newForm);
    await newForm.save();

    res.status(201).json({ message: "Form saved", form: newForm });
  } catch (error) {
    console.error("Error saving form:", error);
    res.status(500).json({ message: "Error saving form", error });
  }
});


// GET - Fetch all forms

// GET - Fetch all forms for a token
router.get("/by-token/:token", async (req, res) => {
  try {
    const token = req.params.token;
    if (!token) {
      return res.status(400).json({ msg: "Token is required" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // decoded.id = user ka _id jo tumne login ke time token me set kiya tha
    console.log("Decoded token:", decoded);

    // Find all forms belonging to this user
    const forms = await Form.find({ token: token });

    res.json(forms);
  } catch (err) {
    console.error("Token verification failed:", err.message);
    res.status(401).json({ msg: "Invalid or expired token" });
  }
});


router.post("/submit/:formId", async (req, res) => {
  try {
    const formId = req.params.formId;
    const formData = req.body; // this should be an object of field: value
    // Save to new collection or embed in form document
    res.status(200).json({ message: "Form data received", data: formData });
  } catch (err) {
    res.status(500).json({ error: "Submit error", details: err });
  }
});

// GET form by ID
router.get("/by-id/:id",async (req, res) => {
  try {
    // Check if user is logged in
   
    // Fetch the form
  
const form = await Form.findById(req.params.id) || await FormTemplate.findById(req.params.id);
    
        // const form = await FormTemplate.findById(req.params.id);
    
   

    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    // Optional: also fetch template if needed
    // const template = await FormTemplate.findById(req.params.id);

    // Render / send the data
    res.status(200).json( form );

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }

});

// PUT /api/forms/by-id/:id
router.put("/by-id/:id", async (req, res) => {
  try {
    const { data, token } = req.body;

    if (!data) return res.status(400).json({ message: "No data provided" });

    // 1️⃣ Try to find the form in Form first
    let existingForm = await Form.findOne({ _id: req.params.id });

    // 2️⃣ If not found, try FormTemplate
    if (!existingForm) {
      existingForm = await FormTemplate.findOne({ _id: req.params.id });
    }

    if (!existingForm) return res.status(404).json({ message: "Form not found" });

    // 3️⃣ If it’s a template, create a new form
    if (existingForm.status === "template") {
      const newForm = new Form({
        title: data.title || existingForm.title,
        description: data.description || existingForm.description,
        fields: data.fields || existingForm.fields,
        token: token || existingForm.token
      });

      const savedForm = await newForm.save();

      return res.status(201).json({
        message: "New form created from template",
        form: savedForm
      });
    }

    // 4️⃣ Otherwise, update the existing form
    const updated = await Form.findOneAndUpdate(
      { _id: req.params.id },
      {
        title: data.title,
        description: data.description,
        fields: data.fields,
        token: token
      },
      { new: true }
    );

    res.json({ message: "Form updated", form: updated });

  } catch (err) {
    console.error("Error updating form:", err);

    // Return the actual error message for debugging
    res.status(500).json({ message: "Error updating form", error: err.message });
  }
});



// routes/forms.js
router.delete("/by-id/:id", async (req, res) => {
  try {
    await Form.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Form deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting form", error });
  }
});


router.post("/:formId/responses", async (req, res) => {
  const { formId } = req.params;
  const userResponses = req.body;

      // console.log("Response saved:", userResponses, formId);

  try {
    // Check if form exists
    const form = await Form.findById(formId);
    if (!form) return res.status(404).json({ message: "Form not found" });

    // Create new response entry
    const newResponse = new Response({
      formId,
      answers: userResponses,
    });

    await newResponse.save().then(() => {
      console.log("Response saved successfully",newResponse);
    });

    res.status(200).json({ message: "Response saved" });
  } catch (err) {
    res.status(500).json({ message: "Error saving response", error: err });
  }
});


// GET /api/responses/:formId
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
