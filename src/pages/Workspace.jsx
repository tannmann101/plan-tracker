import { useEffect, useState } from "react";
import { Btn, SectionTitle, Note, Pill, ExpandableRail } from "../ui";
import { MONO, MUTE, INKBLUE, DOMAIN_COLORS, softTint } from "../theme";
import { EntityCard } from "../components/EntityCard";
import EditEntityModal from "../components/EditEntityModal";
import AddForm from "../components/AddForm";
import { Timeline, HorizontalBarChart, WeeklyBarChart } from "../components/charts";
import { SecretaryChatPanel } from "./Secretary";
import { domainLabel, weekStartISO, addDaysISO } from "../constants";

// Last `n` week-starts (oldest first), each with a count of Items whose
// completedAt fell in that week -- the tasks-completed-over-time panel.
function completedByWeek(items, n = 8) {
  const weeks = [];
  let cursor = weekStartISO();
  for (let i = 0; i < n; i++) {
    weeks.unshift(cursor);
    cursor = addDaysISO(cursor, -7);
  }
  return weeks.map((week) => {
    const end = addDaysISO(week, 7);
    const count = (items || []).filter((it) => it.done && it.completedAt && it.completedAt >= new Date(`${week}T00:00:00`).getTime() && it.completedAt < new Date(`${end}T00:00:00`).getTime()).length;
    return { week, count };
  });
}

// §10 -- the full Kind/Item ticket board. Clicking a card opens the edit
// modal *and* focuses the Secretary chat on that entity (reusing
// Secretary.jsx's chat panel rather than a second implementation), so a
// conversation about a ticket and editing it sit side by side.
export default function Workspace({ secretary, onBack, onNavigateKind, onNavigate, focusKindId, onFocusHandled }) {
  const [showDone, setShowDone] = useState(false);
  const [domainFilter, setDomainFilter] = useState(null);
  const [resourceFilter, setResourceFilter] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [focused, setFocused] = useState(null); // { family, entity } -- scopes the chat panel

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

  const weekStart = weekStartISO();
  const weekEnd = addDaysISO(weekStart, 7);
  const weekItems = (secretary.items || []).filter((i) => i.timing?.targetDay && i.timing.targetDay >= weekStart && i.timing.targetDay < weekEnd);

  const domainCounts = {};
  for (const e of [...(secretary.kinds || []), ...(secretary.items || [])]) domainCounts[e.domain] = (domainCounts[e.domain] || 0) + 1;
  const domainRows = Object.entries(domainCounts).sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ label: domainLabel(id, secretary.domains), count, color: DOMAIN_COLORS[id] || MUTE, id }));

  const completedSeries = [{ key: "count", label: "Completed", color: INKBLUE }];
  const completedData = completedByWeek(secretary.items);

  const timelineRows = (secretary.kinds || [])
    .filter((k) => k.timing?.dueDate)
    .map((k) => ({ id: k.id, title: k.title, date: k.timing.dueDate, startDate: k.timing.startDate || null, color: DOMAIN_COLORS[k.domain] || INKBLUE }));

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Back</Btn>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <SectionTitle>Workspace</SectionTitle>
        <Btn small primary color={INKBLUE} onClick={() => setAdding(true)}>+ Add</Btn>
      </div>

      <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "3 1 480px", minWidth: 280 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 11.5, color: MUTE, cursor: "pointer" }}>
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
              Show done/archived
            </label>
            {(domainFilter || resourceFilter) && (
              <Btn small color={MUTE} onClick={() => { setDomainFilter(null); setResourceFilter(null); }}>Clear filters</Btn>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
            {kinds.map((k) => (
              <EntityCard key={`kind-${k.id}`} family="kind" entity={k} secretary={secretary} onEdit={openTicket} onNavigateKind={onNavigateKind} />
            ))}
            {items.map((i) => {
              const toggleDone = (entity, next) => secretary.saveEntity("item", { ...entity, done: next, completedAt: next ? Date.now() : null });
              return (
                <EntityCard key={`item-${i.id}`} family="item" entity={i} secretary={secretary} onToggleDone={toggleDone} onEdit={openTicket} onNavigateKind={onNavigateKind} />
              );
            })}
          </div>
          {kinds.length === 0 && items.length === 0 && <Note>Nothing matches these filters.</Note>}

          <SectionTitle note="due dates">Timeline</SectionTitle>
          <Timeline rows={timelineRows} onClick={onNavigateKind} />
        </div>

        <div style={{ flex: "1 1 280px", minWidth: 260 }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>This week</div>
          <Note>{weekItems.length} Item{weekItems.length === 1 ? "" : "s"} placed, {weekItems.filter((i) => i.done).length} done.</Note>

          <div style={{ marginTop: 18 }}>
            <ExpandableRail title="Domain distribution">
              {domainRows.length === 0 ? <Note>Nothing yet.</Note> : <HorizontalBarChart rows={domainRows} />}
            </ExpandableRail>
          </div>

          <div style={{ marginTop: 18 }}>
            <ExpandableRail title="Completed, last 8 weeks">
              <WeeklyBarChart data={completedData} series={completedSeries} />
            </ExpandableRail>
          </div>

          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", margin: "18px 0 8px" }}>Filter by domain</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {secretary.domains.map((d) => (
              <button key={d.id} type="button" onClick={() => setDomainFilter(domainFilter === d.id ? null : d.id)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}>
                <Pill color={DOMAIN_COLORS[d.id] || MUTE} tint={domainFilter === d.id ? softTint(DOMAIN_COLORS[d.id] || MUTE) : undefined}>{d.label}</Pill>
              </button>
            ))}
          </div>

          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 8px" }}>Filter by resource</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 110, overflowY: "auto" }}>
            {secretary.resources.map((r) => (
              <button key={r} type="button" onClick={() => setResourceFilter(resourceFilter === r ? null : r)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}>
                <Pill color={MUTE} tint={resourceFilter === r ? softTint(MUTE) : undefined}>{r}</Pill>
              </button>
            ))}
          </div>

          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", margin: "18px 0 8px" }}>Shortcuts</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
            <Btn small onClick={() => onNavigate?.("/search")}>Search</Btn>
            <Btn small onClick={() => onNavigate?.("/log")}>Log</Btn>
            <Btn small onClick={() => onNavigate?.("/secretary")}>Secretary</Btn>
            <Btn small onClick={() => onNavigate?.("/settings")}>Settings</Btn>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Chat{focused ? ` — ${focused.entity.title}` : ""}
            </div>
            {focused && <Btn small color={MUTE} onClick={() => setFocused(null)}>Unfocus</Btn>}
          </div>
          <SecretaryChatPanel
            secretary={secretary}
            entityContext={focused ? { family: focused.family, id: focused.entity.id, title: focused.entity.title } : null}
          />
        </div>
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
