// trends.js
// Pure functions computing Trends-page chart/table data from secretary
// state, same style as lib/graph.js. Nothing here writes anything.
//
// §11 -- data sources swapped from goals/projects/plans/sessions/tasks to
// kinds/items; no new panels added this pass (per the spec's own
// instruction). TODO: the old alignment-rate panel's definition of
// "aligned" is reinterpreted below for the flat model (an Item's
// parentKindId chain reaches a Goal-kind Kind) rather than the old
// Session→Plan→Goal chain, since that chain no longer exists.

import { weekStartISO, domainLabel, todayISO, addDaysISO, KIND_STATUSES } from "../constants";
import { kindAncestors, practiceItemFor, disciplineStreak } from "./graph";

function weeksBack(n) {
  const weeks = [];
  const cursor = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(cursor);
    d.setDate(d.getDate() - i * 7);
    weeks.push(weekStartISO(d));
  }
  return weeks;
}

// Items completed per week, last `weeks` weeks, broken down by the
// completing Item's own domain (Items carry domain directly now, no
// Session indirection to resolve).
export function itemsCompletedPerWeek(data, weeks = 12) {
  const { events = [], items = [] } = data;
  const weekList = weeksBack(weeks);
  const buckets = Object.fromEntries(weekList.map((w) => [w, {}]));

  const domainForItem = (itemId) => items.find((i) => i.id === itemId)?.domain || null;

  for (const e of events) {
    if (e.entityType !== "item" || e.to !== "true") continue;
    const week = weekStartISO(new Date(e.at));
    if (!(week in buckets)) continue;
    const domain = domainForItem(e.entityId) || "unknown";
    buckets[week][domain] = (buckets[week][domain] || 0) + 1;
  }

  return weekList.map((week) => {
    const byDomain = buckets[week];
    const total = Object.values(byDomain).reduce((a, b) => a + b, 0);
    return { week, total, byDomain };
  });
}

