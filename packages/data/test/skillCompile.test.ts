// The SkillData compiler (src/skillCompile.ts) against the data it reads, and
// the loader's use of it: the kits' hand-written frames, counts, keys, factors,
// elements, stagger, energy, inflictions and physical statuses are claims the
// loader checks against it (docs/kit-abstractions.md section 1). Every
// difference is marked in its kit (dataOverride) with the reason; a new one,
// or a mark where nothing differs, fails the load so it gets looked at.

import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileOperatorSkill, compileSkill, formatCompiledValue, loadGameData, loadKits, loadOperatorKitFile, type CompiledLanding, type CompiledSkill } from "../src/index.ts";

const data = loadGameData();
const KITS = join(resolve(dirname(fileURLToPath(import.meta.url)), "../kits/operators"));
const OPERATORS = ["chr_0016_laevat", "chr_0034_typhoea", "chr_0032_lizhiyan", "chr_0036_jsspsi", "chr_0013_aglina", "chr_0035_liino", "chr_0021_whiten", "chr_0023_antal", "chr_0019_karin", "chr_0020_meurs", "chr_0022_bounda", "chr_0003_endminf", "chr_0002_endminm", "chr_0004_pelica", "chr_0018_dapan", "chr_0012_avywen", "chr_0014_aurora", "chr_0007_ikut", "chr_0038_purrche", "chr_0024_deepfin", "chr_0011_seraph", "chr_0005_chen", "chr_0006_wolfgd", "chr_0031_mifu", "chr_0033_camille", "chr_0026_lastrite", "chr_0017_yvonne", "chr_0015_lifeng", "chr_0025_ardelia", "chr_0029_pograni", "chr_0028_wulfa", "chr_0030_zhuangfy", "chr_0009_azrila", "chr_0027_tangtang"];

