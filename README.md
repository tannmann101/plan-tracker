# 3-Year Plan Tracker

A shared intake and triage tool for household goal/task items feeding a
3-year plan: weekly triage of everything open, and a monthly check-in
grouped by domain.

## What this app owns (and doesn't)

This app owns exactly one thing: **Items** — a title, a domain tag
(Financial / Material / Health-Fitness / Vocational-Career / Relational /
Cross-Domain), a status (open / in-progress / done / dropped), a source
note, a created date, and an optional target date.

It explicitly does **not** own:

- **Pushes** — bounded units of work tied to a 3-year plan's phases. Those
  live in a separate Phase Roadmap document.
- **Maintenance procedures** — recurring routines. Those live in Google
  Calendar.

**Graduation**: when an item becomes bounded and phase-tied enough to become
a Push, that's a human call, not something this app automates — delete the
item here once you've manually copied it into the Phase Roadmap. There's no
auto-migration button on purpose.

## Running locally

```
npm install
npm run dev
```

## Data & sync

Data lives in a shared Firestore `items` collection — every item is its own
document, both users read and write the same collection. Sync is
**refresh-on-open**: the app loads items once when it opens, plus whenever
you hit the "Refresh" button — there's no live push between devices (by
design; this doesn't need sub-second cross-device visibility the way the
household ledger does).

Access is locked down with Google sign-in: only the two email addresses
listed in `firestore.rules` can read or write.

## Views

- **Weekly Triage** — every `open` and `in-progress` item, soonest target
  date first, with inline status changes so you can work through the list
  without leaving the page.
- **Monthly Domain Check-In** — every item (any status), grouped into the
  six domain sections, for a once-a-month walk through each area.

## Installing as an app

Once deployed (see below), open the site in your phone's browser and use
"Add to Home Screen" (iOS Safari share menu, or Chrome's install prompt on
Android) to install it like a native app.

## One-time cloud setup (free, ~10 minutes)

This app uses its own Firebase project, separate from any other app you've
built this way — its data, quota, and security rules are fully isolated.

1. Go to <https://console.firebase.google.com>, sign in, and create a new
   project (no credit card needed — the free "Spark" plan is enough).
2. **Enable Firestore**: in the left sidebar, Build → Firestore Database →
   Create database → start in **production mode** → pick any region.
3. **Enable Google sign-in**: Build → Authentication → Get started → Sign-in
   method tab → enable the **Google** provider.
4. **Authorize your domain**: still in Authentication → Settings → Authorized
   domains → add `<your-username>.github.io`.
5. **Register a web app**: Project settings (gear icon) → General → "Your apps"
   → Add app → Web (`</>`). Copy the `firebaseConfig` object it gives you.
6. Paste those values into [src/firebase.js](src/firebase.js), replacing the
   `REPLACE_ME` placeholders.
7. **Deploy the security rules** in [firestore.rules](firestore.rules) — the
   emails are already set to your two accounts, so just run:
   ```
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules --project <your-project-id>
   ```
   (or paste the contents of `firestore.rules` directly into Firebase Console →
   Firestore Database → Rules → Publish).
8. Commit and push. Once the site redeploys, open it, sign in with Google on
   both phones, and you should see the same shared item list.

If either of you ever needs to change which accounts are allowed, edit the
email list in `firestore.rules` and redeploy the rules (step 7).

## Local development against a fake project (no real Firebase needed)

`.env.local` sets `VITE_USE_FIREBASE_EMULATOR=true` (create it yourself,
it's gitignored — see `.env.local.example`), so `npm run dev` talks to a
local emulator instead of your real project. Requires a Java runtime
installed once.

```
npm run emulators   # starts local Auth + Firestore emulators
npm run dev          # in another terminal
npm run test:rules   # scripted checks of firestore.rules (allow-list + schema)
```

## Deploying to GitHub Pages (free)

1. Push this project to the `main` branch of its GitHub repo.
2. In the repo settings → Pages, set the source to "GitHub Actions".
3. The included workflow (`.github/workflows/deploy.yml`) builds and deploys
   automatically on every push to `main`.
4. Your app will be live at `https://<your-username>.github.io/plan-tracker/`.

(If you rename the repo, update `base` in `vite.config.js` and
`start_url`/`scope` in the PWA manifest to match.)
