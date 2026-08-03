# Deploying to Render via GitHub

This app is a **single deployable service**: `backend/server.js` already
serves the built React app itself (see the `express.static` + catch-all
route around line 75 of `server.js`), and the frontend calls the API on
relative `/api/...` paths. So this is one Render Web Service, not two —
no CORS/proxy setup needed.

## 1. Push to GitHub

```bash
cd blessmedrealfinal
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

The included `.gitignore` already keeps `node_modules/`, `.env`, and the
frontend `dist/` build out of the repo — don't remove those exclusions,
and don't commit your real `backend/.env`.

## 2. Create the Render service

**Option A — Blueprint (recommended):** the repo includes `render.yaml`.
In Render, click **New > Blueprint**, connect the GitHub repo, and Render
reads `render.yaml` and sets up the service and env var slots for you.
You'll still need to fill in the actual values for anything marked
`sync: false` (see step 3).

**Option B — Manual:** **New > Web Service**, connect the repo, then set:
- **Root Directory:** leave blank (repo root)
- **Build Command:**
  ```
  npm install --prefix frontend-react && npm run build --prefix frontend-react && npm install --prefix backend
  ```
- **Start Command:**
  ```
  npm start --prefix backend
  ```
- **Runtime:** Node

## 3. Environment variables

Add these in the service's **Environment** tab (values from your local
`backend/.env` — never commit that file):

| Key | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | your Supabase Postgres connection string |
| `JWT_SECRET` | |
| `JWT_EXPIRES_IN` | |
| `EMAIL_USER` | |
| `EMAIL_PASS` | |
| `ANTHROPIC_API_KEY` | |
| `ANTHROPIC_MODEL` | |
| `ANTHROPIC_API_URL` | |
| `STACKS_API_BASE` | |
| `QUIZ_ENABLED` | `true`/`false` |
| `ASSISTANT_ENABLED` | `true`/`false` |

Don't set `PORT` — Render injects it automatically and `server.js`
already reads `process.env.PORT`. `CLIENT_ORIGIN` isn't needed either
since frontend and backend are served from the same origin here.

## 4. Deploy

Click **Create Web Service** (or **Apply** for the Blueprint). Render
will run the build/start commands above on every push to `main`.

## One thing to know: file uploads are not persistent

`backend/uploads` (profile pictures, via multer) is written to local
disk. Render's filesystem is ephemeral on redeploy/restart — anything a
user uploads will disappear the next time the service redeploys.
This didn't matter for local/dev use, but for a real production deploy
you'd want to swap `middleware/upload.js` to write to Supabase Storage
(or S3) instead of local disk. Flagging it here rather than migrating
it, since it's outside the reminders/checkin/steps/quiz work we've done
so far — let me know if you want that done next.
