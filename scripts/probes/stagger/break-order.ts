// Round "0c14 and the operator curve" (2026-11-26): at each Stagger break's ms (a logged hit leaving the bar at 0 with
// Stagger dealt, no poise_break listed on it), the hits at that ms in the log's order, each read with the Stagger
// multiplier (S), without (-) or neither (?), from the check's "Stagger" counterfactual; then the tally by position
// (before the first breaking hit, the breaking hit, after it). Input: a `zmdlogs hits --all --json` dump.
//   npm run -s efsim -- zmdlogs hits --all --json > scratch/allhits.jsonl
//   node scripts/probes/stagger/break-order.ts scratch/allhits.jsonl
import { readFileSync } from "node:fs";

const rows = readFileSync(process.argv[2] ?? "scratch/allhits.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const byFx = new Map<string, any[]>();
for (const r of rows) byFx.set(r.fixture, [...(byFx.get(r.fixture) ?? []), r]);
const tally = { before: { S: 0, n: 0 }, breaking: { S: 0, n: 0 }, after: { S: 0, n: 0 } };
for (const [file, list] of byFx) {
  const fx = JSON.parse(readFileSync(file, "utf8"));
  const ms = new Set<number>();
  for (const h of fx.hits) if (h.poise && h.poise.bar === 0 && h.poise.dealt > 0 && !h.effects.some((e: any) => /poise_break/.test(e.buff))) ms.add(h.t);
  for (const t of ms) {
    const at = fx.hits.filter((h: any) => h.t === t);
    const firstBreak = at.findIndex((h: any) => h.poise && h.poise.bar === 0 && h.poise.dealt > 0);
    const parts: string[] = [];
    at.forEach((h: any, k: number) => {
      const r = list.find((y) => y.t === t && y.event === h.event && y.value === h.value);
      const cf = (r?.counterfactuals ?? []).find((c: any) => c.what === "Stagger");
      const near = (a: number, b: number) => Math.abs(a / b - 1) < 0.015;
      let v = "?";
      if (r && cf && typeof r.predicted === "number") {
        const withS = Math.max(cf.reading, r.predicted);
        const without = Math.min(cf.reading, r.predicted);
        v = near(r.value, withS) ? "S" : near(r.value, without) ? "-" : "?";
      }
      const pos = k < firstBreak ? "before" : k === firstBreak ? "breaking" : "after";
      if (v !== "?") {
        tally[pos].n++;
        if (v === "S") tally[pos].S++;
      }
      parts.push(`${h.operator.slice(9, 15)}:${h.event.replace(/^(chr_\d+_\w+?_|buff_)/, "").slice(0, 22)}${h.poise ? `[${h.poise.dealt}→${h.poise.bar}]` : ""}=${v}`);
    });
    process.stdout.write(`${file.split("/").pop()?.slice(8, 12)} ${(t / 1000).toFixed(2)}  ${parts.join("  ")}\n`);
  }
}
process.stdout.write(JSON.stringify(tally) + "\n");
