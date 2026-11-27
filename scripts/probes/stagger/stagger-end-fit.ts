// The engine's own Stagger end against the log's bracket (last Staggered hit, next hit), from `zmdlogs stagger`'s text,
// under shifts of the end (a stagger-recovery refit: each shift is that much more or less recovery). 2026-11-27 (the
// break's open points), with break-hold 14f: 38 bracketed runs, at the 2 s recovery 21 late / 17 early, the median
// +0.32 s past the bracket's middle; −0.3 s centres it (18 / 18) and moves the mean |error| 2.74 → 2.72 s: no choice.
//   npm run -s efsim -- zmdlogs stagger > scratch/stagger.txt
//   node scripts/probes/stagger/stagger-end-fit.ts scratch/stagger.txt
import { readFileSync } from "node:fs";

const text = readFileSync(process.argv[2]!, "utf8");
const rows: { log: string; last: number; next: number; end: number }[] = [];
let log = "";
for (const line of text.split("\n")) {
  const m0 = /^(zmdlogs-[0-9a-f]+)/.exec(line);
  if (m0) log = m0[1]!.slice(8, 12);
  const m = /log ([\d.]+)–([\d.]+) \(next hit ([\d.]+)\).*the engine's own (?:ended ([\d.]+)|would have run to ([\d.]+))/.exec(line);
  if (!m) continue;
  rows.push({ log, last: Number(m[2]), next: Number(m[3]), end: Number(m[4] ?? m[5]) });
}
const err = (r: (typeof rows)[number], d: number) => {
  const e = r.end + d;
  return e < r.last ? e - r.last : e > r.next ? e - r.next : 0;
};
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)]!;
process.stdout.write(`${rows.length} bracketed runs\n`);
for (const d of [-1.5, -1, -0.5, -0.3, 0, 0.3, 0.5, 1, 1.5, 2]) {
  const es = rows.map((r) => err(r, d));
  const late = es.filter((e) => e > 0).length, early = es.filter((e) => e < 0).length, inside = es.filter((e) => e === 0).length;
  const mid = rows.map((r) => r.end + d - (r.last + r.next) / 2);
  process.stdout.write(`shift ${d >= 0 ? "+" : ""}${d.toFixed(1)} s: late ${late}, early ${early}, inside ${inside}; median error ${med(es).toFixed(2)} s; median vs the bracket's middle ${med(mid).toFixed(2)} s; mean |error| ${(es.reduce((a, x) => a + Math.abs(x), 0) / es.length).toFixed(2)} s\n`);
}
for (const r of rows) process.stdout.write(`  ${r.log} last ${r.last.toFixed(2)} next ${r.next.toFixed(2)} engine ${r.end.toFixed(2)} err ${err(r, 0).toFixed(2)}\n`);
