// The logged Stagger breaks within 3 frames of an ultimate's time stop (the replay's stops, replayTimeStops): the
// stop's frames against the break's, whether the replay's break stops (holds.ts breakStops) hold it, the next moment.
// 2026-11-27 (the break placement round): 7 breaks; under break-hold-place `ms` two held at a stop's edge,
// 4d60e7fe92c2 56.29 s (the stop's end frame: on time after it, no hold; docs/tried/2026-11-27-break-ultimate-stop-end.diff)
// and 04d401ad257e 458.25 s (a frame after it, the next moment 0.44 s later: not decidable); under `moments` (the
// default) 4d60's hold moves into the stop, so not held.
//   node scripts/probes/stagger/ult-edge.ts
import { loadGameData } from "@efsim/data";
import { FPS } from "@efsim/engine";
import { devFixtures, placeHits, replayTimeStops, loggedBreaks, breakStops, operatorLabel } from "@efsim/logs";

const data = loadGameData();
const frameOf = (ms: number) => Math.round((ms * FPS) / 1000);
for (const { short, fx } of devFixtures({})) {
  if (fx.hits.some((h: any) => h.target)) continue;
  const placement = placeHits(data, fx);
  const stops = replayTimeStops(data, fx, placement);
  const brk = breakStops(fx, stops as any, undefined);
  const moments = [...new Set(fx.hits.map((h) => h.t))].sort((a, b) => a - b);
  for (const tb of loggedBreaks(fx)) {
    const f = frameOf(tb);
    const near = stops.filter((s) => s.kind === "ultimate" && s.start - 3 <= f && s.start + s.scales.length + 3 >= f);
    if (!near.length) continue;
    const held = brk.some((b) => Math.abs(b.start - f) <= 1);
    const next = moments.find((m) => m > tb);
    const by = fx.hits.find((h) => h.t === tb && h.poise?.bar === 0);
    process.stdout.write(`${short} ${(tb / 1000).toFixed(2)} f${f} by ${by ? operatorLabel(data, by.operator) + " " + by.event : "?"} held=${held} next+${next !== undefined ? next - tb : "-"} | ${near.map((s) => `${operatorLabel(data, s.operator)} ult [${s.start},${s.start + s.scales.length}) end-f=${s.start + s.scales.length - f}`).join("; ")}\n`);
  }
}
