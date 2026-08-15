import { toolLocationFor, domainLabel } from "../constants";

// Finds an existing Plan matching this exact title/domain/parent combination,
// or creates one. Shared by placeCapture's "Captured" plan and Quick Add's
// "Quick -- <Domain>" ungrounded plan, so repeated quick-adds/captures in the
// same domain land in one holding Plan instead of spawning a new document
// every time.
export async function findOrCreatePlan(secretary, { domain, parentType = null, parentId = null, title }) {
  const existing = (secretary.plans || []).find(
    (p) => p.domain === domain && p.title === title &&
      (p.parentType || null) === parentType && (p.parentId || null) === parentId
  );
  if (existing) return existing;
  const id = await secretary.saveEntity("plan", {
    title, domain, parentType, parentId, sessionIds: [], status: "active",
  });
  return { id };
}

// The ungrounded holding Plan Quick Add and capture auto-placement fall back
// to when no Goal/Project is specified or matched -- groundwork logged
// before something exists yet for it to serve (see the v2 schema
// relaxation allowing a parentless Plan). Surfaces in Trends' Unlinked-work
// tab for later retroactive attachment.
export function quickPlanTitle(domain, domains) {
  return `Quick -- ${domainLabel(domain, domains)}`;
}

// Commits a triage decision for a capture. Only ever called after Tanner has
// either accepted a high-confidence draft outright or resolved a
// conversational confirmation -- this never runs on a bare AI draft alone.
//
// Placement policy: Secretary auto-places Task/Session captures whenever the
// level is confident -- attaching to an existing Goal's "Captured" plan when
// one was matched, or falling back to a domain's ungrounded "Quick" plan
// otherwise (the same find-or-create pattern Quick Add uses). It never
// auto-creates a Goal or Project, and Goal/Project-level captures or
// new-Goal/new-Project suggestions always fall back to the review-later
// queue -- those need a human decision regardless of confidence.
export async function placeCapture(secretary, captureId, text, draft) {
  const isDrift = draft.relevance === "unmanaged" || draft.alignment?.type === "drift";
  const isSuggestion = draft.alignment?.type === "new-goal-suggestion" || draft.alignment?.type === "new-project-suggestion";
  const goalId = draft.alignment?.type === "existing-goal" ? draft.alignment.goalId : null;
  const canAutoPlace = !isDrift && !isSuggestion && (draft.level === "task" || draft.level === "session");

  if (isDrift) {
    await secretary.saveCapture({ id: captureId, status: "drift", rawText: text, triageDraft: draft });
    return { outcome: "drift" };
  }

  if (!canAutoPlace) {
    // Goal/Project-level items and new-Goal/new-Project suggestions need a
    // human placement decision -- hold them visibly in the review-later
    // queue rather than guessing.
    await secretary.saveCapture({ id: captureId, status: "pending-triage", rawText: text, triageDraft: draft });
    return { outcome: "held-for-review" };
  }

  const domain = draft.domain || "planning";
  const contentType = draft.contentType || "quick-capture";
  const toolLocation = toolLocationFor(contentType, secretary.routingTable);
  const title = draft.title || text.slice(0, 80);

  const plan = goalId
    ? await findOrCreatePlan(secretary, { domain, parentType: "goal", parentId: goalId, title: "Captured" })
    : await findOrCreatePlan(secretary, { domain, title: quickPlanTitle(domain, secretary.domains) });

  let session = (secretary.sessions || []).find(
    (s) => s.planId === plan.id && s.contentType === contentType && !s.done
  );
  if (!session) {
    const sessionId = await secretary.saveEntity("session", {
      title: draft.level === "session" ? title : `Captured -- ${domainLabel(domain, secretary.domains)}`,
      planId: plan.id, domain, contentType, toolLocation, taskIds: [], done: false,
    });
    session = { id: sessionId };
  }

  if (draft.level === "task") {
    await secretary.saveEntity("task", { title, sessionId: session.id, done: false, domain });
  }

  await secretary.saveCapture({
    id: captureId, status: "placed", rawText: text, triageDraft: draft,
    placedEntityType: draft.level, placedEntityId: session.id,
  });
  return { outcome: "placed" };
}
