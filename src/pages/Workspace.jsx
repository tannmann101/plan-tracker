import { useEffect, useState } from "react";
import { Btn, SectionTitle, Note, Pill, Card, Select, ExpandableRail } from "../ui";
import { MONO, SANS, INK, MUTE, INKBLUE, DOMAIN_COLORS, STATUS_COLORS, softTint } from "../theme";
import { useViewport } from "../useViewport";
import { EntityCard } from "../components/EntityCard";
import EditEntityModal from "../components/EditEntityModal";
import AddForm from "../components/AddForm";
import { Timeline, BarChart, WeeklyBarChart, DetailList } from "../components/charts";
import { SecretaryChatPanel } from "./Secretary";
import { KIND_STATUSES, domainLabel, weekStartISO, addDaysISO } from "../constants";

// Last `n` week-starts (oldest first), each with a count of Items whose
// completedAt fell in that week -- the tasks-completed-over-time panel.
// items carries the actual completed Items (family-tagged) behind each
// week's count so the WeeklyBarChart can drill down the same way every
// other chart on this page now does.
function completedByWeek(items, n = 8) {
  const weeks = [];
  let cursor = weekStartISO();
  for (let i = 0; i < n; i++) {
    weeks.unshift(cursor);
    cursor = addDaysISO(cursor, -7);
  }
  return weeks.map((week) => {
    const end = addDaysISO(week, 7);
    const weekItems = (items || []).filter((it) => it.done && it.completedAt && it.completedAt >= new Date(`${week}T00:00:00`).getTime() && it.completedAt < new Date(`${end}T00:00:00`).getTime());
    return { week, count: weekItems.length, items: weekItems.map((entity) => ({ family: "item", entity })) };
  });
}

// A panel header used consistently across every "own space" section below --
// title, optional note, optional right-aligned action -- so the page reads
// as a set of clearly bounded control surfaces rather than one long stack.
function PanelHeader({ children, note, action }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
      <div style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: INK }}>{children}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {note && <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE }}>{note}</span>}
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
function WorkspaceTicket({ family, entity, secretary, onEdit, onNavigateKind, onToggleDone }) {
  const changeStatus = (status) => secretary.saveEntity("kind", { ...entity, status });
  return (
    <div>
      <EntityCard family={family} entity={entity} secretary={secretary} onEdit={onEdit} onNavigateKind={onNavigateKind} onToggleDone={onToggleDone} />
      {family === "kind" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, padding: "0 2px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLORS[entity.status] || MUTE, flex: "none" }} />
          <Select value={entity.status} onChange={changeStatus} options={KIND_STATUSES} width="100%" />
        </div>
      )}
    </div>
  );
}

