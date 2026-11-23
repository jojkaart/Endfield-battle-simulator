// Ramp-slowdowns round (2026-11-23): does a freeze (a control status that stops the enemy's clock in the replay) hold
// Corrosion's ramp in the log? Per Corrosion instance and replay freeze inside its readings: the held time the readings
// allow across the freeze (H after − H before, with the stops' own hold taken out), against what the replay held there.
// Run: node scripts/probes/corrosion/freezeramp.ts [ids…] (the replay holds the ramp only under freeze-ramp=held, the
// reading this probe replays: "the replay held" is what the engine held before 2026-11-23).
import { FPS } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { corrosionRamp, devFixtures, logBuffReplay, placeHits, replayTimeStops, type ReplayTimeStop } from "@efsim/logs";

const data = loadGameData();
const msOf = (f: number) => (f * 1000) / FPS;
const lowest = (stops: readonly ReplayTimeStop[]) => (f: number) => {
  let m = 1;
  for (const s of stops) if (f >= s.start && f < s.start + s.scales.length) m = Math.min(m, s.scales[f - s.start] as number);
  return m;
};
for (const { short, fx } of devFixtures({ ids: process.argv.slice(2) })) {
  const placement = placeHits(data, fx);
  const { replay } = logBuffReplay(data, fx, placement, { assume: { "freeze-ramp": "held" } });
  const freezes = (replay.reactions as unknown as Record<string, unknown>[]).filter((r) => r["kind"] === "control" && r["freezes"] === true).map((r) => ({ frame: Number(r["frame"]), frames: Number(r["frames"]), op: data.operators[String(r["operator"])]?.name, status: String(r["status"]) }));
  if (!freezes.length) continue;
  const steps = corrosionRamp(data, fx, placement, replay);
  if (!steps.length) continue;
  const stops = replayTimeStops(data, fx, placement);
  const rate = lowest(stops);
  for (const since of new Set(steps.map((x) => x.since))) {
    const list = steps.filter((x) => x.since === since).sort((x, y) => x.hit.t - y.hit.t);
    const a = Math.round((since * FPS) / 1000);
    const cum = (b: number) => {
      let h = 0;
      for (let f = a; f < b; f++) h += 1 - rate(f);
      return msOf(h);
    };
    // H (the game's held time) less the stops' hold: what's left for freezes and hidden holds.
    const pts = list.map((x) => {
      const real = x.hit.t - since;
      const b = Math.round((x.hit.t * FPS) / 1000);
      const st = cum(b);
      return { t: x.hit.t, U: real - x.low * 1000 - st, L: x.capped ? -Infinity : real - (x.high + 1) * 1000 - st, other: real - x.world - st };
    });
    for (const fz of freezes) {
      const [fs, fe] = [msOf(fz.frame), msOf(fz.frame + fz.frames)];
      const before = pts.filter((p) => p.t <= fs);
      const after = pts.filter((p) => p.t >= fe);
      if (!after.length || !pts.some((p) => p.t >= fs && p.t <= fe + 2000)) continue;
      if (fs < since - 0 && fe < since) continue;
      const Lb = Math.max(0, ...before.map((p) => p.L));
      const Ub = Math.min(...pts.filter((p) => p.t >= fs).map((p) => p.U));
      const Ua = Math.min(...after.map((p) => p.U));
      const La = Math.max(...pts.filter((p) => p.t <= fe).map((p) => p.L));
      const near = after.filter((p) => p.t <= fe + 1500);
      const otherAfter = near.length ? Math.max(...near.map((p) => p.other)) : NaN;
      process.stdout.write(`${short.slice(0, 4)} Corrosion ${(since / 1000).toFixed(2)}: ${fz.op} ${fz.status} ${(fs / 1000).toFixed(2)}–${(fe / 1000).toFixed(2)} (${(fe - fs).toFixed(0)} ms): hold across it ≤ ${(Ua - Lb).toFixed(0)} ms, ≥ ${(La - Ub).toFixed(0)} ms (hidden holds too); the replay held ${otherAfter.toFixed(0)}\n`);
    }
  }
}
process.stdout.write("EFSIM-DONE freezeramp pass\n");
