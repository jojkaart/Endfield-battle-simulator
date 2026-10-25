// The timeline's context (docs/design.md#simulation-model: the build stage) and what it looks up in the data.

import { Attr, type AttrType, type SkillType } from "../attributes.ts";
import type { Build } from "../build.ts";
import { conditionModifiers } from "../damage.ts";
import { EngineError } from "../errors.ts";
import type { GameData, KitSkill, SkillTiming } from "../model.ts";
import { effectiveKit } from "../triggers.ts";
import { allActions } from "../events.ts";
import { computeStats, DEFAULT_STAT_OPTIONS, foodOf, skillLevel, skillParam, type StatPanel } from "../stats.ts";
import { ARTS_ELEMENTS } from "../status.ts";
import type { ArtsElement } from "../reactions.ts";
import { FPS } from "../units.ts";
import type { EnemyAction, TimelineContext, TimelineScenario } from "./state.ts";
import { DIVE, DODGE, JUMP } from "./rules.ts";

/** Operator attributes the timeline reads from the panel, whose default (GameData.attributeDefaults) holds when no line sets them. */
const TIMELINE_ATTRS: readonly AttrType[] = [
  Attr.ComboSkillCooldownScalar, Attr.ComboSkillCooldownRecoveryScalar, Attr.KeywordSpeedUpScalar, Attr.UltimateSpGainScalar, Attr.PoiseDamageOutputScalar, Attr.AtbCostAddition,
];

/** Enemy attributes the timeline reads (enemyAttr): the enemy's own, else their default. */
const ENEMY_ATTRS: readonly AttrType[] = [Attr.MaxPoise, Attr.PoiseDamageTakenScalar, Attr.PoiseRecTime, Attr.PoiseRecTimeScalar, Attr.BreakingAttackDamageTakenScalar];

function loggedCritsByKey(list: NonNullable<TimelineScenario["loggedCrits"]>): Map<string, { frame: number; crit: boolean }[]> {
  const out = new Map<string, { frame: number; crit: boolean }[]>();
  for (const x of list) out.set(`${x.operator}|${x.event}`, [...(out.get(`${x.operator}|${x.event}`) ?? []), { frame: x.frame, crit: x.crit }]);
  return out;
}

function byOperatorEvent<T extends { readonly operator: string; readonly event: string }>(list: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const x of list) out.set(`${x.operator}|${x.event}`, [...(out.get(`${x.operator}|${x.event}`) ?? []), x]);
  return out;
}

