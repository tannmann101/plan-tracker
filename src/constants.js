// constants.js
// The Item schema's fixed vocabularies -- kept in one place since they're
// mirrored in firestore.rules (isValidItem) and must stay in sync with it.

export const DOMAINS = [
  { id: "financial", label: "Financial" },
  { id: "material", label: "Material" },
  { id: "health-fitness", label: "Health & Fitness" },
  { id: "vocational-career", label: "Vocational / Career" },
  { id: "relational", label: "Relational" },
  { id: "chores", label: "Chores" },
  { id: "cross-domain", label: "Cross-Domain" },
  { id: "other", label: "Other" },
];

export const STATUSES = [
  { id: "open", label: "Open" },
  { id: "in-progress", label: "In Progress" },
  { id: "scheduled", label: "Scheduled" },
  { id: "needs-review", label: "Needs Review" },
  { id: "done", label: "Done" },
  { id: "dropped", label: "Dropped" },
];

// Statuses that still need attention -- surfaced in Weekly Triage, Today,
// and the staleness check below. Scheduled and needs-review are both
// still-actionable, unresolved states, same as open/in-progress.
export const OPEN_STATUSES = ["open", "in-progress", "scheduled", "needs-review"];

// Kind and effort are a second axis, orthogonal to domain -- what sort of
// work this is and how big it is, not which area of life it belongs to.
// Both optional (like targetDate) so items saved before this existed still
// validate; the form always sets a default on new items.
export const KINDS = [
  { id: "one-off", label: "One-off" },
  { id: "quick-task", label: "Quick Task" },
  { id: "question-mark", label: "Question Mark" },
  { id: "project", label: "Project" },
];

export const EFFORTS = [
  { id: "quick", label: "Quick (<30 min)" },
  { id: "medium", label: "Medium (one sitting)" },
  { id: "large", label: "Large (multi-session)" },
];

// Who owns the item -- the two accounts allow-listed in firestore.rules.
// Optional (like kind/effort) so items saved before this existed still
// validate; the form defaults it to whoever's currently signed in.
export const OWNERS = [
  { id: "tanner", label: "Tanner" },
  { id: "rochelle", label: "Rochelle" },
];

export const domainLabel = (id) => DOMAINS.find((d) => d.id === id)?.label || id;
export const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label || id;
export const kindLabel = (id) => KINDS.find((k) => k.id === id)?.label || id;
export const effortLabel = (id) => EFFORTS.find((e) => e.id === id)?.label || id;
export const ownerLabel = (id) => OWNERS.find((o) => o.id === id)?.label || id;
export const ownerForEmail = (email) => (email === "rochelleygardner@gmail.com" ? "rochelle" : "tanner");

export const todayISO = () => new Date().toISOString().slice(0, 10);

// Two skipped weekly-triage cycles -- long enough that missing one week isn't
// flagged, long enough to catch something quietly aging in the open list.
export const STALE_DAYS = 14;

export const isStale = (item) =>
  OPEN_STATUSES.includes(item.status) && Date.now() - (item.updatedAt || 0) > STALE_DAYS * 86400000;
