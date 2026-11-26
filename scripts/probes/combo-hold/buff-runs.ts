// Probe (scripts/probes/README.md): the enemy-clock round (2026-11-26), docs/open-problems.md "The enemy's clock".
// node scripts/probes/combo-hold/buff-runs.ts (needs scratch/bc/rows.jsonl: node scripts/probes/buff-clock/lanes.ts).
// Buff runs (scratch/bc/rows.jsonl from scripts/probes/buff-clock/lanes.ts): a single run's world-time excess over its
// duration against the time the placed combo / ultimate stops take inside it. Do combos hold the operators' buffs (and
// the debuffs on the enemy) more than the stop list says, as they hold the enemy's tick series (scratch/chainfit.ts)?
import { readFileSync } from "node:fs";
import { loadGameData } from "@efsim/data";
import { castTimeStops, devFixtures, placeHits, worldMs, type TimeStop } from "@efsim/logs";

const data = loadGameData();
type Row = { log: string; buff: string; holder: string; D: number; since: number; lo: number; hi: number | null; exact: string; refreshed: boolean; maxStacks: boolean; sharedTimer: boolean; worldLo: number; worldHi: number | null };
const rows = readFileSync("scratch/bc/rows.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l) as Row);
const stopsOf = new Map<string, TimeStop[]>();
for (const { short, fx } of devFixtures({ dirs: ["verified", "pending"] })) stopsOf.set(short, castTimeStops(data, placeHits(data, fx).casts));
type P = { y: number; combo: number; ult: number; enemy: boolean; row: Row };
const pts: P[] = [];
for (const r of rows) {
  if (r.refreshed || r.maxStacks || r.sharedTimer || !r.exact || r.hi === null) continue;
  const stops = stopsOf.get(r.log);
  if (!stops) continue;
  const end = r.lo;
  const y = worldMs(r.since, end, stops) / 1000 - r.D;
  if (y < -1 || y > 3) continue;
  const held = (k: string) => (end - r.since - worldMs(r.since, end, stops.filter((s) => s.kind === k))) / 1000;
  pts.push({ y, combo: held("combo"), ult: held("ultimate"), enemy: r.holder === "enemy", row: r });
}
function fit(sel: P[], label: string) {
  // y = a·combo + b·ult + c (least squares, 3×3).
  const X = sel.map((p) => [p.combo, p.ult, p.row.D]);
  const A = [0, 1, 2].map((i) => [0, 1, 2].map((j) => X.reduce((s, x) => s + (x[i] as number) * (x[j] as number), 0)));
  const b = [0, 1, 2].map((i) => X.reduce((s, x, k) => s + (x[i] as number) * (sel[k] as P).y, 0));
  const M = A.map((row, i) => [...row, b[i] as number]);
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = ((M[r] as number[])[c] as number) / ((M[c] as number[])[c] as number);
      for (let k = c; k <= 3; k++) (M[r] as number[])[k] = ((M[r] as number[])[k] as number) - f * ((M[c] as number[])[k] as number);
    }
  }
  const beta = M.map((row, i) => (row[3] as number) / (row[i] as number));
  const med = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)] ?? NaN;
  const none = sel.filter((p) => p.combo === 0 && p.ult === 0);
  const comboOnly = sel.filter((p) => p.combo > 0 && p.ult === 0);
  process.stdout.write(`${label}: n ${sel.length}; excess = ${(beta[0] as number).toFixed(3)}·combo + ${(beta[1] as number).toFixed(3)}·ult + ${(beta[2] as number).toFixed(3)}·D; no stop: n ${none.length} median ${med(none.map((p) => p.y)).toFixed(2)}; combos only: n ${comboOnly.length} median excess ${med(comboOnly.map((p) => p.y)).toFixed(2)} s over median combo-held ${med(comboOnly.map((p) => p.combo)).toFixed(2)} s\n`);
}
fit(pts, "every exact single run");
fit(pts.filter((p) => !p.enemy), "operators' buffs");
fit(pts.filter((p) => p.enemy), "debuffs on the enemy");
