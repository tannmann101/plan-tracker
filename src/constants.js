// constants.js
// Secretary's fixed vocabularies -- kept in one place since they're mirrored
// in firestore.rules (isValidGoal/isValidProject/isValidPlan/isValidSession/
// isValidTask) and must stay in sync with it. The two exceptions are
// DEFAULT_DOMAINS and DEFAULT_ROUTING_TABLE: those are *seed* data for the
// editable config docs (config/domains, config/routingTable) Settings lets
// you rewrite without a code change -- see useConfig.js.

// -- Household accounts --------------------------------------------------

export const OWNERS = [
  { id: "tanner", label: "Tanner" },
  { id: "rochelle", label: "Rochelle" },
];

export const ownerLabel = (id) => OWNERS.find((o) => o.id === id)?.label || id;
export const ownerForEmail = (email) => (email === "rochelleygardner@gmail.com" ? "rochelle" : "tanner");

// Only Tanner holds write access -- Rochelle's account is read-only across
// the whole Goal hierarchy and every domain (see firestore.rules' isOwner()
// vs isAllowed()). This is a hardcoded role, not a per-item permission, so
// there's exactly one place that can ever drift out of sync with the rules.
export const isOwnerEmail = (email) => email === "tannerwesgardner@gmail.com";

// -- The five domains ------------------------------------------------------
// id/label/description are the seed for config/domains -- Settings can
// rewrite copy and links without touching code. `generic` marks domains that
// have no dedicated tool yet and fall back to logging inside Secretary
// itself (Tech/Admin, Catch-All); `linkUrl`/`linkLabel` point at a sibling
// app's deployed site for domains that federate out instead.

export const DEFAULT_DOMAINS = [
  {
    id: "finances",
    label: "Finances",
    description: "Household money -- budgets, spending, investments. Lives in Finance Tracker; Secretary tags and links out.",
    linkLabel: "Open Finance Tracker",
    linkUrl: "https://tannmann101.github.io/budget-ledger/",
    generic: false,
  },
  {
    id: "material",
    label: "Material Provisioning",
    description: "Purchases, spending on goods, investments, and trash-vs-sell/deprovision decisions. Connects conceptually to The Workshop's inventory -- no direct integration yet.",
    linkLabel: "Open The Workshop",
    linkUrl: "https://tannmann101.github.io/roc-workspace/",
    generic: false,
  },
  {
    id: "teacher",
    label: "Teacher",
    description: "Instruction for wife and daughter. Links out to the dedicated knowledge/teaching app once it exists.",
    linkLabel: "Knowledge/teaching app (not built yet)",
    linkUrl: "",
    generic: false,
  },
  {
    id: "tech-admin",
    label: "Tech / Admin",
    description: "Inventory and reminders for accounts, devices, leases, registrations, insurance, and bank accounts. No dedicated tool yet -- Sessions log to a generic notebook-style list here until one is built.",
    linkLabel: "",
    linkUrl: "",
    generic: true,
  },
  {
    id: "catchall",
    label: "Catch-All",
    description: "Ecology of practices -- self-maintenance across physical, mental, spiritual, relational, and practical. No dedicated tool yet -- logs generically here, same as Tech/Admin.",
    linkLabel: "",
    linkUrl: "",
    generic: true,
  },
];

export const DOMAIN_IDS = DEFAULT_DOMAINS.map((d) => d.id);
export const domainLabel = (id, domains = DEFAULT_DOMAINS) => domains.find((d) => d.id === id)?.label || id;

// -- Goal tiers --------------------------------------------------------

