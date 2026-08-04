# BlessMed — Xverse / Leather wallet fix

Drop these files into your repo over the matching paths, then rebuild and redeploy.

## Files

```
frontend-react/src/lib/stacks.js      ← main fix (React app)
frontend-react/src/pages/Profile.jsx  ← clearer mobile help text
frontend/js/stacks.js                 ← same fix for legacy vanilla frontend
```

## What was wrong

- Code only looked for `window.XverseProviders.StacksProvider`
- Mobile Xverse injects `window.XverseProviders.BitcoinProvider`
- Calling `.request` on the wrong object → `e.request is not a function` on check-in
- Profile connect appeared to do nothing

## What this fixes

1. Detects `BitcoinProvider` first, then `StacksProvider`
2. Guards `typeof provider.request === "function"` before calling
3. Normalizes sats-connect `{ status, result, error }` responses
4. Clearer errors for mobile (must use Xverse in-app browser)

## Install

From your project root:

```bash
cp frontend-react/src/lib/stacks.js     path/to/blessmed/frontend-react/src/lib/stacks.js
cp frontend-react/src/pages/Profile.jsx path/to/blessmed/frontend-react/src/pages/Profile.jsx
cp frontend/js/stacks.js                path/to/blessmed/frontend/js/stacks.js   # only if you still use legacy frontend
```

Then rebuild and deploy:

```bash
# local check
cd frontend-react && npm run build

# or push to main so Render rebuilds
git add frontend-react/src/lib/stacks.js frontend-react/src/pages/Profile.jsx frontend/js/stacks.js
git commit -m "Fix Xverse mobile wallet: use BitcoinProvider + safe request()"
git push
```

## How to test on mobile

1. Open the **Xverse app**
2. Open its **in-app browser** (not Safari/Chrome)
3. Go to your BlessMed URL  
   Deep link example: `xverse://browser?url=https://YOUR-SITE`
4. Profile → **Connect Xverse**
5. Check-in → sign the message

Desktop Leather extension should keep working as before.
