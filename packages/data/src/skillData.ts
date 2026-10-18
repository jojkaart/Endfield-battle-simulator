// Reads the parts of rmxlinux's Json/SkillData files the engine needs so far:
// blackboard defaults and permanent stat effects (cardAttributeModifier).
// Only rmxlinux has these files, so there's no cross-check source.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { arr, at, get, int, num, obj, str, type Ctx } from "./fields.ts";
import { parseJsonExact } from "./json.ts";
import { DATA_FILES, sourceDir } from "./sources.ts";
import type { SkillTiming } from "@efsim/engine";

export interface RawSkillFile {
  /** When the skill lets its operator act again (engine SkillTiming). */
  readonly timing: SkillTiming;
  readonly defaults: Record<string, number>;
  readonly statModifiers: readonly { attr: number; slot: number; target: number; key: string | null; literal: number }[];
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
function slowdownOf(o: Record<string, unknown>, intervalFrames: number): number[] | null {
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
  const windows: { from: number; to: number; skills: string[] }[] = [];
  const channels: { from: number; to: number; cantCastSkill: boolean; cantSwitch: boolean }[] = [];
  const slowdowns: { from: number; scales: number[] }[] = [];
  const find = (node: unknown, from: number, to: number) => {
    if (Array.isArray(node)) return node.forEach((x) => find(x, from, to));
    if (typeof node !== "object" || node === null) return;
    const o = node as Record<string, unknown>;
    const type = typeof o["$type"] === "string" ? o["$type"] : "";
    if (o["isEnable"] !== false && type.includes("AllowNextSkillAction")) windows.push({ from, to, skills: ((o["allowedSkillIdList"] ?? []) as unknown[]).filter((x): x is string => typeof x === "string") });
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
    for (const v of Object.values(o)) find(v, from, to);
  };
  const group = obj(j["actionGroupData"] ?? {}, at(ctx, "actionGroupData"));
  for (const ta of (group["timelineActions"] ?? []) as Record<string, unknown>[]) {
    const from = Number(ta["_startFrame"]);
    find(ta["_sequenceActionData"], from, ta["_endFrame"] === undefined ? from : Number(ta["_endFrame"]));
  }
  const timing: SkillTiming = {
    durationFrames: get(j, "durationFrame", ctx, int),
    exclusiveFrames: get(j, "exclusiveFrame", ctx, int),
    windows: windows.sort((a, b) => a.from - b.from),
    channels,
    specification: get(j, "skillSpecification", ctx, int),
    keepsChain: j["dontInterruptCombo"] === true,
    slowdowns,
  };
  return { timing, defaults, statModifiers };
}
