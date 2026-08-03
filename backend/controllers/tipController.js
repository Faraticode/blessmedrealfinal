const HealthTip = require("../models/HealthTip");
const asyncHandler = require("../utils/asyncHandler");

// @desc  List health tips (optionally filter by category)
// @route GET /api/tips
const getTips = async (req, res) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;

  const tips = await HealthTip.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json({ tips });
};

module.exports = { getTips: asyncHandler(getTips) };
