require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const mongoose = require("mongoose");

// checkin/quiz/reminders/steps/tips/assistant still run on Mongoose models
// that have nothing to connect to anymore (Mongo was removed in config/db.js).
// Disabling buffering makes those queries fail immediately instead of
// waiting up to 10s to time out; asyncHandler (see utils/asyncHandler.js)
// turns that immediate failure into a clean response instead of a hang.
// Remove both once every route is migrated off Mongoose.
mongoose.set("bufferCommands", false);
process.on("unhandledRejection", (err) => {
  console.error("[unhandled rejection]", err.message);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaught exception]", err.message);
});

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const tipRoutes = require("./routes/tipRoutes");
const assistantRoutes = require("./routes/assistantRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const stepRoutes = require("./routes/stepRoutes");
const quizRoutes = require("./routes/quizRoutes");
const checkinRoutes = require("./routes/checkinRoutes");

const app = express();

// ---- Core middleware ----
app.use(
  helmet({
    crossOriginResourcePolicy: false, // allow serving /uploads images cross-origin
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // The dark/light theme-detector script injected into index.html's <head>
        // is a genuine inline script (it must run before React mounts, to avoid
        // a flash of the wrong theme), so it needs 'unsafe-inline' here — helmet's
        // default script-src ('self' only) was silently blocking it.
        "script-src": ["'self'", "'unsafe-inline'"],
      },
    },
  })
);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*", credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Basic rate limiting to slow brute force / abuse
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use("/api", apiLimiter);

// Serve uploaded files (profile pictures only — health record uploads were removed)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---- Frontend serving ----
// Serves the frontend itself from this same server, so both frontend and
// backend share one origin, one port, and (when tunneled) one ngrok URL —
// this avoids CORS and mixed-content issues entirely, and means only one
// tunnel is ever needed for testing on a phone.
//
// Default: the built React app at frontend-react/dist (run `npm run build`
// in frontend-react/ first — this folder doesn't exist until you do).
// To fall back to the old no-build frontend/ instead (e.g. while the React
// app is still being worked on, or to quickly revert), set FRONTEND=legacy
// in backend/.env and restart the server. No code changes needed either way.
const USE_LEGACY_FRONTEND = process.env.FRONTEND === "legacy";
const reactBuildPath = path.join(__dirname, "..", "frontend-react", "dist");
const legacyFrontendPath = path.join(__dirname, "..", "frontend");
const frontendPath = USE_LEGACY_FRONTEND ? legacyFrontendPath : reactBuildPath;

app.use(express.static(frontendPath));

// ---- Routes ----
app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "blessmed-api" }));
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/tips", tipRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/steps", stepRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/checkin", checkinRoutes);

// ---- 404 handler (API only) ----
app.use("/api", (_req, res) => res.status(404).json({ message: "Route not found" }));

// ---- Client-side routing catch-all ----
// Anything that isn't an API call, an uploaded file, or a real static asset
// (JS/CSS/images from the build) falls through to index.html so React
// Router can handle routes like /dashboard directly — e.g. a hard refresh
// or a bookmarked link — instead of a raw 404 from Express.
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"), (err) => {
    if (err) {
      res
        .status(500)
        .send(
          "Frontend build not found. Run `npm run build` in frontend-react/ (or set FRONTEND=legacy in backend/.env to use the old frontend/ folder)."
        );
    }
  });
});

// ---- Global error handler ----
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`[server] BlessMed API running on port ${PORT}`));
});
