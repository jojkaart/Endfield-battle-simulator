// The logged facts a replay's landings didn't take (lostfacts.ts, LOST decision lines; round 24, the combo-openers
// report point 1: re-pinning the openers at the press dropped Estella's Cryst reaction's logged crit without a word).
import { describe, expect, it } from "vitest";
import { loadGameData } from "@efsim/data";
import type { LandedHit } from "@efsim/engine";
import { lostDecision, lostFacts, replayDecisions, type LogHit } from "@efsim/logs";
import { fakeReplay } from "./helpers/replay.ts";
import { logHitOf } from "./helpers/synthetic.ts";

const data = loadGameData();
const landing = (frame: number, extra: Partial<LandedHit> = {}) => ({ frame, operator: "op", skillId: "op_skill", hitId: "hit", damage: 100, count: 1, ...extra }) as unknown as LandedHit;

describe("the logged facts no landing took (LOST)", () => {
  // A kit hit's landing takes the log's crit by its ref or within a frame (LandedHit.loggedCrit); a status landing by
  // its frame; a reaction level within a frame of a reaction landing.
  const kitCrit = logHitOf("op", 1000, "op_skill_hit", 500, { crit: true }); // frame 30
  const kitTaken = logHitOf("op", 2000, "op_skill_hit", 500, { crit: true });
  const kitUnknown = logHitOf("op", 2500, "op_skill_hit", 500, { crit: null });
  const reaction = logHitOf("op", 3000, "buff_common_cryst_fire_triggered", 900, { crit: false }); // frame 90
  const landings = new Map<LogHit, LandedHit>([
    [kitCrit, landing(34, { loggedCrit: null })],
    [kitTaken, landing(61, { loggedCrit: true })],
    [kitUnknown, landing(75, { loggedCrit: null })],
    [reaction, landing(93, { skillId: "reaction:reaction" })],
  ]);
  const replay = {
    landing: (h: LogHit) => landings.get(h) ?? { unknown: "none" },
    statusLanding: (h: LogHit) => landings.get(h) ?? { unknown: "none" },
    critSource: (h: LogHit) => (h.crit === null ? ("none" as const) : ("log" as const)),
    hits: [landing(150, { skillId: "reaction:reaction", operator: "op", element: "cryst" } as Partial<LandedHit>)],
    reactionLevels: [{ operator: "op", element: "cryst" as const, frame: 150, level: 2 }, { operator: "op", element: "fire" as const, frame: 200, level: 3 }],
  };
  const fx = { hits: [kitCrit, kitTaken, kitUnknown, reaction] };

  it("finds a kit hit's crit its landing has none of, a status landing's crit more than a frame away, a reaction level no landing took", () => {
    const lost = lostFacts(fx, replay);
    expect(lost).toEqual([
      { fact: "crit", hit: kitCrit, source: "log", landing: 34 },
      { fact: "crit", hit: reaction, source: "log", landing: 93 },
      { fact: "level", frame: 200, operator: "op", element: "fire", level: 3 },
    ]);
    expect(lost.map((x) => lostDecision(data, x).text)).toEqual([
      expect.stringMatching(/^op op_skill_hit 500 \(logged at 1\.00\): its crit \(the log's\) not taken by its landing at 1\.13, \+4 frame\(s\) from the logged hit/),
      expect.stringMatching(/cryst_fire_triggered 900 \(logged at 3\.00\): its crit .* \+3 frame\(s\)/),
      expect.stringMatching(/^op fire reaction level 3 \(the log's, at 6\.67\): no reaction landing/),
    ]);
  });

  it("are decisions only with the fixture (as BATCH): `zmdlogs decisions` and measure's counts show a rule that drops them", () => {
    expect(replayDecisions(data, fakeReplay()).some((x) => x.kind === "LOST")).toBe(false);
  });
});
