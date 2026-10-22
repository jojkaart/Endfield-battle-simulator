// UseItemTable: items an operator can use (foods, medicines, vouchers),
// with what using one does. Food buffs (data/foods.ts) are the items whose
// buffs persist (isPersistentBuff) for one operator.

import { DataError } from "../errors.ts";
import { arr, at, get, int, obj, str, type Ctx } from "../fields.ts";
import { readTable, type SourceName } from "../sources.ts";
import { blackboard, records } from "./common.ts";

export interface RawUseAction {
  /** 2: create a buff (buffBBData); 3 appears on team items. */
  readonly useType: number;
  /** The buff it creates, or null when none. */
  readonly buffId: string | null;
  /** The created buff's values (key → value): what the buff's blackboard keys read. */
  readonly blackboard: Readonly<Record<string, number>>;
  /** A skill it casts (skillBBData), or null when none. */
  readonly skillId: string | null;
}

export interface RawUseItem {
  readonly id: string;
  /** 0 used in battle (heals, ultimate energy), 1 deployables, 2 buffs and vouchers. */
  readonly effectType: number;
  readonly persistentBuff: boolean;
  /** Items with one stacking key don't stack: the newer replaces the older (all food buffs: `buff`). */
  readonly stackingKey: string;
  /** 0: one operator. */
  readonly targetNumType: number;
  /** Seconds (0 for instant items). */
  readonly duration: number;
  readonly actions: readonly RawUseAction[];
}

function bool(value: unknown, ctx: Ctx): boolean {
  if (typeof value === "boolean") return value;
  throw new DataError(ctx.source, ctx.path, `expected true or false, got ${JSON.stringify(value)}`);
}

export function normalizeUseItems(raw: unknown, source: SourceName): Record<string, RawUseItem> {
  const out: Record<string, RawUseItem> = {};
  for (const [id, r, c] of records(raw, { source, path: "UseItemTable" })) {
    if (get(r, "itemId", c, str) !== id) throw new DataError(source, c.path, "itemId doesn't match its key");
    out[id] = {
      id,
      effectType: get(r, "effectType", c, int),
      persistentBuff: get(r, "isPersistentBuff", c, bool),
      stackingKey: get(r, "stackingKey", c, str),
      targetNumType: get(r, "targetNumType", c, int),
      duration: get(r, "duration", c, int),
      actions: get(r, "useActions", c, arr).map((a, i) => {
        const ac = at(at(c, "useActions"), i);
        const ao = obj(a, ac);
        const bc = at(ac, "buffBBData");
        const buff = obj(ao["buffBBData"], bc);
        const sc = at(ac, "skillBBData");
        const skill = obj(ao["skillBBData"], sc);
        const buffId = get(buff, "buffId", bc, str);
        const skillId = get(skill, "skillId", sc, str);
        return {
          useType: get(ao, "useType", ac, int),
          buffId: buffId === "" ? null : buffId,
          blackboard: blackboard(get(buff, "blackboard", bc, arr), at(bc, "blackboard")),
          skillId: skillId === "" ? null : skillId,
        };
      }),
    };
  }
  return out;
}

export function loadUseItems(source: SourceName): Record<string, RawUseItem> {
  return normalizeUseItems(readTable(source, "UseItemTable"), source);
}
