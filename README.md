# BlessMed — MVP

**Your Health. Your Data. Your Future.**
Secure · Decentralized · Empowering · Rewarding

A personal health companion app: signup/login, a health profile, an emergency QR code for first responders, a health tips feed, an AI health assistant, medication reminders, automatic step tracking with milestones, and a daily health-literacy quiz — with points from steps and quizzes accruing toward a future **BMed token**. Built as a real MVP — small enough to ship this week, structured so it doesn't fall over when you add Google Fit sync and the Stacks/BMed token layer later.

> **Note on health record uploads:** an earlier version of this MVP let users upload prescriptions, lab results, and vaccination cards as files. That feature was removed — storing sensitive medical documents in a young MVP, without the security hardening (encryption at rest, audit logging, proper access controls, a real data-retention policy) that real medical records deserve, wasn't something to ship carelessly. If document storage comes back later, it should be built with that bar in mind from day one, not bolted on.

---

## 1. Architecture

```
┌─────────────────┐        HTTPS/JSON        ┌──────────────────┐        ┌─────────────┐
│   Frontend       │ ───────────────────────► │   Express API     │ ─────► │  MongoDB     │
│  (HTML/CSS/JS,    │ ◄─────────────────────── │  (Node.js)         │ ◄───── │  (Mongoose)  │
│   no build step)  │      JWT in header       │                     │        └─────────────┘
└─────────────────┘                           │  - auth (JWT)       │
                                                │  - REST resources   │        ┌─────────────┐
                                                │  - QR generation    │        │ /uploads     │
                                                │  - Anthropic API ───┼───────►│ (profile     │
                                                └──────────────────┘        │  pictures)    │
                                                                             └─────────────┘
```

**Why this shape:**
- **Stateless REST API + JWT** — the API doesn't hold session state, so it can be horizontally scaled behind a load balancer with zero sticky-session concerns.
- **No frontend build step** — matches the decision to ship fast; every page is plain HTML/CSS/JS talking to the API over `fetch()`. Swapping in React/Vite later only touches `frontend/`, not the API.
- **MongoDB / Mongoose** — the health profile and daily entities (step days, quiz days, reminders) are naturally document-shaped and evolve often. New fields (`stepStreak`, `points`, `dailyStepGoal`) were added without migrations. Mongoose gives schema validation without losing that flexibility.
- **File storage abstracted behind `/uploads` static route** — now used only for profile pictures. Swapping local disk for S3/Cloudinary later is a one-file change (`middleware/upload.js`).
- **Emergency QR is a public, unauthenticated read of a narrow field set** — deliberately decoupled from the authenticated profile, so first responders never need a login, and the exposed data is minimal by design (blood group, genotype, allergies, conditions, emergency contact only — never email or password).
- **AI features isolated behind service modules** (`anthropicService.js`, `googleFitService.js`, `stacksService.js`) — the controller layer never talks to a third-party API directly, so swapping providers or adding retries/caching later touches one file each.

