// Damage expectations from the fixtures.
import { describe, expect, it } from "vitest";
import { Attr, computeHit, kitBuffModifiers, computeReaction, NO_STATUS, resolveValue, computeStats, conditionModifiers, EngineError, hitAvailable, roundDamage, skillValue, type Condition, type KitHit, type OperatorKit } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { loadFixtures } from "./fixtures.ts";

const data = loadGameData();

describe.each(loadFixtures().filter(({ fixture }) => fixture.expected.damage?.length))("$file", ({ fixture }) => {
  const panel = computeStats(data, fixture.build);
  const kit = data.kits.operators[fixture.build.operator];
  it.each(fixture.expected.damage ?? [])("$label = $expected", ({ hits, conditions, buffs, crit, expected, tolerance }) => {
    let exact = 0;
    const modifiers = (buffs ?? []).flatMap((b) => (typeof b === "string" ? kitBuffModifiers(data, fixture.build, panel, b) : kitBuffModifiers(data, fixture.build, panel, b.buff, b.layers ?? 1)));
    for (const { skill, hit, times } of hits) {
      const s = kit?.skills.find((x) => x.skillId === skill);
      const h = s?.hits.find((x) => x.id === hit);
      if (!s || !h) throw new Error(`kit has no ${skill} / ${hit}`);
      const result = computeHit(data, fixture.build, panel, { enemy: fixture.enemy.id, level: fixture.enemy.level }, s, h, {
        crit: crit ?? "never",
        staggered: false,
        conditions: conditions ?? [],
        modifiers,
        // A fixture lists hits that happened: what the kit can't judge without the fight (the enemy's statuses) counts as met.
        assumeUnknown: true,
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

describe("kit hit primitives: factor, reaction hits, scaleIf, when", () => {
  const { fixture } = loadFixtures()[0] as ReturnType<typeof loadFixtures>[number];
  const panel = computeStats(data, fixture.build);
  const s = data.kits.operators[fixture.build.operator]?.skills.find((x) => x.skillId === "chr_0016_laevat_attack1");
  const h = s?.hits[0];
  const target = { enemy: "eny_0051_rodin", level: 90 };
  const opts = { crit: "never" as const, staggered: false, conditions: [] };
  const hit = (extra: Partial<KitHit>) => {
    if (!s || !h) throw new Error("no kit");
    return computeHit(data, fixture.build, panel, target, s, { ...h, ...extra }, opts);
  };

  it("a literal factor multiplies the hit", () => {
    expect(hit({ factor: 0.5 }).exact).toBeCloseTo(hit({}).exact / 2, 9);
  });

  it("a reaction-type hit is the reaction's damage times its scale keys", () => {
    const r = hit({ reaction: { kind: "burst", element: "natural" }, scale: ["atk_scale"] });
    const burst = computeReaction(data, fixture.build, panel, target, { kind: "burst", element: "natural", stacks: 1 }, opts);
    const v = skillValue(data, panel, fixture.build, "chr_0016_laevat_attack1", "atk_scale");
    expect(r.exact).toBeCloseTo(burst.exact * v, 6);
    expect(r.element).toBe("natural");
  });

  it("an extra scale applies only in its situation; unknown situations follow assumeUnknown", () => {
    if (!s || !h) throw new Error("no kit");
    const withIf: KitHit = { ...h, extraScale: [{ value: "atk_scale", if: { enemyInfliction: "natural" } }] };
    const v = skillValue(data, panel, fixture.build, s.skillId, "atk_scale");
    const fire = { ...NO_STATUS, infliction: { element: "fire" as const, stacks: 1, expiresAt: 600 } };
    const nature = { ...NO_STATUS, infliction: { element: "natural" as const, stacks: 1, expiresAt: 600 } };
    const none = computeHit(data, fixture.build, panel, target, s, withIf, { ...opts, situation: { enemy: fire } });
    const yes = computeHit(data, fixture.build, panel, target, s, withIf, { ...opts, situation: { enemy: nature } });
    expect(yes.exact).toBeCloseTo(none.exact * v, 6);
    expect(() => computeHit(data, fixture.build, panel, target, s, withIf, opts)).toThrow(/can't be decided/);
    expect(computeHit(data, fixture.build, panel, target, s, withIf, { ...opts, assumeUnknown: true }).exact).toBeCloseTo(yes.exact, 6);
  });

  it("a hit with `if` exists only in its situation (a mode by panel attributes)", () => {
    const str = Attr.Str;
    const intel = Attr.Wisd;
    const a = panel.attrs[str]?.total ?? 0;
    const b = panel.attrs[intel]?.total ?? 0;
    if (!h || !s) throw new Error("no kit");
    expect(hitAvailable(data, fixture.build, panel, s.skillId, { ...h, if: { attrAtLeast: [str, intel] } })).toBe(a >= b);
    expect(hitAvailable(data, fixture.build, panel, s.skillId, { ...h, if: { attrAtLeast: [intel, str] } })).toBe(b >= a);
    // Unknown (no enemy given): possible.
    expect(hitAvailable(data, fixture.build, panel, s.skillId, { ...h, if: { enemyStatus: "solidification" } })).toBe(true);
  });
});

describe("buff values (ValueExpr)", () => {
  const { fixture } = loadFixtures()[0] as ReturnType<typeof loadFixtures>[number];
  const panel = computeStats(data, fixture.build);
  const b = fixture.build;
  const sid = "chr_0016_laevat_attack1";
  const k = skillValue(data, panel, b, sid, "atk_scale");
  const will = panel.attrs[Attr.Will]?.total ?? 0;
  it("is a literal, a skill value, or a skill value times an attribute, capped by another key", () => {
    expect(resolveValue(data, b, panel, sid, 0.25)).toBe(0.25);
    expect(resolveValue(data, b, panel, sid, { product: ["atk_scale", 3] })).toBeCloseTo(3 * k, 12);
    expect(resolveValue(data, b, panel, sid, { product: ["atk_scale", { attr: Attr.Will }] })).toBeCloseTo(k * will, 9);
    expect(resolveValue(data, b, panel, sid, { min: [{ product: ["atk_scale", { attr: Attr.Will }] }, "atk_scale"] })).toBeCloseTo(Math.min(k * will, k), 12);
  });
});
