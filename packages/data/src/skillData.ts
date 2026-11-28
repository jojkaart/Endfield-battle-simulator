// Reads the parts of rmxlinux's Json/SkillData files the engine needs so far:
// blackboard defaults and permanent stat effects (cardAttributeModifier).
// Only rmxlinux has these files, so there's no cross-check source.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { arr, at, get, int, num, obj, str, type Ctx } from "./fields.ts";
import { parseJsonExact } from "./json.ts";
import { DATA_FILES, sourceDir } from "./sources.ts";
import { COMBO_CURVE, COMBO_CURVES, type SkillTiming, type SpKind } from "@efsim/engine/core";

export interface RawSkillFile {
  /** When the skill lets its operator act again (engine SkillTiming). */
  readonly timing: SkillTiming;
  readonly defaults: Record<string, number>;
  readonly statModifiers: readonly { attr: number; slot: number; target: number; key: string | null; literal: number }[];
  readonly spKinds: Readonly<Record<string, SpKind>>;
  readonly spSources: Readonly<Record<string, number>>;
  /**
   * The skills a cast of this one casts instead, through its
   * switchToBuffConfig buffs' CastSkill (Camille's normal_skill_2, the
   * battle-skill button in her ultimate's state, casts combo_skill_2): a
   * window listing this skill opens for those too.
   */
  readonly switchCasts: readonly string[];
  /**
   * Every time-dilation action the file has (UltimateTimeAction, TimeDilationAction) and what the compiler made of it:
   * a slow-down, a reset, or why it dropped it (friction round 7: Arcane's combo reset was dropped silently and found by
   * hand). Not in the compiled game data; `efsim kit` and `efsim gamedata dilations` print it.
   */
  readonly dilations: readonly SkillDilation[];
}

/** A time-dilation action of a skill file and what the compiler made of it (RawSkillFile.dilations). */
export interface SkillDilation {
  /** Its index among the file's time-dilation actions (in the file's order): the `n` its compiled slow-down carries. */
  readonly n: number;
  readonly frame: number;
  readonly type: "UltimateTimeAction" | "TimeDilationAction";
  /** Its layer (TimeDilationAction: 0 the world's), priority tag and curve (a named curve, or "own curve"). */
  readonly layer: number | null;
  readonly priority: number | null;
  readonly curve: string | null;
  /** "slow-down", "reset", or "dropped: <why>". */
  readonly compiled: string;
}

/** What readSkillFile makes of a time-dilation action (SkillDilation.compiled), by the rules it compiles with. */
function dilationOutcome(o: Record<string, unknown>, ultimate: boolean, intervalFrames: number): string {
  if (o["isEnable"] === false) return "dropped: switched off (isEnable false)";
  if (ultimate) return "slow-down";
  if (o["layer"] !== 0) return `dropped: layer ${String(o["layer"])} (only layer 0, the world's, is compiled)`;
  if (slowdownOf(o, intervalFrames)) return "slow-down";
  if (o["useCurveKey"] === true && o["curveKey"] === "RESETto1") return dilationPriority(o) !== null ? "reset" : "dropped: a reset without a priority tag";
  const dur = o["duration"] as { value?: number } | undefined;
  if (!(typeof dur?.value === "number" && dur.value > 0)) return "dropped: no duration";
  if (o["useCurveKey"] === true && !NAMED_CURVES[String(o["curveKey"])]) return `dropped: curve ${String(o["curveKey"])} unknown (skillData.ts NAMED_CURVES)`;
  return "dropped: never below scale 1";
}

/** A Unity AnimationCurve key (TimeDilationAction timeScaleCurve). */
interface CurveKey {
  readonly m_Time: number;
  readonly m_Value: number;
  readonly m_InTangent: number;
  readonly m_OutTangent: number;
}

/** A Unity curve at t: Hermite between keys (weighted keys are treated as unweighted), clamped outside them. */
function curveAt(keys: readonly CurveKey[], t: number): number {
  const first = keys[0] as CurveKey;
  const last = keys[keys.length - 1] as CurveKey;
  if (t <= first.m_Time) return first.m_Value;
  if (t >= last.m_Time) return last.m_Value;
  for (let i = 0; i + 1 < keys.length; i++) {
    const a = keys[i] as CurveKey;
    const b = keys[i + 1] as CurveKey;
    if (t > b.m_Time) continue;
    const dt = b.m_Time - a.m_Time;
    if (dt <= 0) return b.m_Value;
    const u = (t - a.m_Time) / dt;
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * a.m_Value + (u3 - 2 * u2 + u) * dt * a.m_OutTangent + (-2 * u3 + 3 * u2) * b.m_Value + (u3 - u2) * dt * b.m_InTangent;
  }
  return last.m_Value;
}

/**
 * Named time-scale curves (their assets aren't in the data submodules).
 * ComboSkill: the engine's guess (timeline/curves.ts COMBO_CURVES: 0.01 for
 * the first 40% of the duration, then up to 1 at 93%; shape from the research
 * of 2026-10-18 on Endaxis's catalog, the ramp taken as linear), which engine
 * assumption combo-curve resamples. RESETto1 is 1 throughout. Others are unknown.
 */
