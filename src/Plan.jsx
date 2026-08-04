import { useState } from "react";
import { DOMAINS, OPEN_STATUSES, itemType, todayISO, directChildren, descendantProgress, parentTitleOf } from "./constants";
import { DOMAIN_COLORS, MONO, MUTE, TEAL, LINE, softTint } from "./theme";
import { Note, Btn } from "./ui";
import ItemRow from "./ItemRow";

const HORIZONS = [
  { id: "day", label: "Day", note: "What's on deck for today, most overdue first." },
  { id: "week", label: "Week", note: "Every open item, soonest target date first." },
  { id: "month", label: "Month", note: "Every item, any status, grouped by domain." },
  { id: "quarter", label: "Quarter", note: "Every plan, with its linked tasks." },
  { id: "year", label: "Year", note: "Every goal, with its linked plans and tasks." },
];

function HorizonSwitcher({ horizon, onChange }) {
  return (
    <div style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
      {HORIZONS.map((h) => (
        <Btn key={h.id} small primary={horizon === h.id} color={TEAL} onClick={() => onChange(h.id)}>
          {h.label}
        </Btn>
      ))}
    </div>
  );
}

function EmptyState({ children }) {
  return <div style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, padding: "20px 4px" }}>{children}</div>;
}

// Today's dashboard slice -- open items on deck for today, most overdue
// first. Items with no target date never appear here (nothing to be behind
// on); they still show up in Week.
function todaysDashboard(items) {
  const today = todayISO();
  return items
    .filter((i) => OPEN_STATUSES.includes(i.status) && i.targetDate && i.targetDate <= today)
    .sort((a, b) => (a.targetDate < b.targetDate ? -1 : a.targetDate > b.targetDate ? 1 : 0));
}

function sortForTriage(items) {
  return [...items].sort((a, b) => {
    if (a.targetDate && b.targetDate) return a.targetDate < b.targetDate ? -1 : 1;
    if (a.targetDate) return -1;
    if (b.targetDate) return 1;
    return a.createdDate < b.createdDate ? -1 : 1;
  });
}

// Renders an item plus its linked children indented beneath it, recursively
// -- used by Quarter (plan -> tasks) and Year (goal -> plans -> tasks). Only
// the root of each tree gets a "part of X" breadcrumb (if it's itself linked
// to something higher up) -- children below it are already visibly nested
// under their parent, so a breadcrumb there would just repeat the tree.
function Nested({ item, items, depth = 0, onEdit, onStatusChange, onDelete }) {
  const kids = directChildren(items, item.id);
  const prog = depth === 0 ? descendantProgress(items, item.id) : null;
  return (
    <div style={{ marginBottom: kids.length ? 10 : 0 }}>
      <ItemRow item={item} parentTitle={depth === 0 ? parentTitleOf(items, item) : undefined} onEdit={onEdit} onStatusChange={onStatusChange} onDelete={onDelete} />
      {prog && prog.total > 0 && (
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, padding: "2px 4px 6px" }}>
          {prog.done}/{prog.total} done across linked plans &amp; tasks
        </div>
      )}
      {kids.length > 0 && (
        <div style={{ marginLeft: 20, borderLeft: `2px solid ${LINE}`, paddingLeft: 10 }}>
          {kids.map((k) => (
            <Nested key={k.id} item={k} items={items} depth={depth + 1} onEdit={onEdit} onStatusChange={onStatusChange} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Plan({ items, onEdit, onStatusChange, onDelete }) {
  const [horizon, setHorizon] = useState("day");
  const active = HORIZONS.find((h) => h.id === horizon);

  const rowProps = { onEdit, onStatusChange, onDelete };

  let count = 0;
  let countLabel = "";
  let body;

  if (horizon === "day") {
    const dashboard = todaysDashboard(items);
    count = dashboard.length;
    countLabel = "today";
    body = dashboard.length === 0
      ? <EmptyState>Nothing on deck today.</EmptyState>
      : dashboard.map((item) => <ItemRow key={item.id} item={item} parentTitle={parentTitleOf(items, item)} {...rowProps} />);
  } else if (horizon === "week") {
    const open = sortForTriage(items.filter((i) => OPEN_STATUSES.includes(i.status)));
    count = open.length;
    countLabel = "open";
    body = open.length === 0
      ? <EmptyState>Nothing open. Add an item above.</EmptyState>
      : open.map((item) => <ItemRow key={item.id} item={item} parentTitle={parentTitleOf(items, item)} {...rowProps} />);
  } else if (horizon === "month") {
    count = items.length;
    countLabel = "total";
    body = DOMAINS.map((domain) => {
      const domainItems = items.filter((i) => i.domain === domain.id);
      return (
        <div key={domain.id} style={{ marginTop: 26 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 11.5, fontWeight: 600,
            color: DOMAIN_COLORS[domain.id], textTransform: "uppercase", letterSpacing: "0.05em",
            background: softTint(DOMAIN_COLORS[domain.id]), padding: "6px 10px", borderRadius: 6,
          }}>
            {domain.label} <span style={{ color: MUTE, fontWeight: 400 }}>({domainItems.length})</span>
          </div>
          <div style={{ marginTop: 6 }}>
            {domainItems.length === 0 ? (
              <EmptyState>No items in this domain.</EmptyState>
            ) : (
              domainItems.map((item) => <ItemRow key={item.id} item={item} showDomain={false} parentTitle={parentTitleOf(items, item)} {...rowProps} />)
            )}
          </div>
        </div>
      );
    });
  } else if (horizon === "quarter") {
    const plans = items.filter((i) => itemType(i) === "plan");
    count = plans.length;
    countLabel = "plans";
    body = plans.length === 0
      ? <EmptyState>No plans yet -- add one and set its Type to Plan.</EmptyState>
      : plans.map((item) => <Nested key={item.id} item={item} items={items} {...rowProps} />);
  } else {
    const goals = items.filter((i) => itemType(i) === "goal");
    count = goals.length;
    countLabel = "goals";
    body = goals.length === 0
      ? <EmptyState>No goals yet -- add one and set its Type to Goal.</EmptyState>
      : goals.map((item) => <Nested key={item.id} item={item} items={items} {...rowProps} />);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <HorizonSwitcher horizon={horizon} onChange={setHorizon} />
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE }}>{count} {countLabel}</span>
      </div>
      <Note>{active.note}</Note>
      <div style={{ marginTop: 14 }}>{body}</div>
    </div>
  );
}
