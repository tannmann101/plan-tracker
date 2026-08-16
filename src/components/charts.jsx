// charts.jsx
// Minimal hand-rolled SVG chart primitives for Trends -- no charting
// library dependency (matches this app and its siblings' minimal-dependency
// approach). Mark specs (bar thickness/rounding, gaps, hairline gridlines,
// sparing labels, legend for 2+ series, text never wearing the data color)
// follow the dataviz skill's method; native <title> elements provide a
// baseline hover tooltip rather than a full custom tooltip layer, kept
// deliberately light given how many other surfaces this release touches.

import { MONO, SANS, INK, MUTE, LINE, INKBLUE } from "../theme";
import { todayISO } from "../constants";

const NUM = (n) => n.toLocaleString();
const DAY = 24 * 60 * 60 * 1000;

// Picks a clean-ish max for the y-axis (nearest round step above the data max).
function niceMax(max) {
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
export function WeeklyBarChart({ data, series, height = 160 }) {
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
            <text x={padL - 6} y={y + 3} textAnchor="end" fontFamily={MONO} fontSize={9} fill={MUTE}>{NUM(Math.round(max * frac))}</text>
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
        return (
          <g key={d.week}>
            {segments.map((seg, si) => seg.h > 0 && (
              <rect
                key={seg.key} x={seg.x} y={seg.y} width={barW} height={Math.max(seg.h, 1)}
                fill={seg.color} rx={si === segments.length - 1 ? 3 : 0}
              >
                <title>{`${d.week}: ${series.find((s) => s.key === seg.key)?.label} = ${seg.v}`}</title>
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

// Ranked horizontal bars -- domain distribution, tool-location usage. Label
// to the left, value at the bar's end (outside when the bar itself is too
// short to hold it comfortably).
export function HorizontalBarChart({ rows, height = 22, max: fixedMax }) {
  const max = fixedMax ?? Math.max(1, ...rows.map((r) => r.count));
  const width = 640;
  const labelW = 150;
  const barMaxW = width - labelW - 40;
  return (
    <svg viewBox={`0 0 ${width} ${rows.length * height}`} style={{ width: "100%", height: "auto" }} role="img">
      {rows.map((r, i) => {
        const w = Math.max(2, (r.count / max) * barMaxW);
        const y = i * height;
        const insideFits = w > 24;
        return (
          <g key={r.label}>
            <text x={labelW - 8} y={y + height / 2 + 4} textAnchor="end" fontFamily={MONO} fontSize={10.5} fill={INK}>{r.label}</text>
            <rect x={labelW} y={y + 4} width={w} height={height - 10} rx={3} fill={r.color}>
              <title>{`${r.label}: ${r.count}`}</title>
            </rect>
            <text
              x={labelW + (insideFits ? w - 6 : w + 6)} y={y + height / 2 + 4}
              textAnchor={insideFits ? "end" : "start"} fontFamily={MONO} fontSize={10} fontWeight={600}
              fill={insideFits ? "#fff" : INK}
            >
              {r.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// A simple single-series line for the alignment-rate-over-time panel -- 2px
// line, an 8px end marker with a surface ring, and the current value
// labeled at the line's end only.
export function LineChart({ points, color, height = 140, yMax = 100, yUnit = "%" }) {
  const width = 640;
  const padL = 34, padB = 20, padT = 14;
  const plotW = width - padL - 30;
  const plotH = height - padB - padT;
  const valid = points.filter((p) => p.y !== null);
  if (valid.length === 0) {
    return <p style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE }}>Not enough completed work yet to chart this.</p>;
  }
  const stepX = plotW / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => ({
    x: padL + i * stepX,
    y: p.y === null ? null : padT + plotH * (1 - p.y / yMax),
    ...p,
  }));
  const pathCoords = coords.filter((c) => c.y !== null);
  const path = pathCoords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const last = pathCoords[pathCoords.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }} role="img">
      {[0, 0.5, 1].map((frac) => {
        const y = padT + plotH * (1 - frac);
        return (
          <g key={frac}>
            <line x1={padL} x2={width} y1={y} y2={y} stroke={LINE} strokeWidth={1} />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontFamily={MONO} fontSize={9} fill={MUTE}>{Math.round(yMax * frac)}{yUnit}</text>
          </g>
        );
      })}
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pathCoords.map((c) => (
        <circle key={c.week} cx={c.x} cy={c.y} r={c.week === last.week ? 4 : 2.5} fill={color} stroke="#fff" strokeWidth={2}>
          <title>{`${c.week}: ${c.y}${yUnit} (${c.total} completed)`}</title>
        </circle>
      ))}
      {last && (
        <text x={last.x + 6} y={last.y + 3} fontFamily={MONO} fontSize={11} fontWeight={600} fill={INK}>{last.y}{yUnit}</text>
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
