// Reads rmxlinux's Json/BuffData files: a buff's attribute modifiers, which
// say what the buff changes (e.g. attribute 17 = basic attack DMG for
// Forgeborn Scathe's buff), how it stacks, and which hits its damage
// modifiers are limited to. Only rmxlinux has these files.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { arr, at, get, int, num, obj, str, type Ctx } from "./fields.ts";
import { parseJsonExact } from "./json.ts";
import type { PerfectDodge } from "@efsim/engine";
import { globToRegExp, isSkillFileListed as ALLOWED_SKILL_FILE, slowdownOf } from "./skillData.ts";
import { DATA_FILES, sourceDir } from "./sources.ts";

export interface RawBuffFile {
  readonly id: string;
  readonly attributeModifiers: readonly { attr: number; slot: number; target: number; key: string | null; literal: number }[];
  readonly stacking: {
    /**
     * stackingSettings.stackingType. 1: only the strongest instance counts
     * ("effects of the same name don't stack"). A priority key alone doesn't
     * mean that: `buff_common_affixes_vulnerable_crystal` (type 0, priority
     * `rate`) from two sources adds up in btl_upload_b7b3762d5da8.
     */
    readonly type: number;
    /** A literal maximum stack count, or null when none or set from a blackboard key. */
    readonly maxStacks: number | null;
    /** The blackboard key the applying skill sets the maximum with (useMaxStackCntKey), e.g. `max_stack`. */
    readonly maxStacksKey: string | null;
    /** stackingSettings.stackingKey: buffs of different files with one key are one buff for stacking (Liino's two stances: `liino_atk_up`). */
    readonly key: string | null;
  };
  /**
   * The decorate-mask condition every damage modifier of the buff shares
   * (CheckDamageDecorateMask: checkType, mask), or null when there is none
   * or they differ.
   */
  readonly damageMask: { readonly checkType: number; readonly mask: number } | null;
}

const ALLOWED = DATA_FILES.json.BuffData.map(globToRegExp);

export function isBuffFileListed(buffId: string): boolean {
  return ALLOWED.some((re) => re.test(buffId));
}

/** Reads a buff file, or returns null when the game has none for this ID. */
export function readBuffFile(buffId: string): RawBuffFile | null {
  if (!isBuffFileListed(buffId)) {
    throw new Error(`buff file ${buffId} isn't covered by packages/data/tables.json json.BuffData; add a pattern so it gets fetched`);
  }
  const file = join(sourceDir("rmxlinux"), "Json", "BuffData", `${buffId}.json`);
  if (!existsSync(file)) return null;
  const ctx: Ctx = { source: "rmxlinux", path: `BuffData/${buffId}` };
  const j = obj(parseJsonExact(readFileSync(file, "utf8")), ctx);
  const ac = at(ctx, "attributeModifier");
  const mods = get(obj(j["attributeModifier"], ac), "attributeModifiers", ac, arr);
  const sc = at(ctx, "stackingSettings");
  const stackingRaw = obj(j["stackingSettings"], sc);
  const literalMax = get(stackingRaw, "maxStackCnt", sc, int);
  const masks = (Array.isArray(j["damageModifier"]) ? (j["damageModifier"] as unknown[]) : []).map((dm, i) => {
    const dc = at(at(ctx, "damageModifier"), i);
    const cond = obj(dm, dc)["condition"];
    const actions = cond && typeof cond === "object" && Array.isArray((cond as Record<string, unknown>)["actionData"]) ? ((cond as Record<string, unknown>)["actionData"] as unknown[]) : [];
    const found = actions
      .map((a) => a as Record<string, unknown>)
      .filter((a) => typeof a["$type"] === "string" && (a["$type"] as string).includes("CheckDamageDecorateMask") && a["isEnable"] === true)
      .map((a) => `${get(a, "checkType", dc, int)}:${get(a, "mask", dc, int)}`);
    return found.length === 1 ? (found[0] as string) : found.length === 0 ? "" : "many";
  });
  const shared = masks.length > 0 && masks.every((m) => m === masks[0]) && masks[0] !== "" && masks[0] !== "many" ? (masks[0] as string).split(":").map(Number) : null;
  return {
    id: buffId,
    stacking: {
      type: get(stackingRaw, "stackingType", sc, int),
      maxStacks: stackingRaw["useMaxStackCntKey"] === true || literalMax <= 0 ? null : literalMax,
      maxStacksKey: stackingRaw["useMaxStackCntKey"] === true && typeof stackingRaw["maxStackCntKey"] === "string" ? (stackingRaw["maxStackCntKey"] as string) : null,
      key: typeof stackingRaw["stackingKey"] === "string" && stackingRaw["stackingKey"] !== "" ? (stackingRaw["stackingKey"] as string) : null,
    },
    damageMask: shared ? { checkType: shared[0] as number, mask: shared[1] as number } : null,
    attributeModifiers: mods.map((m, i) => {
      const mc = at(at(ac, "attributeModifiers"), i);
      const mo = obj(m, mc);
      const pc = at(mc, "param");
      const param = obj(mo["param"], pc);
      return {
        attr: get(mo, "attributeType", mc, int),
        slot: get(mo, "formulaItem", mc, int),
        target: get(mo, "modifyAttributeType", mc, int),
        key: param["useBlackboardKey"] === true ? get(param, "blackboardKey", pc, str) : null,
        literal: get(param, "value", pc, num),
      };
    }),
  };
}

