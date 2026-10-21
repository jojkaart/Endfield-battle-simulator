// EnemyAttributeTemplateTable: enemy stats by level, level-independent
// attributes (stagger HP, finisher multiplier, …) and resistances.

import { DataError } from "../errors.ts";
import { arr, at, get, int, num, obj, str, type Ctx } from "../fields.ts";
import { readTable, type SourceName } from "../sources.ts";
import { records } from "./common.ts";

export interface RawEnemy {
  readonly id: string;
  readonly levels: readonly Record<number, number>[];
  readonly staticAttrs: Record<number, number>;
  readonly resistance: { physical: number; fire: number; pulse: number; cryst: number; natural: number };
  /** SP the team gets for a finisher on it (breakingAttackedAtbObtain). */
  readonly finisherSp: number;
  /** Stagger nodes: fractions of its stagger HP that trigger a small stagger (poiseKnotPctList). */
  readonly staggerNodes: readonly number[];
  /** Super armor (initialSuperArmor), and while Staggered (zeroPoiseSuperArmor): CheckSuperArmor reads it. */
  readonly superArmor: { readonly initial: number; readonly staggered: number };
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
      finisherSp: get(r, "breakingAttackedAtbObtain", c, num),
      superArmor: { initial: get(r, "initialSuperArmor", c, num), staggered: get(r, "zeroPoiseSuperArmor", c, num) },
      staggerNodes: get(r, "poiseKnotPctList", c, arr).map((x, i) => {
        if (typeof x !== "number") throw new DataError(source, `${c.path}.poiseKnotPctList[${i}]`, "not a number");
        return x;
      }),
    };
  }
  return out;
}

export function loadEnemies(source: SourceName): Record<string, RawEnemy> {
  return normalizeEnemies(readTable(source, "EnemyAttributeTemplateTable"), source);
}

/** An EnemyTable entry: an enemy ID and the attribute template it uses, with that entry's stat modifiers. */
export interface EnemyAlias {
  readonly id: string;
  readonly template: string;
  /**
   * attrModifiers on every level's attribute: modifierType 0 adds `value`, 1 multiplies by 1 + `value` (ATK −0.3,
   * HP +0.5), 4 multiplies by `value` (a reading: only HP and stagger HP use it, e.g. stagger HP × 0.0 on enemies that
   * can't be staggered).
   */
  readonly modifiers: readonly { readonly attr: number; readonly value: number; readonly kind: 0 | 1 | 4 }[];
}

/** EnemyTable: enemy IDs (stage variants like `eny_0120_klbear_tower015`) → their attribute templates. */
export function loadEnemyAliases(source: SourceName): Record<string, EnemyAlias> {
  const out: Record<string, EnemyAlias> = {};
  for (const [id, r, c] of records(readTable(source, "EnemyTable"), { source, path: "EnemyTable" })) {
    const modifiers = get(r, "attrModifiers", c, arr).map((m, i) => {
      const mc = at(at(c, "attrModifiers"), i);
      const o = obj(m, mc);
      const kind = get(o, "modifierType", mc, int);
      if (kind !== 0 && kind !== 1 && kind !== 4) throw new DataError(source, mc.path, `unknown modifierType ${kind}`);
      if (get(o, "modifyAttributeType", mc, int) !== 0) throw new DataError(source, mc.path, "modifyAttributeType isn't 0");
      return { attr: get(o, "attrType", mc, int), value: get(o, "attrValue", mc, num), kind: kind as 0 | 1 | 4 };
    });
    out[id] = { id, template: get(r, "attrTemplateId", c, str), modifiers };
  }
  return out;
}

/** DungeonTable: each stage's enemies and their levels (stages whose two lists differ in length are left out). */
export function loadStageEnemies(source: SourceName): Record<string, readonly { readonly id: string; readonly level: number }[]> {
  const out: Record<string, { id: string; level: number }[]> = {};
  for (const [id, r, c] of records(readTable(source, "DungeonTable"), { source, path: "DungeonTable" })) {
    const ids = get(r, "enemyIds", c, arr);
    const levels = get(r, "enemyLevels", c, arr);
    // A few stages list a different number of levels (dung01_takestwo003_hard): they don't say which enemy has which.
    if (ids.length !== levels.length) continue;
    out[id] = ids.map((e, i) => ({ id: str(e, at(at(c, "enemyIds"), i)), level: int(levels[i], at(at(c, "enemyLevels"), i)) }));
  }
  return out;
}
