const StepEntry = require("../models/StepEntry");
const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const { syncStepsFromGoogleFit } = require("../services/googleFitService");

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayString(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const POINTS_PER_GOAL_DAY = 10;

// Lifetime step milestones. Points earned here (like all `points` on User)
// accrue toward the future BMed token — this is just the schedule for how
// fast they add up as a user walks more over time.
const STEP_MILESTONES = [
  { threshold: 10000, points: 20 },
  { threshold: 50000, points: 50 },
  { threshold: 100000, points: 100 },
  { threshold: 250000, points: 250 },
  { threshold: 500000, points: 500 },
  { threshold: 1000000, points: 1000 },
  { threshold: 2500000, points: 2500 },
  { threshold: 5000000, points: 5000 },
];

/**
 * Recalculates streak/points on the User document after a day's step count
 * changes. Only awards points/streak the first time a given day's goal is
 * met (guarded by lastGoalMetDate) so re-syncing the same day never
 * double-counts.
 */
function applyGoalLogic(user, date, steps) {
  if (steps < user.dailyStepGoal) return;
  if (user.lastGoalMetDate === date) return; // already credited today

  const wasConsecutive = user.lastGoalMetDate === yesterdayString(date);
  user.stepStreak = wasConsecutive ? user.stepStreak + 1 : 1;
  user.lastGoalMetDate = date;
  user.points += POINTS_PER_GOAL_DAY;
}

/**
 * Adds `delta` to the user's lifetime step total and awards any newly
 * crossed milestone(s). Mutates `user` in place; caller is responsible for
 * saving. Milestones are one-time — `stepMilestonesReached` guards against
 * re-awarding on subsequent syncs.
 */
function applyMilestoneLogic(user, delta) {
  if (delta <= 0) return [];

  user.totalStepsLifetime += delta;
  const newlyReached = [];

  for (const milestone of STEP_MILESTONES) {
    const alreadyReached = user.stepMilestonesReached.includes(milestone.threshold);
    if (!alreadyReached && user.totalStepsLifetime >= milestone.threshold) {
      user.stepMilestonesReached.push(milestone.threshold);
      user.points += milestone.points;
      newlyReached.push(milestone);
    }
  }
  return newlyReached;
}

function buildMilestoneView(user) {
  const nextMilestone = STEP_MILESTONES.find((m) => !user.stepMilestonesReached.includes(m.threshold));
  return {
    totalStepsLifetime: user.totalStepsLifetime,
    reached: STEP_MILESTONES.filter((m) => user.stepMilestonesReached.includes(m.threshold)),
    next: nextMilestone || null,
  };
}

// @desc  Upsert today's step count (called automatically by the client-side
//        sensor tracker, or manually, or later by a Google Fit sync job)
// @route PUT /api/steps/today
const upsertTodaySteps = async (req, res) => {
  try {
    const { steps, source } = req.body;
    if (steps === undefined || steps < 0) {
      return res.status(400).json({ message: "A non-negative steps value is required" });
    }

    const date = todayString();
    const existing = await StepEntry.findOne({ user: req.user._id, date });

    // Never let a stale/smaller sync overwrite a higher count already recorded today.
    const finalSteps = existing ? Math.max(existing.steps, steps) : steps;
    const delta = finalSteps - (existing ? existing.steps : 0);

    const entry = await StepEntry.findOneAndUpdate(
      { user: req.user._id, date },
      { steps: finalSteps, source: source || "sensor" },
      { new: true, upsert: true }
    );

    const user = req.user;
    applyGoalLogic(user, date, finalSteps);
    const newMilestones = applyMilestoneLogic(user, delta);
    await user.save();

    res.json({
      entry,
      goalMet: finalSteps >= user.dailyStepGoal,
      stepStreak: user.stepStreak,
      points: user.points,
      newMilestones,
    });
  } catch (err) {
    res.status(400).json({ message: "Failed to record steps", error: err.message });
  }
};

// @desc  Get a summary: today's steps, goal, streak, points, weekly total, milestones
// @route GET /api/steps/summary
const getSummary = async (req, res) => {
  const date = todayString();
  const [todayEntry, weekEntries] = await Promise.all([
    StepEntry.findOne({ user: req.user._id, date }),
    StepEntry.find({ user: req.user._id }).sort({ date: -1 }).limit(7),
  ]);

  const weeklyTotal = weekEntries.reduce((sum, e) => sum + e.steps, 0);

  res.json({
    today: {
      date,
      steps: todayEntry?.steps || 0,
      goal: req.user.dailyStepGoal,
    },
    stepStreak: req.user.stepStreak,
    points: req.user.points,
    weeklyTotal,
    history: weekEntries.reverse(),
    milestones: buildMilestoneView(req.user),
  });
};

// @desc  List raw step entries (for a chart)
// @route GET /api/steps?days=7
const getHistory = async (req, res) => {
  const days = Math.min(Number(req.query.days) || 7, 90);
  const entries = await StepEntry.find({ user: req.user._id }).sort({ date: -1 }).limit(days);
  res.json({ entries: entries.reverse() });
};

// @desc  Update the user's daily step goal
// @route PUT /api/steps/goal
const updateGoal = async (req, res) => {
  const { dailyStepGoal } = req.body;
  if (!dailyStepGoal || dailyStepGoal < 500) {
    return res.status(400).json({ message: "dailyStepGoal must be at least 500" });
  }
  const user = await User.findByIdAndUpdate(req.user._id, { dailyStepGoal }, { new: true });
  res.json({ user });
};

// @desc  Placeholder endpoint for the future Google Fit sync
// @route POST /api/steps/google-fit/sync
const googleFitSync = async (req, res) => {
  try {
    await syncStepsFromGoogleFit(req.user._id);
    res.json({ message: "Synced" });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

module.exports = {
  upsertTodaySteps: asyncHandler(upsertTodaySteps),
  getSummary: asyncHandler(getSummary),
  getHistory: asyncHandler(getHistory),
  updateGoal: asyncHandler(updateGoal),
  googleFitSync: asyncHandler(googleFitSync),
};
