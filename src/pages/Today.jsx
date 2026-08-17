import { useState } from "react";
import { Btn, SectionTitle, Note, Pill, ProgressBar, ExpandableRail, TabBar } from "../ui";
import { MONO, SANS, INK, MUTE, INKBLUE, DOMAIN_COLORS, softTint } from "../theme";
import { useViewport } from "../useViewport";
import { EntityCard } from "../components/EntityCard";
import { TimeGridDay, TimeRangeControl, DayGridRow, useTimeGridPrefs } from "../components/TimeGrid";
import AddForm from "../components/AddForm";
import EditEntityModal from "../components/EditEntityModal";
import DisciplineDetailModal from "../components/DisciplineDetailModal";
import { todayISO, addDaysISO } from "../constants";
import { kindProgress, rootKinds } from "../lib/graph";

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

// §6 -- Items-only Add (a Kind add belongs on Plans/Workspace, not here), a
// 4-day strip rather than just today, and a right rail carrying Goal
// progress + a "where's this landing" resource tally for what's visible.
export default function Today({ secretary, onBack, onNavigateKind }) {
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

  const toggleDone = (entity, next) => secretary.saveEntity("item", {
    ...entity, done: next, completedAt: next ? Date.now() : null,
    ...(entity.isRecurringPracticeItem ? { progressAmount: next ? (entity.progressAmount || 1) : 0 } : {}),
  });

  const openAdd = (defaults) => { setAddDefaults(defaults); setAdding(true); };
  const onSlotClick = (iso, hour) => openAdd({ targetDay: iso, time: `${String(hour).padStart(2, "0")}:00` });

  const goals = rootKinds(secretary.kinds).filter((k) => k.kindType === "goal" && k.status !== "done");

  const resourceTally = {};
  for (const i of items) for (const r of i.resources || []) resourceTally[r] = (resourceTally[r] || 0) + 1;
  const resourceRows = Object.entries(resourceTally).sort((a, b) => b[1] - a[1]);

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

      <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: isDesktop ? "3 1 480px" : "2 1 420px", minWidth: 280 }}>
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
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div style={isDesktop ? { flex: "0 1 360px", minWidth: 300, maxWidth: 400 } : { flex: "1 1 260px", minWidth: 260 }}>
          <ExpandableRail title="Goal progress -- click one to open it">
            {goals.length === 0 ? (
              <Note>No open Goals yet.</Note>
            ) : goals.map((g) => {
              const progress = kindProgress(g.id, secretary);
              return (
                <button
                  key={g.id} type="button" onClick={() => setEditing({ family: "kind", entity: g })}
                  style={{ display: "block", width: "100%", border: "none", background: "none", padding: 0, marginBottom: 16, textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ fontFamily: SANS, fontSize: 13.5, color: INK, fontWeight: 500 }}>{g.title}</div>
                  <ProgressBar percent={progress.percent} color={DOMAIN_COLORS[g.domain] || INKBLUE} />
                  <div style={{ fontFamily: MONO, fontSize: 10, color: MUTE, marginTop: 3 }}>{progress.done}/{progress.total} Items done</div>
                </button>
              );
            })}
          </ExpandableRail>

          <div style={{ marginTop: 22 }}>
            <ExpandableRail title="Where this is landing">
              {resourceRows.length === 0 ? (
                <Note>Nothing tagged with a resource this stretch.</Note>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {resourceRows.map(([r, count]) => (
                    <Pill key={r} color={MUTE} tint={softTint(MUTE)}>{r} · {count}</Pill>
                  ))}
                </div>
              )}
            </ExpandableRail>
          </div>
        </div>
      </div>

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
        <DisciplineDetailModal discipline={disciplineModal} secretary={secretary} onClose={() => setDisciplineModal(null)} />
      )}
    </div>
  );
}
