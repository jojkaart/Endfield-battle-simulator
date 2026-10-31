// Damage of a single hit, as a product of zones following the game's
// pipeline (docs/data-sources.md#3-damage-formula). Every zone is kept in the
// result so a number can be compared zone by zone (design principle 10).

import { Attr, attrName, type AttrType, type Element, type SkillType } from "./attributes.ts";
import type { Build } from "./build.ts";
import { applies, attrModifier, UNMODELLED_DAMAGE_ATTRS, zoneProduct, zoneSum, type HitContext, type HitDecoration, type HitKind, type Modifier, type Zone } from "./effects.ts";
import { EngineError, HitRuledOut } from "./errors.ts";
import type { GameData, KitHit, KitSkill } from "./model.ts";
import { artsIntensityDamage, levelCoefficientAttr, reactionBase, type ReactionKind } from "./reactions.ts";
import { evaluate, test, type EvalContext, type Predicate } from "./expr.ts";
import { ATK_ATTRIBUTES, atkAttributeBonus, percentOfLine, skillLevel, type StatPanel } from "./stats.ts";

/** `expected`: the crit zone at its average; `rolled`: each hit crits or not, by a roll the caller makes (DamageOptions.critRoll). */
export type CritMode = "never" | "always" | "expected" | "rolled";

export interface DamageOptions {
  readonly crit: CritMode;
  /** With rolled crits: a uniform draw in [0, 1); the hit crits when it's below its crit rate. */
  readonly critRoll?: number;
  readonly staggered: boolean;
  /** Further active buffs and debuffs, e.g. from a battle log or the timeline. */
  readonly modifiers?: readonly Modifier[];
  /** What's known about the moment of the hit, for kit predicates (KitHit.if, extraScale); unknown parts are left out. */
  readonly situation?: Situation;
  /**
   * What modifiers that hold only in a situation (Modifier.when) are judged
   * on, when it differs from `situation`: a kit hit's see the enemy after
   * the hit's own applications (the game checks the target's tags when the
   * damage is computed, after SpellInfliction). Default: `situation`.
   */
  readonly modifierSituation?: Situation;
  /** What a predicate the situation can't decide counts as (the log checker tries both); default: an error. */
  readonly assumeUnknown?: boolean;
  /** A kit hit's decorations (the timeline knows a finisher's); default: what the hit and its skill's data say. */
  readonly decorations?: readonly HitDecoration[];
}

/** The parts of an EvalContext that describe the moment rather than the build. */
export type Situation = Partial<Pick<EvalContext, "team" | "enemy" | "stacks" | "buffActive" | "buffLayers" | "consumed" | "eventCount" | "eventRemaining" | "eventRecorded" | "attrBonus" | "enemyGameBuffs" | "operatorModifiers" | "operatorBuffs" | "castLink" | "currentAction" | "enemySuperArmor" | "enemyRank" | "controlled" | "staggered" | "enemyHp" | "enemyModifiers" | "owner" | "eventOperator">>;

/** The context kit predicates and values are evaluated in, for a build's skill. */
export function evalContext(data: GameData, build: Build, panel: StatPanel, skillId: string, situation: Situation = {}): EvalContext {
  return { data, build, panel, skillId, ...situation, skillValue: (s, k) => skillValue(data, panel, build, s, k) };
}

/** A predicate's verdict; `assume` decides what an unknown one counts as (undefined: error). */
export function decide(p: Predicate, c: EvalContext, assume?: boolean, of?: string): boolean {
  const v = test(p, c);
  if (v !== undefined) return v;
  if (assume === undefined) throw new EngineError(`a kit condition${of ? ` (${of})` : ""} can't be decided here: ${JSON.stringify(p)}`);
  return assume;
}

export const DEFAULT_DAMAGE_OPTIONS: DamageOptions = { crit: "expected", staggered: false };

export interface DamageTarget {
  readonly enemy: string;
  readonly level: number;
  /**
   * The enemy is immune to control (the game's control-immune tag
   * 188749032; no table says which enemies have it): control statuses are
   * applied, but don't freeze it. Absent: a Boss (rank 2) is, others aren't
   * (timeline/clock.ts controlImmune).
   */
  readonly controlImmune?: boolean;
}

