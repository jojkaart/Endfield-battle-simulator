// Stat aggregation: base stats + attribute nodes + talents + potentials +
// weapon + gear + gear sets → the operator's stat panel, with every
// contribution kept so a number can be traced to its source (design
// principle 10).

import { Attr, attrName, type AttrType } from "./attributes.ts";
import type { Build } from "./build.ts";
import { EngineError } from "./errors.ts";
import { Slot, Target, type Effect, type GameData, type OperatorData, type SkillData, type SkillValueOp } from "./model.ts";

export interface Contribution {
  readonly source: string;
  readonly slot: number;
  readonly value: number;
}

export interface StatLine {
  readonly attr: AttrType;
  readonly name: string;
  readonly base: number;
  readonly add: number;
  readonly percent: number;
  readonly flat: number;
  readonly multiply: number;
  readonly total: number;
  readonly contributions: readonly Contribution[];
}

export interface AtkBreakdown {
  readonly operatorBase: number;
  readonly weaponBase: number;
  readonly percent: number;
  readonly flat: number;
  /** Main and secondary attribute as used: whole-number part only (see {@link StatOptions}). */
  readonly mainAttribute: number;
  readonly secondaryAttribute: number;
  readonly attributeBonus: number;
  readonly total: number;
}

export interface SkillValueChange {
  readonly key: string;
  readonly op: SkillValueOp;
  readonly value: number;
  readonly source: string;
}

export interface SkillParamChange {
  readonly param: "cost" | "cooldown";
  readonly op: "add" | "multiply" | "set";
  readonly value: number;
  readonly source: string;
}

/** A skill's cost or cooldown after the panel's changes. */
export function skillParam(panel: StatPanel, skillId: string, param: "cost" | "cooldown", base: number): number {
  let v = base;
  for (const c of panel.skillParams[skillId] ?? []) {
    if (c.param !== param) continue;
    v = c.op === "add" ? v + c.value : c.op === "multiply" ? v * c.value : c.value;
  }
  return v;
}

export interface StatPanel {
  readonly operator: string;
  readonly mainAttr: AttrType;
  readonly subAttr: AttrType;
  readonly attrs: Readonly<Record<number, StatLine>>;
  readonly atk: AtkBreakdown;
  /** Skill values changed by potentials, by skill ID. */
  readonly skillValues: Readonly<Record<string, readonly SkillValueChange[]>>;
  /** Skill costs and cooldowns changed by potentials and talents, by skill ID. */
  readonly skillParams: Readonly<Record<string, readonly SkillParamChange[]>>;
  /** Things about the build the game wouldn't allow (e.g. a weapon of another type); it's simulated anyway. */
  readonly warnings: readonly string[];
  /** Effects that aren't permanent stats (buffs from talents, potentials, weapons, gear sets) and so aren't in this panel. */
  readonly notApplied: readonly string[];
}

export interface StatOptions {
  /**
   * Use only the whole-number part of attributes for the ATK bonus.
   * Verified: Laevatain's in-game effective ATK 5871 (Zero Sanity panel,
   * 2026-03-15) needs it (exact attributes give 5878); End-DPScope's
   * research notes say the same.
   */
  readonly floorAttributes: boolean;
}

export const DEFAULT_STAT_OPTIONS: StatOptions = { floorAttributes: true };

const SLOTS: readonly number[] = [Slot.Add, Slot.Percent, Slot.Flat, Slot.Multiply, Slot.AddUnverified];

interface Accumulator {
  base: number;
  contributions: Contribution[];
}

function levelRow(op: OperatorData, build: Build) {
  const row = op.levelRows.find((r) => r.level === build.level && r.breakStage === build.promotion);
  if (!row) throw new EngineError(`${op.id} has no stats for level ${build.level} at promotion ${build.promotion}`);
  return row;
}

export function skillLevel(skill: SkillData, level: number) {
  const l = skill.levels[level - 1];
  if (!l || l.level !== level) throw new EngineError(`${skill.id} has no level ${level}`);
  return l;
}

