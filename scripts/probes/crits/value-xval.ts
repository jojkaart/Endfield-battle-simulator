// Ticks and layers round (2026-11-23): cross-validation of valueCrits (packages/logs/src/buffreplay.ts). Hides half the
// logged crit flags (two folds by the hit's index) on every development log, infers them back from the values with the
// other half kept (every operator treated as one with a crit trigger), and counts the inferred crits the log flags as
// crits, per operator, against the base rate; also how many crit-less hits the real fixtures get. --shuffle: each hit's
// value from another hit of its key (negative control); --show: each wrong one. Writes to stdout only.
// Run: node scripts/probes/crits/value-xval.ts [--shuffle] [--show]
import { loadGameData } from "@efsim/data";
import { effectiveKit, type OperatorKit } from "@efsim/engine";
import { devFixtures, placeHits, valueCrits, type LogFixture, type LogHit } from "@efsim/logs";

const data = loadGameData();
const shuffle = process.argv.includes("--shuffle");
const show = process.argv.includes("--show");
let right = 0, wrong = 0, hiddenN = 0, hiddenTrue = 0, open = 0, openFound = 0;
const perOp = new Map<string, [number, number]>();
for (const d of devFixtures()) {
  const fx = d.fx as LogFixture;
  const kits = fx.team.flatMap((b) => effectiveKit(data, b) ?? []);
  // Every operator counts as one with a crit trigger here.
  const all: OperatorKit[] = kits.map((k) => ({ ...k, triggers: [...k.triggers, { id: "probe", on: { event: "hit", crit: true }, by: "self", do: [] } as never] }));
  let base: LogHit[] = fx.hits;
  if (shuffle) {
    const byKey = new Map<string, number[]>();
    for (const h of fx.hits) byKey.set(`${h.operator}|${h.event}`, [...(byKey.get(`${h.operator}|${h.event}`) ?? []), h.value]);
    const seen = new Map<string, number>();
    base = fx.hits.map((h) => {
      const k = `${h.operator}|${h.event}`;
      const vs = byKey.get(k) as number[];
      const n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      return { ...h, value: vs[(n * 7919 + 13) % vs.length] as number };
    });
  }
  for (const fold of [0, 1]) {
    const hide = (i: number) => i % 2 === fold && fx.hits[i]?.crit !== null;
    const hidden: LogFixture = { ...fx, hits: base.map((h, i) => (hide(i) ? { ...h, crit: null } : h)) };
    const placement = placeHits(data, hidden);
    for (const [i, h] of fx.hits.entries()) if (hide(i)) { hiddenN++; if (h.crit) hiddenTrue++; }
    for (const [i, c] of valueCrits(all, hidden, placement)) {
      if (!hide(i)) continue;
      const truth = fx.hits[i]?.crit;
      const op = fx.hits[i]?.operator as string;
      const p = perOp.get(op) ?? [0, 0];
      if (truth === c) { right++; p[0]++; } else {
        wrong++; p[1]++;
        if (show) process.stdout.write(`  WRONG ${d.short} ${fx.hits[i]?.t} ${fx.hits[i]?.event} ${hidden.hits[i]?.value}\n`);
      }
      perOp.set(op, p);
    }
  }
  if (shuffle) continue;
  // On the real fixture (flags kept, its kits' own crit triggers): the crit-less hits it decides.
  const real = valueCrits(kits, fx, placeHits(data, fx));
  const nulls = fx.hits.filter((h) => h.crit === null).length;
  open += nulls;
  openFound += real.size;
  if (real.size) process.stdout.write(`${d.short}: ${real.size} of ${nulls} crit-less hits inferred crits\n`);
}
process.stdout.write(`hidden flags: ${right} right, ${wrong} wrong (${(right / (right + wrong)).toFixed(3)}); base rate ${(hiddenTrue / hiddenN).toFixed(3)} of ${hiddenN}; real crit-less ${openFound} of ${open}\n`);
for (const [op, [r, w]] of perOp) process.stdout.write(`  ${op}: ${r} right, ${w} wrong\n`);
