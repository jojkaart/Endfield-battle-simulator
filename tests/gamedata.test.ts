// `efsim gamedata tree / who` (packages/cli/src/gamedata.ts): the compact tree of a raw data file and the reverse
// index of who names a buff.
import { describe, expect, it } from "vitest";
import { atJsonPath, buffCreators, dataTree, eventHandlers, findActions, formatFound, formatHandlers, gamedataTree, parseJsonPath, renderTree, shortType, whoMentions } from "../packages/cli/src/gamedata.ts";
import { deadKitBuffs } from "../packages/cli/src/commands/kit-census.ts";
import { loadGameData } from "@efsim/data";
import type { GameData } from "@efsim/engine";
import { enemyView } from "../packages/cli/src/enemyview.ts";

// Round 19 (the slug report point 1, the Camille report point 5): an enemy's tables and its stage's text; an id with no
// file of its own (an ability entity) answered by the actions that name it.
describe("gamedata enemy and an ability entity's tree", () => {
  const data = loadGameData();
  it("prints Hard 33's stage text (several slugs: 'They are legion') and the log's total in Max HPs", () => {
    const v = enemyView(data, "6339");
    expect(v).toMatch(/^eny_0129_slwood_hdg033 \(Woodcraft Slug\), the enemy of 6339 at level 90$/m);
    expect(v).toMatch(/EnemyTable: template eny_0129_slwood/);
    expect(v).toMatch(/the log's total: \d+ = 9\.600 × Max HP/);
    expect(v).toMatch(/indie_hard033_s "Critters That Dig: Agony" \(level 90/);
    expect(v).toMatch(/description: .*They are legion/);
    expect(v).toMatch(/features: .*Mist/);
    expect(v).toMatch(/with "slwood" in their name: BuffData\/buff_common_mini_poise_break_slwood/);
  });

  it("answers an ability entity's id with its spawn actions and the skill each runs", () => {
    const v = gamedataTree("abilityentity_chr_0033_camille_normal_skill");
    expect(v).toMatch(/no BuffData or SkillData file of that name \(an ability entity/);
    expect(v).toMatch(/SkillData\/chr_0033_camille_normal_skill_projhit {2}SpawnAbilityEntity {2}\[frame 0\] {2}.*abilityEntitySkillId chr_0033_camille_normal_skill_abilityrange_first/);
    expect(v).toMatch(/its skill chr_0033_camille_normal_skill_abilityrange_first: a file of its own/);
    expect(gamedataTree("no_such_id_anywhere")).toMatch(/no file names it either/);
  });
});

describe("the data-file tree", () => {
  const file = {
    id: "buff_x",
    lifeType: 0,
    duration: { useBlackboardKey: true, blackboardKey: "duration", value: 3 },
    iconConfig: { _spritePath: "icon" },
    buffEventAction: [
      {
        buffEvent: 0,
        actions: [{ actionData: [
          { $type: "Beyond.Gameplay.Core.CreateBuffAction+Data, Gameplay.Beyond", buffs: [{ buffId: "buff_y" }], count: { useBlackboardKey: false, blackboardKey: {}, value: 1 } },
          { $type: "Beyond.Gameplay.Core.PlaySoundAction+Data, Gameplay.Beyond", sound: "x" },
          { $type: "Beyond.Gameplay.Core.CompareFloat+Data, Gameplay.Beyond", compare: 3, lhs: 1, isEnable: false },
        ] }],
      },
    ],
  };

  it("names types and enums, reads value fields, marks disabled actions, leaves out presentation and defaults", () => {
    expect(shortType("Beyond.Gameplay.Core.SpeedupAction+Data, Gameplay.Beyond")).toBe("SpeedupAction");
    const text = renderTree(dataTree(file, "buff_x"));
    expect(text).toContain("duration: key duration (default 3)");
    expect(text).toContain("lifeType 0 (timed)");
    expect(text).toContain("buffEvent 0 (on start)");
    expect(text).toContain("CreateBuffAction  count: 1");
    expect(text).toContain("buffId buff_y");
    // A disabled action is said to be one (it does nothing in the game), not left out as a default.
    expect(text).toContain("CompareFloat  DISABLED (isEnable false), compare 3 (>=), lhs 1");
    expect(text).not.toMatch(/PlaySound|iconConfig/);
  });

  it("says a branch holds nothing but presentation instead of dropping it (round 10)", () => {
    const branch = { $type: "Beyond.Gameplay.Core.IfElseAction+Data, Gameplay.Beyond", succeedActions: { actionData: [{ $type: "Beyond.Gameplay.Core.EffectAction+Data, Gameplay.Beyond", x: 1 }, { $type: "Beyond.Gameplay.Core.EffectAction+Data, Gameplay.Beyond", x: 2 }] }, failActions: { actionData: [] } };
    const text = renderTree(dataTree(branch, "[0]"));
    expect(text).toContain("succeedActions › actionData › (presentation only, left out: EffectAction ×2)");
    expect(text).not.toContain("failActions");
  });

  it("prints the subtree at a JSON path as `who` gives it, and names a step that isn't there", () => {
    expect(parseJsonPath(".buffEventAction[0].actions")).toEqual(["buffEventAction", 0, "actions"]);
    expect(() => parseJsonPath("buffEventAction")).toThrow(/not a JSON path/);
    expect(atJsonPath(file, ".buffEventAction[0].buffEvent")).toBe(0);
    expect(() => atJsonPath(file, ".buffEventAction[3]")).toThrow(/nothing at \[3\] after "\.buffEventAction"/);
    expect(gamedataTree("chr_0030_zhuangfy_normal_skill_ult", { path: ".actionGroupData.timelineActions[14]._sequenceActionData.actionData[1]" })).toMatch(/^chr_0030_zhuangfy_normal_skill_ult \(SkillData\) \.actionGroupData\.timelineActions\[14\]\._sequenceActionData\.actionData\[1\] {2}IfElseAction/);
  });

  it("keeps only matching lines and their ancestors with --grep", () => {
    const text = renderTree(dataTree(file, "buff_x"), { grep: /buff_y/ });
    expect(text.split("\n").at(-1)).toContain("buffId buff_y");
    expect(text).not.toContain("CompareFloat");
  });
});

describe("the game's files", () => {
  it("finds who creates Si's Haste (the two ink buffs) and prints its tree", () => {
    const ms = whoMentions("buff_chr_0036_jsspsi_talent1_speedup");
    expect(new Set(ms.map((m) => m.file))).toEqual(new Set(["buff_chr_0036_jsspsi_xianjing_inkboom", "buff_chr_0036_jsspsi_xianjing_linkline"]));
    expect(ms.every((m) => m.action === "CreateBuffAction")).toBe(true);
    expect(gamedataTree("buff_chr_0036_jsspsi_talent1_speedup")).toContain("SpeedupAction");
  });
});

describe("finding actions by type", () => {
  it("lists every action of a type with its fields and context, or counts a field's values", () => {
    const found = findActions({ type: "Speedup", file: "jsspsi" });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((x) => x.file.includes("jsspsi") && x.path.length > 0)).toBe(true);
    expect(formatFound(found)).toMatch(/^\d+ action\(s\) in \d+ file\(s\):\n {2}BuffData\/buff_chr_0036_jsspsi/);
    expect(formatFound(found, { count: "isEnable" })).toMatch(/by isEnable:/);
    expect(gamedataTree("buff_chr_0032_lizhiyan_combo_skill_seal")).toContain("abilityEvent 8 (owner defeated?)");
    // A buff's stacking type with the engine's reading of it (round 16, docs/game-data-format.md "stackingType readings").
    expect(gamedataTree("buff_chr_0032_lizhiyan_combo_skill_seal")).toMatch(/stackingType 0 \(instances add up/);
  });

  // Round 21 (the target-statuses report point 3): an action under a disabled IfElseAction is switched off too.
  it("says an action a disabled parent switches off is off, and --enabled leaves it out", () => {
    const all = findActions({ type: "CreateBuff", file: "lizhiyan_combo_skill_spell_vulnerable" });
    const off = all.filter((x) => x.disabledBy === "IfElseAction");
    expect(off.length).toBeGreaterThan(0);
    expect(formatFound(off)).toMatch(/DISABLED \(by a disabled IfElseAction above it\)/);
    expect(findActions({ type: "CreateBuff", file: "lizhiyan_combo_skill_spell_vulnerable", enabled: true }).some((x) => off.some((y) => y.path === x.path))).toBe(false);
  });
});

describe("gamedata handlers (round 21, the target-statuses report point 3)", () => {
  it("lists every handler of a target's death (abilityEvent 1), Laevatain's passive_enemy live, Arcane's all disabled", () => {
    const hs = eventHandlers("abilityEvent", 1);
    const laev = hs.find((h) => h.file === "buff_chr_0016_laevat_passive_enemy");
    expect(laev?.enabled.get("CreateBuffAction")).toBeGreaterThan(0);
    const arcane = hs.find((h) => h.file === "buff_chr_0032_lizhiyan_combo_skill_spell_vulnerable");
    expect(arcane?.enabled.size).toBe(0);
    expect(formatHandlers("abilityEvent", 1, hs)).toMatch(/buff_chr_0032_lizhiyan_combo_skill_spell_vulnerable {2}ALL DISABLED; switched off: /);
  });
});

describe("kit buffs the data only creates in disabled actions (kit-census; round 17, the Zhuang Fangyi and Liino report point 4)", () => {
  const creators = buffCreators();

  it("finds Liino's linger: its only CreateBuffAction is isEnable false", () => {
    expect(creators.get("buff_chr_0035_liino_atkup_finishtime")).toEqual({ enabled: 0, disabled: ["BuffData/buff_chr_0035_liino_normalskill_buff_atkup"] });
    expect(creators.get("buff_chr_0035_liino_atkup")?.enabled).toBeGreaterThan(0);
    const kit = { kits: { operators: { chr_x: { buffs: [{ id: "linger", gameBuff: "buff_chr_0035_liino_atkup_finishtime" }, { id: "stance", gameBuff: "buff_chr_0035_liino_atkup" }] } }, equipment: {} } } as unknown as GameData;
    expect(deadKitBuffs(kit, creators).map((d) => d.buff)).toEqual(["linger"]);
  });

  it("no kit has one now", () => {
    expect(deadKitBuffs(loadGameData(), creators)).toEqual([]);
  });
});