export function computeStats(data: GameData, build: Build, options: StatOptions = DEFAULT_STAT_OPTIONS): StatPanel {
  const op = data.operators[build.operator];
  if (!op) throw new EngineError(`unknown operator ${build.operator}`);
  const row = levelRow(op, build);

  const acc = new Map<number, Accumulator>();
  const line = (attr: number): Accumulator => {
    let a = acc.get(attr);
    if (!a) {
      a = { base: row.attrs[attr] ?? data.attributeDefaults[attr] ?? 0, contributions: [] };
      acc.set(attr, a);
    }
    return a;
  };
  const resolveTarget = (attr: number, target: number): number => {
    if (target === Target.AsWritten) return attr;
    if (target === Target.MainAttribute) return op.mainAttr;
    if (target === Target.SecondaryAttribute) return op.subAttr;
    throw new EngineError(`unknown modifier target ${target}`);
  };
  const apply = (attr: number, slot: number, target: number, value: number, source: string) => {
    if (!SLOTS.includes(slot)) throw new EngineError(`${source}: unsupported formula slot ${slot} for ${attrName(attr)}`);
    line(resolveTarget(attr, target)).contributions.push({ source, slot, value });
  };

  const skillValues: Record<string, SkillValueChange[]> = {};
  const skillParams: Record<string, SkillParamChange[]> = {};
  const notApplied: string[] = [];
  const warnings: string[] = [];
  const applyEffects = (effects: readonly Effect[], source: string) => {
    for (const e of effects) {
      if (e.kind === "attr") apply(e.modifier.attr, e.modifier.slot, e.modifier.target, e.modifier.value, source);
      else if (e.kind === "skillValue") (skillValues[e.skillId] ??= []).push({ key: e.key, op: e.op, value: e.value, source });
      else if (e.kind === "skillParam") (skillParams[e.skillId] ??= []).push({ param: e.param, op: e.op, value: e.value, source });
      else if (e.kind === "buff") notApplied.push(`${source}: buff ${e.buffId}`);
      else notApplied.push(`${source}: effect type ${e.modifyType}`);
    }
  };

  // Attribute nodes, in promotion order.
  const available = op.attributeNodes.filter((n) => n.breakStage <= build.promotion);
  const nodeCount = build.attributeNodes ?? available.length;
  if (nodeCount > available.length) {
    throw new EngineError(`${op.id} has ${available.length} attribute nodes at promotion ${build.promotion}, ${nodeCount} requested`);
  }
  for (const node of available.slice(0, nodeCount)) {
    for (const m of node.modifiers) apply(m.attr, m.slot, m.target, m.value, `attribute node ${node.nodeId}`);
  }

  // Talents: each node holds the talent's full effect at that level.
  const talentIndexes = [...new Set(op.talentNodes.map((n) => n.index))].sort((a, b) => a - b);
  talentIndexes.forEach((index, i) => {
    const nodes = op.talentNodes.filter((n) => n.index === index);
    const max = Math.max(...nodes.map((n) => n.level));
    const level = build.talents?.[i] ?? max;
    if (level === 0) return;
    const node = nodes.find((n) => n.level === level);
    if (!node) throw new EngineError(`${op.id} talent ${index + 1} has no level ${level}`);
    applyEffects(node.effects, `talent ${index + 1} level ${level}`);
  });

  // Potentials P1..Pn.
  if (build.potential > op.potentials.length) throw new EngineError(`${op.id} has no potential ${build.potential}`);
  op.potentials.slice(0, build.potential).forEach((effects, i) => applyEffects(effects, `potential ${i + 1}`));

  // Permanent stat effects of a skill (weapon or gear set skills).
  const applySkill = (skillId: string, level: number, source: string) => {
    const skill = data.skills[skillId];
    if (!skill) throw new EngineError(`${source}: unknown skill ${skillId}`);
    if (!skill.fileLoaded) throw new EngineError(`${source}: SkillData for ${skillId} isn't loaded`);
    const bb = skillLevel(skill, level).blackboard;
    for (const m of skill.statModifiers) {
      let value = m.literal;
      if (m.key !== null) {
        const v = bb[m.key];
        if (v === undefined) throw new EngineError(`${source}: ${skillId} level ${level} has no value ${m.key}`);
        value = v;
      }
      apply(m.attr, m.slot, m.target, value, source);
    }
    if (skill.statModifiers.length === 0 || skillId.startsWith("sk_") || skillId.startsWith("passive_")) {
      // Unique weapon skills and set effects usually also have conditional parts.
      notApplied.push(`${source}: conditional effects of ${skillId}`);
    }
  };

  let weaponBase = 0;
  if (build.weapon) {
    const w = data.weapons[build.weapon.id];
    if (!w) throw new EngineError(`unknown weapon ${build.weapon.id}`);
    // An operator can only equip weapons of its own type (CharacterTable / WeaponBasicTable weaponType).
    if (w.weaponType !== op.weaponType) warnings.push(`${w.name} is weapon type ${w.weaponType}; ${op.name} uses type ${op.weaponType}, so the game wouldn't allow it`);
    const atk = w.baseAtk[build.weapon.level - 1];
    if (atk === undefined) throw new EngineError(`${w.id} has no level ${build.weapon.level}`);
    weaponBase = atk;
    w.skills.forEach((skillId, i) => {
      const level = build.weapon?.skillLevels[i];
      if (level === undefined) throw new EngineError(`${w.id}: missing level for skill ${i + 1}`);
      applySkill(skillId, level, `${w.name} skill ${i + 1} (${skillId} level ${level})`);
    });
  }

  const setCounts = new Map<string, number>();
  for (const piece of build.gear) {
    const g = data.gear[piece.id];
    if (!g) throw new EngineError(`unknown gear ${piece.id}`);
    for (const l of g.lines) {
      const level = l.line === 0 ? 0 : piece.artifice[l.line - 1];
      if (level === undefined) throw new EngineError(`${g.id}: no artificing level for line ${l.line}`);
      const value = l.values[level];
      if (value === undefined) throw new EngineError(`${g.id} line ${l.line} has no artificing level ${level}`);
      apply(l.attr, l.slot, l.target, value, `${g.name} line ${l.line}${l.line === 0 ? "" : ` (artifice ${level})`}`);
    }
    if (g.setId) setCounts.set(g.setId, (setCounts.get(g.setId) ?? 0) + 1);
  }
  for (const [setId, count] of [...setCounts].sort()) {
    const set = data.gearSets[setId];
    if (!set) throw new EngineError(`unknown gear set ${setId}`);
    if (count >= set.piecesRequired) applySkill(set.skillId, set.skillLevel, `${set.name} set (${count} pieces)`);
  }

  // Totals: ((base + Σ add) × (1 + Σ percent) + Σ flat) × Π multiply.
  const attrs: Record<number, StatLine> = {};
  // Every attribute in the level row or touched by a modifier, plus crit, which the damage formula always reads.
  const shown = [...Object.keys(row.attrs).map(Number), ...acc.keys(), Attr.CriticalRate, Attr.CriticalDamageIncrease];
  for (const attr of [...new Set(shown)].sort((a, b) => a - b)) {
    const a = line(attr);
    const sum = (slot: number) => a.contributions.filter((c) => c.slot === slot).reduce((s, c) => s + c.value, 0);
    const multiply = a.contributions.filter((c) => c.slot === Slot.Multiply).reduce((p, c) => p * c.value, 1);
    const add = sum(Slot.Add) + sum(Slot.AddUnverified);
    const percent = sum(Slot.Percent);
    const flat = sum(Slot.Flat);
    attrs[attr] = {
      attr,
      name: attrName(attr),
      base: a.base,
      add,
      percent,
      flat,
      multiply,
      total: ((a.base + add) * (1 + percent) + flat) * multiply,
      contributions: a.contributions,
    };
  }

  // ATK = [(operator base + weapon base) × (1 + ATK%) + flat ATK] × attribute bonus.
  const atkLine = attrs[Attr.Atk];
  if (!atkLine) throw new EngineError(`${op.id} has no base ATK`);
  if (atkLine.add !== 0 || atkLine.multiply !== 1) throw new EngineError(`${op.id}: ATK add/multiply modifiers aren't supported yet`);
  const attrValue = (attr: number) => {
    const v = attrs[attr]?.total ?? 0;
    return options.floorAttributes ? Math.floor(v) : v;
  };
  const mainAttribute = attrValue(op.mainAttr);
  const secondaryAttribute = attrValue(op.subAttr);
  let attributeBonus = 1 + mainAttribute * data.constants.atkRateOfMain + secondaryAttribute * data.constants.atkRateOfSub;
  // Extra ATK per attribute point (talents of some operators). Not yet verified in game.
  const factors: [number, number][] = [
    [Attr.AtkIncreaseFactorFromStr, Attr.Str],
    [Attr.AtkIncreaseFactorFromAgi, Attr.Agi],
    [Attr.AtkIncreaseFactorFromWisd, Attr.Wisd],
    [Attr.AtkIncreaseFactorFromWill, Attr.Will],
  ];
  for (const [factor, attr] of factors) {
    const f = attrs[factor]?.total ?? 0;
    if (f !== 0) attributeBonus += f * attrValue(attr);
  }
  const atkBase = atkLine.base + weaponBase;
  const atkTotal = (atkBase * (1 + atkLine.percent) + atkLine.flat) * attributeBonus;

  return {
    operator: op.id,
    mainAttr: op.mainAttr,
    subAttr: op.subAttr,
    attrs,
    atk: {
      operatorBase: atkLine.base,
      weaponBase,
      percent: atkLine.percent,
      flat: atkLine.flat,
      mainAttribute,
      secondaryAttribute,
      attributeBonus,
      total: atkTotal,
    },
    skillValues,
    skillParams,
    notApplied,
    warnings,
  };
}
