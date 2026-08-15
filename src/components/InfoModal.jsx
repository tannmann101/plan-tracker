import { useState } from "react";
import { Modal, IconButton } from "../ui";
import { SANS, MONO, SERIF, INK, MUTE, LINE, INKBLUE } from "../theme";
import { traceFor } from "../lib/graph";

// Inline, horizontal counterpart to TraceChain -- same traceFor() steps,
// rendered as a breadcrumb directly on a card instead of a vertical chain
// inside a modal, so the Goal a Task/Session/Plan serves (or that it
// doesn't yet serve one) is visible without tapping anything. Drops the
// entity's own first step for task/session/plan, since the card's title
// already says that.
export function GoalChainLine({ type, entity, data, onNavigateGoal }) {
  const steps = traceFor(type, entity, data);
  const chain = steps.slice(1); // drop the entity's own title, already shown by the card
  if (chain.length === 0) {
    // A Goal with an empty chain is simply a root -- already conveyed by
    // the Goals tree's own nesting, not a gap worth flagging. Every other
    // type genuinely should trace to a Goal, so an empty chain there does
    // mean "ungrounded."
    if (type === "goal") return null;
    return <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 6 }}>not yet linked to a Goal</div>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 6 }}>
      {chain.map((step, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {i > 0 && <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE }}>›</span>}
          {step.goalId && onNavigateGoal ? (
            <button
              type="button"
              onClick={() => onNavigateGoal(step.goalId)}
              style={{ fontFamily: MONO, fontSize: 10.5, color: INKBLUE, border: "none", background: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
            >
              {step.label}
            </button>
          ) : (
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE }}>{step.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// Small info icon every Task/Session/Plan/Goal card carries -- tapping it
// shows the chain up to a root Goal (or Project) without digging through
// the event log. This is the concrete implementation of the transparency
// principle described in the spec. onNavigateGoal, when given, makes any
// Goal step in the chain tap-through to the Goals page.
export function InfoIcon({ type, entity, data, onNavigateGoal }) {
  return (
    <TraceButton type={type} entity={entity} data={data} onNavigateGoal={onNavigateGoal} />
  );
}

function TraceButton({ type, entity, data, onNavigateGoal }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton title="Why is this here?" onClick={() => setOpen(true)}>i</IconButton>
      {open && (
        <Modal onClose={() => setOpen(false)} width={380}>
          <h3 style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, margin: "0 0 12px" }}>
            Why this is here
          </h3>
          <TraceChain
            type={type}
            entity={entity}
            data={data}
            onNavigateGoal={onNavigateGoal ? (goalId) => { setOpen(false); onNavigateGoal(goalId); } : null}
          />
          <div style={{ textAlign: "right", marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ border: `1px solid ${LINE}`, background: "transparent", color: MUTE, fontFamily: MONO, fontSize: 11.5, padding: "5px 12px", borderRadius: 7, cursor: "pointer" }}
            >
              close
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function TraceChain({ type, entity, data, onNavigateGoal }) {
  const steps = traceFor(type, entity, data);
  if (!steps.length) {
    return <p style={{ fontFamily: SANS, fontSize: 13, color: MUTE }}>No chain of custody found -- this item isn't attached to anything else yet.</p>;
  }
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
      {steps.map((step, i) => {
        const clickable = step.goalId && onNavigateGoal;
        return (
          <li key={i} style={{ display: "flex", gap: 10, paddingBottom: i < steps.length - 1 ? 14 : 0, position: "relative" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: i === 0 ? INK : MUTE, marginTop: 4 }} />
              {i < steps.length - 1 && <div style={{ width: 1, flex: 1, background: LINE, marginTop: 4 }} />}
            </div>
            <div>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onNavigateGoal(step.goalId)}
                  style={{
                    fontFamily: SANS, fontSize: 13.5, color: INKBLUE, fontWeight: i === 0 ? 600 : 400,
                    border: "none", background: "none", padding: 0, cursor: "pointer", textDecoration: "underline",
                  }}
                >
                  {step.label} →
                </button>
              ) : (
                <div style={{ fontFamily: SANS, fontSize: 13.5, color: INK, fontWeight: i === 0 ? 600 : 400 }}>{step.label}</div>
              )}
              <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginTop: 1 }}>{step.detail}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
