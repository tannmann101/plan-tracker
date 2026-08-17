import { useState } from "react";
import { Btn, Input } from "../ui";
import { MONO, SANS, INK, MUTE, INKBLUE, INKBLUE_SOFT, LINE } from "../theme";
import { DURATION_OPTIONS } from "../constants";

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
              color: INKBLUE, background: INKBLUE_SOFT, borderRadius: 999, padding: "2px 8px",
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

// A discipline's milestones (Plans' "Habits to Break") are day-offsets
// from whenever its streak last reset, not fixed dates -- so unlike
// MilestonesEditor's title/done checklist, each entry pairs a label with
// a day count (e.g. "2 weeks" / 14) and disciplineStreak() in lib/graph.js
// derives which ones are already reached from the live streak.
export function DisciplineMilestonesEditor({ value, onChange }) {
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("");
  const add = () => {
    const d = Number(days);
    if (!label.trim() || !d || d <= 0) return;
    onChange([...value, { id: `m${Date.now()}`, label: label.trim(), days: d }].sort((a, b) => a.days - b.days));
    setLabel("");
    setDays("");
  };
  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {value.map((m) => (
            <span key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 11, border: `1px solid ${LINE}`, borderRadius: 999, padding: "3px 9px" }}>
              {m.label} ({m.days}d)
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== m.id))} style={{ border: "none", background: "none", color: MUTE, cursor: "pointer", padding: 0, fontSize: 12 }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <Input value={label} onChange={setLabel} placeholder="Milestone label…" onEnter={add} />
        <Input value={days} onChange={setDays} placeholder="Days" width={64} type="number" onEnter={add} />
        <Btn small onClick={add}>Add</Btn>
      </div>
    </div>
  );
}

// A timed Item's block length -- the fixed presets cover the common cases
// in one tap, but "Custom…" drops to a plain minutes field so a block
// isn't forced into one of a handful of lengths.
export function DurationInput({ value, onChange }) {
  const isPreset = DURATION_OPTIONS.some((o) => o.id === String(value));
  const [customMode, setCustomMode] = useState(!isPreset);
  const selectValue = customMode ? "custom" : String(value);

  return (
    <div>
      <select
        value={selectValue}
        onChange={(e) => {
          if (e.target.value === "custom") { setCustomMode(true); return; }
          setCustomMode(false);
          onChange(e.target.value);
        }}
        style={fieldSelectStyle}
      >
        {DURATION_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        <option value="custom">Custom…</option>
      </select>
      {customMode && (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <input
            className="ui-field" type="number" min={1} step={1} value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 9px", fontSize: 12.5, fontFamily: SANS, color: INK, width: 90 }}
          />
          <span style={{ fontFamily: MONO, fontSize: 11, color: MUTE }}>minutes</span>
        </div>
      )}
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