const NAMED_CURVES: Readonly<Record<string, (t: number) => number>> = {
  [COMBO_CURVE]: COMBO_CURVES["guess"] as (t: number) => number,
  RESETto1: () => 1,
};

/** A global TimeDilationAction as per-frame scales (its curve over its duration, sampled mid-frame), or null when its curve is unknown. */
export function slowdownOf(o: Record<string, unknown>, intervalFrames: number): number[] | null {
  const c = dilationCurve(o, intervalFrames);
  if (!c) return null;
  const scales = Array.from({ length: c.frames }, (_, k) => Math.max(0, Math.min(1, c.at((k + 0.5) / c.frames))));
  return scales.every((x) => x >= 1) ? null : scales;
}

/**
 * A TimeDilationAction's curve as the compiler reads it (any layer): its length in frames (its duration, at most the
 * action's own interval with finishByAction) and its scale at normalised time t in [0, 1] (its own timeScaleCurve,
 * Hermite: curveAt; or a named curve: NAMED_CURVES), and which; null without a length or a known curve. `efsim
 * gamedata curve` evaluates it (round 23, the placement-cases report point 5: an entity's slow-down took a probe
 * with its keys copied by hand).
 */
export function dilationCurve(o: Record<string, unknown>, intervalFrames = Infinity): { readonly frames: number; readonly at: (t: number) => number; readonly source: string } | null {
  const dur = o["duration"] as { value?: number } | undefined;
  let frames = Math.round((typeof dur?.value === "number" ? dur.value : 0) * 30);
  if (o["finishByAction"] === true) frames = Math.min(frames, intervalFrames);
  if (frames <= 0) return null;
  if (o["useCurveKey"] === true) {
    const named = NAMED_CURVES[String(o["curveKey"])];
    return named ? { frames, at: named, source: `the named curve ${String(o["curveKey"])}` } : null;
  }
  const keys = ((o["timeScaleCurve"] as { keys?: CurveKey[] } | undefined)?.keys ?? []) as CurveKey[];
  return keys.length ? { frames, at: (t) => curveAt(keys, t), source: `its own curve (${keys.length} keys, Hermite)` } : null;
}

/** A time dilation's priority tag (timeDilationPriority.tagId: one per kind, every combo's -593023102), or null without one. */
function dilationPriority(o: Record<string, unknown>): number | null {
  const tag = (o["timeDilationPriority"] as { tagId?: unknown } | undefined)?.tagId;
  return typeof tag === "number" && tag !== 0 ? tag : null;
}

