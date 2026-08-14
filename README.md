# Secretary

A head-of-household management layer: Goals (yearly → quarterly → monthly →
weekly), Plans, Sessions, and Tasks, fed by a weekly-meeting photo import and
a standing capture/triage inbox, with an append-only event log behind a
running Goal rollup report.

This app was rebuilt from an earlier "3-Year Plan Tracker" -- it reuses that
project's repo, GitHub Pages deploy pipeline, and Firebase project, but owns
an entirely different data model. Nothing from the old Items schema carries
forward.

## What this app owns (and doesn't)

Secretary owns the household planning graph: **Goal → Plan → Session →
Task**, plus **Project** for atypical personal initiatives that fall outside
the Goal hierarchy (see the worked example below). It explicitly does
**not** own:

- **Finances** -- lives in [Finance Tracker](https://github.com/tannmann101/budget-ledger). Secretary tags the Finances domain and links out.
- **The Workshop's inventory** -- a separate tool for material/inventory management. Secretary's Material domain links out; no direct integration yet.
- **The Teacher domain's content tool** -- a separate knowledge/teaching app. Secretary has a link placeholder for it; the app itself isn't built yet.

Tech/Admin and Catch-All have no dedicated tool at all yet -- their Sessions
log generically inside Secretary until one is built. Graduating either of
those to a dedicated tool is a manual call, same as the old app's "no
auto-migration" philosophy: nothing here silently migrates itself.

## The data model

| Entity | Fields |
|---|---|
| **Goal** | title, tier (yearly/quarterly/monthly/weekly), domain, owner, parent_goal_id (nullable), status |
| **Project** | title, initiator (me/wife), family_scope (personal/touches-family), status, consent_status (when family_scope = touches-family) |
| **Plan** | title, parent_type (goal/project), parent_id, domain, session_ids[] |
| **Session** | title, plan_id, domain, content_type, tool_location (resolved from content_type via the routing table), task_ids[], target_day, done |
| **Task** | title, session_id, done, date |

Worked example: Goal "clean the house" → Plan with Sessions per room → Tasks
like "clean the shower." An atypical add-on like "shine the floors" becomes
a Project instead -- a personal initiative that, because it touches shared
floors, needs consent tracked before a Plan gets built around it.

Firestore is one collection per entity type (`goals`, `projects`, `plans`,
`sessions`, `tasks`), plus an append-only `events` log (mirroring the old
app's `itemEvents` pattern) that the Goal rollup report is built from, and a
`captures` collection for the standing triage inbox. `config/routingTable`
and `config/domains` hold the editable copies of the content-type routing
table and domain definitions (see Settings).

## The five domains

Finances, Material Provisioning, Teacher, Tech/Admin, Catch-All (ecology of
practices). See `src/constants.js` (`DEFAULT_DOMAINS`) or Settings for the
full descriptions and links.

## Weekly-meeting pipeline

Upload a photo of your handwritten weekly-meeting notebook page (This Week →
"Import weekly-meeting photo"). A Cloud Function (`parseWeeklyPhoto`) reads
it and extracts Goals-in-context, this week's Plans, their Sessions (domain +
content-type tagged), and Tasks. Nothing saves automatically -- you get a
full checklist to review and edit first.

## Capture, triage & alignment

An always-visible quick-capture bar (and a floating button for richer,
longer captures) feeds a triage pipeline (`triageCapture` Cloud Function):
relevance, level (Task/Session/Plan/Goal/Project), domain + content-type
placement, and an alignment check against existing Goals. Confident
placements happen directly; uncertain ones open a short conversational
confirmation (Secretary can ask a genuine follow-up question) rather than
forcing a guess into a form. Anything that doesn't align to an existing Goal
surfaces in the Review queue -- never silently discarded.

## Sync

Refresh-on-open, not live push -- the app loads everything once when it
opens and whenever you hit refresh. Secretary is driven by a weekly meeting
plus occasional capture, which doesn't need the sub-second cross-device sync
the household ledger or Workshop apps do.

## Access

Google sign-in, same two-account allow-list pattern as the sibling apps.
Only Tanner's account can write; Rochelle's account is read-only across the
entire Goal hierarchy and every domain (see `firestore.rules`' `isOwner()`
vs `isAllowed()`, and `isOwnerEmail()` in `src/constants.js`).

## Running locally

```
npm install
npm run dev
```

## One-time cloud setup

This reuses the existing `plan-tracker-eb0c3` Firebase project -- no new
project needed. Beyond the Firestore/Auth setup already in place from the
old app:

1. **Enable Cloud Functions** (requires the Blaze pay-as-you-go plan --
   Functions isn't available on Spark): Firebase Console → Build → Functions.
2. **Set the Anthropic API key secret**:
   ```
   npx firebase-tools functions:secrets:set ANTHROPIC_API_KEY --project plan-tracker-eb0c3
   ```
3. **Deploy functions**:
   ```
   npx firebase-tools deploy --only functions --project plan-tracker-eb0c3
   ```
   (or push to `main` with changes under `functions/` -- see
   `.github/workflows/deploy-functions.yml`, which needs a
   `FIREBASE_SERVICE_ACCOUNT` and `ANTHROPIC_API_KEY` repo secret).
4. **Deploy the updated Firestore rules**:
   ```
   npx firebase-tools deploy --only firestore:rules --project plan-tracker-eb0c3
   ```

## Local development against a fake project (no real Firebase needed)

`.env.local` sets `VITE_USE_FIREBASE_EMULATOR=true` (create it yourself,
it's gitignored -- see `.env.local.example`), so `npm run dev` talks to
local emulators instead of the real project. Requires a Java runtime
installed once.

```
npm run emulators   # starts local Auth + Firestore + Functions emulators
npm run dev          # in another terminal
npm run test:rules   # scripted checks of firestore.rules (allow-list + schema)
```

The Functions emulator needs its own dependencies installed once:
`npm install --prefix functions`. Emulated Cloud Functions still call the
real Anthropic API if you export `ANTHROPIC_API_KEY` in your shell before
starting the emulator.

## Deploying to GitHub Pages (free)

Unchanged from the old app: push to `main`, GitHub Pages source set to
"GitHub Actions", `.github/workflows/deploy.yml` builds and deploys
automatically. Live at `https://<your-username>.github.io/plan-tracker/`
(the repo -- and therefore the URL -- wasn't renamed).

## Sibling apps

- [Finance Tracker](https://github.com/tannmann101/budget-ledger) -- handles the Financial domain.
- [The Workshop](https://github.com/tannmann101/roc-workspace) -- wife's domain tool.

Secretary federates with both (links out) rather than rebuilding or
absorbing them.
