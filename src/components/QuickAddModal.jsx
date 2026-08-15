import { useState } from "react";
import { Modal, Btn, Input, Select } from "../ui";
import { SERIF, MONO, INK, MUTE, INKBLUE, LINE, BRICK } from "../theme";
import { contentTypesForDomain, defaultContentTypeForDomain, contentTypeLabel, toolLocationFor, INITIATORS, FAMILY_SCOPES, todayISO } from "../constants";
import { findOrCreatePlan, quickPlanTitle } from "../lib/placeCapture";

const TYPE_LABELS = { task: "Task", session: "Session", plan: "Plan", project: "Project" };

function TypeTabs({ types, active, onChange }) {
  if (types.length < 2) return null;
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {types.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          style={{
            fontFamily: MONO, fontSize: 11.5, padding: "5px 12px", borderRadius: 999, cursor: "pointer",
            border: `1px solid ${active === t ? INKBLUE : LINE}`, background: active === t ? INKBLUE : "transparent",
            color: active === t ? "#fff" : MUTE,
          }}
        >
          {TYPE_LABELS[t]}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

// A single dropdown of every existing Goal (grouped by tier) plus every
// Project, or "-- ungrounded --" -- the parent picker for a new Plan. Plain
// <select>/<optgroup> rather than the Select primitive, same pattern
// WeeklyMeetingImport.jsx already uses for a grouped choice.
function ParentPicker({ goals, projects, value, onChange }) {
  return (
    <select
      value={value ? `${value.parentType}:${value.parentId}` : ""}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return onChange(null);
        const [parentType, parentId] = v.split(":");
        onChange({ parentType, parentId });
      }}
      style={{ fontFamily: MONO, fontSize: 12, padding: "6px 9px", border: `1px solid ${LINE}`, borderRadius: 8, width: "100%" }}
    >
      <option value="">-- not yet linked (ungrounded) --</option>
      <optgroup label="Goals">
        {(goals || []).map((g) => <option key={g.id} value={`goal:${g.id}`}>{g.title} ({g.tier})</option>)}
      </optgroup>
      <optgroup label="Projects">
        {(projects || []).map((p) => <option key={p.id} value={`project:${p.id}`}>{p.title}</option>)}
      </optgroup>
    </select>
  );
}

export default function QuickAddModal({ secretary, types, defaultType, defaults = {}, onClose, onSaved }) {
  const [type, setType] = useState(defaultType || types[0]);
  const [title, setTitle] = useState(defaults.title || "");
  const [domain, setDomain] = useState(defaults.domain || secretary.domains[0]?.id || "");
  const [date, setDate] = useState(defaults.date || (type === "task" ? todayISO() : ""));
  const [targetDay, setTargetDay] = useState(defaults.targetDay || "");
  const [contentType, setContentType] = useState(
    defaults.contentType || defaultContentTypeForDomain(defaults.domain || secretary.domains[0]?.id || "", secretary.routingTable)
  );
  const [sessionId, setSessionId] = useState(defaults.sessionId || "");
  const [planParent, setPlanParent] = useState(
    defaults.parentType && defaults.parentId ? { parentType: defaults.parentType, parentId: defaults.parentId } : null
  );
  const [initiator, setInitiator] = useState("me");
  const [familyScope, setFamilyScope] = useState("personal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Categories are domain-exclusive -- switching domains re-picks a sensible
  // default from the new domain's own list rather than carrying over a
  // content-type that no longer belongs to it.
  const changeDomain = (nextDomain) => {
    setDomain(nextDomain);
    setContentType(defaultContentTypeForDomain(nextDomain, secretary.routingTable));
  };

  const contentTypeOptions = contentTypesForDomain(domain, secretary.routingTable).map((r) => ({ id: r.id, label: contentTypeLabel(r.id, secretary.routingTable) }));
  const taskContentTypeOptions = [{ id: "", label: "-- none --" }, ...contentTypeOptions];
  const sessionsInDomain = (secretary.sessions || []).filter((s) => s.domain === domain && !s.done);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (type === "task") {
        await secretary.saveEntity("task", {
          title: title.trim(), domain, contentType: contentType || null, sessionId: sessionId || null, done: false, date: date || null,
        });
      } else if (type === "session") {
        let planId = defaults.planId || null;
        if (!planId) {
          const plan = await findOrCreatePlan(secretary, { domain, title: quickPlanTitle(domain, secretary.domains) });
          planId = plan.id;
        }
        const toolLocation = toolLocationFor(contentType, secretary.routingTable);
        await secretary.saveEntity("session", {
          title: title.trim(), planId, domain, contentType, toolLocation,
          taskIds: [], targetDay: targetDay || null, done: false,
        });
      } else if (type === "plan") {
        await secretary.saveEntity("plan", {
          title: title.trim(), domain, sessionIds: [], status: "active",
          parentType: planParent?.parentType || null, parentId: planParent?.parentId || null,
        });
      } else if (type === "project") {
        await secretary.saveEntity("project", {
          title: title.trim(), domain, initiator, familyScope,
          ...(familyScope === "touches-family" ? { consentStatus: "pending" } : {}),
          status: "active",
        });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || "Could not save that.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} width={420}>
      <h3 style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, margin: "0 0 12px" }}>Add</h3>
      <TypeTabs types={types} active={type} onChange={setType} />

      <Field label="Title">
        <Input value={title} onChange={setTitle} placeholder={`New ${TYPE_LABELS[type].toLowerCase()}…`} autoFocus onEnter={save} />
      </Field>

      <Field label="Domain">
        <Select value={domain} onChange={changeDomain} options={secretary.domains} />
      </Field>

      {type === "task" && (
        <>
          <Field label="Date">
            <Input value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
          </Field>
          <Field label="Content-type (optional)">
            <Select value={contentType} onChange={setContentType} options={taskContentTypeOptions} />
          </Field>
          {sessionsInDomain.length > 0 && (
            <Field label="Attach to a Session (optional)">
              <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} style={{ fontFamily: MONO, fontSize: 12, padding: "6px 9px", border: `1px solid ${LINE}`, borderRadius: 8, width: "100%" }}>
                <option value="">-- none --</option>
                {sessionsInDomain.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </Field>
          )}
        </>
      )}

      {type === "session" && (
        <>
          <Field label="Content-type">
            <Select value={contentType} onChange={setContentType} options={contentTypeOptions} />
          </Field>
          <Field label="Target day">
            <Input value={targetDay} onChange={setTargetDay} placeholder="YYYY-MM-DD" />
          </Field>
          <p style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, margin: "0 0 12px" }}>
            → {toolLocationFor(contentType, secretary.routingTable)}
          </p>
        </>
      )}

      {type === "plan" && (
        <Field label="Serves">
          <ParentPicker goals={secretary.goals} projects={secretary.projects} value={planParent} onChange={setPlanParent} />
        </Field>
      )}

      {type === "project" && (
        <>
          <Field label="Initiator">
            <Select value={initiator} onChange={setInitiator} options={INITIATORS} />
          </Field>
          <Field label="Family scope">
            <Select value={familyScope} onChange={setFamilyScope} options={FAMILY_SCOPES} />
          </Field>
        </>
      )}

      {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Btn primary color={INKBLUE} disabled={saving || !title.trim()} onClick={save}>{saving ? "Saving…" : "Add"}</Btn>
        <Btn color={MUTE} onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  );
}
