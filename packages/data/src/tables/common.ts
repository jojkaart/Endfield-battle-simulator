// Readers shared by several tables.

import { arr, at, get, int, num, obj, str, type Ctx } from "../fields.ts";

export interface RawAttrModifier {
  readonly attr: number;
  readonly slot: number;
  readonly target: number;
  readonly value: number;
}

/** `{attrType, attrValue, modifierType, modifyAttributeType}` as used by talents and potentials. */
export function attrModifier(raw: unknown, ctx: Ctx): RawAttrModifier {
  const m = obj(raw, ctx);
  return {
    attr: get(m, "attrType", ctx, int),
    slot: get(m, "modifierType", ctx, int),
    target: get(m, "modifyAttributeType", ctx, int),
    value: get(m, "attrValue", ctx, num),
  };
}

export function blackboard(raw: unknown, ctx: Ctx): Record<string, number> {
  const out: Record<string, number> = {};
  arr(raw, ctx).forEach((entry, i) => {
    const c = at(ctx, i);
    const e = obj(entry, c);
    out[get(e, "key", c, str)] = get(e, "value", c, num);
  });
  return out;
}

/** Iterates a table's records in key order. */
export function records(raw: unknown, ctx: Ctx): [string, Record<string, unknown>, Ctx][] {
  const table = obj(raw, ctx);
  return Object.keys(table)
    .sort()
    .map((k) => {
      const c = at(ctx, k);
      return [k, obj(table[k], c), c];
    });
}
