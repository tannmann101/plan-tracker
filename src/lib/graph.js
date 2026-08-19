// graph.js
// Pure helpers for walking the flat Kind/Item graph -- shared by Today's
// progress rail, the Plans kanban, Workspace's ticket boards, Search, and
// the Add Form's tag autocomplete, since they all need the same
// parent/child relationships. Kept dependency-free so it stays trivially
// testable. The model is deliberately flatter than the old Goal/Plan/
// Session/Task chain: a Kind can nest under another Kind (parentKindId),
// and an Item can attach directly to a Kind (parentKindId) -- there is no
// intermediate entity between an Item and the Kind it serves anymore.

import { todayISO, addDaysISO, weekStartISO } from "../constants";

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

// Undone Items from today through the next `days` days, timed and
// floating alike -- the scheduling/awareness context handed to
// secretaryChat (functions/index.js) so it can spot time-slot overlaps
// among the timed ones (time set, floating false) and still have a
// general sense of what's already on the books from the floating ones
// (time null), rather than only seeing whatever happens to be clock-
// scheduled.
export function upcomingItems(items, days = 14) {
  const start = todayISO();
  const end = addDaysISO(start, days);
  return (items || [])
    .filter((i) => !i.done && i.timing?.targetDay && i.timing.targetDay >= start && i.timing.targetDay <= end)
    .map((i) => ({
      id: i.id, title: i.title, domain: i.domain, targetDay: i.timing.targetDay,
      floating: i.timing.floating !== false,
      time: i.timing.floating === false ? i.timing.time : null,
      durationMinutes: i.timing.floating === false ? (i.timing.durationMinutes || 30) : null,
      isRecurringPracticeItem: !!i.isRecurringPracticeItem,
      practiceHabitId: i.practiceHabitId || null,
    }));
}

// How booked one day is within the household's own TimeGrid display window
// (startHour/endHour, §useTimeGridPrefs -- the same "active hours" concept
// secretaryChat now reasons over too). Takes the day's Items already split
// the way TimeGridDay itself needs them (floating vs timed), so this can be
// called from both TimeGridDay's own per-day badge and a week-level summary
// without either one re-deriving the split. Purely a display/attention
// signal -- nothing here writes anything or calls Secretary.
export function dayScheduleLoad(floatingItems, timedItems, startHour, endHour) {
  const timedMinutes = timedItems.reduce((sum, i) => sum + (i.timing?.durationMinutes || 30), 0);
  const windowMinutes = Math.max(60, (endHour - startHour) * 60);
  const percentBusy = Math.min(1, timedMinutes / windowMinutes);
  return {
    timedMinutes,
    windowMinutes,
    freeMinutes: Math.max(0, windowMinutes - timedMinutes),
    percentBusy,
    isEmpty: floatingItems.length === 0 && timedItems.length === 0,
    isOverloaded: percentBusy >= 0.85,
  };
}

// A habit building toward a Goal/Project (§9.1 "goal-linked habits")
// tracks a cumulative amount instead of a plain daily checkbox -- the sum
// of every one of its Items' own progressAmount, all-time (not just this
// week), against the habit's own progressTarget. Nothing but the target
// itself is stored on the habit doc; the running total is always derived
// from Items, the same single-source-of-truth discipline practiceItemFor
// already uses for "done". Returns null for a habit that isn't linked.
export function practiceHabitProgress(habit, items) {
  if (!habit?.linkedKindId || !habit.progressTarget) return null;
  const current = (items || [])
    .filter((i) => i.isRecurringPracticeItem && i.practiceHabitId === habit.id)
    .reduce((sum, i) => sum + (i.progressAmount || 0), 0);
  const target = habit.progressTarget;
  return { current, target, unit: habit.progressUnit || "", percent: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0 };
}

