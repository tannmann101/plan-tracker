import { toolLocationFor } from "../constants";

// Commits a triage decision for a capture. Only ever called after Tanner has
// either accepted a high-confidence draft outright or resolved a
// conversational confirmation -- this never runs on a bare AI draft alone.
//
// Placement policy, deliberately conservative: Secretary will happily attach
// a Task or Session to an existing Goal's "Captured" holding Plan (reusing
// one if a same-domain/content-type Session already exists there), but it
// never auto-creates a Goal or Project, and never auto-places when no
// matching Goal was identified -- those cases fall back to the review-later
// queue so a real placement decision stays a human one (per the spec: "does
// this suggest a new Goal/Project -- surface it explicitly rather than
// auto-creating").
export async function placeCapture(secretary, captureId, text, draft) {
  const isDrift = draft.relevance === "unmanaged" || draft.alignment?.type === "drift";
  const isSuggestion = draft.alignment?.type === "new-goal-suggestion" || draft.alignment?.type === "new-project-suggestion";
  const goalId = draft.alignment?.type === "existing-goal" ? draft.alignment.goalId : null;
  const canAutoPlace = !isDrift && !isSuggestion && goalId && (draft.level === "task" || draft.level === "session");

  if (isDrift) {
    await secretary.saveCapture({ id: captureId, status: "drift", rawText: text, triageDraft: draft });
    return { outcome: "drift" };
  }

  if (!canAutoPlace) {
    // Goal/Project-level items, new-goal/new-project suggestions, and
    // unmatched items all need a human placement decision -- hold them
    // visibly in the review-later queue rather than guessing.
    await secretary.saveCapture({ id: captureId, status: "pending-triage", rawText: text, triageDraft: draft });
    return { outcome: "held-for-review" };
  }

  const domain = draft.domain || "catchall";
  const contentType = draft.contentType || "quick-capture";
  const toolLocation = toolLocationFor(contentType, secretary.routingTable);
  const title = draft.title || text.slice(0, 80);

  let plan = (secretary.plans || []).find(
    (p) => p.parentType === "goal" && p.parentId === goalId && p.title === "Captured"
  );
  if (!plan) {
    const planId = await secretary.saveEntity("plan", {
      title: "Captured", parentType: "goal", parentId: goalId, domain, sessionIds: [], status: "active",
    });
    plan = { id: planId };
  }

  let session = (secretary.sessions || []).find(
    (s) => s.planId === plan.id && s.contentType === contentType && !s.done
  );
  if (!session) {
    const sessionId = await secretary.saveEntity("session", {
      title: draft.level === "session" ? title : `Captured -- ${domain}`,
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