const SKILL_SLOTS = ["battle", "combo", "ultimate"] as const;

/**
 * Skills an operator's own buff and skill files switch a skill slot to
 * (ChangeSkillAction `targetSkillId`, `skillSlot` 0 battle, 1 combo, 2
 * ultimate): Si's Final Stroke, which CharGrowthTable puts in no skill
 * group. Only files tables.json covers are read.
 */
export function switchedSkills(charId: string): Map<string, (typeof SKILL_SLOTS)[number]> {
  const out = new Map<string, (typeof SKILL_SLOTS)[number]>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || node === null) return;
    const o = node as Record<string, unknown>;
    if (typeof o["$type"] === "string" && o["$type"].includes("ChangeSkillAction") && typeof o["targetSkillId"] === "string") {
      const slot = SKILL_SLOTS[Number(o["skillSlot"])];
      if (slot) out.set(o["targetSkillId"], slot);
    }
    for (const v of Object.values(o)) walk(v);
  };
  for (const [dir, prefix, listed] of [["BuffData", `buff_${charId}`, isBuffFileListed], ["SkillData", charId, (id: string) => ALLOWED_SKILL_FILE(id)]] as const) {
    const path = join(sourceDir("rmxlinux"), "Json", dir);
    if (!existsSync(path)) continue;
    for (const f of readdirSync(path)) {
      const id = f.replace(/\.json$/, "");
      if (!f.endsWith(".json") || !id.startsWith(prefix) || !listed(id)) continue;
      const text = readFileSync(join(path, f), "utf8");
      if (text.includes("ChangeSkillAction")) walk(JSON.parse(text));
    }
  }
  return out;
}

/**
 * Helper skills an operator's skills reach through CastSkill (and those
 * reach in turn) that no skill group lists: Purrchena's shield loop and
 * blocks. Each maps to its owner, the listed skill whose ID is the longest
 * prefix of the helper's (else the skill that casts it): the helper is in
 * the owner's group and takes its level values. Only listed SkillData files
 * are read, and only helpers with a file are returned.
 */
export function castHelpers(groups: Readonly<Record<string, string>>): Map<string, string> {
  const out = new Map<string, string>();
  const known = new Set(Object.keys(groups));
  const queue = [...known];
  const path = join(sourceDir("rmxlinux"), "Json", "SkillData");
  const fileOf = (id: string) => (ALLOWED_SKILL_FILE(id) && existsSync(join(path, `${id}.json`)) ? join(path, `${id}.json`) : null);
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const file = fileOf(id);
    if (!file) continue;
    const text = readFileSync(file, "utf8");
    if (!text.includes("CastSkill+Data")) continue;
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (typeof node !== "object" || node === null) return;
      const o = node as Record<string, unknown>;
      if (typeof o["$type"] === "string" && o["$type"].includes("CastSkill+Data") && o["isEnable"] !== false) {
        const target = (o["skillId"] as { value?: unknown } | undefined)?.value;
        if (typeof target === "string" && !known.has(target) && fileOf(target)) {
          known.add(target);
          queue.push(target);
          const prefix = Object.keys(groups).filter((g) => target.startsWith(`${g}_`)).sort((a, b) => b.length - a.length)[0];
          out.set(target, prefix ?? out.get(id) ?? id);
        }
      }
      for (const v of Object.values(o)) walk(v);
    };
    walk(JSON.parse(text));
  }
  return out;
}

