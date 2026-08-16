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

import { weekStartISO, domainLabel } from "../constants";
import { kindAncestors } from "./graph";

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
