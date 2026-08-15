import { useEffect, useRef, useState } from "react";
import { Btn, SectionTitle, Note, Card, Pill, Input, Select, Modal, ProgressBar } from "../ui";
import { SERIF, SANS, MONO, INK, MUTE, INKBLUE, LINE, TIER_COLORS, softTint } from "../theme";
import { InfoIcon, GoalChainLine } from "../components/InfoModal";
import QuickAddModal from "../components/QuickAddModal";
import GoalBreakdownAssist from "../components/GoalBreakdownAssist";
import { childGoals, rootGoals, rollupForGoal, goalSubtreeIds, goalProgress } from "../lib/graph";
import { TIERS, domainLabel, ownerLabel, lifecycleStatusLabel } from "../constants";

function NewGoalForm({ secretary, parentGoal, onDone }) {
  const [title, setTitle] = useState("");
  const [tier, setTier] = useState(parentGoal ? nextTier(parentGoal.tier) : "yearly");
  const [domain, setDomain] = useState(parentGoal?.domain || (secretary.domains[0]?.id ?? ""));
  const [targetDate, setTargetDate] = useState("");

  const save = async () => {
    if (!title.trim()) return;
    await secretary.saveEntity("goal", {
      title: title.trim(), tier, domain, owner: "tanner",
      parentGoalId: parentGoal ? parentGoal.id : null, targetDate: targetDate || null, status: "active",
    });
    setTitle("");
    setTargetDate("");
    onDone?.();
  };

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
      <Input value={title} onChange={setTitle} placeholder={parentGoal ? `New ${nextTier(parentGoal.tier)} goal under this one…` : "New yearly goal…"} onEnter={save} width={220} />
      {!parentGoal && <Select value={tier} onChange={setTier} options={TIERS} width={120} />}
      <Select value={domain} onChange={setDomain} options={secretary.domains} width={150} />
      <Input value={targetDate} onChange={setTargetDate} placeholder="Target date (optional)" width={150} />
      <Btn small primary onClick={save} disabled={!title.trim()}>Add</Btn>
    </div>
  );
}

function nextTier(tier) {
  const order = ["yearly", "quarterly", "monthly", "weekly"];
  const i = order.indexOf(tier);
  return order[Math.min(i + 1, order.length - 1)];
}

function GoalNode({ goal, secretary, isOwner, depth, onOpenReport, focusGoalId }) {
  const isFocused = goal.id === focusGoalId;
  const containsFocus = focusGoalId && goalSubtreeIds(goal.id, secretary.goals).includes(focusGoalId);
  const [expanded, setExpanded] = useState(depth === 0 || containsFocus);
  const [addingChild, setAddingChild] = useState(false);
  const [addingPlan, setAddingPlan] = useState(false);
  const [breakingDown, setBreakingDown] = useState(false);
  const children = childGoals(goal.id, secretary.goals);
  const color = TIER_COLORS[goal.tier] || MUTE;
  const canNest = goal.tier !== "weekly";
  const progress = goalProgress(goal.id, secretary);
  const nodeRef = useRef(null);

  useEffect(() => {
    if (containsFocus) setExpanded(true);
  }, [containsFocus]);

  useEffect(() => {
    if (isFocused) nodeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isFocused]);

  return (
    <div style={{ marginLeft: depth ? 18 : 0, marginTop: 8 }} ref={nodeRef}>
      <Card style={{
        display: "flex", alignItems: "flex-start", gap: 10, opacity: goal.status === "dropped" ? 0.55 : 1,
        borderColor: isFocused ? INKBLUE : undefined, boxShadow: isFocused ? `0 0 0 2px ${INKBLUE}33` : undefined,
      }}>
        {children.length > 0 ? (
          <button type="button" onClick={() => setExpanded((e) => !e)} style={{ border: "none", background: "none", cursor: "pointer", color: MUTE, fontFamily: MONO, fontSize: 13, flex: "none", padding: "2px 4px" }}>
            {expanded ? "▾" : "▸"}
          </button>
        ) : <div style={{ width: 18, flex: "none" }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: SANS, fontSize: 14, color: INK, fontWeight: 600 }}>{goal.title}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            <Pill color={color} tint={softTint(color)}>{goal.tier}</Pill>
            <Pill>{domainLabel(goal.domain, secretary.domains)}</Pill>
            <Pill color={MUTE}>{lifecycleStatusLabel(goal.status)}</Pill>
            <Pill color={MUTE}>{ownerLabel(goal.owner)}</Pill>
            {goal.targetDate && <Pill color={MUTE}>by {goal.targetDate}</Pill>}
          </div>
          <GoalChainLine type="goal" entity={goal} data={secretary} onNavigateGoal={undefined} />
          <ProgressBar percent={progress.percent} color={color} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <Btn small onClick={() => onOpenReport(goal)}>Rollup report</Btn>
            {isOwner && canNest && (
              <Btn small color={MUTE} onClick={() => setAddingChild((a) => !a)}>
                {addingChild ? "Cancel" : `+ ${nextTier(goal.tier)} goal`}
              </Btn>
            )}
            {isOwner && (
              <Btn small color={MUTE} onClick={() => setAddingPlan(true)}>+ Add Plan</Btn>
            )}
            {isOwner && (
              <Btn small color={INKBLUE} onClick={() => setBreakingDown(true)}>Ask Secretary to break this down…</Btn>
            )}
          </div>
          {addingChild && <NewGoalForm secretary={secretary} parentGoal={goal} onDone={() => setAddingChild(false)} />}
        </div>
        <InfoIcon type="goal" entity={goal} data={secretary} />
      </Card>
      {addingPlan && (
        <QuickAddModal
          secretary={secretary}
          types={["plan"]}
          defaultType="plan"
          defaults={{ domain: goal.domain, parentType: "goal", parentId: goal.id }}
          onClose={() => setAddingPlan(false)}
        />
      )}
      {breakingDown && (
        <Modal onClose={() => setBreakingDown(false)} width={520}>
          <h3 style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, margin: "0 0 12px" }}>
            Breaking down "{goal.title}"
          </h3>
          <GoalBreakdownAssist goal={goal} secretary={secretary} onDone={() => setBreakingDown(false)} />
        </Modal>
      )}
      {expanded && children.map((child) => (
        <GoalNode key={child.id} goal={child} secretary={secretary} isOwner={isOwner} depth={depth + 1} onOpenReport={onOpenReport} focusGoalId={focusGoalId} />
      ))}
    </div>
  );
}

