// Probe (scripts/probes/README.md): the enemy-clock round (2026-11-26), docs/open-problems.md "The enemy's clock".
// node scripts/probes/combo-hold/bursts.ts [--rows] (a few minutes: a replay per log); writes nothing.
// Arts Bursts: each logged burst's world delay past the burst delay (ask) against the time other operators' combo
// stops hold between its logged cause and it. If a combo holds the world (and the operators' clocks) more than its stop
// list says, the ask rises with the combo-held time (as the enemy's tick chains do: scratch/chaincount.ts).
import { loadGameData } from "@efsim/data";
import { FPS, type ArtsElement } from "@efsim/engine";
import { burstRows, devFixtures, placeHits, replayTimeStops, worldMs } from "@efsim/logs";

const data = loadGameData();
const pts: { ask: number; combo: number; ult: number; tag: string }[] = [];
for (const { short, fx } of devFixtures({ dirs: ["verified", "pending"] })) {
  if (!fx.hits.some((h) => /_triggered$/.test(h.event))) continue;
  let br, stops;
  try {
    const placement = placeHits(data, fx);
    br = burstRows(data, fx);
    stops = replayTimeStops(data, fx, placement);
  } catch {
    continue;
  }
  for (const r of br) {
    const c = r.logged?.cause;
    if (!r.logged || !c) continue;
    const delay = ((data.constants.burstDelayFrames?.[r.element as ArtsElement] ?? 0) * 1000) / FPS;
    const ask = c.world - delay;
    if (ask < -300 || ask > 1500) continue;
    const others = stops.filter((s) => s.operator !== r.operator);
    const held = (k: string) => r.logged!.t - c.t - worldMs(c.t, r.logged!.t, others.filter((s) => s.kind === k));
    pts.push({ ask, combo: held("combo"), ult: held("ultimate"), tag: `${short} ${(r.logged.t / 1000).toFixed(2)} ${r.operator.split("_")[2]}` });
  }
}
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? NaN;
for (const [label, sel] of [["no stop between", pts.filter((p) => p.combo === 0 && p.ult === 0)], ["combos only", pts.filter((p) => p.combo > 0 && p.ult === 0)], ["an ultimate", pts.filter((p) => p.ult > 0)]] as const) {
  const k = sel.reduce((s, p) => s + p.combo * p.ask, 0) / sel.reduce((s, p) => s + p.combo * p.combo, 0);
  process.stdout.write(`${label}: ${sel.length} bursts, ask median ${med(sel.map((p) => p.ask)).toFixed(0)} ms, combo-held median ${med(sel.map((p) => p.combo)).toFixed(0)} ms, ask = ${k.toFixed(2)} × combo (through 0)\n`);
}
if (process.argv.includes("--rows")) for (const p of pts.filter((x) => x.combo > 0 && x.ult === 0)) process.stdout.write(`${p.tag} ask ${p.ask.toFixed(0)} combo ${p.combo.toFixed(0)}\n`);
