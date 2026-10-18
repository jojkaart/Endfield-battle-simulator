// EquipTable (gear pieces and their stat lines by artificing level) and
// EquipSuitTable (gear sets).

import { DataError } from "../errors.ts";
import { arr, at, get, int, num, obj, str } from "../fields.ts";
import { readTable, type SourceName } from "../sources.ts";
import { records } from "./common.ts";

export interface RawGear {
  readonly id: string;
  readonly part: number;
  readonly setId: string | null;
  readonly lines: readonly { line: number; attr: number; slot: number; target: number; values: readonly number[] }[];
}

export interface RawGearSet {
  readonly id: string;
  readonly piecesRequired: number;
  readonly skillId: string;
  readonly skillLevel: number;
}

export function normalizeGear(raw: unknown, source: SourceName): Record<string, RawGear> {
  const out: Record<string, RawGear> = {};
  for (const [id, r, c] of records(raw, { source, path: "EquipTable" })) {
    if (get(r, "itemId", c, str) !== id) throw new DataError(source, c.path, "itemId doesn't match its key");
    const setId = get(r, "suitID", c, str);
    out[id] = {
      id,
      part: get(r, "partType", c, int),
      setId: setId === "" ? null : setId,
      // equipAttrModifiers already splits composite stats (e.g. "Heat and
      // Nature DMG" into one line each for attribute 51 and 54).
      lines: get(r, "equipAttrModifiers", c, arr).map((m, i) => {
        const mc = at(at(c, "equipAttrModifiers"), i);
        const mo = obj(m, mc);
        return {
          line: get(mo, "attrIndex", mc, int),
          attr: get(mo, "attrType", mc, int),
          slot: get(mo, "modifierType", mc, int),
          target: get(mo, "modifyAttributeType", mc, int),
          values: get(mo, "attrValues", mc, arr).map((v, j) => num(v, at(at(mc, "attrValues"), j))),
        };
      }),
    };
  }
  return out;
}

export function normalizeGearSets(raw: unknown, source: SourceName): Record<string, RawGearSet> {
  const out: Record<string, RawGearSet> = {};
  for (const [id, r, c] of records(raw, { source, path: "EquipSuitTable" })) {
    const list = get(r, "list", c, arr);
    if (list.length !== 1) throw new DataError(source, c.path, `expected one set effect, found ${list.length}`);
    const lc = at(at(c, "list"), 0);
    const l = obj(list[0], lc);
    if (get(l, "suitID", lc, str) !== id) throw new DataError(source, lc.path, "suitID doesn't match its key");
    out[id] = {
      id,
      piecesRequired: get(l, "equipCnt", lc, int),
      skillId: get(l, "skillID", lc, str),
      skillLevel: get(l, "skillLv", lc, int),
    };
  }
  return out;
}

export function loadGear(source: SourceName): Record<string, RawGear> {
  return normalizeGear(readTable(source, "EquipTable"), source);
}

export function loadGearSets(source: SourceName): Record<string, RawGearSet> {
  return normalizeGearSets(readTable(source, "EquipSuitTable"), source);
}
