import { useState, useEffect } from "react";
import { Btn, SectionTitle, Note, Card, Pill, Input, Select, Textarea, CheckboxRow, Nested } from "../ui";
import { SANS, MONO, INK, MUTE, INKBLUE, BRICK, DEEPTEAL, LINE, CARD, HEAD_BG, SIZE_TITLE, GAP_ACTIONS, RADIUS_SM, RADIUS_CHIP } from "../theme";
import { KIND_TYPES, ITEM_TYPES, UNSORTED_FLAG_DAYS, DEFAULT_DURATION_MINUTES, todayISO, formatRelativeTime } from "../constants";
import { Field, TagsInput, MultiCheckList, KindParentPicker, DurationInput } from "../components/formFields";
import { allTagsInUse, kindSubtreeIds, upcomingItems, practiceHabitsSummary, disciplinesSummary, kindsNeedingAttention } from "../lib/graph";
import { triageCapture, secretaryChat } from "../lib/claude";
import { useTimeGridPrefs } from "../components/TimeGrid";
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
  const [startDate, setStartDate] = useState(op.patch.timing?.startDate || "");
  const [floating, setFloating] = useState(op.patch.timing?.floating !== false);
  const [time, setTime] = useState(op.patch.timing?.time || "");
  const [durationMinutes, setDurationMinutes] = useState(String(op.patch.timing?.durationMinutes || DEFAULT_DURATION_MINUTES));
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
        payload.timing = (startDate || targetDay) ? { startDate: startDate || null, dueDate: targetDay || null } : (base.timing || null);
      } else {
        payload.itemType = type;
        payload.done = base.done || false;
        payload.timing = targetDay
          ? {
              targetDay, floating,
              time: floating ? null : (time || null),
              durationMinutes: floating ? null : Number(durationMinutes),
            }
          : (base.timing || null);
      }
      // A practice check-in proposal (secretaryChat) carries its own
      // isRecurringPracticeItem/practiceHabitId/done, which the generic
      // field-editing form above has no UI for and would otherwise drop --
      // applied last so it isn't overwritten by the item branch's default
      // done handling above.
      if (family === "item" && op.patch.isRecurringPracticeItem) {
        payload.isRecurringPracticeItem = true;
        payload.practiceHabitId = op.patch.practiceHabitId;
        payload.done = !!op.patch.done;
        payload.completedAt = op.patch.done ? Date.now() : null;
        if (op.patch.progressAmount != null) payload.progressAmount = op.patch.progressAmount;
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
        {op.patch.isRecurringPracticeItem && <Pill color={DEEPTEAL}>↻ practice check-in</Pill>}
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
      {family === "kind" && (
        <Field label="Start date (optional)">
          <Input type="date" value={startDate} onChange={setStartDate} />
        </Field>
      )}
      <Field label={family === "kind" ? "Due date (optional)" : "Target day (optional)"}>
        <Input type="date" value={targetDay} onChange={setTargetDay} />
      </Field>
      {family === "item" && targetDay && (
        <>
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
      <Field label={family === "kind" ? "Parent (optional)" : "Attach to (optional)"}>
        <KindParentPicker kinds={secretary.kinds} value={parentKindId} onChange={setParentKindId} excludeIds={excludeIds} />
      </Field>

      {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: GAP_ACTIONS }}>
        <Btn primary color={INKBLUE} disabled={saving || !title.trim()} onClick={approve}>{saving ? "Saving…" : "Approve"}</Btn>
        <Btn color={MUTE} disabled={saving} onClick={discard}>Discard</Btn>
      </div>
    </Card>
  );
}

// A one-line human-readable summary of a single compound step, for the
// review card below -- not editable (unlike ReviewOperationCard's full
// form), since a bundle's whole point is several linked writes reviewed
// as one unit; adjusting a single field is a follow-up chat message away.
function stepSummary(step, secretary) {
  const verb = step.action === "create" ? "Create" : "Update";
  const kindLabel = { kind: "Kind", item: "Item", practiceHabit: "Practice habit", discipline: "Discipline" }[step.entityType] || step.entityType;
  const existing = step.action === "update" && step.targetId
    ? [...(secretary.kinds || []), ...(secretary.items || []), ...(secretary.practiceHabits || []), ...(secretary.disciplines || [])]
      .find((e) => e.id === step.targetId)
    : null;
  const title = step.patch.title || existing?.title || "(untitled)";
  const detail = [];
  if (step.patch.parentKindId) detail.push("nested under a Kind in this bundle");
  if (step.patch.linkedKindId) detail.push("linked to a Kind in this bundle");
  if (step.patch.focused === true) detail.push("pulled into focus");
  if (step.patch.relapse) detail.push("relapse logged");
  if (step.patch.resolved === true) detail.push("marked resolved");
  return `${verb} ${kindLabel}: ${title}${detail.length ? ` -- ${detail.join(", ")}` : ""}`;
}

