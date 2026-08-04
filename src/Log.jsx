import { useState } from "react";
import { typeLabel, domainLabel, effortLabel, ownerLabel, itemType, parentTitleOf, todayISO } from "./constants";
import { MONO, MUTE, TEAL } from "./theme";
import { SectionTitle, Note, Btn } from "./ui";
import ItemRow from "./ItemRow";

const dateOf = (ts) => (ts ? new Date(ts).toISOString().slice(0, 10) : "");

// Escapes a single CSV field -- quote it (doubling any internal quotes)
// whenever it contains a comma, quote, or newline; otherwise leave it bare.
function csvField(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_COLUMNS = [
  ["Title", (i) => i.title],
  ["Type", (i) => typeLabel(itemType(i))],
  ["Domain", (i) => domainLabel(i.domain)],
  ["Owner", (i) => (i.owner ? ownerLabel(i.owner) : "")],
  ["Effort", (i) => (i.effort ? effortLabel(i.effort) : "")],
  ["Part of", (i, items) => parentTitleOf(items, i) || ""],
  ["Definition of done", (i) => i.definitionOfDone || ""],
  ["Source note", (i) => i.sourceNote || ""],
  ["Created", (i) => i.createdDate || ""],
  ["Target date", (i) => i.targetDate || ""],
  ["Completed", (i) => dateOf(i.updatedAt)],
];

function toCSV(items) {
  const header = CSV_COLUMNS.map(([label]) => csvField(label)).join(",");
  const rows = items.map((i) => CSV_COLUMNS.map(([, get]) => csvField(get(i, items))).join(","));
  return [header, ...rows].join("\r\n");
}

// A standalone record of everything finished, separate from the day/week/
// month/quarter/year working view -- for exporting a log of what's been
// done rather than triaging what's still open.
export default function Log({ items, onEdit, onStatusChange, onDelete }) {
  const [copied, setCopied] = useState(false);
  const done = items.filter((i) => i.status === "done").sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const copyCSV = async () => {
    try {
      await navigator.clipboard.writeText(toCSV(done));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const downloadCSV = () => {
    const blob = new Blob([toCSV(done)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plan-tracker-completed-log-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <SectionTitle note={`${done.length} completed`}>Log</SectionTitle>
      <Note>Every completed item, most recently finished first -- a standing record, separate from the working view above.</Note>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Btn onClick={downloadCSV} color={TEAL} primary disabled={done.length === 0}>Download CSV</Btn>
        <Btn onClick={copyCSV} color={MUTE} disabled={done.length === 0}>{copied ? "Copied!" : "Copy CSV"}</Btn>
      </div>

      <div style={{ marginTop: 14 }}>
        {done.length === 0 ? (
          <div style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, padding: "20px 4px" }}>Nothing completed yet.</div>
        ) : (
          done.map((item) => (
            <ItemRow key={item.id} item={item} parentTitle={parentTitleOf(items, item)} onEdit={onEdit} onStatusChange={onStatusChange} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  );
}