export function globToRegExp(glob: string): RegExp {
  return new RegExp("^" + glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
}

const ALLOWED = DATA_FILES.json.SkillData.map(globToRegExp);

export function isSkillFileListed(skillId: string): boolean {
  return ALLOWED.some((re) => re.test(skillId));
}

export function skillFilePath(skillId: string): string {
  return join(sourceDir("rmxlinux"), "Json", "SkillData", `${skillId}.json`);
}

const DIVE_END = /_plunging_attack_end$/;

/**
 * An operator's dive (plunging attack) among its skills: CharGrowthTable
 * lists only the landing, `…_plunging_attack_end` (it deals the damage);
 * the fall before it, `…_plunging_attack_start`, has a SkillData file of its
 * own but no skill group or SkillPatchTable row (`start` when that file is
 * fetched). The native character template pairs the two (its
 * plungingAttackData, which isn't in the data); every operator's files pair
 * them by these names.
 */
export function diveOf(skillIds: readonly string[]): { readonly start?: string; readonly end: string } | null {
  const ends = skillIds.filter((id) => DIVE_END.test(id));
  if (ends.length > 1) throw new Error(`more than one dive landing among ${ends.join(", ")}`);
  const end = ends[0];
  if (end === undefined) return null;
  const start = end.replace(DIVE_END, "_plunging_attack_start");
  return isSkillFileListed(start) && existsSync(skillFilePath(start)) ? { start, end } : { end };
}

/**
 * A skill file's skillSpecification, an ultimate's read as 5 where the file says 0: Akekuri's ultimate
 * (chr_0019_karin_ultimate_skill) is the only one of the 34 operators' ultimates with 0, though its UltimateTimeAction
 * stops time as every other's does (2026-11-28, the break-combo round). Under 0 the engine gave it the interrupt
 * priority of a plain skill (timeline/rules.ts priorityOf) and no ultimate's stop (timeline/clock.ts slowDown):
 * 458b03609665 160.36 s, her ultimate logged at its stop's end and so pressed at 158.53 s, came at her combo's frame
 * 34, inside the combo's uncuttable frames (55), where an ultimate (priority 7) may start; a break inside her stop was
 * held by the engine and not by the replay's stop list.
 */
function ultimateSpecification(skillId: string, specification: number, stopsTime: boolean): number {
  return specification === 0 && stopsTime && skillId.endsWith("_ultimate_skill") ? 5 : specification;
}

/** Reads a skill file, or returns null when the game has none for this skill. */
export function readSkillFile(skillId: string): RawSkillFile | null {
  if (!isSkillFileListed(skillId)) {
    throw new Error(`skill file ${skillId} isn't covered by packages/data/tables.json json.SkillData; add a pattern so it gets fetched`);
  }
  const file = skillFilePath(skillId);
  if (!existsSync(file)) return null;
  const ctx: Ctx = { source: "rmxlinux", path: `SkillData/${skillId}` };
  const j = obj(parseJsonExact(readFileSync(file, "utf8")), ctx);

  const defaults: Record<string, number> = {};
  get(j, "blackboard", ctx, arr).forEach((b, i) => {
    const c = at(at(ctx, "blackboard"), i);
    const o = obj(b, c);
    defaults[get(o, "key", c, str)] = get(o, "valueDouble", c, num);
  });

  const card = j["cardAttributeModifier"];
  const statModifiers: RawSkillFile["statModifiers"][number][] = [];
  if (card !== undefined && card !== null) {
    const cc = at(ctx, "cardAttributeModifier");
    get(obj(card, cc), "attributeModifiers", cc, arr).forEach((m, i) => {
      const mc = at(at(cc, "attributeModifiers"), i);
      const mo = obj(m, mc);
      const pc = at(mc, "param");
      const param = obj(mo["param"], pc);
      const useKey = param["useBlackboardKey"] === true;
      statModifiers.push({
        attr: get(mo, "attributeType", mc, int),
        slot: get(mo, "formulaItem", mc, int),
        target: get(mo, "modifyAttributeType", mc, int),
        key: useKey ? get(param, "blackboardKey", pc, str) : null,
        literal: get(param, "value", pc, num),
      });
    });
  }
  const windows: { from: number; to: number; skills: string[]; conditional?: true }[] = [];
  // ComboCacheAction mappings of the basic-attack input (cmdType 0): what the next attack input becomes.
  const inputMap = new Set<string>();
  const channels: { from: number; to: number; cantCastSkill: boolean; cantSwitch: boolean; finisher?: true }[] = [];
  const slowdowns: { from: number; scales: number[]; priority?: number; n: number }[] = [];
  const resets: { at: number; priority: number }[] = [];
  const dilations: SkillDilation[] = [];
  // `conditional`: under a TogglableAction or an IfElse branch, the window is open only when its condition holds (the kit says when).
  const find = (node: unknown, from: number, to: number, conditional = false) => {
    if (Array.isArray(node)) return node.forEach((x) => find(x, from, to, conditional));
    if (typeof node !== "object" || node === null) return;
    const o = node as Record<string, unknown>;
    const type = typeof o["$type"] === "string" ? o["$type"] : "";
    if (type.includes("UltimateTimeAction") || type.includes("TimeDilationAction")) {
      const ultimate = type.includes("UltimateTimeAction");
      dilations.push({
        n: dilations.length,
        frame: from,
        type: ultimate ? "UltimateTimeAction" : "TimeDilationAction",
        layer: typeof o["layer"] === "number" ? o["layer"] : null,
        priority: dilationPriority(o),
        curve: ultimate ? null : o["useCurveKey"] === true ? String(o["curveKey"]) : "own curve",
        compiled: dilationOutcome(o, ultimate, to - from),
      });
    }
    if (o["isEnable"] !== false && type.includes("AllowNextSkillAction")) {
      windows.push({ from, to, skills: ((o["allowedSkillIdList"] ?? []) as unknown[]).filter((x): x is string => typeof x === "string"), ...(conditional ? { conditional: true as const } : {}) });
    }
    if (o["isEnable"] !== false && type.includes("ComboCacheAction")) {
      for (const m of (o["mappingDataList"] ?? []) as Record<string, unknown>[]) if ((m["cmdType"] ?? 0) === 0 && typeof m["skillId"] === "string") inputMap.add(m["skillId"]);
    }
    if (o["isEnable"] !== false && type.includes("UltimateTimeAction")) {
      const scale = typeof o["timeScale"] === "number" ? o["timeScale"] : 0;
      const priority = dilationPriority(o);
      slowdowns.push({ from, scales: Array.from({ length: Math.max(0, to - from) }, () => scale), ...(priority !== null ? { priority } : {}), n: dilations.length - 1 });
    }
    if (o["isEnable"] !== false && type.includes("TimeDilationAction") && o["layer"] === 0) {
      const d = slowdownOf(o, to - from);
      const priority = dilationPriority(o);
      if (d) slowdowns.push({ from, scales: d, ...(priority !== null ? { priority } : {}), n: dilations.length - 1, ...(o["useCurveKey"] === true && o["curveKey"] === COMBO_CURVE ? { curve: COMBO_CURVE } : {}) });
      // A global dilation back to scale 1 (curve RESETto1): it takes the place of the running ones of its priority
      // (SkillTiming.resets).
      else if (o["useCurveKey"] === true && o["curveKey"] === "RESETto1" && priority !== null) resets.push({ at: from, priority });
    }
    if (o["isEnable"] !== false && type.includes("ChannelingCastingAction")) channels.push({ from, to, cantCastSkill: o["cantCastSkill"] === true, cantSwitch: o["cantSwitchPosition"] === true });
    // A finisher's disable-cast buff for the action's frames blocks casts as a cantCastSkill channel does, but for an
    // ultimate (SkillTiming channels' `finisher`).
    if (o["isEnable"] !== false && type.includes("CreateBuffAction") && o["autoFinishByAction"] === true && ((o["buffs"] ?? []) as { buffId?: unknown }[]).some((b) => b.buffId === "buff_common_power_attack_disable_cast_skill")) {
      channels.push({ from, to, cantCastSkill: true, cantSwitch: false, finisher: true });
    }
    const under = conditional || (o["isEnable"] !== false && (type.includes("TogglableAction") || type.includes("IfElseAction")));
    for (const v of Object.values(o)) find(v, from, to, under);
  };
  const group = obj(j["actionGroupData"] ?? {}, at(ctx, "actionGroupData"));
  const jumps: { at: number; to: number; conditional: boolean }[] = [];
  const ends: number[] = [];
  const recasts: number[] = [];
  const interruptibleFrom: number[] = [];
  for (const ta of (group["timelineActions"] ?? []) as Record<string, unknown>[]) {
    const from = Number(ta["_startFrame"]);
    find(ta["_sequenceActionData"], from, ta["_endFrame"] === undefined ? from : Number(ta["_endFrame"]));
    // Jumps and ends on the timeline itself; those inside conditions or event handlers are the kit's to say.
    // A sequence stops at its first failing check, so a jump after one in its own sequence is conditional too.
    let gated = false;
    for (const a of ((ta["_sequenceActionData"] as Record<string, unknown> | undefined)?.["actionData"] ?? []) as Record<string, unknown>[]) {
      const type = typeof a["$type"] === "string" ? a["$type"] : "";
      if (a["isEnable"] === false) continue;
      if (isConditionAction(type)) gated = true;
      // Only forward jumps: a backward one repeats frames, which nothing here uses.
      if (type.includes("JumpToAction") && Number(a["destFrame"]) > from) {
        const cond = ((a["conditionAction"] as Record<string, unknown> | undefined)?.["actionData"] ?? []) as unknown[];
        jumps.push({ at: from, to: Number(a["destFrame"]), conditional: gated || cond.length > 0 });
      }
      if (type.includes("InterruptCurSkillAction")) ends.push(from);
      // A cast of another of the operator's own skills, its caster the skill's owner (targetSource 4), unchecked.
      if (!gated && type.includes("CastSkill+Data") && ownCast(a, skillId)) recasts.push(from);
      if (type.includes("MarkCanInterrupt")) interruptibleFrom.push(from);
      // A jump in a top-level IfElse's branches is a conditional jump at this frame (the kit says when: KitSkill.jumps).
      if (type.includes("IfElseAction")) for (const to of branchJumps(a)) if (to > from) jumps.push({ at: from, to, conditional: true });
    }
  }
  const timing: SkillTiming = {
    durationFrames: get(j, "durationFrame", ctx, int),
    exclusiveFrames: get(j, "exclusiveFrame", ctx, int),
    windows: windows.sort((a, b) => a.from - b.from),
    channels,
    specification: ultimateSpecification(skillId, get(j, "skillSpecification", ctx, int), slowdowns.length > 0 && dilations.some((d) => d.type === "UltimateTimeAction")),
    keepsChain: j["dontInterruptCombo"] === true,
    ...(j["normalSkillSubType"] === 1 ? { subSkill: true as const } : {}),
    slowdowns,
    ...(resets.length ? { resets: resets.sort((a, b) => a.at - b.at) } : {}),
    jumps: jumps.filter((j, i) => jumps.findIndex((k) => k.at === j.at && k.to === j.to && k.conditional === j.conditional) === i).sort((a, b) => a.at - b.at),
    ends: ends.sort((a, b) => a - b),
    ...(recasts.length ? { recasts: [...new Set(recasts)].sort((a, b) => a - b) } : {}),
    ...(interruptibleFrom.length ? { interruptibleFrom: [...new Set(interruptibleFrom)].sort((a, b) => a - b) } : {}),
    ...(inputMap.size ? { inputMap: [...inputMap].sort() } : {}),
  };
  return { timing, defaults, statModifiers, spKinds: spKindsOf(j), spSources: spSourcesOf(j), switchCasts: switchCastsOf(j), dilations };
}

/**
 * A CastSkill action that casts another of the same operator's skills (a literal skill ID with the skill's own
 * `chr_XXXX_name_` prefix) with the skill's owner as the caster (targetSource 4): the operator's next action (SkillTiming.recasts).
 */
function ownCast(a: Record<string, unknown>, skillId: string): boolean {
  const sid = a["skillId"] as { useBlackboardKey?: unknown; value?: unknown } | undefined;
  const caster = a["caster"] as { targetSource?: unknown } | undefined;
  const prefix = skillId.split("_").slice(0, 3).join("_") + "_";
  return sid?.useBlackboardKey !== true && typeof sid?.value === "string" && sid.value !== skillId && sid.value.startsWith(prefix) && caster?.targetSource === 4;
}

/** The skills a skill file's switchToBuffConfig buffs cast (their enabled CastSkill actions with a literal skill ID). */
function switchCastsOf(j: Record<string, unknown>): string[] {
  const config = (j["switchToBuffConfig"] ?? {}) as Record<string, unknown>;
  const out = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || node === null) return;
    const o = node as Record<string, unknown>;
    if (typeof o["$type"] === "string" && o["$type"].includes("CastSkill+Data") && o["isEnable"] !== false) {
      const sid = o["skillId"] as { useBlackboardKey?: unknown; value?: unknown } | undefined;
      if (sid?.useBlackboardKey !== true && typeof sid?.value === "string" && sid.value) out.add(sid.value);
    }
    for (const v of Object.values(o)) walk(v);
  };
  for (const b of (config["buffs"] ?? []) as Record<string, unknown>[]) {
    const id = b?.["buffId"];
    if (typeof id !== "string" || !BUFF_ALLOWED.some((re) => re.test(id))) continue;
    const path = join(sourceDir("rmxlinux"), "Json", "BuffData", `${id}.json`);
    if (existsSync(path)) walk(parseJsonExact(readFileSync(path, "utf8")));
  }
  return [...out].sort();
}