export interface Zones {
  readonly atk: number;
  readonly scale: number;
  readonly damageBonus: number;
  readonly crit: number;
  readonly amp: number;
  readonly susceptibility: number;
  readonly damageTaken: number;
  /** Its multiplicative modifiers, each × (1 + v): Stagger's among them (staggerModifier). */
  readonly multiplicative: number;
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
  /** With rolled crits, whether it crit (absent for hits that can't). */
  readonly crit?: boolean;
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

const attachableCache = new WeakMap<object, ReadonlySet<string>>();

/** Every skill and buff an operator's talents and potentials can attach, at any level. */
function attachable(op: GameData["operators"][string]): ReadonlySet<string> {
  let set = attachableCache.get(op);
  if (!set) {
    set = new Set([...op.talentNodes.flatMap((n) => n.effects), ...op.potentials.flat()].flatMap((e) => (e.kind === "skill" ? [e.skillId] : e.kind === "buff" ? [e.buffId] : [])));
    attachableCache.set(op, set);
  }
  return set;
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
    // A talent or potential source this build hasn't unlocked contributes nothing.
    if (!bb && attachable(op).has(skillId)) return 0;
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
    if (UNMODELLED_DAMAGE_ATTRS.has(attr)) throw new EngineError(`${panel.operator}'s stat panel has ${attrName(attr)} ${total}: a damage zone the engine doesn't model (effects.ts UNMODELLED_DAMAGE_ATTRS)`);
    const m = attrModifier(attr, total, `stat panel: ${attrName(attr)}`);
    if (m) out.push(m);
  }
  return out;
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
  /** The value the multiplier multiplies in place of ATK (KitHit.base). */
  readonly base?: number;
  /** The landing's decorations (Final Strike, finisher, dive), for decoration-limited modifiers. */
  readonly decorations?: readonly HitDecoration[];
  /** Each modifier of these zones that reaches the hit × the value (KitHit.zoneScale, resolved). */
  readonly zoneScale?: readonly { readonly zone: Zone; readonly value: number }[];
}

/** A hit's modifiers with its zone scales applied (KitHit.zoneScale): each modifier of a scaled zone × the zone's factors. */
function scaleZones(mods: readonly Modifier[], scales: DamageSpec["zoneScale"]): Modifier[] {
  if (!scales?.length) return [...mods];
  return mods.map((m) => {
    const f = scales.filter((s) => s.zone === m.zone).reduce((p, s) => p * s.value, 1);
    return f === 1 ? m : { ...m, value: m.value * f, source: `${m.source} × ${f} (the hit's zoneScale)` };
  });
}

/**
 * Stagger's multiplier as a modifier (GameData.constants.staggerDamageTaken: buff_common_poise_break_damage_taken_scale,
 * a defender-side ProdCalcZone buff the game puts on a Staggered enemy): the one representation of Stagger in the damage
 * pipeline, added by activeModifiers when DamageOptions.staggered says so. Until 2026-10-25 the pipeline also had a
 * Stagger zone of ×1.3 and the timeline added this as well: ×1.69 (round-two review).
 */
export function staggerModifier(data: GameData): Modifier {
  return { zone: "multiplicative", value: data.constants.staggerDamageTaken, source: "Staggered" };
}

/** All modifiers acting on a build's hits: stat panel and external ones (kit buffs, a log's, the scenario's), and Stagger's when the target is Staggered. */
export function activeModifiers(data: GameData, build: Build, panel: StatPanel, options: DamageOptions): Modifier[] {
  const all = [...panelModifiers(data, panel), ...(options.modifiers ?? []), ...(options.staggered ? [staggerModifier(data)] : [])];
  if (!all.some((m) => m.when)) return all;
  // A modifier that holds only in a situation (KitBuffModifier.if): judged on the hit's situation; one it can't decide counts as assumeUnknown says (default: an error, as for KitHit.if).
  const ec = evalContext(data, build, panel, "", options.modifierSituation ?? options.situation);
  return all.filter((m) => !m.when || decide(m.when, ec, options.assumeUnknown, m.source));
}

/**
 * ATK's attribute bonus with the attributes a hit's modifiers of zone
 * `attribute` add (points, or a percentage of the panel line: buffs'
 * Strength, Agility, Intellect, Will) to the panel's, as the stat panel
 * computes it (stats.ts atkAttributeBonus); the panel's bonus without any.
 */
