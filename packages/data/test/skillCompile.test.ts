// The SkillData compiler (src/skillCompile.ts) against the data it reads and
// against the seven batch-1 kits, whose hand-written frames, counts, keys,
// factors, energy and inflictions are claims to check (docs/kit-abstractions.md
// section 3). Every disagreement is listed in KNOWN with a short reason; a
// new one, or one that goes away, fails the test so it gets looked at.

import { describe, expect, it } from "vitest";
import type { KitHit } from "@efsim/engine";
import { compileSkill, formatCompiledValue, loadGameData, prefixOf, type CompiledEffect, type CompiledLanding, type CompiledSkill } from "../src/index.ts";

const data = loadGameData();
const OPERATORS = ["chr_0016_laevat", "chr_0034_typhoea", "chr_0032_lizhiyan", "chr_0036_jsspsi", "chr_0013_aglina", "chr_0035_liino", "chr_0021_whiten"];

function compiled(operator: string, skillId: string): CompiledSkill {
  const top = new Set(Object.keys(data.operators[operator]?.skillGroups ?? {}));
  const values = data.skills[skillId]?.levels.at(-1)?.blackboard;
  const c = compileSkill(skillId, { followCast: (s) => !top.has(s), ...(values ? { values } : {}) });
  if (!c) throw new Error(`no SkillData file for ${skillId}`);
  return c;
}

const frames = (ls: readonly CompiledLanding[]) => ls.map((l) => l.frame).sort((a, b) => a - b);

