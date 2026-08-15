import { useState, useCallback, useEffect } from "react";
import {
  collection, getDocs, doc, setDoc, deleteDoc, addDoc, updateDoc, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "./firebase";
import { DEFAULT_ROUTING_TABLE, DEFAULT_DOMAINS } from "./constants";

const REFS = {
  goal: collection(db, "goals"),
  project: collection(db, "projects"),
  plan: collection(db, "plans"),
  session: collection(db, "sessions"),
  task: collection(db, "tasks"),
};
const EVENTS_REF = collection(db, "events");
const CAPTURES_REF = collection(db, "captures");
const CONFIG_REF = collection(db, "config");
const IDEAS_REF = collection(db, "ideas");

// Append-only log of lifecycle transitions, written alongside every
// goal/project/plan/session/task save/delete so the Goal rollup report can
// be reconstructed later without a scheduled snapshot job. Best-effort: a
// logging failure never blocks or fails the entity write itself.
async function logEvent(event) {
  try {
    await addDoc(EVENTS_REF, event);
  } catch (err) {
    console.error("Failed to log event", err);
  }
}

// Goal/Project/Plan track lifecycle via `status`; Session/Task are
// checkbox-completable via `done` instead -- this is the one field each
// entity type transitions on, and the value the event log's from/to records.
function transitionValue(type, entity) {
  return type === "session" || type === "task" ? String(!!entity.done) : entity.status;
}

// Refresh-on-open sync, not live push: the app loads everything once on
// mount and whenever refresh() is called explicitly -- Secretary is driven
// by a weekly meeting plus occasional capture, not sub-second cross-device
// visibility.
export function useSecretary(enabled) {
  const [goals, setGoals] = useState(null);
  const [projects, setProjects] = useState(null);
  const [plans, setPlans] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [events, setEvents] = useState(null);
  const [captures, setCaptures] = useState(null);
  const [ideas, setIdeas] = useState(null);
  const [routingTable, setRoutingTable] = useState(DEFAULT_ROUTING_TABLE);
  const [domains, setDomains] = useState(DEFAULT_DOMAINS);
  const [status, setStatus] = useState("loading"); // loading | ready | forbidden | error
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | error

  const refresh = useCallback(async () => {
    setStatus((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const [goalsSnap, projectsSnap, plansSnap, sessionsSnap, tasksSnap, eventsSnap, capturesSnap, configSnap, ideasSnap] =
        await Promise.all([
          getDocs(REFS.goal),
          getDocs(REFS.project),
          getDocs(REFS.plan),
          getDocs(REFS.session),
          getDocs(REFS.task),
          getDocs(EVENTS_REF),
          getDocs(CAPTURES_REF),
          getDocs(CONFIG_REF),
          getDocs(IDEAS_REF),
        ]);
      const mapDocs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setGoals(mapDocs(goalsSnap));
      setProjects(mapDocs(projectsSnap));
      setPlans(mapDocs(plansSnap));
      setSessions(mapDocs(sessionsSnap));
      setTasks(mapDocs(tasksSnap));
      setEvents(mapDocs(eventsSnap));
      setCaptures(mapDocs(capturesSnap));
      setIdeas(mapDocs(ideasSnap));

      const routingDoc = configSnap.docs.find((d) => d.id === "routingTable");
      const domainsDoc = configSnap.docs.find((d) => d.id === "domains");
      setRoutingTable(routingDoc?.data()?.entries || DEFAULT_ROUTING_TABLE);
      setDomains(domainsDoc?.data()?.entries || DEFAULT_DOMAINS);

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
  // five entity types -- wrapped in useCallback (rather than plain object
  // literals) purely so their own dependency arrays stay exhaustive-deps
  // clean, since the two callbacks below only reference these, not the
  // individual state variables, directly.
  const getSetter = useCallback((type) => ({
    goal: setGoals, project: setProjects, plan: setPlans, session: setSessions, task: setTasks,
  }[type]), []);
  const getList = useCallback((type) => ({
    goal: goals, project: projects, plan: plans, session: sessions, task: tasks,
  }[type]), [goals, projects, plans, sessions, tasks]);

  // Creates a new entity or overwrites an existing one in full. Each entity
  // is its own document (no growing-array document to split), so there's no
  // partial-field conflict risk worth guarding against.
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

      // Best-effort denormalized ordering arrays (Plan.sessionIds,
      // Session.taskIds) -- the source of truth for "what belongs under
      // what" is still each child's own planId/sessionId back-reference, so
      // a failure here never breaks placement, only display order.
      if (type === "session" && !prev && payload.planId) {
        updateDoc(doc(REFS.plan, payload.planId), { sessionIds: arrayUnion(docId) }).catch(() => {});
      }
      if (type === "task" && !prev && payload.sessionId) {
        updateDoc(doc(REFS.session, payload.sessionId), { taskIds: arrayUnion(docId) }).catch(() => {});
      }

      getSetter(type)((prevList) => {
        const next = (prevList || []).filter((e) => e.id !== docId);
        next.push({ id: docId, ...payload });
        return next;
      });
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
      if (type === "session" && prev?.planId) {
        updateDoc(doc(REFS.plan, prev.planId), { sessionIds: arrayRemove(id) }).catch(() => {});
      }
      if (type === "task" && prev?.sessionId) {
        updateDoc(doc(REFS.session, prev.sessionId), { taskIds: arrayRemove(id) }).catch(() => {});
      }

      getSetter(type)((prevList) => (prevList || []).filter((e) => e.id !== id));
      setSaveStatus("idle");
    } catch (err) {
      console.error(`Failed to delete ${type}`, err);
      setSaveStatus("error");
    }
  }, [getList, getSetter]);

  // Captures aren't event-logged (they're pre-placement drafts, not
  // entities the rollup report tracks) -- just a plain document per capture.
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

  // Ideas are plain scratch notes tied to a Goal -- same "no event log,
  // just a document" treatment as captures, since they sit outside the
  // Goal→Plan→Session→Task graph until converted into a real entity.
  const saveIdea = useCallback(async (idea) => {
    setSaveStatus("saving");
    try {
      const { id, ...rest } = idea;
      const now = Date.now();
      let docId = id;
      if (id) {
        await setDoc(doc(IDEAS_REF, id), { ...rest, createdAt: rest.createdAt || now });
      } else {
        const ref = await addDoc(IDEAS_REF, { ...rest, createdAt: now });
        docId = ref.id;
      }
      setIdeas((prevList) => {
        const next = (prevList || []).filter((i) => i.id !== docId);
        next.push({ id: docId, ...rest, createdAt: rest.createdAt || now });
        return next;
      });
      setSaveStatus("idle");
      return docId;
    } catch (err) {
      console.error("Failed to save idea", err);
      setSaveStatus("error");
      throw err;
    }
  }, []);

  const deleteIdea = useCallback(async (id) => {
    setSaveStatus("saving");
    try {
      await deleteDoc(doc(IDEAS_REF, id));
      setIdeas((prevList) => (prevList || []).filter((i) => i.id !== id));
      setSaveStatus("idle");
    } catch (err) {
      console.error("Failed to delete idea", err);
      setSaveStatus("error");
    }
  }, []);

  // Settings' routing-table / domain-definitions editors -- full-array
  // replacement, not a partial merge, so an entry can be reordered or
  // removed as easily as edited.
  const saveConfig = useCallback(async (id, entries) => {
    setSaveStatus("saving");
    try {
      await setDoc(doc(CONFIG_REF, id), { entries });
      if (id === "routingTable") setRoutingTable(entries);
      if (id === "domains") setDomains(entries);
      setSaveStatus("idle");
    } catch (err) {
      console.error(`Failed to save config/${id}`, err);
      setSaveStatus("error");
      throw err;
    }
  }, []);

  return {
    goals, projects, plans, sessions, tasks, events, captures, ideas, routingTable, domains,
    status, saveStatus, refresh, saveEntity, deleteEntity, saveCapture, deleteCapture, saveIdea, deleteIdea, saveConfig,
  };
}
