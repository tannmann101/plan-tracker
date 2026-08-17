import { useState } from "react";
import { Btn, SectionTitle, Note, TabBar, ExpandableRail } from "../ui";
import { MUTE, INK, MONO, INKBLUE, DOMAIN_COLORS } from "../theme";
import { useViewport } from "../useViewport";
import { EntityCard } from "../components/EntityCard";
import { TimeGridDay, TimeRangeControl, DayGridRow, useTimeGridPrefs } from "../components/TimeGrid";
import AddForm from "../components/AddForm";
import EditEntityModal from "../components/EditEntityModal";
import DisciplineDetailModal from "../components/DisciplineDetailModal";
import CalendarMonthView from "../components/CalendarMonthView";
import { BarChart, DetailList } from "../components/charts";
import { weekStartISO, addDaysISO, domainLabel } from "../constants";

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
// Items-only).
export default function ThisWeek({ secretary, onBack, onNavigateKind, onNavigate }) {
  const { isDesktop } = useViewport();
  const [view, setView] = useState("week");
  const [layout, setLayout] = useState("blocked");
  const [gridPrefs, setGridPrefs] = useTimeGridPrefs();
  const [weekStart, setWeekStart] = useState(() => weekStartISO());
  const [adding, setAdding] = useState(false);
  const [addDefaults, setAddDefaults] = useState(null);
  const [editing, setEditing] = useState(null);
  const [disciplineModal, setDisciplineModal] = useState(null);
  const [expandedDomain, setExpandedDomain] = useState(null);

  const activeDisciplines = (secretary.disciplines || []).filter((d) => d.focused && !d.resolved);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const weekEnd = weekDays[6];

  const weekItems = (secretary.items || []).filter((i) => i.timing?.targetDay && weekDays.includes(i.timing.targetDay));
  const byDay = Object.fromEntries(weekDays.map((d) => [d, weekItems
    .filter((i) => i.timing.targetDay === d)
    .sort((a, b) => (a.timing.floating === false ? 0 : 1) - (b.timing.floating === false ? 0 : 1) || (a.timing.time || "").localeCompare(b.timing.time || ""))]));

  const toggleDone = (entity, next) => secretary.saveEntity("item", {
    ...entity, done: next, completedAt: next ? Date.now() : null,
    ...(entity.isRecurringPracticeItem ? { progressAmount: next ? (entity.progressAmount || 1) : 0 } : {}),
  });
  const openEdit = (fam, e) => setEditing({ family: fam, entity: e });
  const openAdd = (defaults) => { setAddDefaults(defaults); setAdding(true); };
  const onSlotClick = (iso, hour) => openAdd({ targetDay: iso, time: `${String(hour).padStart(2, "0")}:00` });

  const domainBuckets = {};
  for (const i of weekItems) (domainBuckets[i.domain] ||= []).push(i);
  const domainRows = Object.entries(domainBuckets)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([id, list]) => ({
      id, label: domainLabel(id, secretary.domains), count: list.length, color: DOMAIN_COLORS[id] || MUTE,
      entities: list.map((entity) => ({ family: "item", entity })),
    }));
  const expandedRow = domainRows.find((r) => r.id === expandedDomain);

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

      <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: isDesktop ? "3 1 560px" : "3 1 500px", minWidth: 280 }}>
          {view === "week" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Btn small onClick={() => setWeekStart(addDaysISO(weekStart, -7))} color={MUTE}>← Prev week</Btn>
                <Btn small onClick={() => setWeekStart(weekStartISO())} color={MUTE}>This week</Btn>
                <Btn small onClick={() => setWeekStart(addDaysISO(weekStart, 7))} color={MUTE}>Next week →</Btn>
              </div>
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
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </DayGridRow>
              )}
            </>
          ) : (
            <CalendarMonthView secretary={secretary} onNavigateKind={onNavigateKind} />
          )}
        </div>

        {view === "week" && (
          <div style={isDesktop ? { flex: "0 1 360px", minWidth: 300, maxWidth: 400 } : { flex: "1 1 260px", minWidth: 260 }}>
            <ExpandableRail title="Domain distribution, this week -- click a bar to see what's in it">
              {domainRows.length === 0 ? <Note>Nothing placed this week yet.</Note> : (
                <>
                  <BarChart rows={domainRows} onBarClick={(id) => setExpandedDomain(expandedDomain === id ? null : id)} activeId={expandedDomain} />
                  {expandedRow && <DetailList items={expandedRow.entities} onOpen={openEdit} />}
                </>
              )}
            </ExpandableRail>
          </div>
        )}
      </div>

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
        <DisciplineDetailModal discipline={disciplineModal} secretary={secretary} onClose={() => setDisciplineModal(null)} />
      )}
    </div>
  );
}
