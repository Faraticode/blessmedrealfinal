const DailyCheckin = require("../models/DailyCheckin");
const asyncHandler = require("../utils/asyncHandler");
const { buildCheckinChallenge, verifyCheckinSignature } = require("../services/stacksAuthService");

const POINTS_PER_CHECKIN = 5;
const STREAK_BONUS_EVERY = 7; // every 7-day streak earns a bonus
const STREAK_BONUS_POINTS = 15;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayString(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// @desc  Get today's check-in status (whether it's been done, and the current streak)
// @route GET /api/checkin/today
const getTodayCheckin = async (req, res) => {
  try {
    const date = todayString();
    const checkin = await DailyCheckin.findOne({ user: req.user._id, date });

    res.json({
      date,
      completed: !!checkin,
      checkin: checkin || null,
      checkinStreak: req.user.checkinStreak,
      points: req.user.points,
      walletConnected: !!req.user.walletAddress,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load today's check-in", error: err.message });
  }
};

// @desc  Get the exact message the connected wallet must sign to check in today.
//        Deterministic per user + date so it can't be replayed on another day/account.
// @route GET /api/checkin/challenge
const getCheckinChallenge = async (req, res) => {
  if (!req.user.walletAddress) {
    return res.status(400).json({ message: "Connect your Stacks wallet in your profile before checking in." });
  }
  const date = todayString();
  const message = buildCheckinChallenge(req.user._id.toString(), date);
  res.json({ date, message, walletAddress: req.user.walletAddress });
};

// @desc  Submit today's check-in. Requires a valid Stacks wallet signature over
//        today's challenge message, signed by the wallet already linked on the
//        user's profile — turning check-in into a wallet-verified action rather
//        than a plain button click. One per day; awards points and extends streak.
// @route POST /api/checkin/today
const submitTodayCheckin = async (req, res) => {
  try {
    const { mood, note, signature, publicKey } = req.body;
    const validMoods = ["great", "good", "okay", "low", "struggling"];
    if (!validMoods.includes(mood)) {
      return res.status(400).json({ message: `mood must be one of: ${validMoods.join(", ")}` });
    }

    const user = req.user;
    if (!user.walletAddress) {
      return res.status(400).json({ message: "Connect your Stacks wallet in your profile before checking in." });
    }

    const date = todayString();
    const existing = await DailyCheckin.findOne({ user: user._id, date });
    if (existing) {
      return res.status(409).json({ message: "You've already checked in today" });
    }

    const message = buildCheckinChallenge(user._id.toString(), date);
    const verification = verifyCheckinSignature({
      message,
      signature,
      publicKey,
      expectedWalletAddress: user.walletAddress,
    });

    if (!verification.valid) {
      return res.status(401).json({ message: `Wallet signature check failed: ${verification.reason}` });
    }

    const wasConsecutive = user.lastCheckinDate === yesterdayString(date);
    user.checkinStreak = wasConsecutive ? user.checkinStreak + 1 : 1;
    user.lastCheckinDate = date;

    let pointsAwarded = POINTS_PER_CHECKIN;
    const streakBonusEarned = user.checkinStreak > 0 && user.checkinStreak % STREAK_BONUS_EVERY === 0;
    if (streakBonusEarned) pointsAwarded += STREAK_BONUS_POINTS;

    user.points += pointsAwarded;
    await user.save();

    const checkin = await DailyCheckin.create({
      user: user._id,
      date,
      mood,
      note: note || "",
      pointsAwarded,
      streakAtCheckin: user.checkinStreak,
      walletAddress: user.walletAddress,
      signature,
    });

    res.json({
      checkin,
      pointsAwarded,
      streakBonusEarned,
      checkinStreak: user.checkinStreak,
      totalPoints: user.points,
    });
  } catch (err) {
    res.status(400).json({ message: "Failed to submit check-in", error: err.message });
  }
};

// @desc  List recent check-ins (for a history view / mood trend)
// @route GET /api/checkin?days=14
const getHistory = async (req, res) => {
  const days = Math.min(Number(req.query.days) || 14, 90);
  const entries = await DailyCheckin.find({ user: req.user._id }).sort({ date: -1 }).limit(days);
  res.json({ entries: entries.reverse() });
};

module.exports = {
  getTodayCheckin: asyncHandler(getTodayCheckin),
  getCheckinChallenge: asyncHandler(getCheckinChallenge),
  submitTodayCheckin: asyncHandler(submitTodayCheckin),
  getHistory: asyncHandler(getHistory),
};
