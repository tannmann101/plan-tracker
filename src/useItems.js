import { useState, useCallback, useEffect } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from "firebase/firestore";
import { db } from "./firebase";

const ITEMS_REF = collection(db, "items");
const EVENTS_REF = collection(db, "itemEvents");

// Append-only log of status transitions, written alongside every item
// save/delete so trends (completion rate, cycle time, etc.) can be
// reconstructed later without snapshotting the whole collection on a
// schedule. Best-effort: a logging failure never blocks or fails the item
// write itself, since the log is an analytics side-channel, not the source
// of truth for the item's current state.
async function logEvent(event) {
  try {
    await addDoc(EVENTS_REF, event);
  } catch (err) {
    console.error("Failed to log item event", err);
  }
}

// Refresh-on-open sync, not live push: both users read the same shared
// collection, but a fetch only happens on mount and when refresh() is
// called explicitly (e.g. pull-to-refresh or an "Refresh" button) --
// this app never needs sub-second cross-device visibility.
export function useItems(enabled) {
  const [items, setItems] = useState(null);
  const [events, setEvents] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | forbidden | error
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | error

  const refresh = useCallback(async () => {
    setStatus((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const [itemsSnap, eventsSnap] = await Promise.all([getDocs(ITEMS_REF), getDocs(EVENTS_REF)]);
      setItems(itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setEvents(eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load items", err);
      setStatus(err.code === "permission-denied" ? "forbidden" : "error");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  // Creates a new item or overwrites an existing one in full (each item is
  // its own document, so there's no partial-field conflict risk worth
  // guarding against the way the ledger's single shared doc needs).
  const saveItem = useCallback(async (item) => {
    setSaveStatus("saving");
    try {
      const { id, ...rest } = item;
      const docId = id || doc(ITEMS_REF).id;
      const prev = id ? (items || []).find((it) => it.id === id) : null;
      const payload = { ...rest, updatedAt: Date.now() };
      await setDoc(doc(ITEMS_REF, docId), payload);

      if (!prev || prev.status !== payload.status) {
        await logEvent({
          itemId: docId,
          domain: payload.domain,
          ...(payload.kind ? { kind: payload.kind } : {}),
          ...(payload.effort ? { effort: payload.effort } : {}),
          from: prev ? prev.status : null,
          to: payload.status,
          at: payload.updatedAt,
        });
      }

      setItems((prevItems) => {
        const next = (prevItems || []).filter((it) => it.id !== docId);
        next.push({ id: docId, ...payload });
        return next;
      });
      setSaveStatus("idle");
      return docId;
    } catch (err) {
      console.error("Failed to save item", err);
      setSaveStatus("error");
      throw err;
    }
  }, [items]);

  const deleteItem = useCallback(async (id) => {
    setSaveStatus("saving");
    try {
      const prev = (items || []).find((it) => it.id === id);
      await deleteDoc(doc(ITEMS_REF, id));

      if (prev) {
        await logEvent({
          itemId: id,
          domain: prev.domain,
          ...(prev.kind ? { kind: prev.kind } : {}),
          ...(prev.effort ? { effort: prev.effort } : {}),
          from: prev.status,
          to: "deleted",
          at: Date.now(),
        });
      }

      setItems((prevItems) => (prevItems || []).filter((it) => it.id !== id));
      setSaveStatus("idle");
    } catch (err) {
      console.error("Failed to delete item", err);
      setSaveStatus("error");
    }
  }, [items]);

  return { items, events, status, saveStatus, refresh, saveItem, deleteItem };
}
