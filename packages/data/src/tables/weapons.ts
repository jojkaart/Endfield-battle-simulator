// WeaponBasicTable and WeaponUpgradeTemplateTable (base ATK by level).

import { DataError } from "../errors.ts";
import { arr, at, get, int, obj, str } from "../fields.ts";
import { readTable, type SourceName } from "../sources.ts";
import { records } from "./common.ts";

export interface RawWeapon {
  readonly id: string;
  readonly rarity: number;
  readonly weaponType: number;
  readonly maxLevel: number;
  readonly levelTemplateId: string;
  readonly skills: readonly string[];
}

export function normalizeWeapons(raw: unknown, source: SourceName): Record<string, RawWeapon> {
  const out: Record<string, RawWeapon> = {};
  for (const [id, r, c] of records(raw, { source, path: "WeaponBasicTable" })) {
    if (get(r, "weaponId", c, str) !== id) throw new DataError(source, c.path, "weaponId doesn't match its key");
    out[id] = {
      id,
      rarity: get(r, "rarity", c, int),
      weaponType: get(r, "weaponType", c, int),
      maxLevel: get(r, "maxLv", c, int),
      levelTemplateId: get(r, "levelTemplateId", c, str),
      skills: get(r, "weaponSkillList", c, arr).map((s, i) => str(s, at(at(c, "weaponSkillList"), i))),
    };
  }
  return out;
}

/** Template → base ATK by level (index 0 = level 1). */
export function normalizeWeaponCurves(raw: unknown, source: SourceName): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [id, r, c] of records(raw, { source, path: "WeaponUpgradeTemplateTable" })) {
    const rows = get(r, "list", c, arr);
    out[id] = rows.map((row, i) => {
      const rc = at(at(c, "list"), i);
      const o = obj(row, rc);
      if (get(o, "weaponLv", rc, int) !== i + 1) throw new DataError(source, rc.path, "levels out of order");
      return get(o, "baseAtk", rc, int);
    });
  }
  return out;
}

export function loadWeapons(source: SourceName): Record<string, RawWeapon> {
  return normalizeWeapons(readTable(source, "WeaponBasicTable"), source);
}

export function loadWeaponCurves(source: SourceName): Record<string, number[]> {
  return normalizeWeaponCurves(readTable(source, "WeaponUpgradeTemplateTable"), source);
}
