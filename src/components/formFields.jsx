import { useState } from "react";
import { Btn, Input } from "../ui";
import { MONO, SANS, INK, MUTE, INKBLUE, LINE } from "../theme";

// Shared building blocks for AddForm.jsx and EditEntityModal.jsx -- kept in
// one place so a Kind/Item's field behavior (tags, resources, milestones,
// parent picker) can't quietly drift apart between the add and edit paths.

export function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

export const fieldSelectStyle = { fontFamily: MONO, fontSize: 12, padding: "6px 9px", border: `1px solid ${LINE}`, borderRadius: 8, width: "100%" };

// Free-text entry with autocomplete against every tag already in use
// (§2.4) -- no fixed vocabulary, new tags are created just by typing one.
export function TagsInput({ value, onChange, suggestions }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim().toLowerCase();
    if (!t || value.includes(t)) { setText(""); return; }
    onChange([...value, t]);
    setText("");
  };
  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {value.map((t) => (
            <span key={t} style={{
              display: "inline-flex", alignItems: "center", gap: 4, fontFamily: MONO, fontSize: 10.5,
              color: INKBLUE, background: "#DEE6EA", borderRadius: 999, padding: "2px 8px",
            }}>
              {t}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} style={{ border: "none", background: "none", color: INKBLUE, cursor: "pointer", padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
      <input
        className="ui-field" list="shared-tag-suggestions" value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder="Add a tag…"
        style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 9px", fontSize: 12.5, fontFamily: SANS, color: INK, width: "100%" }}
      />
      <datalist id="shared-tag-suggestions">
        {suggestions.filter((s) => !value.includes(s)).map((s) => <option key={s} value={s} />)}
      </datalist>
    </div>
  );
}

// Scrollable checkbox list -- used for both secondary domains and
// resources, more touch-friendly than a native multi-select.
export function MultiCheckList({ options, value, onChange }) {
  return (
    <div style={{ maxHeight: 140, overflowY: "auto", border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 9px" }}>
      {options.map((o) => {
        const id = typeof o === "string" ? o : o.id;
        const label = typeof o === "string" ? o : o.label;
        const checked = value.includes(id);
        return (
          <label key={id} style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: MONO, fontSize: 11.5, color: INK, padding: "3px 0", cursor: "pointer" }}>
            <input type="checkbox" checked={checked} onChange={() => onChange(checked ? value.filter((v) => v !== id) : [...value, id])} />
            {label}
          </label>
        );
      })}
    </div>
  );
}

// A due date and/or milestone list is all timing a Kind carries -- it's
// meant to be tentative at creation and fleshed out later in Plans/
// Workspace, not fully scheduled here.
export function MilestonesEditor({ value, onChange }) {
  const [text, setText] = useState("");
  const add = () => {
    if (!text.trim()) return;
    onChange([...value, { id: `m${Date.now()}`, title: text.trim(), done: false }]);
    setText("");
  };
  return (
    <div>
      {value.map((m) => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
          <input type="checkbox" checked={m.done} onChange={() => onChange(value.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)))} />
          <span style={{ flex: 1, fontFamily: SANS, fontSize: 12.5, color: INK, textDecoration: m.done ? "line-through" : "none" }}>{m.title}</span>
          <button type="button" onClick={() => onChange(value.filter((x) => x.id !== m.id))} style={{ border: "none", background: "none", color: MUTE, cursor: "pointer", fontSize: 13 }}>×</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6 }}>
        <Input value={text} onChange={setText} placeholder="Add a milestone…" onEnter={add} />
        <Btn small onClick={add}>Add</Btn>
      </div>
    </div>
  );
}

// A searchable picker over every existing Kind -- an Item's optional
// grounding point, or a Kind's own parent (nesting) when `excludeIds` is
// passed to guard against cycles.
export function KindParentPicker({ kinds, value, onChange, excludeIds }) {
  const [filter, setFilter] = useState("");
  const excluded = excludeIds ? new Set(excludeIds) : null;
  const options = (kinds || [])
    .filter((k) => !excluded || !excluded.has(k.id))
    .filter((k) => k.title.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <div>
      <Input value={filter} onChange={setFilter} placeholder="Search…" />
      <select value={value || ""} onChange={(e) => onChange(e.target.value || null)} style={{ ...fieldSelectStyle, marginTop: 6 }}>
        <option value="">-- not linked --</option>
        {options.map((k) => <option key={k.id} value={k.id}>{k.title} ({k.kindType})</option>)}
      </select>
    </div>
  );
}
