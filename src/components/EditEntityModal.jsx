import { useState } from "react";
import { Modal, Btn, Input, Select } from "../ui";
import { SERIF, SANS, MONO, INK, MUTE, INKBLUE, BRICK } from "../theme";
import { KIND_STATUSES, INITIATORS, FAMILY_SCOPES, CONSENT_STATUSES, DEFAULT_DURATION_MINUTES } from "../constants";
import { allTagsInUse, kindSubtreeIds, itemsForKind } from "../lib/graph";
import { Field, TagsInput, MultiCheckList, MilestonesEditor, KindParentPicker, DurationInput } from "./formFields";

// The universal Kind/Item edit surface (§15) -- tapping any card's body
// anywhere in the app opens this, same field set the Add Form offers, plus
// delete. Evolved in place from the prior rework's EditEntityModal rather
// than forked, so every page shares one edit implementation.
export default function EditEntityModal({ family, entity, secretary, onClose, onDeleted }) {
  const [title, setTitle] = useState(entity.title);
  const [domain, setDomain] = useState(entity.domain || secretary.domains[0]?.id || "");
  const [secondaryDomains, setSecondaryDomains] = useState(entity.secondaryDomains || []);
  const [resources, setResources] = useState(entity.resources || []);
  const [tags, setTags] = useState(entity.tags || []);
  const [parentKindId, setParentKindId] = useState(entity.parentKindId || null);

  const [status, setStatus] = useState(entity.status || "not-started");
  const [initiator, setInitiator] = useState(entity.initiator || "me");
  const [familyScope, setFamilyScope] = useState(entity.familyScope || "personal");
  const [consentStatus, setConsentStatus] = useState(entity.consentStatus || "pending");

  const [done, setDone] = useState(!!entity.done);
  const [targetDay, setTargetDay] = useState(entity.timing?.targetDay || "");
  const [floating, setFloating] = useState(entity.timing?.floating !== false);
  const [time, setTime] = useState(entity.timing?.time || "");
  const [durationMinutes, setDurationMinutes] = useState(String(entity.timing?.durationMinutes || DEFAULT_DURATION_MINUTES));
  const [startDate, setStartDate] = useState(entity.timing?.startDate || "");
  const [dueDate, setDueDate] = useState(entity.timing?.dueDate || "");
  const [milestones, setMilestones] = useState(entity.timing?.milestones || []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteMode, setDeleteMode] = useState("unlink"); // unlink | cascade -- only relevant for a Kind with linked Items

  const tagSuggestions = allTagsInUse(secretary);
  const linkedItems = family === "kind" ? itemsForKind(entity.id, secretary.items) : [];
  const excludeIds = family === "kind" ? kindSubtreeIds(entity.id, secretary.kinds) : null;

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const patch = { ...entity, title: title.trim(), domain, secondaryDomains, resources, tags, parentKindId: parentKindId || null };
      if (family === "kind") {
        patch.status = status;
        patch.timing = (startDate || dueDate || milestones.length) ? { startDate: startDate || null, dueDate: dueDate || null, milestones } : null;
        if (entity.kindType === "project") {
          patch.initiator = initiator;
          patch.familyScope = familyScope;
          if (familyScope === "touches-family") patch.consentStatus = consentStatus;
          else delete patch.consentStatus;
        }
      } else {
        patch.done = done;
        patch.completedAt = done ? (entity.completedAt || Date.now()) : null;
        patch.timing = (targetDay || dueDate || milestones.length)
          ? {
              targetDay: targetDay || null, time: floating ? null : (time || null),
              durationMinutes: floating ? null : Number(durationMinutes),
              dueDate: dueDate || null, floating, milestones,
            }
          : null;
      }
      await secretary.saveEntity(family, patch);
      onClose();
    } catch (err) {
      setError(err.message || "Could not save that.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setSaving(true);
    setError(null);
    try {
      if (family === "kind" && linkedItems.length > 0 && deleteMode === "cascade") {
        for (const item of linkedItems) await secretary.deleteEntity("item", item.id);
      } else if (family === "kind" && linkedItems.length > 0) {
        for (const item of linkedItems) await secretary.saveEntity("item", { ...item, parentKindId: null });
      }
      await secretary.deleteEntity(family, entity.id);
      onDeleted?.();
      onClose();
    } catch (err) {
      setError(err.message || "Could not delete that.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} width={440}>
      <h3 style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, margin: "0 0 12px" }}>Edit</h3>

      <Field label="Name">
        <Input value={title} onChange={setTitle} onEnter={save} autoFocus />
      </Field>

      <Field label="Domain">
        <Select value={domain} onChange={setDomain} options={secretary.domains} />
      </Field>

      <Field label="Secondary domains (optional)">
        <MultiCheckList options={secretary.domains.filter((d) => d.id !== domain)} value={secondaryDomains} onChange={setSecondaryDomains} />
      </Field>

      <Field label="Resources (optional)">
        <MultiCheckList options={secretary.resources} value={resources} onChange={setResources} />
      </Field>

      <Field label="Tags">
        <TagsInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
      </Field>

      {family === "kind" && (
        <>
          <Field label="Status">
            <Select value={status} onChange={setStatus} options={KIND_STATUSES} />
          </Field>
          <Field label="Parent (reassign to fix a mis-categorization)">
            <KindParentPicker kinds={secretary.kinds} value={parentKindId} onChange={setParentKindId} excludeIds={excludeIds} />
          </Field>
          {entity.kindType === "project" && (
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
          <Field label="Start date (optional)">
            <Input type="date" value={startDate} onChange={setStartDate} />
          </Field>
          <Field label="Due date (optional)">
            <Input type="date" value={dueDate} onChange={setDueDate} />
          </Field>
          <Field label="Milestones (optional)">
            <MilestonesEditor value={milestones} onChange={setMilestones} />
          </Field>
        </>
      )}

      {family === "item" && (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 12, color: INK, cursor: "pointer", marginBottom: 12 }}>
            <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
            Done
          </label>
          <Field label="Attach to (reassign to fix a mis-categorization)">
            <KindParentPicker kinds={secretary.kinds} value={parentKindId} onChange={setParentKindId} />
          </Field>
          <Field label="Target day">
            <Input type="date" value={targetDay} onChange={setTargetDay} />
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 12, color: INK, cursor: "pointer", marginBottom: 12 }}>
            <input type="checkbox" checked={floating} onChange={(e) => setFloating(e.target.checked)} />
            Floating (no specific time)
          </label>
          {!floating && (
            <>
              <Field label="Time">
                <Input type="time" value={time} onChange={setTime} />
              </Field>
              <Field label="Duration">
                <DurationInput value={durationMinutes} onChange={setDurationMinutes} />
              </Field>
            </>
          )}
          <Field label="Due date (optional, if different)">
            <Input type="date" value={dueDate} onChange={setDueDate} />
          </Field>
          <Field label="Milestones (optional)">
            <MilestonesEditor value={milestones} onChange={setMilestones} />
          </Field>
        </>
      )}

      {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK }}>{error}</p>}

      {confirmingDelete ? (
        <div style={{ borderTop: "1px solid #E4DECC", marginTop: 14, paddingTop: 14 }}>
          {family === "kind" && linkedItems.length > 0 && (
            <>
              <p style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE, margin: "0 0 8px" }}>
                {linkedItems.length} Item{linkedItems.length === 1 ? "" : "s"} {linkedItems.length === 1 ? "is" : "are"} attached to this. What should happen to {linkedItems.length === 1 ? "it" : "them"}?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: SANS, fontSize: 12.5, cursor: "pointer" }}>
                  <input type="radio" checked={deleteMode === "unlink"} onChange={() => setDeleteMode("unlink")} />
                  Unlink them (they become unattached, not deleted)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: SANS, fontSize: 12.5, cursor: "pointer" }}>
                  <input type="radio" checked={deleteMode === "cascade"} onChange={() => setDeleteMode("cascade")} />
                  Delete them too
                </label>
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn primary color={BRICK} disabled={saving} onClick={confirmDelete}>{saving ? "Deleting…" : "Confirm delete"}</Btn>
            <Btn color={MUTE} onClick={() => setConfirmingDelete(false)} disabled={saving}>Cancel</Btn>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn primary color={INKBLUE} disabled={saving || !title.trim()} onClick={save}>{saving ? "Saving…" : "Save"}</Btn>
            <Btn color={MUTE} onClick={onClose}>Cancel</Btn>
          </div>
          <Btn color={BRICK} onClick={() => setConfirmingDelete(true)}>Delete</Btn>
        </div>
      )}
    </Modal>
  );
}
