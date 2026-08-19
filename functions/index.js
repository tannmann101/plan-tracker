const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

// Both household accounts have identical access now -- there is no
// owner/viewer split left (see firestore.rules' isAllowed()). Kept as an
// explicit allow-list here (not "any authenticated user") so a stolen/
// misissued token for some other Google account still can't call these
// functions. Keep in sync with firestore.rules' isAllowed() by hand.
const HOUSEHOLD_EMAILS = ['tannerwesgardner@gmail.com', 'rochelleygardner@gmail.com'];

const MODEL = 'claude-haiku-4-5-20251001';

// Kept in sync by hand with src/constants.js -- functions/ runs in a
// separate Node/CommonJS deploy from the Vite/ESM client bundle, so there's
// no shared import between them (same reasoning firestore.rules uses for
// its own duplicated vocab).
const DOMAIN_IDS = ['creative', 'vocation', 'education', 'head-of-household', 'projects', 'practices', 'goals'];
const KIND_TYPE_IDS = ['project', 'goal', 'practice'];
const ITEM_TYPE_IDS = ['task', 'session', 'prep', 'errand', 'other'];

// Human-readable labels for entityContext.family -- a conversation can now
// be opened scoped to any of the four writable entity types (a Kind/Item
// ticket, a Practice habit row, or a discipline card), not just Kind/Item.
const ENTITY_FAMILY_LABELS = { kind: 'Kind', item: 'Item', practiceHabit: 'Practice habit', discipline: 'Discipline' };

function requireHousehold(request) {
  const email = request.auth?.token?.email;
  if (!email || !HOUSEHOLD_EMAILS.includes(email)) {
    throw new HttpsError('permission-denied', 'Not authorized.');
  }
}

