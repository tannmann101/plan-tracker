const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

// Unlike firestore.rules' household-wide isAllowed(), Secretary's AI
// functions are owner-only -- Rochelle's account is read-only across the
// whole app (see isOwnerEmail() in src/constants.js), and capture/triage/the
// weekly-meeting import are all Tanner's own workflow. Keep this in sync
// with isOwnerEmail() by hand.
const OWNER_EMAIL = 'tannerwesgardner@gmail.com';

const MODEL = 'claude-haiku-4-5-20251001';

// Kept in sync by hand with src/constants.js -- functions/ runs in a
// separate Node/CommonJS deploy from the Vite/ESM client bundle, so there's
// no shared import between them (same reasoning firestore.rules uses for
// its own duplicated vocab).
const DOMAIN_IDS = ['finances', 'material', 'teacher', 'tech-admin', 'catchall'];
const TIER_IDS = ['yearly', 'quarterly', 'monthly', 'weekly'];
const CONTENT_TYPE_IDS = [
  'scheduling', 'quick-capture', 'structured-teaching', 'reflective-dialogic',
  'reading', 'systems-architecture', 'execution-finance', 'execution-tech-admin',
  'execution-practices', 'weekly-recap', 'week-at-a-glance', 'long-form-writing',
  'communication', 'reference-media', 'phone-native',
];

function requireOwner(request) {
  const email = request.auth?.token?.email;
  if (!email || email !== OWNER_EMAIL) {
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

// Parses a photo of the handwritten weekly-meeting notebook page into
// Goals-in-context, this week's Plans, their Sessions (domain + content-type
// tagged), and Tasks. Client resolves each Session's content_type to a
// tool_location via the (possibly Settings-edited) routing table -- this
// function only picks the content_type, never a literal tool/location
// string, so an edited routing table is still authoritative.
//
// Never auto-saved: the client shows every extracted item in a full
// checklist for Tanner to review and edit before anything is written to
// Firestore (see src/pages/WeeklyMeetingImport.jsx).
exports.parseWeeklyPhoto = onCall({ secrets: [anthropicApiKey], timeoutSeconds: 120 }, async (request) => {
  requireOwner(request);

  const imageBase64 = request.data?.imageBase64;
  const mediaType = request.data?.mediaType;
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new HttpsError('invalid-argument', 'An imageBase64 string is required.');
  }
  if (!mediaType || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mediaType)) {
    throw new HttpsError('invalid-argument', 'A supported mediaType is required.');
  }

  // existingGoals lets Claude attach this week's Plans to a Goal already in
  // the system (by id) instead of guessing a title match -- optional so the
  // very first weekly meeting (no Goals yet) still works.
  const existingGoals = Array.isArray(request.data?.existingGoals) ? request.data.existingGoals : [];

  const system = `You read a photo of a handwritten household weekly-planning notebook page and extract its structure as JSON. Respond with ONLY a single JSON object, no prose, no markdown fences.

Schema:
{
  "goals": [{ "title": string, "tier": one of ${JSON.stringify(TIER_IDS)}, "domain": one of ${JSON.stringify(DOMAIN_IDS)}, "existingGoalId": string or null }],
  "plans": [{ "title": string, "domain": one of ${JSON.stringify(DOMAIN_IDS)}, "goalTitle": string or null }],
  "sessions": [{ "title": string, "planTitle": string, "domain": one of ${JSON.stringify(DOMAIN_IDS)}, "contentType": one of ${JSON.stringify(CONTENT_TYPE_IDS)}, "targetDay": string or null }],
  "tasks": [{ "title": string, "sessionTitle": string, "date": string or null }]
}

Rules:
- "goals" are any yearly/quarterly/monthly/weekly goals visible or referenced on the page, at whatever tiers actually appear -- don't invent tiers that aren't there. If a goal on the page matches one in existingGoals by title/meaning, set existingGoalId to that goal's id and still include the entry (so the client can match it up); otherwise existingGoalId is null.
- "plans" are this week's plans of action; goalTitle links a plan to a goal's title from the "goals" array (or an existingGoals title) when the page shows that link, else null.
- "sessions" are the individual planned sessions under a plan; planTitle must match a "plans" title exactly. Pick contentType by what kind of activity the session actually is (see the routing table's vocabulary) -- e.g. a reading session is "reading", a scheduling block is "scheduling", a finance task is "execution-finance". targetDay is an ISO date (YYYY-MM-DD) if the page states or implies one, else null.
- "tasks" are concrete action items under a session; sessionTitle must match a "sessions" title exactly. date is an ISO date if stated/implied, else null.
- If the page doesn't clearly contain an item type, return an empty array for it -- do not invent content.
- Dates: infer year from context if only month/day is given; if no year is inferable, omit the date field (use null) rather than guessing.

existingGoals (for matching only, not to be echoed back verbatim): ${JSON.stringify(existingGoals)}`;

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

  return { result: parsed };
});

