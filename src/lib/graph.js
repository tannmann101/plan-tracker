// graph.js
// Pure helpers for walking the flat Kind/Item graph -- shared by Today's
// progress rail, the Plans kanban, Workspace's ticket boards, Search, and
// the Add Form's tag autocomplete, since they all need the same
// parent/child relationships. Kept dependency-free so it stays trivially
// testable. The model is deliberately flatter than the old Goal/Plan/
// Session/Task chain: a Kind can nest under another Kind (parentKindId),
// and an Item can attach directly to a Kind (parentKindId) -- there is no
// intermediate entity between an Item and the Kind it serves anymore.

import { todayISO, addDaysISO } from "../constants";

export function childKinds(kindId, kinds) {
  return (kinds || []).filter((k) => k.parentKindId === kindId);
}

export function rootKinds(kinds) {
  return (kinds || []).filter((k) => !k.parentKindId);
}

export function itemsForKind(kindId, items) {
  return (items || []).filter((i) => i.parentKindId === kindId);
}

export function kindAncestors(kind, kinds) {
  const chain = [kind];
  let current = kind;
  while (current?.parentKindId) {
    current = (kinds || []).find((k) => k.id === current.parentKindId);
    if (!current) break;
    chain.push(current);
  }
  return chain; // finest to coarsest: [self, parent, grandparent, ...]
}

// Every Kind id in a Kind's subtree (itself + all descendants) -- used by
// kindProgress() and by the parent-picker's cycle guard.
export function kindSubtreeIds(kindId, kinds) {
  const ids = [kindId];
  let frontier = [kindId];
  while (frontier.length) {
    const next = (kinds || []).filter((k) => frontier.includes(k.parentKindId));
    ids.push(...next.map((k) => k.id));
    frontier = next.map((k) => k.id);
  }
  return ids;
}

// Full trace for the "why is this here" info icon: an Item's chain is just
// itself + its parent Kind's own ancestor chain (no intermediate Session/
// Plan layer anymore); a Kind's chain is its own ancestor chain.
export function traceFor(type, entity, data) {
  const { kinds = [] } = data;
  const steps = [];
  if (type === "item") {
    steps.push({ label: entity.title, detail: entity.itemType });
    if (entity.parentKindId) {
      const parent = kinds.find((k) => k.id === entity.parentKindId);
      if (parent) {
        for (const k of kindAncestors(parent, kinds)) {
          steps.push({ label: k.title, detail: `${k.kindType} -- ${k.domain}`, kindId: k.id });
        }
      }
    }
  } else {
    for (const k of kindAncestors(entity, kinds)) {
      steps.push({ label: k.title, detail: `${k.kindType} -- ${k.domain}`, kindId: k.id });
    }
  }
  return steps;
}

// Automatic sense of "how far along" a Kind is: done Items over total
// Items, across the Kind's whole subtree (itself + nested Kinds). percent
// is null (not 0) when there's nothing under it yet to measure.
export function kindProgress(kindId, data) {
  const { kinds = [], items = [] } = data;
  const subtreeIds = new Set(kindSubtreeIds(kindId, kinds));
  const relatedItems = items.filter((i) => subtreeIds.has(i.parentKindId));
  const total = relatedItems.length;
  const done = relatedItems.filter((i) => i.done).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : null };
}

// Whether an entity is tagged with a given domain, primary or secondary.
export function matchesDomain(entity, domainId) {
  return entity.domain === domainId || (entity.secondaryDomains || []).includes(domainId);
}

export function unlinkedKinds(kinds) {
  return (kinds || []).filter((k) => !k.parentKindId);
}

export function standaloneItems(items) {
  return (items || []).filter((i) => !i.parentKindId);
}

// Every distinct tag currently in use across Kinds and Items -- powers the
// Add Form's autocomplete (§2.4). No separate tags collection at this data
// volume; computed live off whatever's already loaded.
export function allTagsInUse(data) {
  const { kinds = [], items = [] } = data;
  const set = new Set();
  for (const e of [...kinds, ...items]) {
    for (const t of e.tags || []) set.add(t);
  }
  return [...set].sort();
}