// Claude sometimes wraps JSON answers in ```json fences even when told not
// to -- strip those before parsing.
function parseJson(text) {
  const cleaned = text.replace(/^```json\s*|^```\s*|```$/gm, '').trim();
  return JSON.parse(cleaned);
}

async function callClaude({ system, messages, maxTokens }) {
  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicApiKey.value(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages,
      }),
    });
  } catch (err) {
    console.error('Claude request threw', err);
    throw new HttpsError('unavailable', 'Could not reach Claude.');
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error('Claude API error', response.status, errText);
    if (response.status === 429) {
      throw new HttpsError('resource-exhausted', "Hit Claude's rate limit -- wait a moment and try again.");
    }
    throw new HttpsError('internal', `Claude request failed (${response.status}).`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) {
    throw new HttpsError('internal', 'Claude returned an empty response.');
  }
  return text.trim();
}

// A Kind proposal's patch, normalized so every pendingOperation this file
// writes carries a shape isValidKind (minus createdAt/updatedAt, which the
// client fills in on approval) would accept.
function kindPatch(draft) {
  return {
    title: draft.title,
    kindType: KIND_TYPE_IDS.includes(draft.kindType) ? draft.kindType : 'project',
    domain: DOMAIN_IDS.includes(draft.domain) ? draft.domain : 'head-of-household',
    secondaryDomains: Array.isArray(draft.secondaryDomains) ? draft.secondaryDomains.filter((d) => DOMAIN_IDS.includes(d)) : [],
    resources: Array.isArray(draft.resources) ? draft.resources : [],
    tags: Array.isArray(draft.tags) ? draft.tags : [],
    parentKindId: draft.parentKindId || null,
    status: 'not-started',
    timing: (draft.dueDate || draft.startDate) ? { startDate: draft.startDate || null, dueDate: draft.dueDate || null, milestones: [] } : null,
  };
}

function itemPatch(draft, practiceHabits = []) {
  const patch = {
    title: draft.title,
    itemType: ITEM_TYPE_IDS.includes(draft.itemType) ? draft.itemType : 'task',
    domain: DOMAIN_IDS.includes(draft.domain) ? draft.domain : 'head-of-household',
    secondaryDomains: Array.isArray(draft.secondaryDomains) ? draft.secondaryDomains.filter((d) => DOMAIN_IDS.includes(d)) : [],
    resources: Array.isArray(draft.resources) ? draft.resources : [],
    tags: Array.isArray(draft.tags) ? draft.tags : [],
    parentKindId: draft.parentKindId || null,
    timing: draft.targetDay
      ? {
          targetDay: draft.targetDay,
          floating: !draft.time,
          time: draft.time || null,
          durationMinutes: draft.time ? (draft.durationMinutes || 30) : null,
        }
      : null,
    // done defaults false everywhere except a secretaryChat practice
    // check-in, the one case where a draft is allowed to arrive pre-done
    // (see itemPatch's practiceHabitId branch and secretaryChat's prompt).
    done: !!draft.done,
  };
  // Only secretaryChat's schema ever sets practiceHabitId (checking an
  // existing Practice off/on for a day) -- triageCapture/parseWeeklyPhoto
  // never propose creating a new practice habit *definition* themselves,
  // so this branch is a no-op for those two callers.
  if (draft.practiceHabitId) {
    patch.isRecurringPracticeItem = true;
    patch.practiceHabitId = draft.practiceHabitId;
    const habit = practiceHabits.find((h) => h.id === draft.practiceHabitId);
    // A goal-linked habit's check-in carries the same parentKindId as its
    // habit -- resolved here rather than trusted from the model (which
    // isn't told to echo it back), so the goal attachment is never
    // silently missing from an AI-proposed check-in the way it would be
    // if this were left to the model to remember.
    if (habit?.linkedKindId) patch.parentKindId = habit.linkedKindId;
    // Checkbox-mode habits accumulate 1 per check, same as a human
    // clicking the checkbox on Plans/Today/Week -- the model's own
    // progressAmount (if it hallucinated one) is ignored here so a
    // checkbox-mode habit can't end up with an arbitrary logged number.
    // Log-mode (or a plain, non-goal-linked habit) trusts the model's
    // amount, same as before -- the human still reviews it in the queue.
    if (habit?.linkedKindId && (habit.progressMode || 'log') === 'checkbox') {
      patch.progressAmount = draft.done ? 1 : 0;
    } else if (draft.progressAmount != null) {
      patch.progressAmount = draft.progressAmount;
    }
  }
  return patch;
}

// A discipline patch, for the one thing Secretary chat can now actually do
// to an existing "Habits to Break" entry: pull it into/out of focus, log a
// relapse (translated to a fresh startedAt client-side at approval time --
// never trust an AI-supplied timestamp for that), or mark it resolved.
// Only ever an update (see the prompt: chat never creates a discipline),
// so unlike kindPatch/itemPatch this is intentionally partial -- only the
// field(s) actually being changed, never a full-object replacement, since
// there's no "everything else defaults to empty" story that would make
// sense for a habit that already exists.
function disciplinePatch(draft) {
  const patch = {};
  if (typeof draft.focused === 'boolean') patch.focused = draft.focused;
  if (typeof draft.resolved === 'boolean') patch.resolved = draft.resolved;
  if (draft.relapse === true) patch.relapse = true;
  return patch;
}

// A practice-habit patch -- compound-only (see the prompt), for linking an
// existing habit to a Goal/Project it's meant to build toward. Also
// intentionally partial, same reasoning as disciplinePatch.
function practiceHabitPatch(draft) {
  const patch = {};
  if (draft.linkedKindId) patch.linkedKindId = draft.linkedKindId;
  if (draft.progressUnit) patch.progressUnit = draft.progressUnit;
  if (typeof draft.progressTarget === 'number') patch.progressTarget = draft.progressTarget;
  return patch;
}

// Turns one raw compound step from the model's JSON into the {ref,
// entityType, action, targetId, patch} shape isValidPendingOperation's
// `ops` list expects. Returns null for a step whose opType doesn't match
// anything recognized, so the caller can drop it rather than write a
// step the client wouldn't know how to apply.
function normalizeCompoundStep(step, practiceHabits = []) {
  const opType = step.opType || '';
  const action = opType.startsWith('create') ? 'create' : 'update';
  let entityType, patch;
  if (opType.endsWith('kind')) { entityType = 'kind'; patch = kindPatch(step); }
  else if (opType.endsWith('item')) { entityType = 'item'; patch = itemPatch(step, practiceHabits); }
  else if (opType === 'update-discipline') { entityType = 'discipline'; patch = disciplinePatch(step); }
  else if (opType === 'update-practiceHabit') { entityType = 'practiceHabit'; patch = practiceHabitPatch(step); }
  else return null;
  return {
    ref: step.ref || null,
    entityType,
    action,
    targetId: action === 'update' ? (step.targetId || null) : null,
    patch,
  };
}

// Writes a pendingOperation -- the one path, server-side, that every AI
// draft in this file goes through. Nothing here ever touches /kinds or
// /items directly; that only happens client-side, after a human approves
// the operation from the Secretary review log (§5). `opType: 'compound'`
// carries `ops` (a list of linked steps) instead of a single `patch` --
// see isValidPendingOperation in firestore.rules for the shape.
async function createPendingOperation({ opType, targetId, patch, ops, sourceCaptureId, sourceType }) {
  const now = Date.now();
  const payload = {
    opType,
    targetId: targetId || null,
    sourceCaptureId: sourceCaptureId || null,
    sourceType,
    status: 'pending',
    createdAt: now,
  };
  if (opType === 'compound') payload.ops = ops;
  else payload.patch = patch;
  const ref = await db.collection('pendingOperations').add(payload);
  return ref.id;
}

// Takes a raw capture (typed or pasted text) and drafts a single Kind-or-
// Item proposal from it. The function itself creates the capture record
// and the resulting pendingOperation server-side -- the client can't skip
// or race past the review queue because there's no direct-write path for
// it to take (see src/pages/Secretary.jsx's review log, which is the only
// place this ever actually lands as a real Kind/Item).
exports.triageCapture = onCall({ secrets: [anthropicApiKey], timeoutSeconds: 60 }, async (request) => {
  requireHousehold(request);

  const text = request.data?.text;
  if (!text || typeof text !== 'string') {
    throw new HttpsError('invalid-argument', 'A text string is required.');
  }
  const existingKinds = Array.isArray(request.data?.existingKinds) ? request.data.existingKinds : [];

  const now = Date.now();
  const captureRef = await db.collection('captures').add({ status: 'triaging', rawText: text, createdAt: now });

  const system = `You are Secretary, a formal, courteous, old-fashioned household secretary triaging a captured note for your employer. Decide whether it is best represented as a Kind (a Project, Goal, or Practice -- something with some duration/shape to it) or an Item (a Task, Session, Prep, Errand, or Other -- a single concrete placement). Respond with ONLY a single JSON object, no prose, no markdown fences.

Schema:
{
  "family": "kind" or "item",
  "title": string (a clean, short title),
  "kindType": one of ${JSON.stringify(KIND_TYPE_IDS)} (only when family is "kind"),
  "itemType": one of ${JSON.stringify(ITEM_TYPE_IDS)} (only when family is "item"),
  "domain": one of ${JSON.stringify(DOMAIN_IDS)},
  "secondaryDomains": array of zero or more other domains from the same list,
  "tags": array of short lowercase free-form tags,
  "targetDay": string (ISO date) or null -- only meaningful for an Item, and only when the text clearly implies one; never fabricate a date,
  "parentKindId": string or null -- an id from existingKinds below, only if this clearly belongs under one of them,
  "note": string (one sentence explaining the placement, in Secretary's voice)
}

existingKinds (id/title/kindType/domain, for parentKindId matching only): ${JSON.stringify(existingKinds)}`;

  const messages = [{ role: 'user', content: `Captured text: ${text}` }];
  const responseText = await callClaude({ system, messages, maxTokens: 1024 });

  let draft;
  try {
    draft = parseJson(responseText);
  } catch (err) {
    console.error('Failed to parse triageCapture response as JSON', responseText, err);
    throw new HttpsError('internal', "Claude's response wasn't valid JSON.");
  }

  const family = draft.family === 'kind' ? 'kind' : 'item';
  const opType = family === 'kind' ? 'create-kind' : 'create-item';
  const patch = family === 'kind' ? kindPatch(draft) : itemPatch(draft);
  patch.createdVia = 'capture';
  if (draft.retro) patch.retro = true;

  const pendingOperationId = await createPendingOperation({ opType, patch, sourceCaptureId: captureRef.id, sourceType: 'capture' });
  await captureRef.set({ status: 'proposed' }, { merge: true });

  return { result: { captureId: captureRef.id, pendingOperationId, family, patch, note: draft.note || null } };
});

// Parses a photo of the handwritten weekly-meeting notebook page into a
// batch of Kind/Item proposals, each landing in the pendingOperations queue
// exactly like a triaged capture rather than being written directly --
// same review-before-commit discipline, just seeded from a photo instead
// of typed text (see src/pages/WeeklyMeetingImport.jsx, now reached from
// the Secretary page per §5).
exports.parseWeeklyPhoto = onCall({ secrets: [anthropicApiKey], timeoutSeconds: 120 }, async (request) => {
  requireHousehold(request);

  const imageBase64 = request.data?.imageBase64;
  const mediaType = request.data?.mediaType;
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new HttpsError('invalid-argument', 'An imageBase64 string is required.');
  }
  if (!mediaType || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mediaType)) {
    throw new HttpsError('invalid-argument', 'A supported mediaType is required.');
  }
  const existingKinds = Array.isArray(request.data?.existingKinds) ? request.data.existingKinds : [];

  const now = Date.now();
  const captureRef = await db.collection('captures').add({ status: 'triaging', rawText: 'Weekly-meeting notebook photo import', createdAt: now });

  const system = `You read a photo of a handwritten household weekly-planning notebook page and extract its structure as JSON. Respond with ONLY a single JSON object, no prose, no markdown fences.

Schema:
{
  "kinds": [{ "title": string, "kindType": one of ${JSON.stringify(KIND_TYPE_IDS)}, "domain": one of ${JSON.stringify(DOMAIN_IDS)}, "tags": [string], "parentKindId": string or null }],
  "items": [{ "title": string, "itemType": one of ${JSON.stringify(ITEM_TYPE_IDS)}, "domain": one of ${JSON.stringify(DOMAIN_IDS)}, "tags": [string], "targetDay": string or null, "parentKindId": string or null }]
}

Rules:
- "kinds" are any Projects/Goals/Practices visible or referenced on the page.
- "items" are the individual planned Tasks/Sessions/Preps/Errands under them.
- parentKindId may reference either another entry's id in this same response is NOT valid -- it may ONLY reference an id from existingKinds below (an already-existing Kind). If an item/kind belongs under something newly proposed in this same batch rather than an existing Kind, leave parentKindId null; the household will re-link it by hand when reviewing the proposals, since two new proposals can't reference each other before either is approved.
- targetDay is an ISO date (YYYY-MM-DD) if the page states or implies one, else null. Infer year from context; if no year is inferable, use null rather than guessing.
- If the page doesn't clearly contain kinds or items, return an empty array for that key -- do not invent content.

existingKinds (id/title/kindType/domain, for parentKindId matching only): ${JSON.stringify(existingKinds)}`;

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: 'Extract this weekly-meeting notebook page as JSON per the schema in your instructions.' },
      ],
    },
  ];

  const text = await callClaude({ system, messages, maxTokens: 4096 });
  let parsed;
  try {
    parsed = parseJson(text);
  } catch (err) {
    console.error('Failed to parse parseWeeklyPhoto response as JSON', text, err);
    throw new HttpsError('internal', "Claude's response wasn't valid JSON.");
  }

  const created = [];
  for (const draft of Array.isArray(parsed.kinds) ? parsed.kinds : []) {
    const patch = kindPatch(draft);
    patch.createdVia = 'weekly-import';
    const id = await createPendingOperation({ opType: 'create-kind', patch, sourceCaptureId: captureRef.id, sourceType: 'weekly-import' });
    created.push({ pendingOperationId: id, family: 'kind', patch });
  }
  for (const draft of Array.isArray(parsed.items) ? parsed.items : []) {
    const patch = itemPatch(draft);
    patch.createdVia = 'weekly-import';
    const id = await createPendingOperation({ opType: 'create-item', patch, sourceCaptureId: captureRef.id, sourceType: 'weekly-import' });
    created.push({ pendingOperationId: id, family: 'item', patch });
  }
  await captureRef.set({ status: 'proposed' }, { merge: true });

  return { result: { captureId: captureRef.id, created } };
});

// The Secretary chat's single turn: takes the conversation so far (plus,
// when opened from a ticket, that entity as scoped context) and returns a
// reply, plus -- only when the conversation actually calls for a
// create/edit -- a proposed operation. Same rule as everywhere else in this
// pipeline: the function may draft a pendingOperation, but it never
// touches /kinds or /items itself. "Propose-then-confirm always" (§5).
exports.secretaryChat = onCall({ secrets: [anthropicApiKey], timeoutSeconds: 60 }, async (request) => {
  requireHousehold(request);

  const history = Array.isArray(request.data?.messages) ? request.data.messages : [];
  if (history.length === 0) {
    throw new HttpsError('invalid-argument', 'At least one message is required.');
  }
  const entityContext = request.data?.entityContext || null;
  const existingKinds = Array.isArray(request.data?.existingKinds) ? request.data.existingKinds : [];
  const existingItems = Array.isArray(request.data?.existingItems) ? request.data.existingItems : [];
  const practiceHabits = Array.isArray(request.data?.practiceHabits) ? request.data.practiceHabits : [];
  const disciplines = Array.isArray(request.data?.disciplines) ? request.data.disciplines : [];
  const attention = Array.isArray(request.data?.attention) ? request.data.attention : [];
  const existingResources = Array.isArray(request.data?.existingResources) ? request.data.existingResources : [];
  // Both new this pass (§ schedule intelligence) -- neither was previously
  // sent, so the model had no ground truth for "today"/"tomorrow" beyond
  // guessing from whichever existingItems happened to be dated, and no
  // sense of the household's normal waking hours when asked to suggest a
  // time with no day/time specified.
  const today = typeof request.data?.today === 'string' ? request.data.today : null;
  const activeHours = request.data?.activeHours && typeof request.data.activeHours.startHour === 'number'
    && typeof request.data.activeHours.endHour === 'number' ? request.data.activeHours : null;

  const system = `You are Secretary, a formal, courteous, old-fashioned household secretary having a conversation with your employer. You can discuss scheduling, help sequence milestones, check off a Practice habit, and draft new Kinds/Items or edits to existing ones -- but you never write anything yourself. Respond with ONLY a single JSON object, no prose, no markdown fences.

Schema:
{
  "reply": string (your conversational reply, in Secretary's voice -- courteous, precise, unhurried),
  "proposedOperation": null, or a single step, or a compound bundle of steps -- see below.

  A single step:
  {
    "opType": one of ["create-kind", "create-item", "update-kind", "update-item", "update-discipline", "update-practiceHabit"],
    "targetId": string or null (required, and must be an id from existingKinds/existingItems/entityContext/practiceHabits/disciplines, when opType starts with "update"),
    "family": "kind" or "item" (omit/ignore for "update-discipline"/"update-practiceHabit"),
    "title": string, "kindType": string or null, "itemType": string or null,
    "domain": one of ${JSON.stringify(DOMAIN_IDS)}, "secondaryDomains": [string], "tags": [string],
    "targetDay": string or null (ISO date, YYYY-MM-DD -- opType create-item/update-item only, the day it's placed on),
    "time": string or null (ISO 24h "HH:MM" -- only set this for a genuinely time-blocked Item; leave null for a floating one),
    "durationMinutes": number or null (only meaningful alongside "time"; default 30 if the conversation doesn't say),
    "dueDate": string or null (ISO date, YYYY-MM-DD -- opType create-kind/update-kind only, a Goal/Project's target completion date),
    "startDate": string or null (ISO date, YYYY-MM-DD -- opType create-kind/update-kind only, when work on it is meant to begin),
    "parentKindId": string or null,
    "practiceHabitId": string or null (only set when checking a Practice habit off/on for a day, or logging an amount against a goal-linked one -- an id from practiceHabits below; pair with "targetDay" and "done", and "progressAmount" for a goal-linked habit),
    "done": boolean or null (only meaningful alongside "practiceHabitId" -- true to mark that day's practice complete, false to un-mark it; for a goal-linked habit, true whenever progressAmount is greater than 0),
    "progressAmount": number or null (only meaningful alongside "practiceHabitId" for a habit that has progressUnit/progressTarget set -- the amount to log for that day in its progressUnit, e.g. chapters read; omit/null for a plain, non-goal-linked habit),
    "focused": boolean or null (opType "update-discipline" only -- true to pull it into focus, false to stop focusing it),
    "resolved": boolean or null (opType "update-discipline" only -- true to mark it resolved/broken for good),
    "relapse": boolean or null (opType "update-discipline" only -- true to log a relapse today, resetting its streak clock),
    "linkedKindId": string or null (opType "update-practiceHabit" only -- links an existing Practice habit to a Goal/Project's id, from existingKinds),
    "progressUnit": string or null (opType "update-practiceHabit" only -- how progress toward "linkedKindId" is measured, e.g. "chapters"),
    "progressTarget": number or null (opType "update-practiceHabit" only -- the target amount in "progressUnit"),
    "note": string (one sentence explaining the proposal -- when you scheduled around a conflict, say so here)
  }

  A compound bundle, when the request genuinely needs more than one linked write at once (see "Compound proposals" below):
  {
    "compound": true,
    "steps": [ <each step drawn from the same field set as a single step above, but include ONLY "opType"/"targetId"/"family"/"ref" plus whichever fields that step's opType actually uses -- omit the rest rather than writing them out as null, exactly as you would for a single-step proposal>, ... ],
    "note": string
  }

Only set proposedOperation when the conversation actually calls for creating or changing something -- most turns should just be a reply with proposedOperation null. Never invent an update to something the household didn't ask to change.

Scheduling: when the household asks you to book, schedule, or time-block something, check existingItems below for that day before proposing a "time" -- an Item's time slot runs from its "time" for "durationMinutes" (default 30 if absent); existingItems includes both timed and floating Items so you have the full picture of what's already placed, but only timed ones (time set, not null) can actually collide. If the requested time collides with an existing Item, do not silently double-book it: either pick the nearest genuinely free slot that still fits what was asked (same day, closest to the requested time) and say so plainly in "note" and "reply", or, if nothing reasonable is free that day, set proposedOperation to null, explain the conflict in "reply", and ask how the household wants to resolve it (move the existing Item, pick a different day, or double-book on purpose). Never invent a "resolution" the household didn't ask for -- point out the conflict and let them decide when it's ambiguous. The one exception: if the household's own message already says to move, bump, or reschedule whatever's in the way (not just "book X", but "move my other thing and fit this in," or a follow-up "yes, move it"), that IS being asked -- propose a compound bundle with an "update-item" step rescheduling the conflicting existingItems entry (echo back its other fields, only targetDay/time change) alongside the step placing what was requested.

Suggesting a time: if asked to schedule something with no specific day or time given ("find me an hour for X this week," "when should I do this"), pick a slot yourself rather than asking the household to specify one -- prefer today's activeHours window below (the household's usual active hours) on the nearest day with room, checking existingItems the same way as above, and say in "note" which day/time you picked and why (e.g. "first open hour Thursday morning"). If activeHours is absent, use a reasonable daytime default (9am-9pm) rather than proposing something like 3am.

Practices: practiceHabits below lists every active Practice habit with today's completion state and this week's tally, so you can answer "did I do X today/this week" directly. If asked to check one off (or un-check it), propose an update-item targeting its "todayItemId" when set and the day in question is today (family "item", practiceHabitId set, done as asked) -- or, when there's no Item yet for that day (todayItemId null, or a day other than today), propose a create-item with the same practiceHabitId/targetDay/done, itemType "other", domain "practices", and leave time/durationMinutes null (a practice check-in is always floating). Never propose creating a brand-new Practice habit *definition* -- if asked to add one, tell the household to add it from Plans' Practices tab.

Goal-linked practices: some practiceHabits build toward a Goal or Project instead of a plain daily checkbox -- those entries carry linkedKindId/linkedKindTitle/progressUnit/progressCurrent/progressTarget/progressMode (e.g. a "Read" habit linked to a "Read 1 book a month" Goal, progressUnit "chapters", progressCurrent 4, progressTarget 12, progressMode "log"). progressMode "checkbox" means each day is worth exactly 1 toward the target -- treat it exactly like a plain habit (propose "done" true/false only, never set "progressAmount" yourself; the server derives it from "done"). progressMode "log" means the amount varies day to day -- when the household reports progress on one of these ("I read 2 chapters today"), set "progressAmount" to the amount and "done" to true (progressAmount 0 with done false to undo a day's log). Either way, never invent a running total yourself -- progressCurrent is always the sum of each day's progressAmount, computed client-side. Report progressCurrent/progressTarget/progressUnit plainly when asked how a goal is going. You can draft the Goal/Project Kind itself as a normal create-kind proposal when the household describes a new one -- but linking a Practice habit to it (setting its progressUnit/progressTarget/progressMode) isn't something you can propose; direct the household to Plans' Practices tab to link the habit once the Kind exists, since it's a direct edit to the habit's own definition, not a create/update-item operation. Once a goal-linked habit's target is reached, the household closes it out from Plans ("Mark goal reached"), which turns it back into a plain weekly-checkbox habit -- you'll see linkedKindId disappear from that habit's entry afterward.

Habits to Break: disciplines below lists every unresolved habit being eliminated, whether or not it's currently "in focus," each with "focused" (true/false), its live streak, and the next milestone it's working toward. Discuss progress and offer encouragement, and now you can act too -- propose a single-step "update-discipline" (targetId = its id from disciplines below) to pull one into focus ("focused": true), stop focusing it ("focused": false), log a relapse today ("relapse": true -- resets the streak clock to right now), or mark it resolved for good ("resolved": true). Only set the field(s) actually being asked for; never propose creating a brand-new discipline yourself -- if asked to add one, tell the household to add it from Plans' "Habits to Break" section.

Compound proposals: some requests need more than one linked write at once -- promoting a single Item into its own Project or Goal with that Item becoming a nested Session under it, or turning a Practice habit (or a discipline you just helped focus) into a Goal with milestones and several scheduled Sessions, optionally linking the habit to that Goal in the same bundle. For these, set "proposedOperation" to the compound shape from the schema above instead of a single step. Give a step a short "ref" (like "s1") ONLY if a LATER step in the SAME bundle needs to point at the entity it creates -- reference it there as the literal string "$ref:s1" in whatever field takes that id (almost always "parentKindId" or "linkedKindId"); refs only resolve within their own bundle, never across separate proposals. A step targeting an EXISTING entity (opType starting with "update") must set "targetId" to a real id from existingKinds/existingItems/practiceHabits/disciplines below, and should echo back every field of that entity you are not intentionally changing (its current title/domain/tags/resources/targetDay/time/durationMinutes) -- omitting a field on an update risks clearing it, the same as with a single-step update. Use compound only when the request genuinely needs more than one write; a single create or edit should still be a single-step proposedOperation, not a one-step "compound." "update-practiceHabit" (targetId = its id from practiceHabits, "linkedKindId" set to the Goal/Project's id, plus "progressUnit"/"progressTarget" if the household described how progress is measured, e.g. "chapters" / 12) works both ways -- a single step on its own when the Goal/Project already exists, or a compound step with "linkedKindId" set to "$ref:sN" when it's being created in the same bundle.

Attention: attention below lists Projects/Goals/Practices that are overdue, stalled with nothing scheduled soon, or have nothing attached yet. Mention these proactively when relevant -- especially if asked something like "what should I focus on" or "what's falling behind" -- rather than only reacting to direct questions about a specific one.

Resources: existingResources below is the household's list of tools/locations/apps things get tracked in or done with (e.g. a notebook, an app, a calendar) -- reference these by name when relevant (e.g. suggesting where to log something), but they aren't something you create or assign directly.

${entityContext ? `This conversation was opened from a specific ${ENTITY_FAMILY_LABELS[entityContext.family] || entityContext.family}: ${JSON.stringify(entityContext)}. Prefer proposing updates to it (opType "update-${entityContext.family}", targetId "${entityContext.id}") when the conversation is about changing it -- treat "this", "it", "that" as referring to it unless the household clearly means something else.` : ''}

${today ? `Today's date is ${today} (ISO, YYYY-MM-DD) -- resolve every relative day ("today," "tomorrow," "next Tuesday," "this week") against this, never against whatever dates happen to appear in existingItems.` : ''}

${activeHours ? `The household's usual active hours run ${activeHours.startHour}:00-${activeHours.endHour}:00 -- prefer this window when picking a time yourself (see "Suggesting a time" below); it's a display preference, not a hard rule, so a time the household names explicitly outside it is still fine.` : ''}

existingKinds (id/title/kindType/domain, for parentKindId/targetId matching): ${JSON.stringify(existingKinds)}

existingItems (id/title/domain/targetDay/floating/time/durationMinutes -- today through the next 2 weeks, for scheduling/overlap checks and general awareness): ${JSON.stringify(existingItems)}

practiceHabits (id/title/categoryId/todayItemId/todayDone/weekDoneCount out of weekTotalDays; goal-linked ones also carry linkedKindId/linkedKindTitle/progressUnit/progressCurrent/progressTarget/progressMode): ${JSON.stringify(practiceHabits)}

disciplines (id/title/type/focused/streakDays/nextMilestoneLabel/daysToNextMilestone -- every unresolved one, focused or not): ${JSON.stringify(disciplines)}

attention (id/title/kindType/domain/level/label/hint -- Kinds needing a next step): ${JSON.stringify(attention)}

existingResources: ${JSON.stringify(existingResources)}`;

  const messages = history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }));
  // 1536 was too tight for a compound bundle plus an in-character reply --
  // a real conversation hit it and got truncated mid-JSON ("Claude's
  // response wasn't valid JSON"). 3072 gives real headroom; the tightened
  // compound-step field guidance above also cuts typical output size.
  const responseText = await callClaude({ system, messages, maxTokens: 3072 });

  let parsed;
  try {
    parsed = parseJson(responseText);
  } catch (err) {
    console.error('Failed to parse secretaryChat response as JSON', responseText, err);
    // A malformed/truncated response shouldn't be a dead end -- if the
    // "reply" string is still recoverable (the common case: valid JSON up
    // through "reply", cut off partway through "proposedOperation"), fall
    // back to it with no proposed operation rather than surfacing a raw
    // error and losing the conversational turn entirely.
    const replyMatch = responseText.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (replyMatch) {
      try {
        parsed = { reply: JSON.parse(`"${replyMatch[1]}"`), proposedOperation: null };
      } catch { /* fall through to the hard error below */ }
    }
    if (!parsed) throw new HttpsError('internal', "Claude's response wasn't valid JSON.");
  }

  let pendingOperationId = null;
  if (parsed.proposedOperation?.compound) {
    const ops = (Array.isArray(parsed.proposedOperation.steps) ? parsed.proposedOperation.steps : [])
      .map((step) => normalizeCompoundStep(step, practiceHabits))
      .filter(Boolean);
    for (const op of ops) {
      if (op.entityType === 'kind' || op.entityType === 'item') op.patch.createdVia = 'secretary-chat';
    }
    if (ops.length > 0) {
      pendingOperationId = await createPendingOperation({ opType: 'compound', ops, sourceType: 'chat' });
    }
  } else if (parsed.proposedOperation) {
    const draft = parsed.proposedOperation;
    if (draft.opType === 'update-discipline') {
      if (draft.targetId) {
        const patch = disciplinePatch(draft);
        pendingOperationId = await createPendingOperation({ opType: 'update-discipline', targetId: draft.targetId, patch, sourceType: 'chat' });
      }
    } else if (draft.opType === 'update-practiceHabit') {
      if (draft.targetId) {
        const patch = practiceHabitPatch(draft);
        pendingOperationId = await createPendingOperation({ opType: 'update-practiceHabit', targetId: draft.targetId, patch, sourceType: 'chat' });
      }
    } else {
      const family = draft.family === 'kind' ? 'kind' : 'item';
      const patch = family === 'kind' ? kindPatch(draft) : itemPatch(draft, practiceHabits);
      patch.createdVia = 'secretary-chat';
      if (draft.opType?.startsWith('update') && draft.targetId) {
        pendingOperationId = await createPendingOperation({ opType: draft.opType, targetId: draft.targetId, patch, sourceType: 'chat' });
      } else {
        pendingOperationId = await createPendingOperation({ opType: family === 'kind' ? 'create-kind' : 'create-item', patch, sourceType: 'chat' });
      }
    }
  }

  return { result: { reply: parsed.reply || '', pendingOperationId, proposedOperation: parsed.proposedOperation || null } };
});
