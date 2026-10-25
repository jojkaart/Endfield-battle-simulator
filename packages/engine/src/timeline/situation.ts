// What kit predicates, values and damage see at a frame (Situation, damage options).

import type { SkillType } from "../attributes.ts";
import type { Build } from "../build.ts";
import { activeModifiers, evalContext, type Situation } from "../damage.ts";
import { type Modifier, SNAPSHOT_ZONES, zoneSum } from "../effects.ts";
import type { EventSource } from "../model.ts";
import type { BattleEvent } from "../events.ts";
import { evaluate } from "../expr.ts";
import { activeAt, type ActiveBuff, buffAttr, buffModifiers, reaches } from "../buffs.ts";
import { type EnemyStatus, expireStatus, statusModifiers, type StatusTweaks } from "../status.ts";
import { FPS } from "../units.ts";
import type { TimelineContext, TimelineState } from "./state.ts";
import { DODGE, JUMP } from "./rules.ts";
import { enemyHpAt, kitSkill, panelAt, timingOf } from "./context.ts";
import { isStaggered } from "./resources.ts";
import { actionFrame } from "./timing.ts";

/**
 * An operator's attacker-side buff modifiers at a frame (effects.ts
 * SNAPSHOT_ZONES), which periodic damage with an ATK snapshot keeps from its
 * application (Combustion, KitHit.atkSnapshot).
 */
export function attackerSide(st: TimelineState, operator: string, frame: number): Modifier[] {
  return buffModifiers(st.buffs, operator, frame).filter((m) => SNAPSHOT_ZONES.has(m.zone));
}

/**
 * `cast`: the hit's cast, for buffs a cast consumed (they act on its hits
 * only). `snapshot`: the attacker-side modifiers taken at an earlier
 * application (attackerSide), used instead of the buffs' current ones there.
 */
export function damageOptions(ctx: TimelineContext, st: TimelineState, operator: string, enemy: EnemyStatus, frame: number, cast?: number, snapshot?: readonly Modifier[]) {
  const staggered = isStaggered(st, frame);
  const buffs = buffModifiers(st.buffs, operator, frame, cast);
  return {
    crit: ctx.scenario.options.crit,
    staggered,
    conditions: [],
    // What modifiers that hold only in a situation judge (KitBuffModifier.if); a hit passes its own.
    situation: situationAt(ctx, operator, { ...st, enemy }, frame),
    modifiers: [
      ...(ctx.modifiers.get(operator) ?? []),
      ...statusModifiers(enemy, frame),
      ...(snapshot ? [...buffs.filter((m) => !SNAPSHOT_ZONES.has(m.zone)), ...snapshot] : buffs),
      // buff_common_poise_break_damage_taken_scale: defender ProdCalcZone ×1.3 while Staggered.
      ...(staggered ? [{ zone: "multiplicative" as const, value: 0.3, source: "Staggered" }] : []),
    ],
  };
}

/** What kit predicates and values see for an operator at a frame. */
export function situationAt(ctx: TimelineContext, operator: string, st: TimelineState, frame: number, consumed?: number): Situation {
  const active = (b: ActiveBuff) => activeAt(b, frame);
  return {
    team: ctx.scenario.team,
    enemy: expireStatus(st.enemy, frame),
    stacks: st.stacks[operator] ?? {},
    buffActive: (id) => st.buffs.some((b) => b.id === id && b.owner === operator && b.cast === undefined && active(b)),
    buffLayers: (id) => st.buffs.filter((b) => b.id === id && b.owner === operator && b.cast === undefined && active(b)).length,
    controlled: st.controlled,
    staggered: isStaggered(st, frame),
    enemyHp: enemyHpAt(ctx.scenario, frame),
    enemyModifiers: st.buffs.filter((b) => b.target === "enemy" && active(b)).flatMap((b) => b.modifiers),
    attrBonus: (attr) => buffAttr(st.buffs, operator, frame, attr, panelAt(ctx, operator, frame).attrs[attr]),
    enemyGameBuffs: new Set(st.buffs.filter((b) => b.target === "enemy" && b.gameBuff && active(b)).map((b) => b.gameBuff as string)),
    operatorModifiers: st.buffs.filter((b) => b.target !== "enemy" && b.cast === undefined && reaches(b, operator) && active(b)).flatMap((b) => b.modifiers),
    operatorBuffs: st.buffs.filter((b) => b.target !== "enemy" && b.cast === undefined && reaches(b, operator) && active(b)).map((b) => ({ categories: b.categories ?? [], ...(b.gameBuff ? { gameBuff: b.gameBuff } : {}) })),
    currentAction: currentActionOf(ctx, st, operator, frame),
    ...enemyStanding(ctx, isStaggered(st, frame)),
    ...(consumed !== undefined ? { consumed } : {}),
  };
}

/**
 * An operator's running action at a frame (the `currentAction` predicate): its kind (a kit skill's KitSkill.kind; `none`
 * for the perfect-dodge skill) and whether its playhead is before the skill's exclusive frame (SkillData
 * exclusiveFrame); null once it's over.
 */
function currentActionOf(ctx: TimelineContext, st: TimelineState, operator: string, frame: number): { kind: SkillType | "none"; beforeExclusive: boolean } | null {
  const cur = st.acting[operator];
  if (!cur) return null;
  const t = timingOf(ctx, cur.skill);
  if (frame >= actionFrame(cur, t.durationFrames)) return null;
  const kind = cur.skill === DODGE || cur.skill === JUMP ? "none" : kitSkill(ctx, operator, cur.skill).kind;
  return { kind, beforeExclusive: frame < actionFrame(cur, t.exclusiveFrames) };
}

