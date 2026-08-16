// graph.js
// Pure helpers for walking the flat Kind/Item graph -- shared by Today's
// progress rail, the Plans kanban, Workspace's ticket boards, Search, and
// the Add Form's tag autocomplete, since they all need the same
// parent/child relationships. Kept dependency-free so it stays trivially
// testable. The model is deliberately flatter than the old Goal/Plan/
// Session/Task chain: a Kind can nest under another Kind (parentKindId),
// and an Item can attach directly to a Kind (parentKindId) -- there is no
// intermediate entity between an Item and the Kind it serves anymore.

import { todayISO } from "../constants";

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
  const end = new Date();
  end.setDate(end.getDate() + days);
  const endISO = end.toISOString().slice(0, 10);
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

export function searchAll(query, data) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = [];
  for (const k of data.kinds || []) if (k.title.toLowerCase().includes(q)) results.push({ type: "kind", entity: k });
  for (const i of data.items || []) if (i.title.toLowerCase().includes(q)) results.push({ type: "item", entity: i });
  return results;
}
