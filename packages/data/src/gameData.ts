// Builds the engine's GameData from the primary source (rmxlinux), with
// English names. Loading takes a few seconds, so the result is cached.

import type {
  AttrModifier,
  Effect,
  Element,
  EnemyData,
  GameData,
  GearData,
  GearSetData,
  OperatorData,
  SkillData,
  SkillType,
  WeaponData,
} from "@efsim/engine";
import { ELEMENTS } from "@efsim/engine";
import { DataError } from "./errors.ts";
import { at, get, obj, type Ctx } from "./fields.ts";
import { loadKits } from "./kits.ts";
import { Names } from "./names.ts";
import { diveOf, isSkillFileListed, passiveBuffModifiers, reachedSp, readSkillFile } from "./skillData.ts";
import { burstDelays, castHelpers, perfectDodgeData, staggerDamageTaken, switchedSkills } from "./buffData.ts";
import { PRIMARY, readTable, sourceCommit, SOURCES } from "./sources.ts";
import { loadAttributeDefaults, loadAttributeLimits } from "./tables/attributeMeta.ts";
import { loadBattleConst } from "./tables/battleConst.ts";
import type { RawAttrModifier } from "./tables/common.ts";
import { loadEnemies, loadEnemyAliases, loadStageEnemies } from "./tables/enemies.ts";
import { loadGear, loadGearSets } from "./tables/equip.ts";
import { loadGrowth } from "./tables/growth.ts";
import { loadOperators } from "./tables/operators.ts";
import { loadEffects, loadPotentials, type RawEffect } from "./tables/potentials.ts";
import { loadSkills } from "./tables/skills.ts";
import { loadWeaponCurves, loadWeapons } from "./tables/weapons.ts";
import { loadUseItems } from "./tables/useItems.ts";
import { loadFoods } from "./foods.ts";

// CharGrowthTable skillGroupType → the build's skill level that applies.
const SKILL_GROUP_TYPES: Record<number, SkillType> = { 0: "basic", 1: "battle", 2: "ultimate", 3: "combo" };

const modifier = (m: RawAttrModifier): AttrModifier => ({ attr: m.attr, slot: m.slot, target: m.target, value: m.value });

const passiveCache = new Map<string, ReturnType<typeof passiveBuffModifiers>>();
/** An attached skill's permanent buff stats (passiveBuffModifiers), once per skill. */
const passiveOf = (skillId: string) => {
  let m = passiveCache.get(skillId);
  if (!m) passiveCache.set(skillId, (m = passiveBuffModifiers(skillId)));
  return m;
};

