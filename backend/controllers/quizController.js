const DailyQuiz = require("../models/DailyQuiz");
const asyncHandler = require("../utils/asyncHandler");
const { generateDailyQuiz } = require("../services/anthropicService");

const POINTS_PER_CORRECT = 5;
const PERFECT_SCORE_BONUS = 10;

// Set QUIZ_ENABLED=false in backend/.env to turn the quiz off without
// touching code — e.g. while there's no Anthropic API credit. Every call
// below short-circuits before ever reaching generateDailyQuiz(), so it
// costs nothing and never hits the API.
const QUIZ_ENABLED = process.env.QUIZ_ENABLED !== "false";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function disabledQuizResponse() {
  return { date: todayString(), completed: false, score: 0, pointsAwarded: 0, questions: [], answers: [], disabled: true };
}

function toPublicQuiz(quiz) {
  // Never send correctIndex/explanation before the quiz is submitted.
  return {
    date: quiz.date,
    completed: quiz.completed,
    score: quiz.score,
    pointsAwarded: quiz.pointsAwarded,
    questions: quiz.questions.map((q) =>
      quiz.completed
        ? q
        : { question: q.question, options: q.options }
    ),
    answers: quiz.answers,
  };
}

// @desc  Get (or generate) today's quiz
// @route GET /api/quiz/today
const getTodayQuiz = async (req, res) => {
  if (!QUIZ_ENABLED) return res.json(disabledQuizResponse());

  try {
    const date = todayString();
    let quiz = await DailyQuiz.findOne({ user: req.user._id, date });

    if (!quiz) {
      const questions = await generateDailyQuiz(req.user);
      quiz = await DailyQuiz.create({ user: req.user._id, date, questions });
    }

    res.json(toPublicQuiz(quiz));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to load today's quiz" });
  }
};

// @desc  Submit answers for today's quiz
// @route POST /api/quiz/today/submit
const submitTodayQuiz = async (req, res) => {
  try {
    const { answers } = req.body;
    const date = todayString();
    const quiz = await DailyQuiz.findOne({ user: req.user._id, date });

    if (!quiz) return res.status(404).json({ message: "No quiz found for today" });
    if (quiz.completed) return res.status(409).json({ message: "Today's quiz was already submitted" });
    if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
      return res.status(400).json({ message: `answers must be an array of ${quiz.questions.length} indices` });
    }

    const score = quiz.questions.reduce(
      (count, q, i) => count + (answers[i] === q.correctIndex ? 1 : 0),
      0
    );
    const pointsAwarded = score * POINTS_PER_CORRECT + (score === quiz.questions.length ? PERFECT_SCORE_BONUS : 0);

    quiz.answers = answers;
    quiz.score = score;
    quiz.pointsAwarded = pointsAwarded;
    quiz.completed = true;
    await quiz.save();

    req.user.points += pointsAwarded;
    await req.user.save();

    res.json({ ...toPublicQuiz(quiz), totalPoints: req.user.points });
  } catch (err) {
    res.status(400).json({ message: "Failed to submit quiz", error: err.message });
  }
};

module.exports = {
  getTodayQuiz: asyncHandler(getTodayQuiz),
  submitTodayQuiz: asyncHandler(submitTodayQuiz),
};
