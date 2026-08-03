// Thin integration layer around the Anthropic API. Kept isolated so the
// model name, endpoint, or provider can change without touching the
// controller or route layer.

const ANTHROPIC_API_URL = process.env.ANTHROPIC_API_URL || "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

function buildProfileFacts(user) {
  const facts = [];
  if (user.age) facts.push(`Age: ${user.age}`);
  if (user.bloodGroup && user.bloodGroup !== "Unknown") facts.push(`Blood group: ${user.bloodGroup}`);
  if (user.genotype && user.genotype !== "Unknown") facts.push(`Genotype: ${user.genotype}`);
  if (user.allergies?.length) facts.push(`Allergies: ${user.allergies.join(", ")}`);
  if (user.medicalConditions?.length) facts.push(`Medical conditions: ${user.medicalConditions.join(", ")}`);
  return facts;
}

function buildSystemPrompt(user) {
  const facts = buildProfileFacts(user);
  return [
    "You are the BlessMed Health Assistant, a friendly, careful assistant inside a personal health app.",
    "You help the user understand general wellness, their step goals, medication reminders, and daily health quizzes —",
    "you are NOT a doctor and must never provide a diagnosis, prescribe treatment, or replace professional medical advice.",
    "Always recommend seeing a licensed clinician for anything that sounds urgent, severe, or diagnostic in nature.",
    "Keep answers concise and practical.",
    facts.length ? `Known health profile for this user (use only if relevant, never assume beyond this): ${facts.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

async function callClaude({ system, messages, maxTokens = 500 }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error("AI features are not configured (missing ANTHROPIC_API_KEY)");
    err.status = 503;
    throw err;
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("ANTHROPIC API ERROR BODY:", body);
    const err = new Error(`Anthropic API error: ${res.status}`);
    err.status = 502;
    err.detail = body;
    throw err;
  }

  const data = await res.json();
  const textBlock = data.content?.find((b) => b.type === "text");
  return textBlock?.text || "";
}

/**
 * Send a chat turn to Claude with the user's health profile as context.
 * @param {object} user - Mongoose User document (or plain object) for context
 * @param {Array<{role: 'user'|'assistant', content: string}>} history - prior turns, oldest first
 */
async function getAssistantReply(user, history) {
  const text = await callClaude({
    system: buildSystemPrompt(user),
    messages: history.map((m) => ({ role: m.role, content: m.content })),
    maxTokens: 500,
  });
  return text || "Sorry, I couldn't generate a response just now.";
}

/**
 * Generates 5 multiple-choice health-literacy questions tailored (loosely)
 * to the user's health profile — general wellness education, never
 * diagnostic or treatment advice. Returns a parsed, validated array.
 */
async function generateDailyQuiz(user) {
  const facts = buildProfileFacts(user);
  const system = [
    "You generate short health-literacy quizzes for a personal health app.",
    "Output ONLY valid JSON, no prose, no markdown fences, matching exactly this shape:",
    '{"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]}',
    "Requirements: exactly 5 questions, exactly 4 options each, correctIndex is 0-3, explanation is one short sentence.",
    "Cover general wellness, nutrition, exercise, or basic health literacy — never ask the user to diagnose a condition,",
    "and never write a question whose premise assumes the user has a specific disease.",
    facts.length
      ? `You may loosely tailor 1-2 questions toward relevant general knowledge for someone with: ${facts.join("; ")} — but keep them educational, not personal or diagnostic.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const raw = await callClaude({
    system,
    messages: [{ role: "user", content: "Generate today's 5-question health quiz as JSON." }],
    maxTokens: 1200,
  });

  let parsed;
  try {
    const cleaned = raw.trim().replace(/^```json\s*|\s*```$/g, "");
    parsed = JSON.parse(cleaned);
  } catch {
    const err = new Error("Failed to parse quiz response from the AI");
    err.status = 502;
    throw err;
  }

  const questions = parsed?.questions;
  const valid =
    Array.isArray(questions) &&
    questions.length === 5 &&
    questions.every(
      (q) =>
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex <= 3
    );

  if (!valid) {
    const err = new Error("AI returned an invalid quiz format");
    err.status = 502;
    throw err;
  }

  return questions.map((q) => ({
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation || "",
  }));
}

module.exports = { getAssistantReply, generateDailyQuiz };