export function createContext(data: GameData, scenario: TimelineScenario): TimelineContext {
  if (scenario.team.length === 0 || scenario.team.length > 4) throw new EngineError("a team has 1–4 operators");
  const builds = new Map(scenario.team.map((b) => [b.operator, b]));
  if (builds.size !== scenario.team.length) throw new EngineError("an operator appears twice in the team");
  const panels = new Map(scenario.team.map((b) => [b.operator, computeStats(data, b)]));
  // A food buff lasts its duration from the fight's start; after it, the operator's panel is the one without it.
  const foodEnds = new Map(scenario.team.flatMap((b) => {
    const food = foodOf(data, b);
    return food ? [[b.operator, { frame: Math.round(food.duration * FPS), panel: computeStats(data, b, { ...DEFAULT_STAT_OPTIONS, withoutFood: true }) }] as const] : [];
  }));
  const modifiers = new Map(
    scenario.team.map((b) => [b.operator, [...conditionModifiers(data, b, scenario.options.conditions?.[b.operator] ?? []), ...(scenario.options.modifiers ?? [])]]),
  );
  const kits = new Map(scenario.team.flatMap((b) => {
    const kit = effectiveKit(data, b);
    return kit ? [[b.operator, kit] as const] : [];
  }));
  const beforeDamage = [...kits.values()].some((k) => k.triggers.some((t) => t.beforeDamage));
  const buffAttrs = new Set([...kits.values()].flatMap((k) => k.buffs.flatMap((b) => b.modifiers.flatMap((m) => (m.attr !== undefined ? [m.attr] : [])))));
  const inputBuffs = [...kits.values()].some((k) => k.buffs.some((b) => b.basicAttack !== undefined));
  const ownWindows = new Map([...kits].map(([op, k]) => [op, new Set(k.triggers.flatMap((t) => allActions(t.do).flatMap((a) => (a.kind === "openCombo" ? (a.skills ?? []) : []))))] as const));
  // What the timeline needs from the data, checked once here (design principle 7: no defaults for missing data).
  const enemy = data.enemies[scenario.target.enemy];
  if (!enemy) throw new EngineError(`unknown enemy ${scenario.target.enemy}`);
  for (const a of TIMELINE_ATTRS) if (data.attributeDefaults[a] === undefined) throw new EngineError(`attribute ${a} has no default in the data (AttributeTable), and the timeline reads it`);
  for (const a of ENEMY_ATTRS) if (enemy.staticAttrs[a] === undefined && data.attributeDefaults[a] === undefined) throw new EngineError(`${enemy.id} has no attribute ${a}, nor has the data a default for it`);
  const delays = data.constants.burstDelayFrames;
  const noDelay = ARTS_ELEMENTS.filter((e) => delays?.[e] === undefined);
  if (!delays || noDelay.length) throw new EngineError(`the data has no burst delay (BattleConstants burstDelayFrames) for ${noDelay.join(", ")}`);
  if (scenario.options.dodge && !data.constants.perfectDodge) throw new EngineError("dodging needs the perfect dodge settings (BattleConstants perfectDodge), which the data doesn't have");
  return {
    data, scenario, builds, panels, modifiers, kits, beforeDamage, enemy, burstDelayFrames: delays as Record<ArtsElement, number>, ownWindows,
    ...(foodEnds.size ? { foodEnds } : {}),
    ...(scenario.loggedCrits ? { loggedCrits: loggedCritsByKey(scenario.loggedCrits) } : {}),
    ...(scenario.loggedModifiers ? { loggedModifiers: byOperatorEvent(scenario.loggedModifiers) } : {}),
    ...(buffAttrs.has(Attr.ComboSkillCooldownRecoveryScalar) ? { comboRates: true } : {}),
    ...(buffAttrs.has(Attr.AtbCostAddition) ? { costBuffs: true } : {}),
    ...(inputBuffs ? { inputBuffs: true } : {}),
  };
}

/** An operator's stat panel at a frame: the fight's start's, until its food buff ends (TimelineContext.foodEnds). */
export function panelAt(ctx: TimelineContext, operator: string, frame: number): StatPanel {
  const end = ctx.foodEnds?.get(operator);
  if (end && frame >= end.frame) return end.panel;
  const panel = ctx.panels.get(operator);
  if (!panel) throw new EngineError(`${operator} isn't in the team`);
  return panel;
}

/** An attribute's total on a panel: its line's, else the attribute's default (one of TIMELINE_ATTRS, checked in createContext). */
export function attrTotal(ctx: TimelineContext, panel: StatPanel, attr: AttrType): number {
  const v = panel.attrs[attr]?.total ?? ctx.data.attributeDefaults[attr];
  if (v === undefined) throw new EngineError(`attribute ${attr} has no default in the data`);
  return v;
}

export function kitSkill(ctx: TimelineContext, operator: string, skillId: string): KitSkill {
  const kit = ctx.kits.get(operator);
  if (!kit) throw new EngineError(`no kit for ${operator}`);
  const s = kit.skills.find((x) => x.skillId === skillId);
  if (!s) throw new EngineError(`${operator}'s kit has no skill ${skillId}`);
  return s;
}

export function skillGroup(ctx: TimelineContext, operator: string, skillId: string): SkillType {
  const g = ctx.data.operators[operator]?.skillGroups[skillId];
  if (!g) throw new EngineError(`${skillId} isn't one of ${operator}'s skills`);
  return g;
}

