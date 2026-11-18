// A trigger's hits on the world's clock (the "hits" action's `world`: a buff's or an ability entity's timeline, as
// Arcane's Cluster Strike lasers): every time stop holds them, the owner's own ultimate stop too, which doesn't hold
// hits on the owner's own clock. Shown on Laevatain with a hand-made trigger on her attack 1.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type Build, type GameData, type KitTrigger, type OperatorKit, type RotationAction, type TimelineScenario } from "@efsim/engine";
import { loadGameData } from "@efsim/data";

const data = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const op = build.operator;
const kit = data.kits.operators[op] as OperatorKit;
const L = "chr_0016_laevat_";
const attack1 = kit.skills.find((s) => s.skillId === `${L}attack1`);
const base = attack1?.hits[0];
const DELAY = 20;

/** Laevatain's data with a trigger on her attack 1's hit that lands one hit DELAY frames later, on the world's clock or hers. */
function withEcho(world: boolean): GameData {
  if (!base) throw new Error("no attack 1 hit");
  const echo: KitTrigger = {
    id: "echo", on: { event: "hit", skills: [`${L}attack1`] }, by: "self", skill: `${L}attack1`,
    do: [{ kind: "hits", ...(world ? { world: true } : {}), hits: [{ ...base, id: "echo", frames: [DELAY] }] }],
  };
  return { ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [op]: { ...kit, triggers: [...kit.triggers, echo] } } } };
}
const scenario = (rotation: RotationAction[]): TimelineScenario => ({
  team: [build], target: { enemy: "eny_0051_rodin", level: 90 }, durationFrames: 30 * 20, rotation, options: { crit: "never" }, startEnergy: { [op]: "full" },
});
const run = (g: GameData, rotation: RotationAction[], until: number) => {
  const ctx = createContext(g, scenario(rotation));
  let s = init(ctx);
  for (const a of rotation) s = apply(ctx, s, a);
  return advance(ctx, s, until);
};
const echoes = (g: GameData, rotation: RotationAction[]) => run(g, rotation, 900).hits.filter((h) => h.hitId === "echo");
const firstOf = (g: GameData) => run(g, [{ operator: op, skill: `${L}attack1` }], 300).hits.find((h) => h.skillId === `${L}attack1`)?.frame as number;

describe('the "hits" action\'s world clock', () => {
  const landing = firstOf(withEcho(false));
  const alone: RotationAction[] = [{ operator: op, skill: `${L}attack1` }];
  const withUlt: RotationAction[] = [...alone, { operator: op, skill: `${L}ultimate_skill`, at: landing + 2 }];

  it("lands at its frame when nothing holds it, on either clock", () => {
    expect(echoes(withEcho(false), alone)[0]?.frame).toBe(landing + DELAY);
    expect(echoes(withEcho(true), alone)[0]?.frame).toBe(landing + DELAY);
  });

  it("the owner's own ultimate stop holds world hits, not hits on the owner's clock", () => {
    const cast = run(withEcho(true), withUlt, 900).casts.find((c) => c.skill === `${L}ultimate_skill`)?.frame as number;
    expect(cast).toBeLessThan(landing + DELAY);
    expect(echoes(withEcho(false), withUlt)[0]?.frame).toBe(landing + DELAY);
    expect(echoes(withEcho(true), withUlt)[0]?.frame).toBeGreaterThan(landing + DELAY);
  });
});
