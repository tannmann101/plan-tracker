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

const now = () => Date.now();

const validKind = (overrides = {}) => ({
  title: "Clean the house",
  kindType: "goal",
  domain: "head-of-household",
  status: "queued",
  createdAt: now(),
  updatedAt: now(),
  ...overrides,
});

const validItem = (overrides = {}) => ({
  title: "Clean the shower",
  itemType: "task",
  domain: "head-of-household",
  done: false,
  createdAt: now(),
  updatedAt: now(),
  ...overrides,
});

const validPracticeHabit = (overrides = {}) => ({
  title: "Morning meditation",
  categoryId: "meditative",
  active: true,
  createdAt: now(),
  ...overrides,
});

const validDiscipline = (overrides = {}) => ({
  title: "Quit smoking",
  type: "physical",
  milestones: [{ id: "m1", label: "3 days", days: 3 }],
  focused: true,
  resolved: false,
  startedAt: now(),
  createdAt: now(),
  updatedAt: now(),
  ...overrides,
});

const validEvent = (overrides = {}) => ({
  entityType: "item",
  entityId: "item1",
  domain: "head-of-household",
  from: null,
  to: "done",
  at: now(),
  ...overrides,
});

const validCapture = (overrides = {}) => ({
  status: "triaging",
  rawText: "buy air filters",
  createdAt: now(),
  ...overrides,
});

const validPendingOperation = (overrides = {}) => ({
  opType: "create-item",
  targetId: null,
  patch: { title: "buy air filters", itemType: "errand", domain: "head-of-household" },
  sourceType: "capture",
  status: "pending",
  createdAt: now(),
  ...overrides,
});

const validChatMessage = (overrides = {}) => ({
  role: "user",
  text: "What's still open for this week?",
  at: now(),
  ...overrides,
});

const validConfig = (overrides = {}) => ({
  entries: [{ id: "google-calendar", label: "Google Calendar" }],
  ...overrides,
});

// -- Both household accounts can write every collection now -- there is no
// owner/viewer split left (see firestore.rules' isAllowed()). ------------

for (const [name, path, payload] of [
  ["kind", "kinds/kind1", validKind()],
  ["item", "items/item1", validItem()],
  ["practice habit", "practiceHabits/habit1", validPracticeHabit()],
  ["discipline", "disciplines/discipline1", validDiscipline()],
  ["capture", "captures/capture1", validCapture()],
  ["pending operation", "pendingOperations/op1", validPendingOperation()],
  ["chat message", "secretaryChat/msg1", validChatMessage()],
  ["config doc", "config/domains", validConfig()],
]) {
  try {
    await assertSucceeds(setDoc(doc(tannerDb, path), payload));
    check(`Tanner can write a valid ${name}`, true);
  } catch (e) {
    check(`Tanner can write a valid ${name}`, false);
    console.error(e.message);
  }
}

for (const [name, path, payload] of [
  ["kind", "kinds/kind2", validKind({ title: "Rochelle's goal" })],
  ["item", "items/item2", validItem({ title: "Rochelle's task" })],
]) {
  try {
    await assertSucceeds(setDoc(doc(rochelleDb, path), payload));
    check(`Rochelle can write a valid ${name}`, true);
  } catch (e) {
    check(`Rochelle can write a valid ${name}`, false);
    console.error(e.message);
  }
}

// events are append-only -- either account can create, not overwrite
// (checked later)
try {
  await assertSucceeds(setDoc(doc(tannerDb, "events/evt1"), validEvent()));
  check("Tanner can write a valid event", true);
} catch (e) {
  check("Tanner can write a valid event", false);
  console.error(e.message);
}

// -- Listing (refresh-on-open reads) works for both allow-listed accounts --

try {
  const snap = await assertSucceeds(getDocs(collection(rochelleDb, "kinds")));
  check("Rochelle can list the kinds collection", snap.size >= 1);
} catch (e) {
  check("Rochelle can list the kinds collection", false);
  console.error(e.message);
}

