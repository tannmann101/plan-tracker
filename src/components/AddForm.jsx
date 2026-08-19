import { useState } from "react";
import { Modal, Btn, Input, Select, ModalHeading, CheckboxRow } from "../ui";
import { SANS, MONO, MUTE, INKBLUE, LINE, BRICK, GAP_ACTIONS, SIZE_META, LETTER_META } from "../theme";
import {
  KIND_TYPES, ITEM_TYPES, kindTypeLabel, itemTypeLabel, INITIATORS, FAMILY_SCOPES, CONSENT_STATUSES, todayISO,
  DEFAULT_DURATION_MINUTES,
} from "../constants";
import { allTagsInUse } from "../lib/graph";
import { Field, TagsInput, MultiCheckList, MilestonesEditor, KindParentPicker, DurationInput } from "./formFields";

// §2.1's two-column picker table -- Practice has no Item counterpart, and
// Errand/Other have no Kind counterpart, so several cells are blank.
const PICKER_ROWS = [
  ["project", "task"],
  ["goal", "session"],
  ["practice", "prep"],
  [null, "errand"],
  [null, "other"],
];

// The universal add entry point (§2, §15) -- opened from the FAB on every
// page, always the same component. `allowKinds`/`allowItems` scope the
// first-step picker per page (Today is Items-only; every other page gets
// the full Kind-or-Item table). `defaults` pre-fills fields (domain,
// parentKindId, targetDay, ...) the way the old QuickAddModal's did.
// `onNavigate`, when given, is used for the two shortcuts that skip the
// form entirely: Practice adds jump straight to Plans' Practices tab, and
// (via `onSaved`'s caller) a Goal/Project add jumps into the kanban.
export default function AddForm({ secretary, allowKinds = true, allowItems = true, defaults = {}, onClose, onSaved, onNavigate }) {
  const bothAllowed = allowKinds && allowItems;
  const [family, setFamily] = useState(defaults.family || (bothAllowed ? null : (allowItems ? "item" : "kind")));
  const [type, setType] = useState(defaults.type || (bothAllowed ? null : (allowItems ? "task" : "project")));

  const [title, setTitle] = useState(defaults.title || "");
  const [domain, setDomain] = useState(defaults.domain || secretary.domains[0]?.id || "");
  const [secondaryDomains, setSecondaryDomains] = useState([]);
  const [resources, setResources] = useState(defaults.resources || []);
  const [tags, setTags] = useState(defaults.tags || []);
  const [retro, setRetro] = useState(false);
  const [completedDate, setCompletedDate] = useState(todayISO());

  const [initiator, setInitiator] = useState("me");
  const [familyScope, setFamilyScope] = useState("personal");
  const [consentStatus, setConsentStatus] = useState("pending");

  const [targetDay, setTargetDay] = useState(defaults.targetDay || "");
  const [floating, setFloating] = useState(defaults.time == null);
  const [time, setTime] = useState(defaults.time || "");
  const [durationMinutes, setDurationMinutes] = useState(String(defaults.durationMinutes || DEFAULT_DURATION_MINUTES));
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [milestones, setMilestones] = useState([]);
  const [parentKindId, setParentKindId] = useState(defaults.parentKindId || null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const tagSuggestions = allTagsInUse(secretary);

  const choose = (fam, t) => {
    if (fam === "kind" && t === "practice") {
      onNavigate?.("/plans?tab=practices");
      onClose();
      return;
    }
    setFamily(fam);
    setType(t);
  };

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let id;
      if (family === "kind") {
        const timing = retro
          ? { dueDate: completedDate }
          : (startDate || dueDate || milestones.length) ? { startDate: startDate || null, dueDate: dueDate || null, milestones } : null;
        const patch = {
          title: title.trim(), kindType: type, domain, secondaryDomains, resources, tags,
          parentKindId: null, status: retro ? "done" : "not-started", timing, retro, createdVia: "add-form",
        };
        if (type === "project") {
          patch.initiator = initiator;
          patch.familyScope = familyScope;
          if (familyScope === "touches-family") patch.consentStatus = consentStatus;
        }
        id = await secretary.saveEntity("kind", patch);
      } else {
        const timing = retro
          ? { targetDay: completedDate }
          : (targetDay || dueDate || milestones.length)
            ? {
                targetDay: targetDay || null, time: floating ? null : (time || null),
                durationMinutes: floating ? null : Number(durationMinutes),
                dueDate: dueDate || null, floating, milestones,
              }
            : null;
        const patch = {
          title: title.trim(), itemType: type, domain, secondaryDomains, resources, tags,
          parentKindId: parentKindId || null, timing,
          done: retro, completedAt: retro ? Date.now() : null,
          retro, createdVia: "add-form",
        };
        id = await secretary.saveEntity("item", patch);
      }
      onSaved?.({ family, kindType: family === "kind" ? type : undefined, itemType: family === "item" ? type : undefined, id, retro });
      onClose();
    } catch (err) {
      setError(err.message || "Could not save that.");
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = family === "kind" ? kindTypeLabel(type) : itemTypeLabel(type);

  return (
    <Modal onClose={onClose} width={440}>
      <ModalHeading>Add</ModalHeading>

      {bothAllowed && !type ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ fontFamily: MONO, fontSize: SIZE_META, color: MUTE, textTransform: "uppercase", letterSpacing: LETTER_META, textAlign: "left", padding: "0 0 8px", borderBottom: `1px solid ${LINE}` }}>Kind</th>
              <th style={{ fontFamily: MONO, fontSize: SIZE_META, color: MUTE, textTransform: "uppercase", letterSpacing: LETTER_META, textAlign: "left", padding: "0 0 8px", borderBottom: `1px solid ${LINE}` }}>Item</th>
            </tr>
          </thead>
          <tbody>
            {PICKER_ROWS.map(([k, i], idx) => (
              <tr key={idx}>
                <td style={{ padding: "6px 8px 6px 0" }}>
                  {k && <button type="button" onClick={() => choose("kind", k)} style={{ border: "none", background: "none", color: INKBLUE, fontFamily: SANS, fontSize: 13.5, cursor: "pointer", padding: "4px 0", textAlign: "left" }}>{kindTypeLabel(k)}</button>}
                </td>
                <td style={{ padding: "6px 0" }}>
                  {i && <button type="button" onClick={() => choose("item", i)} style={{ border: "none", background: "none", color: INKBLUE, fontFamily: SANS, fontSize: 13.5, cursor: "pointer", padding: "4px 0", textAlign: "left" }}>{itemTypeLabel(i)}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          {!bothAllowed && (
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {(family === "kind" ? KIND_TYPES.filter((k) => k.id !== "practice") : ITEM_TYPES).map((t) => (
                <button
                  key={t.id} type="button" onClick={() => setType(t.id)}
                  style={{
                    fontFamily: MONO, fontSize: 11.5, padding: "5px 12px", borderRadius: 999, cursor: "pointer",
                    border: `1px solid ${type === t.id ? INKBLUE : LINE}`, background: type === t.id ? INKBLUE : "transparent",
                    color: type === t.id ? "#fff" : MUTE,
                  }}
                >{t.label}</button>
              ))}
            </div>
          )}

          <Field label="Name">
            <Input value={title} onChange={setTitle} placeholder={`New ${typeLabel.toLowerCase()}…`} autoFocus onEnter={save} />
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

          {family === "item" && (
            <Field label="Attach to (optional)">
              <KindParentPicker kinds={secretary.kinds} value={parentKindId} onChange={setParentKindId} />
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

          <CheckboxRow checked={retro} onChange={setRetro}>This already happened -- skip forward-planning fields, mark done/complete</CheckboxRow>

          {retro ? (
            <Field label="Completed on">
              <Input type="date" value={completedDate} onChange={setCompletedDate} />
            </Field>
          ) : (
            <>
              {family === "item" && (
                <>
                  <Field label="Target day">
                    <Input type="date" value={targetDay} onChange={setTargetDay} />
                  </Field>
                  <CheckboxRow checked={floating} onChange={setFloating}>Floating (no specific time)</CheckboxRow>
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
                </>
              )}
              {family === "kind" && (
                <Field label="Start date (optional)">
                  <Input type="date" value={startDate} onChange={setStartDate} />
                </Field>
              )}
              <Field label="Due date (optional)">
                <Input type="date" value={dueDate} onChange={setDueDate} />
              </Field>
              <Field label="Milestones (optional)">
                <MilestonesEditor value={milestones} onChange={setMilestones} />
              </Field>
            </>
          )}

          {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK }}>{error}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: GAP_ACTIONS }}>
            <Btn primary color={INKBLUE} disabled={saving || !title.trim()} onClick={save}>{saving ? "Saving…" : "Add"}</Btn>
            {bothAllowed && <Btn color={MUTE} onClick={() => { setFamily(null); setType(null); }}>← Back</Btn>}
            <Btn color={MUTE} onClick={onClose}>Cancel</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}
