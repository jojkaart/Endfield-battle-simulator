// Damage expectations from the fixtures.
import { describe, expect, it } from "vitest";
import { computeHit, computeStats, EngineError, roundDamage } from "@efsim/engine";
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
