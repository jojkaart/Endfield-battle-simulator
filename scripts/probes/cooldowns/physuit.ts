// Placement leads (2026-11-24): does a gear set's trigger cooldown run on the world's clock? Run:
// node scripts/probes/cooldowns/physuit.ts (every development log with a Swordmancer wearer), then for each miss
// `efsim zmdlogs worldtime <fixture> <last proc s> <miss s>`.
// Swordmancer (suit_phy01) procs against the wearer's logged physical statuses: per status hit, whether a proc is logged
// at it, the time since the last proc, and whether the replay's Stagger window covers it.
import { spawnSync } from "node:child_process";
import { devFixtures } from "@efsim/logs";

const rows: string[] = [];
const tally = new Map<string, number>();
for (const { short, fx } of devFixtures({})) {
  const wearers = fx.team.filter((b) => (b.gear ?? []).filter((g) => String((g as { id?: string }).id ?? g).includes("suit_phy01")).length >= 3).map((b) => b.operator);
  if (wearers.length === 0) continue;
  const r = spawnSync("npm", ["run", "-s", "efsim", "--", "zmdlogs", "replay", short], { encoding: "utf8", maxBuffer: 1 << 28 });
  const windows = [...r.stdout.matchAll(/STAGGER the replay's window ([\d.]+)–([\d.]+) s/g)].map((m) => [Number(m[1]) * 1000, Number(m[2]) * 1000] as const);
  for (const op of wearers) {
    const mine = fx.hits.filter((h) => h.operator === op).sort((a, b) => a.t - b.t);
    const procs = mine.filter((h) => h.event === "buff_equipsuit_physuit_01").map((h) => h.t);
    const statusTimes = [...new Set(mine.filter((h) => /^buff_physical_(airborne|knockdown|crushed|do_crushed|do_fracture|fracture)/.test(h.event)).map((h) => h.t))];
    for (const t of statusTimes) {
      const proc = procs.some((p) => Math.abs(p - t) <= 50);
      const last = procs.filter((p) => p < t - 50).at(-1);
      const since = last === undefined ? Infinity : (t - last) / 1000;
      const stag = windows.some(([a, b]) => t >= a && t <= b);
      if (since < 15 && !proc) continue;
      const k = `${proc ? "proc" : "none"} ${stag ? "staggered" : "free"}`;
      tally.set(k, (tally.get(k) ?? 0) + 1);
      rows.push(`${short} ${op} ${(t / 1000).toFixed(2)} ${k} since ${since.toFixed(1)}`);
    }
  }
}
process.stdout.write(rows.join("\n") + "\n");
for (const [k, n] of tally) process.stdout.write(`${k}: ${n}\n`);