/**
 * Whether an action `$type` is a check a sequence stops at when it fails:
 * the `Conditions.` namespace, Check… and Compare… actions, Probablity
 * (sic), OrConditionAction, and NotNextCheckAction (which negates the next).
 */
export function isConditionAction(type: string): boolean {
  const name = (type.split(",")[0] ?? "").split(".").pop() ?? "";
  const short = name.split("+")[0] ?? name;
  return type.includes(".Conditions.") || type.includes(".Condition.") || /^(Check|Compare)/.test(short) || short === "Probablity" || short === "OrConditionAction" || short === "NotNextCheckAction";
}

/** The destinations of the JumpToActions in an IfElse's branches (its success and fail action lists, at any depth of nested IfElses). */
function branchJumps(ifElse: Record<string, unknown>): number[] {
  const out: number[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || node === null) return;
    const o = node as Record<string, unknown>;
    const type = typeof o["$type"] === "string" ? o["$type"] : "";
    if (type.includes("JumpToAction") && o["isEnable"] !== false && typeof o["destFrame"] === "number") out.push(o["destFrame"]);
    for (const [k, v] of Object.entries(o)) if (k !== "conditionAction" && k !== "conditions") walk(v);
  };
  walk(ifElse);
  return [...new Set(out)];
}

const BUFF_ALLOWED = DATA_FILES.json.BuffData.map(globToRegExp);
/** LaunchProjectile's skill fields, each with the flag that enables it. */
const PROJECTILE_ROUTES: readonly [string, string][] = [["castSkillOnHit", "projectileSkillId"], ["castSkillOnReach", "skillIdOnReach"], ["castSkillOnFinish", "skillIdOnFinish"], ["castSkillOnLaunch", "skillIdOnLaunch"], ["castSkillOnBlock", "skillIdOnBlock"]];

