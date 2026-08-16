import { useState } from "react";
import { Modal, Btn, ProgressBar, Pill } from "../ui";
import { SERIF, SANS, MONO, INK, MUTE, BRICK, softTint } from "../theme";
import { disciplineStreak } from "../lib/graph";

// Quick actions for a discipline pulled into focus (§ Habits to Break) --
// opened by clicking its chip on Today/Week. Full editing (title/domain/
// milestones) stays exclusive to Plans, same split as practice habits:
// this modal only offers the day-to-day actions (log a relapse, step back
// from focus, or call it broken for good).
export default function DisciplineDetailModal({ discipline, secretary, onClose }) {
  const [saving, setSaving] = useState(false);
  const { days, nextMilestone, percent } = disciplineStreak(discipline);
  const milestones = [...(discipline.milestones || [])].sort((a, b) => a.days - b.days);

  const run = async (patch) => {
    setSaving(true);
    try {
      await secretary.saveDiscipline({ ...discipline, ...patch });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} width={380}>
      <h3 style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, margin: "0 0 3px" }}>{discipline.title}</h3>
      <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginBottom: 12 }}>Working to eliminate this</div>

      <div style={{ fontFamily: SANS, fontSize: 28, fontWeight: 600, color: BRICK, lineHeight: 1 }}>
        {days} {days === 1 ? "day" : "days"}
      </div>
      {nextMilestone ? (
        <>
          <ProgressBar percent={percent} color={BRICK} />
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 4 }}>
            {nextMilestone.days - days} day{nextMilestone.days - days === 1 ? "" : "s"} to "{nextMilestone.label}"
          </div>
        </>
      ) : (
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 8 }}>
          {milestones.length ? "Past every milestone set for this." : "No milestones set yet -- add some from Plans."}
        </div>
      )}

      {milestones.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {milestones.map((m) => (
            <Pill key={m.id} color={m.days <= days ? BRICK : MUTE} tint={m.days <= days ? softTint(BRICK) : undefined}>
              {m.days <= days ? "✓ " : ""}{m.label}
            </Pill>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        <Btn primary color={BRICK} disabled={saving} onClick={() => run({ startedAt: Date.now() })}>Slipped today</Btn>
        <Btn color={MUTE} disabled={saving} onClick={() => run({ focused: false })}>Stop focusing</Btn>
        <Btn color={MUTE} disabled={saving} onClick={() => run({ focused: false, resolved: true })}>Mark resolved</Btn>
      </div>
      <div style={{ marginTop: 12 }}>
        <Btn color={MUTE} onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  );
}
