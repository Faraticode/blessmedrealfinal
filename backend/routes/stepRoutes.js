const express = require("express");
const {
  upsertTodaySteps,
  getSummary,
  getHistory,
  updateGoal,
  googleFitSync,
} = require("../controllers/stepController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.get("/summary", getSummary);
router.get("/", getHistory);
router.put("/today", upsertTodaySteps);
router.put("/goal", updateGoal);
router.post("/google-fit/sync", googleFitSync);

module.exports = router;
