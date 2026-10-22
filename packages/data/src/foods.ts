// Food buffs (Build.food): the usable items of UseItemTable whose buffs
// persist on one operator (effectType 2, isPersistentBuff), with each buff's
// attribute modifiers (rmxlinux Json/BuffData buff_common_*_potion_*) at the
// item's values. Checked: anything a food does beyond changing attributes
// for a while (a dispel, a heal, an instant ultimate-energy gain, a damage
// modifier) is refused, so a food never loads half understood.

import type { FoodData } from "@efsim/engine";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isBuffFileListed, readBuffFile } from "./buffData.ts";
import { DataError } from "./errors.ts";
import { parseJsonExact } from "./json.ts";
import { PRIMARY, sourceDir } from "./sources.ts";
import type { RawUseItem } from "./tables/useItems.ts";

/** UseItemTable's stacking key of every food buff: one food per operator, a new one replacing the old (the build's single `food`). */
const FOOD_STACKING_KEY = "buff";

/** Action types a food's buff may carry: presentation only (its sound and visual effect). */
const PRESENTATION = new Set(["Beyond.Gameplay.Core.PlaySoundAction+PlaySoundActionData", "Beyond.Gameplay.Core.EffectAction+EffectActionData"]);

/** The action types (enabled ones) anywhere under a node. */
function actionTypes(node: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) node.forEach((n) => actionTypes(n, out));
  else if (typeof node === "object" && node !== null) {
    const o = node as Record<string, unknown>;
    if (typeof o["$type"] === "string" && o["isEnable"] !== false) out.add((o["$type"] as string).split(",")[0] as string);
    for (const v of Object.values(o)) actionTypes(v, out);
  }
  return out;
}

/** A food's buff, checked: its attribute modifiers at the item's values, and its duration. */
function foodBuff(item: RawUseItem, buffId: string, bb: Readonly<Record<string, number>>): { buffId: string; modifiers: FoodData["buffs"][number]["modifiers"]; duration: number } {
  const where = `UseItemTable.${item.id}`;
  if (!isBuffFileListed(buffId)) throw new DataError(PRIMARY, where, `buff ${buffId} isn't covered by packages/data/tables.json json.BuffData`);
  const file = join(sourceDir(PRIMARY), "Json", "BuffData", `${buffId}.json`);
  if (!existsSync(file)) throw new DataError(PRIMARY, where, `buff ${buffId} has no BuffData file`);
  const raw = parseJsonExact(readFileSync(file, "utf8")) as Record<string, unknown>;
  const path = `BuffData/${buffId}`;
  // What it does besides its attribute modifiers: only presentation is understood.
  const extra = [...actionTypes(Object.entries(raw).filter(([k]) => k !== "attributeModifier"))].filter((t) => !PRESENTATION.has(t));
  if (extra.length) throw new DataError(PRIMARY, path, `food ${item.id}: its buff does more than change attributes (${extra.join(", ")}); not supported`);
  const buff = readBuffFile(buffId);
  if (!buff) throw new DataError(PRIMARY, path, "missing");
  if (buff.attributeModifiers.length === 0) throw new DataError(PRIMARY, path, `food ${item.id}: its buff changes no attribute`);
  // Several instances would need stacking rules; every food buff holds one (stackingSettings maxStackCnt 1).
  if (buff.stacking.maxStackCnt !== 1) throw new DataError(PRIMARY, path, `food ${item.id}: its buff stacks to ${buff.stacking.maxStackCnt}; only single-instance buffs are supported`);
  const value = (key: string | null, literal: number, what: string): number => {
    if (key === null) return literal;
    const v = bb[key];
    if (v === undefined) throw new DataError(PRIMARY, where, `${buffId}'s ${what} reads ${key}, which the item doesn't set`);
    return v;
  };
  const d = raw["duration"] as { useBlackboardKey?: unknown; blackboardKey?: unknown; value?: unknown } | undefined;
  if (typeof d !== "object" || d === null || typeof d.value !== "number") throw new DataError(PRIMARY, `${path}.duration`, "expected {useBlackboardKey, blackboardKey, value}");
  const duration = value(d.useBlackboardKey === true ? String(d.blackboardKey) : null, d.value, "duration");
  return {
    buffId,
    modifiers: buff.attributeModifiers.map((m) => ({ attr: m.attr, slot: m.slot, target: m.target, value: value(m.key, m.literal, `attribute ${m.attr}`) })),
    duration,
  };
}

/**
 * The food buffs among the usable items, by item ID, with English names;
 * and every other usable item with why it isn't one. A food whose shape
 * isn't understood (another target, stacking key or action, buffs of
 * different durations) is a DataError.
 */
export function loadFoods(items: Readonly<Record<string, RawUseItem>>, name: (id: string) => string): { foods: Record<string, FoodData>; notFoods: Record<string, string> } {
  const foods: Record<string, FoodData> = {};
  const notFoods: Record<string, string> = {};
  for (const item of Object.values(items)) {
    const where = `UseItemTable.${item.id}`;
    const buffs = item.actions.flatMap((a) => (a.buffId ? [a.buffId] : []));
    if (!(item.effectType === 2 && item.persistentBuff)) {
      notFoods[item.id] = buffs.length
        ? `isn't a food buff: UseItemTable lists it as an item used for an instant effect (${buffs.join(", ")}), not buffs that last from the fight's start; not simulated`
        : "isn't a food buff (UseItemTable: no buff)";
      continue;
    }
    if (item.stackingKey !== FOOD_STACKING_KEY) throw new DataError(PRIMARY, where, `stacking key ${JSON.stringify(item.stackingKey)}, not ${FOOD_STACKING_KEY}: it could be held beside another food, which builds can't say`);
    if (item.targetNumType !== 0) throw new DataError(PRIMARY, where, `targetNumType ${item.targetNumType}: only foods for one operator (0) are supported`);
    if (!(item.duration > 0)) throw new DataError(PRIMARY, where, `duration ${item.duration}`);
    const read = item.actions.map((a, i) => {
      if (a.useType !== 2 || a.buffId === null || a.skillId !== null) throw new DataError(PRIMARY, `${where}.useActions[${i}]`, `useType ${a.useType}${a.skillId ? `, skill ${a.skillId}` : ""}: only actions that create a buff are supported`);
      return foodBuff(item, a.buffId, a.blackboard);
    });
    if (read.length === 0) throw new DataError(PRIMARY, where, "a persistent buff item with no buff");
    const off = read.find((b) => b.duration !== item.duration);
    if (off) throw new DataError(PRIMARY, where, `${off.buffId} lasts ${off.duration} s, the item ${item.duration} s; foods whose buffs end at different times aren't supported`);
    foods[item.id] = { id: item.id, name: name(item.id), duration: item.duration, buffs: read.map((b) => ({ buffId: b.buffId, modifiers: b.modifiers })) };
  }
  return { foods, notFoods };
}
