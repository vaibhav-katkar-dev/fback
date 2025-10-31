const Payment = require("../models/Payment");
const Form = require("../models/Form");
const Response = require("../models/Response");
const planLimits = require("../planLimits");

function checkPlanLimit(action) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const userEmail = req.user?.email;

      // ✅ For form creation & editing — user must be logged in
      if (action === "createForm" && (!userId || !userEmail)) {
        return res.status(401).json({ success: false, message: "Login required" });
      }

      // ✅ For public form submissions — don't block if no login
      if (action === "submitResponse" && (!userId || !userEmail)) {
        return next();
      }

      // ✅ Get active paid plan
      const activePlan = await Payment.findOne({
        "user.email": userEmail,
        verified: true,
        planEndDate: { $gt: new Date() }
      }).sort({ createdAt: -1 });

      const currentPlan = activePlan?.planName || "free";
      const limit = planLimits[currentPlan];

      console.log("✅ User Plan:", currentPlan);

      // ✅ Form creation limit
      if (action === "createForm") {
        const totalForms = await Form.countDocuments({ userId: userId });

        if (totalForms >= limit.maxForms) {
          return res.status(403).json({
            success: false,
            message: `Your ${currentPlan} plan allows only ${limit.maxForms} forms.`,
            upgradeRequired: true
          });
        }
      }

      // ✅ Form response limit
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
