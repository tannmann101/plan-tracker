import { useState } from "react";
import { MONO, SANS, INK, MUTE, MUTE_SOFT, LINE, INKBLUE, BRICK, MOSS, DOMAIN_COLORS, BG, RADIUS_CHIP, TINT_ALPHA, softTint } from "../theme";
import { Checkbox } from "../ui";
import { useViewport } from "../useViewport";
import { disciplineStreak, dayScheduleLoad } from "../lib/graph";
import { todayISO } from "../constants";

const MIN_BLOCK_PX = 16;

// A row of per-day columns (Today's 4-day strip, Week's 7-day grid, in
// either time-blocked or list layout) -- shared so the "never wrap a day
// onto a second row" fix only needs to exist once. Mobile keeps the
// original auto-fit behavior untouched (columns reflow onto more rows as
// they run out of width, which is fine at a single-column phone width);
// desktop instead holds a fixed column count and side-scrolls once it hits
// each column's minimum width, so every day always reads at the same
// level per the household's own note that vertical wrapping mid-week is
// disorienting.
export function DayGridRow({ count, minColPx, gapPx = 12, children }) {
  const { isDesktop } = useViewport();
  if (isDesktop) {
    return (
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${count}, minmax(${minColPx}px, 1fr))`, gap: gapPx, minWidth: count * minColPx + (count - 1) * gapPx }}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${minColPx}px, 1fr))`, gap: gapPx }}>
      {children}
    </div>
  );
}

// Range (which hours show) and zoom (how tall an hour is) are a per-person
// display preference, not household data -- kept in localStorage rather
// than Firestore, and shared between Today and Week since they're the same
// mental "how do I like my day laid out" setting. Both pages read/write
// through this one hook so they can't drift out of sync with each other.
const PREFS_KEY = "secretary.timeGridPrefs";
const DEFAULT_PREFS = { startHour: 6, endHour: 21, pxPerHour: 52 };
export const ZOOM_LEVELS = [
  { id: "compact", label: "Compact", pxPerHour: 34 },
  { id: "normal", label: "Normal", pxPerHour: 52 },
  { id: "spacious", label: "Spacious", pxPerHour: 76 },
];

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useTimeGridPrefs() {
  const [prefs, setPrefs] = useState(loadPrefs);
  const update = (patch) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* best-effort */ }
      return next;
    });
  };
  return [prefs, update];
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({ id: h, label: minutesLabelForHour(h) }));

function minutesLabelForHour(h) {
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ampm}`;
}

// The range/zoom controls themselves -- a compact row of native selects
// (start hour, end hour) plus a 3-way zoom toggle, meant to sit right next
// to the Time-blocked/List tab on Today and Week.
export function TimeRangeControl({ prefs, onChange }) {
  const setStart = (h) => onChange({ startHour: Math.min(Number(h), prefs.endHour - 1) });
  const setEnd = (h) => onChange({ endHour: Math.max(Number(h), prefs.startHour + 1) });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 11 }}>
      <select value={prefs.startHour} onChange={(e) => setStart(e.target.value)} style={selectStyle}>
        {HOUR_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <span style={{ color: MUTE }}>–</span>
      <select value={prefs.endHour} onChange={(e) => setEnd(e.target.value)} style={selectStyle}>
        {HOUR_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <div style={{ display: "inline-flex", gap: 2, marginLeft: 4 }}>
        {ZOOM_LEVELS.map((z) => (
          <button
            key={z.id} type="button" title={z.label}
            onClick={() => onChange({ pxPerHour: z.pxPerHour })}
            style={{
              border: `1px solid ${prefs.pxPerHour === z.pxPerHour ? INKBLUE : LINE}`,
              background: prefs.pxPerHour === z.pxPerHour ? INKBLUE : "transparent",
              color: prefs.pxPerHour === z.pxPerHour ? "#fff" : MUTE,
              fontFamily: MONO, fontSize: 10, padding: "3px 7px", borderRadius: 999, cursor: "pointer",
            }}
          >{z.label[0]}</button>
        ))}
      </div>
    </div>
  );
}

const selectStyle = { fontFamily: MONO, fontSize: 11, padding: "3px 5px", border: `1px solid ${LINE}`, borderRadius: RADIUS_CHIP, background: BG };

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesLabel(mins) {
  const h = Math.floor(mins / 60);
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ampm}`;
}

