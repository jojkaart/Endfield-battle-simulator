// Damage of a single hit, as a product of zones following the game's
// pipeline (docs/data-sources.md#3-damage-formula). Every zone is kept in the
// result so a number can be compared zone by zone (design principle 10).

import {
  Attr,
  ELEMENT_AMP,
  ELEMENT_DAMAGE_INCREASE,
  SKILL_TYPE_DAMAGE_INCREASE,
  type AttrType,
  type Element,
} from "./attributes.ts";
import type { Build } from "./build.ts";
import { STAGGER_DAMAGE_TAKEN } from "./constants.ts";
import { EngineError } from "./errors.ts";
import type { Condition, GameData, KitHit, KitSkill } from "./model.ts";
import { skillLevel, type StatPanel } from "./stats.ts";

export type CritMode = "never" | "always" | "expected";

export interface DamageOptions {
  readonly crit: CritMode;
  readonly staggered: boolean;
  /** Active condition IDs (kit or weapon conditions). */
  readonly conditions: readonly string[];
}

export const DEFAULT_DAMAGE_OPTIONS: DamageOptions = { crit: "expected", staggered: false, conditions: [] };

export interface DamageTarget {
  readonly enemy: string;
  readonly level: number;
}

export interface Zones {
  readonly atk: number;
  readonly scale: number;
  readonly damageBonus: number;
  readonly crit: number;
  readonly amp: number;
  readonly stagger: number;
  readonly defense: number;
  readonly resistance: number;
}

/** Zones of the formula that are fixed at ×1 so far; listed so nobody mistakes them for modelled. */
export const NOT_MODELLED = [
  "susceptibility",
  "increased damage taken",
  "weakness",
  "protection / damage reduction",
  "link",
  "finisher",
  "multiplicative (ProdCalcZone) bonuses",
  "arts reactions and physical statuses",
] as const;

export interface HitDamage {
  readonly skillId: string;
  readonly hitId: string;
  readonly label: string;
  readonly count: number;
  readonly element: Element;
  readonly scaleParts: readonly { readonly key: string; readonly value: number }[];
  readonly zones: Zones;
  /** Damage of one hit before rounding. */
  readonly exact: number;
  /** Damage of one hit as the game shows it: rounded to the nearest whole number. */
  readonly damage: number;
}

/**
 * Final damage rounds to the nearest whole number. Evidence: Zero Sanity's
 * in-game hits, e.g. 1572.75 → 1573 and 3253.97 → 3254 but 1952.38 → 1952
 * (fixtures/zero-sanity-laevatain-p5.json). Half-up vs half-even at exactly
 * .5 is untested.
 */
export function roundDamage(exact: number): number {
  return Math.round(exact);
}

/** A skill's blackboard value at the build's level, after potentials. */
export function skillValue(data: GameData, panel: StatPanel, build: Build, skillId: string, key: string): number {
  const op = data.operators[build.operator];
  const skill = data.skills[skillId];
  if (!op || !skill) throw new EngineError(`unknown skill ${skillId}`);
  const group = op.skillGroups[skillId];
  if (!group) throw new EngineError(`${skillId} isn't one of ${op.id}'s skills`);
  const level = skillLevel(skill, build.skillLevels[group]);
  let value = level.blackboard[key] ?? skill.defaults[key];
  if (value === undefined) throw new EngineError(`${skillId} level ${level.level} has no value ${key}`);
  for (const change of panel.skillValues[skillId] ?? []) {
    if (change.key !== key) continue;
    if (change.op === "add") value += change.value;
    else if (change.op === "multiply") value *= change.value;
    else value = change.value;
  }
  return value;
}

interface ConditionTotals {
  readonly attrs: ReadonlyMap<AttrType, number>;
  readonly ignoreResistance: ReadonlyMap<Element, number>;
}

/** Attributes that feed the stat panel itself; a condition changing them would need the panel recomputed. */
const PANEL_ATTRS: readonly number[] = [Attr.MaxHp, Attr.Atk, Attr.Def, Attr.Str, Attr.Agi, Attr.Wisd, Attr.Will];

function conditionValue(data: GameData, build: Build, c: Condition): number {
  const s = c.source;
  if (s.kind === "talent") {
    const op = data.operators[build.operator];
    const nodes = op?.talentNodes.filter((n) => n.index === s.index) ?? [];
    const level = build.talents?.[s.index] ?? Math.max(0, ...nodes.map((n) => n.level));
    const node = nodes.find((n) => n.level === level);
    if (!node) throw new EngineError(`${c.id}: talent ${s.index + 1} isn't unlocked (level ${level})`);
    const buff = node.effects.find((e) => e.kind === "buff" && e.buffId === s.buffId);
    if (!buff || buff.kind !== "buff") throw new EngineError(`${c.id}: talent ${s.index + 1} level ${level} has no buff ${s.buffId}`);
    const v = buff.blackboard[s.key];
    if (v === undefined) throw new EngineError(`${c.id}: ${s.buffId} has no value ${s.key}`);
    return v * s.scale;
  }
  if (!build.weapon) throw new EngineError(`${c.id}: no weapon equipped`);
  const w = data.weapons[build.weapon.id];
  const skillId = w?.skills[s.skill];
  const level = build.weapon.skillLevels[s.skill];
  const skill = skillId === undefined ? undefined : data.skills[skillId];
  if (!skill || level === undefined) throw new EngineError(`${c.id}: weapon has no skill ${s.skill + 1}`);
  const v = skillLevel(skill, level).blackboard[s.key];
  if (v === undefined) throw new EngineError(`${c.id}: ${skill.id} level ${level} has no value ${s.key}`);
  return v * s.scale;
}

