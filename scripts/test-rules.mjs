import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, deleteDoc, getDocs, collection } from "firebase/firestore";

const testEnv = await initializeTestEnvironment({
  projectId: "demo-plan-tracker",
  firestore: {
    rules: readFileSync("firestore.rules", "utf8"),
    host: "127.0.0.1",
    port: 8080,
  },
});

await testEnv.clearFirestore();

const tannerCtx = testEnv.authenticatedContext("uid-tanner", { email: "tannerwesgardner@gmail.com" });
const rochelleCtx = testEnv.authenticatedContext("uid-rochelle", { email: "rochelleygardner@gmail.com" });
const strangerCtx = testEnv.authenticatedContext("uid-stranger", { email: "stranger@example.com" });
const anonCtx = testEnv.unauthenticatedContext();

const tannerDb = tannerCtx.firestore();
const rochelleDb = rochelleCtx.firestore();
const strangerDb = strangerCtx.firestore();
const anonDb = anonCtx.firestore();

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}`);
  if (!ok) failures++;
};

// Mirrors isValidItem() in firestore.rules -- the shape useItems.js writes.
const validItem = (overrides = {}) => ({
  title: "Get a will drafted",
  domain: "financial",
  status: "open",
  sourceNote: "",
  createdDate: "2026-07-19",
  updatedAt: Date.now(),
  ...overrides,
});

// 1. Allowed account can write an item
try {
  await assertSucceeds(setDoc(doc(tannerDb, "items/item1"), validItem()));
  check("allowed account can write an item", true);
} catch (e) {
  check("allowed account can write an item", false);
  console.error(e.message);
}

// 2. Allowed account can read it back
try {
  const snap = await assertSucceeds(getDoc(doc(tannerDb, "items/item1")));
  check("allowed account can read", snap.data()?.title === "Get a will drafted");
} catch (e) {
  check("allowed account can read", false);
  console.error(e.message);
}

// 2b. The second allowed account (Rochelle) can also read and write
try {
  await assertSucceeds(setDoc(doc(rochelleDb, "items/item2"), validItem({ title: "Plan anniversary trip", domain: "relational" })));
  const snap = await assertSucceeds(getDoc(doc(rochelleDb, "items/item2")));
  check("second allowed account (Rochelle) can read/write", snap.data()?.domain === "relational");
} catch (e) {
  check("second allowed account (Rochelle) can read/write", false);
  console.error(e.message);
}

// 2c. Either account can list the whole shared collection (refresh-on-open read)
try {
  const snap = await assertSucceeds(getDocs(collection(tannerDb, "items")));
  check("allowed account can list all items", snap.size === 2);
} catch (e) {
  check("allowed account can list all items", false);
  console.error(e.message);
}

// 3. A signed-in but non-allow-listed email is rejected
try {
  await assertFails(getDoc(doc(strangerDb, "items/item1")));
  check("non-allow-listed account is rejected (read)", true);
} catch (e) {
  check("non-allow-listed account is rejected (read)", false);
}
try {
  await assertFails(setDoc(doc(strangerDb, "items/item3"), validItem()));
  check("non-allow-listed account is rejected (write)", true);
} catch (e) {
  check("non-allow-listed account is rejected (write)", false);
}

// 4. Fully unauthenticated access is rejected
try {
  await assertFails(getDoc(doc(anonDb, "items/item1")));
  check("unauthenticated access is rejected", true);
} catch (e) {
  check("unauthenticated access is rejected", false);
}

// 5. Schema validation: a write missing a required field is rejected
try {
  const { domain: _domain, ...missingDomain } = validItem();
  await assertFails(setDoc(doc(tannerDb, "items/item4"), missingDomain));
  check("write missing a required field is rejected", true);
} catch (e) {
  check("write missing a required field is rejected", false);
}

// 6. Schema validation: an out-of-vocabulary domain/status is rejected
try {
  await assertFails(setDoc(doc(tannerDb, "items/item5"), validItem({ domain: "not-a-real-domain" })));
  check("write with an invalid domain is rejected", true);
} catch (e) {
  check("write with an invalid domain is rejected", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "items/item6"), validItem({ status: "not-a-real-status" })));
  check("write with an invalid status is rejected", true);
} catch (e) {
  check("write with an invalid status is rejected", false);
}

// 7. Schema validation: a wrong-typed field is rejected
try {
  await assertFails(setDoc(doc(tannerDb, "items/item7"), validItem({ title: 12345 })));
  check("write with a wrong-typed title is rejected", true);
} catch (e) {
  check("write with a wrong-typed title is rejected", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "items/item8"), validItem({ updatedAt: "not-a-number" })));
  check("write with a wrong-typed updatedAt is rejected", true);
} catch (e) {
  check("write with a wrong-typed updatedAt is rejected", false);
}

// 8. targetDate is optional, but must be a string when present
try {
  await assertSucceeds(setDoc(doc(tannerDb, "items/item9"), validItem()));
  check("write with targetDate omitted is allowed", true);
} catch (e) {
  check("write with targetDate omitted is allowed", false);
  console.error(e.message);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "items/item10"), validItem({ targetDate: "2027-01-01" })));
  check("write with a valid targetDate is allowed", true);
} catch (e) {
  check("write with a valid targetDate is allowed", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "items/item11"), validItem({ targetDate: 20270101 })));
  check("write with a wrong-typed targetDate is rejected", true);
} catch (e) {
  check("write with a wrong-typed targetDate is rejected", false);
}

// 8b. kind/effort are optional, like targetDate, but must be in-vocabulary when present
try {
  await assertSucceeds(setDoc(doc(tannerDb, "items/item12"), validItem({ kind: "question-mark", effort: "large" })));
  check("write with valid kind/effort is allowed", true);
} catch (e) {
  check("write with valid kind/effort is allowed", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "items/item13"), validItem({ kind: "not-a-real-kind" })));
  check("write with an invalid kind is rejected", true);
} catch (e) {
  check("write with an invalid kind is rejected", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "items/item14"), validItem({ effort: "not-a-real-effort" })));
  check("write with an invalid effort is rejected", true);
} catch (e) {
  check("write with an invalid effort is rejected", false);
}

// 8c. owner is optional, like kind/effort, but must be in-vocabulary when present
try {
  await assertSucceeds(setDoc(doc(tannerDb, "items/item15"), validItem({ owner: "rochelle" })));
  check("write with a valid owner is allowed", true);
} catch (e) {
  check("write with a valid owner is allowed", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "items/item16"), validItem({ owner: "not-a-real-owner" })));
  check("write with an invalid owner is rejected", true);
} catch (e) {
  check("write with an invalid owner is rejected", false);
}

// 8d. newly added domain/status vocabulary
try {
  await assertSucceeds(setDoc(doc(tannerDb, "items/item17"), validItem({ domain: "chores" })));
  await assertSucceeds(setDoc(doc(tannerDb, "items/item18"), validItem({ domain: "other" })));
  check("write with new domains (chores, other) is allowed", true);
} catch (e) {
  check("write with new domains (chores, other) is allowed", false);
  console.error(e.message);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "items/item19"), validItem({ status: "scheduled" })));
  await assertSucceeds(setDoc(doc(tannerDb, "items/item20"), validItem({ status: "needs-review" })));
  check("write with new statuses (scheduled, needs-review) is allowed", true);
} catch (e) {
  check("write with new statuses (scheduled, needs-review) is allowed", false);
  console.error(e.message);
}

// 9. An allowed account can delete an item (manual "graduation" out of this app)
try {
  await assertSucceeds(deleteDoc(doc(tannerDb, "items/item1")));
  const snap = await getDoc(doc(rochelleDb, "items/item1"));
  check("allowed account can delete an item", !snap.exists());
} catch (e) {
  check("allowed account can delete an item", false);
  console.error(e.message);
}

// 10. itemEvents: append-only log written alongside item save/delete
const validEvent = (overrides = {}) => ({
  itemId: "item1",
  domain: "financial",
  from: null,
  to: "done",
  at: Date.now(),
  ...overrides,
});

try {
  await assertSucceeds(setDoc(doc(tannerDb, "itemEvents/evt1"), validEvent()));
  check("allowed account can write a valid item event", true);
} catch (e) {
  check("allowed account can write a valid item event", false);
  console.error(e.message);
}
try {
  const snap = await assertSucceeds(getDoc(doc(rochelleDb, "itemEvents/evt1")));
  check("allowed account can read item events", snap.data()?.to === "done");
} catch (e) {
  check("allowed account can read item events", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "itemEvents/evt2"), validEvent({ domain: "not-a-real-domain" })));
  check("item event with an invalid domain is rejected", true);
} catch (e) {
  check("item event with an invalid domain is rejected", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "itemEvents/evt3"), validEvent({ to: "not-a-real-status" })));
  check("item event with an invalid 'to' is rejected", true);
} catch (e) {
  check("item event with an invalid 'to' is rejected", false);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "itemEvents/evt4"), validEvent({ to: "deleted", from: "open" })));
  check("item event with to='deleted' (item removal) is allowed", true);
} catch (e) {
  check("item event with to='deleted' (item removal) is allowed", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "itemEvents/evt1"), validEvent({ to: "open" })));
  check("an existing item event cannot be overwritten (append-only)", true);
} catch (e) {
  check("an existing item event cannot be overwritten (append-only)", false);
}
try {
  await assertFails(deleteDoc(doc(tannerDb, "itemEvents/evt1")));
  check("an item event cannot be deleted", true);
} catch (e) {
  check("an item event cannot be deleted", false);
}
try {
  await assertFails(setDoc(doc(strangerDb, "itemEvents/evt5"), validEvent()));
  check("non-allow-listed account cannot write item events", true);
} catch (e) {
  check("non-allow-listed account cannot write item events", false);
}

await testEnv.cleanup();

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll checks passed.");
}
