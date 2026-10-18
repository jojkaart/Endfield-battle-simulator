// CharacterTable: operators' base stats by level and identity fields.
// Attribute types are numeric here; naming them is a separate, verified
// mapping (docs/game-data-format.md#known-enum-values).

import { DataError } from "../errors.ts";
import { arr, at, get, int, num, obj, str, type Ctx } from "../fields.ts";
import { readTable, type SourceName } from "../sources.ts";

export interface OperatorLevelRow {
  /** Promotion stage this row belongs to; break levels appear once per stage. */
  readonly breakStage: number;
  /** Attribute type → value. Type 0 is the level. */
  readonly attrs: Readonly<Record<number, number>>;
}

export interface Operator {
  readonly charId: string;
  readonly rarity: number;
  readonly profession: number;
  readonly weaponType: number;
  readonly element: string;
  readonly mainAttrType: number;
  readonly subAttrType: number;
  readonly levelRows: readonly OperatorLevelRow[];
}

function normalizeRow(raw: unknown, ctx: Ctx): OperatorLevelRow {
  const record = obj(raw, ctx);
  const attrs: Record<number, number> = {};
  const [attribute, c] = [obj(record["Attribute"], at(ctx, "Attribute")), at(ctx, "Attribute")];
  get(attribute, "attrs", c, arr).forEach((entry, i) => {
    const ec = at(at(c, "attrs"), i);
    const e = obj(entry, ec);
    const type = get(e, "attrType", ec, int);
    if (type in attrs) throw new DataError(ec.source, ec.path, `duplicate attrType ${type}`);
    attrs[type] = get(e, "attrValue", ec, num);
  });
  return { breakStage: get(record, "breakStage", ctx, int), attrs };
}

export function normalizeOperators(raw: unknown, source: SourceName): Record<string, Operator> {
  const ctx: Ctx = { source, path: "CharacterTable" };
  const table = obj(raw, ctx);
  const operators: Record<string, Operator> = {};
  for (const charId of Object.keys(table).sort()) {
    const c = at(ctx, charId);
    const record = obj(table[charId], c);
    const id = get(record, "charId", c, str);
    if (id !== charId) throw new DataError(source, c.path, `charId ${id} under key ${charId}`);
    operators[charId] = {
      charId,
      rarity: get(record, "rarity", c, int),
      profession: get(record, "profession", c, int),
      weaponType: get(record, "weaponType", c, int),
      element: get(record, "charTypeId", c, str),
      mainAttrType: get(record, "mainAttrType", c, int),
      subAttrType: get(record, "subAttrType", c, int),
      levelRows: get(record, "attributes", c, arr).map((r, i) => normalizeRow(r, at(at(c, "attributes"), i))),
    };
  }
  return operators;
}

export function loadOperators(source: SourceName): Record<string, Operator> {
  return normalizeOperators(readTable(source, "CharacterTable"), source);
}
