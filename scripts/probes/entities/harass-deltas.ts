// Round "Camille's Vesperwings, Pogranichnik's harasses" (2026-11-27): median |delta| 299 -> 88 ms, one-sided 37 -> 21.
// Run: node scripts/probes/entities/harass-deltas.ts [--kit <variant kit file>] (calls `zmdlogs replay`; ~1 min).
// The replay's harass and Assault landings against the log in every Pogranichnik log: matched deltas, replay-only and
// log-only ones. Extra args go to `zmdlogs replay` (e.g. --kit scratch/pograni-x.json).
import { spawnSync } from "node:child_process";
import { devFixtures } from "@efsim/logs";

const extra = process.argv.slice(2);
const all: number[] = [];
let only = 0;
let noland = 0;
for (const { short } of devFixtures({ withOperators: ["chr_0029_pograni"] })) {
  const r = spawnSync("npm", ["run", "-s", "efsim", "--", "zmdlogs", "replay", short, ...extra], { encoding: "utf8", maxBuffer: 1 << 26 });
  const lines = r.stdout.split("\n").filter((l) => /Pogranichnik (ultimate_skill (harass|decisive_assault)|ultimate_skill_abilityentity_(attack2|finish4))/.test(l));
  const ds: string[] = [];
  for (const l of lines) {
    const m = /^\s*([\d.]+)\s+(LAND|NOLAND)\s.*?(harass|decisive_assault|attack2|finish4)\b.*?(?:at ([\d.]+) \(([+-]\d+) ms\)|(replay only)|: (.*))/.exec(l);
    if (!m) continue;
    const kind = m[3] === "attack2" ? "harass" : m[3] === "finish4" ? "decisive_assault" : m[3];
    if (m[2] === "NOLAND") {
      noland++;
      ds.push(`${m[1]} ${kind} LOG-ONLY`);
    } else if (m[6]) {
      only++;
      ds.push(`${m[1]} ${kind} REPLAY-ONLY`);
    } else {
      all.push(Number(m[5]));
      ds.push(`${m[1]} ${kind} ${m[5]}`);
    }
  }
  process.stdout.write(`${short}: ${ds.join(" | ")}\n`);
}
const abs = all.map(Math.abs).sort((a, b) => a - b);
process.stdout.write(`matched ${all.length}, median |Δ| ${abs[Math.floor(abs.length / 2)]} ms, over 100 ms ${abs.filter((x) => x > 100).length}; replay-only ${only}, log-only ${noland}\n`);
