import { Btn, SectionTitle, Note } from "../ui";
import { MUTE, INK, MONO } from "../theme";
import { EntityCard } from "../components/EntityCard";
import { weekStartISO } from "../constants";
import { tasksForSession } from "../lib/graph";

export default function ThisWeek({ secretary, isOwner, onBack, onNavigate }) {
  const weekStart = weekStartISO();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndISO = weekEnd.toISOString().slice(0, 10);

  const sessions = (secretary.sessions || [])
    .filter((s) => s.targetDay && s.targetDay >= weekStart && s.targetDay <= weekEndISO)
    .sort((a, b) => (a.targetDay || "").localeCompare(b.targetDay || ""));

  const byDay = {};
  for (const s of sessions) {
    const day = s.targetDay || "Unscheduled";
    (byDay[day] = byDay[day] || []).push(s);
  }

  const toggleSessionDone = (entity, next) => secretary.saveEntity("session", { ...entity, done: next });
  const toggleTaskDone = (entity, next) => secretary.saveEntity("task", { ...entity, done: next });

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Hub</Btn>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <SectionTitle note={`${weekStart} → ${weekEndISO}`}>This Week</SectionTitle>
        {isOwner && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <Btn small onClick={() => onNavigate("weeklyimport")}>Import weekly-meeting photo</Btn>
            <Btn small onClick={() => onNavigate("weeklyview")}>Weekly View (copy/paste)</Btn>
          </div>
        )}
      </div>

      {sessions.length === 0 ? (
        <Note>No sessions are placed for this week yet. Import this week's meeting photo, or capture a plan directly under a Goal.</Note>
      ) : (
        Object.entries(byDay).map(([day, daySessions]) => (
          <div key={day} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: INK, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>{day}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {daySessions.map((session) => (
                <div key={session.id}>
                  <EntityCard
                    type="session"
                    entity={session}
                    domains={secretary.domains}
                    data={secretary}
                    readOnly={!isOwner}
                    onToggleDone={toggleSessionDone}
                  />
                  {tasksForSession(session.id, secretary.tasks).length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6, marginLeft: 22 }}>
                      {tasksForSession(session.id, secretary.tasks).map((task) => (
                        <EntityCard
                          key={task.id}
                          type="task"
                          entity={task}
                          domains={secretary.domains}
                          data={secretary}
                          readOnly={!isOwner}
                          onToggleDone={toggleTaskDone}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