// Whether a compound step points back at an earlier step in its own
// bundle (its parentKindId/linkedKindId is still the literal "$ref:sN"
// placeholder, not yet resolved to a real id -- that only happens client-
// side at approval time). Drives the review card's indent below, so a
// step that stepSummary's own text already calls "nested under" or
// "linked to" a Kind in this bundle reads that way visually too.
function isRefNestedStep(step) {
  const ref = (v) => typeof v === "string" && v.startsWith("$ref:");
  return ref(step.patch.parentKindId) || ref(step.patch.linkedKindId);
}

// A bundle of linked steps (§ compound proposals) -- approved or discarded
// as one unit, since the whole point is that they only make sense together
// (a new Project plus the Item becoming its nested Session, say). Approving
// runs every step through secretary.applyCompoundOperation, which is the
// exact same saveEntity/savePracticeHabit/saveDiscipline path any other
// write in the app uses -- no forked write logic, just run in sequence
// with each step's id available to the ones after it.
function ReviewCompoundOperationCard({ op, secretary, onResolved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const approve = async () => {
    setSaving(true);
    setError(null);
    try {
      await secretary.applyCompoundOperation(op);
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
        <Pill color={INKBLUE}>bundle · {op.ops.length} step{op.ops.length === 1 ? "" : "s"}</Pill>
        <Pill color={MUTE}>{op.sourceType}</Pill>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {op.ops.map((step, i) => {
          const row = (
            <div style={{ fontFamily: SANS, fontSize: 12.5, color: INK, padding: "7px 10px", background: HEAD_BG, borderRadius: RADIUS_CHIP }}>
              {i + 1}. {stepSummary(step, secretary)}
            </div>
          );
          return isRefNestedStep(step) ? <Nested key={i}>{row}</Nested> : <div key={i}>{row}</div>;
        })}
      </div>
      {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: GAP_ACTIONS }}>
        <Btn primary color={INKBLUE} disabled={saving} onClick={approve}>{saving ? "Saving…" : "Approve all"}</Btn>
        <Btn color={MUTE} disabled={saving} onClick={discard}>Discard</Btn>
      </div>
    </Card>
  );
}

// The narrow slice of "Habits to Break" Secretary chat can now actually
// change on an existing discipline -- focus/unfocus, log a relapse, mark
// resolved. No field-editing form (unlike ReviewOperationCard) since
// there's nothing to fill in, just a toggle to confirm or discard.
function ReviewDisciplineOperationCard({ op, secretary, onResolved }) {
  const target = (secretary.disciplines || []).find((d) => d.id === op.targetId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const changes = [];
  if (op.patch.relapse) changes.push("log a relapse (streak resets to today)");
  if (op.patch.focused === true) changes.push("pull into focus");
  if (op.patch.focused === false) changes.push("stop focusing");
  if (op.patch.resolved === true) changes.push("mark resolved");

  const approve = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!target) throw new Error("That habit no longer exists.");
      const { relapse, ...rest } = op.patch;
      await secretary.saveDiscipline({ ...target, ...rest, ...(relapse ? { startedAt: Date.now() } : {}) });
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
        <Pill color={BRICK}>habit update</Pill>
        <Pill color={MUTE}>{op.sourceType}</Pill>
      </div>
      <div style={{ fontFamily: SANS, fontSize: SIZE_TITLE, color: INK, marginBottom: 6 }}>{target?.title || "(this habit no longer exists)"}</div>
      <div style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE }}>{changes.join(", ") || "no changes proposed"}</div>
      {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: GAP_ACTIONS }}>
        <Btn primary color={INKBLUE} disabled={saving || !target} onClick={approve}>{saving ? "Saving…" : "Approve"}</Btn>
        <Btn color={MUTE} disabled={saving} onClick={discard}>Discard</Btn>
      </div>
    </Card>
  );
}

