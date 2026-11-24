// Kit buff leads, 2026-11-24 (docs/open-problems.md "Misprediction statistics", Arcane's Will burst buff): does Solemn
// Phalanx's WILL burst buff (buff_wpn_funnel_0016_will_atk, abilityEvent 127) start at Arcane's logged Arts Burst? Per
// log, each listed run's `since` with the offset of her nearest logged burst hit (buff_common_<e>_<e>_triggered), then
// the offsets' quartiles. 2026-11-24: 90 of 91 runs at +0 ms (e989's run since 20.80 s has no burst of hers near; 4a64's
// none in the log): the kit's start at her burst's landing is the game's, so the buff's errors are her bursts' (when and
// whether the replay lands them), not the weapon's.
//
//   node scripts/probes/kits/arcane-will-burst.ts
//
// Development logs only (devFixtures). Prints one line per log and the quartiles.

import { loadGameData, operatorId } from "@efsim/data";
import { devFixtures } from "@efsim/logs";

const data = loadGameData();
const A = operatorId(data, "Arcane");
const ds: number[] = [];
for (const { short, fx } of devFixtures({ withOperators: [A] })) {
  const bursts = fx.hits.filter((h) => h.operator === A && /^buff_common_(\w+)_\1_triggered$/.test(h.event)).map((h) => h.t);
  const sinces = new Set<number>();
  for (const h of fx.hits) for (const e of [...h.effects, ...h.boundaryEffects]) if (e.buff === "buff_wpn_funnel_0016_will_atk" && e.since !== undefined) sinces.add(e.since);
  const out: string[] = [];
  for (const s of [...sinces].sort((a, b) => a - b)) {
    const near = bursts.reduce((best, b) => (Math.abs(b - s) < Math.abs(best - s) ? b : best), Infinity);
    const d = near - s;
    if (Number.isFinite(d)) ds.push(d);
    out.push(`${(s / 1000).toFixed(2)}${Number.isFinite(d) ? `(burst ${d >= 0 ? "+" : ""}${d})` : "(none)"}`);
  }
  if (out.length) process.stdout.write(`${short}: ${out.join(" ")}\n`);
}
ds.sort((a, b) => a - b);
process.stdout.write(`n ${ds.length}, at +0 ms ${ds.filter((d) => d === 0).length}, quartiles ${ds[Math.floor(ds.length / 4)]} ${ds[Math.floor(ds.length / 2)]} ${ds[Math.floor((3 * ds.length) / 4)]}\n`);
