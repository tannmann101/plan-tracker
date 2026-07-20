import { DOMAINS, STATUSES, KINDS, OWNERS, OPEN_STATUSES, isStale, todayISO } from "./constants";
import { DOMAIN_COLORS, STATUS_COLORS, MONO, MUTE, MUTE_SOFT, INK, LINE, TEAL, GOLD } from "./theme";
import { SectionTitle, Note, Card } from "./ui";
import ItemRow from "./ItemRow";

const OWNER_COLORS = { tanner: TEAL, rochelle: GOLD };

function weekAheadISO() {
  const d = new Date(todayISO() + "T00:00:00");
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function StatTile({ label, value, sub, flag }) {
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: "10px 12px", background: "#FFF" }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: flag ? STATUS_COLORS.dropped : INK, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontFamily: MONO, fontSize: 10, color: MUTE_SOFT, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// Shared horizontal bar list -- used for the domain, kind, and owner
// breakdowns below. Every bar carries a direct text label + count (never
// color alone), same convention as Trends' DomainBarChart.
function HBarChart({ rows, colorFor, labelWidth = 150 }) {
  const W = 700, PAD_R = 34, PAD_T = 6, PAD_B = 6;
  const innerW = W - labelWidth - PAD_R;
  const rowH = 26;
  const H = rows.length * rowH + PAD_T + PAD_B;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 300, display: "block" }}>
      {rows.map((r, i) => {
        const y = PAD_T + rowH * i + rowH * 0.22;
        const h = rowH * 0.56;
        const w = (r.count / max) * innerW;
        const color = colorFor(r);
        return (
          <g key={r.id}>
            <text x={labelWidth - 8} y={y + h / 2 + 3} textAnchor="end" fontFamily={MONO} fontSize="10.5" fill={MUTE}>{r.label}</text>
            <rect x={labelWidth} y={y} width={Math.max(2, w)} height={h} fill={color} rx="3" />
            <text x={labelWidth + Math.max(2, w) + 7} y={y + h / 2 + 3} fontFamily={MONO} fontSize="10.5" fontWeight="700" fill={INK}>{r.count}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Single stacked bar across every status, direct-labeled beneath since the
// six status hues (see theme.js) aren't reliably distinguishable on their own.
function StatusMixBar({ counts, total }) {
  const W = 700, H = 26;
  let x = 0;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 200, display: "block" }}>
        {counts.map((s) => {
          const w = total ? (s.count / total) * W : 0;
          const rect = <rect key={s.id} x={x} y={0} width={Math.max(0, w - 2)} height={H} fill={STATUS_COLORS[s.id]} rx="3" />;
          x += w;
          return rect;
        })}
      </svg>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 6, marginTop: 12 }}>
        {counts.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontFamily: MONO, fontSize: 11.5, color: MUTE }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLORS[s.id], flex: "none" }} />
              {s.label}
            </span>
            <span style={{ color: INK, fontWeight: 700 }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Overview({ items, onEdit, onStatusChange, onDelete }) {
  const openNow = items.filter((i) => OPEN_STATUSES.includes(i.status));
  const stale = openNow.filter(isStale).sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
  const today = todayISO();
  const weekAhead = weekAheadISO();
  const dueThisWeek = openNow.filter((i) => i.targetDate && i.targetDate >= today && i.targetDate <= weekAhead);
  const noTarget = openNow.filter((i) => !i.targetDate);

  const statusCounts = STATUSES.map((s) => ({ ...s, count: items.filter((i) => i.status === s.id).length }));
  const domainRows = DOMAINS.map((d) => ({ id: d.id, label: d.label, count: openNow.filter((i) => i.domain === d.id).length }));
  const kindRows = KINDS
    .map((k) => ({ id: k.id, label: k.label, count: openNow.filter((i) => i.kind === k.id).length }))
    .sort((a, b) => b.count - a.count);
  const ownerRows = OWNERS.map((o) => ({ id: o.id, label: o.label, count: openNow.filter((i) => i.owner === o.id).length }));

  return (
    <div>
      <SectionTitle note={`${items.length} items`}>Overview</SectionTitle>
      <Note>Where things stand right now, across every domain: what's open, who owns it, and what's gone quiet.</Note>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 14 }}>
        <StatTile label="Open now" value={openNow.length} />
        <StatTile label="Stale" value={stale.length} sub="14+ days untouched" flag={stale.length > 0} />
        <StatTile label="Due this week" value={dueThisWeek.length} />
        <StatTile label="No target date" value={noTarget.length} sub="among open items" />
      </div>

      <Card style={{ marginTop: 20 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Status mix -- every item ({items.length})
        </div>
        <StatusMixBar counts={statusCounts} total={items.length} />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Open by domain ({openNow.length})
        </div>
        <HBarChart rows={domainRows} colorFor={(r) => DOMAIN_COLORS[r.id]} />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Open by kind ({openNow.length})
        </div>
        <HBarChart rows={kindRows} colorFor={() => TEAL} labelWidth={120} />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Owner split ({openNow.length})
        </div>
        <HBarChart rows={ownerRows} colorFor={(r) => OWNER_COLORS[r.id]} labelWidth={90} />
      </Card>

      <SectionTitle note={`${stale.length} stale`}>Stale</SectionTitle>
      <Note>Open or in-progress items untouched for 14+ days, oldest first.</Note>
      <div style={{ marginTop: 14 }}>
        {stale.length === 0 ? (
          <div style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, padding: "20px 4px" }}>Nothing stale -- everything open has moved in the last two weeks.</div>
        ) : (
          stale.map((item) => (
            <ItemRow key={item.id} item={item} onEdit={onEdit} onStatusChange={onStatusChange} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  );
}
