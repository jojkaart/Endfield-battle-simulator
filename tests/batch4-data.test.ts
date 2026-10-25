// Batch-4 shared features, group "data compilation" (docs/kit-batches/batch-4.md
// D1–D10): conditional jumps behind checks in their own sequence, SP kinds of
// the files a skill reaches, weapon variants, a talent's passive skill on the
// stat panel, a skill hit's own damage type, poise-only landings, SP before a
// hit's damage, and what kit-draft compiles from them. Engine features are
// shown with small hand-made changes to Laevatain's kit.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Ajv2020 } from "ajv/dist/2020.js";
import { advance, apply, Attr, computeStats, createContext, init, type Build, type GameData, type KitBuff, type KitHit, type KitSkill, type KitTrigger, type OperatorKit, type RotationAction, type TimelineScenario, type TimelineState } from "@efsim/engine";
import { compileSkill, isConditionAction, loadGameData, loadKits, reachedFiles, readSkillFile, weaponVariants } from "@efsim/data";
import { kitDraft } from "../packages/cli/src/kitdraft.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = loadGameData();
const build = JSON.parse(readFileSync(join(ROOT, "examples/laevatain-forgeborn.json"), "utf8")) as Build;
const L = "chr_0016_laevat_";
const op = build.operator;
const kit = data.kits.operators[op] as OperatorKit;
const act = (skill: string): RotationAction => ({ operator: op, skill: L + skill });
const scenario = (rotation: RotationAction[]): TimelineScenario => ({ team: [build], target: { enemy: "eny_0051_rodin", level: 90 }, durationFrames: 30 * 60, rotation, options: { crit: "never" } });
/** Laevatain's kit with counting stacks a–e, extra buffs and triggers, and one skill's hits replaced. */
const withKit = (k: { buffs?: KitBuff[]; triggers?: KitTrigger[]; hits?: { skill: string; hits: (old: readonly KitHit[]) => KitHit[] } }): GameData => ({
  ...data,
  kits: {
    ...data.kits,
    operators: {
      ...data.kits.operators,
      [op]: {
        ...kit,
        stacks: [...kit.stacks, ...["a", "b", "c", "d", "e"].map((id) => ({ id, label: id, max: 999 }))],
        buffs: [...kit.buffs, ...(k.buffs ?? [])],
        triggers: [...kit.triggers, ...(k.triggers ?? [])],
        skills: kit.skills.map((s): KitSkill => (k.hits && s.skillId === L + k.hits.skill ? { ...s, hits: k.hits.hits(s.hits) } : s)),
      },
    },
  },
});
const count = (id: string, on: KitTrigger["on"], stack: string): KitTrigger => ({ id, on, by: "self", do: [{ kind: "gain", gains: [{ stack, amount: 1 }] }] });
const run = (g: GameData, sc: TimelineScenario, frames = 30 * 10): TimelineState => {
  const ctx = createContext(g, sc);
  let s = init(ctx);
  for (const a of sc.rotation) s = apply(ctx, s, a);
  return advance(ctx, s, frames);
};
const draftOf = (operator: string) => JSON.parse(kitDraft(data, operator, new Map()).split("\n\n//")[0] as string) as { skills: { skillId: string; jumps?: unknown[]; note?: string; hits: Record<string, unknown>[] }[] };
const draftSkill = (operator: string, skillId: string) => draftOf(operator).skills.find((s) => s.skillId === skillId);

describe("D1: a jump behind checks in its own sequence is conditional", () => {
  it("Ardelia's talent-2 recast jump (33 → 189, after CheckTimedMarkerCondition, CompareFloat, CheckEntityNum) is conditional", () => {
    const jumps = readSkillFile("chr_0025_ardelia_normal_skill")?.timing.jumps ?? [];
    expect(jumps).toContainEqual({ at: 33, to: 189, conditional: true });
    // The jump's own empty conditionAction alone made it unconditional.
    expect(jumps.filter((j) => !j.conditional)).toEqual([]);
  });
  it("knows the condition actions a sequence stops at", () => {
    for (const t of ["Beyond.Gameplay.Core.Conditions.CheckTimedMarkerCondition+Data, Gameplay.Beyond", "Beyond.Gameplay.Core.CompareFloat+Data, Gameplay.Beyond", "Beyond.Gameplay.Core.NotNextCheckAction+Data, Gameplay.Beyond", "Beyond.Gameplay.Core.Probablity+Data, Gameplay.Beyond"]) expect(isConditionAction(t)).toBe(true);
    for (const t of ["Beyond.Gameplay.Core.JumpToAction+Data, Gameplay.Beyond", "Beyond.Gameplay.Core.FindTargetAction+FindTargetActionData, Gameplay.Beyond", "Beyond.Gameplay.Core.CreateBuffAction+Data, Gameplay.Beyond"]) expect(isConditionAction(t)).toBe(false);
  });
});

