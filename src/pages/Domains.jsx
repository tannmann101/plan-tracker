import { useState } from "react";
import { Btn, SectionTitle, Note, Card, Pill } from "../ui";
import { SERIF, SANS, MONO, INK, MUTE, INKBLUE, DOMAIN_COLORS, softTint } from "../theme";
import { EntityCard } from "../components/EntityCard";
import { InfoIcon, GoalChainLine } from "../components/InfoModal";
import QuickAddModal from "../components/QuickAddModal";
import EditEntityModal from "../components/EditEntityModal";
import { lifecycleStatusLabel, initiatorLabel, familyScopeLabel } from "../constants";
import { matchesDomain } from "../lib/graph";

function DomainDashboard({ domain, secretary, isOwner, onBack, onNavigateGoal }) {
  const color = DOMAIN_COLORS[domain.id] || MUTE;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const projects = (secretary.projects || []).filter((p) => matchesDomain(p, domain.id));
  const plans = (secretary.plans || []).filter((p) => matchesDomain(p, domain.id));
  const sessions = (secretary.sessions || []).filter((s) => matchesDomain(s, domain.id));
  const tasks = (secretary.tasks || []).filter((t) => matchesDomain(t, domain.id));

  const activeProjects = projects.filter((p) => p.status === "active");
  const doneProjects = projects.filter((p) => p.status !== "active");
  const activePlans = plans.filter((p) => p.status === "active");
  const donePlans = plans.filter((p) => p.status !== "active");
  const activeSessions = sessions.filter((s) => !s.done);
  const doneSessions = sessions.filter((s) => s.done);

  const toggleSessionDone = (entity, next) => secretary.saveEntity("session", { ...entity, done: next });
  const toggleTaskDone = (entity, next) => secretary.saveEntity("task", { ...entity, done: next });
  const openEdit = isOwner ? (t, e) => setEditing({ type: t, entity: e }) : null;

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Domains</Btn>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <SectionTitle>{domain.label}</SectionTitle>
        {isOwner && <Btn small primary color={INKBLUE} onClick={() => setAdding(true)}>+ Add</Btn>}
      </div>
      <p style={{ fontFamily: SANS, fontSize: 13, color: MUTE, lineHeight: 1.55, marginTop: -6 }}>{domain.description}</p>
      {domain.linkUrl && (
        <a href={domain.linkUrl} target="_blank" rel="noreferrer">
          <Btn small color={color}>{domain.linkLabel || "Open"} →</Btn>
        </a>
      )}
      {domain.generic && <Note>No dedicated tool yet for this domain -- Sessions log generically here until one is built.</Note>}

      {projects.length > 0 && (
        <>
          <SectionTitle note={`${activeProjects.length} active`}>Projects</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeProjects.map((p) => (
              <Card key={p.id} onClick={openEdit ? () => openEdit("project", p) : undefined} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SANS, fontSize: 13.5, color: INK, fontWeight: 500 }}>{p.title}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <Pill color={color} tint={softTint(color)}>{initiatorLabel(p.initiator)}</Pill>
                    <Pill color={MUTE}>{familyScopeLabel(p.familyScope)}</Pill>
                  </div>
                  <GoalChainLine type="project" entity={p} data={secretary} onNavigateGoal={onNavigateGoal} />
                </div>
                <InfoIcon type="project" entity={p} data={secretary} onNavigateGoal={onNavigateGoal} />
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle note={`${activePlans.length} active`}>Active Plans</SectionTitle>
      {activePlans.length === 0 ? <Note>Nothing active here yet.</Note> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activePlans.map((p) => (
            <Card key={p.id} onClick={openEdit ? () => openEdit("plan", p) : undefined} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SANS, fontSize: 13.5, color: INK, fontWeight: 500 }}>{p.title}</div>
                <Pill color={color} tint={softTint(color)}>{p.parentType ? p.parentType : "not yet linked"}</Pill>
                <GoalChainLine type="plan" entity={p} data={secretary} onNavigateGoal={onNavigateGoal} />
              </div>
              <InfoIcon type="plan" entity={p} data={secretary} onNavigateGoal={onNavigateGoal} />
            </Card>
          ))}
        </div>
      )}

      <SectionTitle note={`${activeSessions.length} active`}>Active Sessions</SectionTitle>
      {activeSessions.length === 0 ? <Note>None active.</Note> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activeSessions.map((s) => (
            <EntityCard key={s.id} type="session" entity={s} domains={secretary.domains} data={secretary} readOnly={!isOwner} onToggleDone={toggleSessionDone} onEdit={openEdit} onNavigateGoal={onNavigateGoal} />
          ))}
        </div>
      )}

      <SectionTitle note={`${tasks.filter((t) => !t.done).length} open`}>Open Tasks</SectionTitle>
      {tasks.filter((t) => !t.done).length === 0 ? <Note>None open.</Note> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.filter((t) => !t.done).map((t) => (
            <EntityCard key={t.id} type="task" entity={t} domains={secretary.domains} data={secretary} readOnly={!isOwner} onToggleDone={toggleTaskDone} onEdit={openEdit} onNavigateGoal={onNavigateGoal} />
          ))}
        </div>
      )}

      <SectionTitle note={`${doneProjects.length + donePlans.length + doneSessions.length + tasks.filter((t) => t.done).length} items`}>Historical / Completed</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {doneProjects.map((p) => (
          <Card key={p.id} style={{ opacity: 0.6 }}>
            <div style={{ fontFamily: SANS, fontSize: 13, color: INK }}>{p.title}</div>
            <Pill color={MUTE}>{lifecycleStatusLabel(p.status)}</Pill>
          </Card>
        ))}
        {donePlans.map((p) => (
          <Card key={p.id} style={{ opacity: 0.6 }}>
            <div style={{ fontFamily: SANS, fontSize: 13, color: INK }}>{p.title}</div>
            <Pill color={MUTE}>{lifecycleStatusLabel(p.status)}</Pill>
          </Card>
        ))}
        {doneSessions.map((s) => (
          <EntityCard key={s.id} type="session" entity={s} domains={secretary.domains} data={secretary} readOnly={!isOwner} onToggleDone={toggleSessionDone} onEdit={openEdit} onNavigateGoal={onNavigateGoal} />
        ))}
        {tasks.filter((t) => t.done).map((t) => (
          <EntityCard key={t.id} type="task" entity={t} domains={secretary.domains} data={secretary} readOnly={!isOwner} onToggleDone={toggleTaskDone} onEdit={openEdit} onNavigateGoal={onNavigateGoal} />
        ))}
        {doneProjects.length + donePlans.length + doneSessions.length + tasks.filter((t) => t.done).length === 0 && <Note>Nothing completed here yet.</Note>}
      </div>

      {adding && (
        <QuickAddModal
          secretary={secretary}
          types={["plan", "project", "session", "task"]}
          defaultType="plan"
          defaults={{ domain: domain.id }}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && (
        <EditEntityModal type={editing.type} entity={editing.entity} secretary={secretary} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

export default function Domains({ secretary, isOwner, onBack, onNavigateGoal }) {
  const [selected, setSelected] = useState(null);
  const domains = secretary.domains || [];

  if (selected) {
    const domain = domains.find((d) => d.id === selected);
    return <DomainDashboard domain={domain} secretary={secretary} isOwner={isOwner} onBack={() => setSelected(null)} onNavigateGoal={onNavigateGoal} />;
  }

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Hub</Btn>
      <SectionTitle>Domains</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {domains.map((d) => {
          const color = DOMAIN_COLORS[d.id] || MUTE;
          const count = (secretary.plans || []).filter((p) => matchesDomain(p, d.id) && p.status === "active").length
            + (secretary.sessions || []).filter((s) => matchesDomain(s, d.id) && !s.done).length
            + (secretary.projects || []).filter((p) => matchesDomain(p, d.id) && p.status === "active").length;
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