// The practice-habit analog of ReviewDisciplineOperationCard -- the one
// thing Secretary chat can propose changing on an existing habit without a
// full field-editing form: linking it to a Goal/Project (and the
// progressUnit/progressTarget that comes with a link).
function ReviewPracticeHabitOperationCard({ op, secretary, onResolved }) {
  const target = (secretary.practiceHabits || []).find((h) => h.id === op.targetId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const changes = [];
  if (op.patch.linkedKindId) {
    const kind = (secretary.kinds || []).find((k) => k.id === op.patch.linkedKindId);
    changes.push(`link to "${kind?.title || op.patch.linkedKindId}"`);
  }
  if (op.patch.progressUnit) changes.push(`track in ${op.patch.progressUnit}`);
  if (op.patch.progressTarget != null) changes.push(`target ${op.patch.progressTarget}`);

  const approve = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!target) throw new Error("That practice no longer exists.");
      await secretary.savePracticeHabit({ ...target, ...op.patch });
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
        <Pill color={DEEPTEAL}>practice update</Pill>
        <Pill color={MUTE}>{op.sourceType}</Pill>
      </div>
      <div style={{ fontFamily: SANS, fontSize: SIZE_TITLE, color: INK, marginBottom: 6 }}>{target?.title || "(this practice no longer exists)"}</div>
      <div style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE }}>{changes.join(", ") || "no changes proposed"}</div>
      {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: GAP_ACTIONS }}>
        <Btn primary color={INKBLUE} disabled={saving || !target} onClick={approve}>{saving ? "Saving…" : "Approve"}</Btn>
        <Btn color={MUTE} disabled={saving} onClick={discard}>Discard</Btn>
      </div>
    </Card>
  );
}

// A handful of example prompts for the empty-chat state -- the household's
// own feedback was that it wasn't obvious what Secretary could actually be
// asked to do. Clicking one just fills the draft box (never auto-sends),
// same "you always confirm" spirit as everything else here. Tailored a bit
// when the conversation is scoped to something, generic otherwise.
function suggestionsFor(entityContext) {
  if (entityContext) {
    if (entityContext.family === "discipline") {
      return [`How's my streak on "${entityContext.title}" going?`, "Pull this into focus for the week", "I slipped today"];
    }
    if (entityContext.family === "practiceHabit") {
      return ["Mark this done for today", `Link this to a new Goal`, "How am I doing on this this week?"];
    }
    return [`Move this to tomorrow at 9am`, `What's still open on this?`, "Turn this into its own Project"];
  }
  return [
    "Schedule a dentist call for tomorrow afternoon",
    "Create a goal to read one book a month",
    "What should I focus on this week?",
    "Turn my kitchen cleanout idea into a project",
  ];
}

// Chat sessions -- a thread is scoped to a specific entity (entityFamily/
// entityId, mirroring entityContext's own shape) or general when both are
// null. Sessions aren't created just by opening a panel (that would spam
// the collection with empty threads every time an Ask-Secretary icon gets
// clicked) -- only the first real message in a scope lazily creates one,
// via createSession below, called from SecretaryChatPanel's send().
const LEGACY_SESSION_ID = "legacy";

function scopeMatches(session, entityContext) {
  return (session.entityFamily || null) === (entityContext?.family || null) &&
    (session.entityId || null) === (entityContext?.id || null);
}

// The messages households sent before sessions existed have no sessionId
// at all -- rather than migrate or silently orphan that real history,
// it's surfaced as one shared, read-only "Earlier conversation" entry at
// the end of the general (unscoped) session list.
function sessionsForScope(secretary, entityContext) {
  const scoped = (secretary.chatSessions || [])
    .filter((s) => scopeMatches(s, entityContext))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const hasLegacyMessages = !entityContext && (secretary.chatMessages || []).some((m) => !m.sessionId);
  return hasLegacyMessages ? [...scoped, { id: LEGACY_SESSION_ID, title: "Earlier conversation", legacy: true }] : scoped;
}

function findLatestSession(secretary, entityContext) {
  const scoped = (secretary.chatSessions || []).filter((s) => scopeMatches(s, entityContext));
  return scoped.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
}

async function createSession(secretary, entityContext) {
  const now = Date.now();
  const base = {
    entityFamily: entityContext?.family || null,
    entityId: entityContext?.id || null,
    entityTitle: entityContext?.title || null,
    title: entityContext?.title || "New chat",
    createdAt: now, updatedAt: now,
  };
  const id = await secretary.saveChatSession(base);
  return { id, ...base };
}

