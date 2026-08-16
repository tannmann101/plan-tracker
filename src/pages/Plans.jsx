import { Fragment, useState } from "react";
import { Btn, SectionTitle, Note, Card, Input, Select, TabBar, Checkbox } from "../ui";
import { SANS, MONO, INK, MUTE, INKBLUE, LINE, DOMAIN_COLORS, STATUS_COLORS } from "../theme";
import { EntityCard } from "../components/EntityCard";
import { Field, TagsInput, MultiCheckList } from "../components/formFields";
import AddForm from "../components/AddForm";
import EditEntityModal from "../components/EditEntityModal";
import { Timeline } from "../components/charts";
import { KIND_STATUSES, weekStartISO, addDaysISO } from "../constants";
import { practiceItemFor, allTagsInUse } from "../lib/graph";

const TOP_TABS = [
  { id: "practices", label: "Practices" },
  { id: "projects", label: "Projects & Goals" },
];

function slugify(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `cat-${Date.now()}`;
}

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// §9.1 -- category management, habit definitions, and the weekly tracker
// grid. The grid never keeps its own completion state: every cell reads/
// writes through practiceItemFor's find-or-create-on-demand Item, the same
// one Today/Week's own checkbox would touch for that habit+day (§9.1.1).
function PracticesTab({ secretary }) {
  const categories = secretary.practiceCategories || [];
  const habits = secretary.practiceHabits || [];

  const [newCategory, setNewCategory] = useState("");
  const [editingHabitId, setEditingHabitId] = useState(null);
  const [habitTitle, setHabitTitle] = useState("");
  const [habitCategory, setHabitCategory] = useState(categories[0]?.id || "");
  const [habitResources, setHabitResources] = useState([]);
  const [habitTags, setHabitTags] = useState([]);
  const [weekStart, setWeekStart] = useState(() => weekStartISO());

  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const tagSuggestions = allTagsInUse(secretary);

  const addCategory = async () => {
    const label = newCategory.trim();
    if (!label) return;
    const id = slugify(label);
    if (categories.some((c) => c.id === id)) { setNewCategory(""); return; }
    await secretary.saveConfig("practiceCategories", [...categories, { id, label }]);
    setNewCategory("");
  };

  const removeCategory = async (id) => {
    if (habits.some((h) => h.categoryId === id)) return; // in use -- reassign or delete its habits first
    await secretary.saveConfig("practiceCategories", categories.filter((c) => c.id !== id));
  };

  const resetHabitForm = () => {
    setEditingHabitId(null);
    setHabitTitle("");
    setHabitCategory(categories[0]?.id || "");
    setHabitResources([]);
    setHabitTags([]);
  };

  const startEditHabit = (habit) => {
    setEditingHabitId(habit.id);
    setHabitTitle(habit.title);
    setHabitCategory(habit.categoryId);
    setHabitResources(habit.resources || []);
    setHabitTags(habit.tags || []);
  };

  const saveHabit = async () => {
    const title = habitTitle.trim();
    if (!title || !habitCategory) return;
    const editing = editingHabitId ? habits.find((h) => h.id === editingHabitId) : null;
    await secretary.savePracticeHabit({
      id: editingHabitId || undefined,
      createdAt: editing?.createdAt,
      title, categoryId: habitCategory, resources: habitResources, tags: habitTags,
      active: editing?.active !== false,
    });
    resetHabitForm();
  };

  const toggleDay = async (habit, day) => {
    const existing = practiceItemFor(habit.id, day, secretary.items);
    if (existing) {
      await secretary.saveEntity("item", { ...existing, done: !existing.done, completedAt: !existing.done ? Date.now() : null });
    } else {
      await secretary.saveEntity("item", {
        title: habit.title, itemType: "other", domain: "practices", secondaryDomains: [],
        resources: habit.resources || [], tags: habit.tags || [], parentKindId: null,
        timing: { targetDay: day, floating: true }, done: true, completedAt: Date.now(),
        isRecurringPracticeItem: true, practiceHabitId: habit.id, createdVia: "add-form",
      });
    }
  };

  return (
    <div>
      <SectionTitle note="add / remove">Categories</SectionTitle>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {categories.map((c) => (
          <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 11.5, border: `1px solid ${LINE}`, borderRadius: 999, padding: "4px 10px" }}>
            {c.label}
            <button type="button" onClick={() => removeCategory(c.id)} title="Remove (only if unused)" style={{ border: "none", background: "none", color: MUTE, cursor: "pointer", padding: 0, fontSize: 12 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Input value={newCategory} onChange={setNewCategory} placeholder="New category…" onEnter={addCategory} width={200} />
        <Btn small onClick={addCategory}>Add category</Btn>
      </div>

      <SectionTitle note="habit definitions">{editingHabitId ? "Edit Practice" : "Add a Practice"}</SectionTitle>
      <Card>
        <Field label="Name">
          <Input value={habitTitle} onChange={setHabitTitle} />
        </Field>
        <Field label="Category">
          <Select value={habitCategory} onChange={setHabitCategory} options={categories} />
        </Field>
        <Field label="Resources">
          <MultiCheckList options={secretary.resources} value={habitResources} onChange={setHabitResources} />
        </Field>
        <Field label="Tags">
          <TagsInput value={habitTags} onChange={setHabitTags} suggestions={tagSuggestions} />
        </Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn primary color={INKBLUE} disabled={!habitTitle.trim() || !habitCategory} onClick={saveHabit}>
            {editingHabitId ? "Save changes" : "Add practice"}
          </Btn>
          {editingHabitId && <Btn color={MUTE} onClick={resetHabitForm}>Cancel</Btn>}
        </div>
      </Card>

      <SectionTitle note={`${weekStart} → ${weekDays[6]}`}>Weekly tracker</SectionTitle>
      <Note>
        Checking a day here checks the exact same Item that Today and Week's checkbox for that practice checks -- they're always in sync, never two separate records. Click a practice's name to edit it.
      </Note>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Btn small onClick={() => setWeekStart(addDaysISO(weekStart, -7))} color={MUTE}>← Prev</Btn>
        <Btn small onClick={() => setWeekStart(weekStartISO())} color={MUTE}>This week</Btn>
        <Btn small onClick={() => setWeekStart(addDaysISO(weekStart, 7))} color={MUTE}>Next →</Btn>
      </div>
      {habits.length === 0 ? (
        <Note>No practices defined yet.</Note>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", fontFamily: MONO, fontSize: 10.5, color: MUTE, padding: "0 10px 8px 0" }}>Practice</th>
                {WEEKDAY_LABELS.map((w) => (
                  <th key={w} style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, padding: "0 4px 8px", textAlign: "center" }}>{w}</th>
                ))}
                <th style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, padding: "0 4px 8px", textAlign: "center" }}>Wk</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {categories.filter((c) => habits.some((h) => h.categoryId === c.id)).map((cat) => (
                <Fragment key={cat.id}>
                  <tr>
                    <td colSpan={10} style={{ fontFamily: MONO, fontSize: 10.5, color: INK, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px 0 4px" }}>{cat.label}</td>
                  </tr>
                  {habits.filter((h) => h.categoryId === cat.id).map((habit) => {
                    const weekItems = weekDays.map((day) => practiceItemFor(habit.id, day, secretary.items));
                    const doneCount = weekItems.filter((i) => i?.done).length;
                    return (
                      <tr key={habit.id}>
                        <td style={{ padding: "4px 10px 4px 0", borderBottom: `1px solid ${LINE}` }}>
                          <button
                            type="button" onClick={() => startEditHabit(habit)} title="Edit practice"
                            style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: SANS, fontSize: 12.5, color: INK, textAlign: "left", textDecoration: editingHabitId === habit.id ? "underline" : "none" }}
                          >
                            {habit.title}
                          </button>
                        </td>
                        {weekDays.map((day, i) => (
                          <td key={day} style={{ textAlign: "center", padding: "4px", borderBottom: `1px solid ${LINE}` }}>
                            <Checkbox checked={!!weekItems[i]?.done} onChange={() => toggleDay(habit, day)} />
                          </td>
                        ))}
                        <td style={{ textAlign: "center", padding: "4px", borderBottom: `1px solid ${LINE}`, fontFamily: MONO, fontSize: 11, color: MUTE }}>
                          {doneCount}/7
                        </td>
                        <td style={{ borderBottom: `1px solid ${LINE}` }}>
                          <button
                            type="button"
                            onClick={() => { if (editingHabitId === habit.id) resetHabitForm(); secretary.deletePracticeHabit(habit.id); }}
                            title="Delete practice" style={{ border: "none", background: "none", color: MUTE, cursor: "pointer", fontSize: 13 }}
                          >×</button>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "project", label: "Projects" },
  { id: "goal", label: "Goals" },
];

// §9.2 -- Still Needed → Queue → In Progress → Almost Done → Done. Status
// is drag-settable here (native HTML5 DnD, no added dependency); it can
// also be auto-promoted into "in-progress" as a side effect of saving an
// Item under it (see useSecretary.js) -- both write the same field, so the
// column a card sits in is always the true current state either way.
function KanbanTab({ secretary, onNavigateKind }) {
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dragId, setDragId] = useState(null);

  const kinds = (secretary.kinds || []).filter((k) => (k.kindType === "project" || k.kindType === "goal") && (filter === "all" || k.kindType === filter));

  const moveTo = (id, status) => {
    const kind = kinds.find((k) => k.id === id) || (secretary.kinds || []).find((k) => k.id === id);
    if (!kind || kind.status === status) return;
    secretary.saveEntity("kind", { ...kind, status });
  };

  const timelineRows = kinds
    .filter((k) => k.timing?.dueDate)
    .map((k) => ({ id: k.id, title: k.title, date: k.timing.dueDate, startDate: k.timing.startDate || null, color: DOMAIN_COLORS[k.domain] || INKBLUE }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <TabBar tabs={FILTER_TABS} active={filter} onChange={setFilter} />
        <Btn small primary color={INKBLUE} onClick={() => setAdding(true)}>+ Add</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(180px, 1fr))", gap: 10, overflowX: "auto" }}>
        {KIND_STATUSES.map((col) => (
          <div
            key={col.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (dragId) moveTo(dragId, col.id); setDragId(null); }}
            style={{ minHeight: 120, background: "#F6F2E6", border: `1px solid ${LINE}`, borderRadius: 10, padding: 8 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLORS[col.id] || MUTE }} />
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: INK, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{col.label}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {kinds.filter((k) => k.status === col.id).map((k) => (
                <div key={k.id} draggable onDragStart={() => setDragId(k.id)}>
                  <EntityCard
                    family="kind" entity={k} secretary={secretary}
                    onEdit={(fam, e) => setEditing({ family: fam, entity: e })}
                    onNavigateKind={onNavigateKind}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <SectionTitle note="due dates">Timeline</SectionTitle>
      <Timeline rows={timelineRows} onClick={(id) => onNavigateKind?.(id)} />

      {adding && <AddForm secretary={secretary} onClose={() => setAdding(false)} />}
      {editing && (
        <EditEntityModal
          family={editing.family} entity={editing.entity} secretary={secretary}
          onClose={() => setEditing(null)} onDeleted={() => setEditing(null)}
        />
      )}
    </div>
  );
}

export default function Plans({ secretary, onBack, onNavigateKind }) {
  const [tab, setTab] = useState("practices");
  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Back</Btn>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <SectionTitle>Plans</SectionTitle>
        <TabBar tabs={TOP_TABS} active={tab} onChange={setTab} />
      </div>
      {tab === "practices" ? <PracticesTab secretary={secretary} /> : <KanbanTab secretary={secretary} onNavigateKind={onNavigateKind} />}
    </div>
  );
}
