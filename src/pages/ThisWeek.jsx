import { useState } from "react";
import { Btn, SectionTitle, Note, TabBar } from "../ui";
import { MUTE, INK, MONO, INKBLUE } from "../theme";
import { useViewport } from "../useViewport";
import { EntityCard } from "../components/EntityCard";
import { TimeGridDay, TimeRangeControl, DayGridRow, useTimeGridPrefs } from "../components/TimeGrid";
import AddForm from "../components/AddForm";
import EditEntityModal from "../components/EditEntityModal";
import DisciplineDetailModal from "../components/DisciplineDetailModal";
import CalendarMonthView from "../components/CalendarMonthView";
import { weekStartISO, addDaysISO, todayISO } from "../constants";
import { dayScheduleLoad } from "../lib/graph";

const VIEW_TABS = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const LAYOUT_TABS = [
  { id: "blocked", label: "Time-blocked" },
  { id: "list", label: "List" },
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// §7 -- Week/Month toggle, indefinite forward/back navigation in both
// modes, a Monday-start week grid distinguishing floating from timed
// Items, and full Kind-or-Item Add (unlike Today, this page isn't
// Items-only). The Domain Distribution rail that used to live here is
// gone -- it was a smaller, cropped copy of the same view Workspace's
// gallery now shows properly (full width, with real drilldown); this page
// stays the week's own schedule.
export default function ThisWeek({ secretary, onBack, onNavigateKind, onNavigate, onAskSecretary }) {
  const { isDesktop } = useViewport();
  const [view, setView] = useState("week");
  const [layout, setLayout] = useState("blocked");
  const [gridPrefs, setGridPrefs] = useTimeGridPrefs();
  const [weekStart, setWeekStart] = useState(() => weekStartISO());
  const [adding, setAdding] = useState(false);
  const [addDefaults, setAddDefaults] = useState(null);
  const [editing, setEditing] = useState(null);
  const [disciplineModal, setDisciplineModal] = useState(null);

  const activeDisciplines = (secretary.disciplines || []).filter((d) => d.focused && !d.resolved);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const weekEnd = weekDays[6];

  const weekItems = (secretary.items || []).filter((i) => i.timing?.targetDay && weekDays.includes(i.timing.targetDay));
  const byDay = Object.fromEntries(weekDays.map((d) => [d, weekItems
    .filter((i) => i.timing.targetDay === d)
    .sort((a, b) => (a.timing.floating === false ? 0 : 1) - (b.timing.floating === false ? 0 : 1) || (a.timing.time || "").localeCompare(b.timing.time || ""))]));

  // "Proactively flagging an empty week/overloaded day" -- computed
  // straight from this week's own Items, no chat round-trip needed. Only
  // days from today onward are actionable (an empty day that's already
  // past isn't a gap to fill), same guard TimeGridDay's own per-day badge
  // uses.
  const today = todayISO();
  const scheduleNotes = weekDays.map((d, i) => ({ d, i })).filter(({ d }) => d >= today).map(({ d, i }) => {
    const floating = byDay[d].filter((it) => it.timing?.floating !== false || !it.timing?.time);
    const timed = byDay[d].filter((it) => it.timing?.floating === false && it.timing?.time);
    return { day: d, label: `${WEEKDAY_LABELS[i]} ${d.slice(5)}`, load: dayScheduleLoad(floating, timed, gridPrefs.startHour, gridPrefs.endHour) };
  });
  const emptyDays = scheduleNotes.filter((s) => s.load.isEmpty);
  const overloadedDays = scheduleNotes.filter((s) => s.load.isOverloaded);

  const toggleDone = (entity, next) => secretary.saveEntity("item", {
    ...entity, done: next, completedAt: next ? Date.now() : null,
    ...(entity.isRecurringPracticeItem ? { progressAmount: next ? (entity.progressAmount || 1) : 0 } : {}),
  });
  const openEdit = (fam, e) => setEditing({ family: fam, entity: e });
  const openAdd = (defaults) => { setAddDefaults(defaults); setAdding(true); };
  const onSlotClick = (iso, hour) => openAdd({ targetDay: iso, time: `${String(hour).padStart(2, "0")}:00` });

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Back</Btn>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <SectionTitle note={view === "week" ? `${weekStart} → ${weekEnd}` : undefined}>Week / Calendar</SectionTitle>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
          <TabBar tabs={VIEW_TABS} active={view} onChange={setView} />
          {view === "week" && <TabBar tabs={LAYOUT_TABS} active={layout} onChange={setLayout} />}
          {view === "week" && layout === "blocked" && <TimeRangeControl prefs={gridPrefs} onChange={setGridPrefs} />}
          <Btn small primary color={INKBLUE} onClick={() => openAdd({ targetDay: weekStart })}>+ Add</Btn>
        </div>
      </div>

      {view === "week" ? (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Btn small onClick={() => setWeekStart(addDaysISO(weekStart, -7))} color={MUTE}>← Prev week</Btn>
            <Btn small onClick={() => setWeekStart(weekStartISO())} color={MUTE}>This week</Btn>
            <Btn small onClick={() => setWeekStart(addDaysISO(weekStart, 7))} color={MUTE}>Next week →</Btn>
          </div>
          {(emptyDays.length > 0 || overloadedDays.length > 0) && (
            <Note>
              {emptyDays.length > 0 && `${emptyDays.length} day${emptyDays.length === 1 ? "" : "s"} this week ${emptyDays.length === 1 ? "has" : "have"} nothing scheduled yet (${emptyDays.map((d) => d.label).join(", ")}).`}
              {emptyDays.length > 0 && overloadedDays.length > 0 && " "}
              {overloadedDays.length > 0 && `${overloadedDays.map((d) => d.label).join(", ")} ${overloadedDays.length === 1 ? "is" : "are"} booked solid.`}
            </Note>
          )}
          {layout === "blocked" ? (
            <DayGridRow count={weekDays.length} minColPx={isDesktop ? 155 : 140} gapPx={10}>
              {weekDays.map((d, i) => (
                <TimeGridDay
                  key={d} iso={d} label={`${WEEKDAY_LABELS[i]} ${d.slice(5)}`} isToday={false}
                  floatingItems={byDay[d].filter((i) => i.timing?.floating !== false || !i.timing?.time)}
                  timedItems={byDay[d].filter((i) => i.timing?.floating === false && i.timing?.time)}
                  startHour={gridPrefs.startHour} endHour={gridPrefs.endHour} pxPerHour={gridPrefs.pxPerHour}
                  onToggleDone={toggleDone} onEdit={openEdit} onSlotClick={onSlotClick}
                  disciplines={activeDisciplines} onDisciplineClick={setDisciplineModal}
                  onAskSecretary={onAskSecretary}
                />
              ))}
            </DayGridRow>
          ) : (
            <DayGridRow count={weekDays.length} minColPx={isDesktop ? 165 : 150} gapPx={12}>
              {weekDays.map((d, i) => (
                <div key={d}>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: INK, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    {WEEKDAY_LABELS[i]} <span style={{ color: MUTE, fontWeight: 400 }}>{d.slice(5)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {byDay[d].length === 0 ? (
                      <Note>—</Note>
                    ) : byDay[d].map((item) => (
                      <EntityCard
                        key={item.id} family="item" entity={item} secretary={secretary}
                        onToggleDone={toggleDone} onEdit={openEdit} onNavigateKind={onNavigateKind}
                        onAskSecretary={onAskSecretary}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </DayGridRow>
          )}
        </>
      ) : (
        <CalendarMonthView secretary={secretary} onNavigateKind={onNavigateKind} onAskSecretary={onAskSecretary} />
      )}

      {adding && (
        <AddForm secretary={secretary} defaults={addDefaults || { targetDay: weekStart }} onClose={() => setAdding(false)} onNavigate={onNavigate} />
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