// Persistent chat -- exported so Workspace (§10) can embed the exact same
// panel scoped to whatever ticket was clicked, rather than a second chat
// implementation. entityContext, when given, is sent to secretaryChat so
// the model prefers proposing an update to that entity over a fresh create.
//
// Session resolution is self-contained: pass nothing and the panel always
// resumes the most-recently-active thread for this entityContext (or
// starts one on first send if none exists yet) -- this is what the
// desktop dock and Workspace's embedded panel use, unchanged. Secretary's
// own full page instead controls it explicitly (sessionId + a session
// browser above this panel), so a household member can switch between or
// start additional threads for the same scope rather than always landing
// on "the" one.
export function SecretaryChatPanel({ secretary, entityContext, sessionId, onSessionResolved, onOperationCreated }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [gridPrefs] = useTimeGridPrefs();
  const [resolvedSessionId, setResolvedSessionId] = useState(null);

  useEffect(() => {
    if (sessionId) return; // parent has already picked a specific thread
    const existing = findLatestSession(secretary, entityContext);
    setResolvedSessionId(existing?.id || null);
    if (existing) onSessionResolved?.(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, entityContext?.family, entityContext?.id, secretary.chatSessions]);

  const activeSessionId = sessionId || resolvedSessionId;

  useEffect(() => {
    setError(null);
  }, [activeSessionId]);

  const isLegacy = activeSessionId === LEGACY_SESSION_ID;
  const messages = (secretary.chatMessages || [])
    .filter((m) => (isLegacy ? !m.sessionId : activeSessionId && m.sessionId === activeSessionId))
    .slice()
    .sort((a, b) => a.at - b.at);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || isLegacy) return;
    setSending(true);
    setError(null);
    setDraft("");
    try {
      const isFirstMessage = messages.length === 0;
      let session = activeSessionId ? (secretary.chatSessions || []).find((s) => s.id === activeSessionId) : null;
      if (!session) {
        session = await createSession(secretary, entityContext);
        setResolvedSessionId(session.id);
        onSessionResolved?.(session);
      }
      await secretary.saveChatMessage({ role: "user", text, sessionId: session.id });
      // A general session's title starts as "New chat" -- once it's
      // actually said something, that's a far more useful label in the
      // session browser than a generic placeholder. Scoped sessions
      // already carry the entity's own title, so this only ever fires once
      // per general thread.
      const retitle = isFirstMessage && !session.entityFamily && session.title === "New chat";
      await secretary.saveChatSession({ ...session, updatedAt: Date.now(), ...(retitle ? { title: text.slice(0, 60) } : {}) });

      const history = [...messages, { role: "user", text }].slice(-20).map((m) => ({ role: m.role, text: m.text }));
      const existingKinds = (secretary.kinds || []).map((k) => ({ id: k.id, title: k.title, kindType: k.kindType, domain: k.domain }));
      const existingItems = upcomingItems(secretary.items);
      const practiceHabits = practiceHabitsSummary(secretary);
      const disciplines = disciplinesSummary(secretary);
      const attention = kindsNeedingAttention(secretary);
      const existingResources = secretary.resources || [];
      const result = await secretaryChat({
        messages: history, entityContext, existingKinds, existingItems,
        practiceHabits, disciplines, attention, existingResources,
        today: todayISO(), activeHours: { startHour: gridPrefs.startHour, endHour: gridPrefs.endHour },
      });
      await secretary.saveChatMessage({ role: "assistant", text: result.reply, sessionId: session.id, pendingOperationId: result.pendingOperationId || null });
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
      {isLegacy && (
        <Note>This is your history from before conversations were split into sessions -- read-only. Start a new chat to keep talking with Secretary.</Note>
      )}
      {messages.length === 0 && !isLegacy && (
        <div style={{ marginBottom: 10 }}>
          <Note>Nothing asked yet -- Secretary drafts, you always approve. A few things you can try:</Note>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
            {suggestionsFor(entityContext).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDraft(s)}
                style={{
                  textAlign: "left", border: `1px solid ${LINE}`, borderRadius: RADIUS_SM, background: HEAD_BG,
                  color: INK, fontFamily: SANS, fontSize: 12, padding: "7px 10px", cursor: "pointer",
                }}
              >
                "{s}"
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto", marginBottom: 10, padding: messages.length ? "4px 2px" : 0 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
            <div style={{
              fontFamily: SANS, fontSize: 12.5, color: INK, background: m.role === "user" ? HEAD_BG : CARD,
              border: `1px solid ${LINE}`, borderRadius: 10, padding: "7px 11px",
            }}>{m.text}</div>
          </div>
        ))}
      </div>
      {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK }}>{error}</p>}
      {!isLegacy && (
        <div style={{ display: "flex", gap: 8 }}>
          <Textarea value={draft} onChange={setDraft} placeholder="Ask Secretary…" rows={2} />
          <Btn primary color={INKBLUE} disabled={sending || !draft.trim()} onClick={send}>{sending ? "…" : "Send"}</Btn>
        </div>
      )}
    </div>
  );
}

