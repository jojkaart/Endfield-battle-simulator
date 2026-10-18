// Reads rmxlinux's Json/BuffData files: a buff's attribute modifiers, which
// say what the buff changes (e.g. attribute 17 = basic attack DMG for
// Forgeborn Scathe's buff), how it stacks, and which hits its damage
// modifiers are limited to. Only rmxlinux has these files.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { arr, at, get, int, num, obj, str, type Ctx } from "./fields.ts";
import { parseJsonExact } from "./json.ts";
import { globToRegExp } from "./skillData.ts";
import { DATA_FILES, sourceDir } from "./sources.ts";

export interface RawBuffFile {
  readonly id: string;
  readonly attributeModifiers: readonly { attr: number; slot: number; target: number; key: string | null; literal: number }[];
  readonly stacking: {
    /** stackingSettings.stackingType; 1 = keyed by priority (only the strongest instance counts). */
    readonly type: number;
    /** A literal maximum stack count, or null when none or set from a blackboard key. */
    readonly maxStacks: number | null;
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