function daysUntil(dateStr) {
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function RollupReport({ goal, secretary, onBack }) {
  const { plans, sessions, tasks, events } = rollupForGoal(goal.id, secretary);
  const progress = goalProgress(goal.id, secretary);
  const days = goal.targetDate ? daysUntil(goal.targetDate) : null;
  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Goals</Btn>
      <SectionTitle note={`${goal.tier} · ${domainLabel(goal.domain, secretary.domains)}`}>{goal.title} -- Rollup Report</SectionTitle>
      <Note>
        Everything gathered along the way under this Goal (and its nested Goals), built from the event log -- this grows as weeks pass, it isn't a snapshot.
        {goal.targetDate && days !== null && (
          days >= 0 ? ` Target date ${goal.targetDate} -- ${days} day${days === 1 ? "" : "s"} remaining.` : ` Target date ${goal.targetDate} was ${-days} day${days === -1 ? "" : "s"} ago.`
        )}
      </Note>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10, margin: "16px 0" }}>
        <Card tint="#F9F7F1">
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em" }}>Progress</div>
          <div style={{ fontFamily: SERIF, fontSize: 22, color: INK, fontWeight: 600, marginTop: 4 }}>{progress.percent === null ? "--" : `${progress.percent}%`}</div>
        </Card>
        {[["Plans", plans.length], ["Sessions", sessions.length], ["Tasks", tasks.length], ["Tasks done", tasks.filter((t) => t.done).length]].map(([label, n]) => (
          <Card key={label} tint="#F9F7F1">
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
            <div style={{ fontFamily: SERIF, fontSize: 22, color: INK, fontWeight: 600, marginTop: 4 }}>{n}</div>
          </Card>
        ))}
      </div>

      <SectionTitle note={`${events.length} entries`}>History</SectionTitle>
      {events.length === 0 ? (
        <Note>No history yet -- as Plans, Sessions, and Tasks move under this Goal, their transitions will appear here.</Note>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {events.slice().reverse().map((e) => (
            <div key={e.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${LINE}` }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, flex: "none", width: 130 }}>
                {new Date(e.at).toLocaleDateString()} {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span style={{ fontFamily: SANS, fontSize: 12.5, color: INK }}>
                {e.entityType} {e.from ? `${e.from} → ${e.to}` : `created (${e.to})`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Goals({ secretary, isOwner, onBack, focusGoalId, onFocusHandled }) {
  const [reportGoal, setReportGoal] = useState(null);
  const [addingRoot, setAddingRoot] = useState(false);
  const roots = rootGoals(secretary.goals || []).sort((a, b) => a.title.localeCompare(b.title));

  // One-shot: consume the requested focus (expand + scroll happens in
  // GoalNode via the focusGoalId prop) then let the parent clear it, so
  // navigating away and back doesn't leave a stale highlight.
  useEffect(() => {
    if (focusGoalId) {
      const t = setTimeout(() => onFocusHandled?.(), 1500);
      return () => clearTimeout(t);
    }
  }, [focusGoalId, onFocusHandled]);

  if (reportGoal) {
    return <RollupReport goal={reportGoal} secretary={secretary} onBack={() => setReportGoal(null)} />;
  }

  return (
    <div>
      <Btn small onClick={onBack} color={MUTE}>← Hub</Btn>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <SectionTitle note="yearly → quarterly → monthly → weekly">Goals</SectionTitle>
        {isOwner && <Btn small onClick={() => setAddingRoot((a) => !a)} color={MUTE}>{addingRoot ? "Cancel" : "+ Yearly goal"}</Btn>}
      </div>
      {addingRoot && <NewGoalForm secretary={secretary} onDone={() => setAddingRoot(false)} />}
      {roots.length === 0 ? (
        <Note>No Goals yet. Add a yearly Goal above, or import a weekly-meeting photo to seed the tree.</Note>
      ) : (
        roots.map((g) => (
          <GoalNode key={g.id} goal={g} secretary={secretary} isOwner={isOwner} depth={0} onOpenReport={setReportGoal} focusGoalId={focusGoalId} />
        ))
      )}
    </div>
  );
}