/**
 * When an Arts Burst deals its damage: its buff
 * (buff_common_<e>_<e>_triggered) does it in its first tick, after one
 * triggerInterval when waitFirstTriggerInterval is set (frames per element;
 * the elements whose file isn't fetched are left out).
 */
export function burstDelays(): Partial<Record<"fire" | "pulse" | "cryst" | "natural", number>> {
  const out: Partial<Record<"fire" | "pulse" | "cryst" | "natural", number>> = {};
  for (const e of ["fire", "pulse", "cryst", "natural"] as const) {
    const file = join(sourceDir("rmxlinux"), "Json", "BuffData", `buff_common_${e}_${e}_triggered.json`);
    if (!existsSync(file)) continue;
    const b = JSON.parse(readFileSync(file, "utf8")) as { triggerInterval?: { value?: number }; waitFirstTriggerInterval?: boolean };
    out[e] = b.waitFirstTriggerInterval ? Math.round((b.triggerInterval?.value ?? 0) * 30) : 0;
  }
  return out;
}

/** Frames the perfect-dodge skill holds the dodger (common_character_perfect_dodge: durationFrame 15, exclusiveFrame 15; its SkillData isn't fetched). */
const PERFECT_DODGE_SKILL_FRAMES = 15;

/**
 * A perfect dodge, from the game's own buffs: the dash (buff_common_dash)
 * makes the dodger immune for its duration, and an enemy hit landing on it
 * then (buff_common_dash_behit_listener, abilityEvent 101) is perfectly
 * dodged: SP (`atb`), a global slow-down the dodger is exempt from
 * (TimeDilationAction layer 0, cooldowns untouched), and the dodger's own
 * freeze (layer 1). Null when the files aren't fetched.
 */
export function perfectDodgeData(): PerfectDodge | null {
  const read = (id: string) => {
    const file = join(sourceDir("rmxlinux"), "Json", "BuffData", `${id}.json`);
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>) : null;
  };
  const dash = read("buff_common_dash");
  const listener = read("buff_common_dash_behit_listener");
  if (!dash || !listener) return null;
  const seconds = (v: unknown) => Number((v as { value?: unknown } | undefined)?.value ?? 0);
  const sp = ((listener["blackboard"] ?? []) as { key?: unknown; valueDouble?: unknown }[]).find((b) => b.key === "atb")?.valueDouble;
  // The melee listener (the first: abilityEvent 101); the projectile one (161) differs only in its slow-downs' lengths.
  const melee = ((listener["abilityEventAction"] ?? []) as Record<string, unknown>[])[0];
  const dilations: Record<string, unknown>[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || node === null) return;
    const o = node as Record<string, unknown>;
    if (typeof o["$type"] === "string" && o["$type"].includes("TimeDilationAction") && o["isEnable"] !== false) dilations.push(o);
    for (const v of Object.values(o)) walk(v);
  };
  walk(melee);
  const layer = (n: number) => {
    const o = dilations.find((d) => d["layer"] === n);
    return o ? (slowdownOf(o, Infinity) ?? []) : [];
  };
  if (typeof sp !== "number") throw new Error("buff_common_dash_behit_listener: no atb in its blackboard");
  return {
    windowFrames: Math.round(seconds(dash["duration"]) * 30),
    sp,
    slowdown: layer(0),
    dodgerSlowdown: layer(1),
    busyFrames: PERFECT_DODGE_SKILL_FRAMES,
  };
}