export const TIERS = [
  { id: "yearly", label: "Yearly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "monthly", label: "Monthly" },
  { id: "weekly", label: "Weekly" },
];

export const TIER_IDS = TIERS.map((t) => t.id);
export const tierLabel = (id) => TIERS.find((t) => t.id === id)?.label || id;

// Rollup order, coarsest first -- yearly Goals nest quarterly, which nest
// monthly, which nest weekly. Used to walk the Goals tree and to validate a
// parent_goal_id points at the next tier up.
export const TIER_ORDER = ["yearly", "quarterly", "monthly", "weekly"];

// -- Shared lifecycle status (Goal / Project / Plan) ------------------------

export const LIFECYCLE_STATUSES = [
  { id: "active", label: "Active" },
  { id: "done", label: "Done" },
  { id: "dropped", label: "Dropped" },
];

export const LIFECYCLE_STATUS_IDS = LIFECYCLE_STATUSES.map((s) => s.id);
export const lifecycleStatusLabel = (id) => LIFECYCLE_STATUSES.find((s) => s.id === id)?.label || id;

// -- Project ---------------------------------------------------------------

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

// Only meaningful when family_scope = touches-family (see worked example:
// "shine the floors" is a personal initiative that touches shared floors, so
// it needs buy-in tracked before the Plan gets built).
export const CONSENT_STATUSES = [
  { id: "pending", label: "Pending" },
  { id: "granted", label: "Granted" },
  { id: "declined", label: "Declined" },
];
export const CONSENT_STATUS_IDS = CONSENT_STATUSES.map((c) => c.id);
export const consentStatusLabel = (id) => CONSENT_STATUSES.find((c) => c.id === id)?.label || id;

// -- Plan --------------------------------------------------------------

export const PARENT_TYPES = ["goal", "project"];

// -- Content-type -> tool/location routing table ----------------------------
// Seed for config/routingTable. A Session's content_type resolves to a
// tool_location through this table; Settings can edit labels/locations
// without a code change. `external` marks entries that point at a sibling
// app's real deployed site (currently only finance); everything else is a
// physical location or app that Secretary just labels, not integrates with.

export const DEFAULT_ROUTING_TABLE = [
  { id: "scheduling", label: "Scheduling / time-blocking", toolLocation: "Google Calendar", external: false },
  { id: "quick-capture", label: "Quick, unsorted capture", toolLocation: "Travel notebook", external: false },
  { id: "structured-teaching", label: "Structured teaching/presentation", toolLocation: "Whiteboard (dinner table)", external: false },
  { id: "reflective-dialogic", label: "Reflective/dialogic conversation", toolLocation: "Thread Notebook", external: false },
  { id: "reading", label: "Reading engagement", toolLocation: "Reading notebook", external: false },
  { id: "systems-architecture", label: "Systems/architecture thinking", toolLocation: "Scratch notebook", external: false },
  { id: "execution-finance", label: "Execution/tracking -- finance", toolLocation: "Finance Tracker", external: true, linkUrl: "https://tannmann101.github.io/budget-ledger/" },
  { id: "execution-tech-admin", label: "Execution/tracking -- tech/admin", toolLocation: "Reserved notebook (generic log)", external: false },
  { id: "execution-practices", label: "Execution/tracking -- practices", toolLocation: "Reserved notebook (generic log)", external: false },
  { id: "weekly-recap", label: "Weekly recap + planning", toolLocation: "Weekly meeting notebook", external: false },
  { id: "week-at-a-glance", label: "Week-at-a-glance", toolLocation: "Weekly view notebook", external: false },
  { id: "long-form-writing", label: "Long-form writing/drafting/curriculum", toolLocation: "M365", external: false },
  { id: "communication", label: "Communication", toolLocation: "Gmail, Outlook, iMessage, Discord", external: false },
  { id: "reference-media", label: "Reference/media consumption", toolLocation: "YouTube, X, Facebook, Libby, Hoopla, Bible apps", external: false },
  { id: "phone-native", label: "Phone-native", toolLocation: "Link capture, sharing, content viewing, bill/finance surface", external: false },
];

export const CONTENT_TYPE_IDS = DEFAULT_ROUTING_TABLE.map((r) => r.id);

export const contentTypeLabel = (id, table = DEFAULT_ROUTING_TABLE) => table.find((r) => r.id === id)?.label || id;
export const toolLocationFor = (contentTypeId, table = DEFAULT_ROUTING_TABLE) =>
  table.find((r) => r.id === contentTypeId)?.toolLocation || "";

// -- Capture / triage --------------------------------------------------

// A captured item's lifecycle: pending-triage is the default; "holding" is
// the explicit "just save for later" escape hatch that skips triage
// entirely; placed/drift/discarded are the three outcomes of triage +
// alignment (see Capture, triage & alignment layer in the spec).
export const CAPTURE_STATUSES = ["pending-triage", "holding", "placed", "drift", "discarded"];

export const ENTITY_LEVELS = ["task", "session", "plan", "goal", "project"];

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const weekStartISO = (d = new Date()) => {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sunday
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
};
