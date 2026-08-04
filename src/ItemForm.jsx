import { useState } from "react";
import { DOMAINS, STATUSES, TYPES, EFFORTS, OWNERS, todayISO, ownerForEmail, itemType, typeLabel } from "./constants";
import { Btn, Input, Textarea, Select, Card } from "./ui";
import { MONO, MUTE, INK, LINE } from "./theme";

const BLANK = { title: "", domain: "financial", status: "open", type: "task", effort: "quick", parentId: "", sourceNote: "", definitionOfDone: "", targetDate: "" };

// The tier an item can link up to: a task serves a plan, a plan serves a
// goal, a goal is the top of the hierarchy and has nothing above it.
const PARENT_TYPE = { task: "plan", plan: "goal", goal: null };

// Source note is a shared field, but what it's actually asking for differs
// by tier -- a task's origin story, a plan's reason for existing, a goal's
// underlying motivation.
const SOURCE_NOTE_PLACEHOLDER = {
  task: "Where did this come from?",
  plan: "What's the scope, or why does this plan exist?",
  goal: "Why does this matter?",
};

// Add/edit form for a single Item. `item` present = editing; absent = creating.
// `currentUserEmail` seeds Owner's default on a new item (editing keeps whatever's saved).
// `items` is the full list, used to populate the optional Parent selector.
export default function ItemForm({ item, items, currentUserEmail, onSave, onCancel }) {
  const [form, setForm] = useState(
    item ? { ...BLANK, ...item } : { ...BLANK, owner: ownerForEmail(currentUserEmail) }
  );
  const [saving, setSaving] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // Switching type can strand a parent link that's no longer the right tier
  // (e.g. a task linked to a plan, changed to a goal) -- drop it rather than
  // silently keep an invalid reference.
  const setType = (v) => setForm((f) => ({ ...f, type: v, parentId: "" }));

  const parentTier = PARENT_TYPE[form.type];
  const parentOptions = parentTier
    ? [{ id: "", label: "None" }, ...items.filter((i) => i.id !== item?.id && itemType(i) === parentTier).map((i) => ({ id: i.id, label: i.title }))]
    : null;

  // Effort (a work-session size) only means something for a Task; Definition
  // of done (what completing a bounded body of work looks like) only means
  // something for a Plan. Goal stays the leanest tier -- no execution detail.
  const showEffort = form.type === "task";
  const showDefinitionOfDone = form.type === "plan";
  const tierFieldCount = 1 + (showEffort ? 1 : 0) + (parentOptions ? 1 : 0);

  const submit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: item?.id,
        title: form.title.trim(),
        domain: form.domain,
        status: form.status,
        type: form.type,
        owner: form.owner,
        sourceNote: form.sourceNote.trim(),
        createdDate: item?.createdDate || todayISO(),
        ...(form.targetDate ? { targetDate: form.targetDate } : {}),
        ...(parentTier && form.parentId ? { parentId: form.parentId } : {}),
        ...(showEffort ? { effort: form.effort } : {}),
        ...(showDefinitionOfDone && form.definitionOfDone.trim() ? { definitionOfDone: form.definitionOfDone.trim() } : {}),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Title
          <div style={{ marginTop: 4 }}>
            <Input value={form.title} onChange={set("title")} placeholder="e.g. Get a will drafted" onEnter={submit} />
          </div>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <label style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Owner
            <div style={{ marginTop: 4 }}>
              <Select value={form.owner} onChange={set("owner")} options={OWNERS} width="100%" />
            </div>
          </label>
          <label style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Domain
            <div style={{ marginTop: 4 }}>
              <Select value={form.domain} onChange={set("domain")} options={DOMAINS} width="100%" />
            </div>
          </label>
          <label style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Status
            <div style={{ marginTop: 4 }}>
              <Select value={form.status} onChange={set("status")} options={STATUSES} width="100%" />
            </div>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${tierFieldCount}, 1fr)`, gap: 10 }}>
          <label style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Type
            <div style={{ marginTop: 4 }}>
              <Select value={form.type} onChange={setType} options={TYPES} width="100%" />
            </div>
          </label>
          {showEffort && (
            <label style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Effort
              <div style={{ marginTop: 4 }}>
                <Select value={form.effort} onChange={set("effort")} options={EFFORTS} width="100%" />
              </div>
            </label>
          )}
          {parentOptions && (
            <label style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Parent {typeLabel(parentTier)} (optional)
              <div style={{ marginTop: 4 }}>
                <Select value={form.parentId} onChange={set("parentId")} options={parentOptions} width="100%" />
              </div>
            </label>
          )}
        </div>

        {showDefinitionOfDone && (
          <label style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Definition of done (optional)
            <div style={{ marginTop: 4 }}>
              <Textarea value={form.definitionOfDone} onChange={set("definitionOfDone")} placeholder="What does completing this plan look like?" />
            </div>
          </label>
        )}

        <label style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Source note
          <div style={{ marginTop: 4 }}>
            <Textarea value={form.sourceNote} onChange={set("sourceNote")} placeholder={SOURCE_NOTE_PLACEHOLDER[form.type]} />
          </div>
        </label>

        <label style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Target date (optional)
          <div style={{ marginTop: 4 }}>
            <Input type="date" value={form.targetDate} onChange={set("targetDate")} width="100%" />
          </div>
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4, borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
          <Btn onClick={onCancel} color={MUTE} disabled={saving}>Cancel</Btn>
          <Btn onClick={submit} color={INK} primary disabled={saving || !form.title.trim()}>
            {saving ? "Saving…" : item ? "Save changes" : "Add item"}
          </Btn>
        </div>
      </div>
    </Card>
  );
}
