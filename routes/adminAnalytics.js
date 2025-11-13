const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Payment = require("../models/Payment");
const Form = require("../models/Form");
const Response = require("../models/Response");
const View = require("../models/View"); // optional - create if you track form/page views

// Middleware to check if user is admin (add your own logic, e.g., req.user.role === 'admin')
const isAdmin = (req, res, next) => {
  // Example: if (!req.user || req.user.role !== 'admin') return res.status(403).send('Access denied');
  next();
};

router.get("/", isAdmin, async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date(now - 12 * 30 * 24 * 60 * 60 * 1000); // Approx. 12 months

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
      paidUsersList, // New: List of paid users with details
      userGrowthData, // New: New users per week over 30 days
      revenueTrends // New: Monthly revenue over 12 months
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Form.countDocuments(),
      Response.countDocuments(),
      Payment.countDocuments({ verified: true }),
      Payment.distinct("user.email", { verified: true }),
      Payment.aggregate([
        { $match: { verified: true } },
        { $group: { _id: "$planName", count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { verified: true } },
        { $group: { _id: null, total: { $sum: "$amountINR" } } },
      ]),
      Payment.aggregate([
        { $match: { verified: true, createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: "$amountINR" } } },
      ]),
      View ? View.countDocuments() : 0,
      // New: Fetch paid users list (email, plan, amount, date)
      Payment.find({ verified: true }, { "user.email": 1, planName: 1, amountINR: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(100), // Limit for performance; adjust as needed
      // New: User growth - new users per week over 30 days
      User.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $week: "$createdAt" }, count: { $sum: 1 } } },
        { $sort: { "_id": 1 } }
      ]),
      // New: Revenue trends - monthly over 12 months (FIXED SYNTAX)
      Payment.aggregate([
        { $match: { verified: true, createdAt: { $gte: twelveMonthsAgo } } },
        { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, total: { $sum: "$amountINR" } } },
        { $sort: { "_id": 1 } }
      ])
    ]);

    // Active users (updated in last 7 days)
    const activeUsers = await User.countDocuments({ updatedAt: { $gte: sevenDaysAgo } });

    // New calculations
    const conversionRate = totalUsers > 0 ? ((paidUsers.length / totalUsers) * 100).toFixed(2) : 0;
    const avgRevenuePerUser = paidUsers.length > 0 ? (totalRevenue[0]?.total || 0) / paidUsers.length : 0;
    const responseRate = totalForms > 0 ? (totalResponses / totalForms).toFixed(2) : 0;
    const retentionRate = totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0;

    const data = {
      totalUsers,
      newUsers7d,
      newUsers30d,
      activeUsers,
      totalForms,
      totalResponses,
      totalPayments,
      paidUsers: paidUsers.length,
      conversionRate,
      totalRevenueINR: totalRevenue[0]?.total || 0,
      revenue30dINR: recentRevenue30d[0]?.total || 0,
      
      planStats,
      paidUsersList, // New
      userGrowthData, // New
      revenueTrends, // New
      avgRevenuePerUser: avgRevenuePerUser.toFixed(2),
      responseRate,
      retentionRate
    };

    res.render("adminAnalytics", { data });
  } catch (error) {
    console.error("Admin Dashboard Error:", error);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
