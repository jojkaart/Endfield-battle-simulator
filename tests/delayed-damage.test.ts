// A hit whose damage waits on the enemy's clock (KitHit.enemyDelay: Typhoeus's Power Shot burst, a buff on the enemy
// that deals it after its triggerInterval): the landing's effects at its frame, the damage later, held by time stops.
// Shown on Laevatain's attack 1 with a hand-made delay and Heat infliction.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, apply, createContext, init, type Build, type GameData, type KitHit, type OperatorKit, type RotationAction, type TimelineScenario } from "@efsim/engine";
import { loadGameData } from "@efsim/data";

const data = loadGameData();
const build = JSON.parse(readFileSync(new URL("../examples/laevatain-forgeborn.json", import.meta.url), "utf8")) as Build;
const op = build.operator;
const kit = data.kits.operators[op] as OperatorKit;
const L = "chr_0016_laevat_";

/** Laevatain's data with attack 1's hit changed. */
function withAttack1(change: Partial<KitHit>): GameData {
  const skills = kit.skills.map((s) => (s.skillId === `${L}attack1` ? { ...s, hits: s.hits.map((h) => ({ ...h, ...change })) } : s));
  return { ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [op]: { ...kit, skills } } } };
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
const attack1 = (g: GameData, rotation: RotationAction[] = [{ operator: op, skill: `${L}attack1` }], until = 300) => run(g, rotation, until).hits.filter((h) => h.skillId === `${L}attack1`);

describe("KitHit.enemyDelay", () => {
  const plain = withAttack1({ applies: [{ kind: "infliction", element: "fire" }] });
  const delayed = withAttack1({ applies: [{ kind: "infliction", element: "fire" }], enemyDelay: 10 });
  const landing = (attack1(plain)[0] as { frame: number }).frame;

  it("applies at its frame and deals its damage that many frames later, the same damage", () => {
    const [hit] = attack1(delayed);
    expect(hit?.frame).toBe(landing + 10);
    expect(hit?.exact).toBeCloseTo((attack1(plain)[0] as { exact: number }).exact, 6);
    // At its landing the infliction is on and no damage is dealt yet.
    const at = run(delayed, [{ operator: op, skill: `${L}attack1` }], landing + 1);
    expect(at.enemy.infliction?.element).toBe("fire");
    expect(at.hits.filter((h) => h.skillId === `${L}attack1`)).toHaveLength(0);
  });

  it("waits on the enemy's clock: a time stop in between holds it, the caster's own too", () => {
    const rotation: RotationAction[] = [{ operator: op, skill: `${L}attack1` }, { operator: op, skill: `${L}ultimate_skill`, at: landing + 2 }];
    const ult = run(delayed, rotation, 900);
    const cast = ult.casts.find((c) => c.skill === `${L}ultimate_skill`)?.frame as number;
    expect(cast).toBeLessThan(landing + 10);
    expect(ult.hits.find((h) => h.skillId === `${L}attack1`)?.frame).toBeGreaterThan(landing + 10);
  });
});
