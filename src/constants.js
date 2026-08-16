// constants.js
// Secretary's fixed vocabularies -- kept in one place since they're mirrored
// in firestore.rules (isValidKind/isValidItem/isValidPracticeHabit/
// isValidPendingOperation) and must stay in sync with it. The exceptions are
// DEFAULT_DOMAINS, DEFAULT_RESOURCES, and DEFAULT_PRACTICE_CATEGORIES: those
// are *seed* data for the editable config docs (config/domains,
// config/resources, config/practiceCategories) Settings lets you rewrite
// without a code change -- see useSecretary.js.

// -- Household accounts --------------------------------------------------
// Both accounts have identical write access now (see firestore.rules'
// isAllowed()) -- there is no owner/viewer split left. OWNERS/ownerLabel
// stay only as a labeling vocabulary (who initiated a Project, who's
// speaking in Secretary chat), not a permission gate.

export const OWNERS = [
  { id: "tanner", label: "Tanner" },
  { id: "rochelle", label: "Rochelle" },
];

export const ownerLabel = (id) => OWNERS.find((o) => o.id === id)?.label || id;
export const ownerForEmail = (email) => (email === "rochelleygardner@gmail.com" ? "rochelle" : "tanner");

// -- The seven domains ----------------------------------------------------
// id/label/description are the seed for config/domains -- Settings can
// rewrite copy without touching code. `subScope` is reference text only
// (shown as a hint in the Add Form and used to seed tag suggestions), not a
// rigid sub-taxonomy the way the old content-type routing table was.
//
// Replaces the fifteen-domain set (and its domain-exclusive content-type
// routing table) from the prior rework -- tags now carry the specificity
// that used to live in per-domain category ids.

export const DEFAULT_DOMAINS = [
  {
    id: "creative",
    label: "Creative",
    description: "Writing, music, videos, audio, art, app dev, story, entertainment/fun, social media.",
    subScope: "writing, music, videos, audio, art, app dev, story, entertainment/fun, social media",
  },
  {
    id: "vocation",
    label: "Vocation",
    description: "Work-week, meetings, projects, on-call, weekend shifts, overtime, certifications, travel.",
    subScope: "work-week, meetings, projects, on-call, weekend shifts, overtime, certifications, travel",
  },
  {
    id: "education",
    label: "Education",
    description: "Reading, writing, parenting, curriculum, lessons, study, research, study plans.",
    subScope: "reading, writing, parenting, curriculum, lessons, study, research, study plans",
  },
  {
    id: "head-of-household",
    label: "Head of Household",
    description: "Finances, material provisioning, weekly meeting, tech/admin, home maintenance, repair, security, planning, tasking, goal setting, scheduling, organizing, optimizing.",
    subScope: "finances, material provisioning, weekly meeting, tech/admin, home maintenance, repair, security, planning, tasking, goal setting, scheduling, organizing, optimizing",
  },
  {
    id: "projects",
    label: "Projects",
    description: "Solo (creative/vocational/educational/HoH) and collaborative with Rochelle.",
    subScope: "solo projects, collaborative projects with Rochelle",
  },
  {
    id: "practices",
    label: "Practices",
    description: "Contemplative, meditative, exercise, flexibility, routines, diet, fasting, prayer, reading, note-taking, studying/research, writing, participatory.",
    subScope: "contemplative, meditative, exercise, flexibility, routines, diet, fasting, prayer, reading, note-taking, studying/research, writing, participatory",
  },
  {
    id: "goals",
    label: "Goals",
    description: "Meta-work: goal-setting sessions, quarterly reviews, etc. -- the activity of goal management itself, distinct from a Goal-kind entity (an actual Goal can live in any domain).",
    subScope: "goal-setting sessions, quarterly/annual reviews, goal-system upkeep",
  },
];

export const DOMAIN_IDS = DEFAULT_DOMAINS.map((d) => d.id);
export const domainLabel = (id, domains = DEFAULT_DOMAINS) => domains.find((d) => d.id === id)?.label || id;

// Every domain an entity is tagged with -- primary first, then any
// secondaryDomains. Used wherever a dashboard/Trends panel needs to
// show/count an item under all of its domains, not just its primary one.
export const allDomainsFor = (entity) => [entity.domain, ...(entity.secondaryDomains || [])].filter(Boolean);

// -- Resources (replaces the content-type -> tool/location routing table) --
// Flat, not domain-scoped -- any resource can be used from any domain. Seed
// for config/resources; Settings/Workspace can rewrite the list without a
// code change (see §3.2 of the redesign spec).

export const DEFAULT_RESOURCES = [
  "Finance Tracker", "Weekly view notebook", "Weekly meeting notebook", "Tanner notebook",
  "Practices notebook", "Goals/Projects notebook", "Thread notebook", "Travel notebook",
  "Reading notebook", "Scratch notebook", "Google Calendar", "Whiteboard", "Gmail", "Outlook",
  "iMessage", "Discord", "Facebook Messenger", "Facebook", "X", "YouTube", "Libby", "Hoopla",
  "Bible app (translations)", "Bible app (Orthodox Study Bible w/ Church Fathers notes)",
  "M365 Suite", "Claude Pro", "Secretary App", "Teacher App",
];

export const resourceLabel = (id) => id;

// -- Kind / Item vocab -------------------------------------------------

export const KIND_TYPES = [
  { id: "project", label: "Project" },
  { id: "goal", label: "Goal" },
  { id: "practice", label: "Practice" },
];
export const KIND_TYPE_IDS = KIND_TYPES.map((k) => k.id);
export const kindTypeLabel = (id) => KIND_TYPES.find((k) => k.id === id)?.label || id;

