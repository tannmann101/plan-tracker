import { useState } from "react";
import { Btn, SectionTitle, Note, TabBar } from "../ui";
import { MUTE, INK, MONO, INKBLUE } from "../theme";
import { EntityCard } from "../components/EntityCard";
import QuickAddModal from "../components/QuickAddModal";
import EditEntityModal from "../components/EditEntityModal";
import CalendarMonthView from "../components/CalendarMonthView";
import { weekStartISO } from "../constants";
import { tasksForSession } from "../lib/graph";

const VIEW_TABS = [
  { id: "week", label: "Week" },
  { id: "calendar", label: "Calendar" },
];

export default function ThisWeek({ secretary, isOwner, onBack, onNavigate, onNavigateGoal }) {
  const [view, setView] = useState("week");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const weekStart = weekStartISO();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndISO = weekEnd.toISOString().slice(0, 10);

  const sessions = (secretary.sessions || [])
    .filter((s) => s.targetDay && s.targetDay >= weekStart && s.targetDay <= weekEndISO)
    .sort((a, b) => (a.targetDay || "").localeCompare(b.targetDay || ""));

  // Standalone Tasks (no Session) placed this week by their own date --
  // Sessions aren't the only thing that can carry a day anymore.
  const standaloneTasks = (secretary.tasks || [])
    .filter((t) => !t.sessionId && t.date && t.date >= weekStart && t.date <= weekEndISO);

  const byDay = {};
  for (const s of sessions) {
    const day = s.targetDay || "Unscheduled";
    (byDay[day] = byDay[day] || { sessions: [], tasks: [] }).sessions.push(s);
  }
  for (const t of standaloneTasks) {
    const day = t.date || "Unscheduled";
    (byDay[day] = byDay[day] || { sessions: [], tasks: [] }).tasks.push(t);
  }
  const sortedDays = Object.keys(byDay).sort();

  const toggleSessionDone = (entity, next) => secretary.saveEntity("session", { ...entity, done: next });
  const toggleTaskDone = (entity, next) => secretary.saveEntity("task", { ...entity, done: next });
  const openEdit = isOwner ? (t, e) => setEditing({ type: t, entity: e }) : null;

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Hub</Btn>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <SectionTitle note={`${weekStart} → ${weekEndISO}`}>This Week</SectionTitle>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
          <TabBar tabs={VIEW_TABS} active={view} onChange={setView} />
          {isOwner && view === "week" && <Btn small primary color={INKBLUE} onClick={() => setAdding(true)}>+ Add</Btn>}
          {isOwner && (
            <>
              <Btn small onClick={() => onNavigate("weeklyimport")}>Import weekly-meeting photo</Btn>
              <Btn small onClick={() => onNavigate("weeklyview")}>Weekly View (copy/paste)</Btn>
            </>
          )}
        </div>
      </div>

      {view === "calendar" ? (
        <CalendarMonthView secretary={secretary} isOwner={isOwner} onNavigateGoal={onNavigateGoal} />
      ) : sortedDays.length === 0 ? (
        <Note>No sessions or tasks are placed for this week yet. Import this week's meeting photo, capture a plan directly under a Goal, or use "+ Add" above.</Note>
      ) : (
        sortedDays.map((day) => (
          <div key={day} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: INK, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>{day}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {byDay[day].sessions.map((session) => (
                <div key={session.id}>
                  <EntityCard
                    type="session" entity={session} domains={secretary.domains} data={secretary}
                    readOnly={!isOwner} onToggleDone={toggleSessionDone} onEdit={openEdit} onNavigateGoal={onNavigateGoal}
                  />
                  {tasksForSession(session.id, secretary.tasks).length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6, marginLeft: 22 }}>
                      {tasksForSession(session.id, secretary.tasks).map((task) => (
                        <EntityCard
                          key={task.id} type="task" entity={task} domains={secretary.domains} data={secretary}
                          readOnly={!isOwner} onToggleDone={toggleTaskDone} onEdit={openEdit} onNavigateGoal={onNavigateGoal}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {byDay[day].tasks.map((task) => (
                <EntityCard
                  key={task.id} type="task" entity={task} domains={secretary.domains} data={secretary}
                  readOnly={!isOwner} onToggleDone={toggleTaskDone} onEdit={openEdit} onNavigateGoal={onNavigateGoal}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {adding && (
        <QuickAddModal
          secretary={secretary}
          types={["session", "task"]}
          defaultType="session"
          defaults={{ targetDay: weekStart }}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && (
        <EditEntityModal type={editing.type} entity={editing.entity} secretary={secretary} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
