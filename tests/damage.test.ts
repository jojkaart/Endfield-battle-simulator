// Damage expectations from the fixtures.
import { describe, expect, it } from "vitest";
import { computeHit, computeStats, conditionModifiers, EngineError, roundDamage, skillValue, type Condition, type OperatorKit } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { loadFixtures } from "./fixtures.ts";

const data = loadGameData();

describe.each(loadFixtures().filter(({ fixture }) => fixture.expected.damage?.length))("$file", ({ fixture }) => {
  const panel = computeStats(data, fixture.build);
  const kit = data.kits.operators[fixture.build.operator];
  it.each(fixture.expected.damage ?? [])("$label = $expected", ({ hits, conditions, crit, expected, tolerance }) => {
    let exact = 0;
    for (const { skill, hit, times } of hits) {
      const s = kit?.skills.find((x) => x.skillId === skill);
      const h = s?.hits.find((x) => x.id === hit);
      if (!s || !h) throw new Error(`kit has no ${skill} / ${hit}`);
      const result = computeHit(data, fixture.build, panel, { enemy: fixture.enemy.id, level: fixture.enemy.level }, s, h, {
        crit: crit ?? "never",
        staggered: false,
        conditions: conditions ?? [],
      });
      exact += result.exact * (times ?? 1);
    }
    expect(Math.abs(roundDamage(exact) - expected)).toBeLessThanOrEqual(tolerance ?? 0);
  });
});

describe("conditions fail loudly", () => {
  const { fixture } = loadFixtures()[0] as ReturnType<typeof loadFixtures>[number];
  const panel = computeStats(data, fixture.build);
  const kit = data.kits.operators[fixture.build.operator];
  const s = kit?.skills[0];
  const h = s?.hits[0];
  it("rejects an unknown condition", () => {
    if (!s || !h) throw new Error("no kit");
    expect(() =>
      computeHit(data, fixture.build, panel, { enemy: "eny_0051_rodin", level: 90 }, s, h, { crit: "never", staggered: false, conditions: ["nope"] }),
    ).toThrow(EngineError);
  });
});

describe("skill values as bonuses and conditions", () => {
  const { fixture } = loadFixtures()[0] as ReturnType<typeof loadFixtures>[number];
  const panel = computeStats(data, fixture.build);
  const kit = data.kits.operators[fixture.build.operator];
  const s = kit?.skills.find((x) => x.skillId === "chr_0016_laevat_attack1");
  const h = s?.hits[0];
  const target = { enemy: "eny_0051_rodin", level: 90 };
  const opts = { crit: "never" as const, staggered: false, conditions: [] };

  it("a hit's own bonus adds its skill value to the zone", () => {
    if (!s || !h) throw new Error("no kit");
    const plain = computeHit(data, fixture.build, panel, target, s, h, opts);
    const boosted = computeHit(data, fixture.build, panel, target, s, { ...h, bonuses: [{ zone: "damageBonus", key: "atk_scale" }] }, opts);
    const v = skillValue(data, panel, fixture.build, s.skillId, "atk_scale");
    expect(boosted.zones.damageBonus).toBeCloseTo(plain.zones.damageBonus + v, 12);
    expect(boosted.modifiers.some((m) => m.source === "chr_0016_laevat_attack1 atk_scale")).toBe(true);
  });

  it("a skill-source condition reads the skill value at the build's level, after potentials", () => {
    const c: Condition = {
      id: "test.skill",
      label: "",
      source: { kind: "skill", skillId: "chr_0016_laevat_normal_skill", key: "extra_scaling", scale: 2 },
      effect: { kind: "zone", zone: "amp" },
    };
    const withKit = { ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [fixture.build.operator]: { ...(kit as OperatorKit), conditions: [c] } } } };
    // Potential 3 sets extra_scaling to 1.5.
    expect(conditionModifiers(withKit, fixture.build, ["test.skill"])).toEqual([{ zone: "amp", value: 3, source: "condition test.skill" }]);
  });
});
