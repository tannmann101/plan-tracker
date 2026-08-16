import { Btn, SectionTitle, Note, Card, Pill } from "../ui";
import { SANS, MONO, INK, MUTE, INKBLUE, DEEPTEAL, BRICK, OCHRE, MOSS, DOMAIN_COLORS, STATUS_COLORS, ATTENTION_COLORS } from "../theme";
import {
  WeeklyBarChart, HorizontalBarChart, LineChart, Legend,
  StatTile, Heatmap, SegmentBars, StatusMeters, niceMax,
} from "../components/charts";
import {
  itemsCompletedPerWeek, domainDistribution, kindCycleTimes, alignmentRateOverTime, resourceUsageCounts,
  practiceConsistency, disciplineStreakHistory, kindStatusCounts, timeBlockedHoursPerWeek,
} from "../lib/trends";
import { kindProgress, practiceHabitsSummary, kindsNeedingAttention } from "../lib/graph";
import { domainLabel, disciplineTypeLabel } from "../constants";

const TOP_DOMAIN_SERIES = 6;
const PRACTICE_DAYS = 28;

// §11 -- the old Trends page also carried a "Log" tab and an "Unlinked"
// tab. Both are retired here rather than swapped over: Log now has its own
// top-level hamburger page (§8, a strict superset of what that tab showed),
// and "unlinked" work (a Kind with no parent, an Item with no parentKindId)
// is already visible via Workspace's grid and Search/Log's own filters --
// a third bespoke surface for the same thing would be a new panel, which
// §11 explicitly says this pass doesn't add. This page is analytics only.
//
// Extended past §11's original scope once Practices, Habits to Break, and
// time-blocking existed to have real data of their own -- everything below
// the KPI row that isn't in the original spec (Practice Consistency,
// Habits to Break, Pipeline, Time-Blocked Hours, Needs Attention) reads
// "nothing yet" honestly on a fresh household and fills in as the same
// household keeps using Today/Week/Plans, with no separate data entry of
// its own -- it's all already-computed off kinds/items/practiceHabits/
// disciplines/events, the same sources the rest of the app writes to.
function weeklySeriesFor(weekly, domains) {
  const totals = {};
  for (const w of weekly) {
    for (const [domainId, count] of Object.entries(w.byDomain)) {
      totals[domainId] = (totals[domainId] || 0) + count;
    }
  }
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, TOP_DOMAIN_SERIES).map(([id]) => id);
  const series = top.map((id) => ({ key: id, label: domainLabel(id, domains), color: DOMAIN_COLORS[id] || MUTE }));
  const hasOther = Object.keys(totals).some((id) => !top.includes(id));
  if (hasOther) series.push({ key: "__other", label: "Other", color: MUTE });

  const data = weekly.map((w) => {
    const row = { week: w.week };
    for (const id of top) row[id] = w.byDomain[id] || 0;
    if (hasOther) row.__other = Object.entries(w.byDomain).filter(([id]) => !top.includes(id)).reduce((sum, [, c]) => sum + c, 0);
    return row;
  });
  return { series, data };
}

