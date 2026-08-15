import { useState } from "react";
import { Modal, Btn, Input, Select } from "../ui";
import { SERIF, MONO, INK, MUTE, INKBLUE, BRICK, LINE } from "../theme";
import {
  contentTypesForDomain, defaultContentTypeForDomain, contentTypeLabel, toolLocationFor, LIFECYCLE_STATUSES,
  INITIATORS, FAMILY_SCOPES, CONSENT_STATUSES, TIER_ORDER,
} from "../constants";
import { goalSubtreeIds } from "../lib/graph";

// A Goal can only reparent one tier up (yearly has none) -- and never into
// its own subtree, which would create a cycle. goalSubtreeIds() already
// gathers a Goal's whole descendant set for the rollup report; reused here
// to exclude exactly those ids from the candidate list.
function goalParentCandidates(goal, goals) {
  const tierIdx = TIER_ORDER.indexOf(goal.tier);
  if (tierIdx <= 0) return [];
  const parentTier = TIER_ORDER[tierIdx - 1];
  const excluded = new Set(goalSubtreeIds(goal.id, goals));
  return (goals || []).filter((g) => g.tier === parentTier && !excluded.has(g.id));
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

// Multi-select for secondaryDomains -- a native multi-select sized to show
// a handful of rows at once, consistent with the plain-<select> pattern
// used elsewhere for grouped/multi choices (see QuickAddModal's ParentPicker).
function DomainMultiSelect({ domains, value, onChange, exclude }) {
  const options = domains.filter((d) => d.id !== exclude);
  return (
    <select
      multiple
      value={value}
      onChange={(e) => onChange(Array.from(e.target.selectedOptions, (o) => o.value))}
      size={Math.min(6, options.length)}
      style={{ fontFamily: MONO, fontSize: 12, padding: "6px 9px", border: `1px solid ${LINE}`, borderRadius: 8, width: "100%" }}
    >
      {options.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
    </select>
  );
}

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

// Edit + retroactive realignment: tapping a card's body (not its checkbox)
// opens this. Every entity type gets title/domain/secondaryDomains; Plan and
// Session additionally get their parent-link reassigned here -- the concrete
// "we mis-categorized this, attach it properly now" fix, usable from any
// card or from Trends' Unlinked-work tab.
export default function EditEntityModal({ type, entity, secretary, onClose }) {
  const [title, setTitle] = useState(entity.title);
  const [domain, setDomain] = useState(entity.domain || secretary.domains[0]?.id || "");
  const [secondaryDomains, setSecondaryDomains] = useState(entity.secondaryDomains || []);
  const [status, setStatus] = useState(entity.status || "active");
  const [targetDate, setTargetDate] = useState(entity.targetDate || "");
  const [goalParentId, setGoalParentId] = useState(entity.parentGoalId || "");
  const [contentType, setContentType] = useState(
    entity.contentType || defaultContentTypeForDomain(entity.domain || secretary.domains[0]?.id || "", secretary.routingTable)
  );
  const [targetDay, setTargetDay] = useState(entity.targetDay || "");
  const [date, setDate] = useState(entity.date || "");
  const [sessionId, setSessionId] = useState(entity.sessionId || "");
  const [initiator, setInitiator] = useState(entity.initiator || "me");
  const [familyScope, setFamilyScope] = useState(entity.familyScope || "personal");
  const [consentStatus, setConsentStatus] = useState(entity.consentStatus || "pending");
  const [planParent, setPlanParent] = useState(
    entity.parentType ? { parentType: entity.parentType, parentId: entity.parentId } : null
  );
  const [planId, setPlanId] = useState(entity.planId || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Categories are domain-exclusive -- switching domains re-picks a sensible
  // default from the new domain's own list rather than carrying over a
  // content-type that no longer belongs to it.
  const changeDomain = (nextDomain) => {
    setDomain(nextDomain);
    if (type === "session" || type === "task") setContentType(defaultContentTypeForDomain(nextDomain, secretary.routingTable));
  };

  const contentTypeOptions = contentTypesForDomain(domain, secretary.routingTable).map((r) => ({ id: r.id, label: contentTypeLabel(r.id, secretary.routingTable) }));
  const taskContentTypeOptions = [{ id: "", label: "-- none --" }, ...contentTypeOptions];
  const goalParentOptions = type === "goal" ? goalParentCandidates(entity, secretary.goals) : [];
  const plansInDomain = (secretary.plans || []).filter((p) => p.domain === domain);
  const sessionsInDomain = (secretary.sessions || []).filter((s) => s.domain === domain);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const patch = { ...entity, title: title.trim(), domain, secondaryDomains };
      if (type === "goal" || type === "project" || type === "plan") patch.status = status;
      if (type === "goal") {
        patch.targetDate = targetDate || null;
        patch.parentGoalId = goalParentId || null;
      }
      if (type === "project") {
        patch.initiator = initiator;
        patch.familyScope = familyScope;
        if (familyScope === "touches-family") patch.consentStatus = consentStatus;
        else delete patch.consentStatus;
      }
      if (type === "plan") {
        patch.parentType = planParent?.parentType || null;
        patch.parentId = planParent?.parentId || null;
      }
      if (type === "session") {
        patch.contentType = contentType;
        patch.toolLocation = toolLocationFor(contentType, secretary.routingTable);
        patch.targetDay = targetDay || null;
        patch.planId = planId || entity.planId;
      }
      if (type === "task") {
        patch.date = date || null;
        patch.sessionId = sessionId || null;
        patch.contentType = contentType || null;
      }
      await secretary.saveEntity(type, patch);
      onClose();
    } catch (err) {
      setError(err.message || "Could not save that.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} width={420}>
      <h3 style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, margin: "0 0 12px" }}>Edit</h3>

      <Field label="Title">
        <Input value={title} onChange={setTitle} onEnter={save} autoFocus />
      </Field>

      <Field label="Domain">
        <Select value={domain} onChange={changeDomain} options={secretary.domains} />
      </Field>

      <Field label="Secondary domains (optional -- ⌘/Ctrl-click for more than one)">
        <DomainMultiSelect domains={secretary.domains} value={secondaryDomains} onChange={setSecondaryDomains} exclude={domain} />
      </Field>

      {(type === "goal" || type === "project" || type === "plan") && (
        <Field label="Status">
          <Select value={status} onChange={setStatus} options={LIFECYCLE_STATUSES} />
        </Field>
      )}

      {type === "goal" && (
        <Field label="Target date (optional)">
          <Input value={targetDate} onChange={setTargetDate} placeholder="YYYY-MM-DD" />
        </Field>
      )}

      {type === "goal" && (goalParentOptions.length > 0 || entity.parentGoalId) && (
        <Field label="Parent goal (reassign to fix a mis-categorization)">
          <select
            value={goalParentId}
            onChange={(e) => setGoalParentId(e.target.value)}
            style={{ fontFamily: MONO, fontSize: 12, padding: "6px 9px", border: `1px solid ${LINE}`, borderRadius: 8, width: "100%" }}
          >
            <option value="">-- root, no parent --</option>
            {goalParentOptions.map((g) => <option key={g.id} value={g.id}>{g.title} ({g.tier})</option>)}
          </select>
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
          {familyScope === "touches-family" && (
            <Field label="Consent">
              <Select value={consentStatus} onChange={setConsentStatus} options={CONSENT_STATUSES} />
            </Field>
          )}
        </>
      )}

      {type === "plan" && (
        <Field label="Serves (reassign to fix a mis-categorization)">
          <ParentPicker goals={secretary.goals} projects={secretary.projects} value={planParent} onChange={setPlanParent} />
        </Field>
      )}

      {type === "session" && (
        <>
          <Field label="Content-type">
            <Select value={contentType} onChange={setContentType} options={contentTypeOptions} />
          </Field>
          <Field label="Target day">
            <Input value={targetDay} onChange={setTargetDay} placeholder="YYYY-MM-DD" />
          </Field>
          <Field label="Plan (reassign to fix a mis-categorization)">
            <select value={planId || entity.planId} onChange={(e) => setPlanId(e.target.value)} style={{ fontFamily: MONO, fontSize: 12, padding: "6px 9px", border: `1px solid ${LINE}`, borderRadius: 8, width: "100%" }}>
              {plansInDomain.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
        </>
      )}

      {type === "task" && (
        <>
          <Field label="Date">
            <Input value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
          </Field>
          <Field label="Content-type (optional)">
            <Select value={contentType} onChange={setContentType} options={taskContentTypeOptions} />
          </Field>
          <Field label="Session (reassign to fix a mis-categorization)">
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} style={{ fontFamily: MONO, fontSize: 12, padding: "6px 9px", border: `1px solid ${LINE}`, borderRadius: 8, width: "100%" }}>
              <option value="">-- none (standalone) --</option>
              {sessionsInDomain.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </Field>
        </>
      )}

      {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Btn primary color={INKBLUE} disabled={saving || !title.trim()} onClick={save}>{saving ? "Saving…" : "Save"}</Btn>
        <Btn color={MUTE} onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  );
}