// -- Non-allow-listed / unauthenticated access is rejected --

try {
  await assertFails(getDoc(doc(strangerDb, "kinds/kind1")));
  check("non-allow-listed account is rejected (read)", true);
} catch (e) {
  check("non-allow-listed account is rejected (read)", false);
}
try {
  await assertFails(setDoc(doc(strangerDb, "kinds/kind3"), validKind()));
  check("non-allow-listed account is rejected (write)", true);
} catch (e) {
  check("non-allow-listed account is rejected (write)", false);
}
try {
  await assertFails(getDoc(doc(anonDb, "kinds/kind1")));
  check("unauthenticated access is rejected", true);
} catch (e) {
  check("unauthenticated access is rejected", false);
}

// -- Schema validation: required fields / vocab / types ------------------

try {
  const { domain: _domain, ...missingDomain } = validKind();
  await assertFails(setDoc(doc(tannerDb, "kinds/kind-missing-domain"), missingDomain));
  check("kind missing a required field is rejected", true);
} catch (e) {
  check("kind missing a required field is rejected", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "kinds/kind-bad-type"), validKind({ kindType: "habit" })));
  check("kind with an out-of-vocabulary kindType is rejected", true);
} catch (e) {
  check("kind with an out-of-vocabulary kindType is rejected", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "kinds/kind-bad-domain"), validKind({ domain: "not-a-real-domain" })));
  check("kind with an out-of-vocabulary domain is rejected", true);
} catch (e) {
  check("kind with an out-of-vocabulary domain is rejected", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "kinds/kind-bad-status"), validKind({ status: "someday" })));
  check("kind with an out-of-vocabulary status is rejected", true);
} catch (e) {
  check("kind with an out-of-vocabulary status is rejected", false);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "kinds/kind-nested"), validKind({ title: "Q1 goal", parentKindId: "kind1", kindType: "goal" })));
  check("kind with a valid parentKindId is allowed", true);
} catch (e) {
  check("kind with a valid parentKindId is allowed", false);
  console.error(e.message);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "kinds/kind-timing"), validKind({ timing: { dueDate: "2026-12-31", milestones: [] } })));
  check("kind with a timing map is allowed", true);
} catch (e) {
  check("kind with a timing map is allowed", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "kinds/kind-bad-timing"), validKind({ timing: "someday" })));
  check("kind with a wrong-typed timing is rejected", true);
} catch (e) {
  check("kind with a wrong-typed timing is rejected", false);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "kinds/kind-project"), validKind({
    kindType: "project", domain: "projects", initiator: "me", familyScope: "touches-family", consentStatus: "pending",
  })));
  check("project kind with initiator/familyScope/consentStatus is allowed", true);
} catch (e) {
  check("project kind with initiator/familyScope/consentStatus is allowed", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "kinds/kind-bad-familyscope"), validKind({ kindType: "project", familyScope: "shared-house" })));
  check("kind with an out-of-vocabulary familyScope is rejected", true);
} catch (e) {
  check("kind with an out-of-vocabulary familyScope is rejected", false);
}

