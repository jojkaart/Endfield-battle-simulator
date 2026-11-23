// One source for the log tools' time-stop lists (friction round 7, ramp-slowdowns report point 4 and hold-clocks point
// 1: Arcane's combo reset had to be applied in four builders, and a measurement with only the engine's cut looked mixed).
// Every list in packages/logs is built by logcasts.ts skillStops and cut by withResets; reading SkillTiming.slowdowns or
// .resets anywhere else is a new builder. The reads that aren't lists are counted here, each with why.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { skillStops } from "@efsim/logs";

const SRC = new URL("../packages/logs/src/", import.meta.url).pathname;

/** The reads of `.slowdowns` / `.resets` allowed per file (code lines, comments aside), and why each isn't a stop list. */
const ALLOWED: Readonly<Record<string, { readonly n: number; readonly why: string }>> = {
  "logcasts.ts": {
    n: 6,
    why: "skillStops (the builder: slowdowns, resets), withResets (its parts' resets), ownStopLoggedFrame (where a cast's own stop ends, for its logged frame), unplacedCastStops (whether a skill has any) and placeWith (whether a teammate's cast stops the world)",
  },
  "buffreplay.ts": { n: 1, why: "loggedCastStart: the length of an ultimate's full stop from its frame 0" },
};

describe("time-stop lists in packages/logs come from skillStops", () => {
  it("reads SkillTiming.slowdowns / .resets only where ALLOWED says", () => {
    const found: Record<string, number> = {};
    for (const f of readdirSync(SRC).filter((x) => x.endsWith(".ts"))) {
      const code = readFileSync(join(SRC, f), "utf8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l));
      const n = code.reduce((k, l) => k + (l.match(/\.(slowdowns|resets)\b/g)?.length ?? 0), 0);
      if (n) found[f] = n;
    }
    const want = Object.fromEntries(Object.entries(ALLOWED).map(([f, a]) => [f, a.n]));
    expect(found, "a new read of SkillTiming.slowdowns or .resets: build the stops with logcasts.ts skillStops + withResets (or, for a lookup that isn't a list, add it to ALLOWED with why)").toEqual(want);
  });
});

describe("skillStops: a cast's slow-downs along the path its landings show", () => {
  const data = loadGameData();
  const C3 = "chr_0028_wulfa_combo_3_skill";
  const who = { operator: "chr_0028_wulfa", skillId: C3, kind: "combo" as const };
  const starts = (landed?: number[]) => skillStops(data, C3, 1000, who, landed).stops.map((s) => [s.start, s.scales.length]);

  it("Rossi's sequence 2: the perfect path (a landing at 29) ends at 211 before the late path's frame-212 slow-down", () => {
    expect(starts([29])).toEqual([[1000, 12], [1000, 19]]);
  });

  it("the late path (its landing at 227, past the frame-0 jump to 212) has that slow-down at once; unknown, every one as listed", () => {
    expect(starts([227])).toEqual([[1000, 12], [1000, 19], [1000, 19]]);
    expect(starts()).toEqual([[1000, 12], [1000, 19], [1212, 19]]);
  });
});