export const ITEM_TYPES = [
  { id: "task", label: "Task" },
  { id: "session", label: "Session" },
  { id: "prep", label: "Prep" },
  { id: "errand", label: "Errand" },
  { id: "other", label: "Other" },
];
export const ITEM_TYPE_IDS = ITEM_TYPES.map((i) => i.id);
export const itemTypeLabel = (id) => ITEM_TYPES.find((i) => i.id === id)?.label || id;

// A timed (non-floating) Item's block length on the Day/Week time-grid
// (§ time-blocking). Stored as timing.durationMinutes -- select-driven
// rather than free text so blocks stay grid-friendly. Defaults to 30 when
// an existing timed Item predates this field.
export const DURATION_OPTIONS = [
  { id: "15", label: "15 min" },
  { id: "30", label: "30 min" },
  { id: "45", label: "45 min" },
  { id: "60", label: "1 hr" },
  { id: "90", label: "1.5 hr" },
  { id: "120", label: "2 hr" },
  { id: "180", label: "3 hr" },
];
export const DEFAULT_DURATION_MINUTES = 30;

// Drives the Plans kanban (§9.2) -- Still Needed -> Queue -> In Progress ->
// Almost Done -> Done. "in-progress" can be auto-promoted into by an Item
// save (see lib/graph.js's maybePromoteKindStatus) but is always
// drag-overridable afterward -- one write direction, not two collections
// polling each other.
export const KIND_STATUSES = [
  { id: "not-started", label: "Still Needed" },
  { id: "queued", label: "Queue" },
  { id: "in-progress", label: "In Progress" },
  { id: "almost-done", label: "Almost Done" },
  { id: "done", label: "Done" },
];
export const KIND_STATUS_IDS = KIND_STATUSES.map((s) => s.id);
export const kindStatusLabel = (id) => KIND_STATUSES.find((s) => s.id === id)?.label || id;

export const CREATED_VIA_VALUES = ["add-form", "capture", "secretary-chat", "weekly-import"];

// -- Project-carried fields (unchanged from the prior rework) --------------

export const INITIATORS = [
  { id: "me", label: "Me" },
  { id: "wife", label: "Wife" },
];
export const INITIATOR_IDS = INITIATORS.map((i) => i.id);
export const initiatorLabel = (id) => INITIATORS.find((i) => i.id === id)?.label || id;

export const FAMILY_SCOPES = [
  { id: "personal", label: "Personal" },
  { id: "touches-family", label: "Touches Family" },
];
export const FAMILY_SCOPE_IDS = FAMILY_SCOPES.map((f) => f.id);
export const familyScopeLabel = (id) => FAMILY_SCOPES.find((f) => f.id === id)?.label || id;

export const CONSENT_STATUSES = [
  { id: "pending", label: "Pending" },
  { id: "granted", label: "Granted" },
  { id: "declined", label: "Declined" },
];
export const CONSENT_STATUS_IDS = CONSENT_STATUSES.map((c) => c.id);
export const consentStatusLabel = (id) => CONSENT_STATUSES.find((c) => c.id === id)?.label || id;

// -- Practices ---------------------------------------------------------
// Seed for config/practiceCategories -- add/remove categories without a
// code change (§9.1). Sub-tracking (strength/flexibility under Fitness,
// diet/habits under Health) is left to tags, not a rigid nested schema.

export const DEFAULT_PRACTICE_CATEGORIES = [
  { id: "meditative", label: "Meditative" },
  { id: "contemplative", label: "Contemplative" },
  { id: "fitness", label: "Fitness" },
  { id: "health", label: "Health" },
  { id: "philosophia", label: "Philosophia" },
];

// -- Capture / review ----------------------------------------------------
// A capture is just the raw intake record now -- triage always produces a
// pendingOperation for review, never a direct write (see lib/claude.js,
// pages/Secretary.jsx). "triaging" while Claude is drafting the proposal,
// "proposed" once a pendingOperation exists for it, "discarded" if
// rejected outright before triage even ran.
export const CAPTURE_STATUSES = ["triaging", "proposed", "discarded"];

// pendingOperations: the one shared queue every AI draft (capture triage,
// Secretary chat, weekly-meeting import) writes into, and the Secretary
// page's review log reads from -- never applied to kinds/items directly.
export const PENDING_OP_TYPES = ["create-kind", "create-item", "update-kind", "update-item"];
export const PENDING_OP_STATUSES = ["pending", "approved", "discarded"];
export const UNSORTED_FLAG_DAYS = 3;

// The one place a Date turns into a "YYYY-MM-DD" string -- reads the
// Date's own local year/month/day fields directly rather than going
// through `.toISOString()`, which converts to UTC first and silently
// shifts the calendar day for anyone not sitting exactly at UTC. Every
// other date-arithmetic helper in the app (todayISO, weekStartISO, the
// day-grid helpers in Today/ThisWeek/Plans/Workspace/CalendarMonthView)
// is built on this, so there is exactly one place that conversion happens.
export const isoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const todayISO = () => isoDate(new Date());

// Monday-start, per the Week/Calendar page's column layout (§7.2).
export const weekStartISO = (d = new Date()) => {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sunday .. 6 = Saturday
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return isoDate(date);
};

// `n` days after (or before, for negative `n`) a "YYYY-MM-DD" string --
// shared by every page that lays days out in a strip or grid (Today,
// Week/Calendar, Plans, Workspace), so this date math exists in one place.
export const addDaysISO = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
};
