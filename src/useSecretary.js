import { useState, useCallback, useEffect } from "react";
import {
  collection, getDocs, doc, setDoc, deleteDoc, addDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { DEFAULT_DOMAINS, DEFAULT_RESOURCES, DEFAULT_PRACTICE_CATEGORIES, DEFAULT_DISCIPLINE_TYPES } from "./constants";
import { itemFallsInWindow } from "./lib/graph";

const REFS = {
  kind: collection(db, "kinds"),
  item: collection(db, "items"),
};
const PRACTICE_HABITS_REF = collection(db, "practiceHabits");
const DISCIPLINES_REF = collection(db, "disciplines");
const PENDING_OPS_REF = collection(db, "pendingOperations");
const CHAT_REF = collection(db, "secretaryChat");
const EVENTS_REF = collection(db, "events");
const CAPTURES_REF = collection(db, "captures");
const CONFIG_REF = collection(db, "config");

// Append-only log of lifecycle transitions, written alongside every
// kind/item save/delete so Log (§8) and progress rollups can be
// reconstructed later without a scheduled snapshot job. Best-effort: a
// logging failure never blocks or fails the entity write itself.
async function logEvent(event) {
  try {
    await addDoc(EVENTS_REF, event);
  } catch (err) {
    console.error("Failed to log event", err);
  }
}

// Kind tracks lifecycle via `status`; Item is checkbox-completable via
// `done` instead -- this is the one field each family transitions on, and
// the value the event log's from/to records.
function transitionValue(type, entity) {
  return type === "item" ? String(!!entity.done) : entity.status;
}

// Deep-walks a compound step's patch, swapping any string exactly matching
// "$ref:sN" for the real id a same-bundle step with ref "sN" already
// produced -- the mechanism that lets e.g. a new Session's parentKindId
// point at a Project created earlier in the same bundle, before either
// existed. A ref that hasn't resolved yet (typo, or the model referenced a
// step that comes later) is left as the literal string rather than thrown
// away, so a bad proposal fails loudly (an invalid parentKindId) instead
// of silently landing null.
function resolveRefs(value, refMap) {
  if (typeof value === "string") {
    const m = /^\$ref:(.+)$/.exec(value);
    return m && refMap[m[1]] ? refMap[m[1]] : value;
  }
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, refMap));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveRefs(v, refMap)]));
  }
  return value;
}

