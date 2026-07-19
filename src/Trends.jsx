import { useMemo, useState } from "react";
import { DOMAINS, KINDS, OPEN_STATUSES, domainLabel, isStale, todayISO } from "./constants";
import { DOMAIN_COLORS, MONO, MUTE, INK, LINE, TEAL, BRICK, HEAD_BG } from "./theme";
import { SectionTitle, Note, Card, Btn } from "./ui";

const WEEK_MS = 7 * 86400000;
const WEEKS = 12;

function weekStart(ts) {
  const d = new Date(ts);
  const diff = (d.getUTCDay() + 6) % 7; // days since Monday
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - diff);
  return d.getTime();
}

function recentWeekStarts(n) {
  const start = weekStart(Date.now());
  return Array.from({ length: n }, (_, i) => start - (n - 1 - i) * WEEK_MS);
}

const fmtWeek = (ts) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Groups events by item, oldest first -- reconstructs each item's timeline
// (creation -> ... -> first completion) to compute cycle time.
function timelinesByItem(events) {
  const byItem = new Map();
  for (const e of events) {
    if (!byItem.has(e.itemId)) byItem.set(e.itemId, []);
    byItem.get(e.itemId).push(e);
  }
  for (const list of byItem.values()) list.sort((a, b) => a.at - b.at);
  return byItem;
}

function computeStats(items, events) {
  const completedCount = events.filter((e) => e.to === "done").length;
  const droppedCount = events.filter((e) => e.to === "dropped").length;
  const openNow = items.filter((i) => OPEN_STATUSES.includes(i.status)).length;

  const cycleDays = [];
  for (const timeline of timelinesByItem(events).values()) {
    const created = timeline.find((e) => e.from === null);
    const done = timeline.find((e) => e.to === "done");
    if (created && done && done.at >= created.at) cycleDays.push((done.at - created.at) / 86400000);
  }
  const avgCycleDays = cycleDays.length ? cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length : null;

  return { completedCount, droppedCount, openNow, avgCycleDays, cycleSampleSize: cycleDays.length };
}

function weeklyCounts(events, statusTo) {
  const weeks = recentWeekStarts(WEEKS);
  const counts = new Map(weeks.map((w) => [w, 0]));
  for (const e of events) {
    if (e.to !== statusTo) continue;
    const w = weekStart(e.at);
    if (counts.has(w)) counts.set(w, counts.get(w) + 1);
  }
  return weeks.map((w) => ({ week: w, count: counts.get(w) }));
}

function domainCounts(events, statusTo) {
  const counts = new Map(DOMAINS.map((d) => [d.id, 0]));
  const cutoff = recentWeekStarts(WEEKS)[0];
  for (const e of events) {
    if (e.to !== statusTo || e.at < cutoff || !counts.has(e.domain)) continue;
    counts.set(e.domain, counts.get(e.domain) + 1);
  }
  return DOMAINS.map((d) => ({ domain: d.id, label: d.label, count: counts.get(d.id) }));
}

