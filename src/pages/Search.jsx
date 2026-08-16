import { useState } from "react";
import { Btn, SectionTitle, Note, Input } from "../ui";
import { MONO, MUTE } from "../theme";
import { EntityCard } from "../components/EntityCard";
import EditEntityModal from "../components/EditEntityModal";
import { searchAll } from "../lib/graph";

// Searches only Kinds and Items now -- the flat model means there's nothing
// else left to search across (captures/pendingOperations live in Secretary's
// own review log instead). Manages its own edit modal, same as every other
// page that renders a card (§15) -- a search result is editable exactly
// like it would be anywhere else.
export default function Search({ secretary, onBack, onNavigateKind }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const results = searchAll(query, secretary);

  const toggleDone = (entity, next) => secretary.saveEntity("item", { ...entity, done: next, completedAt: next ? Date.now() : null });

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Back</Btn>
      <SectionTitle>Search</SectionTitle>
      <Input value={query} onChange={setQuery} placeholder="Search Kinds and Items…" autoFocus />

      {query.trim() && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {results.length === 0 ? (
            <Note>Nothing matches "{query}".</Note>
          ) : results.map(({ type, entity }) => (
            <EntityCard
              key={`${type}-${entity.id}`}
              family={type}
              entity={entity}
              secretary={secretary}
              onToggleDone={type === "item" ? toggleDone : undefined}
              onEdit={(fam, e) => setEditing({ family: fam, entity: e })}
              onNavigateKind={onNavigateKind}
            />
          ))}
        </div>
      )}
      <p style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 18 }}>
        Tap the (i) on any result to see its full chain, or tap the card to edit it.
      </p>

      {editing && (
        <EditEntityModal
          family={editing.family} entity={editing.entity} secretary={secretary}
          onClose={() => setEditing(null)} onDeleted={() => setEditing(null)}
        />
      )}
    </div>
  );
}
