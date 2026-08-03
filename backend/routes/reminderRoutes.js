const express = require("express");
const {
  createReminder,
  getReminders,
  updateReminder,
  deleteReminder,
} = require("../controllers/reminderController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.route("/").get(getReminders).post(createReminder);
router.route("/:id").put(updateReminder).delete(deleteReminder);

module.exports = router;
