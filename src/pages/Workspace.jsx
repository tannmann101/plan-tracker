import { useEffect, useRef, useState } from "react";
import { Btn, SectionTitle, Note, Pill, Card, Select, IconButton, CheckboxRow } from "../ui";
import {
  MONO, SANS, INK, MUTE, CARD, LINE, INKBLUE, DEEPTEAL, BRICK, MOSS, DOMAIN_COLORS, STATUS_COLORS, ATTENTION_COLORS,
  SIZE_TITLE, SIZE_META, LETTER_META, GAP_STACK, GAP_ROW, GAP_HEADER, RADIUS, softTint,
} from "../theme";
import { EntityCard } from "../components/EntityCard";
import EditEntityModal from "../components/EditEntityModal";
import DisciplineDetailModal from "../components/DisciplineDetailModal";
import AddForm from "../components/AddForm";
import {
  Timeline, BarChart, WeeklyBarChart, DetailList, LineChart, Legend,
  StatTile, Heatmap, SegmentBars, StatusMeters, niceMax,
} from "../components/charts";
import { SecretaryChatPanel } from "./Secretary";
import {
  itemsCompletedPerWeek, domainDistribution, kindCycleTimes, alignmentRateOverTime, resourceUsageCounts,
  practiceConsistency, disciplineStreakHistory, kindStatusCounts, timeBlockedHoursPerWeek,
} from "../lib/trends";
import { kindProgress, practiceHabitsSummary, kindsNeedingAttention } from "../lib/graph";
import { KIND_STATUSES, domainLabel, disciplineTypeLabel } from "../constants";

const TOP_DOMAIN_SERIES = 6;
const PRACTICE_DAYS = 28;
const TOP_N_CHART = 12; // ranked bar charts (resources especially) cap here for legibility -- a household with two dozen resources configured shouldn't turn one bar chart into an unreadable comb.

// Domain-stacked weekly series for the Items Completed view -- same shape
// Trends' equivalent panel used, folded in here since Trends no longer
// exists as its own page (every view now lives on Workspace, per the
// household's own "land them all here" request).
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

// A panel header used consistently across every "own space" section below --
// title, optional note, optional right-aligned action -- so the page reads
// as a set of clearly bounded control surfaces rather than one long stack.
function PanelHeader({ children, note, action }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: GAP_HEADER, flexWrap: "wrap" }}>
      <div style={{ fontFamily: SANS, fontSize: SIZE_TITLE, fontWeight: 600, color: INK }}>{children}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {note && <span style={{ fontFamily: MONO, fontSize: SIZE_META, color: MUTE }}>{note}</span>}
        {action}
      </div>
    </div>
  );
}

