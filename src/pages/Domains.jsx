import { useState } from "react";
import { Btn, SectionTitle, Note, Card, Pill } from "../ui";
import { SERIF, SANS, MONO, INK, MUTE, DOMAIN_COLORS, softTint } from "../theme";
import { EntityCard } from "../components/EntityCard";
import { InfoIcon } from "../components/InfoModal";
import { lifecycleStatusLabel } from "../constants";

function DomainDashboard({ domain, secretary, isOwner, onBack }) {
  const color = DOMAIN_COLORS[domain.id] || MUTE;
  const plans = (secretary.plans || []).filter((p) => p.domain === domain.id);
  const sessions = (secretary.sessions || []).filter((s) => s.domain === domain.id);
  const tasks = (secretary.tasks || []).filter((t) => t.domain === domain.id);

  const activePlans = plans.filter((p) => p.status === "active");
  const donePlans = plans.filter((p) => p.status !== "active");
  const activeSessions = sessions.filter((s) => !s.done);
  const doneSessions = sessions.filter((s) => s.done);

  const toggleSessionDone = (entity, next) => secretary.saveEntity("session", { ...entity, done: next });
  const toggleTaskDone = (entity, next) => secretary.saveEntity("task", { ...entity, done: next });

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Domains</Btn>
      <SectionTitle>{domain.label}</SectionTitle>
      <p style={{ fontFamily: SANS, fontSize: 13, color: MUTE, lineHeight: 1.55, marginTop: -6 }}>{domain.description}</p>
      {domain.linkUrl && (
        <a href={domain.linkUrl} target="_blank" rel="noreferrer">
          <Btn small color={color}>{domain.linkLabel || "Open"} →</Btn>
        </a>
      )}
      {domain.generic && <Note>No dedicated tool yet for this domain -- Sessions log generically here until one is built.</Note>}

      <SectionTitle note={`${activePlans.length} active`}>Active Plans</SectionTitle>
      {activePlans.length === 0 ? <Note>Nothing active here yet.</Note> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activePlans.map((p) => (
            <Card key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SANS, fontSize: 13.5, color: INK, fontWeight: 500 }}>{p.title}</div>
                <Pill color={color} tint={softTint(color)}>{p.parentType}</Pill>
              </div>
              <InfoIcon type="plan" entity={p} data={secretary} />
            </Card>
          ))}
        </div>
      )}

      <SectionTitle note={`${activeSessions.length} active`}>Active Sessions</SectionTitle>
      {activeSessions.length === 0 ? <Note>None active.</Note> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activeSessions.map((s) => (
            <EntityCard key={s.id} type="session" entity={s} domains={secretary.domains} data={secretary} readOnly={!isOwner} onToggleDone={toggleSessionDone} />
          ))}
        </div>
      )}

      <SectionTitle note={`${tasks.filter((t) => !t.done).length} open`}>Open Tasks</SectionTitle>
      {tasks.filter((t) => !t.done).length === 0 ? <Note>None open.</Note> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.filter((t) => !t.done).map((t) => (
            <EntityCard key={t.id} type="task" entity={t} domains={secretary.domains} data={secretary} readOnly={!isOwner} onToggleDone={toggleTaskDone} />
          ))}
        </div>
      )}

      <SectionTitle note={`${donePlans.length + doneSessions.length + tasks.filter((t) => t.done).length} items`}>Historical / Completed</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {donePlans.map((p) => (
          <Card key={p.id} style={{ opacity: 0.6 }}>
            <div style={{ fontFamily: SANS, fontSize: 13, color: INK }}>{p.title}</div>
            <Pill color={MUTE}>{lifecycleStatusLabel(p.status)}</Pill>
          </Card>
        ))}
        {doneSessions.map((s) => (
          <EntityCard key={s.id} type="session" entity={s} domains={secretary.domains} data={secretary} readOnly={!isOwner} onToggleDone={toggleSessionDone} />
        ))}
        {tasks.filter((t) => t.done).map((t) => (
          <EntityCard key={t.id} type="task" entity={t} domains={secretary.domains} data={secretary} readOnly={!isOwner} onToggleDone={toggleTaskDone} />
        ))}
        {donePlans.length + doneSessions.length + tasks.filter((t) => t.done).length === 0 && <Note>Nothing completed here yet.</Note>}
      </div>
    </div>
  );
}

export default function Domains({ secretary, isOwner, onBack }) {
  const [selected, setSelected] = useState(null);
  const domains = secretary.domains || [];

  if (selected) {
    const domain = domains.find((d) => d.id === selected);
    return <DomainDashboard domain={domain} secretary={secretary} isOwner={isOwner} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Hub</Btn>
      <SectionTitle>Domains</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {domains.map((d) => {
          const color = DOMAIN_COLORS[d.id] || MUTE;
          const count = (secretary.plans || []).filter((p) => p.domain === d.id && p.status === "active").length
            + (secretary.sessions || []).filter((s) => s.domain === d.id && !s.done).length;
          return (
            <Card key={d.id} onClick={() => setSelected(d.id)} style={{ minHeight: 108, borderTop: `3px solid ${color}` }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <h3 style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, margin: 0 }}>{d.label}</h3>
                <span style={{ fontFamily: MONO, fontSize: 14, color, fontWeight: 600 }}>{count}</span>
              </div>
              <p style={{ fontFamily: SANS, fontSize: 11.5, color: MUTE, marginTop: 8, lineHeight: 1.5 }}>{d.description}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