describe("compileSkill", () => {
  it("returns null for a skill without a file", () => {
    expect(compileSkill("chr_0016_laevat_no_such_skill")).toBeNull();
  });

  it("adds a projectile's launch frame to its hit and names the projectile file as the event key", () => {
    const c = compiled("chr_0016_laevat", "chr_0016_laevat_attack4");
    expect(c.landings.map((l) => [l.frame, l.file, l.detached])).toEqual([
      [6, "chr_0016_laevat_attack4", false],
      [12, "chr_0016_laevat_attack_5_projhit", true],
      [19, "chr_0016_laevat_attack_5_projhit", true],
    ]);
    // The projectile inherits the launcher's blackboard, so its scale is the skill's own key.
    expect(c.landings.every((l) => formatCompiledValue(l.scale) === "atk_scale" && l.scale.origins[0] === "chr_0016_laevat_attack4")).toBe(true);
    expect(c.landings.every((l) => l.kind === "basic")).toBe(true);
  });

  it("adds an ability entity's spawn frame to its own timeline frames", () => {
    const c = compiled("chr_0016_laevat", "chr_0016_laevat_normal_skill");
    const entity = c.landings.filter((l) => l.file === "chr_0016_laevat_normal_skill_abilityentity");
    // Spawned at frame 4; explosion at its frame 18, burn ticks from 25.
    expect(frames(entity)).toEqual([22, 29, 33, 37, 41, 45, 49, 54, 58, 62, 66]);
    expect(c.teamEnergy.filter((t) => t.branch.length === 0).map((t) => t.frame)).toEqual([22]);
    expect(c.jumps.map((j) => [j.frame, j.destFrame])).toEqual([[30, 80], [37, 215], [214, 231]]);
  });

  it("follows a buff's trigger interval: Laevatain's combo lands 0.7 s after its start buff", () => {
    const c = compiled("chr_0016_laevat", "chr_0016_laevat_combo_skill");
    expect(c.landings.map((l) => [l.frame, l.file, l.kind])).toEqual([[41, "buff_chr_0016_laevat_combo_skill_hit", "combo"]]);
  });

  it("reads SimpleCalcBB factors applied before a projectile is launched", () => {
    const c = compiled("chr_0034_typhoea", "chr_0034_typhoea_attack4");
    expect(c.landings.map((l) => [l.frame, formatCompiledValue(l.scale)])).toEqual([
      [5, "atk_scale × 0.35"],
      [15, "atk_scale × 0.13"],
      [18, "atk_scale × 0.13"],
      [21, "atk_scale × 0.13"],
      [24, "atk_scale × 0.13"],
      [27, "atk_scale × 0.13"],
    ]);
  });

  it("keeps a product of keys as the scale", () => {
    const c = compiled("chr_0016_laevat", "chr_0016_laevat_ult_attack1");
    expect(c.landings.map((l) => [...l.scale.keys])).toEqual([["atk_scale", "ratio"]]);
  });

  it("reads Final Strike per landing", () => {
    const c = compiled("chr_0016_laevat", "chr_0016_laevat_attack5");
    expect(c.landings.map((l) => [l.frame, l.finalStrike])).toEqual([
      [23, false],
      [26, true],
    ]);
  });

  it("finds inflictions, forced reactions and partial consumption next to the damage", () => {
    const gilberta = compiled("chr_0013_aglina", "chr_0013_aglina_normal_skill");
    const inf = gilberta.effects.filter((e) => e.kind === "infliction");
    expect(inf.map((e) => [e.frame, "element" in e ? e.element : null, e.landing === null ? null : gilberta.landings[e.landing]?.frame])).toEqual([[108, "natural", 108]]);
    const liino = compiled("chr_0035_liino", "chr_0035_liino_ultimate_skill");
    expect(liino.effects.filter((e) => e.kind === "forcedReaction").map((e) => [e.frame, "status" in e ? e.status : null])).toEqual([[116, "electrification"]]);
    const typhoeus = compiled("chr_0034_typhoea", "chr_0034_typhoea_floating_attack5");
    const consume = typhoeus.effects.filter((e) => e.kind === "consumeInfliction");
    expect(consume.length).toBeGreaterThan(0);
    expect(consume.every((e) => "layers" in e && e.layers !== null && e.layers.value === 1 && e.element === "natural")).toBe(true);
  });

  it("finds ultimate energy and SP grants with their frames", () => {
    const c = compiled("chr_0035_liino", "chr_0035_liino_combo_skill");
    expect(c.energy.map((e) => [e.frame, formatCompiledValue(e.value), e.landing])).toEqual([[33, "usp", 1]]);
    const a = compiled("chr_0016_laevat", "chr_0016_laevat_attack2");
    expect(a.sp.map((e) => [e.frame, formatCompiledValue(e.value), e.coefficient])).toEqual([
      [6, "atb", 0.5],
      [13, "atb", 0.5],
    ]);
  });

  it("finds energy blocks in the skill and in buffs it creates", () => {
    const laevat = compiled("chr_0016_laevat", "chr_0016_laevat_ultimate_skill");
    expect(laevat.energyBlocks.map((b) => [b.buff, b.frame, b.until])).toEqual([["buff_chr_0016_laevat_show_weapon", 0, 480]]);
    const arcane = compiled("chr_0032_lizhiyan", "chr_0032_lizhiyan_ultimate_skill");
    expect(arcane.energyBlocks.filter((b) => b.branch.length === 0).map((b) => [b.buff, b.frame, b.until])).toEqual([
      [null, 0, 47],
      ["buff_chr_0032_lizhiyan_ultimate_skill_listener_owner", 47, 647],
    ]);
  });

  it("keeps undecided branches as alternatives", () => {
    const c = compiled("chr_0032_lizhiyan", "chr_0032_lizhiyan_ultimate_skill2");
    expect(c.landings.map((l) => [formatCompiledValue(l.scale), l.branch.join(" / ")])).toEqual([
      ["atk_scale_will", "if $EntityBB_wisd_greater_will = 0"],
      ["atk_scale", "if not $EntityBB_wisd_greater_will = 0"],
    ]);
  });
});

// ---------------------------------------------------------------------------
// The kits' hand-written values against the compiled ones.

const round = (n: number, d = 6) => Math.round(n * 10 ** d) / 10 ** d;
const keysText = (ls: readonly CompiledLanding[]) => [...new Set(ls.map((l) => (l.scale.expr ? l.scale.expr : [...l.scale.keys].sort().join(" × "))))].join(" | ");