// Clusters a day's timed items into overlap groups via a sweep over start
// time, so genuinely overlapping blocks render side-by-side (each taking
// 1/clusterSize of the column width) rather than hiding behind each other
// -- the actual "can I see the conflict" point of time-blocking.
function layoutTimedItems(timedItems) {
  const withRange = timedItems
    .map((i) => {
      const start = timeToMinutes(i.timing.time);
      const duration = i.timing.durationMinutes || 30;
      return { item: i, start, end: start + duration };
    })
    .sort((a, b) => a.start - b.start);

  const clusters = [];
  let current = [];
  let clusterEnd = -Infinity;
  for (const entry of withRange) {
    if (current.length && entry.start >= clusterEnd) {
      clusters.push(current);
      current = [];
      clusterEnd = -Infinity;
    }
    current.push(entry);
    clusterEnd = Math.max(clusterEnd, entry.end);
  }
  if (current.length) clusters.push(current);

  const laid = [];
  for (const cluster of clusters) {
    const overlapping = cluster.length > 1;
    cluster.forEach((entry, i) => {
      laid.push({ ...entry, column: i, columns: cluster.length, overlapping });
    });
  }
  return laid;
}

// The gaps between timed Items, clipped to the grid's own [startHour,
// endHour] window -- the "actual free/busy, rendered visually" the
// household asked for, rather than only something Secretary chat can
// describe in words. Same sweep shape as layoutTimedItems above, just
// walking the complement instead of the overlaps.
function freeIntervals(timedItems, startHour, endHour) {
  const dayStart = startHour * 60, dayEnd = endHour * 60;
  const busy = timedItems
    .map((i) => {
      const start = timeToMinutes(i.timing.time);
      const duration = i.timing.durationMinutes || 30;
      return [Math.max(dayStart, start), Math.min(dayEnd, start + duration)];
    })
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);

  const free = [];
  let cursor = dayStart;
  for (const [s, e] of busy) {
    if (s > cursor) free.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < dayEnd) free.push([cursor, dayEnd]);
  return free;
}

