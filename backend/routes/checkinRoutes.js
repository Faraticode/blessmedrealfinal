const express = require("express");
const { getTodayCheckin, getCheckinChallenge, submitTodayCheckin, getHistory } = require("../controllers/checkinController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.get("/today", getTodayCheckin);
router.get("/challenge", getCheckinChallenge);
router.post("/today", submitTodayCheckin);
router.get("/", getHistory);

module.exports = router;
