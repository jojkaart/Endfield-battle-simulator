// BattleConst: global combat constants (atkRateOfMain, efficiencyOfDEF, …).

import { get, num, obj, type Ctx } from "../fields.ts";
import { readTable, type SourceName } from "../sources.ts";

export const BATTLE_CONST_KEYS = [
  "atkRateOfMain",
  "atkRateOfSub",
  "charDmgResistMinValue",
  "charResistanceMaxValue",
  "commonResistanceMaxValue",
  "efficiencyOfAGI",
  "efficiencyOfDEF",
  "efficiencyOfSTR",
  "efficiencyOfWISD",
  "enemyOHKCoefficient",
  "healerEfficiencyOfWILL",
  "maxUltimateSp",
  "poiseBreakDamageLevelModifier",
  "recoverEfficiencyOfWILL",
] as const;

export type BattleConst = Record<(typeof BATTLE_CONST_KEYS)[number], number>;

export function normalizeBattleConst(raw: unknown, source: SourceName): BattleConst {
  const ctx: Ctx = { source, path: "BattleConst" };
  const record = obj(raw, ctx);
  const extra = Object.keys(record).filter((k) => !(BATTLE_CONST_KEYS as readonly string[]).includes(k));
  if (extra.length) throw new Error(`${source}: BattleConst has unknown keys ${extra.join(", ")}`);
  return Object.fromEntries(BATTLE_CONST_KEYS.map((k) => [k, get(record, k, ctx, num)])) as BattleConst;
}

export function loadBattleConst(source: SourceName): BattleConst {
  return normalizeBattleConst(readTable(source, "BattleConst"), source);
}
