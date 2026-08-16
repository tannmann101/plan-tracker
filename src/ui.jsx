// ui.jsx
// Shared visual primitives -- the single place Secretary's "look" lives, so
// every screen renders as one consistent system.

import { useState } from "react";
import {
  MONO, SANS, SERIF, BG, CARD, INK, MUTE, MUTE_SOFT, LINE, HEAD_BG,
  INKBLUE, INKBLUE_SOFT, RADIUS, RADIUS_SM, SHADOW_CARD, TRANSITION, softTint,
} from "./theme";

export function GlobalStyle() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      body { -webkit-font-smoothing: antialiased; }
      input::placeholder, textarea::placeholder { color: ${MUTE_SOFT}; opacity: 1; }
      table tbody tr { transition: background ${TRANSITION}; }
      table tbody tr:hover td { background: ${HEAD_BG}; }
      .ui-field { transition: border-color ${TRANSITION}, box-shadow ${TRANSITION}; }
      .ui-field:focus { outline: none; border-color: ${INKBLUE}; box-shadow: 0 0 0 3px ${INKBLUE_SOFT}; }
      .ui-btn { transition: background ${TRANSITION}, border-color ${TRANSITION}, filter ${TRANSITION}, transform 60ms ease; }
      .ui-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--btn-c) 14%, transparent); }
      .ui-btn-primary:hover:not(:disabled) { filter: brightness(0.94); }
      .ui-btn:active:not(:disabled) { transform: translateY(1px); }
      .ui-btn:focus-visible { outline: 2px solid var(--btn-c); outline-offset: 2px; }
      .ui-tab:hover { background: rgba(36,34,32,0.05); }
      .ui-card-link:hover { border-color: ${INKBLUE}; box-shadow: 0 1px 2px rgba(36,34,32,0.06), 0 10px 26px rgba(36,34,32,0.1); }
      .ui-check { transition: background ${TRANSITION}, border-color ${TRANSITION}; cursor: pointer; }
      .ui-fab { transition: transform 120ms ease, box-shadow ${TRANSITION}; }
      .ui-fab:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(36,34,32,0.22); }
      .ui-fab:active { transform: translateY(0); }
      ::selection { background: ${INKBLUE_SOFT}; }
    `}</style>
  );
}

export function Wordmark({ size = 18 }) {
  return (
    <span style={{ fontFamily: SERIF, fontSize: size, fontWeight: 600, letterSpacing: "-0.01em", color: INK }}>
      Secretary
    </span>
  );
}

export function SectionTitle({ children, note }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "32px 0 10px", gap: 10, flexWrap: "wrap" }}>
      <h2 style={{
        fontFamily: SERIF, fontSize: 15.5, fontWeight: 600, color: INK, margin: 0,
        letterSpacing: "0.01em", display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: INKBLUE, display: "inline-block", flex: "none" }} />
        {children}
      </h2>
      {note && <span style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE }}>{note}</span>}
    </div>
  );
}

export function Btn({ onClick, children, color = INKBLUE, small, primary, disabled, type = "button", title }) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={primary ? "ui-btn ui-btn-primary" : "ui-btn"}
      style={{
        "--btn-c": color,
        border: `1px solid ${color}`,
        background: primary ? color : "transparent",
        color: primary ? "#FFFFFF" : color,
        fontFamily: MONO,
        fontWeight: primary ? 600 : 400,
        fontSize: small ? 11 : 12,
        padding: small ? "4px 8px" : "6px 13px",
        borderRadius: RADIUS_SM,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >{children}</button>
  );
}

export function IconButton({ onClick, children, title, color = MUTE }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="ui-btn"
      style={{
        "--btn-c": color, border: `1px solid ${LINE}`, background: BG, color,
        width: 26, height: 26, borderRadius: "50%", cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: MONO, fontSize: 12, flex: "none", padding: 0,
      }}
    >{children}</button>
  );
}

export function Input({ value, onChange, placeholder, width, type = "text", onEnter, autoFocus }) {
  return (
    <input
      className="ui-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
      placeholder={placeholder}
      type={type}
      autoFocus={autoFocus}
      style={{
        border: `1px solid ${LINE}`, borderRadius: RADIUS_SM, padding: "6px 9px", fontSize: 12.5,
        fontFamily: SANS, color: INK, width: width || "100%", background: BG,
      }}
    />
  );
}

export function Textarea({ value, onChange, placeholder, rows = 2 }) {
  return (
    <textarea
      className="ui-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        border: `1px solid ${LINE}`, borderRadius: RADIUS_SM, padding: "6px 9px", fontSize: 12.5,
        fontFamily: SANS, color: INK, width: "100%", background: BG, resize: "vertical",
      }}
    />
  );
}

export function Select({ value, onChange, options, width }) {
  return (
    <select className="ui-field" value={value} onChange={(e) => onChange(e.target.value)} style={{
      border: `1px solid ${LINE}`, borderRadius: RADIUS_SM, padding: "6px 9px", fontSize: 12, fontFamily: MONO, background: BG, color: INK, width,
    }}>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

// Segmented-control style page/view switcher.
export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "inline-flex", gap: 2, padding: 3, background: HEAD_BG, borderRadius: RADIUS, border: `1px solid ${LINE}` }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className="ui-tab"
          onClick={() => onChange(t.id)}
          style={{
            border: "none", background: active === t.id ? BG : "transparent", color: active === t.id ? INK : MUTE,
            fontFamily: MONO, fontSize: 12, fontWeight: active === t.id ? 600 : 400, padding: "6px 15px",
            borderRadius: RADIUS_SM, cursor: "pointer", boxShadow: active === t.id ? "0 1px 3px rgba(36,34,32,0.14)" : "none",
          }}
        >{t.label}</button>
      ))}
    </div>
  );
}

export function Card({ children, style, tint, onClick }) {
  return (
    <div
      onClick={onClick}
      className={onClick ? "ui-card-link" : undefined}
      style={{
        border: `1px solid ${LINE}`, borderRadius: RADIUS, background: tint || CARD,
        boxShadow: tint ? "none" : SHADOW_CARD, padding: 14, cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >{children}</div>
  );
}

export function Pill({ children, color = MUTE, tint }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", fontFamily: MONO, fontSize: 10.5, fontWeight: 600,
      letterSpacing: "0.02em", color, background: tint || HEAD_BG, border: `1px solid ${color}33`,
      borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

export function Note({ children }) {
  return (
    <p style={{ fontFamily: MONO, fontSize: 11, color: MUTE, lineHeight: 1.65, margin: "10px 0 0" }}>
      {children}
    </p>
  );
}

// Tap target for completing a Task/Session directly on its card.
export function Checkbox({ checked, onChange, color = INKBLUE }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className="ui-check"
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      style={{
        width: 19, height: 19, borderRadius: 5, flex: "none",
        border: `1.5px solid ${checked ? color : LINE}`, background: checked ? color : BG,
        display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0,
      }}
    >
      {checked && (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
          <path d="M3 8.5L6.5 12L13 4.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// A Goal's completion at a glance -- one hue, fill on a lighter step of the
// same ramp (per the dataviz skill's meter spec), thin and rounded. percent
// null (nothing to measure yet) renders nothing rather than an empty bar.
export function ProgressBar({ percent, color = INKBLUE }) {
  if (percent === null || percent === undefined) return null;
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 999, background: softTint(color) }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color, flex: "none" }}>{pct}%</span>
    </div>
  );
}

// A right-rail section (progress bars, charts, filters) rendered small in
// its normal spot, with a "⤢" button that reopens the exact same content
// full-width in an overlay -- so a chart that's unreadable at 220px doesn't
// need a second, bespoke "big" implementation. Today/ThisWeek/Workspace all
// wrap their rail sections in this rather than rendering charts twice.
export function ExpandableRail({ title, children }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</div>
        <IconButton title={`Expand ${title}`} onClick={() => setExpanded(true)}>⤢</IconButton>
      </div>
      {children}
      {expanded && (
        <Modal onClose={() => setExpanded(false)} width={720}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, margin: 0 }}>{title}</h3>
            <IconButton title="Close" onClick={() => setExpanded(false)}>×</IconButton>
          </div>
          {children}
        </Modal>
      )}
    </>
  );
}

// Modal/overlay for capture-confirmation and other over-the-current-screen
// interactions -- never a separate page to navigate to.
export function Modal({ onClose, children, width = 420 }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(36,34,32,0.42)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 18, zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: CARD, border: `1px solid ${LINE}`, borderRadius: RADIUS, boxShadow: SHADOW_CARD,
          padding: 22, width: "100%", maxWidth: width, maxHeight: "85vh", overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Floating action button -- richer capture (photo, etc.) entry point,
// always reachable regardless of which hub area you're in.
export function FAB({ onClick, title = "Capture" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="ui-fab"
      style={{
        position: "fixed", right: 20, bottom: 20, width: 52, height: 52, borderRadius: "50%",
        background: INKBLUE, color: "#fff", border: "none", boxShadow: "0 2px 10px rgba(36,34,32,0.28)",
        cursor: "pointer", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40,
      }}
    >
      +
    </button>
  );
}

// AI-assist affordance: generate a draft, review it, then explicitly accept
// or discard -- Secretary never commits an AI suggestion on its own. Used by
// both the weekly-meeting import and the capture-triage confirmation step.
export function AIAssist({ actionLabel = "Ask Secretary", onGenerate, onAccept, renderDraft, autoStart }) {
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(!!autoStart);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onGenerate();
      setDraft(result);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // Awaits onAccept and only clears the draft once it actually succeeds --
  // a failed commit (network error, a rejected write) keeps the reviewed/
  // edited draft on screen with the error shown, rather than silently
  // discarding Tanner's edits and forcing a full regenerate.
  const accept = async () => {
    setAccepting(true);
    setError(null);
    try {
      await onAccept(draft);
      setDraft(null);
    } catch (err) {
      setError(err.message || "Could not save that.");
    } finally {
      setAccepting(false);
    }
  };

  if (autoStart && !started) {
    setStarted(true);
    generate();
  }

  if (draft === null) {
    return (
      <div>
        {!autoStart && (
          <Btn primary color={INKBLUE} disabled={loading} onClick={generate}>
            {loading ? "Working…" : actionLabel}
          </Btn>
        )}
        {loading && autoStart && (
          <p style={{ fontFamily: MONO, fontSize: 12, color: MUTE }}>One moment…</p>
        )}
        {error ? (
          <p style={{ fontFamily: MONO, fontSize: 11.5, color: "#8B3A2B", marginTop: 10 }}>
            {error} <button type="button" onClick={generate} style={{ border: "none", background: "none", color: INKBLUE, cursor: "pointer", fontFamily: MONO, fontSize: 11.5, textDecoration: "underline" }}>Try again</button>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        Draft -- review before accepting
      </div>
      <div>{renderDraft(draft, { setDraft })}</div>
      {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: "#8B3A2B", marginTop: 10 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {onAccept ? (
          <Btn primary color={INKBLUE} disabled={accepting} onClick={accept}>{accepting ? "Saving…" : "Accept"}</Btn>
        ) : null}
        <Btn onClick={() => setDraft(null)} color={MUTE} disabled={accepting}>Discard</Btn>
        <Btn onClick={generate} disabled={loading || accepting} color={MUTE}>{loading ? "Working…" : "Try again"}</Btn>
      </div>
    </div>
  );
}