const toEffect = (e: RawEffect): Effect => {
  if (e.kind === "attr") return { ...e, kind: "attr", modifier: modifier(e.modifier) };
  if (e.kind === "skill" && passiveOf(e.skillId).length) return { ...e, buffModifiers: passiveOf(e.skillId) };
  return e;
};

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
  const elementOf = (charType: string, id: string): Element => {
    const e = charType.toLowerCase();
    if (!(ELEMENTS as readonly string[]).includes(e)) throw new DataError(PRIMARY, `CharacterTable.${id}.charTypeId`, `unknown element ${charType}`);
    return e as Element;
  };
  // The Endministrator: a virtual character holds the talents of the two playable IDs (GlobalConst), and isn't playable itself.
  const globals = obj(readTable(PRIMARY, "GlobalConst"), { source: PRIMARY, path: "GlobalConst" });
  const virtualId = typeof globals["endminVirtualCharId"] === "string" ? globals["endminVirtualCharId"] : null;
  const playsVirtual = new Set([globals["maleCharID"], globals["femaleCharID"]].filter((x): x is string => typeof x === "string"));
  const operators: Record<string, OperatorData> = {};
  // Helper skills (CastSkill targets no skill group lists) and the listed skill each takes its group and values from.
  const helpers = new Map<string, string>();
  const withHelpers = <T extends string>(groups: Record<string, T>): Record<string, T> => {
    const out = { ...groups };
    for (const [id, owner] of castHelpers(groups)) {
      helpers.set(id, owner);
      const group = groups[owner];
      if (group !== undefined) out[id] = group;
    }
    return out;
  };
  // Dive starts (no SkillPatchTable row) and the landing whose level count each takes, with blank values: its file's apply at every level.
  const diveStarts = new Map<string, string>();
  for (const op of Object.values(loadOperators(PRIMARY))) {
    if (op.charId === virtualId) continue;
    const g = growth[op.charId];
    // Their own talent nodes point at stale, empty effects; the virtual character's carry the values.
    const talentGrowth = virtualId && playsVirtual.has(op.charId) ? (growth[virtualId] ?? g) : g;
    if (!g) throw new DataError(PRIMARY, `CharGrowthTable.${op.charId}`, "operator has no growth entry");
    const listed = Object.fromEntries(
      Object.entries(g.skillGroups).map(([skillId, type]) => {
        const group = SKILL_GROUP_TYPES[type];
        if (!group) throw new DataError(PRIMARY, `CharGrowthTable.${op.charId}.skillGroupMap`, `unknown skillGroupType ${type}`);
        return [skillId, group];
      }),
    );
    // A dive's start joins its landing's group (skillData.diveOf).
    const dive = diveOf(Object.keys(listed));
    const diveStart = dive?.start !== undefined ? { [dive.start]: listed[dive.end] as SkillType } : {};
    if (dive?.start !== undefined) diveStarts.set(dive.start, dive.end);
    operators[op.charId] = {
      id: op.charId,
      name: operatorName(op.charId),
      rarity: op.rarity,
      element: elementOf(op.element, op.charId),
      profession: op.profession,
      weaponType: op.weaponType,
      mainAttr: op.mainAttrType,
      subAttr: op.subAttrType,
      levelRows: op.levelRows.map((r) => ({ breakStage: r.breakStage, level: r.attrs[0] ?? Number.NaN, attrs: r.attrs })),
      skillGroups: withHelpers({
        // Skills a ChangeSkillAction puts in a skill slot belong to that slot's group (CharGrowthTable misses some, e.g. Si's Final Stroke).
        ...Object.fromEntries(switchedSkills(op.charId)),
        ...listed,
        ...diveStart,
      }),
      ...(dive ? { dive } : {}),
      attributeNodes: g.attributeNodes.map((n) => ({ ...n, modifiers: n.modifiers.map(modifier) })),
      talentNodes: (talentGrowth ?? g).talentNodes.map((n) => ({
        nodeId: n.nodeId,
        index: n.index,
        level: n.level,
        effects: effectsOf(n.effectId, `CharGrowthTable.${op.charId}.${n.nodeId}`),
      })),
      potentials: (potentials[op.charId] ?? []).map((id) => effectsOf(id, `CharacterPotentialTable.${op.charId}`)),
    };
  }

  const skills: Record<string, SkillData> = {};
  const switchCasts = new Map<string, readonly string[]>();
  const patched = loadSkills(PRIMARY);
  // A helper without its own SkillPatchTable row takes its owner's level values (its file's blackboard gives the defaults).
  const rows = [
    ...Object.values(patched),
    ...[...helpers].filter(([id]) => patched[id] === undefined).flatMap(([id, owner]) => (patched[owner] ? [{ ...patched[owner], skillId: id }] : [])),
    // A dive's start: its landing's levels with no values, so its file's blackboard gives them at every level.
    ...[...diveStarts].filter(([id]) => patched[id] === undefined).flatMap(([id, end]) => (patched[end] ? [{ skillId: id, levels: patched[end].levels.map((l) => ({ ...l, coolDown: 0, costType: 0, costValue: 0, blackboard: {} })) }] : [])),
  ];
  for (const s of rows) {
    const file = isSkillFileListed(s.skillId) ? readSkillFile(s.skillId) : null;
    // SP the files it reaches grant (entities, helper casts, created buffs) under keys its own file doesn't.
    const sp = file ? reachedSp(s.skillId, file, (id) => helpers.has(id)) : null;
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
      timing: file?.timing ?? null,
      defaults: file?.defaults ?? {},
      statModifiers: file?.statModifiers ?? [],
      spKinds: sp?.spKinds ?? {},
      spSources: sp?.spSources ?? {},
    };
    if (file?.switchCasts.length) switchCasts.set(s.skillId, file.switchCasts);
  }
  // A window listing a skill whose cast casts another instead (switchToBuffConfig) opens for that one too: Camille's combo and
  // ultimate windows list the battle-skill button normal_skill_2, which casts Hunter Pursuit (combo_skill_2) in her ultimate's state.
  for (const s of Object.values(skills)) {
    if (!s.timing || !s.timing.windows.some((w) => w.skills.some((id) => switchCasts.has(id)))) continue;
    const windows = s.timing.windows.map((w) => {
      const extra = w.skills.flatMap((id) => switchCasts.get(id) ?? []).filter((id) => !w.skills.includes(id));
      return extra.length ? { ...w, skills: [...w.skills, ...new Set(extra)] } : w;
    });
    skills[s.id] = { ...s, timing: { ...s.timing, windows } };
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
    // Rank: the display table's displayType (the enemyRank predicate; 555me DisplayEnemyTypeTable: 0 Common, 1 Elite, 2 Boss, 3 Advanced, 4 Alpha).
    const displayType = display === undefined ? undefined : obj(display, { source: PRIMARY, path: `EnemyTemplateDisplayInfoTable.${e.id}` })["displayType"];
    if (displayType !== undefined && !Number.isInteger(displayType)) throw new DataError(PRIMARY, `EnemyTemplateDisplayInfoTable.${e.id}.displayType`, "not a whole number");
    enemies[e.id] = {
      id: e.id, name, levels: e.levels, staticAttrs: e.staticAttrs, resistance: e.resistance, finisherSp: e.finisherSp, staggerNodes: e.staggerNodes, superArmor: e.superArmor,
      ...(displayType !== undefined ? { rank: displayType as number } : {}),
    };
  }

  // Stage variants (EnemyTable: `eny_0120_klbear_tower015` → template `eny_0120_klbear`), with their stat modifiers.
  for (const alias of Object.values(loadEnemyAliases(PRIMARY))) {
    const template = enemies[alias.template];
    if (enemies[alias.id] || !template) continue;
    const apply = (attrs: Readonly<Record<number, number>>) => {
      const out = { ...attrs };
      for (const m of alias.modifiers) if (m.attr in out) out[m.attr] = m.kind === 0 ? (out[m.attr] as number) + m.value : (out[m.attr] as number) * (m.kind === 1 ? 1 + m.value : m.value);
      return out;
    };
    enemies[alias.id] = { ...template, id: alias.id, levels: template.levels.map(apply), staticAttrs: apply(template.staticAttrs) };
  }

  const { foods, notFoods } = loadFoods(loadUseItems(PRIMARY), itemName);

  const c = loadBattleConst(PRIMARY);
  const kits = loadKits({ skills, operators, weapons, gearSets });
  return {
    provenance: { sources: SOURCES.map((name) => ({ name, commit: sourceCommit(name) })) },
    constants: {
      atkRateOfMain: c.atkRateOfMain,
      atkRateOfSub: c.atkRateOfSub,
      efficiencyOfDEF: c.efficiencyOfDEF,
      maxUltimateSp: c.maxUltimateSp,
      ...((p) => (p ? { perfectDodge: p } : {}))(perfectDodgeData()),
      burstDelayFrames: burstDelays(),
      staggerDamageTaken: staggerDamageTaken(),
    },
    attributeDefaults: loadAttributeDefaults(PRIMARY),
    attributeLimits: loadAttributeLimits(PRIMARY),
    operators,
    skills,
    weapons,
    gear,
    gearSets,
    enemies,
    stages: loadStageEnemies(PRIMARY),
    foods,
    notFoods,
    kits,
  };
}

let cached: GameData | undefined;

export function loadGameData(): GameData {
  cached ??= build();
  return cached;
}
