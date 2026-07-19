// ui.jsx
// Shared visual primitives -- the single place the app's "look" lives, so
// every view renders as one consistent system.

import { MONO, SANS, BG, CARD, INK, MUTE, MUTE_SOFT, LINE, HEAD_BG, TEAL, TEAL_SOFT, RADIUS, RADIUS_SM, SHADOW_CARD, TRANSITION } from "./theme";

export function GlobalStyle() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      body { -webkit-font-smoothing: antialiased; }
      input::placeholder, textarea::placeholder { color: ${MUTE_SOFT}; opacity: 1; }
      table tbody tr { transition: background ${TRANSITION}; }
      table tbody tr:hover td { background: ${HEAD_BG}; }
      .ui-field { transition: border-color ${TRANSITION}, box-shadow ${TRANSITION}; }
      .ui-field:focus { outline: none; border-color: ${TEAL}; box-shadow: 0 0 0 3px ${TEAL_SOFT}; }
      .ui-btn { transition: background ${TRANSITION}, border-color ${TRANSITION}, filter ${TRANSITION}, transform 60ms ease; }
      .ui-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--btn-c) 14%, transparent); }
      .ui-btn-primary:hover:not(:disabled) { filter: brightness(0.93); }
      .ui-btn:active:not(:disabled) { transform: translateY(1px); }
      .ui-btn:focus-visible { outline: 2px solid var(--btn-c); outline-offset: 2px; }
      .ui-tab:hover { background: rgba(24,26,23,0.05); }
      ::selection { background: ${TEAL_SOFT}; }
    `}</style>
  );
}

export function SectionTitle({ children, note }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "36px 0 10px", gap: 10, flexWrap: "wrap" }}>
      <h2 style={{
        fontFamily: SANS, fontSize: 13.5, fontWeight: 700, color: INK, margin: 0,
        textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: TEAL, display: "inline-block", flex: "none" }} />
        {children}
      </h2>
      {note && <span style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE }}>{note}</span>}
    </div>
  );
}

export function Btn({ onClick, children, color = TEAL, small, primary, disabled, type = "button" }) {
  return (
    <button
      type={type}
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

export function Input({ value, onChange, placeholder, width, type = "text", onEnter }) {
  return (
    <input
      className="ui-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
      placeholder={placeholder}
      type={type}
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
            borderRadius: RADIUS_SM, cursor: "pointer", boxShadow: active === t.id ? "0 1px 3px rgba(24,26,23,0.14)" : "none",
          }}
        >{t.label}</button>
      ))}
    </div>
  );
}

export function Card({ children, style, tint }) {
  return (
    <div style={{
      border: `1px solid ${LINE}`, borderRadius: RADIUS, background: tint || CARD,
      boxShadow: tint ? "none" : SHADOW_CARD, padding: 14, ...style,
    }}>{children}</div>
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
