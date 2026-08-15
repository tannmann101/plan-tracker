import { useRef, useState } from "react";
import { Btn, SectionTitle, Note, Pill } from "../ui";
import { SANS, MONO, INK, MUTE, BRICK, BRICK_SOFT, INKBLUE, INKBLUE_SOFT, LINE, CARD, RADIUS } from "../theme";
import QuickAddModal from "../components/QuickAddModal";

const SWIPE_THRESHOLD = 90;
const PLACEABLE_TYPES = ["task", "session", "plan", "project"];

function SwipeRow({ capture, onKeep, onDiscard, onLater }) {
  const [dx, setDx] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);

  const onPointerDown = (e) => {
    dragging.current = true;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    setDx(e.clientX - startX.current);
  };
  const settle = () => {
    dragging.current = false;
    if (dx > SWIPE_THRESHOLD) onKeep();
    else if (dx < -SWIPE_THRESHOLD) onDiscard();
    setDx(0);
  };

  const bg = dx > 20 ? INKBLUE : dx < -20 ? BRICK : "transparent";
  const bgSoft = dx > 20 ? INKBLUE_SOFT : dx < -20 ? BRICK_SOFT : "transparent";

  return (
    <div style={{ position: "relative", borderRadius: RADIUS, overflow: "hidden", touchAction: "pan-y" }}>
      <div style={{
        position: "absolute", inset: 0, background: bgSoft, display: "flex",
        alignItems: "center", justifyContent: dx > 0 ? "flex-start" : "flex-end", padding: "0 16px",
      }}>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: bg, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {dx > 20 ? "Place →" : dx < -20 ? "← Discard" : ""}
        </span>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={settle}
        onPointerCancel={settle}
        style={{
          position: "relative", background: CARD, border: `1px solid ${LINE}`, borderRadius: RADIUS,
          padding: 14, transform: `translateX(${dx}px)`, transition: dragging.current ? "none" : "transform 160ms ease",
          cursor: "grab",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ fontFamily: SANS, fontSize: 13.5, color: INK }}>{capture.rawText}</div>
          {capture.status === "drift" && <Pill color={BRICK} tint={BRICK_SOFT}>drift</Pill>}
        </div>
        {capture.triageDraft?.alignment?.note && (
          <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginTop: 6 }}>{capture.triageDraft.alignment.note}</div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Btn small primary color={INKBLUE} onClick={onKeep}>Place…</Btn>
          <Btn small color={BRICK} onClick={onDiscard}>Discard</Btn>
          <Btn small color={MUTE} onClick={onLater}>Later</Btn>
        </div>
      </div>
    </div>
  );
}

export default function Inbox({ secretary, isOwner, onBack }) {
  const [placing, setPlacing] = useState(null);
  const queue = (secretary.captures || [])
    .filter((c) => c.status === "drift" || c.status === "pending-triage")
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const discard = (capture) => secretary.saveCapture({ id: capture.id, status: "discarded", rawText: capture.rawText });

  const markPlaced = (capture) =>
    secretary.saveCapture({ id: capture.id, status: "placed", rawText: capture.rawText, triageDraft: capture.triageDraft || null });

  // Secretary's own guess (level/domain/content-type, when it has one) is
  // just the starting point here -- Review exists precisely for captures it
  // wasn't confident enough to place on its own, so "Place..." always opens
  // the same structured form Today/This Week/Domains use, with day, domain,
  // and item type all explicitly yours to set rather than re-running the
  // same guess silently.
  const draftDefaults = (capture) => {
    const draft = capture.triageDraft || {};
    return {
      defaultType: PLACEABLE_TYPES.includes(draft.level) ? draft.level : "task",
      defaults: {
        title: capture.rawText,
        domain: draft.domain || secretary.domains[0]?.id,
        contentType: draft.contentType,
      },
    };
  };

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Hub</Btn>
      <SectionTitle note={`${queue.length} awaiting`}>Review</SectionTitle>
      <Note>
        Drift and undecided captures live here -- swipe right (or "Place…") to turn one into a proper Task, Session, Plan, or
        Project with the day/week and domain of your choosing, swipe left to discard, or leave it for later. Nothing here is
        ever silently dropped.
      </Note>
      {!isOwner ? (
        <Note>Only Tanner's account can act on this queue.</Note>
      ) : queue.length === 0 ? (
        <Note>All clear -- nothing awaiting your judgment.</Note>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {queue.map((c) => (
            <SwipeRow key={c.id} capture={c} onKeep={() => setPlacing(c)} onDiscard={() => discard(c)} onLater={() => {}} />
          ))}
        </div>
      )}
      {placing && (
        <QuickAddModal
          secretary={secretary}
          types={PLACEABLE_TYPES}
          {...draftDefaults(placing)}
          onSaved={() => markPlaced(placing)}
          onClose={() => setPlacing(null)}
        />
      )}
    </div>
  );
}