// Takes arbitrary captured text/context and returns a structured triage
// decision: relevance, level, domain/content-type placement, and an
// alignment check against existing Goals. When confidence is low, includes
// a clarifyingQuestion so the client's confirmation modal can hold a real
// back-and-forth instead of forcing a guess into a form field.
//
// This is a draft only -- src/pages/Capture.jsx never writes it to
// Firestore until Tanner accepts (or answers through) the confirmation
// step, same draft-then-accept discipline as roc-workspace's AIAssist.
exports.triageCapture = onCall({ secrets: [anthropicApiKey], timeoutSeconds: 60 }, async (request) => {
  requireOwner(request);

  const text = request.data?.text;
  if (!text || typeof text !== 'string') {
    throw new HttpsError('invalid-argument', 'A text string is required.');
  }

  const existingGoals = Array.isArray(request.data?.existingGoals) ? request.data.existingGoals : [];
  const priorAnswers = Array.isArray(request.data?.priorAnswers) ? request.data.priorAnswers : [];

  const system = `You are Secretary, a formal, courteous, old-fashioned household secretary triaging a captured note for your employer. Respond with ONLY a single JSON object, no prose, no markdown fences.

Schema:
{
  "relevance": "in-system" or "unmanaged",
  "level": one of ["task", "session", "plan", "goal", "project"] or null (null only if relevance is "unmanaged"),
  "title": string (a clean, short title for the item),
  "domain": one of ${JSON.stringify(DOMAIN_IDS)} or null,
  "contentType": one of ${JSON.stringify(CONTENT_TYPE_IDS)} or null (only relevant when level is "session"),
  "alignment": {
    "type": one of ["existing-goal", "new-goal-suggestion", "new-project-suggestion", "drift"],
    "goalId": string or null (an id from existingGoals, only when type is "existing-goal"),
    "note": string (one sentence explaining the alignment call)
  },
  "confidence": "high" or "low",
  "clarifyingQuestion": string or null (a single genuine follow-up question, only when confidence is "low" and one more answer would resolve it)
}

Rules:
- "relevance": "unmanaged" means this belongs to the ordinary unmanaged ~20-25% of life and should be logged and discarded, not placed -- level, domain, contentType, alignment should reflect that (level null, alignment.type "drift").
- "level": Task for a single concrete action; Session for a themed working block; Plan for a multi-session effort; Goal for a yearly/quarterly/monthly/weekly aim; Project for an atypical personal initiative outside existing goals (especially one that touches shared/family resources).
- "alignment": prefer "existing-goal" (with goalId) whenever the capture clearly serves a goal in existingGoals. Use "new-goal-suggestion" or "new-project-suggestion" when it looks like it should become one but doesn't exist yet -- never invent the goal/project yourself, only flag it. Use "drift" when it serves nothing you can identify.
- Only set confidence "low" when placement is genuinely ambiguous in a way one more question would resolve -- most captures should resolve at "high" confidence. Keep clarifyingQuestion short, specific, and in Secretary's voice (courteous, precise, unhurried) -- e.g. "Shall I file this under Tech/Admin, or does it belong with the Catch-All practices you keep?" Never ask a question a decisive human wouldn't need to.

existingGoals (id/title/tier/domain, for alignment matching): ${JSON.stringify(existingGoals)}
${priorAnswers.length ? `\nThis capture has already been through one or more rounds of clarification. Prior Q&A (most recent last): ${JSON.stringify(priorAnswers)}\nUse these answers to resolve to confidence "high" if at all possible -- avoid asking a second question unless truly necessary.` : ''}`;

  const messages = [{ role: 'user', content: `Captured text: ${text}` }];

  const responseText = await callClaude({ system, messages, maxTokens: 1024 });
  let parsed;
  try {
    parsed = parseJson(responseText);
  } catch (err) {
    console.error('Failed to parse triageCapture response as JSON', responseText, err);
    throw new HttpsError('internal', "Claude's response wasn't valid JSON.");
  }

  return { result: parsed };
});
