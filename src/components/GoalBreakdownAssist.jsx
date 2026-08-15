import { AIAssist, Btn, Card, Input, Select } from "../ui";
import { MONO, MUTE } from "../theme";
import { contentTypesForDomain, contentTypeLabel, toolLocationFor } from "../constants";
import { suggestGoalBreakdown } from "../lib/claude";

let tmpId = 0;
const nextTmpId = () => `tmp-${++tmpId}`;

// Turns the raw Cloud Function result into an editable draft -- same
// tmpId-keyed row shape WeeklyMeetingImport.jsx uses for its checklist, so
// every row can be included/excluded and edited before anything saves.
function toDraft(result) {
  return {
    includePlan: !!result.plan,
    planTitle: result.plan?.title || "",
    sessions: (result.sessions || []).map((s) => ({
      tmpId: nextTmpId(), include: true, title: s.title, contentType: s.contentType, targetDay: s.targetDay || "",
    })),
    tasks: (result.tasks || []).map((t) => ({
      tmpId: nextTmpId(), include: true, title: t.title, sessionTitle: t.sessionTitle, date: t.date || "",
    })),
  };
}

// The top-down counterpart to Trends' Promote-to-Goal: given an existing
// Goal, ask Secretary to draft a Plan + Sessions + Tasks that would serve
// it, review/edit the draft, then commit -- mirrors WeeklyMeetingImport's
// review-then-commit discipline via the shared AIAssist primitive (never
// writes anything until Tanner accepts).
export default function GoalBreakdownAssist({ goal, secretary, onDone }) {
  const contentTypeOptions = contentTypesForDomain(goal.domain, secretary.routingTable)
    .map((r) => ({ id: r.id, label: contentTypeLabel(r.id, secretary.routingTable) }));

  const generate = async () => {
    const result = await suggestGoalBreakdown({ goalTitle: goal.title, domain: goal.domain, tier: goal.tier });
    return toDraft(result);
  };

  // Left to throw on failure -- AIAssist's accept() catches it, shows the
  // error, and keeps the reviewed draft on screen rather than discarding it.
  const commit = async (draft) => {
    const includedSessions = draft.sessions.filter((s) => s.include);
    const includedTasks = draft.tasks.filter((t) => t.include);
    const needsPlan = draft.includePlan || includedSessions.length > 0 || includedTasks.length > 0;
    if (!needsPlan) { onDone?.(); return; }

    const planId = await secretary.saveEntity("plan", {
      title: draft.planTitle.trim() || goal.title, parentType: "goal", parentId: goal.id,
      domain: goal.domain, sessionIds: [], status: "active",
    });

    const sessionIdByTitle = new Map();
    for (const s of includedSessions) {
      const toolLocation = toolLocationFor(s.contentType, secretary.routingTable);
      const id = await secretary.saveEntity("session", {
        title: s.title, planId, domain: goal.domain, contentType: s.contentType, toolLocation,
        taskIds: [], targetDay: s.targetDay || null, done: false,
      });
      sessionIdByTitle.set(s.title, id);
    }

    for (const t of includedTasks) {
      const sessionId = sessionIdByTitle.get(t.sessionTitle) || null;
      await secretary.saveEntity("task", { title: t.title, sessionId, domain: goal.domain, done: false, date: t.date || null });
    }

    onDone?.();
  };

  const update = (setDraft, list, tmpIdVal, patch) => {
    setDraft((d) => ({ ...d, [list]: d[list].map((row) => (row.tmpId === tmpIdVal ? { ...row, ...patch } : row)) }));
  };

  return (
    <div>
      <AIAssist
        actionLabel="Ask Secretary to break this down…"
        autoStart
        onGenerate={generate}
        onAccept={commit}
        renderDraft={(draft, { setDraft }) => (
          <div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
                <input type="checkbox" checked={draft.includePlan} onChange={(e) => setDraft((d) => ({ ...d, includePlan: e.target.checked }))} />
                Plan
              </label>
              <Input value={draft.planTitle} onChange={(v) => setDraft((d) => ({ ...d, planTitle: v }))} placeholder={goal.title} />
            </div>

            {draft.sessions.length > 0 && (
              <>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Sessions</div>
                {draft.sessions.map((s) => (
                  <Card key={s.tmpId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                    <input type="checkbox" checked={s.include} onChange={(e) => update(setDraft, "sessions", s.tmpId, { include: e.target.checked })} />
                    <Input value={s.title} onChange={(v) => update(setDraft, "sessions", s.tmpId, { title: v })} width={170} />
                    <Select value={s.contentType} onChange={(v) => update(setDraft, "sessions", s.tmpId, { contentType: v })} options={contentTypeOptions} width={180} />
                    <Input value={s.targetDay} onChange={(v) => update(setDraft, "sessions", s.tmpId, { targetDay: v })} placeholder="YYYY-MM-DD" width={110} />
                  </Card>
                ))}
              </>
            )}

            {draft.tasks.length > 0 && (
              <>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Tasks</div>
                {draft.tasks.map((t) => (
                  <Card key={t.tmpId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                    <input type="checkbox" checked={t.include} onChange={(e) => update(setDraft, "tasks", t.tmpId, { include: e.target.checked })} />
                    <Input value={t.title} onChange={(v) => update(setDraft, "tasks", t.tmpId, { title: v })} width={200} />
                    <Input value={t.date} onChange={(v) => update(setDraft, "tasks", t.tmpId, { date: v })} placeholder="YYYY-MM-DD" width={110} />
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE }}>under "{t.sessionTitle}"</span>
                  </Card>
                ))}
              </>
            )}

            {draft.sessions.length === 0 && draft.tasks.length === 0 && (
              <p style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE }}>No Sessions or Tasks drafted -- accepting will just create the Plan above.</p>
            )}
          </div>
        )}
      />
      <div style={{ marginTop: 12 }}>
        <Btn small color={MUTE} onClick={() => onDone?.()}>Close</Btn>
      </div>
    </div>
  );
}
