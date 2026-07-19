import { DOMAINS } from "./constants";
import { DOMAIN_COLORS, softTint, MONO, MUTE } from "./theme";
import { SectionTitle, Note } from "./ui";
import ItemRow from "./ItemRow";

// Every item (any status), grouped by domain -- a full domain-by-domain
// check-in, not just the actionable subset the weekly triage covers.
export default function MonthlyCheckin({ items, onEdit, onStatusChange, onDelete }) {
  return (
    <div>
      <SectionTitle note={`${items.length} total`}>Monthly Domain Check-In</SectionTitle>
      <Note>Every item, grouped by domain, regardless of status -- for a full walk through each area of the plan once a month.</Note>

      {DOMAINS.map((domain) => {
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
                <div style={{ fontFamily: MONO, fontSize: 12, color: MUTE, padding: "10px 4px" }}>No items in this domain.</div>
              ) : (
                domainItems.map((item) => (
                  <ItemRow key={item.id} item={item} showDomain={false} onEdit={onEdit} onStatusChange={onStatusChange} onDelete={onDelete} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
