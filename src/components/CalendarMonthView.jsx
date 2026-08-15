import { useState } from "react";
import { Btn, SectionTitle, Note } from "../ui";
import { SANS, MONO, INK, MUTE, LINE, INKBLUE, INKBLUE_SOFT, CARD, RADIUS_SM } from "../theme";
import { EntityCard } from "./EntityCard";
import QuickAddModal from "./QuickAddModal";
import EditEntityModal from "./EditEntityModal";
import { tasksForSession } from "../lib/graph";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toISO(d) {
  return d.toISOString().slice(0, 10);
}

// Every date cell the grid needs to render a given month, including the
// leading/trailing days from adjacent months that fill out the first/last
// week rows.
function monthGridDays(monthStart) {
  const first = new Date(monthStart);
  const gridStart = new Date(first);
  gridStart.setDate(gridStart.getDate() - first.getDay());
  const days = [];
  const cursor = new Date(gridStart);
  for (let i = 0; i < 42; i++) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// Month-grid calendar for This Week's "look further ahead" mode -- prev/next
// navigation, a dot on any day carrying Sessions or standalone Tasks, tap a
// day to see (and add to) that day's items. Same EntityCard/Quick Add/Edit
// pieces the Week view and Today use, so behavior stays consistent across
// every day-scoped surface.
export default function CalendarMonthView({ secretary, isOwner, onNavigateGoal }) {
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const today = toISO(new Date());
  const days = monthGridDays(monthStart);
  const monthLabel = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const daysWithItems = new Set([
    ...(secretary.sessions || []).map((s) => s.targetDay).filter(Boolean),
    ...(secretary.tasks || []).map((t) => t.date).filter(Boolean),
  ]);

  const changeMonth = (delta) => {
    const d = new Date(monthStart);
    d.setMonth(d.getMonth() + delta);
    setMonthStart(d);
    setSelectedDay(null);
  };

  const daySessions = selectedDay ? (secretary.sessions || []).filter((s) => s.targetDay === selectedDay) : [];
  const dayStandaloneTasks = selectedDay ? (secretary.tasks || []).filter((t) => t.date === selectedDay && !t.sessionId) : [];

  const toggleSessionDone = (entity, next) => secretary.saveEntity("session", { ...entity, done: next });
  const toggleTaskDone = (entity, next) => secretary.saveEntity("task", { ...entity, done: next });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Btn small onClick={() => changeMonth(-1)} color={MUTE}>← Prev</Btn>
        <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: INK }}>{monthLabel}</span>
        <Btn small onClick={() => changeMonth(1)} color={MUTE}>Next →</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} style={{ fontFamily: MONO, fontSize: 10, color: MUTE, textAlign: "center", padding: "4px 0" }}>{w}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {days.map((d) => {
          const iso = toISO(d);
          const inMonth = d.getMonth() === monthStart.getMonth();
          const isToday = iso === today;
          const isSelected = iso === selectedDay;
          const hasItems = daysWithItems.has(iso);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedDay(iso)}
              style={{
                aspectRatio: "1", border: `1px solid ${isSelected ? INKBLUE : LINE}`,
                background: isSelected ? INKBLUE_SOFT : isToday ? "#F9F7F1" : CARD,
                borderRadius: RADIUS_SM, cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 3, opacity: inMonth ? 1 : 0.35,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 12, color: isToday ? INKBLUE : INK, fontWeight: isToday ? 700 : 400 }}>{d.getDate()}</span>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: hasItems ? INKBLUE : "transparent" }} />
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <SectionTitle note={selectedDay}>Selected Day</SectionTitle>
            {isOwner && <Btn small primary color={INKBLUE} onClick={() => setAdding(true)}>+ Add</Btn>}
          </div>
          {daySessions.length === 0 && dayStandaloneTasks.length === 0 ? (
            <Note>Nothing placed on this day yet.</Note>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {daySessions.map((session) => (
                <div key={session.id}>
                  <EntityCard
                    type="session" entity={session} domains={secretary.domains} data={secretary}
                    readOnly={!isOwner} onToggleDone={toggleSessionDone}
                    onEdit={isOwner ? (t, e) => setEditing({ type: t, entity: e }) : null}
                    onNavigateGoal={onNavigateGoal}
                  />
                  {tasksForSession(session.id, secretary.tasks).length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6, marginLeft: 22 }}>
                      {tasksForSession(session.id, secretary.tasks).map((task) => (
                        <EntityCard
                          key={task.id} type="task" entity={task} domains={secretary.domains} data={secretary}
                          readOnly={!isOwner} onToggleDone={toggleTaskDone}
                          onEdit={isOwner ? (t, e) => setEditing({ type: t, entity: e }) : null}
                          onNavigateGoal={onNavigateGoal}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {dayStandaloneTasks.map((task) => (
                <EntityCard
                  key={task.id} type="task" entity={task} domains={secretary.domains} data={secretary}
                  readOnly={!isOwner} onToggleDone={toggleTaskDone}
                  onEdit={isOwner ? (t, e) => setEditing({ type: t, entity: e }) : null}
                  onNavigateGoal={onNavigateGoal}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {adding && selectedDay && (
        <QuickAddModal
          secretary={secretary}
          types={["session", "task"]}
          defaultType="session"
          defaults={{ targetDay: selectedDay, date: selectedDay }}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && (
        <EditEntityModal type={editing.type} entity={editing.entity} secretary={secretary} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
