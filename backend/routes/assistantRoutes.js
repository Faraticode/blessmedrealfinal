const express = require("express");
const { getHistory, sendMessage, clearHistory } = require("../controllers/assistantController");
const { protect } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");

const router = express.Router();

// Tighter rate limit than the general API limiter — each call costs money.
const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { message: "You're sending messages too quickly. Please wait a moment." },
});

router.use(protect);

router.get("/history", getHistory);
router.post("/chat", assistantLimiter, sendMessage);
router.delete("/history", clearHistory);

module.exports = router;
