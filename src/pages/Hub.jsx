import { Card, SectionTitle } from "../ui";
import { SERIF, SANS, MONO, INK, MUTE, INKBLUE } from "../theme";
import { todayISO, weekStartISO } from "../constants";

const CARDS = [
  { id: "today", title: "Today", blurb: "What's in front of you." },
  { id: "thisweek", title: "This Week", blurb: "The week's plans and sessions, or the month at a glance." },
  { id: "goals", title: "Goals", blurb: "Yearly down to weekly, and the rollup report." },
  { id: "domains", title: "Domains", blurb: "The roles you keep, one dashboard each." },
  { id: "trends", title: "Trends", blurb: "What's getting done, how aligned it is, and the log of it all." },
];

function countFor(id, secretary) {
  const today = todayISO();
  const weekStart = weekStartISO();
  if (id === "today") {
    const t = (secretary.tasks || []).filter((t) => !t.done && t.date === today).length;
    const s = (secretary.sessions || []).filter((s) => !s.done && s.targetDay === today).length;
    return t + s;
  }
  if (id === "thisweek") {
    return (secretary.sessions || []).filter((s) => !s.done && s.targetDay >= weekStart).length;
  }
  if (id === "goals") {
    return (secretary.goals || []).filter((g) => g.status === "active").length;
  }
  if (id === "domains") return (secretary.domains || []).length;
  return null;
}

export default function Hub({ secretary, isOwner, onNavigate }) {
  return (
    <div>
      <div style={{ margin: "6px 0 22px" }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: INK, margin: "0 0 4px" }}>
          Good day{isOwner ? "" : " (viewing)"}.
        </h1>
        <p style={{ fontFamily: MONO, fontSize: 12, color: MUTE, margin: 0 }}>
          {isOwner ? "At your service. Where shall we begin?" : "You have full view of the household's affairs, though no hand in editing them."}
        </p>
      </div>

      <SectionTitle>The Hub</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {CARDS.map((c) => {
          const count = countFor(c.id, secretary);
          return (
            <Card key={c.id} onClick={() => onNavigate(c.id)} style={{ minHeight: 108 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <h3 style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, margin: 0 }}>{c.title}</h3>
                {count !== null && <span style={{ fontFamily: MONO, fontSize: 15, color: INKBLUE, fontWeight: 600 }}>{count}</span>}
              </div>
              <p style={{ fontFamily: SANS, fontSize: 12, color: MUTE, marginTop: 8, lineHeight: 1.5 }}>{c.blurb}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
