import { useState } from "react";
import { Input, Btn, Modal, Textarea } from "../ui";
import { SANS, SERIF, MONO, INK, MUTE, INKBLUE, INKBLUE_SOFT, LINE } from "../theme";

// Two entry points, per the spec: an always-visible quick-text bar, and a
// floating button (rendered separately, see ui.jsx's FAB) for richer
// capture. Hitting enter triages immediately unless "hold" is toggled on,
// in which case it skips triage and lands straight in the review-later
// queue as a holding item.
export function CaptureBar({ onCapture, busy }) {
  const [text, setText] = useState("");
  const [hold, setHold] = useState(false);

  const submit = async () => {
    if (!text.trim() || busy) return;
    const value = text.trim();
    setText("");
    await onCapture(value, hold);
  };

  return (
    <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
      <Input value={text} onChange={setText} placeholder="Capture something…" onEnter={submit} />
      <button
        type="button"
        onClick={() => setHold((h) => !h)}
        title="Skip triage -- just save this for later"
        style={{
          fontFamily: MONO, fontSize: 10.5, padding: "5px 9px", borderRadius: 7, cursor: "pointer",
          border: `1px solid ${hold ? INKBLUE : LINE}`, background: hold ? INKBLUE_SOFT : "transparent",
          color: hold ? INKBLUE : MUTE, whiteSpace: "nowrap", flex: "none",
        }}
      >
        hold
      </button>
      <Btn small primary={!hold} color={INKBLUE} disabled={busy || !text.trim()} onClick={submit}>
        {busy ? "…" : hold ? "Save" : "Send"}
      </Btn>
    </div>
  );
}

// The FAB's richer-capture entry point: room for a longer pasted/forwarded
// note, plus a way through to the weekly-meeting photo pipeline (see
// WeeklyMeetingImport.jsx) -- the one photo flow Secretary actually parses
// for v1, per the MVP ordering.
export function RichCaptureModal({ onClose, onCapture, onOpenWeeklyImport, busy }) {
  const [text, setText] = useState("");
  const [hold, setHold] = useState(false);

  const submit = async () => {
    if (!text.trim() || busy) return;
    await onCapture(text.trim(), hold);
    onClose();
  };

  return (
    <Modal onClose={onClose} width={440}>
      <h3 style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, margin: "0 0 4px" }}>Capture</h3>
      <p style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE, margin: "0 0 14px" }}>
        Paste or write out a longer note, forwarded content, or anything else worth setting down.
      </p>
      <Textarea value={text} onChange={setText} placeholder="What would you like me to note?" rows={5} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: SANS, fontSize: 12, color: MUTE, cursor: "pointer" }}>
          <input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} />
          Just save this for later -- no triage
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Btn primary color={INKBLUE} disabled={busy || !text.trim()} onClick={submit}>{busy ? "…" : hold ? "Save" : "Send"}</Btn>
        <Btn color={MUTE} onClick={onClose}>Cancel</Btn>
      </div>
      <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 18, paddingTop: 14 }}>
        <p style={{ fontFamily: MONO, fontSize: 11, color: MUTE, margin: "0 0 8px" }}>Have a photo of the weekly-meeting page instead?</p>
        <Btn color={INKBLUE} onClick={() => { onClose(); onOpenWeeklyImport(); }}>Import weekly-meeting photo →</Btn>
      </div>
    </Modal>
  );
}