// §10 -- the full Kind/Item ticket board, and the household's "super-admin"
// page: every entity, chart, and filter here is meant to be a live control,
// not a static readout. Clicking a ticket opens the edit modal *and*
// focuses the Secretary chat on that entity (reusing Secretary.jsx's chat
// panel rather than a second implementation), so a conversation about a
// ticket and editing it sit side by side. The board runs full width now
// (desktop widened this considerably) -- the supporting panels
// (filters, insights, shortcuts, chat) get their own genuinely separate
// row of Cards below rather than being squeezed into a narrow side rail.
export default function Workspace({ secretary, onBack, onNavigateKind, onNavigate, focusKindId, onFocusHandled }) {
  const { isDesktop } = useViewport();
  const [showDone, setShowDone] = useState(false);
  const [domainFilter, setDomainFilter] = useState(null);
  const [resourceFilter, setResourceFilter] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [focused, setFocused] = useState(null); // { family, entity } -- scopes the chat panel
  const [expandedWeek, setExpandedWeek] = useState(null);

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

  const openTicket = (family, entity) => {
    setEditing({ family, entity });
    setFocused({ family, entity });
  };

  // A Timeline node click used to only re-scope the chat (via onNavigateKind,
  // which just re-navigates to this same page); now it opens the edit modal
  // directly too, same as any other ticket -- there was no reason a due-date
  // marker should be less clickable than the card it came from.
  const openTimelineKind = (kindId) => {
    const kind = (secretary.kinds || []).find((k) => k.id === kindId);
    if (kind) openTicket("kind", kind);
  };

  const weekStart = weekStartISO();
  const weekEnd = addDaysISO(weekStart, 7);
  const weekItems = (secretary.items || []).filter((i) => i.timing?.targetDay && i.timing.targetDay >= weekStart && i.timing.targetDay < weekEnd);

  const domainBuckets = {};
  for (const [family, list] of [["kind", secretary.kinds || []], ["item", secretary.items || []]]) {
    for (const entity of list) {
      if (!entity.domain) continue;
      (domainBuckets[entity.domain] ||= []).push({ family, entity });
    }
  }
  const domainRows = Object.entries(domainBuckets).sort((a, b) => b[1].length - a[1].length)
    .map(([id, entities]) => ({ label: domainLabel(id, secretary.domains), count: entities.length, color: DOMAIN_COLORS[id] || MUTE, id, entities }));
  const expandedDomainRow = domainRows.find((r) => r.id === domainFilter);

  const completedSeries = [{ key: "count", label: "Completed", color: INKBLUE }];
  const completedData = completedByWeek(secretary.items);
  const expandedWeekRow = completedData.find((d) => d.week === expandedWeek);

  const timelineRows = (secretary.kinds || [])
    .filter((k) => k.timing?.dueDate)
    .map((k) => ({ id: k.id, title: k.title, date: k.timing.dueDate, startDate: k.timing.startDate || null, color: DOMAIN_COLORS[k.domain] || INKBLUE }));

  const insightColumns = isDesktop ? "repeat(3, minmax(260px, 1fr))" : "1fr";

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Back</Btn>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <SectionTitle note="every entity is a live control -- click a ticket, a due-date marker, or a chart bar">Workspace</SectionTitle>
        <Btn small primary color={INKBLUE} onClick={() => setAdding(true)}>+ Add</Btn>
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
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 11.5, color: MUTE, cursor: "pointer", marginBottom: 12 }}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Show done/archived
        </label>
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Domain</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
          {secretary.domains.map((d) => (
            <button key={d.id} type="button" onClick={() => setDomainFilter(domainFilter === d.id ? null : d.id)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}>
              <Pill color={DOMAIN_COLORS[d.id] || MUTE} tint={domainFilter === d.id ? softTint(DOMAIN_COLORS[d.id] || MUTE) : undefined}>{d.label}</Pill>
            </button>
          ))}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Resource</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 90, overflowY: "auto" }}>
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
          <WorkspaceTicket key={`kind-${k.id}`} family="kind" entity={k} secretary={secretary} onEdit={openTicket} onNavigateKind={onNavigateKind} />
        ))}
        {items.map((i) => {
          const toggleDone = (entity, next) => secretary.saveEntity("item", { ...entity, done: next, completedAt: next ? Date.now() : null });
          return (
            <WorkspaceTicket key={`item-${i.id}`} family="item" entity={i} secretary={secretary} onToggleDone={toggleDone} onEdit={openTicket} onNavigateKind={onNavigateKind} />
          );
        })}
      </div>
      {kinds.length === 0 && items.length === 0 && <Note>Nothing matches these filters.</Note>}

      <Card style={{ marginTop: 22, marginBottom: 22 }}>
        <PanelHeader note="due dates -- click a marker to edit that Kind directly">Timeline</PanelHeader>
        <Timeline rows={timelineRows} onClick={openTimelineKind} />
      </Card>

      <SectionTitle note="each in its own space">Insights</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: insightColumns, gap: 14, marginBottom: 22 }}>
        <Card>
          <PanelHeader>This week</PanelHeader>
          <Note>{weekItems.length} Item{weekItems.length === 1 ? "" : "s"} placed, {weekItems.filter((i) => i.done).length} done.</Note>
        </Card>

        <Card>
          <ExpandableRail title="Domain distribution -- click a bar to filter the board, below">
            {domainRows.length === 0 ? <Note>Nothing yet.</Note> : (
              <>
                <BarChart rows={domainRows} onBarClick={(id) => setDomainFilter(domainFilter === id ? null : id)} activeId={domainFilter} />
                {expandedDomainRow && <DetailList items={expandedDomainRow.entities} onOpen={openTicket} />}
              </>
            )}
          </ExpandableRail>
        </Card>

        <Card>
          <ExpandableRail title="Completed, last 8 weeks -- click a bar to see what's done">
            <WeeklyBarChart data={completedData} series={completedSeries} onBarClick={(week) => setExpandedWeek(expandedWeek === week ? null : week)} activeId={expandedWeek} />
            {expandedWeekRow && <DetailList items={expandedWeekRow.items} onOpen={openTicket} emptyLabel="Nothing completed this week." />}
          </ExpandableRail>
        </Card>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Card style={{ flex: "1 1 240px" }}>
          <PanelHeader>Shortcuts</PanelHeader>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Btn small onClick={() => onNavigate?.("/search")}>Search</Btn>
            <Btn small onClick={() => onNavigate?.("/log")}>Log</Btn>
            <Btn small onClick={() => onNavigate?.("/secretary")}>Secretary</Btn>
            <Btn small onClick={() => onNavigate?.("/settings")}>Settings</Btn>
          </div>
        </Card>

        <Card style={{ flex: "2 1 380px" }}>
          <PanelHeader action={focused && <Btn small color={MUTE} onClick={() => setFocused(null)}>Unfocus</Btn>}>
            Chat{focused ? ` — ${focused.entity.title}` : ""}
          </PanelHeader>
          <SecretaryChatPanel
            secretary={secretary}
            entityContext={focused ? { family: focused.family, id: focused.entity.id, title: focused.entity.title } : null}
          />
        </Card>
      </div>

      {adding && <AddForm secretary={secretary} onClose={() => setAdding(false)} />}
      {editing && (
        <EditEntityModal
          family={editing.family} entity={editing.entity} secretary={secretary}
          onClose={() => setEditing(null)} onDeleted={() => { setEditing(null); setFocused(null); }}
        />
      )}
    </div>
  );
}
