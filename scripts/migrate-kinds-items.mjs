#!/usr/bin/env node
// migrate-kinds-items.mjs
// One-time migration: goals+projects -> kinds, plans resolved away (a
// Plan's own parentType/parentId becomes what its Sessions/Tasks
// re-point to directly), sessions+tasks -> items, ideas -> items. Never
// deletes the old collections itself -- review the new collections and
// migration-report.md, then drop goals/projects/plans/sessions/tasks/ideas
// by hand once you're satisfied.
//
// Usage:
//   npm run migrate:seed       -- seeds representative old-schema fixture
//     data into the local Firestore emulator, then runs the migration
//     against it and prints/writes a report. Use this first to sanity-
//     check the transformation logic end-to-end.
//   npm run migrate:emulator   -- runs the migration against whatever's
//     currently in the local emulator's old collections (e.g. after
//     restoring a real export there).
//   npm run migrate:prod       -- runs against the real plan-tracker-eb0c3
//     project via a service account. Set GOOGLE_APPLICATION_CREDENTIALS
//     to a service-account key with Firestore access first. THIS WRITES
//     TO PRODUCTION -- only run it after reviewing an emulator dry run's
//     migration-report.md.
//
// Add --dry-run to any mode to compute and report without writing
// kinds/items at all (old collections are always left untouched either way).

import admin from "firebase-admin";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const useProd = args.includes("--prod");
const doSeed = args.includes("--seed");
const dryRun = args.includes("--dry-run");

if (!useProd) {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
}

// -- Domain remap: old 15-domain set -> new 7-domain set. See the plan's
// "Judgment calls resolved" section for the reasoning behind each choice
// (e.g. "writing" -> creative rather than education; "collab" folds into
// "projects" rather than staying a separate domain).
const DOMAIN_REMAP = {
  finances: "head-of-household", material: "head-of-household", "tech-admin": "head-of-household",
  cleaning: "head-of-household", repair: "head-of-household", planning: "head-of-household",
  "weekly-meeting": "head-of-household",
  teacher: "education", reading: "education",
  career: "vocation",
  projects: "projects", collab: "projects",
  writing: "creative",
  contemplation: "practices", "ecology-practices": "practices",
};
function remapDomain(oldDomain) {
  return DOMAIN_REMAP[oldDomain] || "head-of-household";
}

// Old content-type id -> tag: domain prefix stripped (fin-review -> review,
// rdg-engagement -> engagement).
function contentTypeToTag(contentType) {
  if (!contentType) return null;
  const idx = contentType.indexOf("-");
  return idx === -1 ? contentType : contentType.slice(idx + 1);
}

function oldKindStatus(status) {
  if (status === "done") return "done";
  if (status === "dropped") return "not-started";
  return "queued";
}

