import { useState } from "react";
import { Btn, SectionTitle, Note } from "../ui";
import { SANS, MONO, INK, MUTE, LINE, INKBLUE, INKBLUE_SOFT, CARD, HEAD_BG, RADIUS_SM } from "../theme";
import { EntityCard } from "./EntityCard";
import AddForm from "./AddForm";
import EditEntityModal from "./EditEntityModal";
import { isoDate } from "../constants";

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// Every date cell the grid needs to render a given month, including the
// leading/trailing days from adjacent months that fill out the first/last
// week rows. Monday-start, matching the Week view's own column order.
function monthGridDays(monthStart) {
  const first = new Date(monthStart);
  const gridStart = new Date(first);
  const day = first.getDay();
  gridStart.setDate(gridStart.getDate() - (day === 0 ? 6 : day - 1));
  const days = [];
  const cursor = new Date(gridStart);
  for (let i = 0; i < 42; i++) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// Month-grid calendar for Week/Calendar's Month mode (§7.3) -- indefinite
// prev/next navigation, date numbers top-left, a dot on any day carrying
// Items, tap a day to see (and add to) that day's Items. Same
// EntityCard/AddForm/EditEntityModal pieces the Week view and Today use.
export default function CalendarMonthView({ secretary, onNavigateKind, onAskSecretary }) {
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const today = isoDate(new Date());
  const days = monthGridDays(monthStart);
  const monthLabel = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const daysWithItems = new Set((secretary.items || []).map((i) => i.timing?.targetDay).filter(Boolean));

  const changeMonth = (delta) => {
    const d = new Date(monthStart);
    d.setMonth(d.getMonth() + delta);
    setMonthStart(d);
    setSelectedDay(null);
  };

  const dayItems = selectedDay ? (secretary.items || []).filter((i) => i.timing?.targetDay === selectedDay) : [];
  const toggleDone = (entity, next) => secretary.saveEntity("item", { ...entity, done: next, completedAt: next ? Date.now() : null });

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
          const iso = isoDate(d);
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
                background: isSelected ? INKBLUE_SOFT : isToday ? HEAD_BG : CARD,
                borderRadius: RADIUS_SM, cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "flex-start", justifyContent: "space-between", padding: 5, opacity: inMonth ? 1 : 0.35,
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
            <Btn small primary color={INKBLUE} onClick={() => setAdding(true)}>+ Add</Btn>
          </div>
          {dayItems.length === 0 ? (
            <Note>Nothing placed on this day yet.</Note>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {dayItems.map((item) => (
                <EntityCard
                  key={item.id} family="item" entity={item} secretary={secretary}
                  onToggleDone={toggleDone}
                  onEdit={(fam, e) => setEditing({ family: fam, entity: e })}
                  onNavigateKind={onNavigateKind}
                  onAskSecretary={onAskSecretary}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {adding && selectedDay && (
        <AddForm secretary={secretary} defaults={{ targetDay: selectedDay }} onClose={() => setAdding(false)} />
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
