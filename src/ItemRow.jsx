import { useState } from "react";
import { STATUSES, domainLabel, typeLabel, effortLabel, ownerLabel, isStale, itemType } from "./constants";
import { DOMAIN_COLORS, STATUS_COLORS, TYPE_COLORS, BRICK, BRICK_SOFT, INK, HEAD_BG, softTint, MONO, SANS, MUTE, MUTE_SOFT, LINE } from "./theme";
import { Pill, Select, Btn } from "./ui";

// Single Item row shared across every view -- domain pill always shows (so
// any list still reads which domain each item belongs to), status is an
// inline-editable select so triage doesn't require opening the edit form.
// `parentTitle`, when passed, renders a "part of X" breadcrumb -- the caller
// decides when that's useful (e.g. not for a child already shown indented
// under its parent, where the nesting itself already makes that obvious).
export default function ItemRow({ item, showDomain = true, parentTitle, onEdit, onStatusChange, onDelete }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const type = itemType(item);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 4px",
      borderBottom: `1px solid ${LINE}`, flexWrap: "wrap",
    }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ fontFamily: SANS, fontSize: 13.5, color: INK, fontWeight: 500 }}>{item.title}</div>
        {item.sourceNote && (
          <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginTop: 2 }}>{item.sourceNote}</div>
        )}
        {item.definitionOfDone && (
          <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginTop: 2 }}>Done when: {item.definitionOfDone}</div>
        )}
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE_SOFT, marginTop: 3 }}>
          created {item.createdDate}{item.targetDate ? ` · target ${item.targetDate}` : ""}
          {item.effort ? ` · ${effortLabel(item.effort)}` : ""}
        </div>
        {parentTitle && (
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 2 }}>↳ part of {parentTitle}</div>
        )}
      </div>

      <Pill color={TYPE_COLORS[type]} tint={softTint(TYPE_COLORS[type])}>{typeLabel(type)}</Pill>

      {item.owner && (
        <Pill color={INK} tint={HEAD_BG}>{ownerLabel(item.owner)}</Pill>
      )}

      {showDomain && (
        <Pill color={DOMAIN_COLORS[item.domain]} tint={softTint(DOMAIN_COLORS[item.domain])}>
          {domainLabel(item.domain)}
        </Pill>
      )}

      {isStale(item) && (
        <Pill color={BRICK} tint={BRICK_SOFT}>Stale</Pill>
      )}

      <Select
        value={item.status}
        onChange={(v) => onStatusChange(item, v)}
        options={STATUSES}
        width={130}
      />

      <Btn small onClick={() => onEdit(item)} color={MUTE}>Edit</Btn>

      {confirmingDelete ? (
        <span style={{ display: "inline-flex", gap: 4 }}>
          <Btn small color={STATUS_COLORS.dropped} onClick={() => onDelete(item)}>Confirm</Btn>
          <Btn small color={MUTE} onClick={() => setConfirmingDelete(false)}>Cancel</Btn>
        </span>
      ) : (
        <Btn small onClick={() => setConfirmingDelete(true)} color={STATUS_COLORS.dropped}>Delete</Btn>
      )}
    </div>
  );
}