// Pure transformation -- old goals/projects/plans/sessions/tasks/ideas in,
// { kinds, items, report } out. No Firestore calls in here, which is what
// makes the --seed emulator run a real end-to-end check of this logic
// rather than just a schema-shape check.
export function migrate({ goals = [], projects = [], plans = [], sessions = [], tasks = [], ideas = [] }) {
  const kinds = [];
  const items = [];
  const report = { orphanedPlans: [], orphanedSessions: [], orphanedTasks: [] };

  const kindIdByOldGoalId = new Map();
  const kindIdByOldProjectId = new Map();

  for (const g of goals) {
    const kindId = `kind-goal-${g.id}`;
    kindIdByOldGoalId.set(g.id, kindId);
    kinds.push({
      id: kindId, title: g.title, kindType: "goal", domain: remapDomain(g.domain),
      parentKindId: g.parentGoalId || null, // re-pointed below to the new kind id
      status: oldKindStatus(g.status),
      timing: g.targetDate ? { dueDate: g.targetDate } : null,
      tags: [], resources: [], retro: false, createdVia: "weekly-import",
      createdAt: g.createdAt || Date.now(), updatedAt: g.updatedAt || Date.now(),
    });
  }
  // Second pass: every old goal id now has a new kind id, so re-point
  // parentKindId from the old id to the new one.
  for (const k of kinds) {
    if (k.kindType === "goal" && k.parentKindId) k.parentKindId = kindIdByOldGoalId.get(k.parentKindId) || null;
  }

  for (const p of projects) {
    const kindId = `kind-project-${p.id}`;
    kindIdByOldProjectId.set(p.id, kindId);
    kinds.push({
      id: kindId, title: p.title, kindType: "project", domain: remapDomain(p.domain),
      parentKindId: null,
      status: oldKindStatus(p.status),
      timing: null,
      initiator: p.initiator, familyScope: p.familyScope,
      ...(p.consentStatus ? { consentStatus: p.consentStatus } : {}),
      tags: [], resources: [], retro: false, createdVia: "weekly-import",
      createdAt: p.createdAt || Date.now(), updatedAt: p.updatedAt || Date.now(),
    });
  }

  // A Plan's own parent (goal/project) is what its Sessions/Tasks
  // re-point to directly -- the Plan entity itself doesn't survive.
  const kindIdForPlan = new Map();
  for (const pl of plans) {
    let kindId = null;
    if (pl.parentType === "goal") kindId = kindIdByOldGoalId.get(pl.parentId) || null;
    else if (pl.parentType === "project") kindId = kindIdByOldProjectId.get(pl.parentId) || null;
    kindIdForPlan.set(pl.id, kindId);
    if (!kindId) report.orphanedPlans.push({ id: pl.id, title: pl.title, parentType: pl.parentType || null });
  }

  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  for (const s of sessions) {
    const itemId = `item-session-${s.id}`;
    const parentKindId = kindIdForPlan.get(s.planId) || null;
    if (s.planId && !parentKindId) report.orphanedSessions.push({ id: s.id, title: s.title });
    items.push({
      id: itemId, title: s.title, itemType: "session", domain: remapDomain(s.domain),
      parentKindId,
      timing: s.targetDay ? { targetDay: s.targetDay } : null,
      done: !!s.done, completedAt: s.done ? (s.updatedAt || Date.now()) : null,
      tags: [contentTypeToTag(s.contentType)].filter(Boolean),
      resources: s.toolLocation ? [s.toolLocation] : [],
      retro: false, createdVia: "weekly-import",
      createdAt: s.createdAt || Date.now(), updatedAt: s.updatedAt || Date.now(),
    });
  }

  for (const t of tasks) {
    const parentSession = t.sessionId ? sessionById.get(t.sessionId) : null;
    const parentKindId = parentSession ? (kindIdForPlan.get(parentSession.planId) || null) : null;
    if (t.sessionId && !parentKindId) report.orphanedTasks.push({ id: t.id, title: t.title });
    items.push({
      id: `item-task-${t.id}`, title: t.title, itemType: "task", domain: remapDomain(t.domain || "head-of-household"),
      parentKindId,
      timing: t.date ? { targetDay: t.date } : null,
      done: !!t.done, completedAt: t.done ? (t.updatedAt || Date.now()) : null,
      tags: [contentTypeToTag(t.contentType)].filter(Boolean),
      resources: t.toolLocation ? [t.toolLocation] : [],
      retro: false, createdVia: "weekly-import",
      createdAt: t.createdAt || Date.now(), updatedAt: t.updatedAt || Date.now(),
    });
  }

  for (const idea of ideas) {
    items.push({
      id: `item-idea-${idea.id}`, title: idea.title, itemType: "other", domain: "head-of-household",
      parentKindId: kindIdByOldGoalId.get(idea.goalId) || null,
      timing: null, done: false, completedAt: null,
      tags: ["idea"], resources: [], retro: false, createdVia: "weekly-import",
      createdAt: idea.createdAt || Date.now(), updatedAt: Date.now(),
    });
  }

  report.summary = {
    goals: goals.length, projects: projects.length, plansResolved: plans.length,
    sessions: sessions.length, tasks: tasks.length, ideas: ideas.length,
    kindsCreated: kinds.length, itemsCreated: items.length,
    orphanedPlans: report.orphanedPlans.length,
    orphanedSessions: report.orphanedSessions.length,
    orphanedTasks: report.orphanedTasks.length,
  };

  return { kinds, items, report };
}

function reportToMarkdown(report, { seeded, prod, dryRun: isDry }) {
  const lines = [
    "# Kinds/Items migration report",
    "",
    `Run against: ${prod ? "**production** (plan-tracker-eb0c3)" : "emulator"}${seeded ? " (seeded fixture data)" : ""}${isDry ? " -- dry run, nothing written" : ""}`,
    "",
    "## Summary",
    "",
    "| | count |",
    "|---|---|",
    ...Object.entries(report.summary).map(([k, v]) => `| ${k} | ${v} |`),
    "",
  ];
  for (const [title, rows] of [
    ["Orphaned Plans (no resolvable parent Goal/Project)", report.orphanedPlans],
    ["Orphaned Sessions (Plan didn't resolve to a Kind)", report.orphanedSessions],
    ["Orphaned Tasks (Session didn't resolve to a Kind)", report.orphanedTasks],
  ]) {
    lines.push(`## ${title}`, "");
    if (rows.length === 0) {
      lines.push("None.", "");
    } else {
      lines.push("| id | title |", "|---|---|", ...rows.map((r) => `| ${r.id} | ${r.title} |`), "");
    }
  }
  return lines.join("\n");
}

