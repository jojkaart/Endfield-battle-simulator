// Misprediction statistics, 2026-11-24 (docs/analysis/2026-11-24-misprediction-stats.md): the analysis's top
// candidates as aggregates over a group of logs, the hold-outs' only view. Prints group totals only: never a log's id,
// its operators or a value of one log (hold-outs are measured, never debugged: docs/accuracy-plan.md "Choosing logs").
//
//   node scripts/probes/stats/holdout-aggregates.ts --holdout        (the hold-out logs, in memory only)
//   node scripts/probes/stats/holdout-aggregates.ts --dev [ids…]     (the same numbers for the development logs)
//
// The same rows as build.ts (fixtureRows), the same first explanation as analyze.py (explain), stage-like fights (a
// median |ln(logged ÷ predicted)| over 0.05: shields and phase factors) left out and counted. Writes nothing.

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { devFixtures, readLogSplit } from "@efsim/logs";
import { fixtureRows } from "./build.ts";

type Row = Record<string, any>;
const args = process.argv.slice(2);
const holdout = args.includes("--holdout");
const ids = args.filter((a) => !a.startsWith("--"));
let files: string[];
if (holdout) {
  const dir = join(process.cwd(), "fixtures", "holdout");
  const want = readLogSplit().holdout;
  files = readdirSync(dir).filter((f) => want.has(f.replace(/\.json$/, ""))).map((f) => join(dir, f));
} else files = devFixtures(ids.length ? { ids } : {}).filter((f) => f.dir !== "multi").map((f) => f.file);

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const critDmg = (r: Row) => ((r["mods"] ?? []) as { zone: string; value: number }[]).filter((m) => m.zone === "critDamage").reduce((a, m) => a + m.value, 0);
const fights: Row[][] = [];
for (const f of files) fights.push(fixtureRows(f).hits.map((r) => r as Row));

// The derived columns (load.py).
for (const rows of fights)
  for (const r of rows) {
    const V = r["uncapped"] ?? r["value"];
    const P = r["predicted"];
    r["has"] = typeof P === "number" && P > 0;
    if (!r["has"]) continue;
    const pc = P * (1 + critDmg(r));
    r["Pc"] = r["crit"] === null && Math.abs(V - pc) < Math.abs(V - P) ? pc : P;
    r["V"] = V;
    r["err"] = Math.abs(V - r["Pc"]);
    r["lr"] = Math.log(V / r["Pc"]);
    r["off"] = r["err"] > 1.5;
  }
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[Math.floor(s.length / 2)] as number) : 0;
};
const stageLike = fights.filter((rows) => median(rows.filter((r) => r["has"]).map((r) => Math.abs(r["lr"]))) > 0.05);
const kept = fights.filter((rows) => !stageLike.includes(rows));
const all = kept.flat().filter((r) => r["has"]);
const off = all.filter((r) => r["off"]);
const offErr = off.reduce((a, r) => a + r["err"], 0);

const cfFit = (r: Row, boundary: boolean) =>
  ((r["cf"] ?? []) as { kind: string; reading: number | null; what: string }[]).some((c) => c.reading !== null && c.kind !== "crit" && c.kind.startsWith("boundary") === boundary && Math.abs(r["V"] - c.reading * (r["Pc"] / r["predicted"])) <= Math.max(1.5, 0.001 * r["V"]));
const explain = (r: Row): string => {
  if (cfFit(r, false)) return "one difference the log's way";
  if (r["logReading"] !== null && r["logReading"] !== undefined && Math.abs(r["V"] - r["logReading"]) <= 1.5) return "the listing (several buffs)";
  if (cfFit(r, true)) return "a boundary buff the other way";
  if (r["cls"] === "assumed") return "an alternative reading";
  if (r["cls"] === "fallback") return "listing + alternatives";
  if (r["cls"] === "unquantified") return "Corrosion unquantified";
  return `unexplained (${r["cls"]})`;
};
const by = new Map<string, { n: number; err: number }>();
for (const r of off) {
  const k = explain(r);
  const a = by.get(k) ?? { n: 0, err: 0 };
  a.n++;
  a.err += r["err"];
  by.set(k, a);
}
const out: string[] = [];
out.push(`${holdout ? "Hold-out" : "Development"} logs: ${fights.length} fights, ${stageLike.length} stage-like left out (median |ln ratio| > 0.05); ${all.length} hits with a reading, off rate ${pct(off.length / all.length)}, off |err| ${pct(offErr / all.reduce((a, r) => a + r["V"], 0))} of the logged damage`);
out.push("Off hits by first explanation (share of off |err|, of off hits):");
for (const [k, v] of [...by].sort((a, b) => b[1].err - a[1].err)) out.push(`  ${k}: ${pct(v.err / offErr)}, ${pct(v.n / off.length)}`);
const crit = off.filter((r) => ((r["cf"] ?? []) as { kind: string; reading: number | null }[]).some((c) => c.kind === "crit" && c.reading !== null && Math.abs(r["V"] - c.reading) <= Math.max(1.5, 0.001 * r["V"]))).length;
out.push(`Logged crit flag flipped fits: ${crit} of ${off.length} off hits`);
const rate = (xs: Row[]) => (xs.length ? xs.filter((r) => r["off"]).length / xs.length : 0);
const hb = all.filter((r) => r["boundary"] > 0);
out.push(`Boundary effects: ${pct(hb.length / all.length)} of hits; off rate with ${pct(rate(hb))}, without ${pct(rate(all.filter((r) => !(r["boundary"] > 0))))}`);
out.push(`Time: off rate in the first 10 s ${pct(rate(all.filter((r) => r["t"] < 10000)))}, after ${pct(rate(all.filter((r) => r["t"] >= 10000)))}`);
let up = 0;
let down = 0;
for (const rows of kept) {
  const h = rows.filter((r) => r["has"]);
  const a = rate(h.filter((r) => r["tFrac"] < 0.5));
  const b = rate(h.filter((r) => r["tFrac"] >= 0.5));
  if (b > a) up++;
  else if (b < a) down++;
}
out.push(`Per fight, the second half's off rate higher in ${up}, lower in ${down}`);
for (const [label, f] of [["×1.5", 1.5], ["×1.3", 1.3], ["×1.1", 1.1]] as const) {
  const w = off.filter((r) => Math.abs(r["lr"] - Math.log(f)) <= 0.004);
  out.push(`Band ${label} (±0.4%): ${pct(w.length / off.length)} of off hits, ${pct(w.reduce((a, r) => a + r["err"], 0) / offErr)} of off |err|`);
}
const big = (k: string) => all.filter((r) => r["skillKind"] === k);
out.push(`Off rate by skill kind: ${["basic", "battle", "combo", "ultimate", "status", "trigger"].map((k) => `${k} ${pct(rate(big(k)))}`).join(", ")}`);
process.stdout.write(`${out.join("\n")}\nEFSIM-DONE stats-holdout pass\n`);
