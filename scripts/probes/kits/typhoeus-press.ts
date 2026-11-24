// Kit buff leads, 2026-11-24 (docs/open-problems.md "Misprediction statistics", Typhoeus's Hovering ATK): each of
// Typhoeus's logged battle-skill press events (`normal_skill`, her floating start) against the first floating-start arrow
// logged after it (ms; "A" when that arrow lists Hovering ATK), then the delays' quartiles. 2026-11-24: 36 presses,
// 85–334 ms but dbae's at 0.43 s (2050 ms, across a stop), about 105 or 215 ms (a press buffered inside another action's uncuttable frames comes later).
//
//   node scripts/probes/kits/typhoeus-press.ts
//
// Development logs only (devFixtures).

import { loadGameData, operatorId } from "@efsim/data";
import { devFixtures } from "@efsim/logs";

const data = loadGameData();
const op = operatorId(data, "Typhoeus");
const all: number[] = [];
for (const { short, fx } of devFixtures({ withOperators: [op] })) {
  const ev = (fx.casts ?? []).filter((c) => c.operator === op && c.skill === `${op}_normal_skill`);
  const arrows = fx.hits.filter((h) => h.operator === op && h.event === `${op}_normal_skill_attack1_projhit`);
  const out: string[] = [];
  for (const e of ev) {
    const a = arrows.find((h) => h.t >= e.t && h.t <= e.t + 3000);
    if (!a) {
      out.push(`${(e.t / 1000).toFixed(2)}:-`);
      continue;
    }
    const d = a.t - e.t;
    all.push(d);
    const atk = [...a.effects, ...a.boundaryEffects].some((x) => x.buff === "buff_chr_0034_typhoea_potential_atkup");
    out.push(`${(e.t / 1000).toFixed(2)}:+${d}${atk ? "A" : ""}`);
  }
  process.stdout.write(`${short}: ${out.join(" ")}\n`);
}
all.sort((a, b) => a - b);
process.stdout.write(`n ${all.length}, quartiles ${all[Math.floor(all.length / 4)]} ${all[Math.floor(all.length / 2)]} ${all[Math.floor((3 * all.length) / 4)]}, min ${all[0]} max ${all[all.length - 1]}\n`);
