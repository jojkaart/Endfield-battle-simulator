// EnemyAttributeTemplateTable: enemy stats by level, level-independent
// attributes (stagger HP, finisher multiplier, …) and resistances.

import { DataError } from "../errors.ts";
import { arr, at, get, int, num, obj, type Ctx } from "../fields.ts";
import { readTable, type SourceName } from "../sources.ts";
import { records } from "./common.ts";

export interface RawEnemy {
  readonly id: string;
  readonly levels: readonly Record<number, number>[];
  readonly staticAttrs: Record<number, number>;
  readonly resistance: { physical: number; fire: number; pulse: number; cryst: number; natural: number };
}

function attrs(raw: unknown, ctx: Ctx): Record<number, number> {
  const out: Record<number, number> = {};
  get(obj(raw, ctx), "attrs", ctx, arr).forEach((a, i) => {
    const c = at(at(ctx, "attrs"), i);
    const o = obj(a, c);
    const type = get(o, "attrType", c, int);
    if (type in out) throw new DataError(ctx.source, c.path, `duplicate attrType ${type}`);
    out[type] = get(o, "attrValue", c, num);
  });
  return out;
}

export function normalizeEnemies(raw: unknown, source: SourceName): Record<string, RawEnemy> {
  const out: Record<string, RawEnemy> = {};
  for (const [id, r, c] of records(raw, { source, path: "EnemyAttributeTemplateTable" })) {
    const levels = get(r, "levelDependentAttributes", c, arr).map((l, i) => attrs(l, at(at(c, "levelDependentAttributes"), i)));
    levels.forEach((l, i) => {
      if (l[0] !== i + 1) throw new DataError(source, c.path, `level row ${i} is level ${l[0]}`);
    });
    out[id] = {
      id,
      levels,
      staticAttrs: attrs(r["levelIndependentAttributes"], at(c, "levelIndependentAttributes")),
      resistance: {
        physical: get(r, "physicalResistance", c, num),
        fire: get(r, "fireResistance", c, num),
        pulse: get(r, "pulseResistance", c, num),
        cryst: get(r, "crystResistance", c, num),
        natural: get(r, "naturalResistance", c, num),
      },
    };
  }
  return out;
}

export function loadEnemies(source: SourceName): Record<string, RawEnemy> {
  return normalizeEnemies(readTable(source, "EnemyAttributeTemplateTable"), source);
}
