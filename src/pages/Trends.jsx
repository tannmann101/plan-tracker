import { Btn, SectionTitle, Note, Card, Pill } from "../ui";
import { SANS, MONO, INK, MUTE, INKBLUE, DOMAIN_COLORS } from "../theme";
import { WeeklyBarChart, HorizontalBarChart, LineChart, Legend } from "../components/charts";
import {
  itemsCompletedPerWeek, domainDistribution, kindCycleTimes, alignmentRateOverTime, resourceUsageCounts,
} from "../lib/trends";
import { kindProgress } from "../lib/graph";
import { domainLabel } from "../constants";

const TOP_DOMAIN_SERIES = 6;

// §11 -- the old Trends page also carried a "Log" tab and an "Unlinked"
// tab. Both are retired here rather than swapped over: Log now has its own
// top-level hamburger page (§8, a strict superset of what that tab showed),
// and "unlinked" work (a Kind with no parent, an Item with no parentKindId)
// is already visible via Workspace's grid and Search/Log's own filters --
// a third bespoke surface for the same thing would be a new panel, which
// §11 explicitly says this pass doesn't add. This page is analytics only.
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
  const alignment = alignmentRateOverTime(secretary, 12).map((a) => ({ week: a.week, y: a.rate, total: a.total }));
  const resourceUsage = resourceUsageCounts(secretary).slice(0, 10).map((r) => ({ label: r.resource, count: r.count, color: INKBLUE }));
  const goalProgressRows = (secretary.kinds || [])
    .filter((k) => k.kindType === "goal" && k.status !== "done")
    .map((k) => ({ label: k.title, ...kindProgress(k.id, secretary), color: DOMAIN_COLORS[k.domain] || MUTE }))
    .filter((g) => g.percent !== null)
    .sort((a, b) => a.percent - b.percent)
    .map((g) => ({ label: g.label, count: g.percent, color: g.color }));

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Back</Btn>
      <SectionTitle>Trends</SectionTitle>

      <SectionTitle note="last 12 weeks">Items Completed</SectionTitle>
      <Note>What kind of work is actually getting accomplished, week by week.</Note>
      <Card style={{ marginTop: 10 }}>
        <Legend series={series} />
        <WeeklyBarChart data={data} series={series} />
      </Card>

      <SectionTitle note={`${goalProgressRows.length} open, measurable`}>Goal Progress</SectionTitle>
      <Note>How far along each open Goal is -- done Items over its whole subtree, low to high.</Note>
      {goalProgressRows.length === 0 ? (
        <Note>No open Goal has any Items under it yet to measure.</Note>
      ) : (
        <Card style={{ marginTop: 10 }}><HorizontalBarChart rows={goalProgressRows} max={100} /></Card>
      )}

      <SectionTitle>Domain Distribution</SectionTitle>
      <Note>Every Kind and Item, counted under its primary domain.</Note>
      {distribution.length === 0 ? <Note>Nothing recorded yet.</Note> : (
        <Card style={{ marginTop: 10 }}><HorizontalBarChart rows={distribution} /></Card>
      )}

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
    </div>
  );
}