/**
 * The SkillData and BuffData files a skill's file reaches, in the order
 * first met (breadth first, the skill's own not included): its spawned
 * ability entities and projectiles' skills, the helper skills it casts
 * (`isHelper`: a CastSkill of another of the operator's own skills isn't
 * followed), the buffs it creates (not the shared buff_common_* ones) and,
 * through them, what their handlers reach. Files the data doesn't list or
 * have are left out. `start` "buff": the same from a BuffData buff's file.
 */
export function reachedFiles(skillId: string, isHelper: (id: string) => boolean, start: "skill" | "buff" = "skill"): { kind: "skill" | "buff"; id: string; json: unknown }[] {
  const out: { kind: "skill" | "buff"; id: string; json: unknown }[] = [];
  const seen = new Set([`${start}:${skillId}`]);
  const buffPath = (id: string) => join(sourceDir("rmxlinux"), "Json", "BuffData", `${id}.json`);
  const read = (kind: "skill" | "buff", id: string): unknown => {
    const ok = kind === "skill" ? isSkillFileListed(id) && existsSync(skillFilePath(id)) : BUFF_ALLOWED.some((re) => re.test(id)) && existsSync(buffPath(id));
    return ok ? parseJsonExact(readFileSync(kind === "skill" ? skillFilePath(id) : buffPath(id), "utf8")) : null;
  };
  const queue: unknown[] = [read(start, skillId)];
  const add = (kind: "skill" | "buff", id: unknown) => {
    if (typeof id !== "string" || !id || seen.has(`${kind}:${id}`)) return;
    seen.add(`${kind}:${id}`);
    const json = read(kind, id);
    if (json === null) return;
    out.push({ kind, id, json });
    queue.push(json);
  };
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || node === null) return;
    const o = node as Record<string, unknown>;
    const type = typeof o["$type"] === "string" ? o["$type"] : "";
    if (o["isEnable"] !== false) {
      if (type.includes("SpawnAbilityEntity")) add("skill", o["abilityEntitySkillId"]);
      if (type.includes("LaunchProjectile")) for (const [flag, field] of PROJECTILE_ROUTES) if (o[flag] === true) add("skill", o[field]);
      if (type.includes("CastSkill+Data")) {
        const sid = o["skillId"] as { useBlackboardKey?: unknown; value?: unknown } | undefined;
        if (sid?.useBlackboardKey !== true && typeof sid?.value === "string" && isHelper(sid.value)) add("skill", sid.value);
      }
      if (type.includes("CreateBuffAction") || type.includes("AuraAction")) {
        for (const b of [...((o["buffs"] ?? []) as Record<string, unknown>[]), ...((o["buffInput"] ?? []) as Record<string, unknown>[])]) {
          if (b && b["readIdFromBlackboard"] !== true && typeof b["buffId"] === "string" && !b["buffId"].startsWith("buff_common_")) add("buff", b["buffId"]);
        }
      }
    }
    for (const v of Object.values(o)) walk(v);
  };
  while (queue.length) walk(queue.shift());
  return out;
}

