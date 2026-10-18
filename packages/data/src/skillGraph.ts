// Finds the damage actions in an operator's SkillData files: the starting
// point for writing a kit. It doesn't interpret the action graph (branches,
// loops, jumps); it lists where damage happens, with the blackboard key that
// scales it, so a kit can be drafted and then verified against logs.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonExact } from "./json.ts";
import { sourceDir } from "./sources.ts";

export interface DamageSite {
  /** SkillData file ID; battle logs use it as the hit's event key. */
  readonly file: string;
  /** Timeline frame range of the action, when it sits directly on the timeline. */
  readonly frames: readonly [number, number] | null;
  /** Path of control-flow actions above it (IfElse, Channeling, ForEach, …). */
  readonly within: readonly string[];
  readonly scaleKey: string | null;
  readonly scaleLiteral: number;
  readonly decorateMask: number;
  readonly damageType: number;
}

const shortType = (t: unknown) => (typeof t === "string" ? (/\.([A-Za-z0-9]+)(\+[A-Za-z]*Data)?,/.exec(t)?.[1] ?? t) : "");

function walk(node: unknown, within: string[], frames: [number, number] | null, file: string, out: DamageSite[]) {
  if (Array.isArray(node)) {
    for (const x of node) walk(x, within, frames, file, out);
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const o = node as Record<string, unknown>;
  const type = shortType(o["$type"]);
  if (Array.isArray(o["damageUnits"])) {
    for (const u of o["damageUnits"] as Record<string, unknown>[]) {
      if (u["damageAttributeType"] !== 0) continue; // 1 = poise (stagger) damage
      // An AtkScaleCalculation carries the real scale; the unit's own atkScale is then an unused 0.
      const calc = (u["atkCalculation"] ?? null) as Record<string, unknown> | null;
      const scale = ((calc && typeof calc["atkScale"] === "object" ? calc["atkScale"] : u["atkScale"]) ?? {}) as Record<string, unknown>;
      out.push({
        file,
        frames,
        within,
        scaleKey: scale["useBlackboardKey"] === true && typeof scale["blackboardKey"] === "string" ? scale["blackboardKey"] : null,
        scaleLiteral: typeof scale["value"] === "number" ? scale["value"] : 0,
        decorateMask: typeof u["damageDecorateMask"] === "number" ? u["damageDecorateMask"] : 0,
        damageType: typeof u["damageType"] === "number" ? u["damageType"] : -1,
      });
    }
  }
  const next = type && type !== "DamageAction" ? [...within, type] : within;
  for (const [k, v] of Object.entries(o)) {
    if (k === "damageUnits" || k === "$type") continue;
    walk(v, next, frames, file, out);
  }
}

/** All SkillData files of an operator (`<operator>_*`). */
export function operatorSkillFiles(operator: string): string[] {
  const dir = join(sourceDir("rmxlinux"), "Json", "SkillData");
  return readdirSync(dir)
    .filter((f) => f.startsWith(`${operator}_`) && f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .sort();
}

export function damageSites(file: string): DamageSite[] {
  const path = join(sourceDir("rmxlinux"), "Json", "SkillData", `${file}.json`);
  const j = parseJsonExact(readFileSync(path, "utf8")) as Record<string, unknown>;
  const out: DamageSite[] = [];
  const group = (j["actionGroupData"] ?? {}) as Record<string, unknown>;
  for (const ta of (group["timelineActions"] ?? []) as Record<string, unknown>[]) {
    const frames: [number, number] = [Number(ta["_startFrame"]), Number(ta["_endFrame"])];
    walk(ta["_sequenceActionData"], [], frames, file, out);
  }
  walk(group["passiveEventActions"], ["passive"], null, file, out);
  return out;
}

/** The skill a file belongs to: the longest skill ID that is the file ID or a prefix of it. */
export function parentSkill(file: string, skillIds: readonly string[]): string | null {
  let best: string | null = null;
  for (const id of skillIds) if ((file === id || file.startsWith(`${id}_`)) && (!best || id.length > best.length)) best = id;
  return best;
}
