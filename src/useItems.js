import { useState, useCallback, useEffect } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";

const ITEMS_REF = collection(db, "items");

// Refresh-on-open sync, not live push: both users read the same shared
// collection, but a fetch only happens on mount and when refresh() is
// called explicitly (e.g. pull-to-refresh or an "Refresh" button) --
// this app never needs sub-second cross-device visibility.
export function useItems(enabled) {
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | forbidden | error
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | error

  const refresh = useCallback(async () => {
    setStatus((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const snap = await getDocs(ITEMS_REF);
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
      const payload = { ...rest, updatedAt: Date.now() };
      await setDoc(doc(ITEMS_REF, docId), payload);
      setItems((prev) => {
        const next = (prev || []).filter((it) => it.id !== docId);
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
  }, []);

  const deleteItem = useCallback(async (id) => {
    setSaveStatus("saving");
    try {
      await deleteDoc(doc(ITEMS_REF, id));
      setItems((prev) => (prev || []).filter((it) => it.id !== id));
      setSaveStatus("idle");
    } catch (err) {
      console.error("Failed to delete item", err);
      setSaveStatus("error");
    }
  }, []);

  return { items, status, saveStatus, refresh, saveItem, deleteItem };
}