/** SP cost and cooldown frames of a skill at the operator's level, and its timing. */
export function skillCosts(ctx: TimelineContext, operator: string, skillId: string, frame: number) {
  const build = ctx.builds.get(operator) as Build;
  const skill = ctx.data.skills[skillId];
  if (!skill) throw new EngineError(`unknown skill ${skillId}`);
  const group = skillGroup(ctx, operator, skillId);
  const level = skillLevel(skill, build.skillLevels[group]);
  const timing = skill.timing;
  if (!timing) throw new EngineError(`${skillId}: SkillData isn't loaded, so its timing is unknown`);
  const panel = panelAt(ctx, operator, frame);
  const cost = skillParam(panel, skillId, "cost", level.costValue);
  const kind = kitSkill(ctx, operator, skillId).kind;
  // Combo cooldowns scale with attribute 47 (ComboSkillCooldownScalar: Frontiers, Qingbo ×0.85).
  const scalar = kind === "combo" ? attrTotal(ctx, panel, Attr.ComboSkillCooldownScalar) : 1;
  return {
    group,
    /** The action's kind (KitSkill.kind), which basic-attack control and combo windows go by. */
    kind,
    /** costType 1: it costs SP (its cost then changes with attribute 45: spCostAt). */
    paysSp: level.costType === 1,
    spCost: level.costType === 1 ? cost : 0,
    /** costType 0: ultimate energy. */
    energyCost: level.costType === 0 ? cost : 0,
    cooldownFrames: Math.round(skillParam(panel, skillId, "cooldown", level.coolDown) * scalar * FPS),
    timing,
  };
}

export function timingOf(ctx: TimelineContext, skillId: string): SkillTiming {
  if (skillId === DODGE) {
    const pd = ctx.data.constants.perfectDodge;
    // Only a perfect dodge makes this the current action, and dodging needs the settings (createContext).
    if (!pd) throw new EngineError("a perfect dodge without the perfect dodge settings in the data");
    const n = pd.busyFrames;
    return { durationFrames: n, exclusiveFrames: n, windows: [], channels: [], specification: 2, keepsChain: true, slowdowns: [], jumps: [], ends: [] };
  }
  // In the air until the landing at the latest (a plunging action: nothing else of the operator's starts meanwhile).
  if (skillId === JUMP) return { durationFrames: DIVE.rise + DIVE.fall, exclusiveFrames: DIVE.rise + DIVE.fall, windows: [], channels: [], specification: 6, keepsChain: false, slowdowns: [], jumps: [], ends: [] };
  const t = ctx.data.skills[skillId]?.timing;
  if (!t) throw new EngineError(`${skillId}: SkillData isn't loaded, so its timing is unknown`);
  return t;
}

/** A scenario's enemy actions, in frame order (attacks before charges at one frame), up to the fight's end. */
export function enemyActionsOf(scenario: TimelineScenario): EnemyAction[] {
  const out: EnemyAction[] = [];
  for (const spec of scenario.enemyActions ?? []) {
    if (spec.every !== undefined && !(spec.every > 0)) throw new EngineError(`an enemy action's interval must be positive, not ${spec.every}`);
    const frames = spec.at ?? [];
    const every = spec.every !== undefined ? Array.from({ length: Math.max(0, Math.floor((scenario.durationFrames - (spec.from ?? spec.every)) / spec.every) + 1) }, (_, i) => Math.round((spec.from ?? spec.every as number) + i * (spec.every as number))) : [];
    for (const frame of [...frames, ...every]) if (frame >= 0 && frame <= scenario.durationFrames) out.push({ frame, kind: spec.kind, target: spec.target ?? "controlled", element: spec.element ?? "physical" });
  }
  return out.sort((a, b) => a.frame - b.frame || (a.kind === b.kind ? 0 : a.kind === "attack" ? -1 : 1));
}

/** An enemy attribute from its level-independent ones, else the attribute's default (one of ENEMY_ATTRS, checked in createContext). */
export function enemyAttr(ctx: TimelineContext, attr: AttrType): number {
  const v = ctx.enemy.staticAttrs[attr] ?? ctx.data.attributeDefaults[attr];
  if (v === undefined) throw new EngineError(`${ctx.enemy.id} has no attribute ${attr}, nor has the data a default for it`);
  return v;
}

/** The enemy's stagger HP (attribute 20); an enemy without one can't be staggered. */
export function maxPoise(ctx: TimelineContext): number {
  const v = enemyAttr(ctx, Attr.MaxPoise);
  return v > 0 ? v : Infinity;
}

/** The enemy's HP fraction at a frame (TimelineScenario.enemyHp; 1 before the first entry). */
export function enemyHpAt(scenario: TimelineScenario, frame: number): number {
  let hp = 1;
  for (const e of [...(scenario.enemyHp ?? [])].sort((a, b) => a.from - b.from)) if (e.from <= frame) hp = e.fraction;
  return hp;
}
