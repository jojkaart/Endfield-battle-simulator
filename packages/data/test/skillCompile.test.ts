// The SkillData compiler (src/skillCompile.ts) against the data it reads and
// against the kits in OPERATORS (batch 1, and batch 2 as they come), whose hand-written frames, counts, keys,
// factors, elements, stagger, energy, inflictions and physical statuses are claims to check (docs/kit-abstractions.md
// section 3). Every disagreement is listed in KNOWN with a short reason; a
// new one, or one that goes away, fails the test so it gets looked at.

import { describe, expect, it } from "vitest";
import type { KitHit } from "@efsim/engine";
import { compileSkill, formatCompiledValue, loadGameData, prefixOf, type CompiledEffect, type CompiledLanding, type CompiledSkill, type CompiledValue } from "../src/index.ts";

const data = loadGameData();
const OPERATORS = ["chr_0016_laevat", "chr_0034_typhoea", "chr_0032_lizhiyan", "chr_0036_jsspsi", "chr_0013_aglina", "chr_0035_liino", "chr_0021_whiten", "chr_0023_antal", "chr_0019_karin", "chr_0020_meurs", "chr_0022_bounda", "chr_0003_endminf", "chr_0002_endminm", "chr_0018_dapan"];

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
const physicalText = (status: string, forced: boolean | undefined) => `${status === "event" ? "physical event" : status}${forced ? " (forced)" : ""}`;
const kitAppText = (a: KitApplication) =>
  a.kind === "infliction" ? `infliction ${a.element}` : a.kind === "forcedReaction" ? `forced ${a.status}` : a.kind === "consumeInfliction" ? `consume ${(a.elements ?? []).join("+")}` : a.kind === "physicalStatus" ? physicalText(a.status, a.forced) : a.kind === "vulnerable" ? "vulnerable" : null;
const dataAppText = (e: CompiledEffect) =>
  e.kind === "infliction" ? `infliction ${e.element}` : e.kind === "forcedReaction" ? `forced ${e.status ?? "?"}` : e.kind === "consumeInfliction" ? `consume ${e.element ?? "?"}` : e.kind === "physicalStatus" ? physicalText(e.status, e.forced) : e.kind === "vulnerable" ? "vulnerable" : null;
