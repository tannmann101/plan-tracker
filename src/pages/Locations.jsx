import { useState } from "react";
import { Btn, SectionTitle, Note, Card } from "../ui";
import { SERIF, MONO, INK, MUTE, INKBLUE } from "../theme";
import { EntityCard } from "../components/EntityCard";
import EditEntityModal from "../components/EditEntityModal";

function LocationDashboard({ location, secretary, isOwner, onBack, onNavigateGoal }) {
  const [editing, setEditing] = useState(null);

  const sessions = (secretary.sessions || []).filter((s) => s.toolLocation === location);
  const tasks = (secretary.tasks || []).filter((t) => t.toolLocation === location);
  const activeSessions = sessions.filter((s) => !s.done);
  const doneSessions = sessions.filter((s) => s.done);
  const activeTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);

  const toggleSessionDone = (entity, next) => secretary.saveEntity("session", { ...entity, done: next });
  const toggleTaskDone = (entity, next) => secretary.saveEntity("task", { ...entity, done: next });
  const openEdit = isOwner ? (t, e) => setEditing({ type: t, entity: e }) : null;

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Locations</Btn>
      <SectionTitle note={`${activeSessions.length + activeTasks.length} active`}>{location}</SectionTitle>

      <SectionTitle note={`${activeSessions.length} active`}>Sessions</SectionTitle>
      {activeSessions.length === 0 ? <Note>None active.</Note> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activeSessions.map((s) => (
            <EntityCard key={s.id} type="session" entity={s} domains={secretary.domains} data={secretary} readOnly={!isOwner} onToggleDone={toggleSessionDone} onEdit={openEdit} onNavigateGoal={onNavigateGoal} />
          ))}
        </div>
      )}

      <SectionTitle note={`${activeTasks.length} open`}>Tasks</SectionTitle>
      {activeTasks.length === 0 ? <Note>None open.</Note> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activeTasks.map((t) => (
            <EntityCard key={t.id} type="task" entity={t} domains={secretary.domains} data={secretary} readOnly={!isOwner} onToggleDone={toggleTaskDone} onEdit={openEdit} onNavigateGoal={onNavigateGoal} />
          ))}
        </div>
      )}

      <SectionTitle note={`${doneSessions.length + doneTasks.length} items`}>Completed</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {doneSessions.map((s) => (
          <EntityCard key={s.id} type="session" entity={s} domains={secretary.domains} data={secretary} readOnly={!isOwner} onToggleDone={toggleSessionDone} onEdit={openEdit} onNavigateGoal={onNavigateGoal} />
        ))}
        {doneTasks.map((t) => (
          <EntityCard key={t.id} type="task" entity={t} domains={secretary.domains} data={secretary} readOnly={!isOwner} onToggleDone={toggleTaskDone} onEdit={openEdit} onNavigateGoal={onNavigateGoal} />
        ))}
        {doneSessions.length + doneTasks.length === 0 && <Note>Nothing completed here yet.</Note>}
      </div>

      {editing && (
        <EditEntityModal type={editing.type} entity={editing.entity} secretary={secretary} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

// The inverse of Domains -- instead of "what role is this for," this
// answers "where does it actually land": every distinct tool/location the
// routing table declares (plus any still in live use even if a Settings
// edit later renamed or dropped that entry, so nothing already placed
// silently disappears), each with the Sessions and Tasks currently
// assigned there. Reuses EntityCard/EditEntityModal exactly like Domains.
export default function Locations({ secretary, isOwner, onBack, onNavigateGoal }) {
  const [selected, setSelected] = useState(null);

  const fromRoutingTable = (secretary.routingTable || []).map((r) => r.toolLocation);
  const fromLiveItems = [
    ...(secretary.sessions || []).map((s) => s.toolLocation),
    ...(secretary.tasks || []).map((t) => t.toolLocation),
  ];
  const locations = [...new Set([...fromRoutingTable, ...fromLiveItems])].filter(Boolean).sort();

  if (selected) {
    return <LocationDashboard location={selected} secretary={secretary} isOwner={isOwner} onBack={() => setSelected(null)} onNavigateGoal={onNavigateGoal} />;
  }

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Hub</Btn>
      <SectionTitle>Locations</SectionTitle>
      <Note>Where Sessions and Tasks actually land, by tool or physical location -- across every domain, not grouped by role.</Note>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 14 }}>
        {locations.map((loc) => {
          const count = (secretary.sessions || []).filter((s) => s.toolLocation === loc && !s.done).length
            + (secretary.tasks || []).filter((t) => t.toolLocation === loc && !t.done).length;
          return (
            <Card key={loc} onClick={() => setSelected(loc)} style={{ minHeight: 90 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <h3 style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: INK, margin: 0 }}>{loc}</h3>
                <span style={{ fontFamily: MONO, fontSize: 14, color: INKBLUE, fontWeight: 600 }}>{count}</span>
              </div>
            </Card>
          );
        })}
        {locations.length === 0 && <Note>No locations declared yet -- see Settings' routing table.</Note>}
      </div>
    </div>
  );
}
