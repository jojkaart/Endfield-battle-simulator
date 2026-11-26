// Arcane's mismatches (2026-11-26): runs of logged hits whose logged ÷ reading sits at one team-wide factor, per fixture
// (a stage's shield phases: 8915 ×0.5 / ×0.05 / ×0.2, c6d8 ×0.1; the evidence of a fixture's stageFactors). A hit's
// ratio is logged ÷ the nearer of its primary reading and the log's reading; a run continues while its hits sit within
// 2% of its first hit's ratio (up to 6 hits off in a row), and is printed with at least <min> hits (default 12) from two
// operators. Run on hits whose fixtures have no stageFactors yet (once written, their runs are gone: the check).
//
//   npm run -s efsim -- zmdlogs hits --all --json --workers 4 > scratch/hall.jsonl
//   node scripts/probes/stage/stage-factors.ts scratch/hall.jsonl [min]
import { readFileSync } from "node:fs";

interface Row { fixture: string; t: number; operator: string; value: number; predicted?: number | null; logReading?: number | null; verdict: string }
const rows: Row[] = readFileSync(process.argv[2] ?? "scratch/hall.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row);
const by = new Map<string, Row[]>();
for (const r of rows) by.set(r.fixture, [...(by.get(r.fixture) ?? []), r]);
const minRun = Number(process.argv[3] ?? 12);
for (const [fx, hs] of by) {
  hs.sort((a, b) => a.t - b.t);
  const ratio = (h: Row): number | null => {
    const c = [h.predicted, h.logReading].filter((x): x is number => typeof x === "number" && x > 20);
    if (!c.length || h.value < 20) return null;
    return c.map((x) => h.value / x).sort((a, b) => Math.abs(Math.log(a)) - Math.abs(Math.log(b)))[0] ?? null;
  };
  const rs = hs.map((h) => ({ h, r: ratio(h) })).filter((x) => x.r !== null) as { h: Row; r: number }[];
  let i = 0;
  const out: string[] = [];
  while (i < rs.length) {
    const v = rs[i]!.r;
    if (Math.abs(v - 1) < 0.04) { i++; continue; }
    let j = i, on = 0, off = 0, lastOn = i;
    const ops = new Set<string>();
    while (j < rs.length) {
      const x = rs[j]!;
      if (Math.abs(x.r / v - 1) <= 0.02) { on++; lastOn = j; ops.add(x.h.operator); off = 0; }
      else { off++; if (off > 6) break; }
      j++;
    }
    if (on >= minRun && ops.size >= 2) {
      const a = rs[i]!.h.t, b = rs[lastOn]!.h.t;
      const inside = rs.filter((x) => x.h.t >= a && x.h.t <= b);
      const at = inside.filter((x) => Math.abs(x.r / v - 1) <= 0.02);
      const med = at.map((x) => x.r).sort((p, q) => p - q)[Math.floor(at.length / 2)]!;
      out.push(`  ${(a / 1000).toFixed(2)}–${(b / 1000).toFixed(2)} s  ×${med.toFixed(4)}  ${at.length}/${inside.length} hits  ops ${[...ops].map((o) => o.slice(4, 12)).join(",")}`);
      i = lastOn + 1;
    } else i++;
  }
  if (out.length) console.log(fx.replace(/.*\//, "") + "\n" + out.join("\n"));
}
