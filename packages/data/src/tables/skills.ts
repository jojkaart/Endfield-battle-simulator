// SkillPatchTable: per-level values of every skill (operator, weapon and
// gear set skills). These, not SkillData's own blackboard, are the real
// per-level numbers (docs/game-data-format.md).

import { DataError } from "../errors.ts";
import { arr, at, get, int, num, obj, str, type Ctx } from "../fields.ts";
import { readTable, type SourceName } from "../sources.ts";

export interface SkillLevel {
  readonly level: number;
  readonly coolDown: number;
  /** 0 = ultimate energy, 1 = SP. */
  readonly costType: number;
  readonly costValue: number;
  readonly maxChargeTime: number;
  /** Named values (atk_scale, poise, duration, …). */
  readonly blackboard: Readonly<Record<string, number>>;
}

export interface Skill {
  readonly skillId: string;
  /** Ordered by level, starting at 1. */
  readonly levels: readonly SkillLevel[];
}

function normalizeLevel(raw: unknown, ctx: Ctx, skillId: string): SkillLevel {
  const record = obj(raw, ctx);
  const id = get(record, "skillId", ctx, str);
  if (id !== skillId) throw new DataError(ctx.source, ctx.path, `skillId ${id} under key ${skillId}`);
  const blackboard: Record<string, number> = {};
  const entries = get(record, "blackboard", ctx, arr);
  entries.forEach((entry, i) => {
    const c = at(at(ctx, "blackboard"), i);
    const e = obj(entry, c);
    const key = get(e, "key", c, str);
    if (get(e, "valueStr", c, str) !== "") throw new DataError(c.source, c.path, "string blackboard values aren't supported");
    const value = get(e, "value", c, num);
    // The game data repeats some keys with the same value (Liino's
    // chr_0035_liino_normal_skill_combo lists music_trigger 3 twice, game 1.6).
    // Only a conflicting repeat is an error.
    const previous = blackboard[key];
    if (previous !== undefined && previous !== value) {
      throw new DataError(c.source, c.path, `conflicting blackboard key ${key}: ${previous} and ${value}`);
    }
    blackboard[key] = value;
  });
  return {
    level: get(record, "level", ctx, int),
    coolDown: get(record, "coolDown", ctx, num),
    costType: get(record, "costType", ctx, int),
    costValue: get(record, "costValue", ctx, num),
    maxChargeTime: get(record, "maxChargeTime", ctx, num),
    blackboard,
  };
}

export function normalizeSkills(raw: unknown, source: SourceName): Record<string, Skill> {
  const ctx: Ctx = { source, path: "SkillPatchTable" };
  const table = obj(raw, ctx);
  const skills: Record<string, Skill> = {};
  for (const skillId of Object.keys(table).sort()) {
    const c = at(ctx, skillId);
    const bundle = get(obj(table[skillId], c), "SkillPatchDataBundle", c, arr);
    const levels = bundle.map((l, i) => normalizeLevel(l, at(at(c, "SkillPatchDataBundle"), i), skillId));
    levels.forEach((l, i) => {
      if (l.level !== i + 1) throw new DataError(source, c.path, `levels out of order: index ${i} is level ${l.level}`);
    });
    skills[skillId] = { skillId, levels };
  }
  return skills;
}

export function loadSkills(source: SourceName): Record<string, Skill> {
  return normalizeSkills(readTable(source, "SkillPatchTable"), source);
}
