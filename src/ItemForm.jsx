import { useState } from "react";
import { DOMAINS, STATUSES, KINDS, EFFORTS, todayISO } from "./constants";
import { Btn, Input, Textarea, Select, Card } from "./ui";
import { MONO, MUTE, INK, LINE } from "./theme";

const BLANK = { title: "", domain: "financial", status: "open", kind: "quick-task", effort: "quick", sourceNote: "", targetDate: "" };

// Add/edit form for a single Item. `item` present = editing; absent = creating.
export default function ItemForm({ item, onSave, onCancel }) {
  const [form, setForm] = useState(item ? { ...BLANK, ...item } : BLANK);
  const [saving, setSaving] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: item?.id,
        title: form.title.trim(),
        domain: form.domain,
        status: form.status,
        kind: form.kind,
        effort: form.effort,
        sourceNote: form.sourceNote.trim(),
        createdDate: item?.createdDate || todayISO(),
        ...(form.targetDate ? { targetDate: form.targetDate } : {}),
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Kind
            <div style={{ marginTop: 4 }}>
              <Select value={form.kind} onChange={set("kind")} options={KINDS} width="100%" />
            </div>
          </label>
          <label style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Effort
            <div style={{ marginTop: 4 }}>
              <Select value={form.effort} onChange={set("effort")} options={EFFORTS} width="100%" />
            </div>
          </label>
        </div>

        <label style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Source note
          <div style={{ marginTop: 4 }}>
            <Textarea value={form.sourceNote} onChange={set("sourceNote")} placeholder="Where did this come from / why does it matter?" />
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