function buffedAttributeBonus(data: GameData, panel: StatPanel, mods: readonly Modifier[]): number {
  const points = new Map<AttrType, number>();
  for (const m of mods) {
    if (m.zone !== "attribute") continue;
    if (m.attr === undefined || !ATK_ATTRIBUTES.has(m.attr)) throw new EngineError(`${m.source}: an attribute modifier names Strength, Agility, Intellect or Will`);
    const line = panel.attrs[m.attr];
    if (m.percent && !line) throw new EngineError(`${m.source}: a percentage of attribute ${m.attr}, which ${panel.operator}'s panel hasn't`);
    points.set(m.attr, (points.get(m.attr) ?? 0) + (m.percent && line ? percentOfLine(m.value, line) : m.value));
  }
  if (points.size === 0) return panel.atk.attributeBonus;
  return atkAttributeBonus(data, panel, panel.atk.floorAttributes, (attr) => points.get(attr) ?? 0).attributeBonus;
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

  const ctx: HitContext = { element: spec.element, skillType: spec.skillType, staggered: options.staggered, kind: spec.kind, ...(spec.decorations?.length ? { decorations: spec.decorations } : {}) };
  const mods = scaleZones(activeModifiers(data, build, panel, options).filter((m) => applies(m, ctx)), spec.zoneScale);
  const sum = (zone: Zone) => zoneSum(mods, zone, ctx);

  const scale = spec.scaleParts.reduce((p, s) => p * s.value, 1);

  const critRate = Math.min(1, Math.max(0, sum("critRate")));
  const critDamage = sum("critDamage");
  if (options.crit === "rolled" && options.critRoll === undefined) throw new EngineError("rolled crits need a roll for each hit (the timeline rolls them)");
  const rolled = options.crit === "rolled" && spec.canCrit ? (options.critRoll as number) < critRate : undefined;
  const crit = !spec.canCrit || options.crit === "never" ? 1 : options.crit === "always" || rolled ? 1 + critDamage : rolled === false ? 1 : 1 + critRate * critDamage;

  const def = enemyLevel[Attr.Def];
  if (def === undefined) throw new EngineError(`${enemy.id} has no DEF at level ${target.level}`);
  // 2 − 0.99^(−DEF) below zero per the Talos Wiki; negative DEF isn't reachable in the game today.
  const defense = def >= 0 ? 1 / (1 + data.constants.efficiencyOfDEF * def) : 2 - Math.pow(0.99, -def);

  // ATK% from buffs joins the panel's ATK% before the attribute bonus; buffs' attributes join the panel's in it.
  const a = panel.atk;
  const atkBuff = sum("atk");
  const attributeBonus = buffedAttributeBonus(data, panel, mods);
  const atk = spec.base !== undefined ? spec.base : atkBuff === 0 && attributeBonus === a.attributeBonus ? a.total : ((a.operatorBase + a.weaponBase) * (1 + a.percent + atkBuff) + a.flat) * attributeBonus;

  const zones: Zones = {
    atk,
    scale,
    damageBonus: 1 + sum("damageBonus"),
    crit,
    amp: 1 + sum("amp"),
    susceptibility: 1 + sum("susceptibility"),
    damageTaken: 1 + sum("damageTaken"),
    multiplicative: zoneProduct(mods, "multiplicative", ctx),
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
    ...(rolled !== undefined ? { crit: rolled } : {}),
  };
}

/**
 * Whether a kit hit can happen (KitHit.if): false only when the situation
 * rules it out; a condition the situation doesn't decide counts as possible.
 */
export function hitAvailable(data: GameData, build: Build, panel: StatPanel, skillId: string, hit: KitHit, situation: Situation = {}): boolean {
  return !hit.if || test(hit.if, evalContext(data, build, panel, skillId, situation)) !== false;
}

/** The operator-level scaling of a reaction's damage: its panel line (reactions.ts levelCoefficientAttr), never a default. */
function levelCoefficient(panel: StatPanel, kind: ReactionKind): number {
  const attr = levelCoefficientAttr(kind);
  const v = panel.attrs[attr]?.total;
  if (v === undefined) throw new EngineError(`${panel.operator}'s stat panel has no ${attrName(attr)} (the level coefficient of ${kind} damage)`);
  return v;
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
    { key: "level coefficient", value: levelCoefficient(panel, reaction.kind) },
    { key: "arts intensity", value: artsIntensityDamage(ai) },
  ];
}

/** A hit's landings per use for a per-hit listing: its count, or 1 for a count judged at the cast (a value). */
const staticCount = (hit: KitHit): number => (typeof hit.count === "number" ? hit.count : 1);