/** A compiled value as kit-draft writes it (a key, {product: [keys…, factor]}, a literal), for comparing with a kit's ValueExpr. */
function asKitValue(v: CompiledValue): unknown {
  if (v.expr) return v.expr;
  if (v.keys.length === 0) return v.value === null ? null : round(v.value);
  const terms: unknown[] = [...v.keys, ...(round(v.factor) === 1 ? [] : [round(v.factor)])];
  return terms.length === 1 ? terms[0] : { product: terms };
}
/** A kit ValueExpr with its literals rounded as asKitValue rounds them. */
const roundedValue = (v: unknown): unknown => (typeof v === "number" ? round(v) : Array.isArray(v) ? v.map(roundedValue) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, roundedValue(x)])) : v);
const valueText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
/** The first plain value key a ValueExpr names (a string anywhere in it), if any. */
function firstValueKey(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(firstValueKey).find((k) => k !== undefined);
  if (v && typeof v === "object") return Object.values(v).map(firstValueKey).find((k) => k !== undefined);
  return undefined;
}
/** A grant the kit gives only in a situation (`{if, then}`, no `else`): its value, which the data has on a branch of its own. */
const grantText = (v: unknown) => (v !== null && typeof v === "object" && "then" in v && !("else" in v) ? valueText(v.then) : valueText(v));
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
      // Team energy parts as kit-draft reads them: unconditional ones, the first alone when they add up to more than the whole; all at the cast when none.
      let team = c.teamEnergy.filter((t) => t.branch.length === 0).map((t) => ({ frame: t.frame, ratio: t.ratio ?? 1 }));
      if (team.reduce((x, t) => x + t.ratio, 0) > 1 + 1e-9) team = team.slice(0, 1).map((t) => ({ ...t, ratio: 1 }));
      const partsText = (parts: readonly { frame: number; ratio: number }[]) => (parts.length ? parts : [{ frame: 0, ratio: 1 }]).map((t) => `${t.ratio}@${t.frame}`).join(", ");
      if (partsText(team) !== partsText(s.teamEnergy ?? [])) out.push(`${where} teamEnergy: kit ${partsText(s.teamEnergy ?? [])}, data ${partsText(team)}`);
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
          if (!dataE.includes(grantText(h.energy))) out.push(`${tag} energy: kit ${valueText(h.energy)} at [${(h.frames ?? []).join(", ")}], data ${c.energy.map((e) => `${formatCompiledValue(e.value)}@${e.frame}${branchText(e.branch)}`).join(", ") || "none"}`);
        }
        if (h.reaction) {
          // Damage computed as a reaction: the data creates the reaction's buff (no DamageAction of its own).
          const found = c.effects.filter((e) => (e.kind === "burst" || e.kind === "forcedReaction") && (h.frames ?? []).includes(e.frame));
          if (!found.length) out.push(`${tag}: kit ${h.reaction.kind} at [${(h.frames ?? []).join(", ")}], data none there (${c.effects.filter((e) => e.kind === "burst").map((e) => e.frame).join(", ") || "no bursts"})`);
          continue;
        }
        // A hit whose multiplier is all scaleValue (Si's combo final hit) is matched by the first value key it names.
        const key = (h.scale[0] ?? firstValueKey(h.scaleValue)) as string;
        const byKey = c.landings.filter((l) => l.scale.keys.includes(key) || (l.scale.expr ?? "").includes(key));
        if (byKey.length === 0) {
          out.push(`${tag}: no landing scaled by ${key} (data: ${keysText(c.landings) || "no landings"})`);
          continue;
        }
        const byEvent = h.events.length ? byKey.filter((l) => h.events.includes(l.file)) : byKey;
        if (byEvent.length === 0) out.push(`${tag} events: kit [${h.events.join(", ")}], data [${[...new Set(byKey.map((l) => l.file))].join(", ")}]`);
        const cand = byEvent.length ? byEvent : byKey;
        const kitKeys = [...h.scale].sort().join(" × ");
        if (!cand.some((l) => !l.scale.expr && [...l.scale.keys].sort().join(" × ") === kitKeys)) out.push(`${tag} scale: kit ${[...h.scale, ...(h.scaleValue !== undefined ? [valueText(h.scaleValue)] : [])].join(" × ")}, data ${keysText(cand)}`);
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
        if (h.frames && path && typeof h.count === "number" && at.length > h.count) out.push(`${tag} count: kit ${h.count}, data ${at.length} landings at its frames (${[...new Set(at.map((l) => l.file))].join(", ")})`);
        // Element and stagger of the landings the kit hit stands for (a landing without one: Fixed DMG, no poise unit).
        const els = [...new Set(at.map((l) => l.element).filter((x) => x !== null))];
        if (els.length && !els.includes(h.element)) out.push(`${tag} element: kit ${h.element}, data ${els.join(" | ")}`);
        if (h.frames && path) {
          const kitPoise = h.poise === undefined ? "-" : JSON.stringify(roundedValue(h.poise));
          const dataPoise = [...new Set(at.map((l) => (l.poise ? JSON.stringify(asKitValue(l.poise.value)) : "-")))];
          if (!dataPoise.includes(kitPoise)) out.push(`${tag} poise: kit ${kitPoise}, data ${dataPoise.join(" | ")}`);
          const ctl = [...new Set(at.map((l) => l.poise?.controlledOnly ?? false))];
          if (h.poise !== undefined && !ctl.includes(h.poiseControlledOnly ?? false)) out.push(`${tag} poiseControlledOnly: kit ${String(h.poiseControlledOnly ?? false)}, data ${ctl.join(" | ")}`);
        }
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
  // Compiler limitation, kit right: each of the three arrows' projhit deals damage only while buff attack_3_1/3_2_damagetaken is absent and then creates it, so one enemy takes one arrow; the compiler doesn't track buffs it creates.
  "chr_0034_typhoea_attack3/wave1 count: kit 1, data 3 landings at its frames (chr_0034_typhoea_attack3_01_projhit)",
  "chr_0034_typhoea_attack3/wave2 count: kit 1, data 3 landings at its frames (chr_0034_typhoea_attack3_02_projhit)",
  // ObtainUspInNormalSkill at 12 (window 12–18, only if a volley arrow hit), not the buff_common_obtain_ultimate_sp the compiler reads (D2); hand-written in the kit.
  "chr_0034_typhoea_normal_skill_floating_start teamEnergy: kit 1@12, data 1@0",
  // Timeline sections reached through JumpToAction (destinations 45/75/105/135; 150/300/450/600 in attack4): jumps are reported, not followed, so every section is listed. Which one a cast plays depends on the jump conditions; the kit has the first.
  "chr_0034_typhoea_floating_attack1: data lands chr_0034_typhoea_floating_attack1_01_projhit atk_scale_base × atk_scale_enhence at [46, 76, 106, 136], no kit hit",
  "chr_0034_typhoea_floating_attack2: data lands chr_0034_typhoea_floating_attack1_01_projhit atk_scale_base × atk_scale_enhence at [46, 76, 106, 136], no kit hit",
  "chr_0034_typhoea_floating_attack3: data lands chr_0034_typhoea_floating_attack1_01_projhit atk_scale_base × atk_scale_enhence at [46, 76, 106, 136], no kit hit",
  "chr_0034_typhoea_floating_attack4: data lands chr_0034_typhoea_floating_attack1_01_projhit atk_scale_base × atk_scale_enhence at [151, 301, 451, 601], no kit hit",
  // WILL: seal_total switches on EntityBB_consumed_type (set natively) for the element; the kit applies the enemy's current one (`element: enemy`, if WILL; open list A6).
  "chr_0032_lizhiyan_combo_skill applies at 15: kit [infliction enemy], data [], conditionally [infliction natural, infliction cryst, infliction pulse, infliction fire]",
  // RefrainObtainUsp 0–47 is the skill's; the array's own block (listener_owner, 20 s) is the kit buff gloompurger_array's blocksEnergy, which ends early with two Cluster Strikes.
  "chr_0032_lizhiyan_ultimate_skill energyBlockSeconds: kit 1.567, data 21.567",
  // WILL (EntityBB_wisd_greater_will < 1): an infliction of the enemy's current element (stack checks natural → cryst → pulse → fire), `element: enemy` in the kit; INT: the forced Corrosion.
  "chr_0032_lizhiyan_ultimate_skill applies at 47: kit [infliction enemy, forced corrosion], data [], conditionally [infliction natural, infliction cryst, infliction pulse, infliction fire]",
  // Both infliction branches create buff_common_obtain_ultimate_sp at 15 (after CheckEntityNum); the compiler doesn't merge exhaustive branches, so it finds none unconditional (batch-1 D2).
  "chr_0036_jsspsi_normal_skill teamEnergy: kit 1@15, data 1@0",
  // The kit's scaleValue is the data's expression with EntityBB_combo_count = the window's eventCount, +1 through potential5 (IfElse on potential5 ≥ 1); the test compares key products only.
  'chr_0036_jsspsi_combo_skill/final scale: kit {"sum":["atk_scale2",{"product":[{"sum":[{"eventCount":true},"potential5"]},"atk_scale2_1"]}]}, data ((($EntityBB_combo_count + 1) × atk_scale2_1) + atk_scale2) | (($EntityBB_combo_count × atk_scale2_1) + atk_scale2)',
  // buff_chr_0035_liino_ultskill_refrainobtainusp has duration 1 s but lifeType 1 (until ended) and is created by a 77–527 autoFinishByAction clip: the kit blocks energy with the cosmovoice_block buff for the whole stance (in-game test 27). The compiler reads the 1 s.
  "chr_0035_liino_ultimate_skill energyBlockSeconds: kit -, data 3.567",
  // The finale (and the beats, whose landings are on a branch) are hits of the kit's ult_song cast trigger, not of the skill: the engine judges a skill hit's `if` (buffActive cosmovoice_amp) at the cast, before the stance exists.
  "chr_0035_liino_ultimate_skill: data lands chr_0035_liino_ultimate_skill_soundwave_02_projhit atk_scale_3 × final_value at [508], no kit hit",
  // Compiler limitation (D2), kit right: CreateBuff buff_common_obtain_ultimate_sp is in chr_0021_whiten_normal_skill_projhit (launched at 21) on the first-target branch (EntityBB_first_hit), which the compiler leaves undecided.
  "chr_0021_whiten_normal_skill teamEnergy: kit 1@21, data 1@0",
  // Compiler limitation (D3), kit right: both projectiles launched at 27 run attack4_powerattack_projhit's IfElse on the timed marker have_recovered,
  // which the first landing creates; the first takes the Final Strike branch (atb, poise), the second the plain one. The compiler counts both branches for each.
  "chr_0023_antal_attack4/first count: kit 1, data 2 landings at its frames (chr_0023_antal_attack4_powerattack_projhit)",
  "chr_0023_antal_attack4/second count: kit 1, data 2 landings at its frames (chr_0023_antal_attack4_powerattack_projhit)",
  "chr_0023_antal_attack4/second poise: kit -, data \"poise\"",
  "chr_0023_antal_attack4/second finalStrike: kit none, data at [27, 27]",
  // The combo's SwitchAction on EntityBB_combo_type / _index (set natively from the event that opened the window) picks one infliction or one physical status;
  // the kit repeats the window's event (element: event, status: event). The compiler lists every option as conditional (Breach, Lift, Knock Down, Crush; the inflictions).
  "chr_0023_antal_combo_skill applies at 21: kit [infliction event, physical event], data [], conditionally [breach, lift, knockdown, crush, infliction fire, infliction cryst, infliction pulse, infliction natural]",
  // The entity's JumpToAction to 149 (the ultimate's marker on the target) is the other branch of the one explosion, not a second one (open list D3):
  // the kit deals it from the trigger ultimate_detonates when an ultimate shot lands, and the frame-99 explosion then doesn't happen.
  "chr_0022_bounda_normal_skill applies at 159: kit [], data [infliction natural]",
  "chr_0022_bounda_normal_skill: data lands chr_0022_bounda_normal_skill_abilityrange atk_scale at [159], no kit hit",
  // SwitchAction on EntityBB_combo_index (2 → Cryo, 3 → Nature), set natively when the window opens: the window's element (`element: event`).
  "chr_0022_bounda_combo_skill applies at 15: kit [infliction event], data [], conditionally [infliction cryst, infliction natural]",
  // Batch 2, the Endministrator (both IDs: chr_0002_endminm is the kit's variant).
  // The combo's first DamageAction at 23 names atk_scale without useBlackboardKey (a literal 0): a hit of no damage, left out of the kit (the log has one combo hit per cast).
  "chr_0003_endminf_combo_skill: data lands chr_0003_endminf_combo_skill  at [23], no kit hit",
  // The ultimate's IgniteAction 6 runs buff_common_originum_frozen's own DamageAction (atk_scale_trigger from the combo), which the compiler doesn't follow (an ignite handler of a buff on the target); the kit's third hit on sealed targets.
  "chr_0003_endminf_ultimate_skill/shatter: no landing scaled by atk_scale_trigger (data: atk_scale | originum_ult_break_scale)",
  "chr_0002_endminm_combo_skill: data lands chr_0002_endminm_combo_skill  at [23], no kit hit",
  "chr_0002_endminm_ultimate_skill/shatter: no landing scaled by atk_scale_trigger (data: atk_scale | originum_ult_break_scale)",
  // Batch 3, Da Pan. Kit right, a limit of this test: the frame-0 forced Lift (AirborneAction forceAirborne, no damage landing there) is the
  // kit's cast trigger ultimate_skill_f0, as kit-draft compiles it; this test only reads applications on a skill's hits.
  "chr_0018_dapan_ultimate_skill applies at 0: kit [], data [lift (forced)]",
];

describe("batch-1 kits against the compiled SkillData", () => {
  it("disagree only where known", () => {
    expect(kitDisagreements()).toEqual(KNOWN);
  });
});
