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
  const find = (node: unknown, from: number, to: number) => {
    if (Array.isArray(node)) return node.forEach((x) => find(x, from, to));
    if (typeof node !== "object" || node === null) return;
    const o = node as Record<string, unknown>;
    const type = typeof o["$type"] === "string" ? o["$type"] : "";
    if (o["isEnable"] !== false && type.includes("AllowNextSkillAction")) windows.push({ from, to, skills: ((o["allowedSkillIdList"] ?? []) as unknown[]).filter((x): x is string => typeof x === "string") });
    if (o["isEnable"] !== false && type.includes("ChannelingCastingAction")) channels.push({ from, to, cantCastSkill: o["cantCastSkill"] === true, cantSwitch: o["cantSwitchPosition"] === true });
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
  };
  return { timing, defaults, statModifiers };
}
