import { Card, Checkbox, Pill } from "../ui";
import { SANS, MONO, INK, MUTE, DEEPTEAL, DOMAIN_COLORS, STATUS_COLORS, ATTENTION_COLORS, softTint } from "../theme";
import { InfoIcon, KindChainLine } from "./InfoModal";
import { domainLabel, kindStatusLabel, itemTypeLabel, kindTypeLabel } from "../constants";
import { kindAttention } from "../lib/graph";

function timingLabel(timing) {
  if (!timing) return null;
  if (timing.targetDay) return timing.time ? `${timing.targetDay} ${timing.time}` : timing.targetDay;
  if (timing.dueDate) return `by ${timing.dueDate}`;
  return null;
}

// Shared ticket card for Kinds and Items -- Today, Week/Calendar, Plans'
// kanban, Workspace's boards, and Log's rows all render through this (or a
// thin wrapper) rather than bespoke per-page markup (§15). A Kind shows its
// status pill; an Item shows a completion checkbox. Tapping the card body
// (not the checkbox, not the info icon) opens the edit modal.
export function EntityCard({ family, entity, secretary, onToggleDone, readOnly, note, onEdit, onNavigateKind }) {
  const domainColor = DOMAIN_COLORS[entity.domain] || MUTE;
  const done = family === "item" ? !!entity.done : entity.status === "done";
  const timing = timingLabel(entity.timing);
  const attention = family === "kind" ? kindAttention(entity, secretary) : null;
  return (
    <Card style={{ display: "flex", alignItems: "flex-start", gap: 11, opacity: done ? 0.62 : 1 }}>
      {family === "item" && !readOnly && onToggleDone ? (
        <Checkbox checked={done} onChange={(next) => onToggleDone(entity, next)} />
      ) : (
        <div style={{ width: 19, height: 19, flex: "none" }} />
      )}
      <div
        style={{ flex: 1, minWidth: 0, cursor: !readOnly && onEdit ? "pointer" : "default" }}
        onClick={!readOnly && onEdit ? () => onEdit(family, entity) : undefined}
      >
        <div style={{
          fontFamily: SANS, fontSize: 13.5, color: INK, fontWeight: 500,
          textDecoration: done ? "line-through" : "none", lineHeight: 1.4,
        }}>{entity.title}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
          {entity.domain && <Pill color={domainColor} tint={softTint(domainColor)}>{domainLabel(entity.domain, secretary.domains)}</Pill>}
          {(entity.secondaryDomains || []).map((id) => {
            const c = DOMAIN_COLORS[id] || MUTE;
            return <Pill key={id} color={c} tint={softTint(c)}>{domainLabel(id, secretary.domains)}</Pill>;
          })}
          {family === "kind" && <Pill color={STATUS_COLORS[entity.status] || MUTE}>{kindStatusLabel(entity.status)}</Pill>}
          {family === "kind" && <Pill>{kindTypeLabel(entity.kindType)}</Pill>}
          {family === "item" && <Pill>{itemTypeLabel(entity.itemType)}</Pill>}
          {(entity.resources || []).map((r) => <Pill key={r} color={MUTE}>{r}</Pill>)}
          {(entity.tags || []).map((t) => <Pill key={t}>#{t}</Pill>)}
          {timing && <Pill color={MUTE}>{timing}</Pill>}
          {entity.retro && <Pill color={MUTE}>retro</Pill>}
          {entity.isRecurringPracticeItem && (
            <Pill color={DEEPTEAL} tint={softTint(DEEPTEAL)} title="Tracked as a Practice -- checking this box is the same box as Plans' weekly tracker">
              ↻ practice
            </Pill>
          )}
          {attention && <Pill color={ATTENTION_COLORS[attention.level]}>{attention.label}</Pill>}
        </div>
        {attention && (
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: ATTENTION_COLORS[attention.level], marginTop: 6 }}>{attention.hint}</div>
        )}
        {note && <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginTop: 6 }}>{note}</div>}
        <KindChainLine family={family} entity={entity} data={secretary} onNavigateKind={onNavigateKind} />
      </div>
      <InfoIcon family={family} entity={entity} data={secretary} onNavigateKind={onNavigateKind} />
    </Card>
  );
}