/** A Fixed DMG hit (KitHit.fixedDamage): exactly its value, every zone ×1. */
export function fixedHit(skillId: string, hit: KitHit, value: number): HitDamage {
  const zones: Zones = { atk: 1, scale: 1, damageBonus: 1, crit: 1, amp: 1, susceptibility: 1, damageTaken: 1, multiplicative: 1, defense: 1, resistance: 1 };
  return { skillId, hitId: hit.id, label: hit.label, count: staticCount(hit), element: hit.element, scaleParts: [{ key: "fixed", value }], zones, modifiers: [], exact: value, damage: roundDamage(value) };
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
  if (hit.if && !decide(hit.if, ec, options.assumeUnknown)) throw new HitRuledOut(`${skill.skillId} ${hit.id} doesn't happen in this situation (${JSON.stringify(hit.if)})`);
  if (hit.fixedDamage !== undefined) return fixedHit(skill.skillId, hit, evaluate(hit.fixedDamage, ec));
  const extra = (hit.extraScale ?? []).filter((x) => decide(x.if, ec, options.assumeUnknown));
  const scaleParts = [
    ...(hit.reaction ? reactionScaleParts(data, build, panel, { kind: hit.reaction.kind, element: hit.reaction.element, stacks: hit.reaction.level ?? 1 }, options) : []),
    ...hit.scale.map((key) => ({ key, value: skillValue(data, panel, build, skill.skillId, key) })),
    ...(hit.scaleValue !== undefined ? [{ key: "value", value: evaluate(hit.scaleValue, ec) }] : []),
    ...extra.map((x) => ({ key: typeof x.value === "string" ? x.value : JSON.stringify(x.value), value: evaluate(x.value, ec) })),
    ...(hit.factor !== undefined ? [{ key: "factor", value: hit.factor }] : []),
  ];
  const bonuses = (hit.bonuses ?? []).map((b): Modifier => ({ zone: b.zone, value: skillValue(data, panel, build, skill.skillId, b.key), source: `${skill.skillId} ${b.key}` }));
  if (bonuses.length) options = { ...options, modifiers: [...(options.modifiers ?? []), ...bonuses] };
  return computeDamage(data, build, panel, target, {
    skillId: skill.skillId,
    hitId: hit.id,
    label: hit.label,
    count: staticCount(hit),
    element: hit.reaction?.element ?? hit.element,
    skillType: hit.reaction || hit.damageType === "none" ? null : hit.damageType,
    scaleParts,
    canCrit: true,
    kind: hit.reaction?.kind ?? hit.damageType,
    ...(hit.base !== undefined ? { base: evaluate(hit.base, ec) } : {}),
    decorations: options.decorations ?? hitDecorations(hit, data.skills[skill.skillId]?.timing?.specification === 8),
    ...(hit.zoneScale?.length ? { zoneScale: hit.zoneScale.map((z) => ({ zone: z.zone, value: evaluate(z.value, ec) })) } : {}),
  }, options);
}

/** A kit hit's decorations: a Final Strike's and a dive attack's from the hit, a finisher's (its skill is of skillSpecification 8) as given. */
export function hitDecorations(hit: Pick<KitHit, "finalStrike" | "dive">, finisher: boolean): HitDecoration[] {
  return [...(hit.finalStrike ? ["finalStrike" as const] : []), ...(finisher ? ["finisher" as const] : []), ...(hit.dive ? ["dive" as const] : [])];
}

/** An arts reaction, burst or burning tick caused by the build's operator. */
export function computeReaction(
  data: GameData,
  build: Build,
  panel: StatPanel,
  target: DamageTarget,
  reaction: { readonly kind: ReactionKind; readonly element: Element; readonly stacks: number },
  options: DamageOptions = DEFAULT_DAMAGE_OPTIONS,
  /** A status event's own multiplier part (a Combustion tick's damageScale, a Crush's multiplier): one more scale part. */
  scale?: { readonly key: string; readonly value: number },
): HitDamage {
  return computeDamage(data, build, panel, target, {
    skillId: `reaction:${reaction.kind}`,
    hitId: `${reaction.element}:${reaction.stacks}`,
    label: `${reaction.kind} (${reaction.element}, ${reaction.stacks})`,
    count: 1,
    element: reaction.element,
    skillType: null,
    scaleParts: [...reactionScaleParts(data, build, panel, reaction, options), ...(scale ? [scale] : [])],
    canCrit: reaction.kind !== "combustionTick",
    kind: reaction.kind,
  }, options);
}

/** A finisher's multiplier (skillSpecification 8): the enemy's attribute 27, else its default, as a multiplicative modifier. */
export function finisherModifier(data: GameData, enemy: string): Modifier {
  const attr = Attr.BreakingAttackDamageTakenScalar;
  const v = data.enemies[enemy]?.staticAttrs[attr] ?? data.attributeDefaults[attr];
  if (v === undefined) throw new EngineError(`${enemy} has no ${attrName(attr)}, nor has the data a default for it`);
  return { zone: "multiplicative", value: v - 1, source: "Finisher" };
}

/** Every hit of the operator's kit. */
export function computeKit(data: GameData, build: Build, panel: StatPanel, target: DamageTarget, options: DamageOptions = DEFAULT_DAMAGE_OPTIONS): HitDamage[] {
  const kit = data.kits.operators[build.operator];
  if (!kit) throw new EngineError(`no kit for ${build.operator} yet`);
  // Every hit the build can have, each in the situation it's written for: conditions the options don't decide count as met.
  const opts = { assumeUnknown: true, ...options };
  // A poise-only landing (KitHit.poiseOnly) deals no damage.
  return kit.skills.flatMap((s) => s.hits.filter((h) => !h.poiseOnly && hitAvailable(data, build, panel, s.skillId, h, opts.situation)).map((h) => computeHit(data, build, panel, target, s, h, opts)));
}
