// Probe (scripts/probes/README.md): four smaller leads (2026-11-23): held world time at the lowest scale against the stops' sum (rule T3); uses castTimeStops (the placed casts only): `efsim zmdlogs worldtime` has the replay's casts' stops.
// Promoted from that round's scratch/stop-sum.ts unchanged but for this header; run it from the repository root.
// Held world time (s) between two moments under the placed stops: lowest scale per frame (the engine) and sum of each
// stop's own hold (rule T3's alternative). Usage: node scratch/stop-sum.ts <log id> <from s> <to s>
import { loadGameData } from "@efsim/data";
import { FPS } from "@efsim/engine";
import { castTimeStops, devFixtures, placeHits } from "@efsim/logs";

const [id, a, b] = process.argv.slice(2);
const data = loadGameData();
const { fx } = devFixtures({ ids: [id as string] })[0] as { fx: Parameters<typeof placeHits>[1] };
const stops = castTimeStops(data, placeHits(data, fx).casts);
const [f0, f1] = [Math.round(Number(a) * FPS), Math.round(Number(b) * FPS)];
let lowest = 0;
let sum = 0;
for (let f = f0; f < f1; f++) {
  let m = 1;
  for (const s of stops) {
    if (f < s.start || f >= s.start + s.scales.length) continue;
    const v = s.scales[f - s.start] as number;
    m = Math.min(m, v);
    sum += 1 - v;
  }
  lowest += 1 - m;
}
for (const s of stops) if (s.start < f1 && s.start + s.scales.length > f0) process.stdout.write(`  ${s.operator} ${s.skillId} ${(s.start / FPS).toFixed(2)}–${((s.start + s.scales.length) / FPS).toFixed(2)} s\n`);
process.stdout.write(`${id} ${a}–${b} s: held ${(lowest / FPS).toFixed(2)} s at the lowest scale, ${(sum / FPS).toFixed(2)} s summed\n`);