/** The undecided-branch paths through a skill: each distinct branch of a landing, with the landings on it (those whose branch encloses it). */
function paths(ls: readonly CompiledLanding[]): CompiledLanding[][] {
  const branches = [...new Map(ls.map((l) => [JSON.stringify(l.branch), l.branch])).values()];
  return branches.map((b) => ls.filter((l) => prefixOf(l.branch, b)));
}

/** Whether every kit frame (a multiset) is among the path's frames. */
function covers(path: readonly CompiledLanding[], want: readonly number[]): boolean {
  const have = new Map<number, number>();
  for (const l of path) have.set(l.frame, (have.get(l.frame) ?? 0) + 1);
  for (const f of want) {
    const n = have.get(f) ?? 0;
    if (n === 0) return false;
    have.set(f, n - 1);
  }
  return true;
}

type KitApplication = NonNullable<KitHit["applies"]>[number];
const kitAppText = (a: KitApplication) => (a.kind === "infliction" ? `infliction ${a.element}` : a.kind === "forcedReaction" ? `forced ${a.status}` : a.kind === "consumeInfliction" ? `consume ${(a.elements ?? []).join("+")}` : null);
const dataAppText = (e: CompiledEffect) => (e.kind === "infliction" ? `infliction ${e.element}` : e.kind === "forcedReaction" ? `forced ${e.status ?? "?"}` : e.kind === "consumeInfliction" ? `consume ${e.element ?? "?"}` : null);
const valueText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
/** The first two undecided conditions on the way, for a readable line. */
const branchText = (b: readonly string[] | undefined) => (b?.length ? ` (${b.slice(0, 2).join(", ")}${b.length > 2 ? ", …" : ""})` : "");

/**
 * Each kit hit is matched to the compiled landings scaled by its first key
 * (and logged under one of its events); its frames must be on one branch path.
 * Energy goes by frame, applications by frame across the skill's hits.
 */
