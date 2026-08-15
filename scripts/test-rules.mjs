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

const validGoal = (overrides = {}) => ({
  title: "Clean the house",
  tier: "monthly",
  domain: "ecology-practices",
  owner: "tanner",
  parentGoalId: null,
  status: "active",
  createdAt: now(),
  updatedAt: now(),
  ...overrides,
});

const validProject = (overrides = {}) => ({
  title: "Shine the floors",
  domain: "projects",
  initiator: "me",
  familyScope: "touches-family",
  consentStatus: "pending",
  status: "active",
  createdAt: now(),
  updatedAt: now(),
  ...overrides,
});

const validPlan = (overrides = {}) => ({
  title: "Clean the house -- per room",
  parentType: "goal",
  parentId: "goal1",
  domain: "ecology-practices",
  sessionIds: [],
  status: "active",
  createdAt: now(),
  updatedAt: now(),
  ...overrides,
});

const validSession = (overrides = {}) => ({
  title: "Clean the kitchen",
  planId: "plan1",
  domain: "ecology-practices",
  contentType: "quick-capture",
  toolLocation: "Travel notebook",
  taskIds: [],
  targetDay: "2026-08-17",
  done: false,
  createdAt: now(),
  updatedAt: now(),
  ...overrides,
});

const validTask = (overrides = {}) => ({
  title: "Clean the shower",
  sessionId: "session1",
  done: false,
  date: "2026-08-17",
  createdAt: now(),
  updatedAt: now(),
  ...overrides,
});

const validEvent = (overrides = {}) => ({
  entityType: "task",
  entityId: "task1",
  domain: "ecology-practices",
  from: null,
  to: "done",
  at: now(),
  ...overrides,
});

const validCapture = (overrides = {}) => ({
  status: "pending-triage",
  rawText: "buy air filters",
  createdAt: now(),
  ...overrides,
});

const validConfig = (overrides = {}) => ({
  entries: [{ id: "scheduling", label: "Scheduling / time-blocking", toolLocation: "Google Calendar" }],
  ...overrides,
});

// -- Owner (Tanner) can write every entity type ------------------------

for (const [name, path, payload] of [
  ["goal", "goals/goal1", validGoal()],
  ["project", "projects/project1", validProject()],
  ["plan", "plans/plan1", validPlan()],
  ["session", "sessions/session1", validSession()],
  ["task", "tasks/task1", validTask()],
  ["capture", "captures/capture1", validCapture()],
  ["config doc", "config/routingTable", validConfig()],
]) {
  try {
    await assertSucceeds(setDoc(doc(tannerDb, path), payload));
    check(`owner can write a valid ${name}`, true);
  } catch (e) {
    check(`owner can write a valid ${name}`, false);
    console.error(e.message);
  }
}

// events are append-only -- owner can create, not overwrite (checked later)
try {
  await assertSucceeds(setDoc(doc(tannerDb, "events/evt1"), validEvent()));
  check("owner can write a valid event", true);
} catch (e) {
  check("owner can write a valid event", false);
  console.error(e.message);
}

// -- Rochelle (allow-listed, but not owner) can read everything, write nothing --

for (const [name, path] of [
  ["goal", "goals/goal1"],
  ["project", "projects/project1"],
  ["plan", "plans/plan1"],
  ["session", "sessions/session1"],
  ["task", "tasks/task1"],
  ["event", "events/evt1"],
  ["capture", "captures/capture1"],
  ["config doc", "config/routingTable"],
]) {
  try {
    const snap = await assertSucceeds(getDoc(doc(rochelleDb, path)));
    check(`viewer (Rochelle) can read ${name}`, snap.exists());
  } catch (e) {
    check(`viewer (Rochelle) can read ${name}`, false);
    console.error(e.message);
  }
}

