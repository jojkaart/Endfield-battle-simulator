// The Finisher's gate on the attack input (in-game test 108; the Talos Wiki's "Stagger" article: the first basic attack
// on a Staggered enemy "that aren't under any active enhancement effects (such as Laevatain's Twilight)" becomes a
// Finisher): no Finisher while the input is an enhanced basic attack (timing.ts enhancedBasic: a basic attack of the
// battle skill's or ultimate's skill group whose kit condition holds), and the enemy takes no Stagger while Staggered.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, apply, canStartAt, createContext, earliestStart, enhancedBasic, holdStagger, init, type Build, type GameData, type OperatorKit, type TimelineScenario } from "@efsim/engine";
import { loadGameData } from "@efsim/data";

const data = loadGameData();
const build = (file: string) => JSON.parse(readFileSync(new URL(`../examples/${file}`, import.meta.url), "utf8")) as Build;
const solo = (b: Build): TimelineScenario => ({
  team: [b],
  target: { enemy: "eny_0051_rodin", level: 90 },
  durationFrames: 30 * 60,
  rotation: [],
  options: { crit: "never" },
  startEnergy: { [b.operator]: "full" },
});

describe("the Finisher's gate: the attack input's state", () => {
  it("the kits' enhanced basic attacks (a basic attack of another skill group) are the four state chains", () => {
    const enhanced: Record<string, string[]> = {};
    for (const [op, kit] of Object.entries(data.kits.operators)) {
      const ids = kit.skills.filter((s) => s.kind === "basic" && data.skills[s.skillId]?.timing?.specification === 1 && data.operators[op]?.skillGroups[s.skillId] !== "basic").map((s) => s.skillId.replace(`${op}_`, ""));
      if (ids.length) enhanced[op] = ids;
      // Each has a kit condition (one without would block every Finisher), and the Finisher itself has none.
      for (const s of kit.skills.filter((x) => ids.includes(x.skillId.replace(`${op}_`, "")))) expect(s.available, s.skillId).toBeDefined();
    }
    expect(enhanced).toEqual({
      chr_0016_laevat: ["ult_attack1", "ult_attack2", "ult_attack3", "ult_attack4"],
      chr_0017_yvonne: ["ult_attack1_1", "ult_attack2_1", "ult_attack2_2", "ult_attack3_1", "ult_attack3_2", "ult_attack_end"],
      chr_0030_zhuangfy: ["attack1_ult", "attack2_ult", "attack3_ult"],
      chr_0034_typhoea: ["floating_attack1", "floating_attack2", "floating_attack3", "floating_attack4", "floating_attack5"],
    });
  });

  // The state's skill, then the enemy Staggered at the first frame the enhanced chain can start: no Finisher there.
  for (const [file, state, head] of [
    ["laevatain-forgeborn.json", "ultimate_skill", "ult_attack1"],
    ["yvonne-p5.json", "ultimate_skill", "ult_attack1_1"],
    ["zhuangfy-p5.json", "ultimate_skill", "attack1_ult"],
    ["typhoeus-p5.json", "normal_skill_floating_start", "floating_attack1"],
  ] as const) {
    const b = build(file);
    const op = b.operator;
    it(`${data.operators[op]?.name}: no Finisher on a Staggered enemy while ${head} is the input; one without the state`, () => {
      const ctx = createContext(data, solo(b));
      const st = apply(ctx, init(ctx), { operator: op, skill: `${op}_${state}` });
      const r = earliestStart(ctx, st, { operator: op, skill: `${op}_${head}` });
      expect(r).toHaveProperty("frame");
      const f = (r as { frame: number }).frame;
      const staggered = holdStagger(advance(ctx, st, f), f, f + 300);
      expect(enhancedBasic(ctx, staggered, op, f)).toBe(`${op}_${head}`);
      const fin = { operator: op, skill: `${op}_power_attack` };
      expect(canStartAt(ctx, staggered, fin, f)).toBe(false);
      // Refused while the state runs (Laevatain, Yvonne, Zhuang Fangyi), or only once it's over (Typhoeus's idle hover
      // ends at frame 89 and her battle skill holds the input until then).
      const later = earliestStart(ctx, staggered, { ...fin, at: f });
      if ("error" in later) expect(later.error).toMatch(/enhanced/);
      else expect(enhancedBasic(ctx, staggered, op, later.frame)).toBeUndefined();
      // Without the state the Finisher starts at once on the Staggered enemy.
      const plain = holdStagger(init(ctx), 0, 300);
      expect(enhancedBasic(ctx, plain, op, 0)).toBeUndefined();
      expect(earliestStart(ctx, plain, { operator: op, skill: `${op}_power_attack` })).toEqual({ frame: 0 });
    });
  }

  it("Yvonne's barrage maps the input to attack5, of her NormalAttack group: not an enhancement, the Finisher stays", () => {
    const yv = data.kits.operators["chr_0017_yvonne"];
    expect(yv?.buffs.find((x) => x.id === "barrage")?.basicAttack).toBe("chr_0017_yvonne_attack5");
    expect(data.operators["chr_0017_yvonne"]?.skillGroups["chr_0017_yvonne_attack5"]).toBe("basic");
  });

  it("while Staggered the enemy takes no Stagger: hits in the window neither break the bar again nor extend the Stagger", () => {
    const b = build("laevatain-forgeborn.json");
    const op = b.operator;
    const kit = data.kits.operators[op] as OperatorKit;
    // attack1 deals 300 Stagger here: Rhodagn's bar is 280, so its first hit (frame 6) breaks it, for 10 s + the 2 s recovery.
    const d: GameData = { ...data, kits: { ...data.kits, operators: { ...data.kits.operators, [op]: { ...kit, skills: kit.skills.map((s) => (s.skillId === `${op}_attack1` ? { ...s, hits: s.hits.map((h) => ({ ...h, poise: 300 })) } : s)) } } } };
    const ctx = createContext(d, solo(b));
    const first = apply(ctx, init(ctx), { operator: op, skill: `${op}_attack1` });
    const broken = advance(ctx, first, 7).stagger;
    expect(broken).toEqual({ poise: 0, until: 6 + 360, finisherUsed: false });
    // attack1 again at 200, its 300 Stagger landing inside the window: the Stagger is as it was.
    const again = apply(ctx, first, { operator: op, skill: `${op}_attack1`, at: 200 });
    expect(again.hits.some((h) => h.skillId === `${op}_attack1` && h.frame > 200) || advance(ctx, again, 220).hits.some((h) => h.skillId === `${op}_attack1` && h.frame > 200)).toBe(true);
    expect(advance(ctx, again, 220).stagger).toEqual(broken);
  });
});
