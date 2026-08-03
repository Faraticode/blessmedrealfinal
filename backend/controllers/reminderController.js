const MedicationReminder = require("../models/MedicationReminder");
const asyncHandler = require("../utils/asyncHandler");

// @desc  Create a medication reminder
// @route POST /api/reminders
const createReminder = async (req, res) => {
  try {
    const { medicationName, dosage, times, daysOfWeek, notes } = req.body;
    if (!medicationName || !times) {
      return res.status(400).json({ message: "medicationName and times are required" });
    }

    const reminder = await MedicationReminder.create({
      user: req.user._id,
      medicationName,
      dosage,
      times,
      daysOfWeek: daysOfWeek || [],
      notes,
    });

    res.status(201).json({ reminder });
  } catch (err) {
    res.status(400).json({ message: "Failed to create reminder", error: err.message });
  }
};

// @desc  List all reminders for the logged-in user
// @route GET /api/reminders
const getReminders = async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.active !== undefined) filter.active = req.query.active === "true";

  const reminders = await MedicationReminder.find(filter).sort({ createdAt: -1 });
  res.json({ reminders });
};

// @desc  Update a reminder (edit schedule, dosage, or toggle active)
// @route PUT /api/reminders/:id
const updateReminder = async (req, res) => {
  const allowedFields = ["medicationName", "dosage", "times", "daysOfWeek", "notes", "active"];
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  try {
    const reminder = await MedicationReminder.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true, runValidators: true }
    );
    if (!reminder) return res.status(404).json({ message: "Reminder not found" });
    res.json({ reminder });
  } catch (err) {
    res.status(400).json({ message: "Failed to update reminder", error: err.message });
  }
};

// @desc  Delete a reminder
// @route DELETE /api/reminders/:id
const deleteReminder = async (req, res) => {
  const reminder = await MedicationReminder.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!reminder) return res.status(404).json({ message: "Reminder not found" });
  res.json({ message: "Reminder deleted" });
};

module.exports = {
  createReminder: asyncHandler(createReminder),
  getReminders: asyncHandler(getReminders),
  updateReminder: asyncHandler(updateReminder),
  deleteReminder: asyncHandler(deleteReminder),
};