// A live snapshot of each active practice habit's completion state, for
// Secretary chat context -- lets it answer "did I do X today" and, when
// asked to check one off, target the existing Item for that habit+day (or
// know none exists yet) rather than guessing and risking a second Item for
// the same habit+day (see practiceItemFor's single-Item contract). Also
// carries a goal-linked habit's running progress so chat can talk about it
// and log an amount against it without a second, separate query shape.
export function practiceHabitsSummary(data) {
  const { practiceHabits = [], items = [], kinds = [] } = data;
  const today = todayISO();
  const weekStart = weekStartISO();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  return (practiceHabits || []).filter((h) => h.active !== false).map((h) => {
    const todayItem = practiceItemFor(h.id, today, items);
    const weekDoneCount = weekDays.filter((d) => practiceItemFor(h.id, d, items)?.done).length;
    const goal = practiceHabitProgress(h, items);
    const linkedKind = h.linkedKindId ? (kinds || []).find((k) => k.id === h.linkedKindId) : null;
    return {
      id: h.id, title: h.title, categoryId: h.categoryId,
      todayItemId: todayItem?.id || null, todayDone: !!todayItem?.done,
      todayProgressAmount: todayItem?.progressAmount || 0,
      weekDoneCount, weekTotalDays: 7,
      linkedKindId: h.linkedKindId || null, linkedKindTitle: linkedKind?.title || null,
      progressUnit: h.progressUnit || null, progressCurrent: goal?.current ?? null, progressTarget: h.progressTarget || null,
    };
  });
}

// Every unresolved discipline (not just focused ones) with its live
// streak -- Secretary chat context so it can discuss progress, offer
// encouragement, and now actually act (pull one into focus, log a
// relapse, mark one resolved) via an update-discipline proposal, same
// propose-then-confirm discipline every other write in this pipeline
// follows. `focused` rides along so the model can tell which ones are
// already in focus versus which it could pull into focus.
export function disciplinesSummary(data) {
  const { disciplines = [] } = data;
  return (disciplines || []).filter((d) => !d.resolved).map((d) => {
    const { days, nextMilestone } = disciplineStreak(d);
    return {
      id: d.id, title: d.title, type: d.type, focused: !!d.focused, streakDays: days,
      nextMilestoneLabel: nextMilestone?.label || null,
      daysToNextMilestone: nextMilestone ? nextMilestone.days - days : null,
    };
  });
}

// Every Kind currently flagged as needing attention (see kindAttention) --
// Secretary chat context so it can proactively surface what's overdue,
// stalled, or empty when relevant, not only react to what's asked about.
export function kindsNeedingAttention(data) {
  const { kinds = [] } = data;
  return kinds
    .map((k) => ({ kind: k, attention: kindAttention(k, data) }))
    .filter((x) => x.attention)
    .map(({ kind, attention }) => ({
      id: kind.id, title: kind.title, kindType: kind.kindType, domain: kind.domain,
      level: attention.level, label: attention.label, hint: attention.hint,
    }));
}

// Streak math for a discipline (Plans' "Habits to Break", §9.1 companion):
// milestones are day-offsets from startedAt rather than fixed dates, so
// they recompute automatically once a relapse resets startedAt to now --
// there's no separate "current milestone" field to fall out of sync with
// the clock. percent is against the span between the last-reached and
// next milestone (or straight to 100 once every milestone is cleared).
export function disciplineStreak(discipline) {
  if (!discipline?.startedAt) return { days: 0, prevMilestone: null, nextMilestone: null, percent: null };
  const days = Math.floor((Date.now() - discipline.startedAt) / 86400000);
  const milestones = [...(discipline.milestones || [])].sort((a, b) => a.days - b.days);
  const prevMilestone = [...milestones].reverse().find((m) => m.days <= days) || null;
  const nextMilestone = milestones.find((m) => m.days > days) || null;
  if (!nextMilestone) return { days, prevMilestone, nextMilestone: null, percent: milestones.length ? 100 : null };
  const spanStart = prevMilestone?.days || 0;
  const percent = Math.round(((days - spanStart) / (nextMilestone.days - spanStart)) * 100);
  return { days, prevMilestone, nextMilestone, percent };
}

export function searchAll(query, data) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = [];
  for (const k of data.kinds || []) if (k.title.toLowerCase().includes(q)) results.push({ type: "kind", entity: k });
  for (const i of data.items || []) if (i.title.toLowerCase().includes(q)) results.push({ type: "item", entity: i });
  return results;
}
