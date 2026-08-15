import { useState } from "react";
import { Modal, Input, Btn, Pill } from "../ui";
import { SERIF, SANS, MONO, INK, MUTE, INKBLUE, LINE } from "../theme";
import { domainLabel, contentTypeLabel } from "../constants";
import { triageCapture } from "../lib/claude";
import { placeCapture } from "../lib/placeCapture";
import QuickAddModal from "./QuickAddModal";

const PLACEABLE_TYPES = ["task", "session", "plan", "project"];

// Secretary's confirmation step, for whenever triage genuinely can't
// resolve on its own -- a short conversation, not a single accept/reject
// tap. Secretary can ask a real follow-up question; each answer re-runs
// triage with the growing Q&A history until it resolves (or Tanner just
// tells it what to do directly).
export default function CaptureConfirmModal({ capture, secretary, onClose }) {
  const [draft, setDraft] = useState(capture.triageDraft);
  const [answers, setAnswers] = useState([]);
  const [answerText, setAnswerText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [placingManually, setPlacingManually] = useState(false);

  const existingGoals = (secretary.goals || []).map((g) => ({ id: g.id, title: g.title, tier: g.tier, domain: g.domain }));

  const ask = async (nextAnswers) => {
    setLoading(true);
    setError(null);
    try {
      const next = await triageCapture({ text: capture.rawText, existingGoals, priorAnswers: nextAnswers });
      setDraft(next);
      setAnswers(nextAnswers);
    } catch (err) {
      setError(err.message || "Could not reach Secretary just now.");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = () => {
    if (!answerText.trim()) return;
    const nextAnswers = [...answers, { question: draft.clarifyingQuestion, answer: answerText.trim() }];
    setAnswerText("");
    ask(nextAnswers);
  };

  const accept = async () => {
    setLoading(true);
    try {
      const result = await placeCapture(secretary, capture.id, capture.rawText, draft);
      setDone(result.outcome);
    } catch (err) {
      setError(err.message || "Could not place this item.");
    } finally {
      setLoading(false);
    }
  };

  const markDrift = async () => {
    setLoading(true);
    try {
      await secretary.saveCapture({ id: capture.id, status: "drift", rawText: capture.rawText, triageDraft: draft });
      setDone("drift");
    } finally {
      setLoading(false);
    }
  };

  const saveForLater = async () => {
    setLoading(true);
    try {
      await secretary.saveCapture({ id: capture.id, status: "holding", rawText: capture.rawText });
      setDone("holding");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Modal onClose={onClose} width={400}>
        <h3 style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, margin: "0 0 8px" }}>Very good.</h3>
        <p style={{ fontFamily: SANS, fontSize: 13, color: MUTE, margin: "0 0 16px" }}>
          {done === "placed" && "I've placed it accordingly."}
          {done === "held-for-review" && "I've set it aside for your review -- I'd rather not guess at this one."}
          {done === "drift" && "Noted, and set aside -- I won't lose track of it."}
          {done === "holding" && "Saved for later, no questions asked."}
        </p>
        <Btn primary color={INKBLUE} onClick={onClose}>Close</Btn>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} width={440}>
      <h3 style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, margin: "0 0 10px" }}>A moment, if you would</h3>
      <div style={{ background: "#F9F7F1", border: `1px solid ${LINE}`, borderRadius: 8, padding: "9px 11px", marginBottom: 12 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>You captured</div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: INK }}>{capture.rawText}</div>
      </div>

      {draft?.clarifyingQuestion ? (
        <>
          <p style={{ fontFamily: SANS, fontSize: 13.5, color: INK, lineHeight: 1.5, margin: "0 0 10px" }}>{draft.clarifyingQuestion}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <Input value={answerText} onChange={setAnswerText} placeholder="Your answer…" onEnter={submitAnswer} autoFocus />
            <Btn primary color={INKBLUE} disabled={loading || !answerText.trim()} onClick={submitAnswer}>{loading ? "…" : "Answer"}</Btn>
          </div>
        </>
      ) : (
        <div>
          <p style={{ fontFamily: SANS, fontSize: 13, color: MUTE, margin: "0 0 8px" }}>Here is my best reading of it:</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {draft?.level && <Pill color={INKBLUE}>{draft.level}</Pill>}
            {draft?.domain && <Pill>{domainLabel(draft.domain, secretary.domains)}</Pill>}
            {draft?.contentType && <Pill>{contentTypeLabel(draft.contentType, secretary.routingTable)}</Pill>}
          </div>
          {draft?.alignment?.note && <p style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE, margin: "0 0 12px" }}>{draft.alignment.note}</p>}
        </div>
      )}

      {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: "#8B3A2B", marginTop: 10 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16, borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
        {!draft?.clarifyingQuestion && (
          <>
            <Btn primary color={INKBLUE} disabled={loading} onClick={accept}>Accept placement</Btn>
            <Btn color={INKBLUE} disabled={loading} onClick={() => setPlacingManually(true)}>Place manually…</Btn>
          </>
        )}
        <Btn color={MUTE} disabled={loading} onClick={markDrift}>Set aside (drift)</Btn>
        <Btn color={MUTE} disabled={loading} onClick={saveForLater}>Save for later instead</Btn>
        <Btn color={MUTE} disabled={loading} onClick={onClose}>Not now</Btn>
      </div>

      {placingManually && (
        <QuickAddModal
          secretary={secretary}
          types={PLACEABLE_TYPES}
          defaultType={PLACEABLE_TYPES.includes(draft?.level) ? draft.level : "task"}
          defaults={{ title: capture.rawText, domain: draft?.domain || secretary.domains[0]?.id, contentType: draft?.contentType }}
          onSaved={() => secretary.saveCapture({ id: capture.id, status: "placed", rawText: capture.rawText, triageDraft: draft })}
          onClose={() => { setPlacingManually(false); setDone("placed"); }}
        />
      )}
    </Modal>
  );
}
