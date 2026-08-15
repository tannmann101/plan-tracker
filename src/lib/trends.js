// trends.js
// Pure functions computing Trends-page chart/table data from secretary
// state, same style as lib/graph.js. Nothing here writes anything.

import { weekStartISO, domainLabel } from "../constants";
import { isGrounded } from "./graph";

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

// Tasks completed per week, last `weeks` weeks, broken down by the
// completing task's current primary domain (denormalized on Task, or
// resolved from its Session when present).
export function tasksCompletedPerWeek(data, weeks = 12) {
  const { events = [], tasks = [], sessions = [] } = data;
  const weekList = weeksBack(weeks);
  const buckets = Object.fromEntries(weekList.map((w) => [w, {}]));

  const domainForTask = (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return null;
    if (task.domain) return task.domain;
    const session = sessions.find((s) => s.id === task.sessionId);
    return session?.domain || null;
  };

  for (const e of events) {
    if (e.entityType !== "task" || e.to !== "true") continue;
    const week = weekStartISO(new Date(e.at));
    if (!(week in buckets)) continue;
    const domain = domainForTask(e.entityId) || "unknown";
    buckets[week][domain] = (buckets[week][domain] || 0) + 1;
  }

  return weekList.map((week) => {
    const byDomain = buckets[week];
    const total = Object.values(byDomain).reduce((a, b) => a + b, 0);
    return { week, total, byDomain };
  });
}

// Count of active+done work (Goals, Projects, Plans, Sessions) per primary
// domain -- "what kind of work is actually happening."
export function domainDistribution(data, domains) {
  const { goals = [], projects = [], plans = [], sessions = [] } = data;
  const counts = {};
  for (const list of [goals, projects, plans, sessions]) {
    for (const item of list) {
      if (!item.domain) continue;
      counts[item.domain] = (counts[item.domain] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([domainId, count]) => ({ domainId, label: domainLabel(domainId, domains), count }))
    .sort((a, b) => b.count - a.count);
}

// Days from a Goal's creation to its 'done' event, for every Goal that's
// been completed at least once (uses the most recent done event if it's
// been reopened and redone).
export function goalCycleTimes(data) {
  const { goals = [], events = [] } = data;
  const results = [];
  for (const goal of goals) {
    const doneEvents = events
      .filter((e) => e.entityType === "goal" && e.entityId === goal.id && e.to === "done")
      .sort((a, b) => b.at - a.at);
    if (!doneEvents.length) continue;
    const days = Math.round((doneEvents[0].at - goal.createdAt) / 86400000);
    results.push({ goalId: goal.id, title: goal.title, tier: goal.tier, domain: goal.domain, days });
  }
  return results.sort((a, b) => a.days - b.days);
}

// Weekly % of completed Tasks whose Session→Plan chain reaches a Goal
// (grounded plan with parentType 'goal') vs. doesn't (ungrounded or
// Project-only) -- the concrete "how aligned are we" trend. Uses each
// task's *current* linkage, so a retroactive re-link (via EditEntityModal)
// improves past weeks' rate too, not just future ones.
export function alignmentRateOverTime(data, weeks = 12) {
  const { events = [], tasks = [], sessions = [], plans = [] } = data;
  const weekList = weeksBack(weeks);
  const buckets = Object.fromEntries(weekList.map((w) => [w, { aligned: 0, total: 0 }]));

  const isAligned = (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return null;
    const session = sessions.find((s) => s.id === task.sessionId);
    if (!session) return false;
    const plan = plans.find((p) => p.id === session.planId);
    if (!plan) return false;
    return isGrounded(plan) && plan.parentType === "goal";
  };

  for (const e of events) {
    if (e.entityType !== "task" || e.to !== "true") continue;
    const week = weekStartISO(new Date(e.at));
    if (!(week in buckets)) continue;
    const aligned = isAligned(e.entityId);
    if (aligned === null) continue; // task since deleted -- can't judge
    buckets[week].total += 1;
    if (aligned) buckets[week].aligned += 1;
  }

  return weekList.map((week) => {
    const { aligned, total } = buckets[week];
    return { week, rate: total ? Math.round((aligned / total) * 100) : null, total };
  });
}

// Count of Sessions per tool_location -- how much is actually landing in
// Calendar vs. Reading notebook vs. Finance Tracker etc.
export function toolUsageCounts(data) {
  const counts = {};
  for (const s of data.sessions || []) {
    if (!s.toolLocation) continue;
    counts[s.toolLocation] = (counts[s.toolLocation] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([toolLocation, count]) => ({ toolLocation, count }))
    .sort((a, b) => b.count - a.count);
}

// Flat chronological log entries (most recent first), with each event
// resolved to a human title where the source entity still exists.
export function eventLog(data) {
  const { events = [], goals = [], projects = [], plans = [], sessions = [], tasks = [] } = data;
  const byType = { goal: goals, project: projects, plan: plans, session: sessions, task: tasks };
  return events
    .map((e) => {
      const entity = (byType[e.entityType] || []).find((x) => x.id === e.entityId);
      return { ...e, title: entity?.title || "(deleted)" };
    })
    .sort((a, b) => b.at - a.at);
}

export function eventsToCSV(events) {
  const header = "date,time,entityType,title,from,to";
  const rows = events.map((e) => {
    const d = new Date(e.at);
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return [d.toLocaleDateString(), d.toLocaleTimeString(), e.entityType, cell(e.title), e.from || "", e.to].join(",");
  });
  return [header, ...rows].join("\n");
}
