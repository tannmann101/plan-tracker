import { Btn, SectionTitle, Note } from "../ui";
import { MUTE } from "../theme";
import { EntityCard } from "../components/EntityCard";
import { todayISO } from "../constants";

export default function Today({ secretary, isOwner, onBack }) {
  const today = todayISO();
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
      <SectionTitle note={today}>Today</SectionTitle>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