function StatTile({ label, value }) {
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: "10px 12px", background: "#FFF" }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: INK, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// Grouped weekly bars, completed (teal) vs dropped (brick). Hand-rolled SVG,
// same no-chart-library approach as the household ledger's Plan chart.
function WeeklyBarChart({ completedByWeek, droppedByWeek }) {
  const W = 700, H = 200, PAD_L = 10, PAD_R = 10, PAD_T = 20, PAD_B = 22;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
  const n = completedByWeek.length;
  const max = Math.max(1, ...completedByWeek.map((d) => d.count), ...droppedByWeek.map((d) => d.count));
  const slot = innerW / n;
  const barW = Math.min(16, slot * 0.32);
  const yTop = (v) => PAD_T + innerH - (v / max) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 460, display: "block" }}>
      <text x={PAD_L} y={12} fontFamily={MONO} fontSize="9.5" fill={TEAL}>■ done</text>
      <text x={PAD_L + 48} y={12} fontFamily={MONO} fontSize="9.5" fill={BRICK}>■ dropped</text>
      <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + innerH} y2={PAD_T + innerH} stroke={LINE} />
      {completedByWeek.map((d, i) => {
        const cx = PAD_L + slot * i + slot / 2;
        const dropped = droppedByWeek[i];
        return (
          <g key={d.week}>
            <rect x={cx - barW - 1} y={yTop(d.count)} width={barW} height={Math.max(0, PAD_T + innerH - yTop(d.count))} fill={TEAL} rx="2" />
            <rect x={cx + 1} y={yTop(dropped.count)} width={barW} height={Math.max(0, PAD_T + innerH - yTop(dropped.count))} fill={BRICK} rx="2" />
            {(i % 2 === 0 || i === n - 1) && (
              <text x={cx} y={H - 6} textAnchor="middle" fontFamily={MONO} fontSize="9" fill={MUTE}>{fmtWeek(d.week)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function DomainBarChart({ data }) {
  const W = 700, H = 170, PAD_L = 150, PAD_R = 34, PAD_T = 6, PAD_B = 6;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
  const max = Math.max(1, ...data.map((d) => d.count));
  const rowH = innerH / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 460, display: "block" }}>
      {data.map((d, i) => {
        const y = PAD_T + rowH * i + rowH * 0.22;
        const h = rowH * 0.56;
        const w = (d.count / max) * innerW;
        return (
          <g key={d.domain}>
            <text x={PAD_L - 8} y={y + h / 2 + 3} textAnchor="end" fontFamily={MONO} fontSize="10" fill={MUTE}>{d.label}</text>
            <rect x={PAD_L} y={y} width={Math.max(1, w)} height={h} fill={DOMAIN_COLORS[d.domain]} rx="2" />
            <text x={PAD_L + Math.max(1, w) + 6} y={y + h / 2 + 3} fontFamily={MONO} fontSize="10" fill={INK}>{d.count}</text>
          </g>
        );
      })}
    </svg>
  );
}

function buildReport({ items, stats, completedByWeek, droppedByWeek, domainDone }) {
  const now = new Date();
  const open = items.filter((i) => OPEN_STATUSES.includes(i.status));
  const stale = open.filter(isStale);
  const last4 = completedByWeek.slice(-4).reduce((a, d) => a + d.count, 0);
  const prev4 = completedByWeek.slice(-8, -4).reduce((a, d) => a + d.count, 0);
  const dropped4 = droppedByWeek.slice(-4).reduce((a, d) => a + d.count, 0);
  const byDomainOpen = DOMAINS.map((d) => ({ label: d.label, count: open.filter((i) => i.domain === d.id).length }));
  const byKindOpen = KINDS.map((k) => ({ label: k.label, count: open.filter((i) => i.kind === k.id).length }));

  const lines = [
    `# Plan Tracker Report -- ${now.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`,
    "",
    "## Snapshot",
    `- Open/in-progress items: ${open.length} (${stale.length} stale, untouched 14+ days)`,
    `- Completed all-time: ${stats.completedCount}, Dropped all-time: ${stats.droppedCount}`,
    stats.avgCycleDays != null
      ? `- Average time from creation to done: ${stats.avgCycleDays.toFixed(1)} days (n=${stats.cycleSampleSize})`
      : `- Average time from creation to done: not enough data yet`,
    "",
    "## Last 4 weeks vs. prior 4 weeks",
    `- Completed: ${last4} (previous 4 weeks: ${prev4})`,
    `- Dropped: ${dropped4}`,
    "",
    "## Open items by domain",
    ...byDomainOpen.map((d) => `- ${d.label}: ${d.count}`),
    "",
    "## Open items by kind",
    ...byKindOpen.map((k) => `- ${k.label}: ${k.count}`),
    "",
    "## Completions by domain (last 12 weeks)",
    ...domainDone.map((d) => `- ${d.label}: ${d.count}`),
  ];

  if (stale.length) {
    lines.push("", "## Stale items (untouched 14+ days)");
    stale.forEach((i) => lines.push(`- [${domainLabel(i.domain)}] ${i.title}${i.targetDate ? ` (target ${i.targetDate})` : ""}`));
  }
  return lines.join("\n");
}

export default function Trends({ items, events }) {
  const [report, setReport] = useState(null);
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => computeStats(items, events), [items, events]);
  const completedByWeek = useMemo(() => weeklyCounts(events, "done"), [events]);
  const droppedByWeek = useMemo(() => weeklyCounts(events, "dropped"), [events]);
  const domainDone = useMemo(() => domainCounts(events, "done"), [events]);

  const generateReport = () => {
    setReport(buildReport({ items, stats, completedByWeek, droppedByWeek, domainDone }));
    setCopied(false);
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const downloadReport = () => {
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plan-tracker-report-${todayISO()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <SectionTitle note={`${events.length} events logged`}>Trends</SectionTitle>
      <Note>
        How tasking and completion have moved over time, reconstructed from the item event log. Only counts
        activity logged from when this feature shipped forward -- it has no memory of what happened before that.
      </Note>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 14 }}>
        <StatTile label="Open now" value={stats.openNow} />
        <StatTile label="Completed (all-time)" value={stats.completedCount} />
        <StatTile label="Dropped (all-time)" value={stats.droppedCount} />
        <StatTile label="Avg. days to done" value={stats.avgCycleDays != null ? stats.avgCycleDays.toFixed(1) : "--"} />
      </div>

      <Card style={{ marginTop: 20 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Completed vs. dropped, last {WEEKS} weeks
        </div>
        <WeeklyBarChart completedByWeek={completedByWeek} droppedByWeek={droppedByWeek} />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Completions by domain, last {WEEKS} weeks
        </div>
        <DomainBarChart data={domainDone} />
      </Card>

      <div style={{ marginTop: 26 }}>
        <SectionTitle note="for your Claude Project">Report</SectionTitle>
        <Note>Compiles the numbers above plus the current stale-item list into a markdown summary to paste or upload into your Claude Project for planning.</Note>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Btn onClick={generateReport} color={TEAL} primary>Generate report</Btn>
          {report && <Btn onClick={copyReport} color={MUTE}>{copied ? "Copied!" : "Copy"}</Btn>}
          {report && <Btn onClick={downloadReport} color={MUTE}>Download .md</Btn>}
        </div>
        {report && (
          <pre style={{
            marginTop: 12, padding: 12, background: HEAD_BG, border: `1px solid ${LINE}`, borderRadius: 8,
            fontFamily: MONO, fontSize: 11, color: INK, whiteSpace: "pre-wrap", maxHeight: 360, overflowY: "auto",
          }}>{report}</pre>
        )}
      </div>
    </div>
  );
}
