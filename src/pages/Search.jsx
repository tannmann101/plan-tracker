import { useState } from "react";
import { Btn, SectionTitle, Note, Card, Pill, Input } from "../ui";
import { SANS, MONO, INK, MUTE } from "../theme";
import { EntityCard } from "../components/EntityCard";
import { InfoIcon } from "../components/InfoModal";
import { searchAll } from "../lib/graph";
import { domainLabel, lifecycleStatusLabel } from "../constants";

export default function Search({ secretary, onBack }) {
  const [query, setQuery] = useState("");
  const results = searchAll(query, secretary);

  const toggleDone = (type, entity, next) => secretary.saveEntity(type, { ...entity, done: next });

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Hub</Btn>
      <SectionTitle>Search</SectionTitle>
      <Input value={query} onChange={setQuery} placeholder="Search Goals, Projects, Plans, Sessions, Tasks…" autoFocus />

      {query.trim() && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {results.length === 0 ? (
            <Note>Nothing matches "{query}".</Note>
          ) : results.map(({ type, entity }) => {
            if (type === "task" || type === "session") {
              return (
                <EntityCard key={`${type}-${entity.id}`} type={type} entity={entity} domains={secretary.domains} data={secretary} onToggleDone={(e, next) => toggleDone(type, e, next)} />
              );
            }
            return (
              <Card key={`${type}-${entity.id}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SANS, fontSize: 13.5, color: INK, fontWeight: 500 }}>{entity.title}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <Pill color={MUTE}>{type}</Pill>
                    {entity.domain && <Pill>{domainLabel(entity.domain, secretary.domains)}</Pill>}
                    {entity.tier && <Pill color={MUTE}>{entity.tier}</Pill>}
                    {entity.status && <Pill color={MUTE}>{lifecycleStatusLabel(entity.status)}</Pill>}
                  </div>
                </div>
                {type !== "project" && <InfoIcon type={type} entity={entity} data={secretary} />}
              </Card>
            );
          })}
        </div>
      )}
      <p style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 18 }}>
        Tap the (i) on any result to see its full chain of custody.
      </p>
    </div>
  );
}
