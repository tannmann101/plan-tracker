# Plan Tracker

A shared task/plan/goal tracker, reviewed across five horizons — Day, Week,
Month, Quarter, and Year — with an event log behind it so completions and
drop-offs can be turned into trends, patterns, and a shareable report over
time. General-purpose: a household 3-year plan is just one set of tagged
goals/plans/tasks among whatever else you track here.

## What this app owns (and doesn't)

This app owns exactly one thing: **Items** — a title, a domain tag
(Financial / Material / Health-Fitness / Vocational-Career / Relational /
Chores / Cross-Domain / Other), a status (open / in-progress / scheduled /
needs-review / done / dropped), a type (Task / Plan / Goal), an optional
owner, a source note, a created date, and an optional target date.

**Type is the hierarchy tier**, not a rigid requirement: a Goal is a
higher-level aspiration, a Plan is a bounded body of work that serves a goal,
a Task is the smallest unit of actual work. A task can optionally link to
the plan it serves, and a plan can optionally link to the goal it serves
(via the Parent field in the item form) — but every item stands on its own
by default, with no forced hierarchy. The Quarter and Year horizons surface
Plans and Goals respectively, each showing their linked children beneath,
and any linked item shows a "part of X" note wherever else it appears.

Two fields are tier-specific rather than universal: a **Task** carries an
effort size (Quick / Medium / Large — a work-session estimate that doesn't
mean much for a multi-week Plan or a Goal); a **Plan** carries an optional
Definition of Done (what completing that bounded body of work looks like).
A Goal stays the leanest tier — no execution detail, just what it is, why it
matters (Source note), and an optional target date.

This app explicitly does **not** own recurring maintenance routines — those
live in Google Calendar.

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

- **Plan** — one view, five horizons, switched with a Day/Week/Month/
  Quarter/Year control at the top:
  - **Day** — open items due today or overdue, most overdue first.
  - **Week** — every open item, soonest target date first.
  - **Month** — every item, any status, grouped by domain.
  - **Quarter** — every Plan-type item, with its linked tasks nested beneath.
  - **Year** — every Goal-type item, with its linked plans and tasks nested
    beneath, plus a done/total progress readout.
- **Overview** — a live snapshot: open/stale/due-this-week counts, a status
  mix, open-by-domain and open-by-type breakdowns, an owner split, per-goal
  progress, and the current stale-item list.
- **Trends** — completion/drop-off trends reconstructed from the event log
  (weekly chart, per-domain completions, average cycle time), plus a
  "Generate report" button that compiles all of it into a markdown summary
  to copy or download — meant for pasting into a Claude Project for planning.

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