// -- Fixture data for --seed, representative of real old-schema shapes
// (not real household data) -- enough to exercise every code path above:
// a nested goal, a project, a grounded plan, an ungrounded plan (orphan),
// a session under each, a standalone task, and an idea.
const SEED = {
  goals: [
    { id: "g1", title: "Keep the house running well", tier: "yearly", domain: "ecology-practices", status: "active", parentGoalId: null, createdAt: 1, updatedAt: 1 },
    { id: "g2", title: "Clean weekly", tier: "monthly", domain: "cleaning", status: "active", parentGoalId: "g1", createdAt: 2, updatedAt: 2 },
  ],
  projects: [
    { id: "pr1", title: "Repaint the porch", domain: "repair", initiator: "me", familyScope: "touches-family", consentStatus: "granted", status: "active", createdAt: 3, updatedAt: 3 },
  ],
  plans: [
    { id: "pl1", title: "Clean the house -- per room", parentType: "goal", parentId: "g2", domain: "cleaning", status: "active", createdAt: 4, updatedAt: 4 },
    { id: "pl2", title: "Orphaned plan", parentType: null, parentId: null, domain: "reading", status: "active", createdAt: 5, updatedAt: 5 },
  ],
  sessions: [
    { id: "s1", title: "Clean the kitchen", planId: "pl1", domain: "cleaning", contentType: "cln-execution", toolLocation: "Reserved notebook (generic log)", done: false, createdAt: 6, updatedAt: 6 },
    { id: "s2", title: "Orphaned session", planId: "pl2", domain: "reading", contentType: "rdg-engagement", toolLocation: "Reading notebook", done: false, createdAt: 7, updatedAt: 7 },
  ],
  tasks: [
    { id: "t1", title: "Clean the shower", sessionId: "s1", done: true, date: "2026-08-01", createdAt: 8, updatedAt: 8 },
    { id: "t2", title: "Standalone task", sessionId: null, domain: "head-of-household", done: false, createdAt: 9, updatedAt: 9 },
  ],
  ideas: [
    { id: "i1", title: "Maybe a room-by-room checklist", goalId: "g2", createdAt: 10 },
  ],
};

async function seedOldCollections(db) {
  const batch = db.batch();
  for (const [collectionName, docs] of Object.entries(SEED)) {
    for (const d of docs) {
      const { id, ...rest } = d;
      batch.set(db.collection(collectionName).doc(id), rest);
    }
  }
  await batch.commit();
}

async function readOldCollections(db) {
  const collections = ["goals", "projects", "plans", "sessions", "tasks", "ideas"];
  const result = {};
  for (const name of collections) {
    const snap = await db.collection(name).get();
    result[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return result;
}

async function writeNewCollections(db, { kinds, items }) {
  // Firestore batches cap at 500 writes -- chunk defensively even though
  // this app's data volume is nowhere near that.
  const chunks = (arr, size) => arr.reduce((acc, x, i) => {
    if (i % size === 0) acc.push([]);
    acc[acc.length - 1].push(x);
    return acc;
  }, []);
  for (const [collectionName, docs] of [["kinds", kinds], ["items", items]]) {
    for (const chunk of chunks(docs, 400)) {
      const batch = db.batch();
      for (const d of chunk) {
        const { id, ...rest } = d;
        batch.set(db.collection(collectionName).doc(id), rest);
      }
      await batch.commit();
    }
  }
}

async function main() {
  admin.initializeApp({ projectId: useProd ? "plan-tracker-eb0c3" : "demo-plan-tracker" });
  const db = admin.firestore();

  if (doSeed) {
    if (useProd) throw new Error("--seed is only for the emulator -- refusing to seed fixture data into production.");
    console.log("Seeding representative old-schema fixture data into the emulator...");
    await seedOldCollections(db);
  }

  console.log(`Reading old collections from ${useProd ? "production" : "the emulator"}...`);
  const old = await readOldCollections(db);
  const { kinds, items, report } = migrate(old);

  if (!dryRun) {
    console.log(`Writing ${kinds.length} kinds and ${items.length} items...`);
    await writeNewCollections(db, { kinds, items });
  } else {
    console.log("--dry-run: computed the migration but wrote nothing.");
  }

  const md = reportToMarkdown(report, { seeded: doSeed, prod: useProd, dryRun });
  writeFileSync("migration-report.md", md);
  console.log(md);
  console.log("\nWrote migration-report.md. Old collections (goals/projects/plans/sessions/tasks/ideas) were left untouched -- review, then drop them by hand once satisfied.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