describe("D2: SP kinds and sources of the files a skill reaches", () => {
  it("Pogranichnik's ultimate gets its ability entity's harass and Assault SP (natural, skills' source type 3)", () => {
    const s = data.skills["chr_0029_pograni_ultimate_skill"];
    expect(s?.spKinds).toMatchObject({ atb_trigger: "natural", atb_final: "natural" });
    expect(s?.spSources).toMatchObject({ atb_trigger: 3, atb_final: 3 });
  });
  it("a ranged basic attack's SP is its projectile's (natural, basic attacks' type 1)", () => {
    expect(data.skills["chr_0004_pelica_attack1"]?.spKinds).toEqual({ atb: "natural" });
    expect(data.skills["chr_0004_pelica_attack1"]?.spSources).toEqual({ atb: 1 });
  });
  it("keeps the skill's own keys first and follows only helper casts", () => {
    // Wulfgard's battle skill: its plus projectile returns SP; no own grant.
    expect(data.skills["chr_0006_wolfgd_normal_skill"]?.spKinds).toEqual({ returnskillpower: "returned" });
    const all = reachedFiles("chr_0029_pograni_ultimate_skill", () => true).map((f) => f.id);
    expect(all).toContain("chr_0029_pograni_ultimate_skill_abilityentity_attack2");
    // A cast of another of the operator's own skills isn't followed.
    const casts = (id: string, helper: boolean) => reachedFiles(id, () => helper).filter((f) => f.kind === "skill").length;
    expect(casts("chr_0038_purrche_normal_skill", false)).toBeLessThanOrEqual(casts("chr_0038_purrche_normal_skill", true));
  });
});

describe("D3: weapon variants use the kit of a weapon with the same skills", () => {
  it("wpn_sword_0021_ink is Grand Vision's skin", () => {
    expect([...weaponVariants(data.weapons, new Set(["wpn_sword_0021"]))]).toEqual([["wpn_sword_0021_ink", "wpn_sword_0021"]]);
    expect(weaponVariants(data.weapons, new Set(Object.keys(data.kits.equipment))).size).toBe(0);
  });
  it("loads the variant's kit with its own IDs", () => {
    const dir = mkdtempSync(join(tmpdir(), "efsim-kits-"));
    mkdirSync(join(dir, "equipment"));
    const raw = {
      equipment: "wpn_sword_0021",
      sources: ["test"],
      stacks: [{ id: "wpn_sword_0021.n", label: "n", max: 3 }],
      triggers: [{ id: "wpn_sword_0021.t", on: { event: "fightStart" }, by: "self", do: [{ kind: "gain", gains: [{ stack: "wpn_sword_0021.n" }] }] }],
    };
    writeFileSync(join(dir, "equipment", "wpn_sword_0021.json"), JSON.stringify(raw));
    const kits = loadKits(data, dir);
    const ink = kits.equipment["wpn_sword_0021_ink"];
    expect(ink?.stacks.map((s) => s.id)).toEqual(["wpn_sword_0021_ink.n"]);
    expect(ink?.triggers.map((t) => [t.id, t.do])).toEqual([["wpn_sword_0021_ink.t", [{ kind: "gain", gains: [{ stack: "wpn_sword_0021_ink.n", amount: 1 }] }]]]);
    expect(kits.equipment["wpn_sword_0021"]?.stacks.map((s) => s.id)).toEqual(["wpn_sword_0021.n"]);
  });
});

