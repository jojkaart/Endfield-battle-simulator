// Damage expectations from the fixtures.
import { describe, expect, it } from "vitest";
import { Attr, computeHit, kitBuffModifiers, computeReaction, NO_STATUS, resolveValue, computeStats, hitAvailable, roundDamage, skillValue, type KitHit, UNMODELLED_DAMAGE_ATTRS, panelModifiers } from "@efsim/engine";
import { loadGameData } from "@efsim/data";
import { loadFixtures } from "./fixtures.ts";

const data = loadGameData();

describe.each(loadFixtures().filter(({ fixture }) => fixture.expected.damage?.length))("$file", ({ fixture }) => {
  const panel = computeStats(data, fixture.build);
  const kit = data.kits.operators[fixture.build.operator];
  it.each(fixture.expected.damage ?? [])("$label = $expected", ({ hits, buffs, crit, expected, tolerance }) => {
    let exact = 0;
    const modifiers = (buffs ?? []).flatMap((b) => (typeof b === "string" ? kitBuffModifiers(data, fixture.build, panel, b) : kitBuffModifiers(data, fixture.build, panel, b.buff, b.layers ?? 1)));
    for (const { skill, hit, times } of hits) {
      const s = kit?.skills.find((x) => x.skillId === skill);
      const h = s?.hits.find((x) => x.id === hit);
      if (!s || !h) throw new Error(`kit has no ${skill} / ${hit}`);
      const result = computeHit(data, fixture.build, panel, { enemy: fixture.enemy.id, level: fixture.enemy.level }, s, h, {
        crit: crit ?? "never",
        staggered: false,
        modifiers,
        // A fixture lists hits that happened: what the kit can't judge without the fight (the enemy's statuses) counts as met.
        assumeUnknown: true,
      });
      exact += result.exact * (times ?? 1);
    }
    expect(Math.abs(roundDamage(exact) - expected)).toBeLessThanOrEqual(tolerance ?? 0);
  });
});

describe("skill values as bonuses", () => {
  const { fixture } = loadFixtures()[0] as ReturnType<typeof loadFixtures>[number];
  const panel = computeStats(data, fixture.build);
  const kit = data.kits.operators[fixture.build.operator];
  const s = kit?.skills.find((x) => x.skillId === "chr_0016_laevat_attack1");
  const h = s?.hits[0];
  const target = { enemy: "eny_0051_rodin", level: 90 };
  const opts = { crit: "never" as const, staggered: false };

  it("a hit's own bonus adds its skill value to the zone", () => {
    if (!s || !h) throw new Error("no kit");
    const plain = computeHit(data, fixture.build, panel, target, s, h, opts);
    const boosted = computeHit(data, fixture.build, panel, target, s, { ...h, bonuses: [{ zone: "damageBonus", key: "atk_scale" }] }, opts);
    const v = skillValue(data, panel, fixture.build, s.skillId, "atk_scale");
    expect(boosted.zones.damageBonus).toBeCloseTo(plain.zones.damageBonus + v, 12);
    expect(boosted.modifiers.some((m) => m.source === "chr_0016_laevat_attack1 atk_scale")).toBe(true);
  });
});

describe("kit hit primitives: factor, reaction hits, scaleIf, when", () => {
  const { fixture } = loadFixtures()[0] as ReturnType<typeof loadFixtures>[number];
  const panel = computeStats(data, fixture.build);
  const s = data.kits.operators[fixture.build.operator]?.skills.find((x) => x.skillId === "chr_0016_laevat_attack1");
  const h = s?.hits[0];
  const target = { enemy: "eny_0051_rodin", level: 90 };
  const opts = { crit: "never" as const, staggered: false };
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

describe("damage attributes without a modelled zone (round-two review: Burst and reaction DMG)", () => {
  it("no weapon, gear piece, gear set, potential or food in the data writes one", () => {
    const seen = new Map<number, string>();
    const walk = (v: unknown, path: string): void => {
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        if (typeof o["attr"] === "number" && !seen.has(o["attr"])) seen.set(o["attr"], path);
        for (const [k, x] of Object.entries(o)) walk(x, `${path}.${k}`);
      }
    };
    for (const key of ["operators", "weapons", "gear", "gearSets", "foods"] as const) walk(data[key], key);
    // The walk finds attribute lines (a control: ATK and Crit Rate are written by weapons and gear)...
    expect(seen.has(Attr.Atk) && seen.has(Attr.CriticalRate)).toBe(true);
    // ...and none of the unmodelled ones.
    expect([...seen].filter(([a]) => UNMODELLED_DAMAGE_ATTRS.has(a))).toEqual([]);
  });

  it("a stat panel with one is refused, not dropped", () => {
    const [first] = loadFixtures();
    if (!first) throw new Error("no fixtures");
    const panel = computeStats(data, first.fixture.build);
    const atk = panel.attrs[Attr.Atk];
    if (!atk) throw new Error("no ATK line");
    const withBurst = { ...panel, attrs: { ...panel.attrs, [Attr.CrystAbnormalDamageIncrease]: { ...atk, attr: Attr.CrystAbnormalDamageIncrease, total: 0.2 } } };
    expect(() => panelModifiers(data, withBurst)).toThrow(/CrystAbnormalDamageIncrease 0.2: a damage zone the engine doesn't model/);
    expect(() => panelModifiers(data, panel)).not.toThrow();
  });
});