try {
  await assertFails(setDoc(doc(rochelleDb, "goals/goal2"), validGoal({ title: "Rochelle's goal" })));
  check("viewer (Rochelle) cannot create a goal", true);
} catch (e) {
  check("viewer (Rochelle) cannot create a goal", false);
}
try {
  await assertFails(setDoc(doc(rochelleDb, "goals/goal1"), validGoal({ status: "done" })));
  check("viewer (Rochelle) cannot update a goal", true);
} catch (e) {
  check("viewer (Rochelle) cannot update a goal", false);
}
try {
  await assertFails(deleteDoc(doc(rochelleDb, "tasks/task1")));
  check("viewer (Rochelle) cannot delete a task", true);
} catch (e) {
  check("viewer (Rochelle) cannot delete a task", false);
}

// -- Listing (refresh-on-open reads) works for both allow-listed accounts --

try {
  const snap = await assertSucceeds(getDocs(collection(tannerDb, "goals")));
  check("owner can list the goals collection", snap.size === 1);
} catch (e) {
  check("owner can list the goals collection", false);
  console.error(e.message);
}

// -- Non-allow-listed / unauthenticated access is rejected --

try {
  await assertFails(getDoc(doc(strangerDb, "goals/goal1")));
  check("non-allow-listed account is rejected (read)", true);
} catch (e) {
  check("non-allow-listed account is rejected (read)", false);
}
try {
  await assertFails(setDoc(doc(strangerDb, "goals/goal3"), validGoal()));
  check("non-allow-listed account is rejected (write)", true);
} catch (e) {
  check("non-allow-listed account is rejected (write)", false);
}
try {
  await assertFails(getDoc(doc(anonDb, "goals/goal1")));
  check("unauthenticated access is rejected", true);
} catch (e) {
  check("unauthenticated access is rejected", false);
}

// -- Schema validation: required fields / vocab / types ------------------

try {
  const { domain: _domain, ...missingDomain } = validGoal();
  await assertFails(setDoc(doc(tannerDb, "goals/goal4"), missingDomain));
  check("goal missing a required field is rejected", true);
} catch (e) {
  check("goal missing a required field is rejected", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "goals/goal5"), validGoal({ tier: "decade" })));
  check("goal with an out-of-vocabulary tier is rejected", true);
} catch (e) {
  check("goal with an out-of-vocabulary tier is rejected", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "goals/goal6"), validGoal({ domain: "not-a-real-domain" })));
  check("goal with an out-of-vocabulary domain is rejected", true);
} catch (e) {
  check("goal with an out-of-vocabulary domain is rejected", false);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "goals/goal7"), validGoal({ parentGoalId: "goal1", tier: "weekly" })));
  check("goal with a valid parentGoalId is allowed", true);
} catch (e) {
  check("goal with a valid parentGoalId is allowed", false);
  console.error(e.message);
}

try {
  await assertFails(setDoc(doc(tannerDb, "projects/project2"), validProject({ familyScope: "shared-house" })));
  check("project with an out-of-vocabulary familyScope is rejected", true);
} catch (e) {
  check("project with an out-of-vocabulary familyScope is rejected", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "projects/project3"), validProject({ consentStatus: "maybe" })));
  check("project with an out-of-vocabulary consentStatus is rejected", true);
} catch (e) {
  check("project with an out-of-vocabulary consentStatus is rejected", false);
}

try {
  await assertFails(setDoc(doc(tannerDb, "plans/plan2"), validPlan({ parentType: "task" })));
  check("plan with an invalid parentType is rejected", true);
} catch (e) {
  check("plan with an invalid parentType is rejected", false);
}

try {
  await assertFails(setDoc(doc(tannerDb, "sessions/session2"), validSession({ contentType: "telepathy" })));
  check("session with an out-of-vocabulary contentType is rejected", true);
} catch (e) {
  check("session with an out-of-vocabulary contentType is rejected", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "sessions/session3"), validSession({ done: "no" })));
  check("session with a wrong-typed done is rejected", true);
} catch (e) {
  check("session with a wrong-typed done is rejected", false);
}

try {
  await assertFails(setDoc(doc(tannerDb, "tasks/task2"), validTask({ title: "" })));
  check("task with an empty title is rejected", true);
} catch (e) {
  check("task with an empty title is rejected", false);
}

// -- v2 schema relaxations: ungrounded Plans, standalone Tasks, secondaryDomains --

