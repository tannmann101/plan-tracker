import { useState } from "react";
import { STATUSES, domainLabel, isStale } from "./constants";
import { DOMAIN_COLORS, STATUS_COLORS, BRICK, BRICK_SOFT, softTint, MONO, SANS, MUTE, MUTE_SOFT, INK, LINE } from "./theme";
import { Pill, Select, Btn } from "./ui";

// Single Item row shared by both views -- domain pill always shows (so the
// weekly triage list still reads which domain each item belongs to), status
// is an inline-editable select so triage doesn't require opening the edit form.
export default function ItemRow({ item, showDomain = true, onEdit, onStatusChange, onDelete }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE_SOFT, marginTop: 3 }}>
          created {item.createdDate}{item.targetDate ? ` · target ${item.targetDate}` : ""}
        </div>
      </div>

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
