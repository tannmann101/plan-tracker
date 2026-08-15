import { Card, Checkbox, Pill } from "../ui";
import { SANS, MONO, INK, MUTE, DOMAIN_COLORS, softTint } from "../theme";
import { InfoIcon, GoalChainLine } from "./InfoModal";
import { domainLabel, contentTypeLabel } from "../constants";

// Shared card for Tasks and Sessions on Today/This Week/Domains -- always a
// card (never a bare checklist row), always showing domain + tool_location +
// notes, with the completion checkbox and "why is this here" trace both
// directly on the card. Tapping the card body (not the checkbox, not the
// info icon) opens the edit form when onEdit is given -- this is what makes
// a mis-categorized item fixable from wherever you notice it.
export function EntityCard({ type, entity, domains, data, onToggleDone, readOnly, note, onEdit, onNavigateGoal }) {
  const domainColor = DOMAIN_COLORS[entity.domain] || MUTE;
  const done = !!entity.done;
  return (
    <Card style={{ display: "flex", alignItems: "flex-start", gap: 11, opacity: done ? 0.62 : 1 }}>
      {!readOnly && onToggleDone ? (
        <Checkbox checked={done} onChange={(next) => onToggleDone(entity, next)} />
      ) : (
        <div style={{ width: 19, height: 19, flex: "none" }} />
      )}
      <div
        style={{ flex: 1, minWidth: 0, cursor: !readOnly && onEdit ? "pointer" : "default" }}
        onClick={!readOnly && onEdit ? () => onEdit(type, entity) : undefined}
      >
        <div style={{
          fontFamily: SANS, fontSize: 13.5, color: INK, fontWeight: 500,
          textDecoration: done ? "line-through" : "none", lineHeight: 1.4,
        }}>{entity.title}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
          {entity.domain && <Pill color={domainColor} tint={softTint(domainColor)}>{domainLabel(entity.domain, domains)}</Pill>}
          {(entity.secondaryDomains || []).map((id) => {
            const c = DOMAIN_COLORS[id] || MUTE;
            return <Pill key={id} color={c} tint={softTint(c)}>{domainLabel(id, domains)}</Pill>;
          })}
          {type === "session" && entity.toolLocation && <Pill>{entity.toolLocation}</Pill>}
          {type === "task" && entity.contentType && <Pill>{contentTypeLabel(entity.contentType, data?.routingTable)}</Pill>}
          {entity.targetDay && <Pill color={MUTE}>{entity.targetDay}</Pill>}
          {entity.date && <Pill color={MUTE}>{entity.date}</Pill>}
        </div>
        {note && <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginTop: 6 }}>{note}</div>}
        <GoalChainLine type={type} entity={entity} data={data} onNavigateGoal={onNavigateGoal} />
      </div>
      <InfoIcon type={type} entity={entity} data={data} onNavigateGoal={onNavigateGoal} />
    </Card>
  );
}