const projectileCache = new Map<string, ReadonlySet<string>>();

/**
 * The skills a skill's file, or a file it reaches (reachedFiles), launches as projectiles (LaunchProjectile's routed
 * skills: PROJECTILE_ROUTES): a hit logged under one of them flies to the enemy after its launch (KitHit.travels).
 * Ability entities (SpawnAbilityEntity) aren't among them.
 */
export function projectileSkills(skillId: string): ReadonlySet<string> {
  const cached = projectileCache.get(skillId);
  if (cached) return cached;
  const out = new Set<string>();
  const own = isSkillFileListed(skillId) && existsSync(skillFilePath(skillId)) ? parseJsonExact(readFileSync(skillFilePath(skillId), "utf8")) : null;
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || node === null) return;
    const o = node as Record<string, unknown>;
    const type = typeof o["$type"] === "string" ? o["$type"] : "";
    if (o["isEnable"] !== false && type.includes("LaunchProjectile")) for (const [flag, field] of PROJECTILE_ROUTES) if (o[flag] === true && typeof o[field] === "string") out.add(o[field]);
    for (const v of Object.values(o)) walk(v);
  };
  if (own !== null) [own, ...reachedFiles(skillId, () => false).map((f) => f.json)].forEach(walk);
  projectileCache.set(skillId, out);
  return out;
}

/** One of the game's cooldown mechanisms in a source's files, with the blackboard key that sets its length or its literal seconds. */
export interface CooldownTimer {
  /**
   * `globalCd`: AddGlobalCDTimer (checked by CheckGlobalCDTimerAction), a timer named by a buff ID; `cdBuff`: a
   * CreateBuffAction of a `…_cd` buff whose duration the key sets (checked by its stack count); `marker`:
   * CreateTimedMarker (checked by CheckTimedMarkerCondition).
   */
  readonly kind: "globalCd" | "cdBuff" | "marker";
  readonly length: string | number;
}

/**
 * The cooldown mechanisms in a value source's files (a SkillData skill, its `buffs` list's BuffData files and what
 * reachedFiles reaches from it; or a BuffData buff): what says which clock a kit trigger's cooldown runs on (kits.ts
 * cooldownClockOf). Files the data doesn't list or have are left out.
 */
export function cooldownTimers(sourceId: string): CooldownTimer[] {
  const buffPath = (id: string) => join(sourceDir("rmxlinux"), "Json", "BuffData", `${id}.json`);
  const readBuff = (id: string): unknown => (BUFF_ALLOWED.some((re) => re.test(id)) && existsSync(buffPath(id)) ? parseJsonExact(readFileSync(buffPath(id), "utf8")) : null);
  const files: unknown[] = [];
  if (isSkillFileListed(sourceId) && existsSync(skillFilePath(sourceId))) {
    const own = parseJsonExact(readFileSync(skillFilePath(sourceId), "utf8")) as Record<string, unknown>;
    files.push(own);
    for (const b of Array.isArray(own["buffs"]) ? (own["buffs"] as Record<string, unknown>[]) : []) if (typeof b?.["buffId"] === "string") files.push(readBuff(b["buffId"]));
    files.push(...reachedFiles(sourceId, () => false).map((f) => f.json));
  } else files.push(readBuff(sourceId), ...reachedFiles(sourceId, () => false, "buff").map((f) => f.json));
  const length = (v: unknown): string | number | null => {
    const o = v as { useBlackboardKey?: unknown; blackboardKey?: unknown; value?: unknown } | undefined;
    if (o?.useBlackboardKey === true) return typeof o.blackboardKey === "string" ? o.blackboardKey : null;
    return typeof o?.value === "number" ? Math.round(o.value * 1000) / 1000 : null;
  };
  const out: CooldownTimer[] = [];
  const add = (kind: CooldownTimer["kind"], l: string | number | null) => {
    if (l !== null && !out.some((x) => x.kind === kind && x.length === l)) out.push({ kind, length: l });
  };
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || node === null) return;
    const o = node as Record<string, unknown>;
    const type = typeof o["$type"] === "string" ? o["$type"] : "";
    if (o["isEnable"] !== false) {
      if (type.includes("AddGlobalCDTimer+Data")) add("globalCd", length(o["cdTime"]));
      if (type.includes("CreateTimedMarker+Data")) add("marker", length(o["duration"]));
      if (type.includes("CreateBuffAction+Data")) {
        for (const b of (o["buffs"] ?? []) as Record<string, unknown>[]) {
          const id = b?.["buffId"];
          if (typeof id !== "string" || !id.endsWith("_cd")) continue;
          const f = readBuff(id) as Record<string, unknown> | null;
          const own = length(f?.["duration"]);
          if (typeof own === "number") add("cdBuff", own);
          else for (const a of (b["assignItems"] ?? []) as Record<string, unknown>[]) if (a?.["targetKey"] === own && a["useDirectValue"] !== true && typeof a["inputValueKey"] === "string") add("cdBuff", a["inputValueKey"]);
        }
      }
    }
    for (const v of Object.values(o)) walk(v);
  };
  files.forEach(walk);
  return out;
}

