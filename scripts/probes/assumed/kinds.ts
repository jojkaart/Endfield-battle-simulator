// Low plain, low mismatch round (2026-11-26): the assumptions behind an operator's non-plain matches over the
// development logs (snapshotentry.ts composeCheck, as the snapshots), counted per kind (once per hit), per kind set, per
// event and kind, per label (numbers in labels folded). --verbose <kind set> lists the hits of one set
// (e.g. `crit`, `boundary+logListing`). Writes nothing; ends with an EFSIM-DONE line.
// node scratch/assumed.ts <operator> [--ids a,b] [--verbose kind] [--assume id=r]
import { loadGameData, operatorId } from "@efsim/data";
import { composeCheck, devFixtures } from "@efsim/logs";

const raw = loadGameData();
const args = process.argv.slice(2);
const op = operatorId(raw, args[0] as string);
const ids = args.includes("--ids") ? (args[args.indexOf("--ids") + 1] as string).split(",") : undefined;
const verbose = args.includes("--verbose") ? (args[args.indexOf("--verbose") + 1] as string) : undefined;
const assume: Record<string, string> = {};
for (let i = 0; i < args.length; i++) if (args[i] === "--assume") { const [k, v] = (args[i + 1] as string).split("="); assume[k as string] = v as string; }

const byKind = new Map<string, number>();
const byLabel = new Map<string, number>();
const bySet = new Map<string, number>();
const byEventKind = new Map<string, number>();
let total = 0, plain = 0;
const norm = (s: string) => s.replace(/\(\d+\)/g, "(n)").replace(/\d{3,}/g, "N");
for (const { short, fx } of devFixtures({ withOperators: [op], ...(ids ? { ids } : {}) })) {
  const k = composeCheck(raw, fx, { assume });
  const mine = k.verdicts.filter((v) => v.hit.operator === op);
  let lp = 0, ln = 0;
  for (const v of mine) {
    total++;
    if (v.kind !== "match") continue;
    if (v.class === "plain") { plain++; lp++; continue; }
    ln++;
    const kinds = [...new Set(v.assumptions.map((a) => a.kind))].sort();
    for (const kd of kinds) byKind.set(kd, (byKind.get(kd) ?? 0) + 1);
    bySet.set(kinds.join("+"), (bySet.get(kinds.join("+")) ?? 0) + 1);
    const ev = v.hit.event.replace(/^chr_\d+_[a-z]+_/, "");
    for (const kd of kinds) byEventKind.set(`${ev}  ${kd}`, (byEventKind.get(`${ev}  ${kd}`) ?? 0) + 1);
    for (const a of v.assumptions) byLabel.set(norm(a.label), (byLabel.get(norm(a.label)) ?? 0) + 1);
    if (verbose && kinds.join("+") === verbose) process.stdout.write(`  ${short} t=${v.hit.t} ${ev} ${v.hit.value} crit=${v.hit.crit} pred=${v.predicted} | ${v.assumptions.map((a) => a.label).join(" ; ")}\n`);
  }
  process.stdout.write(`${short}: ${mine.length} hits, ${lp} plain, ${ln} other matches\n`);
}
const show = (title: string, m: Map<string, number>, n = 40) => {
  process.stdout.write(`\n${title}\n`);
  for (const [k, c] of [...m].sort((a, b) => b[1] - a[1]).slice(0, n)) process.stdout.write(`${String(c).padStart(5)}  ${k}\n`);
};
process.stdout.write(`\n${total} hits, ${plain} plain\n`);
show("By kind (a hit counted once per kind)", byKind);
show("By kind set", bySet);
show("By event and kind", byEventKind, 50);
show("By label", byLabel, 50);
process.stdout.write("EFSIM-DONE assumed pass\n");