// Whether a timing block's targetDay/dueDate falls within today through
// `days` days out -- used to decide whether saving an Item should
// auto-promote its parent Kind into "in-progress" (see useSecretary.js)
// and to highlight "landing this week" items on Today/Workspace.
export function itemFallsInWindow(timing, days = 6) {
  if (!timing) return false;
  const day = timing.targetDay || timing.dueDate;
  if (!day) return false;
  const start = todayISO();
  const endISO = addDaysISO(start, days);
  return day >= start && day <= endISO;
}

// The sync contract behind the Practices tab's weekly grid (§9.1.1): a
// practiceHabit is a definition only, never a completion record. A given
// habit+day has at most one Item (isRecurringPracticeItem + practiceHabitId),
// found here and written to directly by whoever's toggling it (the grid or
// Today/Week's own checkbox) -- there is no second completion record to
// drift out of sync with the first.
export function practiceItemFor(habitId, day, items) {
  return (items || []).find((i) => i.isRecurringPracticeItem && i.practiceHabitId === habitId && i.timing?.targetDay === day) || null;
}

const STALL_DAYS = 14;

// A Kind is easy to lose track of once it's created -- this is the "what
// needs to happen to move this along" signal shown on its card. Checked in
// priority order: an overdue due date beats a stall, which beats having
// nothing attached at all. Returns null when nothing needs flagging (done,
// genuinely fresh, or has real near-term activity).
export function kindAttention(kind, data) {
  if (!kind || kind.status === "done") return null;
  const today = todayISO();

  if (kind.timing?.dueDate && kind.timing.dueDate < today) {
    return { level: "overdue", label: "Overdue", hint: `Due ${kind.timing.dueDate} -- past due. Give it a new date, or mark it done.` };
  }

  const { items = [], kinds = [] } = data;
  const subtreeIds = new Set(kindSubtreeIds(kind.id, kinds));
  const relatedItems = items.filter((i) => subtreeIds.has(i.parentKindId));

  if (kind.status !== "not-started" && relatedItems.length === 0) {
    return { level: "attention", label: "No Items yet", hint: "Nothing is attached to this -- add an Item to give it a next step." };
  }

  const openItems = relatedItems.filter((i) => !i.done);
  const hasUpcoming = openItems.some((i) => {
    const day = i.timing?.targetDay || i.timing?.dueDate;
    return day && day >= today && day <= addDaysISO(today, STALL_DAYS);
  });
  const recentActivity = relatedItems.some((i) => {
    const touched = i.completedAt || i.updatedAt;
    return touched && Date.now() - touched <= STALL_DAYS * 86400000;
  });

  if (openItems.length > 0 && !hasUpcoming && !recentActivity) {
    return { level: "attention", label: `Stalled ${STALL_DAYS}d+`, hint: "Nothing scheduled soon and no recent activity -- pick a next Item and set a day." };
  }

  return null;
}

// Timed (non-floating) Items from today through the next `days` days --
// the scheduling context handed to secretaryChat so it can spot overlaps
// and suggest a free slot rather than silently double-booking (see
// functions/index.js's secretaryChat).
export function upcomingTimedItems(items, days = 14) {
  const start = todayISO();
  const end = addDaysISO(start, days);
  return (items || [])
    .filter((i) => !i.done && i.timing?.floating === false && i.timing?.time && i.timing?.targetDay >= start && i.timing.targetDay <= end)
    .map((i) => ({ id: i.id, title: i.title, domain: i.domain, targetDay: i.timing.targetDay, time: i.timing.time, durationMinutes: i.timing.durationMinutes || 30 }));
}

export function searchAll(query, data) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = [];
  for (const k of data.kinds || []) if (k.title.toLowerCase().includes(q)) results.push({ type: "kind", entity: k });
  for (const i of data.items || []) if (i.title.toLowerCase().includes(q)) results.push({ type: "item", entity: i });
  return results;
}
