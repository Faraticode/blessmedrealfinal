# BlessMed — verification checklist

I could not run `npm install`, start either server, or open a browser in the
environment I worked in (no network access — `npm install` returns 403 from
the registry). Everything below was fixed/built via static code review, not
by running it. **You need to run through this checklist yourself before
trusting it in production.** It should take 15–20 minutes, not hours — the
scaffold was already in good shape.

## 1. Install & run

```bash
# terminal 1
cd backend
npm install
cp .env.example .env   # if you have one; otherwise create .env — see below
npm run dev             # nodemon server.js, default port 5000

# terminal 2
cd frontend-react
npm install
npm run dev              # vite, default port 5173
```

`backend/.env` needs at minimum:
```
MONGODB_URI=...
JWT_SECRET=...
ANTHROPIC_API_KEY=...   # only needed for Quiz + Assistant to work
```
(check `backend/config/db.js` and `backend/services/anthropicService.js` if
you're unsure of exact var names — I didn't change either.)

Visit `http://localhost:5173`. Open the browser Network tab and confirm a
call like `GET /api/tips` shows as `200` and is actually reaching
`localhost:5000` (the Vite proxy in `vite.config.js` handles this — nothing
to configure).

## 2. Click through every page

Landing → Signup → Verify (check your email/console for the OTP depending on
your mail config) → Dashboard → Steps → Reminders → Checkin → Quiz →
Assistant → Profile → Emergency (open `/emergency?id=<qrCodeId>` from your
own profile's QR code) → log out → Login.

Specifically check:
- **Quiz** (new): loads 5 questions, blocks submit until all answered,
  shows scored results with explanations, and — the next day (or after
  manually deleting the `DailyQuiz` doc in Mongo) — generates a fresh quiz.
- **Assistant** (new): loads history (empty state message on first visit),
  send a message, see the "Thinking..." bubble, get a real reply, clear
  history with confirmation.
- **404**: visit a nonsense path like `/this-does-not-exist` — should show
  the new 404 page, not a blank screen or raw Express error.

## 3. Mobile / hardware-dependent features (needs a real phone)

- **Steps**: open `/steps` on a phone over HTTPS (motion sensors require a
  secure context on iOS Safari — use ngrok or ngrok.yml if testing over
  LAN with HTTP won't work on iOS). Tap "Start automatic tracking", grant
  the motion permission prompt (iOS only), walk around, confirm the step
  count climbs and syncs to the server every ~15s.
- **Stacks wallet (Checkin/Profile)**: needs the Leather extension
  installed (desktop) — `lib/stacks.js` talks to `window.LeatherProvider`
  directly, not `@stacks/connect`, so there's no mobile deep-link path yet.
  On desktop: Connect wallet → approve in Leather → check-in → sign the
  challenge message in the Leather popup → confirm streak/points update.
  I could not test this at all — no browser, no extension, no wallet.

## 4. Production build

```bash
cd frontend-react
npm run build              # outputs to frontend-react/dist
```

Then, from `backend/`:
```bash
npm start                  # server.js now serves frontend-react/dist by default
```
Visit `http://localhost:5000` directly (no Vite this time) and re-run step 2
against the built app. Refresh while on `/dashboard` — it should reload the
dashboard, not 404 (this is the new catch-all route in `server.js`).

To fall back to the old vanilla frontend instead, set `FRONTEND=legacy` in
`backend/.env` and restart — no code changes needed.

## What changed (full diff summary)

- **`frontend-react/src/pages/Quiz.jsx`** — real implementation, was a
  "coming soon" placeholder.
- **`frontend-react/src/pages/Assistant.jsx`** — real implementation, was a
  "coming soon" placeholder.
- **`frontend-react/src/pages/NotFound.jsx`** — new, wired up as the `*`
  route in `App.jsx`.
- **`frontend-react/src/components/ErrorBoundary.jsx`** — new, wraps `<App/>`
  in `main.jsx`.
- **`frontend-react/public/favicon.svg`** + `index.html` — new favicon.
- **`frontend/*.html`** — favicon link added to all 12 pages (didn't have
  one before either); `frontend/assets/favicon.svg` added.
- **`backend/server.js`** — serves `frontend-react/dist` by default now
  (was `frontend/`), with `FRONTEND=legacy` env toggle to revert instantly,
  plus a SPA catch-all so client-side routes survive a hard refresh.

## What I deliberately did NOT change

Every other page (Landing, Login, Signup, Verify, Dashboard, Steps,
Reminders, Checkin, Profile, Emergency) and every backend route/controller
I read already matched up correctly — no typos, no missing props, no
mismatched API paths. I didn't "fix" things that weren't broken.

## Bottom nav decision (Quiz/Assistant)

I left `BottomNav.jsx` as its current 5 items (Home, Steps, Meds, Check-in,
Profile) rather than adding Quiz/Assistant. Reasoning: 5 is close to the
practical ceiling for thumb-reachable bottom nav items before they get
cramped, and both features are already one tap away — from the top navbar
(via the hamburger menu on mobile) and from dedicated cards on the
Dashboard, which is also where the daily popups nudge people toward them.
If you'd rather they get bottom-nav-level prominence, the change is a
one-line addition to the `TABS` array in `BottomNav.jsx` — happy to make
that call differently if you disagree.