// A row of past threads for the current scope -- only shown once there's
// more than one to choose between (a fresh scope with a single thread has
// nothing to switch to yet). Exported alongside SecretaryChatPanel so
// Secretary's own page can render it above the panel; the dock and
// Workspace's embedded panel don't use it, they just always resume "the"
// latest thread per entityContext.
function SessionTabs({ secretary, entityContext, activeSessionId, onSelect }) {
  const sessions = sessionsForScope(secretary, entityContext);
  if (sessions.length < 2) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
      {sessions.map((s) => {
        const active = s.id === activeSessionId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            style={{
              border: `1px solid ${active ? INKBLUE : LINE}`, borderRadius: RADIUS_SM, cursor: "pointer",
              background: active ? INKBLUE : HEAD_BG, color: active ? CARD : INK,
              fontFamily: MONO, fontSize: 11, padding: "5px 10px",
            }}
          >
            {s.title}{s.updatedAt ? ` · ${formatRelativeTime(s.updatedAt)}` : ""}
          </button>
        );
      })}
    </div>
  );
}

// §5 -- nothing auto-places. Everything a capture, the chat, or a
// weekly-import batch drafts lands in pendingOperations; this page is
// where a human actually confirms it into a real Kind/Item.
//
// focusEntityContext/onFocusHandled mirror Workspace's focusKindId pattern
// (§10) -- mobile's "Ask Secretary" affordance has no persistent chat dock
// to open like desktop does, so it navigates here instead and hands off a
// scoped entity once, picked up into chatFocus below and then cleared.
export default function Secretary({ secretary, onBack, focusEntityContext, onFocusHandled }) {
  const [captureText, setCaptureText] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [chatFocus, setChatFocus] = useState(null); // { family, entity } -- scopes the Chat panel below
  const [selectedSessionId, setSelectedSessionId] = useState(null); // null = let the panel resume the latest thread

  const focusChat = (next) => {
    setChatFocus(next);
    setSelectedSessionId(null);
  };

  useEffect(() => {
    if (!focusEntityContext) return;
    focusChat(focusEntityContext);
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusEntityContext, onFocusHandled]);

  const chatEntityContext = chatFocus ? { family: chatFocus.family, id: chatFocus.entity.id, title: chatFocus.entity.title } : null;

  const startNewSession = async () => {
    const session = await createSession(secretary, chatEntityContext);
    setSelectedSessionId(session.id);
  };

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
          op.opType === "compound" ? (
            <ReviewCompoundOperationCard key={op.id} op={op} secretary={secretary} onResolved={secretary.refresh} />
          ) : op.opType === "update-discipline" ? (
            <ReviewDisciplineOperationCard key={op.id} op={op} secretary={secretary} onResolved={secretary.refresh} />
          ) : op.opType === "update-practiceHabit" ? (
            <ReviewPracticeHabitOperationCard key={op.id} op={op} secretary={secretary} onResolved={secretary.refresh} />
          ) : (
            <ReviewOperationCard key={op.id} op={op} secretary={secretary} onResolved={secretary.refresh} />
          )
        ))
      )}

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <SectionTitle note="scheduling, sequencing, edits -- propose-then-confirm">
          Chat{chatFocus ? ` — ${chatFocus.entity.title}` : ""}
        </SectionTitle>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small onClick={startNewSession}>+ New chat</Btn>
          {chatFocus && <Btn small color={MUTE} onClick={() => focusChat(null)}>Unfocus</Btn>}
        </div>
      </div>
      <SessionTabs
        secretary={secretary}
        entityContext={chatEntityContext}
        activeSessionId={selectedSessionId}
        onSelect={setSelectedSessionId}
      />
      <SecretaryChatPanel
        secretary={secretary}
        entityContext={chatEntityContext}
        sessionId={selectedSessionId}
        onSessionResolved={(s) => setSelectedSessionId((cur) => cur || s.id)}
      />

      {importing && (
        <WeeklyMeetingImport secretary={secretary} onClose={() => setImporting(false)} onImported={secretary.refresh} />
      )}
    </div>
  );
}
