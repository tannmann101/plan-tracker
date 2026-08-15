import { useState } from "react";
import { signOut } from "firebase/auth";
import { Btn, SectionTitle, Note, Card, Input } from "../ui";
import { SANS, MONO, INK, MUTE, INKBLUE, LINE } from "../theme";
import { auth } from "../firebase";
import { DEFAULT_ROUTING_TABLE, DEFAULT_DOMAINS, contentTypesForDomain } from "../constants";

// Categories are domain-exclusive, so a new entry's id must carry its
// domain's own prefix -- derived from whatever that domain's existing
// entries already use, or a fallback for a domain with none yet.
function domainPrefixFor(domainId, rows) {
  const existing = contentTypesForDomain(domainId, rows)[0];
  if (existing?.id.includes("-")) return existing.id.slice(0, existing.id.indexOf("-") + 1);
  return `${domainId.slice(0, 3).toLowerCase()}-`;
}

function RoutingTableEditor({ secretary, isOwner }) {
  const [rows, setRows] = useState(secretary.routingTable?.length ? secretary.routingTable : DEFAULT_ROUTING_TABLE);
  const [saving, setSaving] = useState(false);
  const domains = secretary.domains?.length ? secretary.domains : DEFAULT_DOMAINS;
  const [newDomain, setNewDomain] = useState(domains[0]?.id || "");
  const [newSuffix, setNewSuffix] = useState("");

  const update = (id, patch) => setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const remove = (id) => setRows((r) => r.filter((row) => row.id !== id));
  const add = () => {
    const suffix = newSuffix.trim();
    if (!suffix || !newDomain) return;
    const id = `${domainPrefixFor(newDomain, rows)}${suffix}`;
    if (rows.some((row) => row.id === id)) return;
    setRows((r) => [...r, { id, domain: newDomain, label: suffix, toolLocation: "", external: false }]);
    setNewSuffix("");
  };
  const save = async () => {
    setSaving(true);
    try {
      await secretary.saveConfig("routingTable", rows);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {domains.map((d) => {
        const domainRows = contentTypesForDomain(d.id, rows);
        return (
          <div key={d.id} style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{d.label}</div>
            {domainRows.length === 0 && <Note>No categories yet.</Note>}
            {domainRows.map((row) => (
              <Card key={row.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, width: 150, flex: "none" }}>{row.id}</span>
                {isOwner ? (
                  <>
                    <Input value={row.label} onChange={(v) => update(row.id, { label: v })} width={220} />
                    <Input value={row.toolLocation} onChange={(v) => update(row.id, { toolLocation: v })} placeholder="Tool / location" width={220} />
                    <Btn small color={MUTE} onClick={() => remove(row.id)}>Remove</Btn>
                  </>
                ) : (
                  <>
                    <span style={{ fontFamily: SANS, fontSize: 13, color: INK }}>{row.label}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE }}>→ {row.toolLocation}</span>
                  </>
                )}
              </Card>
            ))}
          </div>
        );
      })}
      {isOwner && (
        <>
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              style={{ fontFamily: MONO, fontSize: 12, padding: "6px 9px", border: `1px solid ${LINE}`, borderRadius: 8 }}
            >
              {domains.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE }}>{domainPrefixFor(newDomain, rows)}</span>
            <Input value={newSuffix} onChange={setNewSuffix} placeholder="new-category-suffix" width={200} onEnter={add} />
            <Btn small onClick={add}>Add entry</Btn>
          </div>
          <div style={{ marginTop: 12 }}>
            <Btn primary color={INKBLUE} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save routing table"}</Btn>
          </div>
        </>
      )}
    </div>
  );
}

function DomainsEditor({ secretary, isOwner }) {
  const [rows, setRows] = useState(secretary.domains?.length ? secretary.domains : DEFAULT_DOMAINS);
  const [saving, setSaving] = useState(false);

  const update = (id, patch) => setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const save = async () => {
    setSaving(true);
    try {
      await secretary.saveConfig("domains", rows);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {rows.map((d) => (
        <Card key={d.id} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, width: 90, flex: "none" }}>{d.id}</span>
            {isOwner ? (
              <Input value={d.label} onChange={(v) => update(d.id, { label: v })} width={200} />
            ) : (
              <span style={{ fontFamily: SANS, fontSize: 13.5, color: INK, fontWeight: 600 }}>{d.label}</span>
            )}
          </div>
          {isOwner ? (
            <>
              <div style={{ marginTop: 8 }}>
                <Input value={d.description} onChange={(v) => update(d.id, { description: v })} width="100%" />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Input value={d.linkLabel || ""} onChange={(v) => update(d.id, { linkLabel: v })} placeholder="Link label" width={200} />
                <Input value={d.linkUrl || ""} onChange={(v) => update(d.id, { linkUrl: v })} placeholder="https://…" width={280} />
              </div>
            </>
          ) : (
            <p style={{ fontFamily: SANS, fontSize: 12, color: MUTE, marginTop: 6 }}>{d.description}</p>
          )}
        </Card>
      ))}
      {isOwner && (
        <div style={{ marginTop: 12 }}>
          <Btn primary color={INKBLUE} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save domain definitions"}</Btn>
        </div>
      )}
    </div>
  );
}

export default function Settings({ secretary, isOwner, onBack }) {
  const email = auth.currentUser?.email;
  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Hub</Btn>
      <SectionTitle>Settings</SectionTitle>

      <SectionTitle note="account">Sign-in</SectionTitle>
      <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: SANS, fontSize: 13, color: INK }}>{email}</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginTop: 3 }}>{isOwner ? "Full access" : "View-only -- the entire Goal hierarchy and every Domain, no edit rights"}</div>
        </div>
        <Btn small color={MUTE} onClick={() => signOut(auth)}>Sign out</Btn>
      </Card>

      <SectionTitle note="wife's access">Household accounts</SectionTitle>
      <Note>
        Rochelle's account sees everything -- the full Goal hierarchy and every Domain -- but cannot capture, place, or edit anything.
        Only Tanner's account can write. This is fixed in the app's Firestore rules, not adjustable here.
      </Note>

      <SectionTitle note="content-type → tool/location, grouped by domain">Routing Table</SectionTitle>
      <Note>
        Each domain has its own exclusive set of content-type categories -- none are shared across domains. A Session's content-type
        resolves to a physical or digital location. Editing this changes future placements only.
      </Note>
      <RoutingTableEditor secretary={secretary} isOwner={isOwner} />

      <SectionTitle note="the fifteen domains">Domain Definitions</SectionTitle>
      <DomainsEditor secretary={secretary} isOwner={isOwner} />

      <p style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 24, borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
        Most domains have no dedicated tool yet -- their Sessions log generically inside Secretary until one is built. That's a manual call, not something this app migrates automatically.
      </p>
    </div>
  );
}