try {
  const { itemType: _it, ...missingType } = validItem();
  await assertFails(setDoc(doc(tannerDb, "items/item-missing-type"), missingType));
  check("item missing a required field is rejected", true);
} catch (e) {
  check("item missing a required field is rejected", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "items/item-bad-type"), validItem({ itemType: "chore" })));
  check("item with an out-of-vocabulary itemType is rejected", true);
} catch (e) {
  check("item with an out-of-vocabulary itemType is rejected", false);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "items/item-parented"), validItem({ parentKindId: "kind1" })));
  check("item with a parentKindId is allowed", true);
} catch (e) {
  check("item with a parentKindId is allowed", false);
  console.error(e.message);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "items/item-standalone"), validItem({ parentKindId: null })));
  check("item with no parentKindId (standalone) is allowed", true);
} catch (e) {
  check("item with no parentKindId (standalone) is allowed", false);
  console.error(e.message);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "items/item-tags"), validItem({ tags: ["review", "budget"], resources: ["Google Calendar"], secondaryDomains: ["vocation"] })));
  check("item with tags/resources/secondaryDomains lists is allowed", true);
} catch (e) {
  check("item with tags/resources/secondaryDomains lists is allowed", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "items/item-bad-tags"), validItem({ tags: "review" })));
  check("item with a wrong-typed tags field is rejected", true);
} catch (e) {
  check("item with a wrong-typed tags field is rejected", false);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "items/item-practice"), validItem({
    itemType: "session", domain: "practices", isRecurringPracticeItem: true, practiceHabitId: "habit1",
  })));
  check("item with isRecurringPracticeItem + practiceHabitId is allowed", true);
} catch (e) {
  check("item with isRecurringPracticeItem + practiceHabitId is allowed", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "items/item-empty-title"), validItem({ title: "" })));
  check("item with an empty title is rejected", true);
} catch (e) {
  check("item with an empty title is rejected", false);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "items/item-progress"), validItem({
    itemType: "other", domain: "practices", isRecurringPracticeItem: true, practiceHabitId: "habit1", progressAmount: 2,
  })));
  check("item with a progressAmount is allowed", true);
} catch (e) {
  check("item with a progressAmount is allowed", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "items/item-bad-progress"), validItem({ progressAmount: "two" })));
  check("item with a wrong-typed progressAmount is rejected", true);
} catch (e) {
  check("item with a wrong-typed progressAmount is rejected", false);
}

try {
  const { categoryId: _cid, ...missingCategory } = validPracticeHabit();
  await assertFails(setDoc(doc(tannerDb, "practiceHabits/habit-missing-category"), missingCategory));
  check("practice habit missing a required field is rejected", true);
} catch (e) {
  check("practice habit missing a required field is rejected", false);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "practiceHabits/habit-frequency"), validPracticeHabit({ frequency: { days: ["mon", "wed", "fri"] } })));
  check("practice habit with a frequency map is allowed", true);
} catch (e) {
  check("practice habit with a frequency map is allowed", false);
  console.error(e.message);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "practiceHabits/habit-goal-linked"), validPracticeHabit({
    linkedKindId: "kind1", progressUnit: "chapters", progressTarget: 12,
  })));
  check("practice habit with linkedKindId/progressUnit/progressTarget is allowed", true);
} catch (e) {
  check("practice habit with linkedKindId/progressUnit/progressTarget is allowed", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "practiceHabits/habit-bad-target"), validPracticeHabit({ progressTarget: "twelve" })));
  check("practice habit with a wrong-typed progressTarget is rejected", true);
} catch (e) {
  check("practice habit with a wrong-typed progressTarget is rejected", false);
}

try {
  const { type: _type, ...missingType } = validDiscipline();
  await assertFails(setDoc(doc(tannerDb, "disciplines/discipline-missing-type"), missingType));
  check("discipline missing a required field is rejected", true);
} catch (e) {
  check("discipline missing a required field is rejected", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "disciplines/discipline-empty-type"), validDiscipline({ type: "" })));
  check("discipline with an empty type is rejected", true);
} catch (e) {
  check("discipline with an empty type is rejected", false);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "disciplines/discipline-custom-type"), validDiscipline({ type: "spiritual" })));
  check("discipline with a custom (household-added) type is allowed", true);
} catch (e) {
  check("discipline with a custom (household-added) type is allowed", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "disciplines/discipline-bad-milestones"), validDiscipline({ milestones: "not-a-list" })));
  check("discipline with a wrong-typed milestones field is rejected", true);
} catch (e) {
  check("discipline with a wrong-typed milestones field is rejected", false);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "disciplines/discipline-paused"), validDiscipline({ focused: false, resolved: false })));
  check("discipline that's paused (unfocused) is allowed", true);
} catch (e) {
  check("discipline that's paused (unfocused) is allowed", false);
  console.error(e.message);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "disciplines/discipline-resolved"), validDiscipline({ focused: false, resolved: true })));
  check("discipline marked resolved is allowed", true);
} catch (e) {
  check("discipline marked resolved is allowed", false);
  console.error(e.message);
}

