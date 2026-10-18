// Damage of a single hit, as a product of zones following the game's
// pipeline (docs/data-sources.md#3-damage-formula). Every zone is kept in the
// result so a number can be compared zone by zone (design principle 10).

import { Attr, attrName, type Element, type SkillType } from "./attributes.ts";
import type { Build } from "./build.ts";
import { STAGGER_DAMAGE_TAKEN } from "./constants.ts";
import { applies, attrModifier, zoneProduct, zoneSum, type HitContext, type HitKind, type Modifier, type Zone } from "./effects.ts";
import { EngineError } from "./errors.ts";
import type { Condition, GameData, KitHit, KitSkill } from "./model.ts";
import { artsIntensityDamage, artsLevelCoefficient, reactionBase, type ReactionKind } from "./reactions.ts";
import { evaluate, test, type EvalContext, type Predicate } from "./expr.ts";
import { computeStats, skillLevel, wornEquipment, type StatPanel } from "./stats.ts";

export type CritMode = "never" | "always" | "expected";

export interface DamageOptions {
  readonly crit: CritMode;
  readonly staggered: boolean;
  /** Active condition IDs (kit or weapon conditions). */
  readonly conditions: readonly string[];
  /** Further active buffs and debuffs, e.g. from a battle log or the timeline. */
  readonly modifiers?: readonly Modifier[];
  /** What's known about the moment of the hit, for kit predicates (KitHit.if, extraScale); unknown parts are left out. */
  readonly situation?: Situation;
  /** What a predicate the situation can't decide counts as (the log checker tries both); default: an error. */
  readonly assumeUnknown?: boolean;
}

/** The parts of an EvalContext that describe the moment rather than the build. */
export type Situation = Partial<Pick<EvalContext, "team" | "enemy" | "stacks" | "buffActive" | "consumed" | "eventCount" | "controlled" | "enemyModifiers" | "owner" | "eventOperator">>;

/** The context kit predicates and values are evaluated in, for a build's skill. */
export function evalContext(data: GameData, build: Build, panel: StatPanel, skillId: string, situation: Situation = {}): EvalContext {
  return { data, build, panel, skillId, ...situation, skillValue: (s, k) => skillValue(data, panel, build, s, k) };
}

/** A predicate's verdict; `assume` decides what an unknown one counts as (undefined: error). */
export function decide(p: Predicate, c: EvalContext, assume?: boolean): boolean {
  const v = test(p, c);
  if (v !== undefined) return v;
  if (assume === undefined) throw new EngineError(`a kit condition can't be decided here: ${JSON.stringify(p)}`);
  return assume;
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
  readonly susceptibility: number;
  readonly damageTaken: number;
  readonly multiplicative: number;
  readonly stagger: number;
  readonly defense: number;
  readonly resistance: number;
}

/** Zones of the formula that are fixed at ×1 so far; listed so nobody mistakes them for modelled. */
export const NOT_MODELLED = [
  "weakness",
  "protection / damage reduction",
  "link",
  "finisher",
  "physical statuses (reactions: burst, reaction, burning only)",
] as const;

