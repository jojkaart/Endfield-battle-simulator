// Reads the parts of rmxlinux's Json/SkillData files the engine needs so far:
// blackboard defaults and permanent stat effects (cardAttributeModifier).
// Only rmxlinux has these files, so there's no cross-check source.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { arr, at, get, int, num, obj, str, type Ctx } from "./fields.ts";
import { parseJsonExact } from "./json.ts";
import { DATA_FILES, sourceDir } from "./sources.ts";
import type { SkillTiming, SpKind } from "@efsim/engine";

export interface RawSkillFile {
  /** When the skill lets its operator act again (engine SkillTiming). */
  readonly timing: SkillTiming;
  readonly defaults: Record<string, number>;
  readonly statModifiers: readonly { attr: number; slot: number; target: number; key: string | null; literal: number }[];
  readonly spKinds: Readonly<Record<string, SpKind>>;
  readonly spSources: Readonly<Record<string, number>>;
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
 * ComboSkill: 0.01 for the first 40% of the duration, then up to 1 at 93%
 * (shape from the research of 2026-10-18 on Endaxis's catalog; the ramp is
 * taken as linear). RESETto1 is 1 throughout. Others are unknown.
 */
const NAMED_CURVES: Readonly<Record<string, (t: number) => number>> = {
  ComboSkill: (t) => (t <= 0.4 ? 0.01 : t >= 0.93 ? 1 : 0.01 + ((t - 0.4) / 0.53) * 0.99),
  RESETto1: () => 1,
};

/** A global TimeDilationAction as per-frame scales (its curve over its duration, sampled mid-frame), or null when its curve is unknown. */
export function slowdownOf(o: Record<string, unknown>, intervalFrames: number): number[] | null {
  const dur = o["duration"] as { value?: number } | undefined;
  let frames = Math.round((typeof dur?.value === "number" ? dur.value : 0) * 30);
  if (o["finishByAction"] === true) frames = Math.min(frames, intervalFrames);
  if (frames <= 0) return null;
  let at: ((t: number) => number) | undefined;
  if (o["useCurveKey"] === true) at = NAMED_CURVES[String(o["curveKey"])];
  else {
    const keys = ((o["timeScaleCurve"] as { keys?: CurveKey[] } | undefined)?.keys ?? []) as CurveKey[];
    if (keys.length) at = (t) => curveAt(keys, t);
  }
  if (!at) return null;
  const f = at;
  const scales = Array.from({ length: frames }, (_, k) => Math.max(0, Math.min(1, f((k + 0.5) / frames))));
  return scales.every((x) => x >= 1) ? null : scales;
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
  const channels: { from: number; to: number; cantCastSkill: boolean; cantSwitch: boolean }[] = [];
  const slowdowns: { from: number; scales: number[] }[] = [];
  // `conditional`: under a TogglableAction or an IfElse branch, the window is open only when its condition holds (the kit says when).
  const find = (node: unknown, from: number, to: number, conditional = false) => {
    if (Array.isArray(node)) return node.forEach((x) => find(x, from, to, conditional));
    if (typeof node !== "object" || node === null) return;
    const o = node as Record<string, unknown>;
    const type = typeof o["$type"] === "string" ? o["$type"] : "";
    if (o["isEnable"] !== false && type.includes("AllowNextSkillAction")) {
      windows.push({ from, to, skills: ((o["allowedSkillIdList"] ?? []) as unknown[]).filter((x): x is string => typeof x === "string"), ...(conditional ? { conditional: true as const } : {}) });
    }
    if (o["isEnable"] !== false && type.includes("ComboCacheAction")) {
      for (const m of (o["mappingDataList"] ?? []) as Record<string, unknown>[]) if ((m["cmdType"] ?? 0) === 0 && typeof m["skillId"] === "string") inputMap.add(m["skillId"]);
    }
    if (o["isEnable"] !== false && type.includes("UltimateTimeAction")) {
      const scale = typeof o["timeScale"] === "number" ? o["timeScale"] : 0;
      slowdowns.push({ from, scales: Array.from({ length: Math.max(0, to - from) }, () => scale) });
    }
    if (o["isEnable"] !== false && type.includes("TimeDilationAction") && o["layer"] === 0) {
      const d = slowdownOf(o, to - from);
      if (d) slowdowns.push({ from, scales: d });
    }
    if (o["isEnable"] !== false && type.includes("ChannelingCastingAction")) channels.push({ from, to, cantCastSkill: o["cantCastSkill"] === true, cantSwitch: o["cantSwitchPosition"] === true });
    // A finisher's disable-cast buff for the action's frames blocks casts as a cantCastSkill channel does.
    if (o["isEnable"] !== false && type.includes("CreateBuffAction") && o["autoFinishByAction"] === true && ((o["buffs"] ?? []) as { buffId?: unknown }[]).some((b) => b.buffId === "buff_common_power_attack_disable_cast_skill")) {
      channels.push({ from, to, cantCastSkill: true, cantSwitch: false });
    }
    const under = conditional || (o["isEnable"] !== false && (type.includes("TogglableAction") || type.includes("IfElseAction")));
    for (const v of Object.values(o)) find(v, from, to, under);
  };
  const group = obj(j["actionGroupData"] ?? {}, at(ctx, "actionGroupData"));
  const jumps: { at: number; to: number; conditional: boolean }[] = [];
  const ends: number[] = [];
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
    specification: get(j, "skillSpecification", ctx, int),
    keepsChain: j["dontInterruptCombo"] === true,
    slowdowns,
    jumps: jumps.filter((j, i) => jumps.findIndex((k) => k.at === j.at && k.to === j.to && k.conditional === j.conditional) === i).sort((a, b) => a.at - b.at),
    ends: ends.sort((a, b) => a - b),
    ...(interruptibleFrom.length ? { interruptibleFrom: [...new Set(interruptibleFrom)].sort((a, b) => a - b) } : {}),
    ...(inputMap.size ? { inputMap: [...inputMap].sort() } : {}),
  };
  return { timing, defaults, statModifiers, spKinds: spKindsOf(j), spSources: spSourcesOf(j) };
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
 * have are left out.
 */
export function reachedFiles(skillId: string, isHelper: (id: string) => boolean): { kind: "skill" | "buff"; id: string; json: unknown }[] {
  const out: { kind: "skill" | "buff"; id: string; json: unknown }[] = [];
  const seen = new Set([`skill:${skillId}`]);
  const buffPath = (id: string) => join(sourceDir("rmxlinux"), "Json", "BuffData", `${id}.json`);
  const read = (kind: "skill" | "buff", id: string): unknown => {
    const ok = kind === "skill" ? isSkillFileListed(id) && existsSync(skillFilePath(id)) : BUFF_ALLOWED.some((re) => re.test(id)) && existsSync(buffPath(id));
    return ok ? parseJsonExact(readFileSync(kind === "skill" ? skillFilePath(id) : buffPath(id), "utf8")) : null;
  };
  const queue: unknown[] = [read("skill", skillId)];
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
