// A kit hit on the world's clock from its launch (KitHit.world with KitHit.launch; ScheduledHeader.worldFromLaunch):
// until its launch it is the cast's own, on the caster's clock, which her own slow-down doesn't hold; from then on the
// world's, which every stop holds, her own ultimate's too. Typhoeus's Barrage Array: the entity her combo's first arrow
// spawns at frame 35, whose first tick lands with the arrow in every log (past her combo's own slow-down, frames 0–24)
// and whose ticks wait out her own ultimate's stop (fc63 90.53–92.87 s).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type Build, type GameData, type OperatorKit, type RotationAction, type TimelineScenario } from "@efsim/engine";
import { loadGameData } from "@efsim/data";

const raw = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/typhoeus-p5.json", import.meta.url), "utf8")) as Build;
const op = build.operator;
const T = "chr_0034_typhoea_";
const kit = raw.kits.operators[op] as OperatorKit;
// Her combo cast without its window (comboWindow false), so the scenario needs no teammate to open it.
const data: GameData = { ...raw, kits: { ...raw.kits, operators: { ...raw.kits.operators, [op]: { ...kit, skills: kit.skills.map((s) => (s.skillId === `${T}combo_skill` ? { ...s, comboWindow: false as const } : s)) } } } };
const scenario = (rotation: RotationAction[]): TimelineScenario => ({
  team: [build], target: { enemy: "eny_0051_rodin", level: 90 }, durationFrames: 30 * 20, rotation, options: { crit: "never" }, startEnergy: { [op]: "full" },
});
const run = (rotation: RotationAction[]) => {
  const ctx = createContext(data, scenario(rotation));
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, 900);
};
const ticks = (rotation: RotationAction[]) => run(rotation).hits.filter((h) => h.skillId === `${T}combo_skill` && h.hitId === "area").map((h) => h.frame);
const combo: RotationAction = { operator: op, skill: `${T}combo_skill` };

describe("a hit on the world's clock from its launch (Typhoeus's Barrage Array)", () => {
  it("is not held by the caster's own slow-down before its launch: the first tick with the first arrow", () => {
    const r = run([combo]);
    const arrow = r.hits.find((h) => h.hitId === "first_arrow")?.frame;
    expect(arrow).toBe(35);
    expect(ticks([combo])).toEqual([35, 45, 55, 65, 75, 85, 95, 105, 115, 125, 135, 145, 155, 165, 175, 185, 195, 205]);
  });

  it("is held by the caster's own ultimate stop after its launch", () => {
    const withUlt = ticks([combo, { operator: op, skill: `${T}ultimate_skillfloating`, at: 100 }]);
    // The ultimate's stop at frame 100 holds the world 62 frames: the ticks due after it come that much later.
    expect(withUlt.filter((f) => f < 100)).toEqual([35, 45, 55, 65, 75, 85, 95]);
    expect(withUlt.filter((f) => f >= 100)).toEqual([105, 115, 125, 135, 145, 155, 165, 175, 185, 195, 205].map((f) => f + 62));
  });
});
