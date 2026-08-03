# BlessMed — React frontend

A React + Vite port of the original `frontend/` (plain HTML/CSS/JS) app.
Same backend, same API, same visual design system — just built as a proper
component-based SPA with client-side routing instead of separate HTML pages.

**What ported over 1:1:**
- Every page: landing, login, signup, email verification, dashboard, steps
  (with real device-motion step tracking), medication reminders (with
  browser-notification scheduling), daily check-in (Stacks wallet
  signature flow), profile (incl. picture upload, QR code, wallet
  connect/disconnect), and the public emergency-info page.
- The daily check-in/quiz nudge popups.
- The same `design system (colors, type, components) from `frontend/css/style.css`.
- The mobile hamburger menu + bottom tab bar from the latest HTML redesign.

**What's new/different:**
- Client-side routing (react-router-dom) — page switches are instant, no
  full reloads.
- Auth state lives in a React context instead of being read from
  `localStorage` on every page load.
- The "coming soon" quiz/assistant pages are unchanged placeholders —
  wire up real UI there once those backend features ship.

## Setup

```bash
cd frontend-react
npm install
```

## Run in development

Make sure the backend is running first (from `backend/`, default port 5000):

```bash
# in backend/
npm start
```

Then, in a second terminal:

```bash
# in frontend-react/
npm run dev
```

Visit the URL Vite prints (usually `http://localhost:5173`). API calls to
`/api/...` and file requests to `/uploads/...` are proxied to the backend
automatically (see `vite.config.js`) — no CORS setup needed, and no need to
hardcode a backend URL anywhere in the app.

## Build for production

```bash
npm run build
```

This outputs static files to `frontend-react/dist`. To serve them from the
same Express server that serves the API (matching how the original
no-build frontend was served), change this line in `backend/server.js`:

```js
app.use(express.static(path.join(__dirname, "..", "frontend")));
```

to:

```js
app.use(express.static(path.join(__dirname, "..", "frontend-react", "dist")));
```

and add a catch-all so client-side routes (e.g. `/dashboard`, refreshed
directly) resolve to `index.html`:

```js
app.get(/^\/(?!api|uploads).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend-react", "dist", "index.html"));
});
```

(Add that *after* your API routes and the `express.static` line, so real
API/upload requests are still handled first.)

The original `frontend/` folder is left untouched, so you can keep using it
or switch the static-serving line back at any time.
