// Probe (2026-11-23, Wolven Blood crits): cross-validation of layerCrits (packages/logs buffreplay.ts). Every logged crit
// flag of each operator with a self crit trigger hidden (null), the inference run, its crits compared with the flags the
// log had. --shuffle: the negative control, the listing's starts moved to random other moments of the operator's hits
// (precision should fall to the base rate). -v: each wrong one. Run: node scripts/probes/crits/layer-xval.ts [--shuffle] [-v]
import { effectiveKit } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { devFixtures, layerCrits, placeHits, shownCrits } from "@efsim/logs";
import type { LogFixture, LogHit } from "@efsim/logs";

const data = loadGameData();
const shuffle = process.argv.includes("--shuffle");
let rnd = 12345;
const rand = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
const tot = { tp: 0, fp: 0, unknown: 0, hidden: 0, trues: 0 };
const per = new Map<string, { tp: number; fp: number; unknown: number }>();
for (const { short, fx } of devFixtures()) {
  const kits = fx.team.flatMap((b) => {
    const k = effectiveKit(data, b);
    return k ? [k] : [];
  });
  const ops = kits.filter((k) => k.triggers.some((t) => t.on.event === "hit" && t.on.crit === true && t.by === "self")).map((k) => k.operator);
  if (ops.length === 0) continue;
  const opSet = new Set(ops);
  let hits: LogHit[] = fx.hits.map((h) => (opSet.has(h.operator) ? { ...h, crit: null } : h));
  if (shuffle) {
    const moments = [...new Set(fx.hits.filter((h) => opSet.has(h.operator)).map((h) => h.t))];
    const map = new Map<number, number>();
    const to = (s: number) => map.get(s) ?? map.set(s, moments[Math.floor(rand() * moments.length)] as number).get(s) as number;
    hits = hits.map((h) => ({ ...h, effects: h.effects.map((e) => (e.since !== undefined && e.buff.includes("_layer") || e.buff.includes("critsuit") || e.buff.includes("pistol_0010") ? { ...e, since: to(e.since as number) } : e)), boundaryEffects: h.boundaryEffects.map((e) => (e.since !== undefined && (e.buff.includes("_layer") || e.buff.includes("critsuit") || e.buff.includes("pistol_0010")) ? { ...e, since: to(e.since as number) } : e)) }));
  }
  const hidden: LogFixture = { ...fx, hits };
  const placement = placeHits(data, hidden);
  const shown = shownCrits(kits, hidden, placement);
  const inferred = layerCrits(kits, hidden, placement, shown);
  for (const h of fx.hits) if (opSet.has(h.operator) && h.crit !== null) { tot.hidden++; if (h.crit) tot.trues++; }
  for (const [i] of inferred) {
    const truth = fx.hits[i]?.crit;
    const key = `${short} ${fx.hits[i]?.operator}`;
    const r = per.get(key) ?? per.set(key, { tp: 0, fp: 0, unknown: 0 }).get(key) as { tp: number; fp: number; unknown: number };
    if (truth === true) { tot.tp++; r.tp++; } else if (truth === false) { tot.fp++; r.fp++; if (process.argv.includes("-v")) process.stdout.write(`FP ${short} ${fx.hits[i]?.t} ${fx.hits[i]?.event} ${fx.hits[i]?.value}\n`); } else { tot.unknown++; r.unknown++; }
  }
}
for (const [k, r] of per) process.stdout.write(`${k}: right ${r.tp} wrong ${r.fp} (log null ${r.unknown})\n`);
process.stdout.write(`total: inferred crits right ${tot.tp}, wrong ${tot.fp}, on hits the log has null ${tot.unknown}; precision ${(tot.tp / (tot.tp + tot.fp)).toFixed(3)}; base rate ${(tot.trues / tot.hidden).toFixed(3)} (${tot.trues} of ${tot.hidden} flagged hits); recall ${(tot.tp / tot.trues).toFixed(3)}\n`);
