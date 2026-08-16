import { MONO, SANS, INK, MUTE, MUTE_SOFT, LINE, INKBLUE, BRICK, DOMAIN_COLORS, softTint } from "../theme";
import { Checkbox } from "../ui";

const PX_PER_HOUR = 52;
const MIN_BLOCK_PX = 20;

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

// One day's column: a floating-items strip on top, then the hour grid with
// timed Items positioned/sized by time+duration. Shared by Today (a single
// column) and Week (seven), so the actual "time blocking" behavior --
// placement, overlap warnings, click-an-empty-slot-to-add -- exists once.
export function TimeGridDay({
  iso, label, isToday, floatingItems, timedItems, startHour, endHour,
  onToggleDone, onEdit, onSlotClick,
}) {
  const gridHeight = (endHour - startHour) * PX_PER_HOUR;
  const laid = layoutTimedItems(timedItems);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: isToday ? INKBLUE : INK, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
        {label}
      </div>

      {floatingItems.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {floatingItems.map((item) => (
            <FloatingChip key={item.id} item={item} onToggleDone={onToggleDone} onEdit={onEdit} />
          ))}
        </div>
      )}

      <div style={{ position: "relative", height: gridHeight, border: `1px solid ${LINE}`, borderRadius: 6, overflow: "hidden" }}>
        {hours.map((h, i) => (
          <div
            key={h}
            onClick={onSlotClick ? () => onSlotClick(iso, h) : undefined}
            style={{
              position: "absolute", left: 0, right: 0, top: i * PX_PER_HOUR, height: PX_PER_HOUR,
              borderTop: i === 0 ? "none" : `1px solid ${LINE}`, cursor: onSlotClick ? "pointer" : "default",
            }}
          >
            <span style={{ position: "absolute", left: 3, top: 2, fontFamily: MONO, fontSize: 8.5, color: MUTE_SOFT, pointerEvents: "none" }}>
              {minutesLabel(h * 60)}
            </span>
          </div>
        ))}

        {laid.map(({ item, start, end, column, columns, overlapping }) => {
          const top = Math.max(0, (start - startHour * 60) / 60) * PX_PER_HOUR;
          const height = Math.max(MIN_BLOCK_PX, ((end - start) / 60) * PX_PER_HOUR);
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
                borderRadius: 4, padding: "2px 5px", overflow: "hidden", cursor: "pointer",
              }}
            >
              <div style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, color: INK, lineHeight: 1.25, textDecoration: item.done ? "line-through" : "none" }}>
                {item.title}
              </div>
              {overlapping && <div style={{ fontFamily: MONO, fontSize: 9, color: BRICK, fontWeight: 600 }}>⚠ overlap</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FloatingChip({ item, onToggleDone, onEdit }) {
  const domainColor = DOMAIN_COLORS[item.domain] || MUTE;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: softTint(domainColor), border: `1px solid ${domainColor}55`, borderRadius: 6, padding: "3px 6px" }}>
      {onToggleDone && <Checkbox checked={!!item.done} onChange={(next) => onToggleDone(item, next)} color={domainColor} />}
      <span
        onClick={() => onEdit?.("item", item)}
        style={{ fontFamily: SANS, fontSize: 11, color: INK, cursor: "pointer", flex: 1, minWidth: 0, textDecoration: item.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {item.title}
      </span>
    </div>
  );
}