function conditionTotals(data: GameData, build: Build, ids: readonly string[]): ConditionTotals {
  const available = [...(data.kits.operators[build.operator]?.conditions ?? []), ...(build.weapon ? (data.kits.weapons[build.weapon.id] ?? []) : [])];
  const attrs = new Map<AttrType, number>();
  const ignore = new Map<Element, number>();
  for (const id of ids) {
    const c = available.find((x) => x.id === id);
    if (!c) throw new EngineError(`unknown condition ${id} for this build (available: ${available.map((x) => x.id).join(", ") || "none"})`);
    const value = conditionValue(data, build, c);
    if (c.effect.kind === "attr") {
      if (PANEL_ATTRS.includes(c.effect.attr)) throw new EngineError(`${c.id}: conditions on panel attributes aren't supported yet`);
      attrs.set(c.effect.attr, (attrs.get(c.effect.attr) ?? 0) + value);
    } else {
      ignore.set(c.effect.element, (ignore.get(c.effect.element) ?? 0) + value);
    }
  }
  return { attrs, ignoreResistance: ignore };
}

export function computeHit(
  data: GameData,
  build: Build,
  panel: StatPanel,
  target: DamageTarget,
  skill: KitSkill,
  hit: KitHit,
  options: DamageOptions = DEFAULT_DAMAGE_OPTIONS,
): HitDamage {
  const enemy = data.enemies[target.enemy];
  if (!enemy) throw new EngineError(`unknown enemy ${target.enemy}`);
  const enemyLevel = enemy.levels[target.level - 1];
  if (!enemyLevel) throw new EngineError(`${enemy.id} has no level ${target.level}`);
  const cond = conditionTotals(data, build, options.conditions);
  const attr = (a: AttrType) => (panel.attrs[a]?.total ?? data.attributeDefaults[a] ?? 0) + (cond.attrs.get(a) ?? 0);

  const scaleParts = hit.scale.map((key) => ({ key, value: skillValue(data, panel, build, skill.skillId, key) }));
  const scale = scaleParts.reduce((p, s) => p * s.value, 1);

  // Attacker-side additive bonuses (NormalCalcZone): element + skill type (+ vs staggered).
  const damageBonus =
    1 +
    attr(ELEMENT_DAMAGE_INCREASE[hit.element]) +
    attr(SKILL_TYPE_DAMAGE_INCREASE[hit.damageType]) +
    (options.staggered ? attr(Attr.DamageToBrokenUnitIncrease) : 0);

  const critRate = Math.min(1, Math.max(0, attr(Attr.CriticalRate)));
  const critDamage = attr(Attr.CriticalDamageIncrease);
  const crit = options.crit === "never" ? 1 : options.crit === "always" ? 1 + critDamage : 1 + critRate * critDamage;

  const amp = 1 + attr(ELEMENT_AMP[hit.element]);
  const stagger = options.staggered ? STAGGER_DAMAGE_TAKEN : 1;

  const def = enemyLevel[Attr.Def] ?? 0;
  // 2 − 0.99^(−DEF) below zero per the Talos Wiki; negative DEF isn't reachable in the game today.
  const defense = def >= 0 ? 1 / (1 + data.constants.efficiencyOfDEF * def) : 2 - Math.pow(0.99, -def);

  const resistance = (100 - enemy.resistance[hit.element] + (cond.ignoreResistance.get(hit.element) ?? 0)) / 100;

  const zones: Zones = { atk: panel.atk.total, scale, damageBonus, crit, amp, stagger, defense, resistance };
  const exact = zones.atk * scale * damageBonus * crit * amp * stagger * defense * resistance;
  return {
    skillId: skill.skillId,
    hitId: hit.id,
    label: hit.label,
    count: hit.count,
    element: hit.element,
    scaleParts,
    zones,
    exact,
    damage: roundDamage(exact),
  };
}

/** Every hit of the operator's kit. */
export function computeKit(data: GameData, build: Build, panel: StatPanel, target: DamageTarget, options: DamageOptions = DEFAULT_DAMAGE_OPTIONS): HitDamage[] {
  const kit = data.kits.operators[build.operator];
  if (!kit) throw new EngineError(`no kit for ${build.operator} yet`);
  return kit.skills.flatMap((s) => s.hits.map((h) => computeHit(data, build, panel, target, s, h, options)));
}