/**
 * A game buff a value source creates (CreateBuffAction) beside a buff it attaches to a cast (CreateBuffAttachingSkill)
 * in the same SkillData file, where the created one has no attribute modifier and the attached one has: the log lists
 * the attached one on the cast's hits (Glorious Memory's `_exist` layers and their `_valid`, the Endministrator's and
 * Chen Qianyu's weapons: round 11's likely-loggedAs screen found them from the logs). Per created buff, the attached
 * ones with modifiers (kits.ts unloggedAttachedBuffs: a kit buff standing for the created one lists them as loggedAs).
 */
export function attachedModifierBuffs(sourceId: string): ReadonlyMap<string, readonly string[]> {
  if (!isSkillFileListed(sourceId) || !existsSync(skillFilePath(sourceId))) return new Map();
  const own = parseJsonExact(readFileSync(skillFilePath(sourceId), "utf8"));
  const created = new Set<string>();
  const attached = new Set<string>();
  const ids = (o: Record<string, unknown>) => ((o["buffs"] ?? []) as Record<string, unknown>[]).flatMap((b) => (typeof b?.["buffId"] === "string" ? [b["buffId"]] : []));
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || node === null) return;
    const o = node as Record<string, unknown>;
    const type = typeof o["$type"] === "string" ? o["$type"] : "";
    if (o["isEnable"] !== false) {
      if (type.includes("CreateBuffAttachingSkill")) ids(o).forEach((id) => attached.add(id));
      else if (type.includes("CreateBuffAction+Data")) ids(o).forEach((id) => created.add(id));
    }
    for (const v of Object.values(o)) walk(v);
  };
  walk(own);
  const buffPath = (id: string) => join(sourceDir("rmxlinux"), "Json", "BuffData", `${id}.json`);
  const modifiers = (id: string): boolean | null => {
    if (!BUFF_ALLOWED.some((re) => re.test(id)) || !existsSync(buffPath(id))) return null;
    const f = parseJsonExact(readFileSync(buffPath(id), "utf8")) as { attributeModifier?: { attributeModifiers?: unknown[] } };
    return (f.attributeModifier?.attributeModifiers?.length ?? 0) > 0;
  };
  const withMods = [...attached].filter((id) => modifiers(id) === true);
  const out = new Map<string, readonly string[]>();
  if (!withMods.length) return out;
  for (const id of created) if (!attached.has(id) && modifiers(id) === false) out.set(id, withMods);
  return out;
}

/**
 * The permanent attribute modifiers a passive skill (castType 1, e.g. one a
 * talent attaches) gives through the buffs its `buffs` list creates: each
 * listed BuffData buff that lasts for good (lifeType 1) and does nothing
 * else (no event handlers, timeline or damage modifiers: those are kit
 * work), with each modifier's key renamed to the skill's key that its
 * `assignItems` pass on (a direct value or an unassigned key: a literal).
 * Empty for other skills and when the file isn't there.
 */