**Scaling path (not built yet, but the architecture doesn't block it):**
- Add Redis for rate-limiting/session caching once you're running >1 API instance.
- Move `/uploads` to S3 + CloudFront for profile pictures.
- The Stacks wallet field, `points`, `stepStreak`, and `stepMilestonesReached` are already on the `User` model — ready for the BMed token layer without a schema migration.
- Google Fit sync has a dedicated stub (`googleFitService.js`) and a live route already pointed at it — implementing OAuth + the Fit API call is additive, nothing else in the step-tracking logic needs to change.

---

## 2. File structure

```
blessmed/
├── backend/
│   ├── config/
│   │   └── db.js                    # Mongoose connection
│   ├── controllers/
│   │   ├── authController.js        # signup, login, me
│   │   ├── profileController.js     # health profile, picture, QR, wallet
│   │   ├── tipController.js         # health tips feed
│   │   ├── assistantController.js   # AI chat
│   │   ├── reminderController.js    # medication reminders CRUD
│   │   ├── stepController.js        # step tracking, streaks, milestones
│   │   └── quizController.js        # daily health quiz
│   ├── middleware/
│   │   ├── auth.js                  # JWT verification (protect)
│   │   └── upload.js                # multer disk storage (profile pictures)
│   ├── models/
│   │   ├── User.js
│   │   ├── HealthTip.js
│   │   ├── ChatMessage.js
│   │   ├── MedicationReminder.js
│   │   ├── StepEntry.js
│   │   └── DailyQuiz.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── profileRoutes.js
│   │   ├── tipRoutes.js
│   │   ├── assistantRoutes.js
│   │   ├── reminderRoutes.js
│   │   ├── stepRoutes.js
│   │   └── quizRoutes.js
│   ├── services/
│   │   ├── anthropicService.js      # Claude API: chat + quiz generation
│   │   ├── stacksService.js         # Stacks testnet balance reads
│   │   └── googleFitService.js      # stub — wiring point for Google Fit
│   ├── utils/
│   │   ├── generateToken.js
│   │   └── seedTips.js              # seeds sample health tips
│   ├── uploads/                     # profile pictures (gitignored in real repo)
│   ├── .env.example
│   ├── package.json
│   └── server.js                    # app entrypoint
│
└── frontend/
    ├── index.html                   # landing page
    ├── login.html
    ├── signup.html
    ├── dashboard.html               # profile + steps + quiz snapshot + tips
    ├── profile.html                 # edit health profile, avatar, QR, wallet
    ├── reminders.html               # medication reminders
    ├── steps.html                   # step tracking, streaks, milestones
    ├── quiz.html                    # daily 5-question health quiz
    ├── assistant.html               # AI chat
    ├── emergency.html               # PUBLIC page shown when QR is scanned
    ├── css/style.css
    └── js/
        ├── api.js                   # fetch wrapper, token storage, auth guard
        ├── auth.js                  # login/signup handlers
        ├── dashboard.js
        ├── profile.js
        ├── stacks.js                # ES module — Stacks wallet connect
        ├── reminders.js
        ├── notify.js                # reminder notification scheduler (all pages)
        ├── steps.js                 # automatic accelerometer pedometer
        ├── steps-page.js            # steps.html UI logic
        ├── quiz.js
        └── assistant.js
```

---

## 3. Database schema

### `users`
| Field | Type | Notes |
|---|---|---|
| name | String | required |
| email | String | required, unique, lowercase |
| password | String | required, bcrypt-hashed, `select: false` |
| walletAddress | String | optional — Stacks wallet |
| age | Number | |
| bloodGroup | Enum | A+, A-, B+, B-, AB+, AB-, O+, O-, Unknown |
| genotype | Enum | AA, AS, SS, AC, SC, Unknown |
| allergies | [String] | |
| medicalConditions | [String] | |
| emergencyContact | {name, phone, relationship} | subdocument |
| profilePicture | String | path under `/uploads` |
| points | Number | accrues from step goals, milestones, and quizzes — the basis for the future BMed token balance |
| stepStreak | Number | consecutive days the daily step goal was met |
| dailyStepGoal | Number | default 5000 |
| lastGoalMetDate | String | "YYYY-MM-DD" — guards against double-crediting a streak day |
| totalStepsLifetime | Number | running lifetime total, drives milestone unlocks |
| stepMilestonesReached | [Number] | thresholds already credited, so re-syncing never double-awards |
| qrCodeId | String | unique, random — used in public emergency URL |
| timestamps | createdAt, updatedAt | auto |

### `healthtips`
| Field | Type | Notes |
|---|---|---|
| category | Enum | nutrition, exercise, mental_wellness |
| title | String | |
| content | String | |
| imageUrl | String | optional |

### `chatmessages`
| Field | Type | Notes |
|---|---|---|
| user | ObjectId → User | indexed |
| role | Enum | user, assistant |
| content | String | |
| timestamps | createdAt, updatedAt | auto |

### `medicationreminders`
| Field | Type | Notes |
|---|---|---|
| user | ObjectId → User | indexed |
| medicationName | String | required |
| dosage | String | optional |
| times | [String] | required, one or more `HH:mm` values |
| daysOfWeek | [Number] | 0(Sun)–6(Sat); empty = every day |
| notes | String | |
| active | Boolean | default true (pause without deleting) |

### `stepentries`
| Field | Type | Notes |
|---|---|---|
| user | ObjectId → User | |
| date | String | "YYYY-MM-DD" |
| steps | Number | that day's total |
| source | Enum | sensor, manual, google_fit |

**Unique index:** `user + date` — one entry per user per day.

### `dailyquizzes`
| Field | Type | Notes |
|---|---|---|
| user | ObjectId → User | |
| date | String | "YYYY-MM-DD" |
| questions | [{question, options[4], correctIndex, explanation}] | AI-generated, exactly 5 |
| answers | [Number] | selected option index per question, null until submitted |
| score | Number | out of 5, null until submitted |
| pointsAwarded | Number | 5/correct answer + 10 bonus for a perfect score |
| completed | Boolean | |

**Unique index:** `user + date` — one quiz per user per day.

---

## 4. API endpoints

Base URL: `http://localhost:5000/api`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Liveness check |
| POST | `/auth/signup` | — | Create account → `{ user, token }` |
| POST | `/auth/login` | — | Login → `{ user, token }` |
| GET | `/auth/me` | ✅ | Current user |
| GET | `/profile` | ✅ | Get own health profile |
| PUT | `/profile` | ✅ | Update health profile fields |
| PUT | `/profile/picture` | ✅ | Upload profile picture (`multipart/form-data`, field `picture`) |
| GET | `/profile/qr` | ✅ | Get emergency QR code as data URL |
| GET | `/profile/emergency/:qrCodeId` | — (public) | Emergency info lookup for first responders |
| PUT | `/profile/wallet` | ✅ | Connect/update Stacks wallet address (`{ walletAddress }`) |
| DELETE | `/profile/wallet` | ✅ | Disconnect wallet |
| GET | `/profile/wallet/balance` | ✅ | Testnet STX balance for the connected wallet |
| GET | `/tips` | — | List health tips (`?category=` optional filter) |
| GET | `/assistant/history` | ✅ | Last 20 chat messages for the user |
| POST | `/assistant/chat` | ✅ | Send a message, get an AI reply (rate-limited: 15/min) |
| DELETE | `/assistant/history` | ✅ | Clear chat history |
| GET | `/reminders` | ✅ | List reminders (`?active=true/false` optional filter) |
| POST | `/reminders` | ✅ | Create a reminder (`medicationName, dosage, times[], daysOfWeek[], notes`) |
| PUT | `/reminders/:id` | ✅ | Update/pause/resume a reminder |
| DELETE | `/reminders/:id` | ✅ | Delete a reminder |
| GET | `/steps/summary` | ✅ | Today's steps, goal, streak, points, weekly total, milestones |
| GET | `/steps?days=7` | ✅ | Raw daily step history |
| PUT | `/steps/today` | ✅ | Upsert today's step count (`{ steps, source }`) — also runs streak/milestone logic |
| PUT | `/steps/goal` | ✅ | Update daily step goal |
| POST | `/steps/google-fit/sync` | ✅ | Placeholder — returns 501 until Google Fit OAuth is wired up |
| GET | `/quiz/today` | ✅ | Get (or AI-generate) today's quiz — answers hidden until submitted |
| POST | `/quiz/today/submit` | ✅ | Submit answers, get score/points/explanations |
| GET | `/checkin/today` | ✅ | Today's check-in status, current streak |
| POST | `/checkin/today` | ✅ | Submit today's check-in (`{ mood, note }`) — one per day, awards points + streak |
| GET | `/checkin?days=14` | ✅ | Recent check-in history (mood trend) |

Auth uses `Authorization: Bearer <token>`. All list/detail routes are scoped to `req.user._id` — a user can never read or modify another user's data.

---

## 5. UI architecture

Plain multi-page app (MPA) — no bundler, no framework. Each `.html` page loads `js/api.js` first (shared fetch client + `Auth` token helper), then a page-specific script.

- **`api.js`** — single source of truth for API calls: attaches JWT, parses JSON, normalizes errors, and exposes `Auth` (get/set token & cached user in `localStorage`) plus `requireAuth()` used as a guard at the top of every protected page's script.
- **Pages are dumb** — each page's JS only does: guard → fetch data → render into the DOM. No client-side routing, no state management library — deliberately, since an MPA doesn't need one at MVP scale.
- **`dashboard.html`** is the hub: profile snapshot, today's steps, today's check-in status, today's quiz status, health tips. Also loads `js/popups.js`, which nudges the user toward check-in/quiz if either is still outstanding for the day (see below).
- **`profile.html`** edits the health profile, uploads the avatar, displays the emergency QR code, and manages the Stacks wallet connection.
- **`steps.html`** starts/stops automatic tracking, shows progress toward the daily goal, streak, points, milestone badges, and 7-day history.
- **`checkin.html`** a lightweight daily mood check-in (one tap + optional note), shows the current streak, awards points.
- **`quiz.html`** renders today's 5 questions, submits answers, and reveals correct answers + explanations after submission.
- **`reminders.html`** and **`assistant.html`** are CRUD/chat screens respectively.
- **`emergency.html`** is intentionally outside the authenticated app shell (no nav login state) since it's meant to be opened by a stranger scanning a QR code on someone else's phone.

This structure maps 1:1 onto a future React rewrite: each `js/*.js` file becomes a component/hook, `api.js` becomes an API client module — nothing here is throwaway.

---

## 6. Running it locally

**Prereqs:** Node 18+, MongoDB running locally (or an Atlas URI).

```bash
# 1. Backend
cd backend
cp .env.example .env       # then edit JWT_SECRET, MONGO_URI, ANTHROPIC_API_KEY
npm install
npm run seed                # optional: seeds sample health tips
npm run dev                 # starts API on http://localhost:5000

# 2. Frontend (separate terminal) — any static server works
cd frontend
npx serve -l 3000           # or: python3 -m http.server 3000
# open http://localhost:3000
```

Set `CLIENT_ORIGIN` in `.env` to match wherever you serve the frontend (used for CORS and for building the emergency QR URL). `ANTHROPIC_API_KEY` is required for both the AI assistant and the daily quiz generator — without it, both return a clear 503 instead of failing silently.

---

## 7. Feature notes

### Stacks wallet connect
- **Frontend** (`js/stacks.js`, ES module) uses `@stacks/connect` (loaded from esm.sh, no bundler needed) to open the Leather/Xverse wallet picker and retrieve a **testnet** STX address, then saves it via the API.
- **Backend** (`services/stacksService.js`) is a thin, isolated read layer around Hiro's testnet API — swapping to mainnet or a different indexer only touches this one file.
- `PUT /api/profile/wallet` validates the address shape and rejects wallets already linked to another account.
- Requires a Stacks wallet browser extension installed to test.

### AI health assistant
- **Backend** (`services/anthropicService.js`) calls the Anthropic Messages API directly (`fetch`, no SDK dependency) and builds a system prompt from the user's health profile so answers are personalized — while explicitly instructing the model it is not a doctor and must defer urgent/diagnostic questions to a clinician.
- **Persistence**: `ChatMessage` stores the conversation per user; only the most recent 20 messages are sent back to Claude as context per request.
- **Rate limiting**: `/api/assistant/chat` has its own stricter limiter (15 requests/min) separate from the general API limiter, since each call has a real cost.

### Medication reminders
- A `MedicationReminder` model (name, dosage, one or more `HH:mm` times, optional days-of-week, active/paused flag) with standard CRUD.
- **Frontend scheduling** (`js/notify.js`, loaded on every authenticated page): polls every 30 seconds and fires a browser `Notification` (falling back to an in-app banner) when the current time matches a reminder.
- **Known limitation**: only fires while a BlessMed tab is open — no service worker/push subscription yet. The model/API are already shaped so a real push backend can be swapped in later without a schema change.

### Automatic step counter + milestones
- **Automatic tracking**: `js/steps.js` runs a real accelerometer-based pedometer (peak detection on `devicemotion` events) — no manual step entry needed. Requests motion-sensor permission (required on iOS), counts steps locally, and syncs the running total every 15 seconds.
- **Streaks**: hitting the daily goal for the first time in a day increments `stepStreak` only if yesterday's goal was also met (otherwise it resets to 1) — guarded by `lastGoalMetDate` so re-syncing the same day never double-counts.
- **Lifetime milestones**: `totalStepsLifetime` grows with every synced step, and crossing a threshold (10k, 50k, 100k, 250k, 500k, 1M, 2.5M, 5M steps) awards a one-time bonus (20-5000 points, guarded by `stepMilestonesReached` so it's never double-awarded). Shown as badges on `steps.html`.
- **Google Fit — the wiring point, not yet connected**: `services/googleFitService.js` is a documented stub with a `syncStepsFromGoogleFit()` function that currently throws a clear "not connected yet" error, plus a live `POST /api/steps/google-fit/sync` route already pointed at it. When ready: add Google OAuth2, store the token on `User`, and implement that one function to pull steps and upsert into `StepEntry` with `source: "google_fit"` — the streak/milestone logic doesn't change, since it already treats every `source` identically.

### Daily health quiz
- **Generation**: `generateDailyQuiz()` in `anthropicService.js` asks Claude for exactly 5 multiple-choice, general health-literacy questions as strict JSON, loosely informed by the user's profile facts but explicitly instructed never to be diagnostic. The response is parsed and shape-validated before it's ever saved or shown.
- **One per day**: `DailyQuiz` is unique-indexed on `user + date`, generated on first visit to `quiz.html` (or the dashboard fetching quiz status) and cached for the rest of the day — it doesn't regenerate on every request.
- **Scoring**: 5 points per correct answer, +10 bonus for a perfect 5/5, added to `User.points`. Correct answers and explanations are only sent to the client after submission, never before.

### Daily check-in
- A single mood tap (great/good/okay/low/struggling) + optional 280-char note, one per day (`DailyCheckin` unique-indexed on `user + date`).
- **Streak logic mirrors steps**: `checkinStreak` increments only if yesterday was also checked in (guarded by `lastCheckinDate`), otherwise resets to 1 — same pattern as `stepStreak`/`lastGoalMetDate`.
- **Scoring**: 5 points per check-in, +15 bonus every 7th consecutive day, added to `User.points`.
- Not a mental-health diagnostic tool or a replacement for professional support — it's an engagement/rewards feature, and is worded that way in the UI.

### Daily engagement popups
- `js/popups.js` (loaded on `dashboard.html`) checks `/checkin/today` and `/quiz/today` on load and queues a modal for whichever is still incomplete, check-in first, then quiz.
- Each popup shows the reward, a "Check in / Take the quiz now" button (navigates to the page), and "Maybe later" (dismisses — tracked in `localStorage` per day, so it won't reappear until tomorrow, but doesn't block a manual visit to `checkin.html`/`quiz.html`).
- Pure frontend, no new backend needed beyond the check-in endpoints — it just calls existing/-new `today` endpoints and reads `.completed`.

### Points → BMed token (not built yet)
`points` is the shared currency across steps, milestones, and quizzes — it's deliberately one field on `User` rather than separate counters per feature, so it's ready to become a redeemable/on-chain BMed token balance later without restructuring how points are earned. The wallet connect (above) is the natural foundation for that: once `walletAddress` is populated, a future `services/tokenService.js` could mint/transfer BMed tokens on Stacks based on `points`, the same way `stacksService.js` already reads balances today.
