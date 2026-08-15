import { useState } from "react";
import { Btn, SectionTitle, Note, Card, Pill, TabBar } from "../ui";
import { SANS, MONO, INK, MUTE, INKBLUE, LINE, DOMAIN_COLORS } from "../theme";
import { WeeklyBarChart, HorizontalBarChart, LineChart, Legend } from "../components/charts";
import EditEntityModal from "../components/EditEntityModal";
import {
  tasksCompletedPerWeek, domainDistribution, goalCycleTimes, alignmentRateOverTime,
  toolUsageCounts, eventLog, eventsToCSV,
} from "../lib/trends";
import { unlinkedPlans, standaloneTasks } from "../lib/graph";
import { domainLabel, tierLabel } from "../constants";
import { triageCapture } from "../lib/claude";

const TOP_DOMAIN_SERIES = 6;

const TABS = [
  { id: "trends", label: "Trends" },
  { id: "log", label: "Log" },
  { id: "unlinked", label: "Unlinked" },
];

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

function TrendsTab({ secretary }) {
  const weekly = tasksCompletedPerWeek(secretary, 12);
  const { series, data } = weeklySeriesFor(weekly, secretary.domains);
  const distribution = domainDistribution(secretary, secretary.domains).slice(0, 10)
    .map((d) => ({ label: d.label, count: d.count, color: DOMAIN_COLORS[d.domainId] || MUTE }));
  const cycleTimes = goalCycleTimes(secretary);
  const alignment = alignmentRateOverTime(secretary, 12).map((a) => ({ week: a.week, y: a.rate, total: a.total }));
  const toolUsage = toolUsageCounts(secretary).slice(0, 10).map((t) => ({ label: t.toolLocation, count: t.count, color: INKBLUE }));

  return (
    <div>
      <SectionTitle note="last 12 weeks">Tasks Completed</SectionTitle>
      <Note>What kind of work is actually getting accomplished, week by week.</Note>
      <Card style={{ marginTop: 10 }}>
        <Legend series={series} />
        <WeeklyBarChart data={data} series={series} />
      </Card>

      <SectionTitle>Domain Distribution</SectionTitle>
      <Note>Everything active or done, counted under its primary domain.</Note>
      {distribution.length === 0 ? <Note>Nothing recorded yet.</Note> : (
        <Card style={{ marginTop: 10 }}><HorizontalBarChart rows={distribution} /></Card>
      )}

      <SectionTitle note="last 12 weeks">Alignment Rate</SectionTitle>
      <Note>Of the Tasks completed each week, the share whose Session→Plan chain actually reaches a Goal.</Note>
      <Card style={{ marginTop: 10 }}><LineChart points={alignment} color={INKBLUE} /></Card>

      <SectionTitle note={`${toolUsage.length}`}>Where It's Landing</SectionTitle>
      <Note>Sessions by tool/location, from the routing table -- how much is actually reaching Calendar, Reading notebook, Finance Tracker, and so on.</Note>
      {toolUsage.length === 0 ? <Note>Nothing recorded yet.</Note> : (
        <Card style={{ marginTop: 10 }}><HorizontalBarChart rows={toolUsage} /></Card>
      )}

      <SectionTitle note={`${cycleTimes.length} completed`}>Goal Cycle Time</SectionTitle>
      <Note>Days from a Goal's creation to its completion.</Note>
      {cycleTimes.length === 0 ? <Note>No Goals completed yet.</Note> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {cycleTimes.map((c) => (
            <Card key={c.goalId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: INK }}>{c.title}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <Pill color={MUTE}>{tierLabel(c.tier)}</Pill>
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

function LogTab({ secretary }) {
  const log = eventLog(secretary);
  const download = () => {
    const csv = eventsToCSV(log);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `secretary-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <SectionTitle note={`${log.length} entries`}>Log</SectionTitle>
        {log.length > 0 && <Btn small onClick={download}>Export CSV</Btn>}
      </div>
      {log.length === 0 ? <Note>Nothing logged yet.</Note> : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {log.map((e) => (
            <div key={e.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${LINE}` }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, flex: "none", width: 130 }}>
                {new Date(e.at).toLocaleDateString()} {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span style={{ fontFamily: SANS, fontSize: 12.5, color: INK }}>
                {e.entityType} "{e.title}" {e.from ? `${e.from} → ${e.to}` : `created (${e.to})`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UnlinkedRow({ kind, item, secretary, onEdit }) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

  const askSecretary = async () => {
    setSuggesting(true);
    try {
      const existingGoals = (secretary.goals || []).map((g) => ({ id: g.id, title: g.title, tier: g.tier, domain: g.domain }));
      const draft = await triageCapture({ text: item.title, existingGoals, priorAnswers: [] });
      if (draft.alignment?.type === "existing-goal" && draft.alignment.goalId) {
        const goal = (secretary.goals || []).find((g) => g.id === draft.alignment.goalId);
        setSuggestion(goal ? `Likely serves "${goal.title}" -- ${draft.alignment.note || ""}` : draft.alignment.note);
      } else {
        setSuggestion(draft.alignment?.note || "No clear Goal match -- may be genuine drift, or the groundwork for a new one.");
      }
    } catch (err) {
      setSuggestion(err.message || "Could not reach Secretary just now.");
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontFamily: SANS, fontSize: 13.5, color: INK, fontWeight: 500 }}>{item.title}</div>
          <Pill color={DOMAIN_COLORS[item.domain] || MUTE}>{domainLabel(item.domain, secretary.domains)}</Pill>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {kind === "plan" && <Btn small onClick={askSecretary} disabled={suggesting}>{suggesting ? "…" : "Ask Secretary"}</Btn>}
          <Btn small primary color={INKBLUE} onClick={() => onEdit(kind, item)}>Edit</Btn>
        </div>
      </div>
      {suggestion && <p style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginTop: 8 }}>{suggestion}</p>}
    </Card>
  );
}

function UnlinkedTab({ secretary, onEdit }) {
  const plans = unlinkedPlans(secretary.plans);
  const tasks = standaloneTasks(secretary.tasks);
  return (
    <div>
      <Note>
        Groundwork logged before a Goal existed to serve it -- and standalone Tasks with no Session. Nothing here is wrong,
        it just hasn't been asked "does this belong to something?" yet.
      </Note>
      <SectionTitle note={`${plans.length}`}>Ungrounded Plans</SectionTitle>
      {plans.length === 0 ? <Note>None -- everything traces to a Goal or Project.</Note> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {plans.map((p) => <UnlinkedRow key={p.id} kind="plan" item={p} secretary={secretary} onEdit={onEdit} />)}
        </div>
      )}
      <SectionTitle note={`${tasks.length}`}>Standalone Tasks</SectionTitle>
      {tasks.length === 0 ? <Note>None -- every Task belongs to a Session.</Note> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.map((t) => <UnlinkedRow key={t.id} kind="task" item={t} secretary={secretary} onEdit={onEdit} />)}
        </div>
      )}
    </div>
  );
}

export default function Trends({ secretary, onBack }) {
  const [tab, setTab] = useState("trends");
  const [editing, setEditing] = useState(null);

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Hub</Btn>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
        <SectionTitle>Trends</SectionTitle>
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === "trends" && <TrendsTab secretary={secretary} />}
      {tab === "log" && <LogTab secretary={secretary} />}
      {tab === "unlinked" && <UnlinkedTab secretary={secretary} onEdit={(type, entity) => setEditing({ type, entity })} />}

      {editing && (
        <EditEntityModal type={editing.type} entity={editing.entity} secretary={secretary} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
