// Reads rmxlinux's Json/BuffData files: so far a buff's attribute
// modifiers, which say what the buff changes (e.g. attribute 17 = basic
// attack DMG for Forgeborn Scathe's buff). Only rmxlinux has these files.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { arr, at, get, int, num, obj, str, type Ctx } from "./fields.ts";
import { parseJsonExact } from "./json.ts";
import { globToRegExp } from "./skillData.ts";
import { DATA_FILES, sourceDir } from "./sources.ts";

export interface RawBuffFile {
  readonly id: string;
  readonly attributeModifiers: readonly { attr: number; slot: number; target: number; key: string | null; literal: number }[];
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
  return {
    id: buffId,
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