// Refresh-on-open sync, not live push: the app loads everything once on
// mount and whenever refresh() is called explicitly -- Secretary is driven
// by a weekly meeting plus occasional capture, not sub-second cross-device
// visibility.
export function useSecretary(enabled) {
  const [kinds, setKinds] = useState(null);
  const [items, setItems] = useState(null);
  const [practiceHabits, setPracticeHabits] = useState(null);
  const [disciplines, setDisciplines] = useState(null);
  const [pendingOperations, setPendingOperations] = useState(null);
  const [chatMessages, setChatMessages] = useState(null);
  const [events, setEvents] = useState(null);
  const [captures, setCaptures] = useState(null);
  const [domains, setDomains] = useState(DEFAULT_DOMAINS);
  const [resources, setResources] = useState(DEFAULT_RESOURCES);
  const [practiceCategories, setPracticeCategories] = useState(DEFAULT_PRACTICE_CATEGORIES);
  const [disciplineTypes, setDisciplineTypes] = useState(DEFAULT_DISCIPLINE_TYPES);
  const [status, setStatus] = useState("loading"); // loading | ready | forbidden | error
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | error

  const refresh = useCallback(async () => {
    setStatus((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const [kindsSnap, itemsSnap, habitsSnap, disciplinesSnap, opsSnap, chatSnap, eventsSnap, capturesSnap, configSnap] =
        await Promise.all([
          getDocs(REFS.kind),
          getDocs(REFS.item),
          getDocs(PRACTICE_HABITS_REF),
          getDocs(DISCIPLINES_REF),
          getDocs(PENDING_OPS_REF),
          getDocs(CHAT_REF),
          getDocs(EVENTS_REF),
          getDocs(CAPTURES_REF),
          getDocs(CONFIG_REF),
        ]);
      const mapDocs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setKinds(mapDocs(kindsSnap));
      setItems(mapDocs(itemsSnap));
      setPracticeHabits(mapDocs(habitsSnap));
      setDisciplines(mapDocs(disciplinesSnap));
      setPendingOperations(mapDocs(opsSnap));
      setChatMessages(mapDocs(chatSnap));
      setEvents(mapDocs(eventsSnap));
      setCaptures(mapDocs(capturesSnap));

      const domainsDoc = configSnap.docs.find((d) => d.id === "domains");
      const resourcesDoc = configSnap.docs.find((d) => d.id === "resources");
      const practiceCategoriesDoc = configSnap.docs.find((d) => d.id === "practiceCategories");
      const disciplineTypesDoc = configSnap.docs.find((d) => d.id === "disciplineTypes");
      setDomains(domainsDoc?.data()?.entries || DEFAULT_DOMAINS);
      setResources(resourcesDoc?.data()?.entries || DEFAULT_RESOURCES);
      setPracticeCategories(practiceCategoriesDoc?.data()?.entries || DEFAULT_PRACTICE_CATEGORIES);
      setDisciplineTypes(disciplineTypesDoc?.data()?.entries || DEFAULT_DISCIPLINE_TYPES);

      setStatus("ready");
    } catch (err) {
      console.error("Failed to load Secretary's data", err);
      setStatus(err.code === "permission-denied" ? "forbidden" : "error");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  // Small lookups so saveEntity/deleteEntity can stay generic across the
  // two families -- wrapped in useCallback (rather than plain object
  // literals) purely so their own dependency arrays stay exhaustive-deps
  // clean, since the two callbacks below only reference these, not the
  // individual state variables, directly.
  const getSetter = useCallback((type) => ({ kind: setKinds, item: setItems }[type]), []);
  const getList = useCallback((type) => ({ kind: kinds, item: items }[type]), [kinds, items]);

  // Creates a new Kind/Item or overwrites an existing one in full. Each
  // entity is its own document (no growing-array document to split), so
  // there's no partial-field conflict risk worth guarding against.
  const saveEntity = useCallback(async (type, entity) => {
    setSaveStatus("saving");
    try {
      const ref = REFS[type];
      const { id, ...rest } = entity;
      const docId = id || doc(ref).id;
      const prev = id ? (getList(type) || []).find((e) => e.id === id) : null;
      const now = Date.now();
      const payload = { ...rest, createdAt: prev?.createdAt || now, updatedAt: now };
      await setDoc(doc(ref, docId), payload);

      const nextVal = transitionValue(type, payload);
      const prevVal = prev ? transitionValue(type, prev) : null;
      if (!prev || prevVal !== nextVal) {
        await logEvent({
          entityType: type,
          entityId: docId,
          ...(payload.domain ? { domain: payload.domain } : {}),
          from: prev ? prevVal : null,
          to: nextVal,
          at: now,
        });
      }

      getSetter(type)((prevList) => {
        const next = (prevList || []).filter((e) => e.id !== docId);
        next.push({ id: docId, ...payload });
        return next;
      });

      // An Item scheduled into today-through-this-week auto-promotes its
      // still-queued parent Kind into "in-progress" -- one write direction
      // (Item save -> maybe patches its Kind), status stays fully
      // drag-overridable afterward on the Plans kanban. Best-effort: never
      // blocks or fails the Item save itself.
      if (type === "item" && payload.parentKindId && itemFallsInWindow(payload.timing)) {
        const parent = (getList("kind") || []).find((k) => k.id === payload.parentKindId);
        if (parent && parent.status === "queued") {
          saveEntity("kind", { ...parent, status: "in-progress" }).catch(() => {});
        }
      }

      setSaveStatus("idle");
      return docId;
    } catch (err) {
      console.error(`Failed to save ${type}`, err);
      setSaveStatus("error");
      throw err;
    }
  }, [getList, getSetter]);

  const deleteEntity = useCallback(async (type, id) => {
    setSaveStatus("saving");
    try {
      const prev = (getList(type) || []).find((e) => e.id === id);
      await deleteDoc(doc(REFS[type], id));

      if (prev) {
        await logEvent({
          entityType: type,
          entityId: id,
          ...(prev.domain ? { domain: prev.domain } : {}),
          from: transitionValue(type, prev),
          to: "deleted",
          at: Date.now(),
        });
      }

      getSetter(type)((prevList) => (prevList || []).filter((e) => e.id !== id));
      setSaveStatus("idle");
    } catch (err) {
      console.error(`Failed to delete ${type}`, err);
      setSaveStatus("error");
    }
  }, [getList, getSetter]);

  // Practice habit definitions -- never carry a completion state
  // themselves (see lib/graph.js for the Item-is-the-single-source-of-
  // truth sync contract with the Practices tracker).
  const savePracticeHabit = useCallback(async (habit) => {
    setSaveStatus("saving");
    try {
      const { id, ...rest } = habit;
      const now = Date.now();
      const docId = id || doc(PRACTICE_HABITS_REF).id;
      await setDoc(doc(PRACTICE_HABITS_REF, docId), { ...rest, createdAt: rest.createdAt || now });
      setPracticeHabits((prevList) => {
        const next = (prevList || []).filter((h) => h.id !== docId);
        next.push({ id: docId, ...rest, createdAt: rest.createdAt || now });
        return next;
      });
      setSaveStatus("idle");
      return docId;
    } catch (err) {
      console.error("Failed to save practice habit", err);
      setSaveStatus("error");
      throw err;
    }
  }, []);

  const deletePracticeHabit = useCallback(async (id) => {
    setSaveStatus("saving");
    try {
      await deleteDoc(doc(PRACTICE_HABITS_REF, id));
      setPracticeHabits((prevList) => (prevList || []).filter((h) => h.id !== id));
      setSaveStatus("idle");
    } catch (err) {
      console.error("Failed to delete practice habit", err);
      setSaveStatus("error");
    }
  }, []);

  // A discipline is a bad habit being eliminated (Plans' "Habits to
  // Break") -- unlike a practice habit it does carry its own lifecycle
  // state (focused/resolved/startedAt) since there's no separate per-day
  // Item standing in for it. Logs the same append-only event trail as
  // Kind/Item saves so Trends can reconstruct streak history later:
  // startedAt moving = a relapse resetting the clock, focused flipping =
  // paused/resumed, resolved flipping true = the habit's been broken.
  const saveDiscipline = useCallback(async (discipline) => {
    setSaveStatus("saving");
    try {
      const { id, ...rest } = discipline;
      const docId = id || doc(DISCIPLINES_REF).id;
      const prev = id ? (disciplines || []).find((d) => d.id === id) : null;
      const now = Date.now();
      const payload = { ...rest, createdAt: prev?.createdAt || now, updatedAt: now };
      await setDoc(doc(DISCIPLINES_REF, docId), payload);

      let transition = null;
      if (!prev) transition = "started";
      else if (prev.startedAt !== payload.startedAt) transition = "relapsed";
      else if (!prev.resolved && payload.resolved) transition = "resolved";
      else if (prev.focused !== payload.focused) transition = payload.focused ? "resumed" : "paused";
      if (transition) {
        await logEvent({
          entityType: "discipline",
          entityId: docId,
          from: prev ? (prev.focused ? "focused" : "paused") : null,
          to: transition,
          at: now,
        });
      }

      setDisciplines((prevList) => {
        const next = (prevList || []).filter((d) => d.id !== docId);
        next.push({ id: docId, ...payload });
        return next;
      });
      setSaveStatus("idle");
      return docId;
    } catch (err) {
      console.error("Failed to save discipline", err);
      setSaveStatus("error");
      throw err;
    }
  }, [disciplines]);

  const deleteDiscipline = useCallback(async (id) => {
    setSaveStatus("saving");
    try {
      const prev = (disciplines || []).find((d) => d.id === id);
      await deleteDoc(doc(DISCIPLINES_REF, id));
      if (prev) {
        await logEvent({
          entityType: "discipline",
          entityId: id,
          from: prev.focused ? "focused" : "paused",
          to: "deleted",
          at: Date.now(),
        });
      }
      setDisciplines((prevList) => (prevList || []).filter((d) => d.id !== id));
      setSaveStatus("idle");
    } catch (err) {
      console.error("Failed to delete discipline", err);
      setSaveStatus("error");
    }
  }, [disciplines]);

  // Applies an approved compound pendingOperation -- a bundle of linked
  // steps (see functions/index.js's secretaryChat prompt) approved and
  // written together via the review log's "Approve all". Steps run in
  // order through the exact same saveEntity/savePracticeHabit/
  // saveDiscipline paths every other write in the app uses (no forked
  // write logic, same discipline as the single-op review card), and each
  // step's created id is recorded under its own "ref" so a LATER step in
  // the same bundle can point at it (e.g. a new Session's parentKindId
  // referencing the Project a step earlier just created) via a literal
  // "$ref:sN" string, resolved here before that step is written.
  const applyCompoundOperation = useCallback(async (op) => {
    setSaveStatus("saving");
    try {
      const refMap = {};
      for (const sub of op.ops || []) {
        const patch = resolveRefs(sub.patch, refMap);
        let id;
        if (sub.entityType === "kind" || sub.entityType === "item") {
          const list = sub.entityType === "kind" ? kinds : items;
          const base = sub.action === "update" && sub.targetId ? (list || []).find((e) => e.id === sub.targetId) || {} : {};
          const payload = { ...base, ...patch };
          if (sub.action === "update") payload.id = sub.targetId;
          if (sub.entityType === "kind" && !payload.status) payload.status = base.status || "not-started";
          if (sub.entityType === "item" && payload.done == null) payload.done = base.done || false;
          id = await saveEntity(sub.entityType, payload);
        } else if (sub.entityType === "practiceHabit") {
          const base = sub.action === "update" && sub.targetId ? (practiceHabits || []).find((h) => h.id === sub.targetId) || {} : {};
          const payload = { ...base, ...patch };
          if (sub.action === "update") payload.id = sub.targetId;
          id = await savePracticeHabit(payload);
        } else if (sub.entityType === "discipline") {
          const base = sub.action === "update" && sub.targetId ? (disciplines || []).find((d) => d.id === sub.targetId) || {} : {};
          const { relapse, ...rest } = patch;
          const payload = { ...base, ...rest, ...(relapse ? { startedAt: Date.now() } : {}) };
          if (sub.action === "update") payload.id = sub.targetId;
          id = await saveDiscipline(payload);
        }
        if (sub.ref && id) refMap[sub.ref] = id;
      }
      setSaveStatus("idle");
    } catch (err) {
      console.error("Failed to apply compound operation", err);
      setSaveStatus("error");
      throw err;
    }
  }, [kinds, items, practiceHabits, disciplines, saveEntity, savePracticeHabit, saveDiscipline]);

  // Captures are just the raw intake record now -- not event-logged (same
  // "plain document" treatment as before), since triage always drafts a
  // pendingOperation for review rather than writing anything directly.
  const saveCapture = useCallback(async (capture) => {
    setSaveStatus("saving");
    try {
      const { id, ...rest } = capture;
      const now = Date.now();
      let docId = id;
      if (id) {
        await setDoc(doc(CAPTURES_REF, id), { ...rest, createdAt: rest.createdAt || now });
      } else {
        const ref = await addDoc(CAPTURES_REF, { ...rest, createdAt: now });
        docId = ref.id;
      }
      setCaptures((prevList) => {
        const next = (prevList || []).filter((c) => c.id !== docId);
        next.push({ id: docId, ...rest, createdAt: rest.createdAt || now });
        return next;
      });
      setSaveStatus("idle");
      return docId;
    } catch (err) {
      console.error("Failed to save capture", err);
      setSaveStatus("error");
      throw err;
    }
  }, []);

  const deleteCapture = useCallback(async (id) => {
    setSaveStatus("saving");
    try {
      await deleteDoc(doc(CAPTURES_REF, id));
      setCaptures((prevList) => (prevList || []).filter((c) => c.id !== id));
      setSaveStatus("idle");
    } catch (err) {
      console.error("Failed to delete capture", err);
      setSaveStatus("error");
    }
  }, []);

  // pendingOperations -- the one shared queue capture triage, Secretary
  // chat, and weekly-import all write into. Approving/discarding is just a
  // status patch here; actually applying an approved op (writing the real
  // Kind/Item) is the caller's job via saveEntity, kept out of this hook so
  // there's exactly one place that creates Kinds/Items (the Add-Form path).
  const savePendingOperation = useCallback(async (op) => {
    setSaveStatus("saving");
    try {
      const { id, ...rest } = op;
      const now = Date.now();
      let docId = id;
      if (id) {
        await setDoc(doc(PENDING_OPS_REF, id), { ...rest, createdAt: rest.createdAt || now });
      } else {
        const ref = await addDoc(PENDING_OPS_REF, { ...rest, createdAt: now });
        docId = ref.id;
      }
      setPendingOperations((prevList) => {
        const next = (prevList || []).filter((o) => o.id !== docId);
        next.push({ id: docId, ...rest, createdAt: rest.createdAt || now });
        return next;
      });
      setSaveStatus("idle");
      return docId;
    } catch (err) {
      console.error("Failed to save pending operation", err);
      setSaveStatus("error");
      throw err;
    }
  }, []);

  const deletePendingOperation = useCallback(async (id) => {
    setSaveStatus("saving");
    try {
      await deleteDoc(doc(PENDING_OPS_REF, id));
      setPendingOperations((prevList) => (prevList || []).filter((o) => o.id !== id));
      setSaveStatus("idle");
    } catch (err) {
      console.error("Failed to delete pending operation", err);
      setSaveStatus("error");
    }
  }, []);

  // Secretary chat -- lightweight message log, append-only from the UI's
  // perspective (no edit/delete surface needed for a chat transcript).
  const saveChatMessage = useCallback(async (message) => {
    try {
      const ref = await addDoc(CHAT_REF, { ...message, at: message.at || Date.now() });
      setChatMessages((prevList) => [...(prevList || []), { id: ref.id, ...message, at: message.at || Date.now() }]);
      return ref.id;
    } catch (err) {
      console.error("Failed to save chat message", err);
      throw err;
    }
  }, []);

  // Domains / Resources / Practice-categories editors -- full-array
  // replacement, not a partial merge, so an entry can be reordered or
  // removed as easily as edited.
  const saveConfig = useCallback(async (id, entries) => {
    setSaveStatus("saving");
    try {
      await setDoc(doc(CONFIG_REF, id), { entries });
      if (id === "domains") setDomains(entries);
      if (id === "resources") setResources(entries);
      if (id === "practiceCategories") setPracticeCategories(entries);
      if (id === "disciplineTypes") setDisciplineTypes(entries);
      setSaveStatus("idle");
    } catch (err) {
      console.error(`Failed to save config/${id}`, err);
      setSaveStatus("error");
      throw err;
    }
  }, []);

  return {
    kinds, items, practiceHabits, disciplines, pendingOperations, chatMessages, events, captures,
    domains, resources, practiceCategories, disciplineTypes,
    status, saveStatus, refresh,
    saveEntity, deleteEntity, savePracticeHabit, deletePracticeHabit, saveDiscipline, deleteDiscipline,
    saveCapture, deleteCapture, savePendingOperation, deletePendingOperation, applyCompoundOperation,
    saveChatMessage, saveConfig,
  };
}

