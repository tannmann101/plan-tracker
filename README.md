# Secretary

A head-of-household management layer built on a flat **Kind / Item** graph
(Projects, Goals, and Practices as Kinds; Tasks, Sessions, Preps, Errands,
and Other as Items, free-form tags, seven domains) with a standing
propose-then-confirm AI layer -- nothing Secretary drafts (a triaged
capture, a Secretary-chat edit, a weekly-meeting photo import) ever writes
to a real Kind/Item without a human confirming it first.

This app was rebuilt from an earlier "3-Year Plan Tracker," and then rebuilt
again from a first Goal→Plan→Session→Task version of Secretary itself -- it
reuses the same repo, GitHub Pages deploy pipeline, and Firebase project
each time, but the data model below is current.

## What this app owns (and doesn't)

Secretary owns the household planning graph. It explicitly does **not**
own:

- **Finances** -- lives in [Finance Tracker](https://github.com/tannmann101/budget-ledger). Secretary tags the Head of Household domain and links out.
- **The Workshop's inventory** -- a separate tool for material/inventory management.
- **The Teacher domain's content tool** -- a separate knowledge/teaching app, not built yet.

Most domains have no dedicated tool of their own yet -- their Items log
generically inside Secretary until one is built. Graduating any of them to
a dedicated tool is a manual call; nothing here silently migrates itself.

## The data model

| Entity | Fields |
|---|---|
| **Kind** (Project / Goal / Practice) | title, kindType, domain, secondaryDomains[], resources[], tags[], parentKindId (nullable), status (not-started/queued/in-progress/almost-done/done), timing (dueDate/milestones), initiator/familyScope/consentStatus (Project only), retro, createdVia |
| **Item** (Task / Session / Prep / Errand / Other) | title, itemType, domain, secondaryDomains[], resources[], tags[], parentKindId (nullable), timing (targetDay/time/dueDate/floating/milestones), done, completedAt, isRecurringPracticeItem/practiceHabitId, retro, createdVia |

`parentKindId` is the only nesting mechanism -- a Kind can nest under
another Kind, and an Item can attach directly to a Kind. There is no
intermediate Plan/Session layer between an Item and the Kind it serves.
Tags are free-form (autocomplete against whatever's already in use, no
fixed vocabulary) and resources are a flat list (any resource usable from
any domain) -- both replace the old domain-exclusive content-type routing
table entirely.

Firestore collections: `kinds`, `items`, `practiceHabits` (habit
*definitions* only -- see Practices below), `pendingOperations` (the
shared AI-draft queue), `secretaryChat`, `events` (append-only lifecycle
log), `captures` (raw intake records), and `config` (`domains`,
`resources`, `practiceCategories`).

## The seven domains

Creative, Vocation, Education, Head of Household, Projects, Practices, and
Goals. See `src/constants.js` (`DEFAULT_DOMAINS`) or Settings for full
descriptions. Replaces the earlier fifteen-domain taxonomy and its
domain-exclusive content-type routing table -- tags now carry whatever
specificity a per-domain category list used to.

## Adding something

One Add Form, opened from the FAB on every page: pick Kind or Item (or,
on Today, Item is the only option), fill in the shared fields (name,
domain + secondary domains, resources, tags, timing), and for a Kind,
optionally a Project's initiator/family-scope/consent. A "this already
happened" toggle marks it done/complete retroactively without the
forward-planning fields. Add, edit, complete/uncomplete, and delete all
work identically for any Kind or Item from every page that shows one --
tapping a card's body opens the same edit modal everywhere.

## Capture, triage & the Secretary page

An always-visible capture bar feeds `triageCapture` (a Cloud Function),
which drafts a Kind-or-Item proposal and writes it straight into
`pendingOperations` server-side -- nothing auto-places, and there's no
client-side path that could skip the review queue. The Secretary page
(hamburger menu) is where those proposals actually get confirmed: a review
log (flagged if it's sat unsorted more than three days), a persistent chat
for scheduling/sequencing/editing (propose-then-confirm, same as
everything else), and the weekly-meeting photo import entry point.

## Weekly-meeting pipeline

From the Secretary page, upload a photo of the handwritten weekly-meeting
notebook page. `parseWeeklyPhoto` reads it and drafts one pendingOperation
per Kind/Item it finds -- same review-before-commit discipline as a typed
capture, just seeded from a photo.

## Plans (Practices + Projects/Goals)

Two tabs. **Practices**: categories (add/remove), habit definitions, and a
weekly tracker grid -- a habit+day's completion lives on exactly one Item
(`isRecurringPracticeItem` + `practiceHabitId`, found-or-created on
demand), so checking it off from the grid or from Today/Week writes the
same record either way. **Projects & Goals**: a kanban (Still Needed →
Queue → In Progress → Almost Done → Done) over Kinds, drag to move between
columns; saving an Item into the current week can also auto-promote its
still-queued parent Kind into "in-progress" as a side effect, but the
status stays fully drag-overridable afterward.

## Workspace

The full Kind/Item ticket board (with a done/archived filter), a due-date
timeline, and a right rail (weekly summary, domain distribution, a
completed-over-time chart, domain/resource filters, shortcuts). Clicking a
ticket opens the edit modal and focuses the Secretary chat on that entity.

## Today & Week/Calendar

Today shows a 4-day strip (Items only) plus a right rail of Goal progress
and a "where's this landing" resource tally. Week/Calendar toggles between
a Monday-start week grid and an indefinitely-navigable month view, full
Kind-or-Item Add on both.

## Log

Hamburger-only, edit-only (no Add): every Kind and Item as a filterable,
searchable table (title/type/date/tags), with Daily/Weekly rollup views.

## Trends

Items completed per week by domain, domain distribution, an alignment rate
over time (completed Items whose `parentKindId` chain reaches a Goal),
resource usage, and Goal cycle time.

## Sync

Refresh-on-open, not live push -- the app loads everything once when it
opens and whenever you hit refresh. Secretary is driven by a weekly
meeting plus occasional capture, which doesn't need the sub-second
cross-device sync the household ledger or Workshop apps do.

## Access

Google sign-in, same two-account allow-list pattern as the sibling apps --
but both accounts now have identical read/write access (see
`firestore.rules`' `isAllowed()`). There is no owner/viewer split.

## State export

Settings has an "Export state" action that downloads everything Secretary
currently holds as both a readable `.md` report and a raw `.json` dump,
generated client-side.

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
4. **Firestore rules deploy automatically** on push to `main` when
   `firestore.rules` changes -- see
   `.github/workflows/deploy-firestore-rules.yml` (reuses the same
   `FIREBASE_SERVICE_ACCOUNT` secret as the functions deploy). To deploy by
   hand instead:
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

## One-time data migration

`scripts/migrate-kinds-items.mjs` moves the previous Goal/Project/Plan/
Session/Task/Idea data over to the Kind/Item shape above (domain remapped
to the new seven, content-type folded into tags). Run it against the
emulator first (`npm run migrate:seed` for a seeded dry run, `npm run
migrate:emulator` against real emulator data), review the generated
`migration-report.md` for anything that couldn't resolve a parent, and
only then run `npm run migrate:prod` against the live project.

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
