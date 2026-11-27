// Round 18 (the placement-cases report point 1, the replay-only report point 3): the placement's rules that join a
// landing to a cast placed before it, and the realignment by value, leave a record of what decided (PlacedHit.joined,
// Placement.realign), and `zmdlogs casts --choices` prints it: a late join's rule and times, a REALIGN line per cast's
// key the realignment looked at. Records only: no placement moves.

import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import { readLogFixture, type LogHit } from "@efsim/logs";
import { placeHits } from "../packages/logs/src/logcasts.ts";
import { castsView } from "../packages/logs/src/views.ts";
import { lateJoin } from "../packages/logs/src/placementwords.ts";

const data = loadGameData();
const fixture = (path: string) => readLogFixture(new URL(`../fixtures/${path}.json`, import.meta.url).pathname);

describe("why a landing joined its cast (PlacedHit.joined)", () => {
  // 40d9a3c1da37: Gilberta's attack 4 projectile at 11.00 s, its second slot, 1.67 s after the first at 9.33 s (frame 27
  // against 25): joined as a slot to come within the skill's action.
  const fx = fixture("zmdlogs-40d9a3c1da37");
  const G = "chr_0013_aglina";
  const p = placeHits(data, fx);
  const at = (t: number) => fx.hits.find((h) => h.operator === G && h.t >= t - 5 && h.t <= t + 5 && h.event === `${G}_attack4_projhit_2`) as LogHit;
  it("records the rule and the times of a join, none for the hit that opened the cast", () => {
    const j = p.hits.get(at(11000))?.joined;
    expect(j?.by).toBe("to come");
    expect(j?.elapsed).toBeGreaterThan(1500);
    expect(j && lateJoin(j)).toBe(true);
    // At 9.33 s the cast's first landing (attack4_projhit) opened it; the other key's first landing there joined it within reach, on time.
    const opener = fx.hits.find((h) => h.operator === G && h.t === 9334 && h.event === `${G}_attack4_projhit`) as LogHit;
    expect(p.hits.get(opener)?.joined).toBeUndefined();
    const second = p.hits.get(at(9333))?.joined;
    expect(second?.by).toBe("reach");
    expect(second && lateJoin(second)).toBe(false);
  });
  it("prints a late join with --choices only", () => {
    const view = (rules: boolean) => castsView(data, fx, { rules, from: 10900, to: 11100, operators: [G] });
    expect(view(true)).toMatch(/attack4_projhit_2 388 → attack4@8\.57 #1 frame 27 {2}\[joined: to come, slots to come within the skill's action: 1\.67 s after the cast's first landing/);
    expect(view(false)).not.toMatch(/\[joined/);
  });
});

describe("what the realignment by value did (Placement.realign)", () => {
  it("records a realigned key and prints it as a REALIGN line (6339's Si combo)", () => {
    const fx = fixture("pending/zmdlogs-63398339803e");
    const p = placeHits(data, fx);
    expect((p.realign ?? []).some((r) => r.realigned && r.cast.operator === "chr_0036_jsspsi" && /^\d+ → \d+ value\(s\) off: slots/.test(r.why))).toBe(true);
    expect((p.realign ?? []).every((r) => r.realigned || r.why.length > 0)).toBe(true);
  });
});
