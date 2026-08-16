import { useState } from "react";
import { Btn, SectionTitle, Note, Pill, Input, TabBar } from "../ui";
import { MONO, SANS, INK, MUTE, LINE, DOMAIN_COLORS, softTint } from "../theme";
import EditEntityModal from "../components/EditEntityModal";
import { domainLabel, kindTypeLabel, itemTypeLabel, weekStartISO } from "../constants";

const ROLLUP_TABS = [
  { id: "all", label: "All" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
];

const FAMILY_TABS = [
  { id: "all", label: "All" },
  { id: "kind", label: "Kinds" },
  { id: "item", label: "Items" },
];

// A row's one representative date -- an Item's target/due day, a Kind's
// due date, or (failing either) whenever it was last touched. Used for
// sorting, the Dates column, and the Daily/Weekly rollup grouping.
function rowDate(family, entity) {
  if (family === "item") return entity.timing?.targetDay || entity.timing?.dueDate || null;
  return entity.timing?.dueDate || null;
}

// Entities carry no free-text description field (§1's field list is
// title/type/domain/resources/tags/timing only) -- this synthesizes a
// terse one from what each row does carry, standing in for the spec's
// "Description" column rather than leaving it blank.
function rowDescription(family, entity, domains) {
  const type = family === "kind" ? kindTypeLabel(entity.kindType) : itemTypeLabel(entity.itemType);
  const bits = [domainLabel(entity.domain, domains), type];
  if ((entity.resources || []).length) bits.push(entity.resources.join(", "));
  return bits.join(" · ");
}

export default function Log({ secretary, onBack }) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rollup, setRollup] = useState("all");
  const [editing, setEditing] = useState(null);

  const allRows = [
    ...(secretary.kinds || []).map((entity) => ({ family: "kind", entity })),
    ...(secretary.items || []).map((entity) => ({ family: "item", entity })),
  ];

  const q = query.trim().toLowerCase();
  const tagQ = tagFilter.trim().toLowerCase();
  const rows = allRows.filter(({ family: fam, entity }) => {
    if (family !== "all" && fam !== family) return false;
    if (domainFilter !== "all" && entity.domain !== domainFilter) return false;
    if (q && !entity.title.toLowerCase().includes(q)) return false;
    if (tagQ && !(entity.tags || []).some((t) => t.includes(tagQ))) return false;
    const date = rowDate(fam, entity);
    if (from && (!date || date < from)) return false;
    if (to && (!date || date > to)) return false;
    return true;
  }).sort((a, b) => (rowDate(b.family, b.entity) || "").localeCompare(rowDate(a.family, a.entity) || ""));

  const groups = (() => {
    if (rollup === "all") return [{ label: null, rows }];
    const key = (r) => {
      const d = rowDate(r.family, r.entity);
      if (!d) return "Undated";
      return rollup === "weekly" ? weekStartISO(new Date(`${d}T00:00:00`)) : d;
    };
    const map = new Map();
    for (const r of rows) {
      const k = key(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    }
    return [...map.entries()]
      .sort((a, b) => (b[0] || "").localeCompare(a[0] || ""))
      .map(([label, groupRows]) => ({ label, rows: groupRows }));
  })();

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Back</Btn>
      <SectionTitle>Log</SectionTitle>
      <Note>Every Kind and Item, edit-only -- there's no Add here (§8). Tap a row to edit it.</Note>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}>
        <Input value={query} onChange={setQuery} placeholder="Search title…" width={220} />
        <Input value={tagFilter} onChange={setTagFilter} placeholder="Tag contains…" width={160} />
        <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} style={{ fontFamily: MONO, fontSize: 12, padding: "6px 9px", border: `1px solid ${LINE}`, borderRadius: 8 }}>
          <option value="all">All domains</option>
          {secretary.domains.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        <Input type="date" value={from} onChange={setFrom} width={140} />
        <span style={{ fontFamily: MONO, fontSize: 11, color: MUTE }}>→</span>
        <Input type="date" value={to} onChange={setTo} width={140} />
        <FamilyTabs value={family} onChange={setFamily} />
        <TabBar tabs={ROLLUP_TABS} active={rollup} onChange={setRollup} />
      </div>

      {rows.length === 0 ? (
        <Note>Nothing matches these filters.</Note>
      ) : groups.map((group) => (
        <div key={group.label || "all"} style={{ marginBottom: 20 }}>
          {group.label && (
            <div style={{ fontFamily: MONO, fontSize: 11, color: INK, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
              {group.label}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Title", "Kind/Item", "Date", "Description", "Tags"].map((h) => (
                    <th key={h} style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", padding: "0 10px 8px 0", borderBottom: `1px solid ${LINE}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map(({ family: fam, entity }) => (
                  <tr key={`${fam}-${entity.id}`} onClick={() => setEditing({ family: fam, entity })} style={{ cursor: "pointer" }}>
                    <td style={{ padding: "8px 10px 8px 0", borderBottom: `1px solid ${LINE}`, fontFamily: SANS, fontSize: 13, color: INK, textDecoration: (fam === "item" && entity.done) || (fam === "kind" && entity.status === "done") ? "line-through" : "none" }}>
                      {entity.title}
                    </td>
                    <td style={{ padding: "8px 10px 8px 0", borderBottom: `1px solid ${LINE}` }}>
                      <Pill color={DOMAIN_COLORS[entity.domain] || MUTE} tint={softTint(DOMAIN_COLORS[entity.domain] || MUTE)}>
                        {fam === "kind" ? kindTypeLabel(entity.kindType) : itemTypeLabel(entity.itemType)}
                      </Pill>
                    </td>
                    <td style={{ padding: "8px 10px 8px 0", borderBottom: `1px solid ${LINE}`, fontFamily: MONO, fontSize: 11.5, color: MUTE }}>
                      {rowDate(fam, entity) || "—"}
                    </td>
                    <td style={{ padding: "8px 10px 8px 0", borderBottom: `1px solid ${LINE}`, fontFamily: MONO, fontSize: 11.5, color: MUTE }}>
                      {rowDescription(fam, entity, secretary.domains)}
                    </td>
                    <td style={{ padding: "8px 10px 8px 0", borderBottom: `1px solid ${LINE}` }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {(entity.tags || []).map((t) => <Pill key={t}>#{t}</Pill>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {editing && (
        <EditEntityModal
          family={editing.family} entity={editing.entity} secretary={secretary}
          onClose={() => setEditing(null)} onDeleted={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function FamilyTabs({ value, onChange }) {
  return <TabBar tabs={FAMILY_TABS} active={value} onChange={onChange} />;
}
