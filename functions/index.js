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
  };
}

function itemPatch(draft) {
  return {
    title: draft.title,
    itemType: ITEM_TYPE_IDS.includes(draft.itemType) ? draft.itemType : 'task',
    domain: DOMAIN_IDS.includes(draft.domain) ? draft.domain : 'head-of-household',
    secondaryDomains: Array.isArray(draft.secondaryDomains) ? draft.secondaryDomains.filter((d) => DOMAIN_IDS.includes(d)) : [],
    resources: Array.isArray(draft.resources) ? draft.resources : [],
    tags: Array.isArray(draft.tags) ? draft.tags : [],
    parentKindId: draft.parentKindId || null,
    timing: draft.targetDay ? { targetDay: draft.targetDay, floating: true } : null,
    done: false,
  };
}

// Writes a pendingOperation -- the one path, server-side, that every AI
// draft in this file goes through. Nothing here ever touches /kinds or
// /items directly; that only happens client-side, after a human approves
// the operation from the Secretary review log (§5).
async function createPendingOperation({ opType, targetId, patch, sourceCaptureId, sourceType }) {
  const now = Date.now();
  const ref = await db.collection('pendingOperations').add({
    opType,
    targetId: targetId || null,
    patch,
    sourceCaptureId: sourceCaptureId || null,
    sourceType,
    status: 'pending',
    createdAt: now,
  });
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

  const system = `You are Secretary, a formal, courteous, old-fashioned household secretary having a conversation with your employer. You can discuss scheduling, help sequence milestones, and draft new Kinds/Items or edits to existing ones -- but you never write anything yourself. Respond with ONLY a single JSON object, no prose, no markdown fences.

Schema:
{
  "reply": string (your conversational reply, in Secretary's voice -- courteous, precise, unhurried),
  "proposedOperation": null, or:
  {
    "opType": one of ["create-kind", "create-item", "update-kind", "update-item"],
    "targetId": string or null (required, and must be an id from existingKinds/entityContext, when opType starts with "update"),
    "family": "kind" or "item",
    "title": string, "kindType": string or null, "itemType": string or null,
    "domain": one of ${JSON.stringify(DOMAIN_IDS)}, "secondaryDomains": [string], "tags": [string],
    "targetDay": string or null, "parentKindId": string or null,
    "note": string (one sentence explaining the proposal)
  }
}

Only set proposedOperation when the conversation actually calls for creating or changing a Kind/Item -- most turns should just be a reply with proposedOperation null. Never invent an update to something the household didn't ask to change.

${entityContext ? `This conversation was opened from a specific ${entityContext.family === 'kind' ? 'Kind' : 'Item'}: ${JSON.stringify(entityContext)}. Prefer proposing updates to it (opType "update-${entityContext.family}", targetId "${entityContext.id}") when the conversation is about changing it.` : ''}

existingKinds (id/title/kindType/domain, for parentKindId/targetId matching): ${JSON.stringify(existingKinds)}`;

  const messages = history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }));
  const responseText = await callClaude({ system, messages, maxTokens: 1536 });

  let parsed;
  try {
    parsed = parseJson(responseText);
  } catch (err) {
    console.error('Failed to parse secretaryChat response as JSON', responseText, err);
    throw new HttpsError('internal', "Claude's response wasn't valid JSON.");
  }

  let pendingOperationId = null;
  if (parsed.proposedOperation) {
    const draft = parsed.proposedOperation;
    const family = draft.family === 'kind' ? 'kind' : 'item';
    const patch = family === 'kind' ? kindPatch(draft) : itemPatch(draft);
    patch.createdVia = 'secretary-chat';
    if (draft.opType?.startsWith('update') && draft.targetId) {
      pendingOperationId = await createPendingOperation({ opType: draft.opType, targetId: draft.targetId, patch, sourceType: 'chat' });
    } else {
      pendingOperationId = await createPendingOperation({ opType: family === 'kind' ? 'create-kind' : 'create-item', patch, sourceType: 'chat' });
    }
  }

  return { result: { reply: parsed.reply || '', pendingOperationId, proposedOperation: parsed.proposedOperation || null } };
});
