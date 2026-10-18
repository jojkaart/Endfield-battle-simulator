// Reads the parts of rmxlinux's Json/SkillData files the engine needs so far:
// blackboard defaults and permanent stat effects (cardAttributeModifier).
// Only rmxlinux has these files, so there's no cross-check source.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { arr, at, get, int, num, obj, str, type Ctx } from "./fields.ts";
import { parseJsonExact } from "./json.ts";
import { DATA_FILES, sourceDir } from "./sources.ts";

export interface RawSkillFile {
  readonly defaults: Record<string, number>;
  readonly statModifiers: readonly { attr: number; slot: number; target: number; key: string | null; literal: number }[];
}

function globToRegExp(glob: string): RegExp {
  return new RegExp("^" + glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
}

const ALLOWED = DATA_FILES.skillData.map(globToRegExp);

export function isSkillFileListed(skillId: string): boolean {
  return ALLOWED.some((re) => re.test(skillId));
}

export function skillFilePath(skillId: string): string {
  return join(sourceDir("rmxlinux"), "Json", "SkillData", `${skillId}.json`);
}

/** Reads a skill file, or returns null when the game has none for this skill. */
export function readSkillFile(skillId: string): RawSkillFile | null {
  if (!isSkillFileListed(skillId)) {
    throw new Error(`skill file ${skillId} isn't covered by packages/data/tables.json skillData; add a pattern so it gets fetched`);
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
  return { defaults, statModifiers };
}
