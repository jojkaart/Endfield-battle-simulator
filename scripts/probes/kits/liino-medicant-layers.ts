// The Liino round, 2026-11-27 (docs/open-problems.md "Liino's weapon: more than 4 layers listed on one teammate",
// in-game test 25): teammates' hits by the number of Medicant entries (buff_wpn_lance_0014_damageup) the log lists, all
// of them and those whose `since` is within 20 s, against the check's primary reading (which reads min(entries, 4)):
// the share within 0.3% and the layers the value implies (the reading's own layers plus (logged ÷ reading − 1) × ATK
// zone ÷ (base ATK × a layer's value), flat ATK ignored). 2026-11-27: every count reads as min(entries, 4) (entries
// 5–13: 3,097 of 3,434 hits imply exactly 4).
//
//   npm run -s efsim -- zmdlogs hits 0eef bdf2 dbae 1cd1 1d91 4360 4bfc 4d60 7910 8915 9090 92b4 9847 9c6e a7a7 af7b \
//     c6d8 d774 d9e5 --json > scratch/liino-hits.jsonl
//   node scripts/probes/kits/liino-medicant-layers.ts [scratch/liino-hits.jsonl]
//
// Development logs only (the hits command never reads a hold-out).

import { readFileSync } from "node:fs";

const G = "buff_wpn_lance_0014_damageup";
const path = process.argv[2] ?? "scratch/liino-hits.jsonl";
const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
type Fx = { hits: { t: number; operator: string; event: string; value: number; effects: { buff: string; since: number; value: number }[] }[] };
const fixtures = new Map<string, Fx>();
type Row = { all: number; live: number; read: number; ratio: number; implied: number | null };
const rows: Row[] = [];
for (const l of lines) {
  if (l.operator === "chr_0035_liino" || l.kind !== "skill" || !l.predicted || l.crit === null || !l.landing?.zones) continue;
  let fx = fixtures.get(l.fixture);
  if (!fx) fixtures.set(l.fixture, (fx = JSON.parse(readFileSync(l.fixture, "utf8")) as Fx));
  const h = fx.hits.find((x) => x.t === l.t && x.operator === l.operator && x.event === l.event && x.value === l.value);
  if (!h) continue;
  const es = h.effects.filter((e) => e.buff === G);
  if (!es.length) continue;
  const mods = l.landing.modifiers as { source: string; zone: string; value: number }[];
  const read = mods.filter((m) => m.zone === "atk" && /lance_0014/.test(m.source)).length;
  const atk = l.landing.zones.atk as number;
  const atkPct = mods.filter((m) => m.zone === "atk").reduce((s, m) => s + m.value, 0);
  const base = atk / (1 + atkPct);
  const implied = atk && base ? read + ((l.value / l.predicted - 1) * atk) / (base * (es[0] as { value: number }).value) : null;
  rows.push({ all: es.length, live: es.filter((e) => h.t - e.since <= 20000).length, read, ratio: l.value / l.predicted, implied });
}
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] as number;
for (const [name, k] of [["listed entries (all)", (r: Row) => r.all], ["listed entries since ≤ 20 s", (r: Row) => r.live]] as const) {
  console.log(`by ${name}:`);
  const by = new Map<number, Row[]>();
  for (const r of rows) by.set(k(r), [...(by.get(k(r)) ?? []), r]);
  for (const [n, rs] of [...by].sort((a, b) => a[0] - b[0])) {
    const exact = rs.filter((r) => Math.abs(r.ratio - 1) < 0.003).length;
    const hist = new Map<number, number>();
    for (const x of rs.map((r) => r.implied).filter((x): x is number => x !== null && Number.isFinite(x))) hist.set(Math.round(x), (hist.get(Math.round(x)) ?? 0) + 1);
    console.log(`  ${String(n).padStart(2)}: ${String(rs.length).padStart(5)} hits, within 0.3% of the reading ${((exact / rs.length) * 100).toFixed(0)}%, ratio median ${med(rs.map((r) => r.ratio)).toFixed(3)}, reading's layers median ${med(rs.map((r) => r.read))}, implied layers ${[...hist].sort((a, b) => a[0] - b[0]).map(([a, b]) => `${a}:${b}`).join(" ")}`);
  }
}
