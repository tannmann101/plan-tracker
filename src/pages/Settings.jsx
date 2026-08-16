import { useState } from "react";
import { signOut } from "firebase/auth";
import { Btn, SectionTitle, Note, Card, Input, Textarea } from "../ui";
import { SANS, MONO, INK, MUTE, INKBLUE, LINE } from "../theme";
import { auth } from "../firebase";
import { OWNERS, DEFAULT_DOMAINS, DEFAULT_RESOURCES } from "../constants";

// Copy-only editor -- the seven domains themselves are a taxonomy decision
// (§3.1), not something this screen lets you add to or remove; only their
// label/description/subScope text is rewritable without a code change.
function DomainsEditor({ secretary }) {
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
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, width: 130, flex: "none" }}>{d.id}</span>
            <Input value={d.label} onChange={(v) => update(d.id, { label: v })} width={220} />
          </div>
          <div style={{ marginTop: 8 }}>
            <Textarea value={d.description} onChange={(v) => update(d.id, { description: v })} rows={2} />
          </div>
          <div style={{ marginTop: 8 }}>
            <Input value={d.subScope || ""} onChange={(v) => update(d.id, { subScope: v })} placeholder="Sub-scope reference text" width="100%" />
          </div>
        </Card>
      ))}
      <div style={{ marginTop: 12 }}>
        <Btn primary color={INKBLUE} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save domain definitions"}</Btn>
      </div>
    </div>
  );
}

// Flat string list -- replaces the old per-domain routing table (§3.2).
// Any resource can be used from any domain now, so there's no grouping
// left to preserve here.
function ResourcesEditor({ secretary }) {
  const [rows, setRows] = useState(secretary.resources?.length ? secretary.resources : DEFAULT_RESOURCES);
  const [newEntry, setNewEntry] = useState("");
  const [saving, setSaving] = useState(false);

  const rename = (i, v) => setRows((r) => r.map((row, idx) => (idx === i ? v : row)));
  const remove = (i) => setRows((r) => r.filter((_, idx) => idx !== i));
  const add = () => {
    const v = newEntry.trim();
    if (!v || rows.includes(v)) { setNewEntry(""); return; }
    setRows((r) => [...r, v]);
    setNewEntry("");
  };
  const save = async () => {
    setSaving(true);
    try {
      await secretary.saveConfig("resources", rows);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {rows.map((r, i) => (
        <Card key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <Input value={r} onChange={(v) => rename(i, v)} width="100%" />
          <Btn small color={MUTE} onClick={() => remove(i)}>Remove</Btn>
        </Card>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Input value={newEntry} onChange={setNewEntry} placeholder="New resource…" onEnter={add} />
        <Btn small onClick={add}>Add</Btn>
      </div>
      <div style={{ marginTop: 12 }}>
        <Btn primary color={INKBLUE} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save resources"}</Btn>
      </div>
    </div>
  );
}

// §12 -- pulls everything already loaded client-side, no new Cloud
// Function. Both files download at once since there's no reason to make
// the user pick.
function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildStateExport(secretary) {
  const exportedAt = new Date().toISOString();
  const kindTitle = (id) => (secretary.kinds || []).find((k) => k.id === id)?.title || id;
  const json = {
    exportedAt,
    kinds: secretary.kinds || [],
    items: secretary.items || [],
    practiceHabits: secretary.practiceHabits || [],
    pendingOperations: secretary.pendingOperations || [],
    captures: secretary.captures || [],
    secretaryChat: secretary.chatMessages || [],
    config: {
      domains: secretary.domains || [],
      resources: secretary.resources || [],
      practiceCategories: secretary.practiceCategories || [],
    },
  };

  const lines = [];
  lines.push("# Secretary state export", "", `Exported ${exportedAt}`, "");
  lines.push(`## Kinds (${json.kinds.length})`, "");
  for (const k of json.kinds) {
    lines.push(`- **${k.title}** — ${k.kindType} · ${k.domain} · ${k.status}${(k.tags || []).length ? ` · #${k.tags.join(" #")}` : ""}`);
  }
  lines.push("", `## Items (${json.items.length})`, "");
  for (const i of json.items) {
    const attach = i.parentKindId ? ` · under ${kindTitle(i.parentKindId)}` : " · unattached";
    lines.push(`- [${i.done ? "x" : " "}] **${i.title}** — ${i.itemType} · ${i.domain}${attach}`);
  }
  lines.push("", `## Practice habits (${json.practiceHabits.length})`, "");
  for (const h of json.practiceHabits) lines.push(`- **${h.title}** — ${h.category}`);
  lines.push("", `## Pending operations awaiting review (${json.pendingOperations.filter((o) => o.status === "pending").length} of ${json.pendingOperations.length})`, "");
  lines.push("", `## Captures (${json.captures.length})`, "");
  lines.push("", `## Secretary chat messages (${json.secretaryChat.length})`, "");
  lines.push("", "## Domains", "");
  for (const d of json.config.domains) lines.push(`- **${d.label}** (${d.id}) — ${d.description}`);
  lines.push("", "## Resources", "");
  for (const r of json.config.resources) lines.push(`- ${r}`);

  return { json, md: lines.join("\n") };
}

function ExportState({ secretary }) {
  const run = () => {
    const { json, md } = buildStateExport(secretary);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`secretary-state-${stamp}.md`, md, "text/markdown");
    downloadFile(`secretary-state-${stamp}.json`, JSON.stringify(json, null, 2), "application/json");
  };
  return <Btn onClick={run}>Export state (.md + .json)</Btn>;
}

// Both accounts carry identical write access now (§13) -- there's no
// isOwner/read-only branch left anywhere in this screen.
export default function Settings({ secretary, onBack }) {
  const email = auth.currentUser?.email;
  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Back</Btn>
      <SectionTitle>Settings</SectionTitle>

      <SectionTitle note="account">Sign-in</SectionTitle>
      <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: SANS, fontSize: 13, color: INK }}>{email}</div>
        <Btn small color={MUTE} onClick={() => signOut(auth)}>Sign out</Btn>
      </Card>

      <SectionTitle note="equal write access">Household accounts</SectionTitle>
      <Note>
        {OWNERS.map((o) => o.label).join(" and ")} both read and write everything -- there is no owner/viewer split anymore.
      </Note>

      <SectionTitle note="the seven domains">Domain Definitions</SectionTitle>
      <DomainsEditor secretary={secretary} />

      <SectionTitle note="flat, not domain-scoped">Resources</SectionTitle>
      <Note>Replaces the old per-domain routing table -- any resource can be used from any domain, tags carry the specificity now.</Note>
      <ResourcesEditor secretary={secretary} />

      <SectionTitle note="§12">Export</SectionTitle>
      <Note>Downloads a full snapshot of everything Secretary currently holds, as both a readable Markdown report and a raw JSON dump.</Note>
      <div style={{ marginTop: 10 }}>
        <ExportState secretary={secretary} />
      </div>

      <p style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 24, borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
        Practice categories are managed from the Plans page's Practices tab, not here.
      </p>
    </div>
  );
}
