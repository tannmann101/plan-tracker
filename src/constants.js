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

// Statuses that still need attention -- surfaced in the Plan view's Day/Week
// horizons and the staleness check below. Scheduled and needs-review are
// both still-actionable, unresolved states, same as open/in-progress.
export const OPEN_STATUSES = ["open", "in-progress", "scheduled", "needs-review"];

// Type is the hierarchy tier -- a Goal is the highest-level aspiration, a
// Plan is a bounded body of work that serves a goal, a Task is the smallest
// unit of actual work. Optional parent linking (see Item shape below) lets
// a Task point at the Plan it serves and a Plan point at the Goal it serves,
// but every item stands on its own by default -- linking is never required.
export const TYPES = [
  { id: "task", label: "Task" },
  { id: "plan", label: "Plan" },
  { id: "goal", label: "Goal" },
];

// Effort is a second axis, orthogonal to domain and type -- how big a piece
// of work this is, not which area of life it belongs to or what tier it's
// at. Optional (like targetDate) so items saved before this existed still
// validate; the form always sets a default on new items.
export const EFFORTS = [
  { id: "quick", label: "Quick (<30 min)" },
  { id: "medium", label: "Medium (one sitting)" },
  { id: "large", label: "Large (multi-session)" },
];

// Who owns the item -- the two accounts allow-listed in firestore.rules.
// Optional (like type/effort) so items saved before this existed still
// validate; the form defaults it to whoever's currently signed in.
export const OWNERS = [
  { id: "tanner", label: "Tanner" },
  { id: "rochelle", label: "Rochelle" },
];

export const domainLabel = (id) => DOMAINS.find((d) => d.id === id)?.label || id;
export const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label || id;
export const typeLabel = (id) => TYPES.find((t) => t.id === id)?.label || id;
export const effortLabel = (id) => EFFORTS.find((e) => e.id === id)?.label || id;
export const ownerLabel = (id) => OWNERS.find((o) => o.id === id)?.label || id;
export const ownerForEmail = (email) => (email === "rochelleygardner@gmail.com" ? "rochelle" : "tanner");

// Items saved before `type` existed have no value for it -- treat those as
// plain tasks rather than forcing a migration of old data.
export const itemType = (item) => item.type || "task";

export const todayISO = () => new Date().toISOString().slice(0, 10);

// Two skipped weekly-triage cycles -- long enough that missing one week isn't
// flagged, long enough to catch something quietly aging in the open list.
export const STALE_DAYS = 14;

export const isStale = (item) =>
  OPEN_STATUSES.includes(item.status) && Date.now() - (item.updatedAt || 0) > STALE_DAYS * 86400000;

export const directChildren = (items, parentId) => items.filter((i) => i.parentId === parentId);

// The title of an item's linked parent, if it has one -- used to show a
// "part of X" breadcrumb wherever a linked item appears outside its own
// nested tree, so floating vs. linked is never ambiguous.
export const parentTitleOf = (items, item) =>
  item.parentId ? items.find((i) => i.id === item.parentId)?.title : undefined;

// Done/total across every descendant (children + grandchildren) -- e.g. a
// goal's linked plans plus their tasks.
export const descendantProgress = (items, parentId) => {
  const kids = directChildren(items, parentId);
  let done = kids.filter((k) => k.status === "done").length;
  let total = kids.length;
  for (const k of kids) {
    const grand = directChildren(items, k.id);
    total += grand.length;
    done += grand.filter((g) => g.status === "done").length;
  }
  return { done, total };
};
