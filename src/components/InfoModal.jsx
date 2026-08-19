import { useState } from "react";
import { Modal, IconButton, ModalHeading } from "../ui";
import { MONO, INK, MUTE, LINE, INKBLUE, RADIUS_SM, GAP_ACTIONS, GAP_ROW } from "../theme";
import { traceFor } from "../lib/graph";

// Small info icon every Kind/Item card carries -- tapping it shows the
// chain up through parentKindId to the root Kind without digging through
// the event log. onNavigateKind, when given, makes any Kind step in the
// chain tap-through to that Kind (e.g. focus it on Workspace).
export function InfoIcon({ family, entity, data, onNavigateKind }) {
  return <TraceButton family={family} entity={entity} data={data} onNavigateKind={onNavigateKind} />;
}

function TraceButton({ family, entity, data, onNavigateKind }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton title="Why is this here?" onClick={() => setOpen(true)}>i</IconButton>
      {open && (
        <Modal onClose={() => setOpen(false)} width={380}>
          <ModalHeading>Why this is here</ModalHeading>
          <TraceChain
            family={family}
            entity={entity}
            data={data}
            onNavigateKind={onNavigateKind ? (kindId) => { setOpen(false); onNavigateKind(kindId); } : null}
          />
          <div style={{ textAlign: "right", marginTop: GAP_ACTIONS }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ border: `1px solid ${LINE}`, background: "transparent", color: MUTE, fontFamily: MONO, fontSize: 11.5, padding: "5px 12px", borderRadius: RADIUS_SM, cursor: "pointer" }}
            >
              close
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function TraceChain({ family, entity, data, onNavigateKind }) {
  const steps = traceFor(family, entity, data);
  if (!steps.length) {
    return <p style={{ fontFamily: MONO, fontSize: 13, color: MUTE }}>Not attached to anything yet.</p>;
  }
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
      {steps.map((step, i) => {
        const clickable = step.kindId && onNavigateKind;
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
                  onClick={() => onNavigateKind(step.kindId)}
                  style={{
                    fontFamily: MONO, fontSize: 13, color: INKBLUE, fontWeight: i === 0 ? 600 : 400,
                    border: "none", background: "none", padding: 0, cursor: "pointer", textDecoration: "underline",
                  }}
                >
                  {step.label} →
                </button>
              ) : (
                <div style={{ fontFamily: MONO, fontSize: 13, color: INK, fontWeight: i === 0 ? 600 : 400 }}>{step.label}</div>
              )}
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 1 }}>{step.detail}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// Inline, horizontal counterpart to TraceChain -- same traceFor() steps,
// rendered as a breadcrumb directly on a card instead of a vertical chain
// inside a modal. Drops the entity's own first step (its title is already
// shown by the card).
export function KindChainLine({ family, entity, data, onNavigateKind }) {
  const steps = traceFor(family, entity, data);
  const chain = steps.slice(1);
  if (chain.length === 0) {
    if (family === "kind") return null; // a root Kind's empty chain isn't a gap, just the top of the tree
    return <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 6 }}>not attached to anything</div>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: GAP_ROW, marginTop: 6 }}>
      {chain.map((step, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {i > 0 && <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE }}>›</span>}
          {step.kindId && onNavigateKind ? (
            <button
              type="button"
              onClick={() => onNavigateKind(step.kindId)}
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