try {
  const { parentType: _pt, parentId: _pid, ...ungroundedPlan } = validPlan({ sessionIds: [] });
  await assertSucceeds(setDoc(doc(tannerDb, "plans/plan-ungrounded"), ungroundedPlan));
  check("plan with no parentType/parentId (ungrounded) is allowed", true);
} catch (e) {
  check("plan with no parentType/parentId (ungrounded) is allowed", false);
  console.error(e.message);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "plans/plan-ungrounded2"), validPlan({ parentType: null, parentId: null })));
  check("plan with explicit null parentType/parentId is allowed", true);
} catch (e) {
  check("plan with explicit null parentType/parentId is allowed", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "plans/plan-bad-parent"), validPlan({ parentType: "goal", parentId: null })));
  check("plan with parentType set but parentId missing is rejected", true);
} catch (e) {
  check("plan with parentType set but parentId missing is rejected", false);
}

try {
  const { sessionId: _sid, ...standaloneTask } = validTask();
  await assertSucceeds(setDoc(doc(tannerDb, "tasks/task-standalone"), standaloneTask));
  check("task with no sessionId (standalone) is allowed", true);
} catch (e) {
  check("task with no sessionId (standalone) is allowed", false);
  console.error(e.message);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "tasks/task-standalone2"), validTask({ sessionId: null, domain: "reading" })));
  check("task with explicit null sessionId and a denormalized domain is allowed", true);
} catch (e) {
  check("task with explicit null sessionId and a denormalized domain is allowed", false);
  console.error(e.message);
}

try {
  await assertSucceeds(setDoc(doc(tannerDb, "goals/goal-secondary"), validGoal({ secondaryDomains: ["career", "planning"] })));
  check("goal with valid secondaryDomains is allowed", true);
} catch (e) {
  check("goal with valid secondaryDomains is allowed", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "goals/goal-bad-secondary"), validGoal({ secondaryDomains: "career" })));
  check("goal with a wrong-typed secondaryDomains is rejected", true);
} catch (e) {
  check("goal with a wrong-typed secondaryDomains is rejected", false);
}

try {
  await assertSucceeds(setDoc(doc(tannerDb, "projects/project-domained"), validProject()));
  check("project with a valid domain is allowed", true);
} catch (e) {
  check("project with a valid domain is allowed", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "projects/project-bad-domain"), validProject({ domain: "not-a-real-domain" })));
  check("project with an out-of-vocabulary domain is rejected", true);
} catch (e) {
  check("project with an out-of-vocabulary domain is rejected", false);
}

for (const id of ["career", "projects", "collab", "cleaning", "repair", "planning", "weekly-meeting", "reading", "writing", "contemplation"]) {
  try {
    await assertSucceeds(setDoc(doc(tannerDb, `goals/goal-domain-${id}`), validGoal({ domain: id })));
    check(`goal with new domain "${id}" is allowed`, true);
  } catch (e) {
    check(`goal with new domain "${id}" is allowed`, false);
    console.error(e.message);
  }
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
  await assertFails(setDoc(doc(rochelleDb, "events/evt3"), validEvent()));
  check("viewer (Rochelle) cannot write an event", true);
} catch (e) {
  check("viewer (Rochelle) cannot write an event", false);
}

// -- Config: owner-editable routing table / domain definitions --

try {
  await assertFails(setDoc(doc(rochelleDb, "config/routingTable"), validConfig()));
  check("viewer (Rochelle) cannot write config", true);
} catch (e) {
  check("viewer (Rochelle) cannot write config", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "config/domains"), { entries: "not-a-list" }));
  check("config with a wrong-typed entries is rejected", true);
} catch (e) {
  check("config with a wrong-typed entries is rejected", false);
}

// -- Owner can delete --

try {
  await assertSucceeds(deleteDoc(doc(tannerDb, "tasks/task1")));
  const snap = await getDoc(doc(rochelleDb, "tasks/task1"));
  check("owner can delete a task", !snap.exists());
} catch (e) {
  check("owner can delete a task", false);
  console.error(e.message);
}

await testEnv.cleanup();

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll checks passed.");
}
