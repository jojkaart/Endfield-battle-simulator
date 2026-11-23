// Probe (scripts/probes/README.md): buff-clock round (2026-11-22): does the damage side with the log's lane end or the replay's expiry; reads scratch/bc/rows.jsonl and scratch/bc/hits.jsonl (`efsim zmdlogs hits --all --json`).
// Promoted from that round's scratch/bc/dmg.ts unchanged but for this header; run it from the repository root.
// Does the damage side with the log's lane end or the replay's expiry? For each lane that runs past the replay's
// expiry (by ≥ 0.4 s), the hits between that list it where the engine has it no longer: with it (the log's reading)
// or without (the engine's)? node scratch/bc/dmg.ts [--list]
import { readFileSync } from "node:fs";

type Row = { log: string; buff: string; kit: string; holder: string; source: string; since: number; lo: number; hi: number | null; refreshed: boolean; replay: { start: number; end: number | null; expired: boolean } | null };
type Hit = { fixture: string; t: number; operator: string; event: string; verdict: string; class?: string; error: number | null; logError: number | null; predicted: number | null; logReading: number | null; value: number; differences: { what: string; kind: string }[] };
const rows: Row[] = readFileSync("scratch/bc/rows.jsonl", "utf8").trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l) as Row);
const hits: Hit[] = readFileSync("scratch/bc/hits.jsonl", "utf8").trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l) as Hit);
const byLog = new Map<string, Hit[]>();
for (const h of hits) {
  const short = /zmdlogs-([0-9a-f]{4})/.exec(h.fixture)?.[1] ?? "";
  byLog.set(short, [...(byLog.get(short) ?? []), h]);
}
const verdicts = new Map<string, number>();
const tally = { log: 0, engine: 0, both: 0, neither: 0 };
const perLane: string[] = [];
const seen = new Set<string>();
for (const r of rows) {
  if (r.refreshed || r.hi === null || !r.replay?.expired || r.replay.end === null) continue;
  const E = r.replay.end;
  const end = r.lo;
  if (end - E < 400) continue;
  const k = `${r.log}|${r.buff}|${r.holder}|${r.since}`;
  if (seen.has(k)) continue;
  seen.add(k);
  const hs = (byLog.get(r.log) ?? []).filter((h) => h.t > E + 150 && h.t <= end && (r.holder === "enemy" || h.operator === r.holder) && (h.differences ?? []).some((d) => d.what.split(" + ").includes(r.kit) && d.kind === "log"));
  const t = { log: 0, engine: 0, both: 0, neither: 0 };
  for (const h of hs) {
    if (h.error === null || h.logError === null) continue;
    const e = Math.abs(h.error) <= 0.005, l = Math.abs(h.logError) <= 0.005;
    const c = e && l ? "both" : l ? "log" : e ? "engine" : "neither";
    if (c === "log") verdicts.set(`${h.verdict}/${h.class}`, (verdicts.get(`${h.verdict}/${h.class}`) ?? 0) + 1);
    t[c]++;
    tally[c]++;
  }
  if (hs.length) perLane.push(`${r.log} ${r.buff.slice(0, 42).padEnd(42)} ${r.holder.slice(4, 14).padEnd(10)} past the replay by ${((end - E) / 1000).toFixed(2)} s: hits fit log ${t.log}, engine ${t.engine}, both ${t.both}, neither ${t.neither}`);
}
process.stdout.write(`hits the log lists a buff on past the replay's expiry (lanes ≥ 0.4 s past): fit the log's reading (buff on) ${tally.log}, the engine's (off) ${tally.engine}, both ${tally.both}, neither ${tally.neither}\n`);
process.stdout.write(`their verdicts: ${[...verdicts].map(([k, v]) => `${k} ${v}`).join(", ")}\n`);
if (process.argv.includes("--list")) for (const l of perLane) process.stdout.write(`${l}\n`);