// A ticket plus, for a Kind, a quick status control directly underneath it --
// same instant re-status Plans' kanban gives you (secretary.saveEntity, no
// modal), just as a dropdown instead of a drag since Workspace's board isn't
// column-per-status. Everything else (title, domain, tags, parent
// reassignment, dates, delete) is still one click into the full edit modal
// via the card body itself.
//
// Drag-and-drop reparenting lives here too: an Item ticket is a native drag
// source (onReparentItem given), and a Kind ticket is its drop target --
// dropping an Item onto a Kind sets that Item's parentKindId, a direct
// alternative to the edit modal's parent picker. Same direct-write,
// separate-from-Secretary path TimeGrid's reschedule drag uses.
function WorkspaceTicket({ family, entity, secretary, onEdit, onNavigateKind, onToggleDone, onAskSecretary, onReparentItem }) {
  const [dragOver, setDragOver] = useState(false);
  const changeStatus = (status) => secretary.saveEntity("kind", { ...entity, status });

  if (family !== "kind") {
    return (
      <div
        draggable={!!onReparentItem}
        onDragStart={onReparentItem ? (e) => e.dataTransfer.setData("text/plain", entity.id) : undefined}
        style={{ cursor: onReparentItem ? "grab" : "default" }}
      >
        <EntityCard family={family} entity={entity} secretary={secretary} onEdit={onEdit} onNavigateKind={onNavigateKind} onToggleDone={onToggleDone} onAskSecretary={onAskSecretary} />
      </div>
    );
  }
  // The status control reads as part of the same card, not a floating
  // sibling -- a shared border/radius wrapper with the EntityCard's own
  // shadow suppressed (tint="none" equivalent: border-only) and a divider
  // line above the footer strip, rather than two independently-bordered
  // pieces stacked with a gap between them.
  return (
    <div
      onDragOver={onReparentItem ? (e) => { e.preventDefault(); setDragOver(true); } : undefined}
      onDragLeave={onReparentItem ? () => setDragOver(false) : undefined}
      onDrop={onReparentItem ? (e) => {
        e.preventDefault();
        setDragOver(false);
        const itemId = e.dataTransfer.getData("text/plain");
        if (itemId) onReparentItem(itemId, entity.id);
      } : undefined}
      style={{ border: `1px solid ${dragOver ? INKBLUE : LINE}`, borderRadius: RADIUS, overflow: "hidden" }}
    >
      <EntityCard family={family} entity={entity} secretary={secretary} onEdit={onEdit} onNavigateKind={onNavigateKind} onToggleDone={onToggleDone} onAskSecretary={onAskSecretary} style={{ border: "none", borderRadius: 0, boxShadow: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderTop: `1px solid ${LINE}` }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLORS[entity.status] || MUTE, flex: "none" }} />
        <Select value={entity.status} onChange={changeStatus} options={KIND_STATUSES} width="100%" />
      </div>
    </div>
  );
}