function kitDisagreements(): string[] {
  const out: string[] = [];
  for (const op of OPERATORS) {
    const kit = data.kits.operators[op];
    if (!kit) throw new Error(`no kit for ${op}`);
    for (const s of kit.skills) {
      const c = compiled(op, s.skillId);
      const where = s.skillId;
      const blocks = c.energyBlocks.filter((b) => b.branch.length === 0 && b.until !== null);
      const block = blocks.length ? round(Math.max(...blocks.map((b) => b.until as number)) / 30, 3) : null;
      // The kit's block: the skill's energyBlockSeconds, or an energy-blocking buff its own cast trigger applies (Laevatain's show_weapon).
      const castBuffs = kit.triggers.filter((t) => t.on.event === "cast" && "skills" in t.on && t.on.skills?.includes(s.skillId)).flatMap((t) => t.do.flatMap((a) => (a.kind === "buff" ? [a.buff] : [])));
      const blockBuff = kit.buffs.find((b) => b.blocksEnergy && castBuffs.includes(b.id) && typeof b.duration === "number");
      const kitBlock = s.energyBlockSeconds !== undefined ? round(s.energyBlockSeconds, 3) : blockBuff ? round(blockBuff.duration as number, 3) : null;
      if (block !== kitBlock) out.push(`${where} energyBlockSeconds: kit ${kitBlock ?? "-"}, data ${block ?? "-"}`);
      const team = c.teamEnergy.filter((t) => t.branch.length === 0).map((t) => t.frame);
      const teamFrame = team.length ? Math.min(...team) : 0;
      if (teamFrame !== (s.teamEnergyFrame ?? 0)) out.push(`${where} teamEnergyFrame: kit ${s.teamEnergyFrame ?? "-"}, data ${teamFrame}`);
      const claimed = new Set<CompiledLanding>();
      const kitApps = new Map<number, Set<string>>();
      for (const h of s.hits) {
        const tag = `${where}/${h.id}`;
        for (const f of h.frames ?? []) for (const a of h.applies ?? []) {
          const t = kitAppText(a);
          if (t) kitApps.set(f, new Set([...(kitApps.get(f) ?? []), t]));
        }
        if (h.energy !== undefined) {
          const dataE = c.energy.filter((e) => (h.frames ?? []).includes(e.frame)).map((e) => formatCompiledValue(e.value));
          if (!dataE.includes(valueText(h.energy))) out.push(`${tag} energy: kit ${valueText(h.energy)} at [${(h.frames ?? []).join(", ")}], data ${c.energy.map((e) => `${formatCompiledValue(e.value)}@${e.frame}${branchText(e.branch)}`).join(", ") || "none"}`);
        }
        if (h.reaction) {
          // Damage computed as a reaction: the data creates the reaction's buff (no DamageAction of its own).
          const found = c.effects.filter((e) => (e.kind === "burst" || e.kind === "forcedReaction") && (h.frames ?? []).includes(e.frame));
          if (!found.length) out.push(`${tag}: kit ${h.reaction.kind} at [${(h.frames ?? []).join(", ")}], data none there (${c.effects.filter((e) => e.kind === "burst").map((e) => e.frame).join(", ") || "no bursts"})`);
          continue;
        }
        const key = h.scale[0] as string;
        const byKey = c.landings.filter((l) => l.scale.keys.includes(key) || (l.scale.expr ?? "").includes(key));
        if (byKey.length === 0) {
          out.push(`${tag}: no landing scaled by ${key} (data: ${keysText(c.landings) || "no landings"})`);
          continue;
        }
        const byEvent = h.events.length ? byKey.filter((l) => h.events.includes(l.file)) : byKey;
        if (byEvent.length === 0) out.push(`${tag} events: kit [${h.events.join(", ")}], data [${[...new Set(byKey.map((l) => l.file))].join(", ")}]`);
        const cand = byEvent.length ? byEvent : byKey;
        const kitKeys = [...h.scale].sort().join(" × ");
        if (!cand.some((l) => !l.scale.expr && [...l.scale.keys].sort().join(" × ") === kitKeys)) out.push(`${tag} scale: kit ${h.scale.join(" × ")}, data ${keysText(cand)}`);
        const kitFactor = round(h.factor ?? 1);
        const factors = [...new Set(cand.map((l) => round(l.scale.factor)))];
        if (!factors.includes(kitFactor)) out.push(`${tag} factor: kit ${kitFactor}, data ${factors.join(" | ")}`);
        const all = paths(cand);
        const want = h.frames ?? [];
        const path = all.find((p) => covers(p, want));
        const best = path ?? [...all].sort((a, b) => b.length - a.length)[0] ?? [];
        if (!h.frames) out.push(`${tag} frames: kit none (count ${h.count}), data [${frames(best).join(", ")}]${branchText(best[0]?.branch)}`);
        else if (!path) out.push(`${tag} frames: kit [${want.join(", ")}], data [${frames(best).join(", ")}]${branchText(best[0]?.branch)}`);
        const at = (best.length ? best : cand).filter((l) => !h.frames || h.frames.includes(l.frame));
        for (const l of at) claimed.add(l);
        if (h.frames && path && at.length > h.count) out.push(`${tag} count: kit ${h.count}, data ${at.length} landings at its frames (${[...new Set(at.map((l) => l.file))].join(", ")})`);
        const fs = at.map((l) => l.finalStrike);
        if (h.finalStrike && fs.includes(false)) out.push(`${tag} finalStrike: kit all ${h.count} landings, data only at [${at.filter((l) => l.finalStrike).map((l) => l.frame).join(", ")}]`);
        if (!h.finalStrike && fs.includes(true)) out.push(`${tag} finalStrike: kit none, data at [${at.filter((l) => l.finalStrike).map((l) => l.frame).join(", ")}]`);
      }
      // Applications by frame: what the kit applies must be in the data there; what the data applies unconditionally must be in the kit.
      const dataFrames = new Set([...kitApps.keys(), ...c.effects.filter((e) => e.branch.length === 0 && dataAppText(e)).map((e) => e.frame)]);
      for (const f of [...dataFrames].sort((a, b) => a - b)) {
        const kitSet = kitApps.get(f) ?? new Set<string>();
        const here = c.effects.filter((e) => e.frame === f && dataAppText(e));
        const any = new Set(here.map((e) => dataAppText(e) as string));
        const always = new Set(here.filter((e) => e.branch.length === 0).map((e) => dataAppText(e) as string));
        const onlyKit = [...kitSet].filter((x) => !any.has(x));
        const onlyData = [...always].filter((x) => !kitSet.has(x));
        const cond = [...any].filter((x) => !always.has(x) && !kitSet.has(x));
        if (onlyKit.length || onlyData.length || cond.length) out.push(`${where} applies at ${f}: kit [${[...kitSet].join(", ")}], data [${[...always].join(", ")}]${cond.length ? `, conditionally [${cond.join(", ")}]` : ""}`);
      }
      // Landings no kit hit accounts for: unconditional ones, and ones on the branch of a landing a kit hit has.
      const onPath = (l: CompiledLanding) => l.branch.length === 0 || [...claimed].some((x) => JSON.stringify(x.branch) === JSON.stringify(l.branch));
      const missed = c.landings.filter((l) => !claimed.has(l) && onPath(l));
      const byFile = new Map<string, CompiledLanding[]>();
      for (const l of missed) byFile.set(`${l.file} ${keysText([l])}`, [...(byFile.get(`${l.file} ${keysText([l])}`) ?? []), l]);
      for (const [k, ls] of byFile) out.push(`${where}: data lands ${k} at [${frames(ls).join(", ")}], no kit hit`);
    }
  }
  return out;
}