export function passiveBuffModifiers(skillId: string): { buff: string; attr: number; slot: number; target: number; key: string | null; literal: number }[] {
  if (!isSkillFileListed(skillId) || !existsSync(skillFilePath(skillId))) return [];
  const j = parseJsonExact(readFileSync(skillFilePath(skillId), "utf8")) as Record<string, unknown>;
  if (j["castType"] !== 1) return [];
  const out: ReturnType<typeof passiveBuffModifiers> = [];
  for (const entry of (j["buffs"] ?? []) as Record<string, unknown>[]) {
    const id = entry["buffId"];
    if (entry["readIdFromBlackboard"] === true || typeof id !== "string" || !BUFF_ALLOWED.some((re) => re.test(id))) continue;
    const path = join(sourceDir("rmxlinux"), "Json", "BuffData", `${id}.json`);
    if (!existsSync(path)) continue;
    const b = parseJsonExact(readFileSync(path, "utf8")) as Record<string, unknown>;
    const busy = ["buffEventAction", "abilityEventAction", "igniteEventAction", "timelineActions", "damageModifier"].some((k) => Array.isArray(b[k]) && (b[k] as unknown[]).length > 0);
    if (b["lifeType"] !== 1 || busy) continue;
    const defaults = new Map(((b["blackboard"] ?? []) as Record<string, unknown>[]).map((x) => [x["key"], typeof x["valueDouble"] === "number" ? x["valueDouble"] : 0]));
    const assigned = new Map(entry["assignBlackboard"] === true ? ((entry["assignItems"] ?? []) as Record<string, unknown>[]).map((x) => [x["targetKey"], x]) : []);
    for (const m of (((b["attributeModifier"] ?? {}) as Record<string, unknown>)["attributeModifiers"] ?? []) as Record<string, unknown>[]) {
      const param = (m["param"] ?? {}) as Record<string, unknown>;
      const base = { buff: id, attr: Number(m["attributeType"]), slot: Number(m["formulaItem"]), target: Number(m["modifyAttributeType"]) };
      if (param["useBlackboardKey"] !== true || typeof param["blackboardKey"] !== "string") {
        out.push({ ...base, key: null, literal: typeof param["value"] === "number" ? param["value"] : 0 });
        continue;
      }
      const item = assigned.get(param["blackboardKey"]);
      if (item && item["useDirectValue"] !== true && typeof item["inputValueKey"] === "string") out.push({ ...base, key: item["inputValueKey"], literal: 0 });
      else out.push({ ...base, key: null, literal: item ? Number(item["numericValue"]) : (defaults.get(param["blackboardKey"]) ?? 0) });
    }
  }
  return out;
}

/**
 * A skill's SP kinds and sources (spKindsOf, spSourcesOf) with the keys of
 * the files it reaches (reachedFiles) that its own file doesn't grant: a
 * kit hit naming such a key (a spawned entity's `atb_trigger`, read from
 * the skill's values) gets the data's kind and source type.
 */
export function reachedSp(skillId: string, own: Pick<RawSkillFile, "spKinds" | "spSources">, isHelper: (id: string) => boolean): Pick<RawSkillFile, "spKinds" | "spSources"> {
  const spKinds: Record<string, SpKind> = { ...own.spKinds };
  const spSources: Record<string, number> = { ...own.spSources };
  for (const f of reachedFiles(skillId, isHelper)) {
    for (const [k, v] of Object.entries(spKindsOf(f.json))) if (!(k in spKinds)) spKinds[k] = v;
    for (const [k, v] of Object.entries(spSourcesOf(f.json))) if (!(k in spSources)) spSources[k] = v;
  }
  return { spKinds, spSources };
}

/**
 * What kind of SP each blackboard key grants (ObtainCostAction costType 1):
 * atbGainMethod 0 gains natural SP (spent, it gives the team ultimate
 * energy), 1 returns SP (spent first, gives none). A key granted both ways
 * keeps the first.
 */
export function spKindsOf(file: unknown): Record<string, SpKind> {
  const out: Record<string, SpKind> = {};
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || node === null) return;
    const o = node as Record<string, unknown>;
    if (typeof o["$type"] === "string" && o["$type"].includes("ObtainCostAction") && o["costType"] === 1 && o["isEnable"] !== false) {
      const v = o["costValue"] as { blackboardKey?: unknown; useBlackboardKey?: unknown } | undefined;
      if (v?.useBlackboardKey === true && typeof v.blackboardKey === "string" && !(v.blackboardKey in out)) out[v.blackboardKey] = o["atbGainMethod"] === 1 ? "returned" : "natural";
    }
    for (const x of Object.values(o)) walk(x);
  };
  walk(file);
  return out;
}

/**
 * The atbSourceType of the SP each blackboard key grants (ObtainCostAction
 * costType 1): 1 basic attacks, 3 skills, 0 finishers and some extras, as
 * CheckObtainAtbType obtainTypeList filters them (OBJ Edge of Lightness:
 * [3]). A key granted with several source types keeps the first (none do in
 * game 1.6).
 */
export function spSourcesOf(file: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || node === null) return;
    const o = node as Record<string, unknown>;
    if (typeof o["$type"] === "string" && o["$type"].includes("ObtainCostAction") && o["costType"] === 1 && o["isEnable"] !== false) {
      const v = o["costValue"] as { blackboardKey?: unknown; useBlackboardKey?: unknown } | undefined;
      const type = o["atbSourceType"];
      if (typeof type !== "number") throw new Error(`ObtainCostAction for SP without an atbSourceType (${JSON.stringify(v)})`);
      if (v?.useBlackboardKey === true && typeof v.blackboardKey === "string" && !(v.blackboardKey in out)) out[v.blackboardKey] = type;
    }
    for (const x of Object.values(o)) walk(x);
  };
  walk(file);
  return out;
}
