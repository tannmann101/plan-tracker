import { useState } from "react";
import { Btn, SectionTitle, Note } from "../ui";
import { MUTE, INKBLUE } from "../theme";
import { EntityCard } from "../components/EntityCard";
import QuickAddModal from "../components/QuickAddModal";
import EditEntityModal from "../components/EditEntityModal";
import { todayISO } from "../constants";

export default function Today({ secretary, isOwner, onBack, onNavigateGoal }) {
  const today = todayISO();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const tasks = (secretary.tasks || []).filter((t) => t.date === today);
  const sessions = (secretary.sessions || []).filter((s) => s.targetDay === today);
  const items = [
    ...sessions.map((s) => ({ type: "session", entity: s })),
    ...tasks.map((t) => ({ type: "task", entity: t })),
  ].sort((a, b) => Number(!!a.entity.done) - Number(!!b.entity.done));

  const toggleDone = (type, entity, next) => {
    secretary.saveEntity(type, { ...entity, done: next });
  };

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Hub</Btn>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <SectionTitle note={today}>Today</SectionTitle>
        {isOwner && <Btn small primary color={INKBLUE} onClick={() => setAdding(true)}>+ Add</Btn>}
      </div>
      {items.length === 0 ? (
        <Note>Nothing is scheduled for today. A quiet day, or an uncaptured one -- worth a glance at This Week.</Note>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {items.map(({ type, entity }) => (
            <EntityCard
              key={`${type}-${entity.id}`}
              type={type}
              entity={entity}
              domains={secretary.domains}
              data={secretary}
              readOnly={!isOwner}
              onToggleDone={(e, next) => toggleDone(type, e, next)}
              onEdit={isOwner ? (t, e) => setEditing({ type: t, entity: e }) : null}
              onNavigateGoal={onNavigateGoal}
            />
          ))}
        </div>
      )}

      {adding && (
        <QuickAddModal
          secretary={secretary}
          types={["task"]}
          defaultType="task"
          defaults={{ date: today }}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && (
        <EditEntityModal type={editing.type} entity={editing.entity} secretary={secretary} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
