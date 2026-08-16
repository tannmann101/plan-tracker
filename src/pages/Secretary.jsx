import { useState } from "react";
import { Btn, SectionTitle, Note, Card, Pill, Input, Select, Textarea } from "../ui";
import { SANS, MONO, INK, MUTE, INKBLUE, BRICK, LINE } from "../theme";
import { KIND_TYPES, ITEM_TYPES, UNSORTED_FLAG_DAYS } from "../constants";
import { Field, TagsInput, MultiCheckList, KindParentPicker } from "../components/formFields";
import { allTagsInUse, kindSubtreeIds } from "../lib/graph";
import { triageCapture, secretaryChat } from "../lib/claude";
import WeeklyMeetingImport from "./WeeklyMeetingImport";

const DAY_MS = 24 * 60 * 60 * 1000;

function familyOf(opType) {
  return opType.includes("kind") ? "kind" : "item";
}

// One proposal from the shared queue -- capture triage, Secretary chat, and
// weekly-import extraction all land here identically (§5). Edits reuse the
// exact same field components AddForm/EditEntityModal use, so there's no
// second, drifted editing surface for a draft versus a saved entity.
// Approving runs the draft through secretary.saveEntity, the same path
// every other add/edit in the app uses -- no forked write logic.
function ReviewOperationCard({ op, secretary, onResolved }) {
  const family = familyOf(op.opType);
  const isUpdate = op.opType.startsWith("update");
  const target = isUpdate ? (family === "kind" ? secretary.kinds : secretary.items).find((e) => e.id === op.targetId) : null;

  const [title, setTitle] = useState(op.patch.title || "");
  const [type, setType] = useState(op.patch.kindType || op.patch.itemType || (family === "kind" ? "project" : "task"));
  const [domain, setDomain] = useState(op.patch.domain || secretary.domains[0]?.id || "");
  const [secondaryDomains, setSecondaryDomains] = useState(op.patch.secondaryDomains || []);
  const [resources, setResources] = useState(op.patch.resources || []);
  const [tags, setTags] = useState(op.patch.tags || []);
  const [parentKindId, setParentKindId] = useState(op.patch.parentKindId || null);
  const [targetDay, setTargetDay] = useState(op.patch.timing?.targetDay || op.patch.timing?.dueDate || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const tagSuggestions = allTagsInUse(secretary);
  const excludeIds = isUpdate && family === "kind" ? kindSubtreeIds(op.targetId, secretary.kinds) : null;
  const ageMs = Date.now() - op.createdAt;
  const unsorted = op.status === "pending" && ageMs > UNSORTED_FLAG_DAYS * DAY_MS;

  const approve = async () => {
    setSaving(true);
    setError(null);
    try {
      const base = target || {};
      const payload = {
        ...base,
        title: title.trim(),
        domain, secondaryDomains, resources, tags,
        parentKindId: parentKindId || null,
      };
      if (isUpdate) payload.id = op.targetId;
      if (family === "kind") {
        payload.kindType = type;
        payload.status = base.status || "not-started";
        payload.timing = targetDay ? { dueDate: targetDay } : (base.timing || null);
      } else {
        payload.itemType = type;
        payload.done = base.done || false;
        payload.timing = targetDay ? { targetDay, floating: true } : (base.timing || null);
      }
      payload.createdVia = op.patch.createdVia || "capture";
      await secretary.saveEntity(family, payload);
      await secretary.deletePendingOperation(op.id);
      onResolved?.();
    } catch (err) {
      setError(err.message || "Could not approve that.");
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    setSaving(true);
    try {
      await secretary.deletePendingOperation(op.id);
      onResolved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <Pill color={INKBLUE}>{isUpdate ? "edit" : "new"}</Pill>
        <Pill>{family}</Pill>
        <Pill color={MUTE}>{op.sourceType}</Pill>
        {unsorted && <Pill color={BRICK}>unsorted {Math.floor(ageMs / DAY_MS)}d</Pill>}
      </div>

      <Field label="Name">
        <Input value={title} onChange={setTitle} />
      </Field>
      <Field label="Type">
        <Select value={type} onChange={setType} options={family === "kind" ? KIND_TYPES : ITEM_TYPES} />
      </Field>
      <Field label="Domain">
        <Select value={domain} onChange={setDomain} options={secretary.domains} />
      </Field>
      <Field label="Secondary domains">
        <MultiCheckList options={secretary.domains.filter((d) => d.id !== domain)} value={secondaryDomains} onChange={setSecondaryDomains} />
      </Field>
      <Field label="Resources">
        <MultiCheckList options={secretary.resources} value={resources} onChange={setResources} />
      </Field>
      <Field label="Tags">
        <TagsInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
      </Field>
      <Field label={family === "kind" ? "Due date (optional)" : "Target day (optional)"}>
        <Input type="date" value={targetDay} onChange={setTargetDay} />
      </Field>
      <Field label={family === "kind" ? "Parent (optional)" : "Attach to (optional)"}>
        <KindParentPicker kinds={secretary.kinds} value={parentKindId} onChange={setParentKindId} excludeIds={excludeIds} />
      </Field>

      {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Btn primary color={INKBLUE} disabled={saving || !title.trim()} onClick={approve}>{saving ? "Saving…" : "Approve"}</Btn>
        <Btn color={MUTE} disabled={saving} onClick={discard}>Discard</Btn>
      </div>
    </Card>
  );
}

// Persistent chat -- exported so Workspace (§10) can embed the exact same
// panel scoped to whatever ticket was clicked, rather than a second chat
// implementation. entityContext, when given, is sent to secretaryChat so
// the model prefers proposing an update to that entity over a fresh create.
export function SecretaryChatPanel({ secretary, entityContext, onOperationCreated }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const messages = (secretary.chatMessages || []).slice().sort((a, b) => a.at - b.at);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setDraft("");
    try {
      await secretary.saveChatMessage({ role: "user", text });
      const history = [...messages, { role: "user", text }].slice(-20).map((m) => ({ role: m.role, text: m.text }));
      const existingKinds = (secretary.kinds || []).map((k) => ({ id: k.id, title: k.title, kindType: k.kindType, domain: k.domain }));
      const result = await secretaryChat({ messages: history, entityContext, existingKinds });
      await secretary.saveChatMessage({ role: "assistant", text: result.reply, pendingOperationId: result.pendingOperationId || null });
      if (result.pendingOperationId) {
        await secretary.refresh();
        onOperationCreated?.();
      }
    } catch (err) {
      setError(err.message || "Could not reach Secretary.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {entityContext && (
        <Note>Scoped to "{entityContext.title}" -- Secretary will prefer proposing edits to it.</Note>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto", marginBottom: 10, padding: messages.length ? "4px 2px" : 0 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
            <div style={{
              fontFamily: SANS, fontSize: 12.5, color: INK, background: m.role === "user" ? "#EAE3D1" : "#fff",
              border: `1px solid ${LINE}`, borderRadius: 10, padding: "7px 11px",
            }}>{m.text}</div>
          </div>
        ))}
      </div>
      {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Textarea value={draft} onChange={setDraft} placeholder="Ask Secretary…" rows={2} />
        <Btn primary color={INKBLUE} disabled={sending || !draft.trim()} onClick={send}>{sending ? "…" : "Send"}</Btn>
      </div>
    </div>
  );
}

// §5 -- nothing auto-places. Everything a capture, the chat, or a
// weekly-import batch drafts lands in pendingOperations; this page is
// where a human actually confirms it into a real Kind/Item.
export default function Secretary({ secretary, onBack }) {
  const [captureText, setCaptureText] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState(null);
  const [importing, setImporting] = useState(false);

  const pending = (secretary.pendingOperations || [])
    .filter((o) => o.status === "pending")
    .sort((a, b) => b.createdAt - a.createdAt);

  const submitCapture = async () => {
    const text = captureText.trim();
    if (!text) return;
    setCapturing(true);
    setCaptureError(null);
    try {
      const existingKinds = (secretary.kinds || []).map((k) => ({ id: k.id, title: k.title, kindType: k.kindType, domain: k.domain }));
      await triageCapture({ text, existingKinds });
      await secretary.refresh();
      setCaptureText("");
    } catch (err) {
      setCaptureError(err.message || "Could not triage that.");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Back</Btn>
      <SectionTitle>Secretary</SectionTitle>

      <SectionTitle note="drop a note, Secretary drafts the placement">Capture</SectionTitle>
      <div style={{ display: "flex", gap: 8 }}>
        <Input value={captureText} onChange={setCaptureText} placeholder="What's on your mind?" onEnter={submitCapture} />
        <Btn primary color={INKBLUE} disabled={capturing || !captureText.trim()} onClick={submitCapture}>{capturing ? "…" : "Capture"}</Btn>
      </div>
      {captureError && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK, marginTop: 6 }}>{captureError}</p>}
      <div style={{ marginTop: 8 }}>
        <Btn small onClick={() => setImporting(true)}>Import weekly-meeting photo</Btn>
      </div>

      <SectionTitle note={`${pending.length} awaiting review`}>Review log</SectionTitle>
      {pending.length === 0 ? (
        <Note>Nothing waiting on you right now.</Note>
      ) : (
        pending.map((op) => (
          <ReviewOperationCard key={op.id} op={op} secretary={secretary} onResolved={secretary.refresh} />
        ))
      )}

      <SectionTitle note="scheduling, sequencing, edits -- propose-then-confirm">Chat</SectionTitle>
      <SecretaryChatPanel secretary={secretary} />

      {importing && (
        <WeeklyMeetingImport secretary={secretary} onClose={() => setImporting(false)} onImported={secretary.refresh} />
      )}
    </div>
  );
}
