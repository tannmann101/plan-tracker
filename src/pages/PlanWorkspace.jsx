import { useState } from "react";
import { Btn, SectionTitle, Note, Card, Pill, Input } from "../ui";
import { SANS, MONO, INK, MUTE, INKBLUE, BRICK, TIER_COLORS, softTint } from "../theme";
import EditEntityModal from "../components/EditEntityModal";
import { findOrCreatePlan, findOrCreateGroundedSession } from "../lib/placeCapture";
import { defaultContentTypeForDomain, toolLocationFor, TIER_ORDER, domainLabel } from "../constants";

// A rough idea's row: its text (click to rename), and -- owner only -- the
// two convert buttons plus a discard. Converting always grounds the new
// Task/Session under this Goal (via the same find-or-create helpers the
// Goal breakdown assist and Promote-to-Goal already use), then hands off
// to the shared EditEntityModal so refining domain/content-type/date
// happens in the same motion as converting, with no separate form to build.
function IdeaRow({ idea, goal, secretary, isOwner, onConverted }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(idea.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const rename = async () => {
    if (!title.trim() || title.trim() === idea.title) { setEditing(false); setTitle(idea.title); return; }
    await secretary.saveIdea({ ...idea, title: title.trim() });
    setEditing(false);
  };

  const convertToTask = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await findOrCreateGroundedSession(secretary, { domain: goal.domain, goalId: goal.id, goalTitle: goal.title });
      const taskId = await secretary.saveEntity("task", {
        title: idea.title, sessionId: session.id, domain: goal.domain, done: false, date: null,
      });
      await secretary.deleteIdea(idea.id);
      onConverted({ type: "task", entity: { id: taskId, title: idea.title, sessionId: session.id, domain: goal.domain, done: false, date: null } });
    } catch (err) {
      setError(err.message || "Could not convert that.");
    } finally {
      setBusy(false);
    }
  };

  const convertToSession = async () => {
    setBusy(true);
    setError(null);
    try {
      const plan = await findOrCreatePlan(secretary, { domain: goal.domain, parentType: "goal", parentId: goal.id, title: goal.title });
      const contentType = defaultContentTypeForDomain(goal.domain, secretary.routingTable);
      const toolLocation = toolLocationFor(contentType, secretary.routingTable);
      const sessionId = await secretary.saveEntity("session", {
        title: idea.title, planId: plan.id, domain: goal.domain, contentType, toolLocation, taskIds: [], targetDay: null, done: false,
      });
      await secretary.deleteIdea(idea.id);
      onConverted({
        type: "session",
        entity: { id: sessionId, title: idea.title, planId: plan.id, domain: goal.domain, contentType, toolLocation, taskIds: [], targetDay: null, done: false },
      });
    } catch (err) {
      setError(err.message || "Could not convert that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {editing ? (
          <Input value={title} onChange={setTitle} onEnter={rename} autoFocus width={260} />
        ) : (
          <div
            onClick={isOwner ? () => setEditing(true) : undefined}
            style={{ fontFamily: SANS, fontSize: 13.5, color: INK, cursor: isOwner ? "pointer" : "default", flex: 1, minWidth: 160 }}
          >
            {idea.title}
          </div>
        )}
        {isOwner && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {editing ? (
              <>
                <Btn small primary color={INKBLUE} onClick={rename}>Save</Btn>
                <Btn small color={MUTE} onClick={() => { setTitle(idea.title); setEditing(false); }}>Cancel</Btn>
              </>
            ) : (
              <>
                <Btn small disabled={busy} onClick={convertToTask}>{busy ? "…" : "→ Task"}</Btn>
                <Btn small disabled={busy} onClick={convertToSession}>{busy ? "…" : "→ Session"}</Btn>
                <Btn small color={BRICK} disabled={busy} onClick={() => secretary.deleteIdea(idea.id)}>×</Btn>
              </>
            )}
          </div>
        )}
      </div>
      {error && <p style={{ fontFamily: MONO, fontSize: 11, color: BRICK, margin: 0 }}>{error}</p>}
    </Card>
  );
}

function GoalIdeaBoard({ goal, secretary, isOwner, onOpenEdit }) {
  const [newTitle, setNewTitle] = useState("");
  const color = TIER_COLORS[goal.tier] || MUTE;
  const ideas = (secretary.ideas || []).filter((i) => i.goalId === goal.id);

  const add = async () => {
    if (!newTitle.trim()) return;
    await secretary.saveIdea({ goalId: goal.id, title: newTitle.trim() });
    setNewTitle("");
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: INK }}>{goal.title}</span>
        <Pill color={color} tint={softTint(color)}>{goal.tier}</Pill>
        <Pill>{domainLabel(goal.domain, secretary.domains)}</Pill>
      </div>
      {isOwner && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Input value={newTitle} onChange={setNewTitle} placeholder="Jot a rough idea…" onEnter={add} />
          <Btn small primary color={INKBLUE} onClick={add} disabled={!newTitle.trim()}>Add</Btn>
        </div>
      )}
      {ideas.length === 0 ? (
        <Note>No rough ideas yet -- jot one above.</Note>
      ) : (
        ideas.map((idea) => (
          <IdeaRow key={idea.id} idea={idea} goal={goal} secretary={secretary} isOwner={isOwner} onConverted={onOpenEdit} />
        ))
      )}
    </div>
  );
}

// The freeform, manual counterpart to Goals.jsx's AI-assisted "break this
// down" -- plain scratch notes tied to a Goal, none of them a real Session
// or Task until you say so. See lib/placeCapture.js's findOrCreatePlan /
// findOrCreateGroundedSession for the grounding logic conversion shares
// with Trends' Promote-to-Goal flow.
export default function PlanWorkspace({ secretary, isOwner, onBack }) {
  const [editing, setEditing] = useState(null);
  const goals = (secretary.goals || [])
    .filter((g) => g.status === "active")
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.title.localeCompare(b.title));

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Hub</Btn>
      <SectionTitle note="rough ideas, before they become Sessions or Tasks">Plan Workspace</SectionTitle>
      <Note>
        Jot a half-formed idea under whichever Goal it's for -- nothing here is a real Session or Task yet, no domain or
        content-type to fill in. Convert one when it's ready, or discard it if it didn't pan out.
      </Note>
      {goals.length === 0 ? (
        <Note>No active Goals yet -- add one from the Goals page first.</Note>
      ) : (
        goals.map((g) => <GoalIdeaBoard key={g.id} goal={g} secretary={secretary} isOwner={isOwner} onOpenEdit={setEditing} />)
      )}
      {editing && (
        <EditEntityModal type={editing.type} entity={editing.entity} secretary={secretary} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
