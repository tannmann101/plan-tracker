// graph.js
// Pure helpers for walking the Goal/Project/Plan/Session/Task graph --
// shared by the Goals tree, Domains dashboards, the "why is this here"
// trace, the rollup report, and Search, since they all need the same
// parent/child relationships. Kept dependency-free so it stays trivially
// testable if it ever grows real coverage.

export function childGoals(goalId, goals) {
  return (goals || []).filter((g) => g.parentGoalId === goalId);
}

export function rootGoals(goals) {
  return (goals || []).filter((g) => !g.parentGoalId);
}

export function plansForParent(parentType, parentId, plans) {
  return (plans || []).filter((p) => p.parentType === parentType && p.parentId === parentId);
}

export function sessionsForPlan(planId, sessions) {
  return (sessions || []).filter((s) => s.planId === planId);
}

export function tasksForSession(sessionId, tasks) {
  return (tasks || []).filter((t) => t.sessionId === sessionId);
}

export function goalAncestors(goal, goals) {
  const chain = [goal];
  let current = goal;
  while (current?.parentGoalId) {
    current = (goals || []).find((g) => g.id === current.parentGoalId);
    if (!current) break;
    chain.push(current);
  }
  return chain; // finest to coarsest: [self, parent, grandparent, ...]
}

// Every Goal id in a Goal's subtree (itself + all descendants), used by the
// rollup report to gather everything gathered under a Goal over time.
export function goalSubtreeIds(goalId, goals) {
  const ids = [goalId];
  let frontier = [goalId];
  while (frontier.length) {
    const next = (goals || []).filter((g) => frontier.includes(g.parentGoalId));
    ids.push(...next.map((g) => g.id));
    frontier = next.map((g) => g.id);
  }
  return ids;
}

// Full trace for the "why is this here" info icon: given any Task/Session/
// Plan/Goal, walk up through its Session/Plan/Goal-or-Project chain to the
// root, recording the tier/domain/content-type rationale at each step.
export function traceFor(type, entity, data) {
  const { goals = [], projects = [], plans = [], sessions = [] } = data;
  const steps = [];
  let session = null;
  let plan = null;

  if (type === "task") {
    session = sessions.find((s) => s.id === entity.sessionId);
    steps.push({ label: entity.title, detail: "Task" });
  }
  if (type === "session") session = entity;
  if (session) {
    plan = plans.find((p) => p.id === session.planId);
    steps.push({ label: session.title, detail: `Session -- ${session.contentType} → ${session.toolLocation}` });
  }
  if (type === "plan") plan = entity;
  if (plan) {
    steps.push({ label: plan.title, detail: plan.parentType ? `Plan -- ${plan.domain}` : `Plan -- ${plan.domain} (not yet linked)` });
    if (plan.parentType === "goal") {
      const goal = goals.find((g) => g.id === plan.parentId);
      if (goal) {
        for (const g of goalAncestors(goal, goals)) {
          steps.push({ label: g.title, detail: `Goal -- ${g.tier}, ${g.domain}`, goalId: g.id });
        }
      }
    } else if (plan.parentType === "project") {
      const project = projects.find((p) => p.id === plan.parentId);
      if (project) {
        steps.push({ label: project.title, detail: `Project -- ${project.initiator === "me" ? "my initiative" : "wife's initiative"}, ${project.familyScope}` });
      }
    }
  }
  if (type === "goal") {
    for (const g of goalAncestors(entity, goals)) {
      steps.push({ label: g.title, detail: `Goal -- ${g.tier}, ${g.domain}`, goalId: g.id });
    }
  }
  return steps;
}

// Gathers everything tied to a Goal's whole subtree -- its own event-log
// entries plus every Plan/Session/Task under it (and under its descendant
// Goals) -- so the rollup report grows as weeks pass rather than showing a
// static snapshot.
export function rollupForGoal(goalId, data) {
  const { goals = [], plans = [], sessions = [], tasks = [], events = [] } = data;
  const goalIds = new Set(goalSubtreeIds(goalId, goals));
  const relatedPlans = plans.filter((p) => p.parentType === "goal" && goalIds.has(p.parentId));
  const planIds = new Set(relatedPlans.map((p) => p.id));
  const relatedSessions = sessions.filter((s) => planIds.has(s.planId));
  const sessionIds = new Set(relatedSessions.map((s) => s.id));
  const relatedTasks = tasks.filter((t) => sessionIds.has(t.sessionId));
  const taskIds = new Set(relatedTasks.map((t) => t.id));
  const relatedEvents = events
    .filter((e) =>
      (e.entityType === "goal" && goalIds.has(e.entityId)) ||
      (e.entityType === "plan" && planIds.has(e.entityId)) ||
      (e.entityType === "session" && sessionIds.has(e.entityId)) ||
      (e.entityType === "task" && taskIds.has(e.entityId)))
    .sort((a, b) => a.at - b.at);
  return { goalIds, plans: relatedPlans, sessions: relatedSessions, tasks: relatedTasks, events: relatedEvents };
}

// Automatic sense of "how far along" a Goal is: done Sessions + done Tasks,
// over total Sessions + Tasks, across the Goal's whole subtree (built on
// rollupForGoal(), same gather every other Goal view already uses).
// percent is null (not 0) when there's nothing under the Goal yet to
// measure -- an empty Goal isn't "0% done," it's "no data."
export function goalProgress(goalId, data) {
  const { sessions, tasks } = rollupForGoal(goalId, data);
  const total = sessions.length + tasks.length;
  const done = sessions.filter((s) => s.done).length + tasks.filter((t) => t.done).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : null };
}

// Whether an entity is tagged with a given domain, primary or secondary --
// used by Domains dashboards and Trends so a cross-domain item shows up
// everywhere it's tagged, not just under its primary domain.
export function matchesDomain(entity, domainId) {
  return entity.domain === domainId || (entity.secondaryDomains || []).includes(domainId);
}

// A Plan is "grounded" once it serves a Goal or Project -- ungrounded Plans
// are groundwork logged before that link exists yet (see the v2 schema
// relaxation), and are what the Unlinked-work review surfaces.
export function isGrounded(plan) {
  return !!(plan.parentType && plan.parentId);
}

export function unlinkedPlans(plans) {
  return (plans || []).filter((p) => !isGrounded(p));
}

export function standaloneTasks(tasks) {
  return (tasks || []).filter((t) => !t.sessionId);
}

export function searchAll(query, data) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = [];
  for (const g of data.goals || []) if (g.title.toLowerCase().includes(q)) results.push({ type: "goal", entity: g });
  for (const p of data.projects || []) if (p.title.toLowerCase().includes(q)) results.push({ type: "project", entity: p });
  for (const p of data.plans || []) if (p.title.toLowerCase().includes(q)) results.push({ type: "plan", entity: p });
  for (const s of data.sessions || []) if (s.title.toLowerCase().includes(q)) results.push({ type: "session", entity: s });
  for (const t of data.tasks || []) if (t.title.toLowerCase().includes(q)) results.push({ type: "task", entity: t });
  return results;
}