function compiled(operator: string, skillId: string): CompiledSkill {
  const c = compileOperatorSkill(data, operator, skillId);
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

  it("takes a finisher's share of its scale from BreakingAttackCalculation's multiplier", () => {
    const c = compiled("chr_0016_laevat", "chr_0016_laevat_power_attack");
    expect(c.landings.map((l) => formatCompiledValue(l.scale))).toEqual(["atk_scale × 0.2", "atk_scale × 0.8"]);
  });

  it("reads each landing's element and its DamageAction's stagger", () => {
    // Avywenna is Electric, her basic attacks Physical (damageType 0).
    expect(compiled("chr_0012_avywen", "chr_0012_avywen_attack1").landings.map((l) => [l.damageType, l.element])).toEqual([[0, "physical"]]);
    // Laevatain's Final Strike: poise unit `poise`, onlyEnableForMainChar; the first hit has none.
    const a5 = compiled("chr_0016_laevat", "chr_0016_laevat_attack5");
    expect(a5.landings.map((l) => [l.frame, l.element, l.poise ? formatCompiledValue(l.poise.value) : null, l.poise?.controlledOnly ?? null])).toEqual([
      [23, "fire", null, null],
      [26, "fire", "poise", true],
    ]);
  });

  it("reads a damage unit's crit-rate processor as a bonus", () => {
    const c = compiled("chr_0004_pelica", "chr_0004_pelica_ultimate_skill");
    expect(c.landings.map((l) => l.bonuses.map((b) => [b.zone, formatCompiledValue(b.value)]))).toEqual([[["critRate", "crit"]]]);
  });

  it("finds physical statuses, with or without a landing, and Vulnerable stacks", () => {
    // Da Pan's ultimate: a forced Lift at the cast (no damage there) and a forced Knock Down with the frame-80 hit.
    const ult = compiled("chr_0018_dapan", "chr_0018_dapan_ultimate_skill");
    const phys = ult.effects.filter((e) => e.kind === "physicalStatus");
    expect(phys.map((e) => [e.frame, e.kind === "physicalStatus" ? [e.status, e.forced] : null, e.landing === null ? null : ult.landings[e.landing]?.frame])).toEqual([
      [0, ["lift", true], null],
      [80, ["knockdown", true], 80],
    ]);
    const combo = compiled("chr_0018_dapan", "chr_0018_dapan_combo_skill");
    expect(combo.effects.filter((e) => e.kind === "physicalStatus").map((e) => (e.kind === "physicalStatus" && e.multiplier ? [e.status, formatCompiledValue(e.multiplier)] : null))).toEqual([["crush", "crush_multi"]]);
    // deadOption 2 acts on a dying target only: Perlica's finisher Knock Down isn't applied.
    const pelica = compiled("chr_0004_pelica", "chr_0004_pelica_power_attack");
    expect(pelica.effects.some((e) => e.kind === "physicalStatus")).toBe(false);
    expect(pelica.notes.some((n) => n.includes("KnockDownAction with deadOption 2"))).toBe(true);
    // Catcher's bash: CreateBuff buff_physical_no_guard before its DamageAction.
    const catcher = compiled("chr_0020_meurs", "chr_0020_meurs_normal_skill");
    expect(catcher.effects.filter((e) => e.kind === "vulnerable").map((e) => [e.frame, e.kind === "vulnerable" ? formatCompiledValue(e.stacks) : null])).toEqual([[83, "1"]]);
  });

  it("keeps a created status buff's assigned keys", () => {
    const c = compiled("chr_0004_pelica", "chr_0004_pelica_combo_skill");
    const forced = c.effects.filter((e) => e.kind === "forcedReaction");
    expect(forced.map((e) => (e.kind === "forcedReaction" ? [e.frame, e.status, e.duration && formatCompiledValue(e.duration), Object.keys(e.assigned)] : null))).toEqual([[24, "electrification", "duration", ["extra_scaling"]]]);
  });

  it("expands ExecuteIntervalAction ticks", () => {
    // Purrchena's Handicraft: a pull every 0.5 s over its frames 0–56, then the end hit.
    const c = compileSkill("chr_0038_purrche_combo_skill_abilityrange_1_1");
    expect(c?.landings.map((l) => [l.frame, formatCompiledValue(l.scale)])).toEqual([
      [0, "atk_scale_blackhole_dot"],
      [15, "atk_scale_blackhole_dot"],
      [30, "atk_scale_blackhole_dot"],
      [45, "atk_scale_blackhole_dot"],
      [56, "atk_scale_blackhole_end"],
    ]);
  });

  it("follows an aura's buffInput buffs into their ticks", () => {
    // Snowshine's Snow Zone: entity at 62, aura from its frame 4, buff ticking every 0.5 s for 5 s (waitFirst).
    const c = compiled("chr_0014_aurora", "chr_0014_aurora_ultimate_skill");
    const zone = c.landings.filter((l) => l.file === "buff_chr_0014_aurora_ultimate_skill_dmg" && l.branch.every((b) => !b.startsWith("if not")));
    expect(frames(zone)).toEqual([81, 96, 111, 126, 141, 156, 171, 186, 201, 216]);
    expect(c.buffs.filter((b) => b.buff === "buff_chr_0014_aurora_ultimate_skill_dmg").map((b) => [b.target, b.frame, b.seconds])).toEqual([
      ["aura", 66, 5],
      ["aura", 66, 5],
    ]);
  });

  it("reports the buffs a skill creates and on whom", () => {
    const c = compiled("chr_0012_avywen", "chr_0012_avywen_ultimate_skill");
    expect(c.buffs.map((b) => [b.buff, b.target, b.frame, b.summary])).toEqual([["buff_chr_0012_avywen_ultimate_skill_debuff", "enemy", 51, "susceptibility pulse_vul_rate"]]);
  });

  it("says a talent's or potential's gate as a predicate", () => {
    // A stack check on the buff talent 1 attaches (Avywenna's combo energy).
    const avywen = compileSkill("chr_0012_avywen_combo_skill", { attachedBuffs: new Map([["buff_chr_0012_avywen_talent_0", { talentAtLeast: [0, 1] }]]) });
    expect(avywen?.energy.map((e) => [e.frame, formatCompiledValue(e.value), e.steps.map((s) => s.pred)])).toEqual([[14, "talent0_usp", [{ talentAtLeast: [0, 1] }]]]);
    // A key only talent 2 sets (Wulfgard's talent2 > 0 on the extra shot's SP).
    const wulfgard = compileSkill("chr_0006_wolfgd_normal_skill", { valueGates: new Map([["talent2", { pred: { talentAtLeast: [1, 1] }, min: 1, max: 1 }]]) });
    expect(wulfgard?.sp.map((e) => e.steps.map((s) => s.pred))).toEqual([[null, { talentAtLeast: [1, 1] }]]);
    // The two sides of an IfElse are alternatives of one site.
    const at23 = wulfgard?.landings.filter((l) => l.frame === 23).map((l) => l.steps.map((s) => s.alt));
    expect(at23).toEqual([[0], [1]]);
    expect(new Set(wulfgard?.landings.filter((l) => l.frame === 23).map((l) => l.steps[0]?.site)).size).toBe(1);
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
// The loader against the compiled data (kitMatch.ts matchSkill, kits.ts): a
// kit's hand-written value that differs from the data's is an error unless
// the kit marks it (dataOverride, with the reason), and so is a mark where
// nothing differs.

describe("kits against the compiled SkillData", () => {
  const file = "chr_0016_laevat.json";
  const raw = () => JSON.parse(readFileSync(join(KITS, file), "utf8")) as { skills: { skillId: string; dataOverride?: Record<string, string>; hits: Record<string, unknown>[] }[] };
  const hitOf = (k: ReturnType<typeof raw>, skillId: string, id: string) => k.skills.find((s) => s.skillId === skillId)?.hits.find((h) => h["id"] === id) as Record<string, unknown>;

  it("loads every operator kit, each difference marked", () => {
    expect(Object.keys(data.kits.operators).sort()).toEqual([...OPERATORS].sort());
  });

  it("refuses a hand-written value that isn't the data's", () => {
    const k = raw();
    hitOf(k, "chr_0016_laevat_attack1", "hit")["frames"] = [7];
    expect(() => loadOperatorKitFile(data, file, k)).toThrow(/chr_0016_laevat_attack1\/hit frames: kit \[7\], data \[6\]/);
    const marked = raw();
    Object.assign(hitOf(marked, "chr_0016_laevat_attack1", "hit"), { frames: [7], dataOverride: { frames: "A test of the mark: the kit's frame on purpose." } });
    // The data's landing at 6 is then no hit's: marked too.
    Object.assign(marked.skills.find((x) => x.skillId === "chr_0016_laevat_attack1") ?? {}, { dataOverride: { "lands chr_0016_laevat_attack1": "A test of the mark: the kit's hit is at 7." } });
    expect(loadOperatorKitFile(data, file, marked)[0]?.skills.find((s) => s.skillId === "chr_0016_laevat_attack1")?.hits[0]?.frames).toEqual([7]);
  });

  it("compares a buff's duration with its game buff's CreateBuff", () => {
    const k = JSON.parse(readFileSync(join(KITS, file), "utf8")) as { buffs: Record<string, unknown>[] };
    const twilight = k.buffs.find((b) => b["id"] === "twilight") as Record<string, unknown>;
    twilight["duration"] = 16;
    expect(() => loadOperatorKitFile(data, file, k)).toThrow(/buff twilight \(buff_chr_0016_laevat_ult_end\) duration: kit 16 s, data 15 s/);
    twilight["dataOverride"] = { duration: "A test of the mark: 16 s on purpose." };
    expect(loadOperatorKitFile(data, file, k)[0]?.buffs.find((b) => b.id === "twilight")?.duration).toBe(16);
  });

  it("refuses a mark where nothing differs", () => {
    const k = raw();
    hitOf(k, "chr_0016_laevat_attack1", "hit")["dataOverride"] = { poise: "A test of a stale mark: nothing differs." };
    expect(() => loadOperatorKitFile(data, file, k)).toThrow(/attack1\/hit poise: marked as differing from the data \(dataOverride\), but it agrees/);
  });

  it("matches a cast trigger's hits and actions as its skill's", () => {
    const liino = JSON.parse(readFileSync(join(KITS, "chr_0035_liino.json"), "utf8")) as { triggers: { id: string; do: { kind: string; hits?: Record<string, unknown>[] }[] }[] };
    const finale = liino.triggers.find((t) => t.id === "ult_song")?.do[0]?.hits?.find((h) => h["id"] === "finale") as Record<string, unknown>;
    finale["frames"] = [509];
    expect(() => loadOperatorKitFile(data, "chr_0035_liino.json", liino)).toThrow(/ult_song\/finale frames: kit \[509\], data \[508\]/);
  });

  it("checks an equipment kit's triggered hits against its skill's landings", () => {
    const dir = mkdtempSync(join(tmpdir(), "efsim-kits-"));
    mkdirSync(join(dir, "equipment"));
    const raw = JSON.parse(readFileSync(join(KITS, "../equipment/wpn_lance_0010.json"), "utf8")) as { triggers: { id: string; do: { kind: string; hits?: Record<string, unknown>[] }[] }[] };
    const hit = raw.triggers.find((t) => t.id === "wpn_lance_0010.physical_status_hit")?.do[0]?.hits?.[0] as Record<string, unknown>;
    hit["element"] = "fire";
    writeFileSync(join(dir, "equipment", "wpn_lance_0010.json"), JSON.stringify(raw));
    expect(() => loadKits(data, dir)).toThrow(/trigger wpn_lance_0010.physical_status_hit differs[\s\S]*sk_wpn_lance_0010\/hit element: kit fire, data physical/);
  });

  it("fills in what a kit leaves out where its landings agree", () => {
    const attack2 = data.kits.operators["chr_0016_laevat"]?.skills.find((s) => s.skillId === "chr_0016_laevat_attack2")?.hits[0];
    expect([attack2?.frames, attack2?.count, attack2?.events]).toEqual([[6, 13], 2, ["chr_0016_laevat_attack2"]]);
    const k = raw();
    expect(hitOf(k, "chr_0016_laevat_attack2", "hit")["frames"]).toBeUndefined();
  });
});
