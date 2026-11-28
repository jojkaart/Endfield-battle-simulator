// Combo windows (2026-11-28, 3f78 19.30 s): every replayed combo cast (or another kind: `battle`, `combo,battle`) made
// before the replay's own cooldown had it ready, over the development logs: the operator, P, its team slot, the gap to
// its last cast of the skill and how early; and Si's ultimates between (her Proxy's Patronage cuts squad slot 0's combo
// cooldown). Run: node scripts/with-lock.ts --name combo-cooldowns node scripts/probes/placement/combo-cooldowns.ts [kinds]
// (about 4 min). 2026-11-28: 22 combos, 10 of them a second cast 0.3–7 s after the first (a double placement), 12
// early by 0.07–2.4 s across 11 operators (3f78's Arcane 0.83 s among them).
import { loadGameData } from "@efsim/data";
import { devFixtures, logBuffReplay } from "@efsim/logs";
import { secondsOf } from "@efsim/engine";

const data = loadGameData();
const kinds = new Set((process.argv[2] ?? "combo").split(","));
for (const { short, fx } of devFixtures({})) {
  const { replay } = logBuffReplay(data, fx);
  const made = replay.made.filter((m) => m.skillId !== null && !m.cast.missed);
  for (let i = 0; i < made.length; i++) {
    const b = made[i]!;
    if (!kinds.has(String(b.cast.kind))) continue;
    const a = made.slice(0, i).findLast((x) => x.cast.operator === b.cast.operator && x.skillId === b.skillId);
    if (!a) continue;
    const ready = replay.stateAt(b.frame - 1)?.readyAt[b.skillId];
    if (ready === undefined || Math.ceil(ready) <= b.frame + 1) continue;
    const slot = fx.team.findIndex((x) => x.operator === b.cast.operator);
    const p = fx.team[slot]?.potential;
    const siUlts = made.filter((x) => x.frame > a.frame && x.frame < b.frame && /jsspsi_ultimate/.test(x.skillId)).map((x) => secondsOf(x.frame).toFixed(2));
    process.stdout.write(`${short} ${b.cast.operator} P${p} slot ${slot} ${b.skillId.replace(/^chr_\d+_[a-z]+_/, "")}: ${secondsOf(a.frame).toFixed(2)} → ${secondsOf(b.frame).toFixed(2)} (gap ${secondsOf(b.frame - a.frame).toFixed(2)} s), ready ${secondsOf(Math.ceil(ready) - b.frame).toFixed(2)} s later${siUlts.length ? `; Si's ultimate at ${siUlts.join(", ")} (slot 0: ${fx.team[0]?.operator})` : ""}\n`);
  }
}
process.stdout.write("EFSIM-DONE combo-cooldowns pass\n");
