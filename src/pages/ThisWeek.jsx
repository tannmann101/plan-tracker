import { useState } from "react";
import { Btn, SectionTitle, Note, TabBar } from "../ui";
import { MUTE, INK, MONO, INKBLUE, DOMAIN_COLORS } from "../theme";
import { EntityCard } from "../components/EntityCard";
import AddForm from "../components/AddForm";
import EditEntityModal from "../components/EditEntityModal";
import CalendarMonthView from "../components/CalendarMonthView";
import { HorizontalBarChart } from "../components/charts";
import { weekStartISO, domainLabel } from "../constants";

const VIEW_TABS = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// §7 -- Week/Month toggle, indefinite forward/back navigation in both
// modes, a Monday-start week grid distinguishing floating from timed
// Items, and full Kind-or-Item Add (unlike Today, this page isn't
// Items-only).
export default function ThisWeek({ secretary, onBack, onNavigateKind, onNavigate }) {
  const [view, setView] = useState("week");
  const [weekStart, setWeekStart] = useState(() => weekStartISO());
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const weekEnd = weekDays[6];

  const weekItems = (secretary.items || []).filter((i) => i.timing?.targetDay && weekDays.includes(i.timing.targetDay));
  const byDay = Object.fromEntries(weekDays.map((d) => [d, weekItems
    .filter((i) => i.timing.targetDay === d)
    .sort((a, b) => (a.timing.floating === false ? 0 : 1) - (b.timing.floating === false ? 0 : 1) || (a.timing.time || "").localeCompare(b.timing.time || ""))]));

  const toggleDone = (entity, next) => secretary.saveEntity("item", { ...entity, done: next, completedAt: next ? Date.now() : null });
  const openEdit = (fam, e) => setEditing({ family: fam, entity: e });

  const domainCounts = {};
  for (const i of weekItems) domainCounts[i.domain] = (domainCounts[i.domain] || 0) + 1;
  const domainRows = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ label: domainLabel(id, secretary.domains), count, color: DOMAIN_COLORS[id] || MUTE }));

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Back</Btn>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <SectionTitle note={view === "week" ? `${weekStart} → ${weekEnd}` : undefined}>Week / Calendar</SectionTitle>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
          <TabBar tabs={VIEW_TABS} active={view} onChange={setView} />
          <Btn small primary color={INKBLUE} onClick={() => setAdding(true)}>+ Add</Btn>
        </div>
      </div>

      <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "3 1 500px", minWidth: 280 }}>
          {view === "week" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Btn small onClick={() => setWeekStart(addDaysISO(weekStart, -7))} color={MUTE}>← Prev week</Btn>
                <Btn small onClick={() => setWeekStart(weekStartISO())} color={MUTE}>This week</Btn>
                <Btn small onClick={() => setWeekStart(addDaysISO(weekStart, 7))} color={MUTE}>Next week →</Btn>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
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
              </div>
            </>
          ) : (
            <CalendarMonthView secretary={secretary} onNavigateKind={onNavigateKind} />
          )}
        </div>

        {view === "week" && (
          <div style={{ flex: "1 1 220px", minWidth: 220 }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Domain distribution, this week</div>
            {domainRows.length === 0 ? <Note>Nothing placed this week yet.</Note> : <HorizontalBarChart rows={domainRows} />}
          </div>
        )}
      </div>

      {adding && (
        <AddForm secretary={secretary} defaults={{ targetDay: weekStart }} onClose={() => setAdding(false)} onNavigate={onNavigate} />
      )}
      {editing && (
        <EditEntityModal
          family={editing.family} entity={editing.entity} secretary={secretary}
          onClose={() => setEditing(null)} onDeleted={() => setEditing(null)}
        />
      )}
    </div>
  );
}