/** Every disagreement found, with what the data says (rmxlinux Json/SkillData and BuffData). */
const KNOWN: string[] = [
  // ModifyDynamicBlackboard atk_scale_3 ×= ratio at frame 104; extra_scaling only goes to the forced Combustion buff. Open question in batch-1 (in-game test 20).
  "chr_0016_laevat_normal_skill/empowered_extra scale: kit atk_scale_3 × extra_scaling, data atk_scale_3 × ratio",
  // Only atk_scale_3 is multiplied by ratio (frame 98); the hits at 13 and 23 use atk_scale and atk_scale_2 as they are. The kit's ratio on them comes from Zero Sanity's table (in-game test 20).
  "chr_0016_laevat_normal_skill_during_ult/hit1 scale: kit atk_scale × ratio, data atk_scale",
  "chr_0016_laevat_normal_skill_during_ult/hit2 scale: kit atk_scale_2 × ratio, data atk_scale_2",
  // buff_chr_0016_laevat_combo_skill_usp (at 41) grants usp_1…usp_4 by a Switch on a saved stack count; its usp_1 (25) equals the skill's usp_1_display (the buff's keys aren't the skill's).
  "chr_0016_laevat_combo_skill/hit energy: kit usp_1_display at [41], data usp_1@41 (switch SaveBuffStackNumAdvanced→count = 0), usp_2@41 (switch SaveBuffStackNumAdvanced→count = 1), usp_3@41 (switch SaveBuffStackNumAdvanced→count = 2), usp_4@41 (switch SaveBuffStackNumAdvanced→count = 3)",
  // Compiler limitation (D2), kit right: BreakingAttackCalculation's multiplier (0.2 / 0.8 of atk_scale) isn't compiled.
  "chr_0016_laevat_power_attack/hit factor: kit 0.2, data 1",
  "chr_0016_laevat_power_attack/hit_2 factor: kit 0.8, data 1",
  // Compiler limitation, kit right: each of the three arrows' projhit deals damage only while buff attack_3_1/3_2_damagetaken is absent and then creates it, so one enemy takes one arrow; the compiler doesn't track buffs it creates.
  "chr_0034_typhoea_attack3/wave1 count: kit 1, data 3 landings at its frames (chr_0034_typhoea_attack3_01_projhit)",
  "chr_0034_typhoea_attack3/wave2 count: kit 1, data 3 landings at its frames (chr_0034_typhoea_attack3_02_projhit)",
  // Timeline sections reached through JumpToAction (destinations 45/75/105/135; 150/300/450/600 in attack4): jumps are reported, not followed, so every section is listed. Which one a cast plays depends on the jump conditions; the kit has the first.
  "chr_0034_typhoea_floating_attack1: data lands chr_0034_typhoea_floating_attack1_01_projhit atk_scale_base × atk_scale_enhence at [46, 76, 106, 136], no kit hit",
  "chr_0034_typhoea_floating_attack2: data lands chr_0034_typhoea_floating_attack1_01_projhit atk_scale_base × atk_scale_enhence at [46, 76, 106, 136], no kit hit",
  "chr_0034_typhoea_floating_attack3: data lands chr_0034_typhoea_floating_attack1_01_projhit atk_scale_base × atk_scale_enhence at [46, 76, 106, 136], no kit hit",
  "chr_0034_typhoea_floating_attack4: data lands chr_0034_typhoea_floating_attack1_01_projhit atk_scale_base × atk_scale_enhence at [151, 301, 451, 601], no kit hit",
  // SpawnAbilityEntity at 61 → chr_0034_typhoea_ultimate_skill_arrowrain, whose DamageAction is at its frame 1: 62. The kit's hit has no events, so the landing also shows as unclaimed below.
  "chr_0034_typhoea_ultimate_skillfloating/main frames: kit [61], data [62]",
  // Event-driven: buff cause_subarrowrain reacts to ability event 302 (each rain's damage tag), sub2 on the 5th; the compiler has no time for events, the kit no frames.
  "chr_0034_typhoea_ultimate_skillfloating/sub_rain frames: kit none (count 12), data [67, 70, 73] (on ability event 302, if damage tag(tag 1208750764|tag 959424907), …)",
  "chr_0034_typhoea_ultimate_skillfloating/final_rain_tick frames: kit none (count 5), data [67, 69, 71, 72, 74, 91] (on ability event 302, if damage tag(tag 1208750764|tag 959424907), …)",
  "chr_0034_typhoea_ultimate_skillfloating/final_rain_blast frames: kit none (count 1), data [67, 69, 71, 72, 74, 91] (on ability event 302, if damage tag(tag 1208750764|tag 959424907), …)",
  "chr_0034_typhoea_ultimate_skillfloating: data lands chr_0034_typhoea_ultimate_skill_arrowrain atk_scale_main × potential_damge_up at [62], no kit hit",
  // CreateBuff buff_common_obtain_ultimate_sp in normal_skill_abilityrange2 at 20; the kit gives the team energy at the cast.
  "chr_0032_lizhiyan_normal_skill teamEnergyFrame: kit -, data 20",
  // Event-driven: the explosion and lasers come from listener buffs' ability events (8, 101, 204) and CastSkill helpers; compiled frames are only the listeners' creation frames. The kit's frames come from logs. Also SpawnAbilityEntity at 9 names chr_032_lizhiyan_combo_skill_abilityentity_seal (game typo "chr_032"), which tables.json's chr_0032_lizhiyan* glob doesn't cover.
  "chr_0032_lizhiyan_combo_skill/explosion_will frames: kit [222], data [0, 9] (on ability event 8, if CheckTimedMarkerCondition(id=lizhiyan_combo_end_not_finish), …)",
  "chr_0032_lizhiyan_combo_skill/explosion_int frames: kit [36], data [14, 23] (on ability event 8, if CheckTimedMarkerCondition(id=lizhiyan_combo_hit))",
  "chr_0032_lizhiyan_combo_skill/laser_int frames: kit [79, 82, 85, 88], data [54, 57, 60, 63] (on ability event 204, if buff in context(buff_chr_0032_lizhiyan_combo_skill_seal|buff_chr_0032_lizhiyan_combo_skill_seal_bunshin_end_listener), …)",
  "chr_0032_lizhiyan_combo_skill/laser_int_final frames: kit [94], data [69] (on ability event 204, if buff in context(buff_chr_0032_lizhiyan_combo_skill_seal|buff_chr_0032_lizhiyan_combo_skill_seal_bunshin_end_listener), …)",
  // Under WILL (EntityBB_wisd_greater_will < 1) the ultimate inflicts the enemy's current element (stack checks natural → cryst → pulse → fire); the kit's array_will has none (A1 `element: enemy` exists; kits phase).
  "chr_0032_lizhiyan_ultimate_skill applies at 47: kit [forced corrosion], data [], conditionally [infliction natural, infliction cryst, infliction pulse, infliction fire]",
  // Finisher (BreakingAttackCalculation, mask 132): four DamageActions at 3, 12, 21, 37; the kit has one at 37.
  "chr_0036_jsspsi_power_attack: data lands chr_0036_jsspsi_power_attack atk_scale at [3, 12, 21], no kit hit",
  // Heat when SaveCharTypeIdToIntBySquadSlot (team slot 1's element) = 0, else Cryo; the kit always applies Cryo (batch-1 kit errors).
  "chr_0036_jsspsi_normal_skill applies at 15: kit [infliction cryst], data [], conditionally [infliction fire]",
  // The finisher's scale is atk_scale2 + (EntityBB_combo_count, +1 with P5) × atk_scale2_1 (SimpleCalcBB); the kit splits it into three hits as a lower bound.
  "chr_0036_jsspsi_combo_skill/final_base scale: kit atk_scale2, data ((($EntityBB_combo_count + 1) × atk_scale2_1) + atk_scale2) | (($EntityBB_combo_count × atk_scale2_1) + atk_scale2)",
  "chr_0036_jsspsi_combo_skill/final_stack scale: kit atk_scale2_1, data ((($EntityBB_combo_count + 1) × atk_scale2_1) + atk_scale2) | (($EntityBB_combo_count × atk_scale2_1) + atk_scale2)",
  "chr_0036_jsspsi_combo_skill/final_p5 scale: kit atk_scale2_1 × potential5, data ((($EntityBB_combo_count + 1) × atk_scale2_1) + atk_scale2) | (($EntityBB_combo_count × atk_scale2_1) + atk_scale2)",
  // CreateBuff buff_common_obtain_ultimate_sp at 29; the kit gives the team energy at the cast.
  "chr_0013_aglina_normal_skill teamEnergyFrame: kit -, data 29",
  // CreateBuff buff_common_obtain_ultimate_sp at 15; the kit gives the team energy at the cast.
  "chr_0035_liino_normal_skill teamEnergyFrame: kit -, data 15",
  // Launched by buff normalskill_music_animation_hitl (created at 45) from its frames 24–33; the kit uses the buff's creation frame. Log bdf223db8e49: first projhit_02 at 1485 ms, followup at 3231 ms (52 frames; data 57, kit 33).
  "chr_0035_liino_normal_skill/followup frames: kit [45, 45, 45, 45, 45, 45], data [69, 70, 73, 74, 77, 78, 369, 370, 373, 374, 377, 378] (if CheckDistanceCondition(distance=20), if CheckTimedMarkerCondition(id=liino_normalskill_hit))",
  // buff ultskill_music_damage (created at 77) lasts ultmusic_duration (15 s at every level) and triggers every ultmusic_trigger (1.5 s): 11 beats 77–527, kit 9 to 437. Each beat launches two projectiles (soundwave, soundwave_heal) into the same projhit, whose damage is gated to non-character targets; which one hits the enemy isn't decided.
  "chr_0035_liino_ultimate_skill/beats count: kit 9, data 18 landings at its frames (chr_0035_liino_ultimate_skill_soundwave_projhit)",
  "chr_0035_liino_ultimate_skill: data lands chr_0035_liino_ultimate_skill_soundwave_projhit atk_scale_3 at [482, 482, 527, 527], no kit hit",
];

describe("batch-1 kits against the compiled SkillData", () => {
  it("disagree only where known", () => {
    expect(kitDisagreements()).toEqual(KNOWN);
  });
});
