import { useState } from "react";
import { Btn, SectionTitle, Note, TabBar } from "../ui";
import { MONO, INK, MUTE, INKBLUE } from "../theme";
import { useViewport } from "../useViewport";
import { EntityCard } from "../components/EntityCard";
import { TimeGridDay, TimeRangeControl, DayGridRow, useTimeGridPrefs } from "../components/TimeGrid";
import AddForm from "../components/AddForm";
import EditEntityModal from "../components/EditEntityModal";
import DisciplineDetailModal from "../components/DisciplineDetailModal";
import { todayISO, addDaysISO } from "../constants";

const VIEW_TABS = [
  { id: "blocked", label: "Time-blocked" },
  { id: "list", label: "List" },
];

function dayLabel(iso, today) {
  if (iso === today) return "Today";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function nextDays(today, count) {
  const days = [today];
  for (let i = 1; i < count; i++) days.push(addDaysISO(today, i));
  return days;
}

// §6 -- Items-only Add (a Kind add belongs on Plans/Workspace, not here)
// and a 4-day strip. Goal progress and "where's this landing" used to live
// in a right rail here, but that was a smaller, less capable copy of views
// that now live properly on Workspace (full width, with real drilldown) --
// this page is the day/week's own schedule, not a second analytics rail.
export default function Today({ secretary, onBack, onNavigateKind, onAskSecretary }) {
  const { isDesktop } = useViewport();
  const today = todayISO();
  const [view, setView] = useState("blocked");
  const [gridPrefs, setGridPrefs] = useTimeGridPrefs();
  const [adding, setAdding] = useState(false);
  const [addDefaults, setAddDefaults] = useState({ targetDay: today });
  const [editing, setEditing] = useState(null);
  const [disciplineModal, setDisciplineModal] = useState(null);

  const activeDisciplines = (secretary.disciplines || []).filter((d) => d.focused && !d.resolved);
  const days = nextDays(today, 4);
  const items = (secretary.items || []).filter((i) => days.includes(i.timing?.targetDay));
  const itemsByDay = Object.fromEntries(days.map((d) => [d, items
    .filter((i) => i.timing?.targetDay === d)
    .sort((a, b) => Number(!!a.done) - Number(!!b.done) || (a.timing?.time || "").localeCompare(b.timing?.time || ""))]));

  // A practice check-in's quick checkbox defaults its first-ever
  // progressAmount to 1 -- the right behavior for a checkbox-mode habit
  // (each check is worth 1 toward its target, same as Plans' own tracker
  // checkbox), but a log-mode habit's amount is variable per day and
  // shouldn't be guessed at; checking there just marks it done, and the
  // actual amount gets logged via the edit modal (open the card). Also
  // self-heals parentKindId to the habit's current linkedKindId on every
  // toggle, so a goal-linked habit's check-in stays traceable wherever it
  // shows (calendar, Workspace, Log) even if it drifted or predates linking.
  const toggleDone = (entity, next) => {
    const habit = entity.isRecurringPracticeItem ? (secretary.practiceHabits || []).find((h) => h.id === entity.practiceHabitId) : null;
    const isLogMode = habit?.linkedKindId && (habit.progressMode || "log") === "log";
    secretary.saveEntity("item", {
      ...entity, done: next, completedAt: next ? Date.now() : null,
      ...(habit ? { progressAmount: next ? (entity.progressAmount || (isLogMode ? 0 : 1)) : 0, parentKindId: habit.linkedKindId || null } : {}),
    });
  };

  // Direct drag-and-drop reschedule (TimeGrid's own onReschedule) -- a
  // human dragging a block writes straight through secretary.saveEntity,
  // same as the Plans kanban's drag-to-restatus; it does not go through
  // Secretary's propose-then-confirm queue, since that's for the AI's own
  // proposals, not a person moving their own calendar by hand.
  const rescheduleItem = (itemId, patch) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    secretary.saveEntity("item", { ...item, timing: { ...item.timing, ...patch } });
  };

  const openAdd = (defaults) => { setAddDefaults(defaults); setAdding(true); };
  const onSlotClick = (iso, hour) => openAdd({ targetDay: iso, time: `${String(hour).padStart(2, "0")}:00` });

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Back</Btn>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <SectionTitle note={today}>Today</SectionTitle>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <TabBar tabs={VIEW_TABS} active={view} onChange={setView} />
          {view === "blocked" && <TimeRangeControl prefs={gridPrefs} onChange={setGridPrefs} />}
          <Btn small primary color={INKBLUE} onClick={() => openAdd({ targetDay: today })}>+ Add</Btn>
        </div>
      </div>

      {view === "blocked" ? (
        <DayGridRow count={days.length} minColPx={isDesktop ? 170 : 160} gapPx={14}>
          {days.map((d) => (
            <TimeGridDay
              key={d} iso={d} label={dayLabel(d, today)} isToday={d === today}
              floatingItems={itemsByDay[d].filter((i) => i.timing?.floating !== false || !i.timing?.time)}
              timedItems={itemsByDay[d].filter((i) => i.timing?.floating === false && i.timing?.time)}
              startHour={gridPrefs.startHour} endHour={gridPrefs.endHour} pxPerHour={gridPrefs.pxPerHour}
              onToggleDone={toggleDone} onEdit={(fam, e) => setEditing({ family: fam, entity: e })}
              onSlotClick={onSlotClick}
              disciplines={activeDisciplines} onDisciplineClick={setDisciplineModal}
              onAskSecretary={onAskSecretary}
              onReschedule={rescheduleItem}
            />
          ))}
        </DayGridRow>
      ) : (
        days.map((d) => (
          <div key={d} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: d === today ? INKBLUE : INK, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
              {dayLabel(d, today)}
            </div>
            {itemsByDay[d].length === 0 ? (
              <Note>Nothing placed here.</Note>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {itemsByDay[d].map((item) => (
                  <EntityCard
                    key={item.id} family="item" entity={item} secretary={secretary}
                    onToggleDone={toggleDone} onEdit={(fam, e) => setEditing({ family: fam, entity: e })}
                    onNavigateKind={onNavigateKind}
                    onAskSecretary={onAskSecretary}
                  />
                ))}
              </div>
            )}
          </div>
        ))
      )}

      {adding && (
        <AddForm
          secretary={secretary}
          allowKinds={false}
          defaults={addDefaults}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && (
        <EditEntityModal
          family={editing.family} entity={editing.entity} secretary={secretary}
          onClose={() => setEditing(null)} onDeleted={() => setEditing(null)}
        />
      )}
      {disciplineModal && (
        <DisciplineDetailModal
          discipline={disciplineModal} secretary={secretary} onClose={() => setDisciplineModal(null)}
          onAskSecretary={onAskSecretary}
        />
      )}
    </div>
  );
}
