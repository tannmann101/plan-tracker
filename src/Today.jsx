import { OPEN_STATUSES, todayISO } from "./constants";
import { MONO, MUTE } from "./theme";
import { SectionTitle, Note } from "./ui";
import ItemRow from "./ItemRow";

// Open/in-progress items due today or overdue, most overdue first -- a
// same-day slice distinct from Weekly Triage's "everything open" view.
// Items with no target date never appear here (there's no deadline to be
// due against); they still show up in Weekly Triage.
function dueTodayOrOverdue(items) {
  const today = todayISO();
  return items
    .filter((i) => OPEN_STATUSES.includes(i.status) && i.targetDate && i.targetDate <= today)
    .sort((a, b) => (a.targetDate < b.targetDate ? -1 : a.targetDate > b.targetDate ? 1 : 0));
}

export default function Today({ items, onEdit, onStatusChange, onDelete }) {
  const due = dueTodayOrOverdue(items);

  return (
    <div>
      <SectionTitle note={`${due.length} due`}>Today</SectionTitle>
      <Note>Every open or in-progress item due today or overdue, most overdue first.</Note>
      <div style={{ marginTop: 14 }}>
        {due.length === 0 ? (
          <div style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, padding: "20px 4px" }}>Nothing due today.</div>
        ) : (
          due.map((item) => (
            <ItemRow key={item.id} item={item} onEdit={onEdit} onStatusChange={onStatusChange} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  );
}
