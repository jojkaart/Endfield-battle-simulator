// Hold-clocks round (2026-11-23): Corrosion's ramp readings (rampsteps.ts, as `zmdlogs ramp` shows them) over every
// development log: how often the replay's ramp runs behind the log's (the hold the steps allow is below zero, so the
// replay's stops held it longer than the game) and whether a combo slow-down lies in the window; and how often the log
// needs a hidden hold. Run: node scripts/probes/corrosion/rampprobe.ts (a minute or two; prints one line per log).
import { loadGameData } from "@efsim/data";
import { castTimeStops, corrosionRamp, devFixtures, logBuffReplay, placeHits, worldMs } from "@efsim/logs";

const data = loadGameData();
const rows: { log: string; over: number; under: number; n: number; overC: number; overNoC: number }[] = [];
for (const { short, fx } of devFixtures({})) {
  const placement = placeHits(data, fx);
  const { replay } = logBuffReplay(data, fx, placement);
  const steps = corrosionRamp(data, fx, placement, replay);
  if (!steps.length) continue;
  const stops = castTimeStops(data, placement.casts);
  const combos = stops.filter((s) => s.kind !== "ultimate");
  let over = 0, under = 0, overC = 0, overNoC = 0;
  for (const x of steps) {
    const hi = x.world - x.low * 1000;
    const lo = x.capped ? -Infinity : x.world - (x.high + 1) * 1000;
    const C = x.hit.t - x.since - worldMs(x.since, x.hit.t, combos);
    if (hi < -100) {
      over++;
      if (C > 100) overC++;
      else overNoC++;
    }
    if (lo > 100) under++;
  }
  rows.push({ log: short.slice(0, 4), over, under, n: steps.length, overC, overNoC });
  process.stdout.write(`${short.slice(0, 4)}: ${steps.length} readings, replay ramp behind (over-held) ${over} (with a combo stop in the window ${overC}, without ${overNoC}), ahead (needs hidden hold) ${under}\n`);
}
const sum = (k: keyof (typeof rows)[number]) => rows.reduce((a, r) => a + (r[k] as number), 0);
process.stdout.write(`all: ${sum("n")} readings, over-held ${sum("over")} (combo in window ${sum("overC")}, none ${sum("overNoC")}), needs hidden hold ${sum("under")}\nEFSIM-DONE rampprobe pass\n`);