// One day's column: a floating-items strip on top, then the hour grid with
// timed Items positioned/sized by time+duration. Shared by Today (a single
// column) and Week (seven), so the actual "time blocking" behavior --
// placement, overlap warnings, click-an-empty-slot-to-add -- exists once.
export function TimeGridDay({
  iso, label, isToday, floatingItems, timedItems, startHour, endHour, pxPerHour = 52,
  onToggleDone, onEdit, onSlotClick, disciplines = [], onDisciplineClick, onAskSecretary,
}) {
  const gridHeight = (endHour - startHour) * pxPerHour;
  const laid = layoutTimedItems(timedItems);
  const free = freeIntervals(timedItems, startHour, endHour);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const load = dayScheduleLoad(floatingItems, timedItems, startHour, endHour);
  const showEmptyBadge = load.isEmpty && iso >= todayISO();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: isToday ? INKBLUE : INK, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </div>
        {load.isOverloaded && (
          <span style={{ fontFamily: MONO, fontSize: 9.5, color: BRICK, background: softTint(BRICK), border: `1px solid ${BRICK}${TINT_ALPHA}`, borderRadius: 999, padding: "1px 6px" }}>
            booked solid
          </span>
        )}
        {!load.isOverloaded && showEmptyBadge && (
          <span style={{ fontFamily: MONO, fontSize: 9.5, color: MOSS, background: softTint(MOSS), border: `1px solid ${MOSS}${TINT_ALPHA}`, borderRadius: 999, padding: "1px 6px" }}>
            nothing scheduled
          </span>
        )}
      </div>

      {disciplines.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 4 }}>
          {disciplines.map((d) => (
            <DisciplineChip key={d.id} discipline={d} onClick={() => onDisciplineClick?.(d)} />
          ))}
        </div>
      )}

      {floatingItems.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {floatingItems.map((item) => (
            <FloatingChip key={item.id} item={item} onToggleDone={onToggleDone} onEdit={onEdit} onAskSecretary={onAskSecretary} />
          ))}
        </div>
      )}

      <div style={{ position: "relative", height: gridHeight, border: `1px solid ${LINE}`, borderRadius: RADIUS_CHIP, overflow: "hidden" }}>
        {free.filter(([s, e]) => e - s >= 20).map(([s, e]) => (
          <div
            key={`free-${s}`}
            style={{
              position: "absolute", left: 0, right: 0, pointerEvents: "none",
              top: ((s - startHour * 60) / 60) * pxPerHour, height: ((e - s) / 60) * pxPerHour,
              background: softTint(MOSS), opacity: 0.35,
            }}
          />
        ))}

        {hours.map((h, i) => (
          <div
            key={h}
            onClick={onSlotClick ? () => onSlotClick(iso, h) : undefined}
            style={{
              position: "absolute", left: 0, right: 0, top: i * pxPerHour, height: pxPerHour,
              borderTop: i === 0 ? "none" : `1px solid ${LINE}`, cursor: onSlotClick ? "pointer" : "default",
            }}
          >
            <span style={{ position: "absolute", left: 3, top: 2, fontFamily: MONO, fontSize: 8.5, color: MUTE_SOFT, pointerEvents: "none" }}>
              {minutesLabel(h * 60)}
            </span>
          </div>
        ))}

        {laid.map(({ item, start, end, column, columns, overlapping }) => {
          const top = Math.max(0, (start - startHour * 60) / 60) * pxPerHour;
          const height = Math.max(MIN_BLOCK_PX, ((end - start) / 60) * pxPerHour);
          const widthPct = 100 / columns;
          const domainColor = DOMAIN_COLORS[item.domain] || INKBLUE;
          const color = overlapping ? BRICK : domainColor;
          return (
            <div
              key={item.id}
              onClick={(e) => { e.stopPropagation(); onEdit?.("item", item); }}
              title={overlapping ? "Overlaps with another Item" : item.title}
              style={{
                position: "absolute", top, height, left: `${column * widthPct}%`, width: `calc(${widthPct}% - 3px)`,
                background: softTint(color), border: `1px solid ${color}`, borderLeft: `3px solid ${color}`,
                borderRadius: RADIUS_CHIP, padding: "2px 5px", overflow: "hidden", cursor: "pointer",
              }}
            >
              <div style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, color: INK, lineHeight: 1.25, textDecoration: item.done ? "line-through" : "none" }}>
                {item.isRecurringPracticeItem && <span title="Tracked as a Practice -- same box as Plans' weekly tracker">↻ </span>}
                {item.title}
              </div>
              {overlapping && <div style={{ fontFamily: MONO, fontSize: 9, color: BRICK, fontWeight: 600 }}>⚠ overlap</div>}
              {onAskSecretary && height >= 32 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAskSecretary("item", item); }}
                  title="Ask Secretary about this"
                  style={{
                    position: "absolute", top: 1, right: 1, border: "none", background: "none", padding: 1,
                    cursor: "pointer", fontSize: 9, lineHeight: 1, color: INKBLUE, opacity: 0.75,
                  }}
                >
                  💬
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FloatingChip({ item, onToggleDone, onEdit, onAskSecretary }) {
  const domainColor = DOMAIN_COLORS[item.domain] || MUTE;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: softTint(domainColor), border: `1px solid ${domainColor}${TINT_ALPHA}`, borderRadius: RADIUS_CHIP, padding: "3px 6px" }}>
      {onToggleDone && <Checkbox checked={!!item.done} onChange={(next) => onToggleDone(item, next)} color={domainColor} />}
      <span
        onClick={() => onEdit?.("item", item)}
        style={{ fontFamily: SANS, fontSize: 11, color: INK, cursor: "pointer", flex: 1, minWidth: 0, textDecoration: item.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {item.isRecurringPracticeItem && <span title="Tracked as a Practice -- same box as Plans' weekly tracker">↻ </span>}
        {item.title}
      </span>
      {onAskSecretary && (
        <button
          type="button"
          onClick={() => onAskSecretary("item", item)}
          title="Ask Secretary about this"
          style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: 11, lineHeight: 1, flex: "none" }}
        >
          💬
        </button>
      )}
    </div>
  );
}

// A habit being eliminated, focused into the background of the day/week
// (Plans' "Habits to Break") -- BRICK-tinted rather than domain-colored so
// "resist this" reads as visually distinct from an ordinary floating Item,
// and there's no checkbox since there's nothing to complete: the streak
// counts up on its own via disciplineStreak(), reset only by a relapse
// logged from the detail modal this chip opens.
function DisciplineChip({ discipline, onClick }) {
  const { days, nextMilestone } = disciplineStreak(discipline);
  return (
    <div
      onClick={onClick}
      title={`Working to eliminate -- day ${days}${nextMilestone ? `, ${nextMilestone.days - days}d to "${nextMilestone.label}"` : ""}`}
      style={{ display: "flex", alignItems: "center", gap: 6, background: softTint(BRICK), border: `1px solid ${BRICK}${TINT_ALPHA}`, borderRadius: RADIUS_CHIP, padding: "3px 6px", cursor: "pointer" }}
    >
      <span style={{ fontFamily: SANS, fontSize: 11, color: BRICK, fontWeight: 700, flex: "none" }}>⊘</span>
      <span style={{ fontFamily: SANS, fontSize: 11, color: INK, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {discipline.title} · day {days}
      </span>
    </div>
  );
}
