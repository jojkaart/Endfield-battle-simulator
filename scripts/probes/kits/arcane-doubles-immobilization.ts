// Round 6 (2026-11-26, what ends Arcane's Doubles Susceptibility): for each run of her Doubles Susceptibility, Si's
// latest battle-skill hit (Immobilization) before it, the world time from that hit to the run's start, and the run's
// world length (seals applied while Immobilized run their full length). `node
// scripts/probes/kits/arcane-doubles-immobilization.ts`, one line per run on stdout.
import { loadGameData } from "@efsim/data";
import { buffLanes, devFixtures, replayTimeStops, worldMs } from "@efsim/logs";

const data = loadGameData();
const ARC = "chr_0032_lizhiyan";
const SI = "chr_0036_jsspsi";
for (const { short, fx } of devFixtures({ withOperators: [ARC, SI] })) {
  const hits = [...fx.hits].sort((a, b) => a.t - b.t);
  const siBattle = hits.filter((h) => h.operator === SI && /normal_skill_abilityrange_1$/.test(h.event)).map((h) => h.t);
  const ultTimes = new Set(hits.filter((h) => h.operator === ARC && /ultimate_skill/.test(h.event)).map((h) => h.t));
  const lanes = buffLanes(fx, /vulnerable_natural/).filter((l) => l.source === ARC && l.since !== null && !ultTimes.has(l.since));
  let stops: ReturnType<typeof replayTimeStops> = [];
  try {
    stops = replayTimeStops(data, fx);
  } catch {
    stops = [];
  }
  const si = fx.team.find((b) => b.operator === SI);
  for (const l of lanes) {
    const since = l.since as number;
    const before = siBattle.filter((t) => t <= since + 50).at(-1);
    const gap = before === undefined ? null : worldMs(before, since, stops);
    const len = worldMs(since, l.nextUnlisted ?? l.lastListed, stops);
    const lenLast = worldMs(since, l.lastListed, stops);
    process.stdout.write(`${short} P${si?.potential ?? "?"} doubles since ${(since / 1000).toFixed(2)} val ${l.values.join(",")}: Si battle hit ${before === undefined ? "-" : (before / 1000).toFixed(2)} (world ${gap === null ? "-" : (gap / 1000).toFixed(2)} s before); run world ${(lenLast / 1000).toFixed(2)}–${l.nextUnlisted === null ? "end" : (len / 1000).toFixed(2)} s\n`);
  }
}
