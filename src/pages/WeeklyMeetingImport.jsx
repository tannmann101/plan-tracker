import { useState } from "react";
import { Btn, SectionTitle, Note, Card, Input, Select } from "../ui";
import { MONO, MUTE, BRICK, INKBLUE, LINE } from "../theme";
import { TIERS, DEFAULT_DOMAINS, CONTENT_TYPE_IDS, DEFAULT_ROUTING_TABLE, toolLocationFor, contentTypeLabel } from "../constants";
import { parseWeeklyPhoto, fileToImagePayload } from "../lib/claude";

const CONTENT_TYPE_OPTIONS = CONTENT_TYPE_IDS.map((id) => ({ id, label: contentTypeLabel(id, DEFAULT_ROUTING_TABLE) }));

let tmpId = 0;
const nextTmpId = () => `tmp-${++tmpId}`;

export default function WeeklyMeetingImport({ secretary, onBack }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState(null); // { goals, plans, sessions, tasks }
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const domains = secretary.domains?.length ? secretary.domains : DEFAULT_DOMAINS;

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setLoading(true);
    try {
      const { imageBase64, mediaType } = await fileToImagePayload(f);
      const existingGoals = (secretary.goals || []).map((g) => ({ id: g.id, title: g.title, tier: g.tier, domain: g.domain }));
      const result = await parseWeeklyPhoto({ imageBase64, mediaType, existingGoals });
      setRows({
        goals: (result.goals || []).map((g) => ({ tmpId: nextTmpId(), include: true, title: g.title, tier: g.tier, domain: g.domain, existingGoalId: g.existingGoalId || null })),
        plans: (result.plans || []).map((p) => ({ tmpId: nextTmpId(), include: true, title: p.title, domain: p.domain, goalTitle: p.goalTitle || "" })),
        sessions: (result.sessions || []).map((s) => ({ tmpId: nextTmpId(), include: true, title: s.title, planTitle: s.planTitle, domain: s.domain, contentType: s.contentType, targetDay: s.targetDay || "" })),
        tasks: (result.tasks || []).map((t) => ({ tmpId: nextTmpId(), include: true, title: t.title, sessionTitle: t.sessionTitle, date: t.date || "" })),
      });
    } catch (err) {
      setError(err.message || "Could not parse that photo.");
    } finally {
      setLoading(false);
    }
  };

  const update = (list, tmpIdVal, patch) => {
    setRows((r) => ({ ...r, [list]: r[list].map((row) => (row.tmpId === tmpIdVal ? { ...row, ...patch } : row)) }));
  };

  const goalTitleOptions = () => {
    const fromExisting = (secretary.goals || []).map((g) => g.title);
    const fromDraft = (rows?.goals || []).filter((g) => g.include).map((g) => g.title);
    return [...new Set([...fromExisting, ...fromDraft])];
  };

  const commit = async () => {
    setSaving(true);
    setError(null);
    try {
      const goalIdByTitle = new Map((secretary.goals || []).map((g) => [g.title, g.id]));
      for (const g of rows.goals) {
        if (!g.include) continue;
        if (g.existingGoalId) {
          goalIdByTitle.set(g.title, g.existingGoalId);
          continue;
        }
        const id = await secretary.saveEntity("goal", {
          title: g.title, tier: g.tier, domain: g.domain, owner: "tanner", parentGoalId: null, status: "active",
        });
        goalIdByTitle.set(g.title, id);
      }

      const planIdByTitle = new Map();
      for (const p of rows.plans) {
        if (!p.include) continue;
        const goalId = goalIdByTitle.get(p.goalTitle);
        if (!goalId) continue; // no resolvable parent -- skip rather than write an invalid Plan
        const id = await secretary.saveEntity("plan", {
          title: p.title, parentType: "goal", parentId: goalId, domain: p.domain, sessionIds: [], status: "active",
        });
        planIdByTitle.set(p.title, id);
      }

      const sessionIdByTitle = new Map();
      for (const s of rows.sessions) {
        if (!s.include) continue;
        const planId = planIdByTitle.get(s.planTitle);
        if (!planId) continue;
        const toolLocation = toolLocationFor(s.contentType, secretary.routingTable);
        const id = await secretary.saveEntity("session", {
          title: s.title, planId, domain: s.domain, contentType: s.contentType, toolLocation,
          taskIds: [], targetDay: s.targetDay || null, done: false,
        });
        sessionIdByTitle.set(s.title, id);
      }

      for (const t of rows.tasks) {
        if (!t.include) continue;
        const sessionId = sessionIdByTitle.get(t.sessionTitle);
        if (!sessionId) continue;
        await secretary.saveEntity("task", { title: t.title, sessionId, done: false, date: t.date || null });
      }

      setSaved(true);
    } catch (err) {
      setError(err.message || "Could not save everything.");
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div>
        <Btn small onClick={onBack} color={MUTE}>← This Week</Btn>
        <SectionTitle>Recorded</SectionTitle>
        <Note>The week's Goals, Plans, Sessions, and Tasks have been placed. This Week and the Goals tree now reflect them.</Note>
      </div>
    );
  }

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← This Week</Btn>
      <SectionTitle>Import Weekly-Meeting Photo</SectionTitle>
      {!rows && (
        <>
          <Note>Upload a photo of your handwritten weekly-meeting notebook page. Nothing is saved until you review the extracted checklist below.</Note>
          <div style={{ marginTop: 12 }}>
            <input type="file" accept="image/*" onChange={onFile} disabled={loading} />
          </div>
          {loading && <p style={{ fontFamily: MONO, fontSize: 12, color: MUTE, marginTop: 10 }}>Reading the page…</p>}
          {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK, marginTop: 10 }}>{error} <button type="button" onClick={() => onFile({ target: { files: [file] } })} style={{ border: "none", background: "none", color: INKBLUE, cursor: "pointer", textDecoration: "underline" }}>Try again</button></p>}
        </>
      )}

      {rows && (
        <div>
          <Note>Review and edit everything below -- nothing saves until you press "Save all" at the bottom. Uncheck anything that shouldn't be recorded.</Note>

          <SectionTitle note={`${rows.goals.length}`}>Goals in context</SectionTitle>
          {rows.goals.length === 0 && <Note>None extracted.</Note>}
          {rows.goals.map((g) => (
            <Card key={g.tmpId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
              <input type="checkbox" checked={g.include} onChange={(e) => update("goals", g.tmpId, { include: e.target.checked })} />
              <Input value={g.title} onChange={(v) => update("goals", g.tmpId, { title: v })} width={220} />
              <Select value={g.tier} onChange={(v) => update("goals", g.tmpId, { tier: v })} options={TIERS} width={110} />
              <Select value={g.domain} onChange={(v) => update("goals", g.tmpId, { domain: v })} options={domains} width={160} />
              {g.existingGoalId && <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE }}>matches existing</span>}
            </Card>
          ))}

          <SectionTitle note={`${rows.plans.length}`}>This week's Plans</SectionTitle>
          {rows.plans.length === 0 && <Note>None extracted.</Note>}
          {rows.plans.map((p) => (
            <Card key={p.tmpId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
              <input type="checkbox" checked={p.include} onChange={(e) => update("plans", p.tmpId, { include: e.target.checked })} />
              <Input value={p.title} onChange={(v) => update("plans", p.tmpId, { title: v })} width={200} />
              <Select value={p.domain} onChange={(v) => update("plans", p.tmpId, { domain: v })} options={domains} width={150} />
              <select value={p.goalTitle} onChange={(e) => update("plans", p.tmpId, { goalTitle: e.target.value })} style={{ fontFamily: MONO, fontSize: 12, padding: "6px 9px", border: `1px solid ${LINE}`, borderRadius: 8 }}>
                <option value="">-- attach to Goal --</option>
                {goalTitleOptions().map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {!p.goalTitle && <span style={{ fontFamily: MONO, fontSize: 10.5, color: BRICK }}>needs a Goal to save</span>}
            </Card>
          ))}

          <SectionTitle note={`${rows.sessions.length}`}>Sessions</SectionTitle>
          {rows.sessions.length === 0 && <Note>None extracted.</Note>}
          {rows.sessions.map((s) => (
            <Card key={s.tmpId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
              <input type="checkbox" checked={s.include} onChange={(e) => update("sessions", s.tmpId, { include: e.target.checked })} />
              <Input value={s.title} onChange={(v) => update("sessions", s.tmpId, { title: v })} width={180} />
              <Select value={s.domain} onChange={(v) => update("sessions", s.tmpId, { domain: v })} options={domains} width={140} />
              <Select value={s.contentType} onChange={(v) => update("sessions", s.tmpId, { contentType: v })} options={CONTENT_TYPE_OPTIONS} width={190} />
              <Input value={s.targetDay || ""} onChange={(v) => update("sessions", s.tmpId, { targetDay: v })} placeholder="YYYY-MM-DD" width={110} />
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE }}>{toolLocationFor(s.contentType, secretary.routingTable)}</span>
            </Card>
          ))}

          <SectionTitle note={`${rows.tasks.length}`}>Tasks</SectionTitle>
          {rows.tasks.length === 0 && <Note>None extracted.</Note>}
          {rows.tasks.map((t) => (
            <Card key={t.tmpId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
              <input type="checkbox" checked={t.include} onChange={(e) => update("tasks", t.tmpId, { include: e.target.checked })} />
              <Input value={t.title} onChange={(v) => update("tasks", t.tmpId, { title: v })} width={240} />
              <Input value={t.date || ""} onChange={(v) => update("tasks", t.tmpId, { date: v })} placeholder="YYYY-MM-DD" width={110} />
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE }}>under "{t.sessionTitle}"</span>
            </Card>
          ))}

          {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Btn primary color={INKBLUE} disabled={saving} onClick={commit}>{saving ? "Saving…" : "Save all"}</Btn>
            <Btn color={MUTE} onClick={() => setRows(null)}>Start over</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
