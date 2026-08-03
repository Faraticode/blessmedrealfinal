const express = require("express");
const { getTodayQuiz, submitTodayQuiz } = require("../controllers/quizController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.get("/today", getTodayQuiz);
router.post("/today/submit", submitTodayQuiz);

module.exports = router;