export default function Trends({ secretary, onBack }) {
  const weekly = itemsCompletedPerWeek(secretary, 12);
  const { series, data } = weeklySeriesFor(weekly, secretary.domains);
  const distribution = domainDistribution(secretary, secretary.domains).slice(0, 10)
    .map((d) => ({ label: d.label, count: d.count, color: DOMAIN_COLORS[d.domainId] || MUTE }));
  const cycleTimes = kindCycleTimes(secretary);
  const alignment = alignmentRateOverTime(secretary, 12).map((a) => ({ week: a.week, y: a.rate, note: `${a.total} completed` }));
  const resourceUsage = resourceUsageCounts(secretary).slice(0, 10).map((r) => ({ label: r.resource, count: r.count, color: INKBLUE }));
  const goalProgressRows = (secretary.kinds || [])
    .filter((k) => k.kindType === "goal" && k.status !== "done")
    .map((k) => ({ label: k.title, ...kindProgress(k.id, secretary), color: DOMAIN_COLORS[k.domain] || MUTE }))
    .filter((g) => g.percent !== null)
    .sort((a, b) => a.percent - b.percent)
    .map((g) => ({ label: g.label, count: g.percent, color: g.color }));

  const practiceRows = practiceConsistency(secretary, PRACTICE_DAYS);
  const practiceHabits = practiceHabitsSummary(secretary);
  const disciplineHistory = disciplineStreakHistory(secretary);
  const focusedDisciplines = disciplineHistory.filter((d) => d.focused && !d.resolved);
  const attentionList = kindsNeedingAttention(secretary);
  const pipelineStages = kindStatusCounts(secretary).map((s) => ({ ...s, color: STATUS_COLORS[s.status] || MUTE }));
  const hoursPerWeek = timeBlockedHoursPerWeek(secretary, 12);
  const hoursPoints = hoursPerWeek.map((h) => ({ week: h.week, y: h.hours }));
  const hoursYMax = niceMax(Math.max(1, ...hoursPerWeek.map((h) => h.hours)));

  const completedThisWeek = weekly[weekly.length - 1]?.total ?? 0;
  const practicesDoneToday = practiceHabits.filter((h) => h.todayDone).length;
  const longestActiveStreak = focusedDisciplines.length ? Math.max(...focusedDisciplines.map((d) => d.currentStreakDays)) : null;
  const hoursThisWeek = hoursPerWeek[hoursPerWeek.length - 1]?.hours ?? 0;

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Back</Btn>
      <SectionTitle>Trends</SectionTitle>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
        <StatTile label="Completed this week" value={completedThisWeek} color={INKBLUE} trend={weekly.map((w) => w.total)} />
        <StatTile
          label="Practices today"
          value={practiceHabits.length ? `${practicesDoneToday}/${practiceHabits.length}` : "—"}
          sublabel={practiceHabits.length ? null : "none tracked yet"}
          color={DEEPTEAL}
        />
        <StatTile
          label="Longest active streak"
          value={longestActiveStreak !== null ? `${longestActiveStreak}d` : "—"}
          sublabel={focusedDisciplines.length ? null : "none in focus"}
          color={BRICK}
        />
        <StatTile label="Needs attention" value={attentionList.length} color={attentionList.length ? OCHRE : MUTE} />
        <StatTile label="Time-blocked this week" value={`${hoursThisWeek}h`} color={INKBLUE} trend={hoursPerWeek.map((h) => h.hours)} />
      </div>

      <SectionTitle note="last 12 weeks">Items Completed</SectionTitle>
      <Note>What kind of work is actually getting accomplished, week by week.</Note>
      <Card style={{ marginTop: 10 }}>
        <Legend series={series} />
        <WeeklyBarChart data={data} series={series} />
      </Card>

      <SectionTitle note={`last ${PRACTICE_DAYS} days`}>Practice Consistency</SectionTitle>
      <Note>Each row is an active Practice; a filled square is a day it was checked off -- on Today/Week or Plans' tracker, same Item either way.</Note>
      {practiceRows.length === 0 ? (
        <Note>No active Practices yet -- add one from Plans to start seeing your consistency here.</Note>
      ) : (
        <Card style={{ marginTop: 10, overflowX: "auto" }}><Heatmap rows={practiceRows} color={DEEPTEAL} /></Card>
      )}

      <SectionTitle note={`${disciplineHistory.length} tracked`}>Habits to Break</SectionTitle>
      <Note>Each bar sequence is one habit's past streaks in order, then the current one -- bars trending taller means relapses are getting rarer.</Note>
      {disciplineHistory.length === 0 ? (
        <Note>No habits being eliminated yet -- add one from Plans' "Habits to Break" to start tracking streak history here.</Note>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {disciplineHistory.map((d) => (
            <Card key={d.id}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: SANS, fontSize: 13.5, color: INK, fontWeight: 500 }}>{d.title}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <Pill color={MUTE}>{disciplineTypeLabel(d.type, secretary.disciplineTypes)}</Pill>
                    {d.resolved && <Pill color={MOSS}>resolved</Pill>}
                    {!d.resolved && !d.focused && <Pill color={MUTE}>paused</Pill>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 18 }}>
                  {[
                    [d.resolved ? "final" : "current", `${d.currentStreakDays}d`, d.resolved ? MOSS : d.focused ? BRICK : MUTE],
                    ["best", `${d.longestStreakDays}d`, INK],
                    ["relapses", d.totalRelapses, INK],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 600, color }}>{value}</div>
                      <div style={{ fontFamily: MONO, fontSize: 9.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
              {d.segments.length > 0 && (
                <div style={{ marginTop: 12, overflowX: "auto" }}><SegmentBars segments={d.segments} color={BRICK} /></div>
              )}
            </Card>
          ))}
        </div>
      )}

      <SectionTitle note={`${goalProgressRows.length} open, measurable`}>Goal Progress</SectionTitle>
      <Note>How far along each open Goal is -- done Items over its whole subtree, low to high.</Note>
      {goalProgressRows.length === 0 ? (
        <Note>No open Goal has any Items under it yet to measure.</Note>
      ) : (
        <Card style={{ marginTop: 10 }}><HorizontalBarChart rows={goalProgressRows} max={100} /></Card>
      )}

      <SectionTitle>Pipeline</SectionTitle>
      <Note>Every Project, Goal, and Practice, by where it sits in the kanban right now.</Note>
      {pipelineStages.every((s) => s.count === 0) ? <Note>Nothing recorded yet.</Note> : (
        <Card style={{ marginTop: 10 }}><StatusMeters stages={pipelineStages} /></Card>
      )}

      <SectionTitle>Domain Distribution</SectionTitle>
      <Note>Every Kind and Item, counted under its primary domain.</Note>
      {distribution.length === 0 ? <Note>Nothing recorded yet.</Note> : (
        <Card style={{ marginTop: 10 }}><HorizontalBarChart rows={distribution} /></Card>
      )}

      <SectionTitle note="last 12 weeks">Time-Blocked Hours</SectionTitle>
      <Note>Hours actually placed on the clock -- a timed, non-floating Item's duration -- each week, versus left floating.</Note>
      <Card style={{ marginTop: 10 }}><LineChart points={hoursPoints} color={INKBLUE} yMax={hoursYMax} yUnit="h" /></Card>

      <SectionTitle note="last 12 weeks">Alignment Rate</SectionTitle>
      <Note>Of the Items completed each week, the share whose parentKindId chain actually reaches a Goal.</Note>
      <Card style={{ marginTop: 10 }}><LineChart points={alignment} color={INKBLUE} /></Card>

      <SectionTitle note={`${resourceUsage.length}`}>Where It's Landing</SectionTitle>
      <Note>Kinds and Items by resource -- how much is actually reaching Calendar, Reading notebook, Finance Tracker, and so on.</Note>
      {resourceUsage.length === 0 ? <Note>Nothing recorded yet.</Note> : (
        <Card style={{ marginTop: 10 }}><HorizontalBarChart rows={resourceUsage} /></Card>
      )}

      <SectionTitle note={`${cycleTimes.length} completed`}>Goal Cycle Time</SectionTitle>
      <Note>Days from a Goal's creation to its completion.</Note>
      {cycleTimes.length === 0 ? <Note>No Goals completed yet.</Note> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {cycleTimes.map((c) => (
            <Card key={c.kindId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: INK }}>{c.title}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <Pill color={DOMAIN_COLORS[c.domain] || MUTE}>{domainLabel(c.domain, secretary.domains)}</Pill>
                </div>
              </div>
              <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: INK }}>{c.days}d</span>
            </Card>
          ))}
        </div>
      )}

      <SectionTitle note={`${attentionList.length}`}>Needs Attention</SectionTitle>
      <Note>Projects, Goals, and Practices that are overdue, stalled, or have nothing attached yet -- the same flag shown on their card, gathered in one place.</Note>
      {attentionList.length === 0 ? (
        <Note>Nothing needs attention right now.</Note>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {attentionList.map((a) => (
            <Card key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: INK }}>{a.title}</div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: ATTENTION_COLORS[a.level], marginTop: 4 }}>{a.hint}</div>
              </div>
              <Pill color={ATTENTION_COLORS[a.level]}>{a.label}</Pill>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