describe("D4: a talent's attached passive skill's buff stats are in the panel", () => {
  const lifeng = (potential: number): Build => ({
    operator: "chr_0015_lifeng", level: 90, promotion: 4, potential, skillLevels: { basic: 12, battle: 12, combo: 12, ultimate: 12 },
    weapon: { id: "wpn_lance_0009", level: 90, skillLevels: [9, 9, 9] }, gear: [],
  });
  const talentValue = (() => {
    const node = (data.operators["chr_0015_lifeng"]?.talentNodes ?? []).filter((n) => n.effects.some((e) => e.kind === "skill" && e.skillId === "chr_0015_lifeng_talent_1")).sort((a, b) => b.level - a.level)[0];
    const e = node?.effects.find((x) => x.kind === "skill");
    return e?.kind === "skill" ? (e.blackboard["atk_up"] as number) : NaN;
  })();
  it("talent 1's ATK per Intellect and Will point (attributes 78, 79) from buff_chr_0015_lifeng_talent_1", () => {
    const p = computeStats(data, lifeng(0));
    expect(talentValue).toBeCloseTo(0.0015, 9);
    expect(p.attrs[Attr.AtkIncreaseFactorFromWisd]?.total).toBeCloseTo(talentValue, 9);
    expect(p.attrs[Attr.AtkIncreaseFactorFromWill]?.total).toBeCloseTo(talentValue, 9);
    // stats.ts reads them as ATK per point of Intellect and Will in the attribute bonus (not ATK%: test 75's variant).
    const base = 1 + p.atk.mainAttribute * data.constants.atkRateOfMain + p.atk.secondaryAttribute * data.constants.atkRateOfSub;
    const points = Math.floor(p.attrs[Attr.Wisd]?.total ?? 0) + Math.floor(p.attrs[Attr.Will]?.total ?? 0);
    expect(points).toBeGreaterThan(200);
    expect(p.atk.attributeBonus).toBeCloseTo(base + talentValue * points, 9);
  });
  it("P3's skillBbModifier on the attached skill raises it by 0.0005", () => {
    const p0 = computeStats(data, lifeng(0));
    const p3 = computeStats(data, lifeng(3));
    expect((p3.attrs[Attr.AtkIncreaseFactorFromWisd]?.total ?? 0) - (p0.attrs[Attr.AtkIncreaseFactorFromWisd]?.total ?? 0)).toBeCloseTo(0.0005, 9);
  });
});

