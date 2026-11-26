// Bursts and cooldowns round (2026-11-26): Snowshine in 04d4 with her nodes 1 and 3 only (favorability 150–300):
// the single and paired build changes on top whose ATK is ×0.9624 of the fixture's build (±0.001), the offset her hits
// show. Run: node scripts/probes/stats/snowshine-builds.ts
import { loadGameData } from "@efsim/data";
import { computeStats, type Build } from "@efsim/engine";
import { readFileSync } from "node:fs";

const data = loadGameData();
const fx = JSON.parse(readFileSync("fixtures/pending/zmdlogs-04d401ad257e.json", "utf8"));
const base: Build = fx.team.find((b: { operator: string }) => b.operator === "chr_0014_aurora");
const atk = (b: Build) => (computeStats(data, b).atk as unknown as { total: number }).total;
const a0 = atk(base);
const two: Build = { ...base, attributeNodes: 2 };
process.stdout.write(`two nodes: ×${(atk(two) / a0).toFixed(4)}\n`);
const equips = Object.keys((data as unknown as { gear: Record<string, unknown> }).gear ?? {}).filter((k) => k.includes("suit_heal01"));
type Change = { what: string; apply: (b: Build) => Build };
const changes: Change[] = [];
for (const pot of [0, 1, 2, 3, 4]) changes.push({ what: `P${pot}`, apply: (b) => ({ ...b, potential: pot }) });
for (let i = 0; i < 3; i++) for (let l = 1; l <= 9; l++) changes.push({ what: `wskill${i + 1}=${l}`, apply: (b) => ({ ...b, weapon: { ...(b.weapon as NonNullable<Build["weapon"]>), skillLevels: (b.weapon as NonNullable<Build["weapon"]>).skillLevels.map((x, j) => (j === i ? l : x)) } }) });
for (const lv of [70, 72, 74, 75, 76, 78, 79, 81, 85, 90]) changes.push({ what: `level ${lv}`, apply: (b) => ({ ...b, level: lv }) });
for (const wl of [70, 75, 80, 84, 85, 88, 89]) changes.push({ what: `weapon level ${wl}`, apply: (b) => ({ ...b, weapon: { ...(b.weapon as NonNullable<Build["weapon"]>), level: wl } }) });
for (let g = 0; g < base.gear.length; g++) {
  for (const e of equips) changes.push({ what: `gear${g}=${e.replace("item_equip_t4_suit_heal01_", "")}`, apply: (b) => ({ ...b, gear: b.gear.map((x, j) => (j === g ? { ...x, id: e } : x)) }) });
  changes.push({ what: `no gear${g}`, apply: (b) => ({ ...b, gear: b.gear.filter((_, j) => j !== g) }) });
}
const hits: [number, string][] = [];
const tryOne = (b: Build, what: string) => {
  try {
    const r = atk(b) / a0;
    if (Math.abs(r - 0.9624) <= 0.001) hits.push([r, what]);
  } catch {
    /* an invalid build */
  }
};
for (const c of changes) tryOne(c.apply(two), c.what);
for (let i = 0; i < changes.length; i++) for (let j = i + 1; j < changes.length; j++) tryOne((changes[j] as Change).apply((changes[i] as Change).apply(two)), `${(changes[i] as Change).what} + ${(changes[j] as Change).what}`);
for (const [r, w] of hits.sort((a, b) => Math.abs(a[0] - 0.9624) - Math.abs(b[0] - 0.9624)).slice(0, 40)) process.stdout.write(`${r.toFixed(4)} ${w}\n`);
process.stdout.write(`${hits.length} within 0.001 of ${changes.length} changes and their pairs\n`);
