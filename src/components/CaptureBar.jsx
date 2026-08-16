import { useState } from "react";
import { Input, Btn } from "../ui";
import { MONO, MUTE, INKBLUE } from "../theme";

// §4/§5 -- pinned to every page now (no isOwner gate left), and always
// routes through triageCapture, which drafts a pendingOperation server-side
// rather than placing anything directly. There's no "hold, skip triage"
// mode anymore -- since every capture already requires a human to approve
// it in the Secretary review log regardless, skipping triage would only
// mean drafting that proposal by hand instead of letting Secretary start it.
export function CaptureBar({ onCapture, busy }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState(null);

  const submit = async () => {
    if (!text.trim() || busy) return;
    const value = text.trim();
    setText("");
    setStatus(null);
    try {
      await onCapture(value);
      setStatus("Captured -- see Secretary to review.");
    } catch {
      setStatus("Could not capture that.");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
        <Input value={text} onChange={setText} placeholder="Capture something…" onEnter={submit} />
        <Btn small primary color={INKBLUE} disabled={busy || !text.trim()} onClick={submit}>{busy ? "…" : "Send"}</Btn>
      </div>
      {status && <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 4 }}>{status}</div>}
    </div>
  );
}
