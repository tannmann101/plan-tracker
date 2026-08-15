import { useState } from "react";
import { Modal, IconButton } from "../ui";
import { SANS, MONO, SERIF, INK, MUTE, LINE, INKBLUE } from "../theme";
import { traceFor } from "../lib/graph";

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
