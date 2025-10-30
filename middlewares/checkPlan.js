// middlewares/checkPlan.js

const Payment = require("../models/Payment");
const Form = require("../models/Form");
const Response = require("../models/Response");
const planLimits = require("../planLimits");

function checkPlanLimit(action) {
  return async (req, res, next) => {
    try {
      const userId = req.body.userId || req.params.userId;

      if (!userId) {
        return res.status(400).json({ success: false, message: "UserID missing" });
      }

      // ✅ Fetch active plan (if any)
      const activePlan = await Payment.findOne({
        "user.email": req.user?.email, 
        verified: true,
        planEndDate: { $gt: new Date() }
      }).sort({ createdAt: -1 });

      const currentPlan = activePlan?.planName || "free"; 

      const limit = planLimits[currentPlan];

      // ✅ Check form creation limit
      if (action === "createForm") {
        const totalForms = await Form.countDocuments({ userId });
        if (totalForms >= limit.maxForms) {
          return res.status(403).json({
            success: false,
            message: `Your ${currentPlan} plan allows only ${limit.maxForms} forms.`,
            upgradeRequired: true
          });
        }
      }

      // ✅ Check response limit
      if (action === "submitResponse") {
        const formId = req.params.formId;
        const count = await Response.countDocuments({ formId });

        if (count >= limit.maxResponsesPerForm) {
          return res.status(403).json({
            success: false,
            message: `Response limit reached for ${currentPlan} plan. Upgrade required.`,
            upgradeRequired: true
          });
        }
      }

      next();
    } catch (err) {
      console.error("Plan check error:", err);
      res.status(500).json({ success: false, message: "Plan check failed" });
    }
  };
}

module.exports = checkPlanLimit;
