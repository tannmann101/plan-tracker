import { useRef, useState } from "react";
import { Btn, SectionTitle, Note, Pill } from "../ui";
import { SANS, MONO, INK, MUTE, BRICK, BRICK_SOFT, INKBLUE, INKBLUE_SOFT, LINE, CARD, RADIUS } from "../theme";
import CaptureConfirmModal from "../components/CaptureConfirmModal";
import { placeCapture } from "../lib/placeCapture";

const SWIPE_THRESHOLD = 90;

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
          {dx > 20 ? "Keep →" : dx < -20 ? "← Discard" : ""}
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
          <Btn small primary color={INKBLUE} onClick={onKeep}>Keep</Btn>
          <Btn small color={BRICK} onClick={onDiscard}>Discard</Btn>
          <Btn small color={MUTE} onClick={onLater}>Later</Btn>
        </div>
      </div>
    </div>
  );
}

export default function Inbox({ secretary, isOwner, onBack }) {
  const [confirmCapture, setConfirmCapture] = useState(null);
  const queue = (secretary.captures || [])
    .filter((c) => c.status === "drift" || c.status === "pending-triage")
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const keep = async (capture) => {
    if (capture.triageDraft?.level && capture.triageDraft?.domain) {
      await placeCapture(secretary, capture.id, capture.rawText, capture.triageDraft);
    } else {
      setConfirmCapture(capture);
    }
  };

  const discard = (capture) => secretary.saveCapture({ id: capture.id, status: "discarded", rawText: capture.rawText });

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Hub</Btn>
      <SectionTitle note={`${queue.length} awaiting`}>Review</SectionTitle>
      <Note>
        Drift and undecided captures live here -- swipe right to keep (place it), left to discard, or leave it for later. Nothing here is ever silently dropped.
      </Note>
      {!isOwner ? (
        <Note>Only Tanner's account can act on this queue.</Note>
      ) : queue.length === 0 ? (
        <Note>All clear -- nothing awaiting your judgment.</Note>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {queue.map((c) => (
            <SwipeRow key={c.id} capture={c} onKeep={() => keep(c)} onDiscard={() => discard(c)} onLater={() => {}} />
          ))}
        </div>
      )}
      {confirmCapture && (
        <CaptureConfirmModal capture={confirmCapture} secretary={secretary} onClose={() => setConfirmCapture(null)} />
      )}
    </div>
  );
}
