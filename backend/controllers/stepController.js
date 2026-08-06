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

// Conversion rate: every STEPS_PER_POINT steps walked earns 1 point.
// Points accrue toward the future BMed token airdrop.
const STEPS_PER_POINT = 1000; // 1,000 steps = 1 point

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
 * Adds `delta` to the user's lifetime step total, awards continuous
 * conversion-rate points (STEPS_PER_POINT steps = 1 point), and awards any
 * newly crossed milestone(s). Mutates `user` in place; caller is responsible
 * for saving. Conversion points are derived from totalStepsLifetime so
 * remainders carry forward and re-syncs never double-count. Milestones are
 * one-time — `stepMilestonesReached` guards against re-awarding.
 */
function applyMilestoneLogic(user, delta) {
  if (delta <= 0) return { newlyReached: [], pointsFromSteps: 0 };

  const oldTotal = user.totalStepsLifetime || 0;
  user.totalStepsLifetime = oldTotal + delta;

  // Continuous conversion: every STEPS_PER_POINT steps = 1 point
  const oldConversionPoints = Math.floor(oldTotal / STEPS_PER_POINT);
  const newConversionPoints = Math.floor(user.totalStepsLifetime / STEPS_PER_POINT);
  const pointsFromSteps = newConversionPoints - oldConversionPoints;
  if (pointsFromSteps > 0) {
    user.points += pointsFromSteps;
  }

  const newlyReached = [];
  for (const milestone of STEP_MILESTONES) {
    const alreadyReached = (user.stepMilestonesReached || []).includes(milestone.threshold);
    if (!alreadyReached && user.totalStepsLifetime >= milestone.threshold) {
      user.stepMilestonesReached = user.stepMilestonesReached || [];
      user.stepMilestonesReached.push(milestone.threshold);
      user.points += milestone.points;
      newlyReached.push(milestone);
    }
  }
  return { newlyReached, pointsFromSteps };
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
    const { newlyReached: newMilestones, pointsFromSteps } = applyMilestoneLogic(user, delta);
    await user.save();

    res.json({
      entry,
      goalMet: finalSteps >= user.dailyStepGoal,
      stepStreak: user.stepStreak,
      points: user.points,
      pointsFromSteps, // points earned from the step conversion rate this update
      newMilestones,
      conversionRate: { stepsPerPoint: STEPS_PER_POINT },
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

  const totalSteps = req.user.totalStepsLifetime || 0;
  const pointsFromConversion = Math.floor(totalSteps / STEPS_PER_POINT);

  res.json({
    today: {
      date,
      steps: todayEntry?.steps || 0,
      goal: req.user.dailyStepGoal,
    },
    stepStreak: req.user.stepStreak,
    points: req.user.points,
    pointsFromSteps: pointsFromConversion, // total points earned purely from the conversion rate
    weeklyTotal,
    history: weekEntries.reverse(),
    milestones: buildMilestoneView(req.user),
    conversionRate: {
      stepsPerPoint: STEPS_PER_POINT,
      description: `${STEPS_PER_POINT.toLocaleString()} steps = 1 point toward future BMed airdrop`,
    },
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