describe("D5: a skill's hit with its own damage type", () => {
  it("is a hit of that kind while the cast and its SP stay the skill's", () => {
    // attack5's two hits as ultimate-type hits; its second hit gives SP.
    const a5 = [`${L}attack5`];
    const triggers = [count("ultHit", { event: "hit", kinds: ["ultimate"], skills: a5 }, "a"), count("basicHit", { event: "hit", kinds: ["basic"], skills: a5 }, "b"), count("basicCast", { event: "cast", kinds: ["basic"], skills: a5 }, "c"), count("basicSp", { event: "sp", kinds: ["basic"] }, "d")];
    const chain = ["attack1", "attack2", "attack3", "attack4", "attack5"].map(act);
    const plain = run(withKit({ triggers }), scenario(chain));
    const s = run(withKit({ hits: { skill: "attack5", hits: (hs) => hs.map((h) => ({ ...h, damageType: "ultimate" })) }, triggers }), scenario(chain));
    expect(plain.stacks[op]).toMatchObject({ a: 0, b: 2, c: 1 });
    expect(s.stacks[op]).toMatchObject({ a: 2, b: 0, c: 1, d: plain.stacks[op]?.["d"] });
    expect(plain.stacks[op]?.["d"]).toBeGreaterThan(0);
    // The hit takes the ultimate's DMG bonus instead of the basic attacks' (Laevatain's kit has a basic-attack buff, not an ultimate one here).
    const dmg = (st: TimelineState) => st.hits.filter((h) => h.skillId === a5[0]).map((h) => h.damage);
    expect(dmg(s)).not.toEqual(dmg(plain));
  });
  it("the loader takes it on a skill hit, but not the skill's own type", () => {
    const dir = mkdtempSync(join(tmpdir(), "efsim-kits-"));
    mkdirSync(join(dir, "operators"));
    const raw = JSON.parse(readFileSync(join(ROOT, "packages/data/kits/operators/chr_0016_laevat.json"), "utf8")) as { skills: { skillId: string; hits: Record<string, unknown>[] }[] };
    const a1 = raw.skills.find((s) => s.skillId === `${L}attack1`) as { hits: Record<string, unknown>[] };
    (a1.hits[0] as Record<string, unknown>)["damageType"] = "none";
    writeFileSync(join(dir, "operators", "chr_0016_laevat.json"), JSON.stringify(raw));
    expect(loadKits(data, dir).operators[op]?.skills.find((s) => s.skillId === `${L}attack1`)?.hits[0]?.damageType).toBe("none");
    (a1.hits[0] as Record<string, unknown>)["damageType"] = "basic";
    writeFileSync(join(dir, "operators", "chr_0016_laevat.json"), JSON.stringify(raw));
    expect(() => loadKits(data, dir)).toThrow(/the skill's own/);
  });
});

describe("D6: poise-only landings", () => {
  const poiseOnly = (frame: number): KitHit => ({ id: "stagger", label: "stagger", scale: [], count: 1, damageType: "basic", element: "physical", events: [], frames: [frame], poise: 10, poiseOnly: true });
  it("deal their Stagger and no damage or hit event", () => {
    const plain = run(withKit({ triggers: [count("hits", { event: "hit" }, "a")] }), scenario([act("attack1")]));
    const g = withKit({ hits: { skill: "attack1", hits: (hs) => [...hs, poiseOnly(2)] }, triggers: [count("hits", { event: "hit" }, "a"), count("stag", { event: "staggered" }, "b")] });
    const s = run(g, scenario([act("attack1")]));
    expect(s.hits.length).toBe(plain.hits.length);
    expect(s.stacks[op]?.["a"]).toBe(plain.stacks[op]?.["a"]);
    expect(s.stagger.poise).toBeLessThan(plain.stagger.poise);
  });
  it("the loader wants a poise and an empty scale, and nothing else", () => {
    const dir = mkdtempSync(join(tmpdir(), "efsim-kits-"));
    mkdirSync(join(dir, "operators"));
    const raw = JSON.parse(readFileSync(join(ROOT, "packages/data/kits/operators/chr_0016_laevat.json"), "utf8")) as { skills: { skillId: string; hits: Record<string, unknown>[] }[] };
    const a1 = raw.skills.find((s) => s.skillId === `${L}attack1`) as { hits: Record<string, unknown>[] };
    // A landing the data doesn't have: marked as the kit's own (else the loader refuses it).
    a1.hits.push({ id: "stagger", scale: [], frames: [2], poise: 10, poiseOnly: true, dataOverride: { frames: "A test's stagger-only landing." } });
    writeFileSync(join(dir, "operators", "chr_0016_laevat.json"), JSON.stringify(raw));
    expect(loadKits(data, dir).operators[op]?.skills.find((s) => s.skillId === `${L}attack1`)?.hits.at(-1)?.poiseOnly).toBe(true);
    a1.hits[a1.hits.length - 1] = { id: "stagger", scale: [], frames: [2], poise: 10, poiseOnly: true, sp: 5 };
    writeFileSync(join(dir, "operators", "chr_0016_laevat.json"), JSON.stringify(raw));
    expect(() => loadKits(data, dir)).toThrow(/deals only its poise \(drop sp\)/);
  });
});

describe("D8a: SP before a hit's damage", () => {
  // A trigger on the hit's SP applies +100% DMG for a second: with spBeforeDamage it counts for that hit.
  const buff: KitBuff = { id: "spBuff", label: "spBuff", target: "self", duration: 1, modifiers: [{ zone: "damageBonus", value: 1 }] };
  const onSp: KitTrigger = { id: "onSp", on: { event: "sp", kinds: ["basic"] }, by: "self", do: [{ kind: "buff", buff: "spBuff" }] };
  const hit2 = (s: TimelineState) => s.hits.find((h) => h.skillId === `${L}attack5` && h.hitId === "hit_2")?.damage ?? 0;
  const chain = ["attack1", "attack2", "attack3", "attack4", "attack5"].map(act);
  it("lets the SP's triggers act on that hit", () => {
    const after = run(withKit({ buffs: [buff], triggers: [onSp] }), scenario(chain));
    const before = run(withKit({ buffs: [buff], triggers: [onSp], hits: { skill: "attack5", hits: (hs) => hs.map((h) => (h.sp !== undefined ? { ...h, spBeforeDamage: true } : h)) } }), scenario(chain));
    expect(hit2(after)).toBeGreaterThan(0);
    expect(hit2(before)).toBeGreaterThan(hit2(after) * 1.2);
  });
});

describe("kit-draft (D5–D10)", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(JSON.parse(readFileSync(join(ROOT, "schemas", "kit.schema.json"), "utf8")) as object);
  const BATCH_4 = ["chr_0009_azrila", "chr_0015_lifeng", "chr_0017_yvonne", "chr_0025_ardelia", "chr_0026_lastrite", "chr_0027_tangtang", "chr_0028_wulfa", "chr_0029_pograni", "chr_0030_zhuangfy", "chr_0031_mifu", "chr_0033_camille"];
  it.each(BATCH_4)("drafts %s in the current kit format", (operator) => {
    const kitJson = draftOf(operator);
    const ok = validate(kitJson);
    expect(ok ? [] : validate.errors).toEqual([]);
  });
  it("D5, D6: World Splitter's hit takes no battle-skill type; its stagger-only DamageActions are poise-only hits", () => {
    const s = draftSkill("chr_0031_mifu", "chr_0031_mifu_normalskill_3");
    const hit = s?.hits.find((h) => (h["frames"] as number[]).includes(26) && !h["poiseOnly"]);
    expect(hit?.["damageType"]).toBe("none");
    expect(s?.hits.filter((h) => h["poiseOnly"]).flatMap((h) => h["frames"] as number[])).toEqual([23, 25]);
  });
  it("D6: a stagger-only DamageAction at a landing's frame folds into its poise", () => {
    // Tangtang's attack5 projectile: the stagger sits behind CheckMainCharacterCondition.
    const s = draftSkill("chr_0027_tangtang", "chr_0027_tangtang_attack5");
    expect(s?.hits.some((h) => h["poise"] !== undefined && h["poiseControlledOnly"] === true && !h["poiseOnly"])).toBe(true);
  });
  it("D7a: NotNextCheckAction negates the next condition", () => {
    // Zhuang Fangyi's ultimate: NotNextCheckAction, CheckMainCharacterCondition (it read "controlled" before).
    const c = compileSkill("chr_0030_zhuangfy_ultimate_skill");
    const labels = new Set([...(c?.landings ?? []), ...(c?.buffs ?? []), ...(c?.effects ?? []), ...(c?.sp ?? []), ...(c?.energy ?? [])].flatMap((x) => x.branch));
    expect(labels.has("if not controlled")).toBe(true);
    expect(labels.has("if controlled")).toBe(false);
  });
  it("D7b: a conditional jump whose condition it can say becomes the skill's jumps", () => {
    expect(draftSkill("chr_0028_wulfa", "chr_0028_wulfa_attack4")?.jumps).toEqual([{ at: 0, to: 189, if: { not: { controlled: true } } }]);
  });
  it("D7d: damage after ExcludeTarget of the target is left out", () => {
    const c = compileSkill("chr_0025_ardelia_combo_skill_bomb");
    expect(c?.notes.some((n) => n.includes("other enemies only"))).toBe(true);
  });
  it("D8b, D8c: SP only while controlled; a literal-0 damage unit is left out", () => {
    const a5 = draftSkill("chr_0015_lifeng", "chr_0015_lifeng_attack5");
    const withSp = a5?.hits.filter((h) => h["sp"] !== undefined) ?? [];
    expect(withSp.length).toBe(1);
    expect(withSp[0]?.["sp"]).toEqual({ if: { controlled: true }, then: "atb" });
    expect(a5?.hits.some((h) => JSON.stringify(h["scale"]).includes("LITERAL_0"))).toBe(false);
  });
  it("D8g: ObtainUspInNormalSkill is the skill's team energy", () => {
    // Rossi's battle skill: ObtainUspInNormalSkill (coefficient 1) on its timeline at 35, no buff_common_obtain_ultimate_sp.
    expect(compileSkill("chr_0028_wulfa_normal_skill")?.teamEnergy.map((t) => [t.frame, t.ratio, t.branch])).toEqual([[35, 1, []]]);
  });
  it("D8d: HealAction gives the hit's heals, or a heal action with no landing", () => {
    // Ember's combo heals the controlled operator (team finder + MainCharacterValidator) at its hit.
    expect(draftSkill("chr_0009_azrila", "chr_0009_azrila_combo_skill")?.hits.find((h) => (h["frames"] as number[]).includes(26))?.["heals"]).toBe("controlled");
    const c = compileSkill("chr_0009_azrila_combo_skill");
    expect(c?.heals.some((h) => h.target === "controlled" && h.healKind === "combo")).toBe(true);
  });
  it("D9a: a TickIntervalAction counts its ticks on unrounded time", () => {
    // Tangtang's dive: 0.267 s of 0.07 s ticks.
    // Tangtang's dive: 0.07 s ticks over frames 3–11 (0.267 s): 4 ticks; the fifth's 0.28 s rounds to frame 11.
    const c = compileSkill("chr_0027_tangtang_plunging_attack_end");
    expect(c?.landings.map((l) => l.frame)).toEqual([3, 5, 7, 9]);
  });
  it("D9c: landings an ability event deals are triggers to write, not hits", () => {
    const s = draftSkill("chr_0026_lastrite", "chr_0026_lastrite_normal_skill");
    expect(s?.note).toContain("event-driven landing (write a trigger: ability event 302");
    expect(s?.hits.some((h) => String(h["note"]).includes("on ability event"))).toBe(false);
  });
  it("D10c: a buff created on the context's target in a buff's start event goes to that buff's holder", () => {
    // Ember's ultimate: the shield (on the team) creates its extra-attack buff on its holder, not on "the enemy hit".
    const c = compileSkill("chr_0009_azrila_ultimate_skill");
    expect(c?.buffs.map((b) => [b.buff, b.target])).toContainEqual(["buff_chr_0009_azrila_ultimate_skill_shield_extraattack", "team"]);
  });
});