// Count of Kinds+Items per primary domain -- "what kind of work is
// actually happening."
export function domainDistribution(data, domains) {
  const { kinds = [], items = [] } = data;
  const counts = {};
  for (const list of [kinds, items]) {
    for (const item of list) {
      if (!item.domain) continue;
      counts[item.domain] = (counts[item.domain] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([domainId, count]) => ({ domainId, label: domainLabel(domainId, domains), count }))
    .sort((a, b) => b.count - a.count);
}

// Days from a Goal-kind Kind's creation to its 'done' event, for every one
// that's been completed at least once (uses the most recent done event if
// it's been reopened and redone).
export function kindCycleTimes(data) {
  const { kinds = [], events = [] } = data;
  const results = [];
  for (const kind of kinds) {
    if (kind.kindType !== "goal") continue;
    const doneEvents = events
      .filter((e) => e.entityType === "kind" && e.entityId === kind.id && e.to === "done")
      .sort((a, b) => b.at - a.at);
    if (!doneEvents.length) continue;
    const days = Math.round((doneEvents[0].at - kind.createdAt) / 86400000);
    results.push({ kindId: kind.id, title: kind.title, domain: kind.domain, days });
  }
  return results.sort((a, b) => a.days - b.days);
}

// Weekly % of completed Items whose parentKindId chain reaches a Goal-kind
// Kind vs. doesn't -- the flat-model analog of the old Session→Plan→Goal
// alignment rate. Uses each Item's *current* linkage, so a retroactive
// re-link (via EditEntityModal) improves past weeks' rate too.
export function alignmentRateOverTime(data, weeks = 12) {
  const { events = [], items = [], kinds = [] } = data;
  const weekList = weeksBack(weeks);
  const buckets = Object.fromEntries(weekList.map((w) => [w, { aligned: 0, total: 0 }]));

  const isAligned = (itemId) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return null;
    if (!item.parentKindId) return false;
    const parent = kinds.find((k) => k.id === item.parentKindId);
    if (!parent) return false;
    return kindAncestors(parent, kinds).some((k) => k.kindType === "goal");
  };

  for (const e of events) {
    if (e.entityType !== "item" || e.to !== "true") continue;
    const week = weekStartISO(new Date(e.at));
    if (!(week in buckets)) continue;
    const aligned = isAligned(e.entityId);
    if (aligned === null) continue; // item since deleted -- can't judge
    buckets[week].total += 1;
    if (aligned) buckets[week].aligned += 1;
  }

  return weekList.map((week) => {
    const { aligned, total } = buckets[week];
    return { week, rate: total ? Math.round((aligned / total) * 100) : null, total };
  });
}

// Count of Kinds+Items per resource -- replaces the old per-Session
// tool_location count now that resources[] (flat, not domain-scoped)
// stands in for the routing table (§3.2).
export function resourceUsageCounts(data) {
  const counts = {};
  for (const list of [data.kinds || [], data.items || []]) {
    for (const e of list) {
      for (const r of e.resources || []) counts[r] = (counts[r] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([resource, count]) => ({ resource, count }))
    .sort((a, b) => b.count - a.count);
}

// Per active-practice day grid, most recent `days` days -- the same
// find-or-nothing lookup the Plans tracker and Today/Week's own checkbox
// use (practiceItemFor), so this can never show a day as done that
// wouldn't also show done everywhere else. completionRate is over the
// whole window, not just days the habit has existed, so a brand-new habit
// starts low and visibly climbs as it's kept up -- the exact "populates as
// engagement persists" behavior this panel is for.
export function practiceConsistency(data, days = 28) {
  const { practiceHabits = [], items = [] } = data;
  const today = todayISO();
  const dayList = Array.from({ length: days }, (_, i) => addDaysISO(today, i - (days - 1)));
  return (practiceHabits || [])
    .filter((h) => h.active !== false)
    .map((h) => {
      const cells = dayList.map((day) => ({ day, done: !!practiceItemFor(h.id, day, items)?.done }));
      const doneCount = cells.filter((c) => c.done).length;
      return { id: h.id, title: h.title, categoryId: h.categoryId, cells, completionRate: Math.round((doneCount / days) * 100) };
    })
    .sort((a, b) => b.completionRate - a.completionRate);
}

// Every discipline's full streak history, reconstructed from its own
// append-only event trail rather than any stored "history" field -- a
// "started" or "relapsed" event is the only thing that ever resets the
// clock (see useSecretary.js's saveDiscipline), so each one marks a new
// segment's start; a "resolved" event (or, failing that, now) closes the
// final segment. Segments before the most recent one are always closed;
// the last one is "ongoing" unless the discipline has since been resolved.
export function disciplineStreakHistory(data) {
  const { disciplines = [], events = [] } = data;
  return (disciplines || [])
    .map((d) => {
      const discEvents = events
        .filter((e) => e.entityType === "discipline" && e.entityId === d.id)
        .sort((a, b) => a.at - b.at);
      const starts = discEvents.filter((e) => e.to === "started" || e.to === "relapsed").map((e) => e.at);
      const resolvedEvent = [...discEvents].reverse().find((e) => e.to === "resolved" || e.to === "deleted");

      const segments = starts.length
        ? starts.map((startAt, i) => {
            const nextStart = starts[i + 1];
            const closesOnResolve = !nextStart && resolvedEvent && resolvedEvent.at > startAt;
            const endAt = nextStart || (closesOnResolve ? resolvedEvent.at : Date.now());
            const ongoing = !nextStart && !closesOnResolve;
            return { days: Math.max(0, Math.floor((endAt - startAt) / 86400000)), ongoing };
          })
        // No event history at all (e.g. seeded outside saveDiscipline) --
        // fall back to the live calc so the panel still shows something.
        : [{ days: disciplineStreak(d).days, ongoing: !d.resolved }];

      // The last segment IS the current streak -- reading it back off
      // segments (rather than a separate disciplineStreak(d) call here)
      // means a resolved discipline's number freezes at its actual final
      // length instead of continuing to grow off startedAt forever after
      // resolution (startedAt itself never changes once resolved).
      const currentStreakDays = segments[segments.length - 1].days;
      const longestStreakDays = Math.max(...segments.map((s) => s.days), 0);
      const totalRelapses = discEvents.filter((e) => e.to === "relapsed").length;

      return {
        id: d.id, title: d.title, type: d.type, resolved: !!d.resolved, focused: !!d.focused,
        currentStreakDays, longestStreakDays, totalRelapses, segments,
      };
    })
    .sort((a, b) => (a.resolved === b.resolved ? b.currentStreakDays - a.currentStreakDays : a.resolved ? 1 : -1));
}

// Count of Kinds per lifecycle status -- "the shape of the pipeline right
// now" -- one entry per KIND_STATUSES bucket regardless of kindType, since
// Trends' Pipeline panel splits by type itself when it wants to.
export function kindStatusCounts(data, kindType = null) {
  const { kinds = [] } = data;
  const scoped = kindType ? kinds.filter((k) => k.kindType === kindType) : kinds;
  return KIND_STATUSES.map((s) => ({
    status: s.id, label: s.label, count: scoped.filter((k) => k.status === s.id).length,
  }));
}

// Hours actually time-blocked (a timed, non-floating Item's durationMinutes)
// per week, by the Item's own targetDay -- adoption of the time-blocking
// feature itself, not just how much got done.
export function timeBlockedHoursPerWeek(data, weeks = 12) {
  const { items = [] } = data;
  const weekList = weeksBack(weeks);
  const buckets = Object.fromEntries(weekList.map((w) => [w, 0]));
  for (const i of items) {
    if (i.timing?.floating !== false || !i.timing?.time || !i.timing?.targetDay) continue;
    const week = weekStartISO(new Date(`${i.timing.targetDay}T00:00:00`));
    if (!(week in buckets)) continue;
    buckets[week] += (i.timing.durationMinutes || 30) / 60;
  }
  return weekList.map((week) => ({ week, hours: Math.round(buckets[week] * 10) / 10 }));
}
