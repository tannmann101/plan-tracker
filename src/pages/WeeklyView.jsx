import { useMemo, useState } from "react";
import { Btn, SectionTitle, Note } from "../ui";
import { MONO, INK, MUTE, LINE } from "../theme";
import { weekStartISO, domainLabel } from "../constants";
import { tasksForSession } from "../lib/graph";

function buildWeeklyText(secretary) {
  const weekStart = weekStartISO();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndISO = weekEnd.toISOString().slice(0, 10);

  const sessions = (secretary.sessions || [])
    .filter((s) => s.targetDay && s.targetDay >= weekStart && s.targetDay <= weekEndISO)
    .sort((a, b) => (a.targetDay || "").localeCompare(b.targetDay || ""));

  const lines = [];
  lines.push(`WEEK OF ${weekStart}`, "");
  lines.push("-- Week-at-a-glance --");
  if (sessions.length === 0) {
    lines.push("(nothing placed this week)");
  } else {
    for (const s of sessions) {
      lines.push(`${s.targetDay}  ${s.title}  [${domainLabel(s.domain, secretary.domains)}]`);
    }
  }
  lines.push("", "-- Session by session: where and how --");
  if (sessions.length === 0) {
    lines.push("(nothing to route this week)");
  } else {
    for (const s of sessions) {
      lines.push(`${s.targetDay}: ${s.title} (${domainLabel(s.domain, secretary.domains)}) → ${s.toolLocation}`);
      for (const t of tasksForSession(s.id, secretary.tasks)) {
        lines.push(`   - ${t.done ? "[x]" : "[ ]"} ${t.title}`);
      }
    }
  }
  return lines.join("\n");
}

export default function WeeklyView({ secretary, onBack }) {
  const text = useMemo(() => buildWeeklyText(secretary), [secretary]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can fail silently in some contexts -- the text is
      // still fully selectable below, so this is a convenience, not the
      // only way to get it.
    }
  };

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← This Week</Btn>
      <SectionTitle>Weekly View</SectionTitle>
      <Note>A plain list, meant for copying into your physical Weekly View notebook by hand -- not a styled print view.</Note>
      <div style={{ margin: "12px 0" }}>
        <Btn primary onClick={copy}>{copied ? "Copied" : "Copy to clipboard"}</Btn>
      </div>
      <pre style={{
        fontFamily: MONO, fontSize: 12.5, color: INK, background: "#F9F7F1", border: `1px solid ${LINE}`,
        borderRadius: 10, padding: 16, whiteSpace: "pre-wrap", lineHeight: 1.6,
      }}>{text}</pre>
    </div>
  );
}