// One "Habits to Break" card -- pulled out of the Views array below since
// it's the one view whose body is genuinely complex (a list of cards, each
// with its own streak-segment chart), not just a chart component plus an
// optional DetailList.
function DisciplineCard({ d, secretary, onOpen }) {
  return (
    <Card onClick={onOpen} style={{ cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: SANS, fontSize: SIZE_TITLE, color: INK, fontWeight: 500 }}>{d.title}</div>
          <div style={{ display: "flex", gap: GAP_ROW, marginTop: 6, flexWrap: "wrap" }}>
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
              <div style={{ fontFamily: MONO, fontSize: 9.5, color: MUTE, textTransform: "uppercase", letterSpacing: LETTER_META }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
      {d.segments.length > 0 && (
        <div style={{ marginTop: 12, overflowX: "auto" }}><SegmentBars segments={d.segments} color={BRICK} /></div>
      )}
    </Card>
  );
}

// A row-card shared by the Goal Cycle Time / Needs Attention views -- title
// plus a right-aligned figure or pill, click-to-open.
function ListRow({ onOpen, left, right }) {
  return (
    <Card onClick={onOpen} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer" }}>
      {left}
      {right}
    </Card>
  );
}

// §10 -- the full Kind/Item ticket board, and the household's "super-admin"
// page: every entity, chart, and filter here is meant to be a live control,
// not a static readout. Clicking a ticket opens the edit modal *and*
// focuses the Secretary chat on that entity (reusing Secretary.jsx's chat
// panel rather than a second implementation), so a conversation about a
// ticket and editing it sit side by side.
//
// Every analytics view that used to live on its own Trends page (§11) now
// lives here too, in a single-view-at-a-time gallery below the board --
// the household's own framing was "one place to command every piece I
// touch," and a dedicated second analytics page cut against that. Rendering
// one view at a time, full width, is also what actually fixes the cramped/
// illegible charts a squeezed 3-column row produced: every chart here gets
// the whole card's width to itself. Today's Goal-progress rail and Week's
// Domain-distribution rail are gone for the same reason -- the same view,
// done properly, now lives in exactly one place instead of a smaller
// half-working copy on every page that touched it.
export default function Workspace({ secretary, onBack, onNavigateKind, onNavigate, focusKindId, onFocusHandled }) {
  const [showDone, setShowDone] = useState(false);
  const [domainFilter, setDomainFilter] = useState(null);
  const [resourceFilter, setResourceFilter] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [disciplineModal, setDisciplineModal] = useState(null);
  const [focused, setFocused] = useState(null); // { family, entity } -- scopes the chat panel
  const [activeView, setActiveView] = useState("domain");
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [expandedStatus, setExpandedStatus] = useState(null);
  const galleryRef = useRef(null);
  const chatRef = useRef(null);

  // Workspace already has its own embedded chat panel with its own scoping
  // (`focused`, above) -- the "Ask Secretary" icon on a ticket here should
  // scope and reveal *that* panel rather than the App-level dock/page
  // hand-off every other page uses, so this shadows the `onAskSecretary`
  // prop Workspace also receives via App.jsx's pageProps spread (left
  // unused on purpose).
  const askSecretaryLocal = (family, entity) => {
    setFocused({ family, entity });
    chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Arriving here via a "why is this here" chain's Kind link (InfoModal's
  // onNavigateKind) focuses the chat on that Kind without forcing the edit
  // modal open too -- landing here should feel like a scoped conversation,
  // not an interruption.
  useEffect(() => {
    if (!focusKindId) return;
    const kind = (secretary.kinds || []).find((k) => k.id === focusKindId);
    if (kind) setFocused({ family: "kind", entity: kind });
    onFocusHandled?.();
  }, [focusKindId, secretary.kinds, onFocusHandled]);

  const kinds = (secretary.kinds || []).filter((k) => (showDone || k.status !== "done"))
    .filter((k) => !domainFilter || k.domain === domainFilter || (k.secondaryDomains || []).includes(domainFilter))
    .filter((k) => !resourceFilter || (k.resources || []).includes(resourceFilter));
  const items = (secretary.items || []).filter((i) => (showDone || !i.done))
    .filter((i) => !domainFilter || i.domain === domainFilter || (i.secondaryDomains || []).includes(domainFilter))
    .filter((i) => !resourceFilter || (i.resources || []).includes(resourceFilter));

  // Every drilldown across every view opens the same way: the full edit
  // modal, plus scoping the chat panel to that entity -- there's no reason
  // a ticket surfaced by a chart should be less of a live control than one
  // surfaced by the board itself.
  const openTicket = (family, entity) => {
    setEditing({ family, entity });
    setFocused({ family, entity });
  };
  // Direct drag-and-drop reparenting -- see TimeGrid's own reschedule drag
  // for the "writes straight through secretary.saveEntity, not via
  // propose-then-confirm" note; this is the same direct-manipulation path.
  const reparentItem = (itemId, kindId) => {
    const item = (secretary.items || []).find((i) => i.id === itemId);
    if (!item || item.parentKindId === kindId) return;
    secretary.saveEntity("item", { ...item, parentKindId: kindId });
  };
  const openKind = (kindId) => {
    const kind = (secretary.kinds || []).find((k) => k.id === kindId);
    if (kind) openTicket("kind", kind);
  };
  const openDiscipline = (id) => {
    const discipline = (secretary.disciplines || []).find((d) => d.id === id);
    if (discipline) setDisciplineModal(discipline);
  };
  const showView = (id) => {
    setActiveView(id);
    galleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ---- Views gallery data -- every one of these used to be its own panel
  // on the retired Trends page; see that page's git history for the original
  // per-panel comments if the "why" behind a given computation isn't obvious
  // from lib/trends.js / lib/graph.js's own comments.
  const weekly = itemsCompletedPerWeek(secretary, 12);
  const { series, data } = weeklySeriesFor(weekly, secretary.domains);
  const expandedWeekRow = weekly.find((w) => w.week === expandedWeek);

  const distribution = domainDistribution(secretary, secretary.domains)
    .map((d) => ({ id: d.domainId, label: d.label, count: d.count, color: DOMAIN_COLORS[d.domainId] || MUTE, entities: d.entities }));
  const expandedDomainRow = distribution.find((d) => d.id === domainFilter);

  const resourceUsage = resourceUsageCounts(secretary).slice(0, TOP_N_CHART)
    .map((r) => ({ id: r.resource, label: r.resource, count: r.count, color: INKBLUE, entities: r.entities }));
  const expandedResourceRow = resourceUsage.find((r) => r.id === resourceFilter);

  const goalProgressRows = (secretary.kinds || [])
    .filter((k) => k.kindType === "goal" && k.status !== "done")
    .map((k) => ({ id: k.id, label: k.title, ...kindProgress(k.id, secretary), color: DOMAIN_COLORS[k.domain] || MUTE }))
    .filter((g) => g.percent !== null)
    .sort((a, b) => a.percent - b.percent)
    .slice(0, TOP_N_CHART)
    .map((g) => ({ id: g.id, label: g.label, count: g.percent, color: g.color }));

  const pipelineStages = kindStatusCounts(secretary).map((s) => ({ ...s, color: STATUS_COLORS[s.status] || MUTE }));
  const expandedStatusStage = pipelineStages.find((s) => s.status === expandedStatus);

  const practiceRows = practiceConsistency(secretary, PRACTICE_DAYS);
  const practiceHabits = practiceHabitsSummary(secretary);
  const disciplineHistory = disciplineStreakHistory(secretary);
  const focusedDisciplines = disciplineHistory.filter((d) => d.focused && !d.resolved);
  const attentionList = kindsNeedingAttention(secretary);
  const cycleTimes = kindCycleTimes(secretary);
  const alignment = alignmentRateOverTime(secretary, 12).map((a) => ({ week: a.week, y: a.rate, note: `${a.total} completed` }));
  const hoursPerWeek = timeBlockedHoursPerWeek(secretary, 12);
  const hoursPoints = hoursPerWeek.map((h) => ({ week: h.week, y: h.hours }));
  const hoursYMax = niceMax(Math.max(1, ...hoursPerWeek.map((h) => h.hours)));

  const timelineRows = (secretary.kinds || [])
    .filter((k) => k.timing?.dueDate)
    .map((k) => ({ id: k.id, title: k.title, date: k.timing.dueDate, startDate: k.timing.startDate || null, color: DOMAIN_COLORS[k.domain] || INKBLUE }));

  const completedThisWeek = weekly[weekly.length - 1]?.total ?? 0;
  const practicesDoneToday = practiceHabits.filter((h) => h.todayDone).length;
  const longestActiveStreak = focusedDisciplines.length ? Math.max(...focusedDisciplines.map((d) => d.currentStreakDays)) : null;
  const hoursThisWeek = hoursPerWeek[hoursPerWeek.length - 1]?.hours ?? 0;

  const VIEWS = [
    {
      id: "domain", label: "Domain Distribution",
      note: "Every Kind and Item, counted under its primary domain -- click a bar to filter the board (above) and see what's counted.",
      body: distribution.length === 0 ? <Note>Nothing recorded yet.</Note> : (
        <>
          <BarChart rows={distribution} onBarClick={(id) => setDomainFilter(domainFilter === id ? null : id)} activeId={domainFilter} />
          {expandedDomainRow && <DetailList items={expandedDomainRow.entities} onOpen={openTicket} />}
        </>
      ),
    },
    {
      id: "completed", label: "Items Completed",
      note: "What kind of work is actually getting accomplished, week by week, last 12 weeks -- click a bar to see what's counted.",
      body: (
        <>
          <Legend series={series} />
          <WeeklyBarChart data={data} series={series} onBarClick={(week) => setExpandedWeek(expandedWeek === week ? null : week)} activeId={expandedWeek} />
          {expandedWeekRow && <DetailList items={expandedWeekRow.items} onOpen={openTicket} emptyLabel="Nothing completed that week." />}
        </>
      ),
    },
    {
      id: "resources", label: "Where It's Landing",
      note: `Kinds and Items by resource, top ${TOP_N_CHART} by use -- click a bar to filter the board (above) and see what's counted.`,
      body: resourceUsage.length === 0 ? <Note>Nothing recorded yet.</Note> : (
        <>
          <BarChart rows={resourceUsage} onBarClick={(id) => setResourceFilter(resourceFilter === id ? null : id)} activeId={resourceFilter} />
          {expandedResourceRow && <DetailList items={expandedResourceRow.entities} onOpen={openTicket} />}
        </>
      ),
    },
    {
      id: "goalProgress", label: "Goal Progress",
      note: "How far along each open Goal is -- done Items over its whole subtree, low to high -- click a bar to open that Goal.",
      body: goalProgressRows.length === 0 ? <Note>No open Goal has any Items under it yet to measure.</Note> : (
        <BarChart rows={goalProgressRows} max={100} onBarClick={openKind} />
      ),
    },
    {
      id: "pipeline", label: "Pipeline",
      note: "Every Project, Goal, and Practice, by where it sits in the kanban right now -- click a stage to see what's in it.",
      body: pipelineStages.every((s) => s.count === 0) ? <Note>Nothing recorded yet.</Note> : (
        <>
          <StatusMeters stages={pipelineStages} onStageClick={(status) => setExpandedStatus(expandedStatus === status ? null : status)} activeStatus={expandedStatus} />
          {expandedStatusStage && <DetailList items={expandedStatusStage.entities} onOpen={openTicket} />}
        </>
      ),
    },
    {
      id: "practice", label: "Practice Consistency",
      note: `Each row is an active Practice; a filled square is a day it was checked off, last ${PRACTICE_DAYS} days -- click a filled square to open that check-in.`,
      body: practiceRows.length === 0 ? <Note>No active Practices yet -- add one from Plans to start seeing your consistency here.</Note> : (
        <div style={{ overflowX: "auto" }}><Heatmap rows={practiceRows} color={DEEPTEAL} onCellClick={(item) => openTicket("item", item)} /></div>
      ),
    },
    {
      id: "habits", label: "Habits to Break",
      note: "Each bar sequence is one habit's past streaks in order, then the current one -- click a card for its detail.",
      body: disciplineHistory.length === 0 ? <Note>No habits being eliminated yet -- add one from Plans' "Habits to Break" to start tracking streak history here.</Note> : (
        <div style={{ display: "flex", flexDirection: "column", gap: GAP_STACK }}>
          {disciplineHistory.map((d) => (
            <DisciplineCard key={d.id} d={d} secretary={secretary} onOpen={() => openDiscipline(d.id)} />
          ))}
        </div>
      ),
    },
    {
      id: "hours", label: "Time-Blocked Hours",
      note: "Hours actually placed on the clock -- a timed, non-floating Item's duration -- each week, last 12 weeks, versus left floating.",
      body: <LineChart points={hoursPoints} color={INKBLUE} yMax={hoursYMax} yUnit="h" />,
    },
    {
      id: "alignment", label: "Alignment Rate",
      note: "Of the Items completed each week, the share whose parentKindId chain actually reaches a Goal, last 12 weeks.",
      body: <LineChart points={alignment} color={INKBLUE} />,
    },
    {
      id: "cycleTime", label: "Goal Cycle Time",
      note: "Days from a Goal's creation to its completion -- click one to open it.",
      body: cycleTimes.length === 0 ? <Note>No Goals completed yet.</Note> : (
        <div style={{ display: "flex", flexDirection: "column", gap: GAP_STACK }}>
          {cycleTimes.map((c) => (
            <ListRow
              key={c.kindId} onOpen={() => openKind(c.kindId)}
              left={(
                <div>
                  <div style={{ fontFamily: SANS, fontSize: SIZE_TITLE, color: INK }}>{c.title}</div>
                  <div style={{ display: "flex", gap: GAP_ROW, marginTop: 4 }}>
                    <Pill color={DOMAIN_COLORS[c.domain] || MUTE}>{domainLabel(c.domain, secretary.domains)}</Pill>
                  </div>
                </div>
              )}
              right={<span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: INK }}>{c.days}d</span>}
            />
          ))}
        </div>
      ),
    },
    {
      id: "attention", label: "Needs Attention",
      note: "Projects, Goals, and Practices that are overdue, stalled, or have nothing attached yet -- click one to open it.",
      body: attentionList.length === 0 ? <Note>Nothing needs attention right now.</Note> : (
        <div style={{ display: "flex", flexDirection: "column", gap: GAP_STACK }}>
          {attentionList.map((a) => (
            <ListRow
              key={a.id} onOpen={() => openKind(a.id)}
              left={(
                <div>
                  <div style={{ fontFamily: SANS, fontSize: SIZE_TITLE, color: INK }}>{a.title}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: ATTENTION_COLORS[a.level], marginTop: 4 }}>{a.hint}</div>
                </div>
              )}
              right={<Pill color={ATTENTION_COLORS[a.level]}>{a.label}</Pill>}
            />
          ))}
        </div>
      ),
    },
    {
      id: "timeline", label: "Timeline",
      note: "Due dates across every Kind -- click a marker to open it.",
      body: <Timeline rows={timelineRows} onClick={openKind} />,
    },
  ];
  const activeIdx = Math.max(0, VIEWS.findIndex((v) => v.id === activeView));
  const active = VIEWS[activeIdx];
  const cycleView = (delta) => setActiveView(VIEWS[(activeIdx + delta + VIEWS.length) % VIEWS.length].id);

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Back</Btn>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <SectionTitle note="every entity is a live control -- click a ticket, a due-date marker, or a chart bar">Workspace</SectionTitle>
        <Btn small primary color={INKBLUE} onClick={() => setAdding(true)}>+ Add</Btn>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <StatTile label="Completed this week" value={completedThisWeek} color={INKBLUE} trend={weekly.map((w) => w.total)} onClick={() => showView("completed")} />
        <StatTile
          label="Practices today"
          value={practiceHabits.length ? `${practicesDoneToday}/${practiceHabits.length}` : "—"}
          sublabel={practiceHabits.length ? null : "none tracked yet"}
          color={DEEPTEAL}
          onClick={() => showView("practice")}
        />
        <StatTile
          label="Longest active streak"
          value={longestActiveStreak !== null ? `${longestActiveStreak}d` : "—"}
          sublabel={focusedDisciplines.length ? null : "none in focus"}
          color={BRICK}
          onClick={() => showView("habits")}
        />
        <StatTile label="Needs attention" value={attentionList.length} color={attentionList.length ? BRICK : MUTE} onClick={() => showView("attention")} />
        <StatTile label="Time-blocked this week" value={`${hoursThisWeek}h`} color={INKBLUE} trend={hoursPerWeek.map((h) => h.hours)} onClick={() => showView("hours")} />
      </div>

      <Card style={{ marginBottom: 18 }}>
        <PanelHeader
          note={`${kinds.length + items.length} shown`}
          action={(domainFilter || resourceFilter || showDone) && (
            <Btn small color={MUTE} onClick={() => { setDomainFilter(null); setResourceFilter(null); setShowDone(false); }}>Reset</Btn>
          )}
        >
          Filters
        </PanelHeader>
        <CheckboxRow checked={showDone} onChange={setShowDone}>Show done/archived</CheckboxRow>
        <div style={{ fontFamily: MONO, fontSize: SIZE_META, color: MUTE, textTransform: "uppercase", letterSpacing: LETTER_META, marginBottom: 6 }}>Domain</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: GAP_ROW, marginBottom: 12 }}>
          {secretary.domains.map((d) => (
            <button key={d.id} type="button" onClick={() => setDomainFilter(domainFilter === d.id ? null : d.id)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}>
              <Pill color={DOMAIN_COLORS[d.id] || MUTE} tint={domainFilter === d.id ? softTint(DOMAIN_COLORS[d.id] || MUTE) : undefined}>{d.label}</Pill>
            </button>
          ))}
        </div>
        <div style={{ fontFamily: MONO, fontSize: SIZE_META, color: MUTE, textTransform: "uppercase", letterSpacing: LETTER_META, marginBottom: 6 }}>Resource</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: GAP_ROW, maxHeight: 90, overflowY: "auto" }}>
          {secretary.resources.map((r) => (
            <button key={r} type="button" onClick={() => setResourceFilter(resourceFilter === r ? null : r)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}>
              <Pill color={MUTE} tint={resourceFilter === r ? softTint(MUTE) : undefined}>{r}</Pill>
            </button>
          ))}
        </div>
      </Card>

      <SectionTitle note={`${kinds.length + items.length} tickets`}>Board</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {kinds.map((k) => (
          <WorkspaceTicket key={`kind-${k.id}`} family="kind" entity={k} secretary={secretary} onEdit={openTicket} onNavigateKind={onNavigateKind} onAskSecretary={askSecretaryLocal} onReparentItem={reparentItem} />
        ))}
        {items.map((i) => {
          const toggleDone = (entity, next) => secretary.saveEntity("item", { ...entity, done: next, completedAt: next ? Date.now() : null });
          return (
            <WorkspaceTicket key={`item-${i.id}`} family="item" entity={i} secretary={secretary} onToggleDone={toggleDone} onEdit={openTicket} onNavigateKind={onNavigateKind} onAskSecretary={askSecretaryLocal} onReparentItem={reparentItem} />
          );
        })}
      </div>
      {kinds.length === 0 && items.length === 0 && <Note>Nothing matches these filters.</Note>}

      <div ref={galleryRef} style={{ marginTop: 26 }}>
        <SectionTitle note={`${activeIdx + 1} of ${VIEWS.length}`}>Views</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <IconButton title="Previous view" onClick={() => cycleView(-1)}>←</IconButton>
          <div style={{ display: "flex", flexWrap: "wrap", gap: GAP_ROW, flex: 1 }}>
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveView(v.id)}
                style={{
                  border: v.id === active.id ? "none" : `1px solid ${LINE}`, cursor: "pointer", borderRadius: 999,
                  fontFamily: MONO, fontSize: 11, padding: "6px 11px",
                  background: v.id === active.id ? INK : "transparent", color: v.id === active.id ? CARD : MUTE,
                }}
              >{v.label}</button>
            ))}
          </div>
          <IconButton title="Next view" onClick={() => cycleView(1)}>→</IconButton>
        </div>
        <Card>
          <PanelHeader>{active.label}</PanelHeader>
          <Note>{active.note}</Note>
          <div style={{ marginTop: 10 }}>{active.body}</div>
        </Card>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginTop: 22 }}>
        <Card style={{ flex: "1 1 240px" }}>
          <PanelHeader>Shortcuts</PanelHeader>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Btn small onClick={() => onNavigate?.("/search")}>Search</Btn>
            <Btn small onClick={() => onNavigate?.("/log")}>Log</Btn>
            <Btn small onClick={() => onNavigate?.("/secretary")}>Secretary</Btn>
            <Btn small onClick={() => onNavigate?.("/settings")}>Settings</Btn>
          </div>
        </Card>

        <div ref={chatRef} style={{ flex: "2 1 380px" }}>
          <Card>
            <PanelHeader action={focused && <Btn small color={MUTE} onClick={() => setFocused(null)}>Unfocus</Btn>}>
              Chat{focused ? ` — ${focused.entity.title}` : ""}
            </PanelHeader>
            <SecretaryChatPanel
              secretary={secretary}
              entityContext={focused ? { family: focused.family, id: focused.entity.id, title: focused.entity.title } : null}
            />
          </Card>
        </div>
      </div>

      {adding && <AddForm secretary={secretary} onClose={() => setAdding(false)} />}
      {editing && (
        <EditEntityModal
          family={editing.family} entity={editing.entity} secretary={secretary}
          onClose={() => setEditing(null)} onDeleted={() => { setEditing(null); setFocused(null); }}
        />
      )}
      {disciplineModal && (
        <DisciplineDetailModal
          discipline={disciplineModal} secretary={secretary} onClose={() => setDisciplineModal(null)}
          onAskSecretary={askSecretaryLocal}
        />
      )}
    </div>
  );
}
