// constants.js
// The Item schema's fixed vocabularies -- kept in one place since they're
// mirrored in firestore.rules (isValidItem) and must stay in sync with it.

export const DOMAINS = [
  { id: "financial", label: "Financial" },
  { id: "material", label: "Material" },
  { id: "health-fitness", label: "Health & Fitness" },
  { id: "vocational-career", label: "Vocational / Career" },
  { id: "relational", label: "Relational" },
  { id: "cross-domain", label: "Cross-Domain" },
];

export const STATUSES = [
  { id: "open", label: "Open" },
  { id: "in-progress", label: "In Progress" },
  { id: "done", label: "Done" },
  { id: "dropped", label: "Dropped" },
];

export const OPEN_STATUSES = ["open", "in-progress"];

export const domainLabel = (id) => DOMAINS.find((d) => d.id === id)?.label || id;
export const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label || id;

export const todayISO = () => new Date().toISOString().slice(0, 10);