export interface HitDamage {
  readonly skillId: string;
  readonly hitId: string;
  readonly label: string;
  readonly count: number;
  readonly element: Element;
  readonly scaleParts: readonly { readonly key: string; readonly value: number }[];
  readonly zones: Zones;
  /** The modifiers that applied to this hit, for tracing a number to its sources. */
  readonly modifiers: readonly Modifier[];
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
/**
 * A value from the game data at the build's level, after potentials: one of
 * the operator's skills, or any other source the build has (a weapon or
 * gear-set skill, a skill or buff a talent or potential attaches;
 * StatPanel.sources).
 */
export function skillValue(data: GameData, panel: StatPanel, build: Build, skillId: string, key: string): number {
  const op = data.operators[build.operator];
  if (!op) throw new EngineError(`unknown operator ${build.operator}`);
  const group = op.skillGroups[skillId];
  let value: number | undefined;
  if (group) {
    const skill = data.skills[skillId];
    if (!skill) throw new EngineError(`unknown skill ${skillId}`);
    const level = skillLevel(skill, build.skillLevels[group]);
    value = level.blackboard[key] ?? skill.defaults[key];
    if (value === undefined) throw new EngineError(`${skillId} level ${level.level} has no value ${key}`);
  } else {
    const bb = panel.sources[skillId];
    if (!bb) throw new EngineError(`${skillId} isn't one of ${op.id}'s skills, nor a weapon, gear-set, talent or potential source of this build`);
    value = bb[key];
    if (value === undefined) throw new EngineError(`${skillId} has no value ${key} for this build`);
  }
  for (const change of panel.skillValues[skillId] ?? []) {
    if (change.key !== key) continue;
    if (change.op === "add") value += change.value;
    else if (change.op === "multiply") value *= change.value;
    else value = change.value;
  }
  return value;
}

/** The stat panel as modifiers: every damage-relevant attribute total. */
export function panelModifiers(data: GameData, panel: StatPanel): Modifier[] {
  const out: Modifier[] = [];
  const attrs = new Set([...Object.keys(panel.attrs).map(Number), Attr.CriticalRate, Attr.CriticalDamageIncrease]);
  for (const attr of attrs) {
    const total = panel.attrs[attr]?.total ?? data.attributeDefaults[attr] ?? 0;
    if (total === 0) continue;
    const m = attrModifier(attr, total, `stat panel: ${attrName(attr)}`);
    if (m) out.push(m);
  }
  return out;
}

function conditionValue(data: GameData, build: Build, c: Condition, panel: () => StatPanel): number {
  const s = c.source;
  if (s.kind === "skill") return skillValue(data, panel(), build, s.skillId, s.key) * s.scale;
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

/** Conditions available to a build: its operator's kit conditions and those of what it wears. */
export function availableConditions(data: GameData, build: Build): readonly Condition[] {
  return [...(data.kits.operators[build.operator]?.conditions ?? []), ...wornEquipment(data, build).flatMap((id) => data.kits.equipment[id]?.conditions ?? [])];
}

/** The active conditions as modifiers, with values at the build's levels. */
export function conditionModifiers(data: GameData, build: Build, ids: readonly string[], panel?: StatPanel): Modifier[] {
  const available = availableConditions(data, build);
  let p = panel;
  const getPanel = () => (p ??= computeStats(data, build));
  return ids.map((id) => {
    const c = available.find((x) => x.id === id);
    if (!c) throw new EngineError(`unknown condition ${id} for this build (available: ${available.map((x) => x.id).join(", ") || "none"})`);
    const value = conditionValue(data, build, c, getPanel);
    if (c.effect.kind === "attr") {
      const m = attrModifier(c.effect.attr, value, `condition ${c.id}`);
      if (!m) throw new EngineError(`${c.id}: attribute ${attrName(c.effect.attr)} doesn't act on hits directly; conditions on panel attributes aren't supported yet`);
      return m;
    }
    const { kind: _kind, ...filters } = c.effect;
    return { ...filters, value, source: `condition ${c.id}` };
  });
}

/** What is being hit with: everything a damage calculation needs besides the attacker and target. */
export interface DamageSpec {
  readonly skillId: string;
  readonly hitId: string;
  readonly label: string;
  readonly count: number;
  readonly element: Element;
  /** Null for damage that isn't a skill's (reactions): no skill-type bonus. */
  readonly skillType: SkillType | null;
  readonly scaleParts: readonly { readonly key: string; readonly value: number }[];
  /** Damage-over-time ticks can't crit. */
  readonly canCrit: boolean;
  readonly kind: HitKind;
}

/** All modifiers acting on a build's hits: stat panel, active conditions, and external ones. */
export function activeModifiers(data: GameData, build: Build, panel: StatPanel, options: DamageOptions): Modifier[] {
  return [...panelModifiers(data, panel), ...conditionModifiers(data, build, options.conditions, panel), ...(options.modifiers ?? [])];
}

/** The shared damage pipeline: ATK × multiplier × zones (docs/data-sources.md#3-damage-formula). */
export function computeDamage(
  data: GameData,
  build: Build,
  panel: StatPanel,
  target: DamageTarget,
  spec: DamageSpec,
  options: DamageOptions = DEFAULT_DAMAGE_OPTIONS,
): HitDamage {
  const enemy = data.enemies[target.enemy];
  if (!enemy) throw new EngineError(`unknown enemy ${target.enemy}`);
  const enemyLevel = enemy.levels[target.level - 1];
  if (!enemyLevel) throw new EngineError(`${enemy.id} has no level ${target.level}`);

  const ctx: HitContext = { element: spec.element, skillType: spec.skillType, staggered: options.staggered, kind: spec.kind };
  const mods = activeModifiers(data, build, panel, options).filter((m) => applies(m, ctx));
  const sum = (zone: Zone) => zoneSum(mods, zone, ctx);

  const scale = spec.scaleParts.reduce((p, s) => p * s.value, 1);

  const critRate = Math.min(1, Math.max(0, sum("critRate")));
  const critDamage = sum("critDamage");
  const crit = !spec.canCrit || options.crit === "never" ? 1 : options.crit === "always" ? 1 + critDamage : 1 + critRate * critDamage;

  const def = enemyLevel[Attr.Def] ?? 0;
  // 2 − 0.99^(−DEF) below zero per the Talos Wiki; negative DEF isn't reachable in the game today.
  const defense = def >= 0 ? 1 / (1 + data.constants.efficiencyOfDEF * def) : 2 - Math.pow(0.99, -def);

  // ATK% from buffs joins the panel's ATK% before the attribute bonus.
  const a = panel.atk;
  const atkBuff = sum("atk");
  const atk = atkBuff === 0 ? a.total : ((a.operatorBase + a.weaponBase) * (1 + a.percent + atkBuff) + a.flat) * a.attributeBonus;

  const zones: Zones = {
    atk,
    scale,
    damageBonus: 1 + sum("damageBonus"),
    crit,
    amp: 1 + sum("amp"),
    susceptibility: 1 + sum("susceptibility"),
    damageTaken: 1 + sum("damageTaken"),
    multiplicative: zoneProduct(mods, "multiplicative", ctx),
    stagger: options.staggered ? STAGGER_DAMAGE_TAKEN : 1,
    defense,
    resistance: (100 - enemy.resistance[spec.element] + sum("ignoreResistance")) / 100,
  };
  const exact = Object.values(zones).reduce((p, z) => p * z, 1);
  return {
    skillId: spec.skillId,
    hitId: spec.hitId,
    label: spec.label,
    count: spec.count,
    element: spec.element,
    scaleParts: spec.scaleParts,
    zones,
    modifiers: mods,
    exact,
    damage: roundDamage(exact),
  };
}

/**
 * Whether a kit hit can happen (KitHit.if): false only when the situation
 * rules it out; a condition the situation doesn't decide counts as possible.
 */
export function hitAvailable(data: GameData, build: Build, panel: StatPanel, skillId: string, hit: KitHit, situation: Situation = {}): boolean {
  return !hit.if || test(hit.if, evalContext(data, build, panel, skillId, situation)) !== false;
}

/** A reaction's own multiplier parts: base by kind and level, operator level, Arts Intensity. */
function reactionScaleParts(
  data: GameData,
  build: Build,
  panel: StatPanel,
  reaction: { readonly kind: ReactionKind; readonly element: Element; readonly stacks: number },
  options: DamageOptions,
): { key: string; value: number }[] {
  const ctx: HitContext = { element: reaction.element, skillType: null, staggered: options.staggered, kind: reaction.kind };
  const ai = zoneSum(activeModifiers(data, build, panel, options), "artsIntensity", ctx);
  return [
    { key: `${reaction.kind} base`, value: reactionBase(reaction.kind, reaction.stacks) },
    { key: "level coefficient", value: artsLevelCoefficient(build.level) },
    { key: "arts intensity", value: artsIntensityDamage(ai) },
  ];
}

/** A kit hit: its multiplier is the product of its skill's blackboard values (and its literal factor). */
export function computeHit(
  data: GameData,
  build: Build,
  panel: StatPanel,
  target: DamageTarget,
  /** Where the hit's plain value keys come from: its skill, or a triggered hit's source. */
  skill: Pick<KitSkill, "skillId">,
  hit: KitHit,
  options: DamageOptions = DEFAULT_DAMAGE_OPTIONS,
): HitDamage {
  const ec = evalContext(data, build, panel, skill.skillId, options.situation);
  if (hit.if && !decide(hit.if, ec, options.assumeUnknown)) throw new EngineError(`${skill.skillId} ${hit.id} doesn't happen in this situation (${JSON.stringify(hit.if)})`);
  const extra = (hit.extraScale ?? []).filter((x) => decide(x.if, ec, options.assumeUnknown));
  const scaleParts = [
    ...(hit.reaction ? reactionScaleParts(data, build, panel, { kind: hit.reaction.kind, element: hit.reaction.element, stacks: hit.reaction.level ?? 1 }, options) : []),
    ...hit.scale.map((key) => ({ key, value: skillValue(data, panel, build, skill.skillId, key) })),
    ...extra.map((x) => ({ key: typeof x.value === "string" ? x.value : JSON.stringify(x.value), value: evaluate(x.value, ec) })),
    ...(hit.factor !== undefined ? [{ key: "factor", value: hit.factor }] : []),
  ];
  const bonuses = (hit.bonuses ?? []).map((b): Modifier => ({ zone: b.zone, value: skillValue(data, panel, build, skill.skillId, b.key), source: `${skill.skillId} ${b.key}` }));
  if (bonuses.length) options = { ...options, modifiers: [...(options.modifiers ?? []), ...bonuses] };
  return computeDamage(data, build, panel, target, {
    skillId: skill.skillId,
    hitId: hit.id,
    label: hit.label,
    count: hit.count,
    element: hit.reaction?.element ?? hit.element,
    skillType: hit.reaction || hit.damageType === "none" ? null : hit.damageType,
    scaleParts,
    canCrit: true,
    kind: hit.reaction?.kind ?? hit.damageType,
  }, options);
}

/** An arts reaction, burst or burning tick caused by the build's operator. */
export function computeReaction(
  data: GameData,
  build: Build,
  panel: StatPanel,
  target: DamageTarget,
  reaction: { readonly kind: ReactionKind; readonly element: Element; readonly stacks: number },
  options: DamageOptions = DEFAULT_DAMAGE_OPTIONS,
): HitDamage {
  return computeDamage(data, build, panel, target, {
    skillId: `reaction:${reaction.kind}`,
    hitId: `${reaction.element}:${reaction.stacks}`,
    label: `${reaction.kind} (${reaction.element}, ${reaction.stacks})`,
    count: 1,
    element: reaction.element,
    skillType: null,
    scaleParts: reactionScaleParts(data, build, panel, reaction, options),
    canCrit: reaction.kind !== "combustionTick",
    kind: reaction.kind,
  }, options);
}

/** Every hit of the operator's kit. */
export function computeKit(data: GameData, build: Build, panel: StatPanel, target: DamageTarget, options: DamageOptions = DEFAULT_DAMAGE_OPTIONS): HitDamage[] {
  const kit = data.kits.operators[build.operator];
  if (!kit) throw new EngineError(`no kit for ${build.operator} yet`);
  // Every hit the build can have, each in the situation it's written for: conditions the options don't decide count as met.
  const opts = { assumeUnknown: true, ...options };
  return kit.skills.flatMap((s) => s.hits.filter((h) => hitAvailable(data, build, panel, s.skillId, h, opts.situation)).map((h) => computeHit(data, build, panel, target, s, h, opts)));
}
