// Every reader of an assumption takes the run's readings (round 19; the break-hold reports point 1 and point 3):
// holds.ts tickBounds was called from buffreplay.ts without the replay's `assume`, so under `measure --variant
// break-hold=…` the engine held the breaks one way and the hidden holds' tick bounds another, with no warning.
//
// Two checks. The static one: no code reads a reading by hand (`assume?.[id] ?? …default`, `ENGINE_ASSUMPTIONS.find`)
// outside the registry's readingOf (packages/engine/src/assumptions.ts), so every read is traced. The run: a log's whole
// check (snapshotEntry: placement, replay, hidden holds, check, totals) under every assumption given explicitly at its
// default reading, so the run is the default one, with every read traced (traceReadings): a reader that was handed
// `{}` or nothing instead of the run's readings reports a default the run didn't give, and fails here. 6339 (Stagger
// breaks, several targets and kills: break-hold, break-hold-place, logged-purges, kill-gaps, enemy-hp) runs in under
// a second; 9090's and 4d60's (holds, away stretches, a whole-game pause) in tests/slow/assumption-readers-logs.test.ts.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { defaultedReads } from "./helpers/readings.ts";

const data = loadGameData();
const ROOT = new URL("..", import.meta.url).pathname;

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join(dir, f));
}

describe("assumption readers", () => {
  it("read a reading only through readingOf / engineReading (packages/engine, logs, cli, data)", () => {
    const byHand = /\bassume\??\.?\[|ENGINE_ASSUMPTIONS\.find\(|kitAssumptions\([^)]*\)\.find\(/;
    const offenders = ["packages/engine/src", "packages/logs/src", "packages/cli/src", "packages/data/src"]
      .flatMap(sources)
      .filter((f) => !f.endsWith("engine/src/assumptions.ts"))
      .flatMap((f) =>
        readFileSync(join(ROOT, f), "utf8")
          .split("\n")
          .map((line, i) => ({ i, line }))
          .filter(({ line }) => byHand.test(line) && !/^\s*(\/\/|\*)/.test(line))
          .map(({ i, line }) => `${f}:${i + 1}: ${line.trim().slice(0, 120)}`),
      );
    expect(offenders).toEqual([]);
  });

  it("take the run's readings through a log's whole check (6339)", () => {
    const { defaulted, reads } = defaultedReads(data, "6339");
    expect(reads).toBeGreaterThan(0);
    expect(defaulted, "read at their defaults though the run gave every reading: a reader not handed the run's `assume`").toEqual([]);
  });
});
