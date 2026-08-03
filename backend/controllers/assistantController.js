const ChatMessage = require("../models/ChatMessage");
const asyncHandler = require("../utils/asyncHandler");
const { getAssistantReply } = require("../services/anthropicService");

const HISTORY_LIMIT = 20; // number of past messages kept for context

// Set ASSISTANT_ENABLED=false in backend/.env to turn the AI assistant off
// without touching code — e.g. while there's no Anthropic API credit. Every
// call below short-circuits before ever reaching getAssistantReply(), so it
// costs nothing and never hits the API.
const ASSISTANT_ENABLED = process.env.ASSISTANT_ENABLED !== "false";

// @desc  Get recent chat history for the logged-in user
// @route GET /api/assistant/history
const getHistory = async (req, res) => {
  if (!ASSISTANT_ENABLED) return res.json({ messages: [], disabled: true });

  const messages = await ChatMessage.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(HISTORY_LIMIT);
  res.json({ messages: messages.reverse() });
};

// @desc  Send a message to the AI health assistant and get a reply
// @route POST /api/assistant/chat
const sendMessage = async (req, res) => {
  if (!ASSISTANT_ENABLED) {
    return res.status(503).json({ message: "The AI assistant is currently unavailable.", disabled: true });
  }

  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: "message is required" });
    }

    const userMsg = await ChatMessage.create({
      user: req.user._id,
      role: "user",
      content: message.trim(),
    });

    const priorMessages = await ChatMessage.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT);
    const history = priorMessages.reverse().map((m) => ({ role: m.role, content: m.content }));

    const replyText = await getAssistantReply(req.user, history);

    const assistantMsg = await ChatMessage.create({
      user: req.user._id,
      role: "assistant",
      content: replyText,
    });

    res.status(201).json({ userMessage: userMsg, assistantMessage: assistantMsg });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Assistant request failed" });
  }
};

// @desc  Clear chat history
// @route DELETE /api/assistant/history
const clearHistory = async (req, res) => {
  await ChatMessage.deleteMany({ user: req.user._id });
  res.json({ message: "Chat history cleared" });
};

module.exports = {
  getHistory: asyncHandler(getHistory),
  sendMessage: asyncHandler(sendMessage),
  clearHistory: asyncHandler(clearHistory),
};
