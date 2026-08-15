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

// -- The fifteen domains ----------------------------------------------------
// id/label/description are the seed for config/domains -- Settings can
// rewrite copy and links without touching code. `generic` marks domains that
// have no dedicated tool yet and fall back to logging inside Secretary
// itself; `linkUrl`/`linkLabel` point at a sibling app's deployed site for
// domains that federate out instead.
//
// Replaces the original 5-domain MVP taxonomy (which lumped everything
// non-Finance/Material/Teacher/Tech-admin into one "Catch-All" domain) with
// the specific roles/areas actually in play, per the v2 rework. `projects`
// is a domain distinct from the Project *entity type* -- most Project
// entities will carry this domain, but the two are orthogonal axes (a
// Project can be domain=cleaning just as easily as domain=projects).

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
    id: "career",
    label: "Career / Work",
    description: "Vocational work -- the job itself, professional development, decisions that often also touch a financial or personal goal. No dedicated tool yet.",
    linkLabel: "",
    linkUrl: "",
    generic: true,
  },
  {
    id: "projects",
    label: "Projects",
    description: "One-off personally-initiated work that doesn't fit neatly elsewhere -- most Project entities will carry this domain. No dedicated tool yet.",
    linkLabel: "",
    linkUrl: "",
    generic: true,
  },
  {
    id: "collab",
    label: "Collaborative Projects (Rochelle)",
    description: "Projects undertaken jointly with Rochelle -- distinct from personal Projects since these always touch shared resources. No dedicated tool yet.",
    linkLabel: "",
    linkUrl: "",
    generic: true,
  },
  {
    id: "cleaning",
    label: "Cleaning",
    description: "Household cleaning -- routines and one-off sessions. No dedicated tool yet.",
    linkLabel: "",
    linkUrl: "",
    generic: true,
  },
  {
    id: "repair",
    label: "Repair",
    description: "Fixing what's broken -- the house, devices, vehicles, anything else. No dedicated tool yet.",
    linkLabel: "",
    linkUrl: "",
    generic: true,
  },
  {
    id: "planning",
    label: "Planning",
    description: "Planning as its own activity -- systems-thinking about the plan itself, not the work the plan produces. No dedicated tool yet.",
    linkLabel: "",
    linkUrl: "",
    generic: true,
  },
  {
    id: "weekly-meeting",
    label: "Weekly Meeting",
    description: "Running the weekly meeting and the Weekly View themselves -- prep, follow-up, and upkeep of the ritual, not the items it produces. No dedicated tool yet.",
    linkLabel: "",
    linkUrl: "",
    generic: true,
  },
  {
    id: "reading",
    label: "Reading",
    description: "Reading engagement -- tracked here, executed in the reading notebook per the routing table. No dedicated tool yet.",
    linkLabel: "",
    linkUrl: "",
    generic: true,
  },
  {
    id: "writing",
    label: "Writing",
    description: "Essays and other long-form writing/drafting. No dedicated tool yet.",
    linkLabel: "",
    linkUrl: "",
    generic: true,
  },
  {
    id: "contemplation",
    label: "Contemplation",
    description: "Reflective, unhurried thinking -- distinct from Planning's systems-thinking and Reading's engagement with a text. No dedicated tool yet.",
    linkLabel: "",
    linkUrl: "",
    generic: true,
  },
  {
    id: "ecology-practices",
    label: "Ecology of Practices",
    description: "Self-maintenance practices across physical, mental, spiritual, relational, and practical areas -- the narrower, renamed successor to the old Catch-All domain. No dedicated tool yet.",
    linkLabel: "",
    linkUrl: "",
    generic: true,
  },
];

export const DOMAIN_IDS = DEFAULT_DOMAINS.map((d) => d.id);
export const domainLabel = (id, domains = DEFAULT_DOMAINS) => domains.find((d) => d.id === id)?.label || id;

