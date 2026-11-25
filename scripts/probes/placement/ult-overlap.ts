// Ultimates of different operators whose placed time stops overlap (logcasts.ts placeHits, castTimeStops), per
// development log: each pair's stops, the log's hits by anyone strictly inside the earlier stop's frames before the
// later's start (would run if the earlier were held in turn), and the held start the earlier would take in turn.
import { loadGameData } from "@efsim/data";
import { castTimeStops, devFixtures, placeHits } from "@efsim/logs";
import { FPS } from "@efsim/engine";

const data = loadGameData();
const s = (f: number) => (f / FPS).toFixed(2);
for (const { short, fx } of devFixtures()) {
  const p = placeHits(data, fx);
  const ults = p.casts.filter((c) => c.kind === "ultimate");
  const stops = castTimeStops(data, ults).filter((x) => x.scales.some((v) => v <= 0.05));
  for (let i = 0; i < stops.length; i++) for (let j = 0; j < stops.length; j++) {
    const a = stops[i]!, b = stops[j]!;
    if (a === b || a.operator === b.operator) continue;
    if (!(a.start <= b.start && b.start < a.start + a.scales.length)) continue;
    const overlap = a.start + a.scales.length - b.start;
    const ev = (fx.casts ?? []).filter((c) => (c.operator === a.operator || c.operator === b.operator) && /ultimate/.test(c.skill) && Math.abs(c.t - (a.start * 1000) / FPS) < 6000).map((c) => `${c.operator.slice(9)}@${(c.t / 1000).toFixed(2)}`);
    // The log's hits between where the earlier ultimate would start in turn (its stop ending at b.start) and b.start.
    const turnStart = b.start - a.scales.length;
    const between = fx.hits.filter((h) => h.t > ((turnStart) * 1000) / FPS + 50 && h.t < (a.start * 1000) / FPS - 50).length;
    const aMs = (a.start * 1000) / FPS;
    const lastBefore = Math.max(-1e9, ...fx.hits.filter((h) => h.t < aMs - 20).map((h) => h.t));
    const quiet = ((aMs - lastBefore) / 1000).toFixed(2);
    process.stdout.write(`quiet ${quiet} s before the first (its stop ${(a.scales.length / FPS).toFixed(2)} s) | `);
    process.stdout.write(`${short} ${a.operator.slice(9)} ${s(a.start)}–${s(a.start + a.scales.length)} / ${b.operator.slice(9)} ${s(b.start)}–${s(b.start + b.scales.length)}: overlap ${overlap} f; in turn the first from ${s(turnStart)} (log hits in ${s(turnStart)}–${s(a.start)}: ${between}); events ${ev.join(" ") || "-"}\n`);
  }
}
