// charts.jsx
// Minimal hand-rolled SVG chart primitives for Trends -- no charting
// library dependency (matches this app and its siblings' minimal-dependency
// approach). Mark specs (bar thickness/rounding, gaps, hairline gridlines,
// sparing labels, legend for 2+ series, text never wearing the data color)
// follow the dataviz skill's method; native <title> elements provide a
// baseline hover tooltip rather than a full custom tooltip layer, kept
// deliberately light given how many other surfaces this release touches.

import { MONO, SANS, INK, MUTE, MUTE_SOFT, LINE, INKBLUE, CARD, DOMAIN_COLORS, softTint } from "../theme";
import { todayISO } from "../constants";

const NUM = (n) => n.toLocaleString();
const DAY = 24 * 60 * 60 * 1000;

// Picks a clean-ish max for the y-axis (nearest round step above the data max).
export function niceMax(max) {
  if (max <= 0) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const rounded = Math.ceil(max / (step / 2)) * (step / 2);
  return rounded;
}

export function Legend({ series }) {
  if (series.length < 2) return null;
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
      {series.map((s) => (
        <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block" }} />
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// Grouped/stacked weekly bar chart -- one bar-group per week, one segment
// per series (domain), height 160px. Labels only the final week's total
// (the "current" endpoint) and the y-axis max, per the sparing-labels rule.
// onBarClick/activeId, when given, make a whole week's bar-group (every
// stacked segment together) a control for revealing that week's actual
// entities via DetailList, same contract as BarChart's.
export function WeeklyBarChart({ data, series, height = 160, onBarClick, activeId }) {
  const width = 640;
  const padL = 34, padB = 20, padT = 10;
  const plotW = width - padL - 8;
  const plotH = height - padB - padT;
  const max = niceMax(Math.max(1, ...data.map((d) => series.reduce((sum, s) => sum + (d[s.key] || 0), 0))));
  const bandW = plotW / data.length;
  const barW = Math.min(24, bandW - 4);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }} role="img">
      {[0, 0.5, 1].map((frac) => {
        const y = padT + plotH * (1 - frac);
        return (
          <g key={frac}>
            <line x1={padL} x2={width} y1={y} y2={y} stroke={LINE} strokeWidth={1} />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontFamily={MONO} fontSize={9} fill={MUTE}>{NUM(Math.round(max * frac * 10) / 10)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = padL + i * bandW + (bandW - barW) / 2;
        let yCursor = padT + plotH;
        const total = series.reduce((sum, s) => sum + (d[s.key] || 0), 0);
        const segments = series.map((s) => {
          const v = d[s.key] || 0;
          const h = (v / max) * plotH;
          const y = yCursor - h;
          yCursor -= h + (v > 0 ? 1 : 0); // 1px surface gap between stacked segments
          return { key: s.key, color: s.color, x, y, h, v };
        });
        const isLast = i === data.length - 1;
        const dimmed = activeId && activeId !== d.week;
        return (
          <g
            key={d.week}
            onClick={onBarClick ? () => onBarClick(d.week) : undefined}
            style={{ cursor: onBarClick ? "pointer" : "default" }}
            opacity={dimmed ? 0.4 : 1}
          >
            {segments.map((seg, si) => seg.h > 0 && (
              <rect
                key={seg.key} x={seg.x} y={seg.y} width={barW} height={Math.max(seg.h, 1)}
                fill={seg.color} rx={si === segments.length - 1 ? 3 : 0}
              >
                <title>{onBarClick ? `${d.week}: ${total} -- click to see what's counted` : `${d.week}: ${series.find((s) => s.key === seg.key)?.label} = ${seg.v}`}</title>
              </rect>
            ))}
            {isLast && total > 0 && (
              <text x={x + barW / 2} y={padT + plotH - segments.reduce((a, s) => a + s.h, 0) - 5} textAnchor="middle" fontFamily={MONO} fontSize={10} fontWeight={600} fill={INK}>
                {total}
              </text>
            )}
            {i % Math.ceil(data.length / 8 || 1) === 0 && (
              <text x={x + barW / 2} y={height - 4} textAnchor="middle" fontFamily={MONO} fontSize={8.5} fill={MUTE}>
                {d.week.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Ranked vertical bars -- domain distribution, resource usage, goal
// progress. Category along the x-axis, value as bar height, gridlines at
// 0/50%/100% of the max like every other chart here. A sparing value label
// sits above each bar; the category label below is truncated to keep long
// domain/resource/goal names from colliding, with the full text always in
// the native <title> tooltip.
// onBarClick/activeId are optional -- when given, a bar becomes an
// alternate control for whatever filter/drilldown the page wires up
// (Workspace's Domain distribution sets a page filter; Trends' panels open
// a DetailList of the actual entities the bar is counting), dimming every
// bar but the active one so the chart itself reads as a live control
// state, not just a static picture. Omitting them leaves it purely
// informational.
export function BarChart({ rows, height = 200, max: fixedMax, onBarClick, activeId }) {
  const width = 640;
  const padL = 34, padR = 10, padT = 22, padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const max = fixedMax ?? niceMax(Math.max(1, ...rows.map((r) => r.count)));
  const bandW = plotW / rows.length;
  const barW = Math.min(42, bandW - 10);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }} role="img">
      {[0, 0.5, 1].map((frac) => {
        const y = padT + plotH * (1 - frac);
        return (
          <g key={frac}>
            <line x1={padL} x2={width - padR} y1={y} y2={y} stroke={LINE} strokeWidth={1} />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontFamily={MONO} fontSize={9} fill={MUTE}>{NUM(Math.round(max * frac))}</text>
          </g>
        );
      })}
      {rows.map((r, i) => {
        const h = Math.max(2, (r.count / max) * plotH);
        const x = padL + i * bandW + (bandW - barW) / 2;
        const y = padT + plotH - h;
        const dimmed = activeId && r.id != null && activeId !== r.id;
        const label = r.label.length > 12 ? `${r.label.slice(0, 11)}…` : r.label;
        return (
          <g
            key={r.label}
            onClick={onBarClick && r.id != null ? () => onBarClick(r.id) : undefined}
            style={{ cursor: onBarClick && r.id != null ? "pointer" : "default" }}
            opacity={dimmed ? 0.4 : 1}
          >
            <rect x={x} y={y} width={barW} height={h} rx={3} fill={r.color}>
              <title>{onBarClick ? `${r.label}: ${r.count} -- click to see what's counted` : `${r.label}: ${r.count}`}</title>
            </rect>
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontFamily={MONO} fontSize={10} fontWeight={600} fill={INK}>{r.count}</text>
            <text x={x + barW / 2} y={height - padB + 14} textAnchor="middle" fontFamily={MONO} fontSize={9} fill={MUTE}>{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// The actual entities behind a chart value, as a compact clickable list --
// the answer to "what is this number actually counting." Each row opens
// straight into the page's own edit modal (onOpen(family, entity)) rather
// than making the household leave the chart to go find it. Shared by every
// drilldown-capable chart below (BarChart bars, WeeklyBarChart bars,
// Heatmap cells, SegmentBars segments, StatusMeters stages) so there's one
// implementation of "show me what's in this bucket," not five.
export function DetailList({ items, onOpen, emptyLabel = "Nothing in this bucket." }) {
  if (!items || items.length === 0) return <p style={{ fontFamily: MONO, fontSize: 11, color: MUTE, margin: "8px 0 0" }}>{emptyLabel}</p>;
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 2, marginTop: 8, maxHeight: 240, overflowY: "auto",
      border: `1px solid ${LINE}`, borderRadius: 8, padding: 4,
    }}>
      {items.map(({ family, entity }) => (
        <button
          key={`${family}-${entity.id}`}
          type="button"
          onClick={() => onOpen(family, entity)}
          className="ui-detail-row"
          style={{
            display: "flex", alignItems: "center", gap: 8, border: "none", background: "none",
            textAlign: "left", cursor: "pointer", padding: "6px 7px", borderRadius: 6,
            fontFamily: SANS, fontSize: 12, color: INK,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: DOMAIN_COLORS[entity.domain] || MUTE, flex: "none" }} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entity.title}</span>
          <span style={{ fontFamily: MONO, fontSize: 9.5, color: MUTE, flex: "none" }}>{family}</span>
        </button>
      ))}
    </div>
  );
}

// A simple single-series line for the alignment-rate-over-time panel -- 2px
// line, an 8px end marker with a surface ring, and the current value
// labeled at the line's end only.
export function LineChart({ points, color, height = 140, yMax = 100, yUnit = "%" }) {
  const width = 640;
  // padR reserves room for the end-label text itself (up to ~6 chars at
  // this font/size, e.g. "100.0%") -- past experience: too small a margin
  // here lets the label overflow the viewBox, and a root <svg> clips
  // overflow by default, so the last character or two silently vanishes.
  const padL = 34, padB = 20, padT = 14, padR = 46;
  const plotW = width - padL - padR;
  const plotH = height - padB - padT;
  const valid = points.filter((p) => p.y !== null);
  if (valid.length === 0) {
    return <p style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE }}>Not enough data yet to chart this.</p>;
  }
  const stepX = plotW / Math.max(1, points.length - 1);
  // Pixel coordinates get their own field names (px/py) rather than x/y --
  // points already carry their own data "y" (the value being plotted), and
  // a computed field of the same name spread in the wrong order previously
  // clobbered it silently (see git history). Keeping them distinct means
  // there's no ordering to get wrong and c.y always still means the value.
  const coords = points.map((p, i) => ({
    ...p,
    px: padL + i * stepX,
    py: p.y === null ? null : padT + plotH * (1 - p.y / yMax),
  }));
  const pathCoords = coords.filter((c) => c.py !== null);
  const path = pathCoords.map((c, i) => `${i === 0 ? "M" : "L"}${c.px},${c.py}`).join(" ");
  const last = pathCoords[pathCoords.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }} role="img">
      {[0, 0.5, 1].map((frac) => {
        const y = padT + plotH * (1 - frac);
        return (
          <g key={frac}>
            <line x1={padL} x2={width} y1={y} y2={y} stroke={LINE} strokeWidth={1} />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontFamily={MONO} fontSize={9} fill={MUTE}>{Math.round(yMax * frac * 10) / 10}{yUnit}</text>
          </g>
        );
      })}
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pathCoords.map((c) => (
        <circle key={c.week} cx={c.px} cy={c.py} r={c.week === last.week ? 4 : 2.5} fill={color} stroke={CARD} strokeWidth={2}>
          <title>{`${c.week}: ${c.y}${yUnit}${c.note ? ` (${c.note})` : ""}`}</title>
        </circle>
      ))}
      {last && (
        <text x={last.px + 8} y={last.py + 3} fontFamily={MONO} fontSize={11} fontWeight={600} fill={INK}>{last.y}{yUnit}</text>
      )}
    </svg>
  );
}

// A single horizontal ruler from today out to the furthest due date among
// `rows` ({id, title, date (ISO, the due/end date), startDate (ISO,
// optional), color}) -- Plans' kanban and Workspace both reuse this
// verbatim (§9.2/§10) rather than each rolling their own. A row with a
// startDate draws as a range bar (the scheduled span for that Project/
// Goal) instead of just a point marker at its due date. Rows without a
// date are dropped; onClick, when given, makes a row tap-through to that
// Kind.
export function Timeline({ rows, onClick, height = 90 }) {
  const dated = (rows || []).filter((r) => r.date).sort((a, b) => a.date.localeCompare(b.date));
  if (dated.length === 0) {
    return <p style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE }}>Nothing with a due date to place on a timeline yet.</p>;
  }
  const width = 640;
  const padL = 14, padR = 14;
  const todayStr = todayISO();
  const allDates = [todayStr, ...dated.map((r) => r.date), ...dated.filter((r) => r.startDate).map((r) => r.startDate)].sort();
  const minD = allDates[0];
  const maxD = allDates[allDates.length - 1];
  const minT = new Date(`${minD}T00:00:00`).getTime();
  const maxT = Math.max(new Date(`${maxD}T00:00:00`).getTime(), minT + DAY);
  const x = (d) => padL + ((new Date(`${d}T00:00:00`).getTime() - minT) / (maxT - minT)) * (width - padL - padR);
  const laneY = height - 26;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }} role="img">
      <line x1={padL} x2={width - padR} y1={laneY} y2={laneY} stroke={LINE} strokeWidth={1} />
      <g>
        <line x1={x(todayStr)} x2={x(todayStr)} y1={laneY - 8} y2={laneY + 8} stroke={INK} strokeWidth={1.5} />
        <text x={x(todayStr)} y={laneY + 22} textAnchor="middle" fontFamily={MONO} fontSize={9} fill={MUTE}>today</text>
      </g>
      {dated.map((r, i) => {
        const cx = x(r.date);
        const above = i % 2 === 0;
        const hasRange = r.startDate && r.startDate < r.date;
        return (
          <g
            key={r.id}
            onClick={onClick ? () => onClick(r.id) : undefined}
            style={{ cursor: onClick ? "pointer" : "default" }}
          >
            {hasRange && (
              <rect x={x(r.startDate)} y={laneY - 3} width={Math.max(2, cx - x(r.startDate))} height={6} rx={3} fill={r.color || INKBLUE} opacity={0.35} />
            )}
            <line x1={cx} x2={cx} y1={laneY} y2={above ? laneY - 16 : laneY + 16} stroke={r.color || INKBLUE} strokeWidth={1} />
            <circle cx={cx} cy={laneY} r={4} fill={r.color || INKBLUE} />
            <text x={cx} y={above ? laneY - 20 : laneY + 28} textAnchor="middle" fontFamily={SANS} fontSize={10} fill={INK}>
              {r.title.length > 16 ? `${r.title.slice(0, 15)}…` : r.title}
            </text>
            <title>{hasRange ? `${r.title}: ${r.startDate} → ${r.date}` : `${r.title}: ${r.date}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

// A tiny de-emphasized trend line for a StatTile -- past points in the
// de-emphasis hue, only the current/last point picked out in the tile's
// own accent color, per the stat-tile figure contract (value first,
// sparkline strictly secondary).
function Sparkline({ points, color, width = 56, height = 22 }) {
  const max = Math.max(1, ...points);
  const stepX = width / Math.max(1, points.length - 1);
  const coords = points.map((v, i) => ({ x: i * stepX, y: height - 2 - (v / max) * (height - 4) }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const last = coords[coords.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ flex: "none" }} aria-hidden="true">
      <path d={path} fill="none" stroke={MUTE_SOFT} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r={2.5} fill={color} stroke={CARD} strokeWidth={1.5} />
    </svg>
  );
}

// A KPI-row entry -- label/value/optional sublabel/optional trend, the
// "stat tile" figure the dataviz skill calls for when the data's job is a
// single current headline number rather than a chart. Deliberately the
// first thing Trends shows: it still reads as intentional on day one, long
// before any panel below has enough history to plot.
// onClick is optional -- when given, the whole tile becomes a jump to
// wherever this number's detail actually lives (another panel further
// down this same page, or another page entirely), so a KPI is never a
// dead end.
export function StatTile({ label, value, sublabel, color = INKBLUE, trend, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{
        flex: "1 1 150px", minWidth: 140, padding: "13px 15px", background: CARD, border: `1px solid ${LINE}`, borderRadius: 10,
        textAlign: "left", font: "inherit", cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 10, color: MUTE, textTransform: "uppercase", letterSpacing: "0.045em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, marginTop: 5 }}>
        <div style={{ fontFamily: SANS, fontSize: 25, fontWeight: 600, color: INK, lineHeight: 1 }}>{value}</div>
        {trend && trend.length > 1 && <Sparkline points={trend} color={color} />}
      </div>
      {sublabel && <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 5 }}>{sublabel}</div>}
    </Tag>
  );
}

// A day grid per row (Practice Consistency) -- compare presence on a grid,
// one hue throughout (the row doesn't invent a gradient for a binary
// done/not-done cell): filled at full color when done, an empty outlined
// square otherwise. A slightly wider gap after every 7th cell groups the
// grid into weeks for the eye without adding gridlines.
// onCellClick(item) is optional and only ever fires for a cell that has a
// real check-in behind it (c.item) -- a blank day has nothing to drill into.
export function Heatmap({ rows, color = INKBLUE, cell = 13, gap = 3, weekGap = 5, onCellClick }) {
  if (rows.length === 0) return null;
  const days = rows[0]?.cells.length || 0;
  const labelW = 130;
  const xFor = (ci) => ci * (cell + gap) + Math.floor(ci / 7) * (weekGap - gap);
  const width = labelW + xFor(days - 1) + cell + 4;
  const rowH = cell + gap;
  const height = rows.length * rowH;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }} role="img">
      {rows.map((r, ri) => (
        <g key={r.id}>
          <text x={labelW - 10} y={ri * rowH + cell / 2 + 4} textAnchor="end" fontFamily={MONO} fontSize={10} fill={INK}>
            {r.title.length > 18 ? `${r.title.slice(0, 17)}…` : r.title}
          </text>
          {r.cells.map((c, ci) => (
            <rect
              key={c.day} x={labelW + xFor(ci)} y={ri * rowH} width={cell} height={cell} rx={3}
              fill={c.done ? color : "none"} stroke={c.done ? "none" : LINE} strokeWidth={1}
              onClick={onCellClick && c.item ? () => onCellClick(c.item) : undefined}
              style={{ cursor: onCellClick && c.item ? "pointer" : "default" }}
            >
              <title>{`${r.title} -- ${c.day}: ${c.done ? "done -- click to open" : "not done"}`}</title>
            </rect>
          ))}
        </g>
      ))}
    </svg>
  );
}

// A discipline's past+current streak lengths in order, oldest to newest --
// different information from a single "current streak" number: whether
// relapses are getting rarer, streaks getting longer. One hue throughout;
// the ongoing segment reads at full color, closed-out ones at a lighter
// tint of that same hue, so "current" is intensity, not a second color.
export function SegmentBars({ segments, color = INKBLUE, height = 56, barW = 16, gap = 5 }) {
  if (segments.length === 0) return null;
  const max = Math.max(1, ...segments.map((s) => s.days));
  const width = segments.length * (barW + gap);
  // Fixed pixel size, not width:100% -- a handful of narrow bars stretched
  // to fill a card's full width would drag height up with them (the
  // viewBox's aspect ratio is nowhere near the card's), so this renders at
  // its own natural size instead of the other charts' responsive pattern.
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      {segments.map((s, i) => {
        const h = Math.max(3, (s.days / max) * (height - 14));
        const x = i * (barW + gap);
        const y = height - 14 - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={3} fill={s.ongoing ? color : softTint(color)}>
              <title>{s.ongoing ? `Current streak: ${s.days}d` : `Past streak: ${s.days}d`}</title>
            </rect>
            <text x={x + barW / 2} y={height - 3} textAnchor="middle" fontFamily={MONO} fontSize={8.5} fill={MUTE}>{s.days}</text>
          </g>
        );
      })}
    </svg>
  );
}

// One thin single-hue meter per pipeline stage, stacked -- deliberately
// NOT one merged multi-hue bar with touching segments: STATUS_COLORS is a
// muted UI-accent set (see theme.js's own note on why) that reads fine as
// a dot beside its own label but fails a chart-grade adjacent-hue check
// (validated -- INKBLUE/SLATE sit under the normal-vision floor when
// placed edge to edge). A meter's track is a lighter step of that same
// stage's hue, so state reads without ever needing two stages' colors to
// be told apart from each other.
// onStageClick/activeStatus are optional -- a stage becomes a toggle for
// showing exactly which Kinds sit in it right now (Trends renders a
// DetailList underneath from the same stage's entities).
export function StatusMeters({ stages, onStageClick, activeStatus }) {
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {stages.map((s) => {
        const pct = Math.round((s.count / total) * 100);
        const dimmed = activeStatus && activeStatus !== s.status;
        return (
          <div
            key={s.status}
            onClick={onStageClick && s.count > 0 ? () => onStageClick(s.status) : undefined}
            style={{ cursor: onStageClick && s.count > 0 ? "pointer" : "default", opacity: dimmed ? 0.45 : 1 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10.5, color: INK, marginBottom: 4 }}>
              <span>{s.label}</span>
              <span style={{ color: MUTE }}>{s.count}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: softTint(s.color), overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: s.color }} title={`${s.label}: ${s.count} (${pct}%)${onStageClick && s.count > 0 ? " -- click to see what's in it" : ""}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
