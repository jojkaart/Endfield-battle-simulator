// Probe (scripts/probes/README.md): hidden-holds round (2026-11-23): how well the placed holds are determined per log.
// Promoted from that round's scratch/hh/determined.ts unchanged but for this header; run it from the repository root.
// How well the placed holds are determined, per log: the least total hold, each dodge-sized unit of it (0.512 s) with
// its earliest and latest time (PlacedHolds early / late) and the kept clocks spanning it (runs and tick bounds,
// counted apart: a run's two bounds once, a tick series' pairs and chain bounds once per series), the dropped bounds.
// Also each unit against the Stagger and against long hitless spans (pauses, not dodges).
import { loadGameData } from "@efsim/data";
import { devFixtures, logBuffReplay, placeHits } from "@efsim/logs";

const data = loadGameData();
const UNIT = 512;
const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const all = { units: 0, within1: 0, within3: 0, clocks: [] as number[], runsKept: 0, runsDropped: 0, ticksKept: 0, ticksDropped: 0, total: 0, secs: 0, inGap: 0 };
for (const { short, fx } of devFixtures({ dirs: ["verified", "pending"], ...(ids.length ? { ids } : {}) })) {
  const r = logBuffReplay(data, fx, placeHits(data, fx), { assume: { "hidden-holds": "placed" } }).replay;
  const h = r.hiddenHolds;
  if (!h) continue;
  const at = (P: readonly number[], m: number) => {
    const i = P.findIndex((x) => x >= m - 1e-6);
    if (i <= 0) return h.times[0] as number;
    const [t0, t1, p0, p1] = [h.times[i - 1] as number, h.times[i] as number, P[i - 1] as number, P[i] as number];
    return p1 === p0 ? t1 : t0 + ((m - p0) / (p1 - p0)) * (t1 - t0);
  };
  // Hitless spans of 3 s or more (a pause, not a dodge, holds there).
  const ts = [...new Set(fx.hits.map((x) => x.t))].sort((a, b) => a - b);
  const gaps: [number, number][] = [];
  for (let i = 1; i < ts.length; i++) if ((ts[i] as number) - (ts[i - 1] as number) >= 3000) gaps.push([ts[i - 1] as number, ts[i] as number]);
  const units: { early: number; late: number; mid: number; clocks: number; inGap: boolean }[] = [];
  for (let m = UNIT / 2; m < h.total; m += UNIT) {
    const [early, late, mid] = [at(h.early, m), at(h.late, m), at(h.mid, m)];
    const series = new Set(h.kept.filter((c) => c.a <= early && late <= c.b).map((c) => (c.kind === "run" ? c.tag : c.tag.replace(/ [0-9]+[→⇒][0-9]+ ms$/, ""))));
    units.push({ early, late, mid, clocks: series.size, inGap: gaps.some(([a, b]) => a <= mid && mid <= b) });
  }
  const spread = units.map((u) => u.late - u.early).sort((a, b) => a - b);
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)] ?? NaN;
  const runsKept = new Set(h.kept.filter((c) => c.kind === "run").map((c) => c.tag)).size;
  const runsDropped = new Set(h.dropped.filter((c) => c.kind === "run").map((c) => c.tag)).size;
  const tk = h.kept.filter((c) => c.kind === "tick").length, td = h.dropped.filter((c) => c.kind === "tick").length;
  const end = Math.max(...fx.hits.map((x) => x.t));
  all.units += units.length;
  all.within1 += spread.filter((x) => x <= 1000).length;
  all.within3 += spread.filter((x) => x <= 3000).length;
  all.clocks.push(...units.map((u) => u.clocks));
  all.runsKept += runsKept;
  all.runsDropped += runsDropped;
  all.ticksKept += tk;
  all.ticksDropped += td;
  all.total += h.total;
  all.secs += end;
  all.inGap += units.filter((u) => u.inGap).length;
  process.stdout.write(`${short.padEnd(5)} holds ${(h.total / 1000).toFixed(2).padStart(5)} s in ${(end / 1000).toFixed(0).padStart(3)} s (${units.length} units) | placed within: median ${(med(spread) / 1000).toFixed(1)} s, ≤1 s ${spread.filter((x) => x <= 1000).length}, ≤3 s ${spread.filter((x) => x <= 3000).length} | clocks spanning a unit: median ${med(units.map((u) => u.clocks))} | runs ${runsKept}+${runsDropped} dropped, tick bounds ${tk}+${td} dropped${units.some((u) => u.inGap) ? ` | ${units.filter((u) => u.inGap).length} in hitless spans ≥3 s` : ""}\n`);
  if (process.argv.includes("--verbose")) for (const u of units) process.stdout.write(`    ${(u.early / 1000).toFixed(2)}..${(u.late / 1000).toFixed(2)} (mid ${(u.mid / 1000).toFixed(2)}) clocks ${u.clocks}${u.inGap ? " in a hitless span" : ""}\n`);
}
process.stdout.write(`all: ${(all.total / 1000).toFixed(1)} s of holds over ${(all.secs / 1000).toFixed(0)} s (${((all.total / all.secs) * 100).toFixed(1)}%), ${all.units} units: within 1 s ${all.within1}, within 3 s ${all.within3}; clocks spanning a unit median ${[...all.clocks].sort((a, b) => a - b)[Math.floor((all.clocks.length - 1) / 2)]} (0: ${all.clocks.filter((c) => c === 0).length}, 1: ${all.clocks.filter((c) => c === 1).length}, ≥2: ${all.clocks.filter((c) => c >= 2).length}); runs kept ${all.runsKept}, dropped ${all.runsDropped}; tick bounds kept ${all.ticksKept}, dropped ${all.ticksDropped}; units in hitless spans ≥3 s ${all.inGap}\n`);
