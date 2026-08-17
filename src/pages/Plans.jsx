import { Fragment, useState } from "react";
import { Btn, SectionTitle, Note, Card, Input, Select, TabBar, Checkbox, Pill, ProgressBar } from "../ui";
import { SANS, MONO, INK, MUTE, INKBLUE, LINE, BRICK, DOMAIN_COLORS, STATUS_COLORS, HEAD_BG, softTint } from "../theme";
import { EntityCard } from "../components/EntityCard";
import { Field, TagsInput, MultiCheckList, DisciplineMilestonesEditor, KindParentPicker } from "../components/formFields";
import AddForm from "../components/AddForm";
import EditEntityModal from "../components/EditEntityModal";
import { Timeline } from "../components/charts";
import { KIND_STATUSES, weekStartISO, addDaysISO, DEFAULT_DISCIPLINE_MILESTONES, disciplineTypeLabel } from "../constants";
import { practiceItemFor, allTagsInUse, disciplineStreak, practiceHabitProgress } from "../lib/graph";

const TOP_TABS = [
  { id: "practices", label: "Practices" },
  { id: "projects", label: "Projects & Goals" },
];

function slugify(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `cat-${Date.now()}`;
}

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const OTHER_TYPE_ID = "__other__";

// §9.1 -- category management, habit definitions, and the weekly tracker
// grid. The grid never keeps its own completion state: every cell reads/
// writes through practiceItemFor's find-or-create-on-demand Item, the same
// one Today/Week's own checkbox would touch for that habit+day (§9.1.1).
function PracticesTab({ secretary }) {
  const categories = secretary.practiceCategories || [];
  const habits = secretary.practiceHabits || [];
  const goalProjectKinds = (secretary.kinds || []).filter((k) => k.kindType === "project" || k.kindType === "goal");

  const [newCategory, setNewCategory] = useState("");
  const [editingHabitId, setEditingHabitId] = useState(null);
  const [habitTitle, setHabitTitle] = useState("");
  const [habitCategory, setHabitCategory] = useState(categories[0]?.id || "");
  const [habitResources, setHabitResources] = useState([]);
  const [habitTags, setHabitTags] = useState([]);
  const [habitLinkedKindId, setHabitLinkedKindId] = useState(null);
  const [habitProgressUnit, setHabitProgressUnit] = useState("");
  const [habitProgressTarget, setHabitProgressTarget] = useState("");
  const [weekStart, setWeekStart] = useState(() => weekStartISO());
  const [editingCell, setEditingCell] = useState(null); // { habitId, day }
  const [cellValue, setCellValue] = useState("");

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
    setHabitLinkedKindId(null);
    setHabitProgressUnit("");
    setHabitProgressTarget("");
  };

  const startEditHabit = (habit) => {
    setEditingHabitId(habit.id);
    setHabitTitle(habit.title);
    setHabitCategory(habit.categoryId);
    setHabitResources(habit.resources || []);
    setHabitTags(habit.tags || []);
    setHabitLinkedKindId(habit.linkedKindId || null);
    setHabitProgressUnit(habit.progressUnit || "");
    setHabitProgressTarget(habit.progressTarget ? String(habit.progressTarget) : "");
  };

  const saveHabit = async () => {
    const title = habitTitle.trim();
    if (!title || !habitCategory) return;
    if (habitLinkedKindId && (!habitProgressUnit.trim() || !Number(habitProgressTarget))) return;
    const editing = editingHabitId ? habits.find((h) => h.id === editingHabitId) : null;
    await secretary.savePracticeHabit({
      id: editingHabitId || undefined,
      createdAt: editing?.createdAt,
      title, categoryId: habitCategory, resources: habitResources, tags: habitTags,
      active: editing?.active !== false,
      linkedKindId: habitLinkedKindId || null,
      progressUnit: habitLinkedKindId ? habitProgressUnit.trim() : null,
      progressTarget: habitLinkedKindId ? Number(habitProgressTarget) : null,
    });
    resetHabitForm();
  };

  // "Mark goal reached" is the explicit close-the-loop action (§ goal-
  // linked habits): marks the linked Kind done (if it isn't already) and
  // clears the habit's own linkedKindId/progressUnit/progressTarget, which
  // is all it takes to turn it back into a plain weekly-checkbox habit --
  // no separate "mode" flag to keep in sync, since the tracker below reads
  // linkedKindId's presence directly to decide how to render a habit.
  const markGoalReached = async (habit) => {
    const kind = (secretary.kinds || []).find((k) => k.id === habit.linkedKindId);
    if (kind && kind.status !== "done") {
      await secretary.saveEntity("kind", { ...kind, status: "done" });
    }
    await secretary.savePracticeHabit({ ...habit, linkedKindId: null, progressUnit: null, progressTarget: null });
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

  const openCellEditor = (habit, day, existingItem) => {
    setEditingCell({ habitId: habit.id, day });
    setCellValue(existingItem?.progressAmount ? String(existingItem.progressAmount) : "");
  };

  const commitCell = async (habit, day) => {
    const amount = Number(cellValue) || 0;
    const existing = practiceItemFor(habit.id, day, secretary.items);
    if (amount <= 0) {
      if (existing) await secretary.saveEntity("item", { ...existing, done: false, progressAmount: 0, completedAt: null });
    } else if (existing) {
      await secretary.saveEntity("item", { ...existing, done: true, progressAmount: amount, completedAt: existing.completedAt || Date.now() });
    } else {
      await secretary.saveEntity("item", {
        title: habit.title, itemType: "other", domain: "practices", secondaryDomains: [],
        resources: habit.resources || [], tags: habit.tags || [], parentKindId: null,
        timing: { targetDay: day, floating: true }, done: true, completedAt: Date.now(), progressAmount: amount,
        isRecurringPracticeItem: true, practiceHabitId: habit.id, createdVia: "add-form",
      });
    }
    setEditingCell(null);
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
        <Field label="Link to a Goal or Project (optional)">
          <KindParentPicker kinds={goalProjectKinds} value={habitLinkedKindId} onChange={setHabitLinkedKindId} />
        </Field>
        {habitLinkedKindId && (
          <>
            <Note>
              Linked habits drop the weekly checkbox for a numeric log instead -- click a day in the tracker below to record how much you did (pages read, minutes, reps, whatever unit fits). "Mark goal reached" on the tracker row closes it out: the Goal/Project gets marked done and this habit turns back into a plain weekly checkbox.
            </Note>
            <Field label="Progress unit (e.g. chapters, pages, minutes)">
              <Input value={habitProgressUnit} onChange={setHabitProgressUnit} placeholder="chapters" />
            </Field>
            <Field label="Target amount">
              <Input value={habitProgressTarget} onChange={setHabitProgressTarget} placeholder="12" type="number" />
            </Field>
          </>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn
            primary color={INKBLUE}
            disabled={!habitTitle.trim() || !habitCategory || (!!habitLinkedKindId && (!habitProgressUnit.trim() || !Number(habitProgressTarget)))}
            onClick={saveHabit}
          >
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
                    const goal = practiceHabitProgress(habit, secretary.items);
                    const linkedKind = habit.linkedKindId ? (secretary.kinds || []).find((k) => k.id === habit.linkedKindId) : null;
                    return (
                      <Fragment key={habit.id}>
                        <tr>
                          <td style={{ padding: "4px 10px 4px 0", borderBottom: goal ? "none" : `1px solid ${LINE}` }}>
                            <button
                              type="button" onClick={() => startEditHabit(habit)} title="Edit practice"
                              style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: SANS, fontSize: 12.5, color: INK, textAlign: "left", textDecoration: editingHabitId === habit.id ? "underline" : "none" }}
                            >
                              {habit.title}
                            </button>
                          </td>
                          {weekDays.map((day, i) => {
                            const isEditing = editingCell && editingCell.habitId === habit.id && editingCell.day === day;
                            return (
                              <td key={day} style={{ textAlign: "center", padding: "4px", borderBottom: goal ? "none" : `1px solid ${LINE}` }}>
                                {goal ? (
                                  isEditing ? (
                                    <input
                                      autoFocus type="number" value={cellValue}
                                      onChange={(e) => setCellValue(e.target.value)}
                                      onBlur={() => commitCell(habit, day)}
                                      onKeyDown={(e) => { if (e.key === "Enter") commitCell(habit, day); if (e.key === "Escape") setEditingCell(null); }}
                                      style={{ width: 44, fontFamily: MONO, fontSize: 11, textAlign: "center", border: `1px solid ${LINE}`, borderRadius: 4, padding: "2px 0" }}
                                    />
                                  ) : (
                                    <button
                                      type="button" onClick={() => openCellEditor(habit, day, weekItems[i])}
                                      title="Log an amount for this day"
                                      style={{ border: "none", background: "none", cursor: "pointer", fontFamily: MONO, fontSize: 11.5, color: weekItems[i]?.progressAmount ? INK : MUTE, minWidth: 20 }}
                                    >
                                      {weekItems[i]?.progressAmount || "—"}
                                    </button>
                                  )
                                ) : (
                                  <Checkbox checked={!!weekItems[i]?.done} onChange={() => toggleDay(habit, day)} />
                                )}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: "center", padding: "4px", borderBottom: goal ? "none" : `1px solid ${LINE}`, fontFamily: MONO, fontSize: 11, color: MUTE }}>
                            {goal ? `${goal.current}${goal.unit ? ` ${goal.unit}` : ""}` : `${doneCount}/7`}
                          </td>
                          <td style={{ borderBottom: goal ? "none" : `1px solid ${LINE}` }}>
                            <button
                              type="button"
                              onClick={() => { if (editingHabitId === habit.id) resetHabitForm(); secretary.deletePracticeHabit(habit.id); }}
                              title="Delete practice" style={{ border: "none", background: "none", color: MUTE, cursor: "pointer", fontSize: 13 }}
                            >×</button>
                          </td>
                        </tr>
                        {goal && (
                          <tr>
                            <td colSpan={10} style={{ padding: "0 0 10px", borderBottom: `1px solid ${LINE}` }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                {linkedKind && <Pill color={DOMAIN_COLORS[linkedKind.domain]}>{linkedKind.title}</Pill>}
                                <span style={{ fontFamily: MONO, fontSize: 11, color: MUTE, flex: "none" }}>
                                  {goal.current} / {goal.target} {goal.unit}
                                </span>
                                <div style={{ flex: 1, minWidth: 100 }}>
                                  <ProgressBar percent={goal.percent} color={INKBLUE} />
                                </div>
                                <Btn small color={MUTE} onClick={() => markGoalReached(habit)}>Mark goal reached</Btn>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DisciplinesSection secretary={secretary} />
    </div>
  );
}

// The inverse of a practice: not something you do and check off, but a bad
// habit you're actively eliminating. "Focus" is the pull-into-background
// toggle -- a focused, unresolved discipline shows as a chip on Today/Week
// (TimeGrid.jsx). Streak days count up live from startedAt; "Slipped
// today" resets that clock rather than requiring per-day check-ins, and
// every meaningful transition is event-logged (useSecretary.js) so Trends
// can plot streak history later.
function DisciplinesSection({ secretary }) {
  const disciplines = secretary.disciplines || [];
  const active = disciplines.filter((d) => !d.resolved);
  const resolved = disciplines.filter((d) => d.resolved);

  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState(secretary.disciplineTypes[0]?.id || "");
  const [otherTypeText, setOtherTypeText] = useState("");
  const [resources, setResources] = useState([]);
  const [tags, setTags] = useState([]);
  const [milestones, setMilestones] = useState(DEFAULT_DISCIPLINE_MILESTONES);

  const tagSuggestions = allTagsInUse(secretary);
  const typeOptions = [...secretary.disciplineTypes, { id: OTHER_TYPE_ID, label: "Other…" }];

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setType(secretary.disciplineTypes[0]?.id || "");
    setOtherTypeText("");
    setResources([]);
    setTags([]);
    setMilestones(DEFAULT_DISCIPLINE_MILESTONES);
  };

  const startEdit = (d) => {
    setEditingId(d.id);
    setTitle(d.title);
    setType(d.type);
    setOtherTypeText("");
    setResources(d.resources || []);
    setTags(d.tags || []);
    setMilestones(d.milestones || []);
  };

  const save = async () => {
    const t = title.trim();
    if (!t || !type) return;

    let finalType = type;
    if (type === OTHER_TYPE_ID) {
      const label = otherTypeText.trim();
      if (!label) return;
      const id = slugify(label);
      if (!secretary.disciplineTypes.some((dt) => dt.id === id)) {
        await secretary.saveConfig("disciplineTypes", [...secretary.disciplineTypes, { id, label }]);
      }
      finalType = id;
    }

    const editing = editingId ? disciplines.find((d) => d.id === editingId) : null;
    await secretary.saveDiscipline({
      id: editingId || undefined,
      title: t, type: finalType, resources, tags, milestones,
      focused: editing?.focused ?? true,
      resolved: editing?.resolved || false,
      startedAt: editing?.startedAt || Date.now(),
    });
    resetForm();
  };

  const slip = (d) => secretary.saveDiscipline({ ...d, startedAt: Date.now() });
  const toggleFocus = (d) => secretary.saveDiscipline({ ...d, focused: !d.focused });
  const resolve = (d) => secretary.saveDiscipline({ ...d, focused: false, resolved: true });

  return (
    <>
      <SectionTitle note="not something you check off -- something you're weeding out">Habits to Break</SectionTitle>
      <Note>
        Pull a habit "into focus" and it shows up as a background chip on Today and Week while it's being dealt with, with a live streak count. "Slipped today" resets the clock rather than needing a daily check-in; every reset/pause/resolve is logged for Trends to use later.
      </Note>

      <div style={{ marginTop: 10 }}>
        <SectionTitle note="habit definitions">{editingId ? "Edit Habit to Break" : "Add a Habit to Break"}</SectionTitle>
        <Card>
          <Field label="Name">
            <Input value={title} onChange={setTitle} placeholder="e.g. Quit smoking" />
          </Field>
          <Field label="Type">
            <Select value={type} onChange={setType} options={typeOptions} />
          </Field>
          {type === OTHER_TYPE_ID && (
            <Field label="New type name">
              <Input value={otherTypeText} onChange={setOtherTypeText} placeholder="e.g. Spiritual" />
            </Field>
          )}
          <Field label="Milestones (days since last reset)">
            <DisciplineMilestonesEditor value={milestones} onChange={setMilestones} />
          </Field>
          <Field label="Resources">
            <MultiCheckList options={secretary.resources} value={resources} onChange={setResources} />
          </Field>
          <Field label="Tags">
            <TagsInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn primary color={BRICK} disabled={!title.trim() || !type || (type === OTHER_TYPE_ID && !otherTypeText.trim())} onClick={save}>
              {editingId ? "Save changes" : "Add habit to break"}
            </Btn>
            {editingId && <Btn color={MUTE} onClick={resetForm}>Cancel</Btn>}
          </div>
        </Card>
      </div>

      {active.length === 0 ? (
        <Note>No habits being tracked for elimination.</Note>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {active.map((d) => {
            const { days, nextMilestone, percent } = disciplineStreak(d);
            const sortedMilestones = [...(d.milestones || [])].sort((a, b) => a.days - b.days);
            return (
              <Card key={d.id}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <button
                      type="button" onClick={() => startEdit(d)} title="Edit"
                      style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: SANS, fontSize: 13.5, fontWeight: 500, color: INK, textAlign: "left", textDecoration: editingId === d.id ? "underline" : "none" }}
                    >
                      {d.title}
                    </button>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      <Pill color={MUTE}>{disciplineTypeLabel(d.type, secretary.disciplineTypes)}</Pill>
                      {d.focused && <Pill color={BRICK} tint={softTint(BRICK)}>in focus</Pill>}
                    </div>
                  </div>
                  <button type="button" onClick={() => secretary.deleteDiscipline(d.id)} title="Delete" style={{ border: "none", background: "none", color: MUTE, cursor: "pointer", fontSize: 13 }}>×</button>
                </div>

                <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 600, color: BRICK, marginTop: 10 }}>
                  {days} {days === 1 ? "day" : "days"}
                </div>
                {nextMilestone ? (
                  <>
                    <ProgressBar percent={percent} color={BRICK} />
                    <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 2 }}>
                      {nextMilestone.days - days} day{nextMilestone.days - days === 1 ? "" : "s"} to "{nextMilestone.label}"
                    </div>
                  </>
                ) : sortedMilestones.length > 0 ? (
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 4 }}>Past every milestone set for this.</div>
                ) : null}

                {sortedMilestones.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {sortedMilestones.map((m) => (
                      <Pill key={m.id} color={m.days <= days ? BRICK : MUTE} tint={m.days <= days ? softTint(BRICK) : undefined}>
                        {m.days <= days ? "✓ " : ""}{m.label}
                      </Pill>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <Btn small color={BRICK} onClick={() => slip(d)}>Slipped today</Btn>
                  <Btn small color={MUTE} onClick={() => toggleFocus(d)}>{d.focused ? "Stop focusing" : "Pull into focus"}</Btn>
                  <Btn small color={MUTE} onClick={() => resolve(d)}>Mark resolved</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <SectionTitle note="fully broken">Resolved</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {resolved.map((d) => {
              const { days } = disciplineStreak(d);
              return (
                <Pill key={d.id} color={MUTE} title="Click to re-focus if it comes back">
                  <span onClick={() => secretary.saveDiscipline({ ...d, resolved: false, focused: false })} style={{ cursor: "pointer" }}>
                    {d.title} -- {days}d
                  </span>
                </Pill>
              );
            })}
          </div>
        </div>
      )}
    </>
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
            style={{ minHeight: 120, background: HEAD_BG, border: `1px solid ${LINE}`, borderRadius: 10, padding: 8 }}
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
