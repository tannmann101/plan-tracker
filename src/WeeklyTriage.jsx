import { OPEN_STATUSES } from "./constants";
import { MONO, MUTE } from "./theme";
import { SectionTitle, Note } from "./ui";
import ItemRow from "./ItemRow";

// All open + in-progress items, soonest target date first (items with no
// target date sort last, then by created date so older intake surfaces first).
function sortForTriage(items) {
  return [...items].sort((a, b) => {
    if (a.targetDate && b.targetDate) return a.targetDate < b.targetDate ? -1 : 1;
    if (a.targetDate) return -1;
    if (b.targetDate) return 1;
    return a.createdDate < b.createdDate ? -1 : 1;
  });
}

export default function WeeklyTriage({ items, onEdit, onStatusChange, onDelete }) {
  const open = sortForTriage(items.filter((i) => OPEN_STATUSES.includes(i.status)));

  return (
    <div>
      <SectionTitle note={`${open.length} open`}>Weekly Triage</SectionTitle>
      <Note>Every open or in-progress item, soonest target date first. Work through it, update status, or drop what no longer matters.</Note>
      <div style={{ marginTop: 14 }}>
        {open.length === 0 ? (
          <div style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, padding: "20px 4px" }}>Nothing open. Add an item above.</div>
        ) : (
          open.map((item) => (
            <ItemRow key={item.id} item={item} onEdit={onEdit} onStatusChange={onStatusChange} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  );
}