// -- Events: append-only, schema-validated --

try {
  await assertFails(setDoc(doc(tannerDb, "events/evt1"), validEvent({ to: "open" })));
  check("an existing event cannot be overwritten (append-only)", true);
} catch (e) {
  check("an existing event cannot be overwritten (append-only)", false);
}
try {
  await assertFails(deleteDoc(doc(tannerDb, "events/evt1")));
  check("an event cannot be deleted", true);
} catch (e) {
  check("an event cannot be deleted", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "events/evt2"), validEvent({ entityType: "capture" })));
  check("event with an invalid entityType is rejected", true);
} catch (e) {
  check("event with an invalid entityType is rejected", false);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "events/evt3"), validEvent({ entityType: "discipline", entityId: "discipline1", from: "focused", to: "relapsed" })));
  check("event with entityType 'discipline' is allowed", true);
} catch (e) {
  check("event with entityType 'discipline' is allowed", false);
  console.error(e.message);
}

// -- pendingOperations: the shared AI-proposal queue --

try {
  await assertFails(setDoc(doc(tannerDb, "pendingOperations/op-bad-type"), validPendingOperation({ opType: "delete-item" })));
  check("pending operation with an invalid opType is rejected", true);
} catch (e) {
  check("pending operation with an invalid opType is rejected", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "pendingOperations/op-bad-patch"), validPendingOperation({ patch: "not-a-map" })));
  check("pending operation with a wrong-typed patch is rejected", true);
} catch (e) {
  check("pending operation with a wrong-typed patch is rejected", false);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "pendingOperations/op-update"), validPendingOperation({
    opType: "update-item", targetId: "item1", sourceType: "chat", patch: { done: true },
  })));
  check("update-kind/item pending operation with a targetId is allowed", true);
} catch (e) {
  check("update-kind/item pending operation with a targetId is allowed", false);
  console.error(e.message);
}

// -- Captures: narrowed to raw intake only --

try {
  await assertFails(setDoc(doc(tannerDb, "captures/capture-bad-status"), validCapture({ status: "placed" })));
  check("capture with an old (now-invalid) status is rejected", true);
} catch (e) {
  check("capture with an old (now-invalid) status is rejected", false);
}

// -- Config: household-editable domains/resources/practiceCategories --

try {
  await assertFails(setDoc(doc(tannerDb, "config/resources"), { entries: "not-a-list" }));
  check("config with a wrong-typed entries is rejected", true);
} catch (e) {
  check("config with a wrong-typed entries is rejected", false);
}
try {
  await assertSucceeds(setDoc(doc(rochelleDb, "config/resources"), validConfig({ entries: ["Google Calendar", "Travel notebook"] })));
  check("Rochelle can write config", true);
} catch (e) {
  check("Rochelle can write config", false);
  console.error(e.message);
}

// -- Either account can delete --

try {
  await assertSucceeds(deleteDoc(doc(tannerDb, "items/item1")));
  const snap = await getDoc(doc(rochelleDb, "items/item1"));
  check("Tanner can delete an item", !snap.exists());
} catch (e) {
  check("Tanner can delete an item", false);
  console.error(e.message);
}
try {
  await assertSucceeds(deleteDoc(doc(rochelleDb, "kinds/kind1")));
  const snap = await getDoc(doc(tannerDb, "kinds/kind1"));
  check("Rochelle can delete a kind", !snap.exists());
} catch (e) {
  check("Rochelle can delete a kind", false);
  console.error(e.message);
}
try {
  await assertSucceeds(deleteDoc(doc(tannerDb, "disciplines/discipline1")));
  const snap = await getDoc(doc(rochelleDb, "disciplines/discipline1"));
  check("Tanner can delete a discipline", !snap.exists());
} catch (e) {
  check("Tanner can delete a discipline", false);
  console.error(e.message);
}

await testEnv.cleanup();

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll checks passed.");
}