// Every domain an entity is tagged with -- primary first, then any
// secondaryDomains. Used wherever a Domains dashboard or Trends panel needs
// to show/count an item under all of its domains, not just its primary one.
export const allDomainsFor = (entity) => [entity.domain, ...(entity.secondaryDomains || [])].filter(Boolean);

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
//
// Categories are domain-scoped, not shared -- each domain gets its own
// exclusive set (no id or label reused across domains), since "reading
// engagement" and "bill scheduling" aren't the same kind of thing even when
// they'd resolve to the same calendar. A cross-cutting concept (scheduling,
// communication) still gets its own worded-for-that-domain entry per domain
// rather than one universal category everyone shares.

export const DEFAULT_ROUTING_TABLE = [
  // -- finances --
  { id: "fin-scheduling", domain: "finances", label: "Bill / payment scheduling", toolLocation: "Google Calendar", external: false },
  { id: "fin-execution", domain: "finances", label: "Execution / tracking", toolLocation: "Finance Tracker", external: true, linkUrl: "https://tannmann101.github.io/budget-ledger/" },
  { id: "fin-review", domain: "finances", label: "Budget review & planning", toolLocation: "Finance Tracker", external: true, linkUrl: "https://tannmann101.github.io/budget-ledger/" },
  { id: "fin-research", domain: "finances", label: "Investment research", toolLocation: "Scratch notebook", external: false },
  { id: "fin-capture", domain: "finances", label: "Quick expense capture", toolLocation: "Travel notebook", external: false },
  { id: "fin-comm", domain: "finances", label: "Financial communication", toolLocation: "Gmail, Outlook, iMessage, Discord", external: false },

  // -- material --
  { id: "mat-capture", domain: "material", label: "Quick provisioning capture", toolLocation: "Travel notebook", external: false },
  { id: "mat-scheduling", domain: "material", label: "Purchase timing", toolLocation: "Google Calendar", external: false },
  { id: "mat-research", domain: "material", label: "Product research", toolLocation: "Scratch notebook", external: false },
  { id: "mat-inventory", domain: "material", label: "Inventory check", toolLocation: "Reserved notebook (generic log)", external: false },
  { id: "mat-deprovision", domain: "material", label: "Trash / sell / deprovision decision", toolLocation: "Reserved notebook (generic log)", external: false },
  { id: "mat-comm", domain: "material", label: "Vendor / marketplace communication", toolLocation: "Gmail, Outlook, iMessage, Discord", external: false },

  // -- teacher --
  { id: "tch-dialogic", domain: "teacher", label: "Reflective / dialogic conversation", toolLocation: "Thread Notebook", external: false },
  { id: "tch-teaching-prep", domain: "teacher", label: "Structured teaching / presentation prep", toolLocation: "Whiteboard (dinner table)", external: false },
  { id: "tch-reading", domain: "teacher", label: "Reading engagement", toolLocation: "Reading notebook", external: false },
  { id: "tch-curriculum", domain: "teacher", label: "Long-form curriculum drafting", toolLocation: "M365", external: false },
  { id: "tch-scheduling", domain: "teacher", label: "Lesson scheduling", toolLocation: "Google Calendar", external: false },
  { id: "tch-reference", domain: "teacher", label: "Reference / media for teaching", toolLocation: "YouTube, X, Facebook, Libby, Hoopla, Bible apps", external: false },

  // -- tech-admin --
  { id: "adm-execution", domain: "tech-admin", label: "Account / device execution & tracking", toolLocation: "Reserved notebook (generic log)", external: false },
  { id: "adm-scheduling", domain: "tech-admin", label: "Renewal / registration scheduling", toolLocation: "Google Calendar", external: false },
  { id: "adm-inventory", domain: "tech-admin", label: "Passive inventory check", toolLocation: "Reserved notebook (generic log)", external: false },
  { id: "adm-capture", domain: "tech-admin", label: "Quick admin capture", toolLocation: "Travel notebook", external: false },
  { id: "adm-comm", domain: "tech-admin", label: "Admin / vendor communication", toolLocation: "Gmail, Outlook, iMessage, Discord", external: false },

  // -- career --
  { id: "car-scheduling", domain: "career", label: "Meeting / interview scheduling", toolLocation: "Google Calendar", external: false },
  { id: "car-development", domain: "career", label: "Professional development", toolLocation: "Scratch notebook", external: false },
  { id: "car-execution", domain: "career", label: "Work execution & tracking", toolLocation: "Reserved notebook (generic log)", external: false },
  { id: "car-comm", domain: "career", label: "Work communication", toolLocation: "Gmail, Outlook, iMessage, Discord", external: false },
  { id: "car-reflection", domain: "career", label: "Career reflection", toolLocation: "Thread Notebook", external: false },

  // -- projects --
  { id: "prj-capture", domain: "projects", label: "Quick idea capture", toolLocation: "Travel notebook", external: false },
  { id: "prj-planning", domain: "projects", label: "Project planning / systems thinking", toolLocation: "Scratch notebook", external: false },
  { id: "prj-scheduling", domain: "projects", label: "Work session scheduling", toolLocation: "Google Calendar", external: false },
  { id: "prj-execution", domain: "projects", label: "Execution & tracking", toolLocation: "Reserved notebook (generic log)", external: false },
  { id: "prj-writeup", domain: "projects", label: "Long-form writeup", toolLocation: "M365", external: false },

  // -- collab (Collaborative Projects with Rochelle) --
  { id: "col-dialogic", domain: "collab", label: "Joint planning conversation", toolLocation: "Thread Notebook", external: false },
  { id: "col-scheduling", domain: "collab", label: "Shared work session scheduling", toolLocation: "Google Calendar", external: false },
  { id: "col-consent", domain: "collab", label: "Consent / buy-in discussion", toolLocation: "Reserved notebook (generic log)", external: false },
  { id: "col-execution", domain: "collab", label: "Execution & tracking", toolLocation: "Reserved notebook (generic log)", external: false },
  { id: "col-comm", domain: "collab", label: "Coordination messages", toolLocation: "Gmail, Outlook, iMessage, Discord", external: false },

  // -- cleaning --
  { id: "cln-scheduling", domain: "cleaning", label: "Cleaning session scheduling", toolLocation: "Google Calendar", external: false },
  { id: "cln-execution", domain: "cleaning", label: "Cleaning session tracking", toolLocation: "Reserved notebook (generic log)", external: false },
  { id: "cln-capture", domain: "cleaning", label: "Quick cleaning-task capture", toolLocation: "Travel notebook", external: false },

  // -- repair --
  { id: "rep-capture", domain: "repair", label: "Quick repair-need capture", toolLocation: "Travel notebook", external: false },
  { id: "rep-scheduling", domain: "repair", label: "Repair appointment scheduling", toolLocation: "Google Calendar", external: false },
  { id: "rep-research", domain: "repair", label: "Repair research / troubleshooting", toolLocation: "Scratch notebook", external: false },
  { id: "rep-execution", domain: "repair", label: "Repair tracking", toolLocation: "Reserved notebook (generic log)", external: false },
  { id: "rep-comm", domain: "repair", label: "Repair-vendor communication", toolLocation: "Gmail, Outlook, iMessage, Discord", external: false },

  // -- planning --
  { id: "pln-systems", domain: "planning", label: "Systems / architecture thinking", toolLocation: "Scratch notebook", external: false },
  { id: "pln-scheduling", domain: "planning", label: "Time-blocking", toolLocation: "Google Calendar", external: false },
  { id: "pln-reflection", domain: "planning", label: "Planning reflection", toolLocation: "Thread Notebook", external: false },
  { id: "pln-capture", domain: "planning", label: "Quick planning capture", toolLocation: "Travel notebook", external: false },

  // -- weekly-meeting --
  { id: "wkm-recap", domain: "weekly-meeting", label: "Weekly recap + planning", toolLocation: "Weekly meeting notebook", external: false },
  { id: "wkm-glance", domain: "weekly-meeting", label: "Week-at-a-glance", toolLocation: "Weekly view notebook", external: false },
  { id: "wkm-prep", domain: "weekly-meeting", label: "Meeting prep", toolLocation: "Scratch notebook", external: false },
  { id: "wkm-followup", domain: "weekly-meeting", label: "Meeting follow-up", toolLocation: "Thread Notebook", external: false },

  // -- reading --
  { id: "rdg-engagement", domain: "reading", label: "Reading engagement", toolLocation: "Reading notebook", external: false },
  { id: "rdg-scheduling", domain: "reading", label: "Reading time scheduling", toolLocation: "Google Calendar", external: false },
  { id: "rdg-reference", domain: "reading", label: "Reference / media consumption", toolLocation: "YouTube, X, Facebook, Libby, Hoopla, Bible apps", external: false },
  { id: "rdg-reflection", domain: "reading", label: "Reading reflection", toolLocation: "Thread Notebook", external: false },
  { id: "rdg-capture", domain: "reading", label: "Quick reading-list capture", toolLocation: "Travel notebook", external: false },

  // -- writing --
  { id: "wrt-drafting", domain: "writing", label: "Long-form writing / drafting", toolLocation: "M365", external: false },
  { id: "wrt-research", domain: "writing", label: "Research for writing", toolLocation: "Scratch notebook", external: false },
  { id: "wrt-scheduling", domain: "writing", label: "Writing session scheduling", toolLocation: "Google Calendar", external: false },
  { id: "wrt-capture", domain: "writing", label: "Quick idea capture", toolLocation: "Travel notebook", external: false },

  // -- contemplation --
  { id: "ctm-reflection", domain: "contemplation", label: "Reflective / dialogic conversation", toolLocation: "Thread Notebook", external: false },
  { id: "ctm-reading", domain: "contemplation", label: "Contemplative reading", toolLocation: "Reading notebook", external: false },
  { id: "ctm-scheduling", domain: "contemplation", label: "Contemplation time scheduling", toolLocation: "Google Calendar", external: false },
  { id: "ctm-capture", domain: "contemplation", label: "Quick capture", toolLocation: "Travel notebook", external: false },

  // -- ecology-practices --
  { id: "eco-execution", domain: "ecology-practices", label: "Practice-log execution / tracking", toolLocation: "Reserved notebook (generic log)", external: false },
  { id: "eco-scheduling", domain: "ecology-practices", label: "Practice scheduling", toolLocation: "Google Calendar", external: false },
  { id: "eco-capture", domain: "ecology-practices", label: "Quick capture", toolLocation: "Travel notebook", external: false },
  { id: "eco-reflection", domain: "ecology-practices", label: "Practice reflection", toolLocation: "Thread Notebook", external: false },
];

export const CONTENT_TYPE_IDS = DEFAULT_ROUTING_TABLE.map((r) => r.id);

export const contentTypeLabel = (id, table = DEFAULT_ROUTING_TABLE) => table.find((r) => r.id === id)?.label || id;
export const toolLocationFor = (contentTypeId, table = DEFAULT_ROUTING_TABLE) =>
  table.find((r) => r.id === contentTypeId)?.toolLocation || "";

// The categories available for a given domain -- what every content-type
// dropdown filters to, so a Session's category options are always exclusive
// to whichever domain is selected rather than one shared universal list.
export const contentTypesForDomain = (domainId, table = DEFAULT_ROUTING_TABLE) =>
  table.filter((r) => r.domain === domainId);

// A sensible starting category when a domain is picked (or changed) without
// one already chosen -- prefers a "quick capture"-style entry if the domain
// has one, else just the domain's first category.
export const defaultContentTypeForDomain = (domainId, table = DEFAULT_ROUTING_TABLE) => {
  const options = contentTypesForDomain(domainId, table);
  return options.find((o) => o.id.endsWith("-capture"))?.id || options[0]?.id || "";
};

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
