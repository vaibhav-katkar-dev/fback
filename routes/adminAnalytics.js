const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Payment = require("../models/Payment");
const Form = require("../models/Form");
const Response = require("../models/Response");

// Optional View tracking model
let View;
try {
  View = require("../models/View");
} catch (e) {
  console.warn("⚠️ View model not found — continuing without it");
}

// ADMIN ANALYTICS (no auth for now)
router.get("/vk2006", async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date(now - 12 * 30 * 24 * 60 * 60 * 1000); // Approx. 12 months

    // === Parallel fetch with full protection ===
    const [
      totalUsers,
      newUsers7d,
      newUsers30d,
      totalForms,
      totalResponses,
      totalPayments,
      paidUsers,
      planStats,
      totalRevenue,
      recentRevenue30d,
      totalViews,
      paidUsersList,
      userGrowthData,
      revenueTrends
    ] = await Promise.all([
      User.countDocuments().catch(() => 0),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }).catch(() => 0),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }).catch(() => 0),
      Form.countDocuments().catch(() => 0),
      Response.countDocuments().catch(() => 0),
      Payment.countDocuments({ verified: true }).catch(() => 0),
      Payment.distinct("user.email", { verified: true }).catch(() => []),
      Payment.aggregate([
        { $match: { verified: true } },
        { $group: { _id: "$planName", count: { $sum: 1 } } },
      ]).catch(() => []),
      Payment.aggregate([
        { $match: { verified: true } },
        { $group: { _id: null, total: { $sum: "$amountINR" } } },
      ]).catch(() => []),
      Payment.aggregate([
        { $match: { verified: true, createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: "$amountINR" } } },
      ]).catch(() => []),
      View ? View.countDocuments().catch(() => 0) : 0,
      Payment.find(
        { verified: true },
        { "user.email": 1, planName: 1, amountINR: 1, createdAt: 1 }
      )
        .sort({ createdAt: -1 })
        .limit(100)
        .catch(() => []),
      // User growth (handle MongoDB version difference)
      User.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]).catch(() => []),
      Payment.aggregate([
        { $match: { verified: true, createdAt: { $gte: twelveMonthsAgo } } },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            total: { $sum: "$amountINR" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]).catch(() => []),
    ]);

    // === Derived Calculations ===
    const activeUsers = await User.countDocuments({
      updatedAt: { $gte: sevenDaysAgo },
    }).catch(() => 0);

    const paidUserCount = Array.isArray(paidUsers) ? paidUsers.length : 0;
    const totalRevenueValue =
      totalRevenue && totalRevenue.length > 0 ? totalRevenue[0].total : 0;
    const revenue30dValue =
      recentRevenue30d && recentRevenue30d.length > 0
        ? recentRevenue30d[0].total
        : 0;

    const conversionRate =
      totalUsers > 0 ? ((paidUserCount / totalUsers) * 100).toFixed(2) : 0;
    const avgRevenuePerUser =
      paidUserCount > 0 ? (totalRevenueValue / paidUserCount).toFixed(2) : 0;
    const responseRate =
      totalForms > 0 ? (totalResponses / totalForms).toFixed(2) : 0;
    const retentionRate =
      totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0;

    // === Final Data Object ===
    const data = {
      totalUsers,
      newUsers7d,
      newUsers30d,
      activeUsers,
      totalForms,
      totalResponses,
      totalPayments,
      paidUsers: paidUserCount,
      conversionRate,
      totalRevenueINR: totalRevenueValue,
      revenue30dINR: revenue30dValue,
      planStats,
      paidUsersList,
      userGrowthData,
      revenueTrends,
      avgRevenuePerUser,
      responseRate,
      retentionRate,
    };

    console.log("✅ Admin analytics generated successfully");
    res.render("adminAnalytics", { data });
  } catch (error) {
    console.error("❌ Admin Dashboard Error:", error.stack);
    res
      .status(500)
      .send("Server Error: " + (error.message || "Unknown error occurred"));
  }
});

module.exports = router;
