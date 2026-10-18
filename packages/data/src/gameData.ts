// Builds the engine's GameData from the primary source (rmxlinux), with
// English names. Loading takes a few seconds, so the result is cached.

import type {
  AttrModifier,
  Effect,
  EnemyData,
  GameData,
  GearData,
  GearSetData,
  OperatorData,
  SkillData,
  WeaponData,
} from "@efsim/engine";
import { DataError } from "./errors.ts";
import { at, get, obj, type Ctx } from "./fields.ts";
import { Names } from "./names.ts";
import { isSkillFileListed, readSkillFile } from "./skillData.ts";
import { PRIMARY, readTable, sourceCommit, SOURCES } from "./sources.ts";
import { loadBattleConst } from "./tables/battleConst.ts";
import type { RawAttrModifier } from "./tables/common.ts";
import { loadEnemies } from "./tables/enemies.ts";
import { loadGear, loadGearSets } from "./tables/equip.ts";
import { loadGrowth } from "./tables/growth.ts";
import { loadOperators } from "./tables/operators.ts";
import { loadEffects, loadPotentials, type RawEffect } from "./tables/potentials.ts";
import { loadSkills } from "./tables/skills.ts";
import { loadWeaponCurves, loadWeapons } from "./tables/weapons.ts";

const modifier = (m: RawAttrModifier): AttrModifier => ({ attr: m.attr, slot: m.slot, target: m.target, value: m.value });

const toEffect = (e: RawEffect): Effect => (e.kind === "attr" ? { kind: "attr", modifier: modifier(e.modifier) } : e);

/** Reads `table[id].field` as a text reference and resolves it. */
function nameLookup(names: Names, table: string, field: string): (id: string) => string {
  const ctx: Ctx = { source: PRIMARY, path: table };
  const raw = obj(readTable(PRIMARY, table), ctx);
  return (id) => {
    const c = at(ctx, id);
    return names.resolve(get(obj(raw[id], c), field, c, (v) => v), at(c, field));
  };
}

function build(): GameData {
  const names = new Names();
  const effects = loadEffects(PRIMARY);
  const effectsOf = (id: string, ctx: string): Effect[] => {
    const list = effects[id];
    if (!list) throw new DataError(PRIMARY, ctx, `unknown effect ${id}`);
    return list.map(toEffect);
  };

  const operatorName = nameLookup(names, "CharacterTable", "name");
  const growth = loadGrowth(PRIMARY);
  const potentials = loadPotentials(PRIMARY);
  const operators: Record<string, OperatorData> = {};
  for (const op of Object.values(loadOperators(PRIMARY))) {
    const g = growth[op.charId];
    if (!g) throw new DataError(PRIMARY, `CharGrowthTable.${op.charId}`, "operator has no growth entry");
    operators[op.charId] = {
      id: op.charId,
      name: operatorName(op.charId),
      rarity: op.rarity,
      element: op.element,
      weaponType: op.weaponType,
      mainAttr: op.mainAttrType,
      subAttr: op.subAttrType,
      levelRows: op.levelRows.map((r) => ({ breakStage: r.breakStage, level: r.attrs[0] ?? Number.NaN, attrs: r.attrs })),
      attributeNodes: g.attributeNodes.map((n) => ({ ...n, modifiers: n.modifiers.map(modifier) })),
      talentNodes: g.talentNodes.map((n) => ({
        nodeId: n.nodeId,
        index: n.index,
        level: n.level,
        effects: effectsOf(n.effectId, `CharGrowthTable.${op.charId}.${n.nodeId}`),
      })),
      potentials: (potentials[op.charId] ?? []).map((id) => effectsOf(id, `CharacterPotentialTable.${op.charId}`)),
    };
  }

  const skills: Record<string, SkillData> = {};
  for (const s of Object.values(loadSkills(PRIMARY))) {
    const file = isSkillFileListed(s.skillId) ? readSkillFile(s.skillId) : null;
    skills[s.skillId] = {
      id: s.skillId,
      levels: s.levels.map((l) => ({
        level: l.level,
        blackboard: l.blackboard,
        coolDown: l.coolDown,
        costType: l.costType,
        costValue: l.costValue,
      })),
      fileLoaded: file !== null,
      defaults: file?.defaults ?? {},
      statModifiers: file?.statModifiers ?? [],
    };
  }

  const itemName = nameLookup(names, "ItemTable", "name");
  const curves = loadWeaponCurves(PRIMARY);
  const weapons: Record<string, WeaponData> = {};
  for (const w of Object.values(loadWeapons(PRIMARY))) {
    const curve = curves[w.levelTemplateId];
    if (!curve) throw new DataError(PRIMARY, `WeaponBasicTable.${w.id}`, `unknown level curve ${w.levelTemplateId}`);
    weapons[w.id] = {
      id: w.id,
      name: itemName(w.id),
      rarity: w.rarity,
      weaponType: w.weaponType,
      maxLevel: w.maxLevel,
      baseAtk: curve,
      skills: w.skills,
    };
  }

  const gear: Record<string, GearData> = {};
  for (const g of Object.values(loadGear(PRIMARY))) gear[g.id] = { ...g, name: itemName(g.id) };

  const suitName = (() => {
    const ctx: Ctx = { source: PRIMARY, path: "EquipSuitTable" };
    const raw = obj(readTable(PRIMARY, "EquipSuitTable"), ctx);
    return (id: string) => {
      const c = at(ctx, id);
      const list = get(obj(raw[id], c), "list", c, (v) => v as unknown[]);
      const first = obj(list[0], at(at(c, "list"), 0));
      return names.resolve(first["suitName"], at(at(at(c, "list"), 0), "suitName"));
    };
  })();
  const gearSets: Record<string, GearSetData> = {};
  for (const s of Object.values(loadGearSets(PRIMARY))) gearSets[s.id] = { ...s, name: suitName(s.id) };

  const enemyDisplay = obj(readTable(PRIMARY, "EnemyTemplateDisplayInfoTable"), { source: PRIMARY, path: "EnemyTemplateDisplayInfoTable" });
  const enemies: Record<string, EnemyData> = {};
  for (const e of Object.values(loadEnemies(PRIMARY))) {
    const display = enemyDisplay[e.id];
    const name =
      display === undefined
        ? e.id
        : names.resolve(obj(display, { source: PRIMARY, path: `EnemyTemplateDisplayInfoTable.${e.id}` })["name"], {
            source: PRIMARY,
            path: `EnemyTemplateDisplayInfoTable.${e.id}.name`,
          });
    enemies[e.id] = { id: e.id, name, levels: e.levels, staticAttrs: e.staticAttrs, resistance: { ...e.resistance, ether: 0 } };
  }

  const c = loadBattleConst(PRIMARY);
  return {
    provenance: { sources: SOURCES.map((name) => ({ name, commit: sourceCommit(name) })) },
    constants: {
      atkRateOfMain: c.atkRateOfMain,
      atkRateOfSub: c.atkRateOfSub,
      efficiencyOfDEF: c.efficiencyOfDEF,
      maxUltimateSp: c.maxUltimateSp,
    },
    operators,
    skills,
    weapons,
    gear,
    gearSets,
    enemies,
  };
}

let cached: GameData | undefined;

export function loadGameData(): GameData {
  cached ??= build();
  return cached;
}