/** The enemy's super armor (its Staggered value while Staggered) and rank, where the data has them. */
function enemyStanding(ctx: TimelineContext, staggered: boolean): Situation {
  const e = ctx.enemy;
  return {
    ...(e.superArmor ? { enemySuperArmor: staggered ? e.superArmor.staggered : e.superArmor.initial } : {}),
    ...(e.rank !== undefined ? { enemyRank: e.rank } : {}),
  };
}

/** The parts of a situation that describe the enemy (its arts and physical state, the buffs on it). */
function enemySituation(s: Situation): Situation {
  return { ...(s.enemy ? { enemy: s.enemy } : {}), ...(s.enemyGameBuffs ? { enemyGameBuffs: s.enemyGameBuffs } : {}), ...(s.enemyModifiers ? { enemyModifiers: s.enemyModifiers } : {}) };
}

/** The parts of a situation the buffs give (which are active, their layers and what they add), the enemy's included. */
export function buffSituation(s: Situation): Situation {
  return {
    ...enemySituation(s),
    ...(s.buffActive ? { buffActive: s.buffActive } : {}),
    ...(s.buffLayers ? { buffLayers: s.buffLayers } : {}),
    ...(s.attrBonus ? { attrBonus: s.attrBonus } : {}),
    ...(s.operatorModifiers ? { operatorModifiers: s.operatorModifiers } : {}),
    ...(s.operatorBuffs ? { operatorBuffs: s.operatorBuffs } : {}),
  };
}

/** An operator's Arts Intensity at a frame (panel, conditions and active buffs): it sets the strength of the statuses it applies. */
export function artsIntensity(ctx: TimelineContext, st: TimelineState, operator: string, frame: number): number {
  const build = ctx.builds.get(operator) as Build;
  const mods = activeModifiers(ctx.data, build, panelAt(ctx, operator, frame), { crit: "never", staggered: false, conditions: [], modifiers: [...(ctx.modifiers.get(operator) ?? []), ...buffModifiers(st.buffs, operator, frame)] });
  return zoneSum(mods, "artsIntensity", { element: "physical", skillType: null, staggered: false });
}

/** Heal events from a healer: to itself, the controlled operator, the team, or named operators. */
export function healEvents(ctx: TimelineContext, st: TimelineState, healer: string, target: "self" | "controlled" | "team" | readonly string[], frame: number, kind: SkillType | "none"): BattleEvent[] {
  const targets = target === "self" ? [healer] : target === "controlled" ? [st.controlled] : target === "team" ? ctx.scenario.team.map((b) => b.operator) : target;
  return targets.map((t) => ({ type: "heal", frame, operator: healer, target: t, kind }));
}

/** How an operator's kit changes the statuses it applies, resolved at a frame (OperatorKit.statusTweaks). */
export function statusTweaks(ctx: TimelineContext, st: TimelineState, operator: string, frame: number): StatusTweaks {
  const tweaks = ctx.kits.get(operator)?.statusTweaks;
  if (!tweaks?.length) return {};
  const build = ctx.builds.get(operator) as Build;
  const panel = panelAt(ctx, operator, frame);
  const out: Record<string, { extraFrames: number; capScale: number }> = {};
  for (const t of tweaks) {
    const ec = evalContext(ctx.data, build, panel, t.skill ?? "", situationAt(ctx, operator, st, frame));
    out[t.status] = { extraFrames: t.extraSeconds === undefined ? 0 : Math.round(evaluate(t.extraSeconds, ec) * FPS), capScale: t.capScale === undefined ? 1 : evaluate(t.capScale, ec) };
  }
  return out;
}

/** What a trigger's predicates and values see: its owner's situation, and the context of the operator who caused the event. */
export function triggerSituation(ctx: TimelineContext, owner: string, st: TimelineState, e: BattleEvent, consumed?: number): Situation {
  const cause = ctx.builds.get(e.operator);
  const eventOperator = cause ? evalContext(ctx.data, cause, panelAt(ctx, e.operator, e.frame), "", situationAt(ctx, e.operator, st, e.frame)) : undefined;
  // The Link stacks the event's cast used (a hit's, a status event's, a cast's own); 0 for an event of no cast.
  const cast = e.type === "hit" || e.type === "status" || e.type === "cast" ? e.cast : undefined;
  const castLink = cast !== undefined ? (st.casts[cast]?.link ?? 0) : 0;
  return { ...situationAt(ctx, owner, st, e.frame, consumed), eventCount: eventCountOf(e), castLink, ...(e.type === "buffEnded" ? { eventRemaining: e.remaining / FPS, ...(e.recorded !== undefined ? { eventRecorded: e.recorded } : {}) } : {}), ...(eventOperator ? { eventOperator } : {}) };
}

/** What an event was, for applications that repeat it: an infliction applied, consumed or burst, or a physical status. */
export function eventSourceOf(e: BattleEvent): EventSource | undefined {
  if (e.type !== "status") return undefined;
  const s = e.event;
  if (s.kind === "inflicted" || s.kind === "consumed" || s.kind === "burst") return { kind: "infliction", element: s.element };
  if (s.kind === "reaction" && s.consumed) return { kind: "infliction", element: s.consumed };
  if (s.kind === "physical") return { kind: "physical", status: s.status };
  return undefined;
}

/** An event's count (ValueExpr `eventCount`): stacks inflicted or consumed, a reaction's level, a combo cast's window count, else 1. */
export function eventCountOf(e: BattleEvent): number {
  if (e.type === "cast") return e.count ?? 1;
  if (e.type === "linkGained") return e.count;
  if (e.type !== "status") return 1;
  const s = e.event;
  return s.kind === "inflicted" || s.kind === "consumed" || s.kind === "vulnerable" ? s.stacks : s.kind === "reaction" || s.kind === "statusConsumed" || s.kind === "physical" || s.kind === "shatter" ? s.level : 1;
}
