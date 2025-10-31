const express = require("express");
const router = express.Router();
const Form = require("../models/Form");
const Response = require("../models/Response");
const FormTemplate = require("../models/FormTemplate");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const checkPlanLimit = require("../middlewares/checkPlan");
const Payment = require("../models/Payment");
const planLimits = require("../planLimits");

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
router.post("/submit/:formId",  async (req, res) => {
  try {
    const formId = req.params.formId;
    const formData = req.body;
    res.status(200).json({ message: "Form data received", data: formData });
  } catch (err) {
    res.status(500).json({ error: "Submit error", details: err });
  }
});

// GET form by ID
const checkPlan = require("../middlewares/checkPlan");

router.put("/by-id/:id", async (req, res) => {
  try {
    const { data, userId } = req.body;
    if (!data) return res.status(400).json({ message: "No data provided" });

    // ✅ Check if this form already exists (user updating form)
    let existingForm = await Form.findById(req.params.id);

    if (existingForm) {
      // ✅ If the form belongs to the same user --> allow update (no plan check)
      if (existingForm.userId.toString() === userId) {
        const updatedForm = await Form.findOneAndUpdate(
          { _id: req.params.id },
          {
            title: data.title,
            description: data.description,
            fields: data.fields,
            userId
          },
          { new: true }
        );

        return res.json({ 
          message: "Form updated", 
          form: updatedForm 
        });
      }

      return res.status(403).json({ message: "You do not own this form" });
    }

    // ✅ If not form, maybe it's a template → Try finding template
    const template = await FormTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ message: "Form/Template not found" });
    }

    // ✅ Template → New Form Creation → APPLY PLAN LIMIT
    await checkPlan("createForm")(req, res, () => {});
    if (res.headersSent) return; // If blocked by plan limit, stop here

    // ✅ Create new form from template
    const newForm = new Form({
      title: data.title || template.title,
      description: data.description || template.description,
      fields: data.fields || template.fields,
      userId
    });

    const savedForm = await newForm.save();

    return res.status(201).json({
      message: "New form created from template",
      form: savedForm
    });

  } catch (err) {
    console.error("Error in form save/update:", err);
    res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
});



// GET responses by formId
// auth middleware should set req.user = { id: '...' }
router.get("/responses/by-id/:formId/:userId", async (req, res) => {
  try {
    const { formId, userId } = req.params;

    // ✅ Check form belongs to user
    const form = await Form.findOne({ _id: formId, userId });
    if (!form) {
      return res.status(404).json({ message: "Form not found or access denied" });
    }

    // ✅ Get user plan
    const payment = await Payment.findOne({
      "user.email": req.user?.email,
      verified: true,
      planEndDate: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    const currentPlan = payment?.planName || "free";
    const limit = planLimits[currentPlan]?.maxResponsesPerForm || 0;

    // ✅ Count all responses
    const totalResponses = await Response.countDocuments({ formId });

    // ✅ Send only allowed responses but inform total count
    const allowedResponses = await Response.find({ formId })
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json({
      success: true,
      plan: currentPlan,
      totalResponses,
      allowedLimit: limit,
      shownResponses: allowedResponses.length,
      responses: allowedResponses,
      upgradeRequired: totalResponses > limit
    });
  } catch (err) {
    console.error("Error fetching responses:", err);
    return res
      .status(500)
      .json({ message: "Error fetching responses", error: err.message });
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




// router.get("/by-id/:id", async (req, res) => {
//   try {
//     const form = await Form.findById(req.params.id) || await FormTemplate.findById(req.params.id);
//     if (!form) return res.status(404).json({ message: "Form not found" });
//     res.status(200).json(form);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

module.exports = router;