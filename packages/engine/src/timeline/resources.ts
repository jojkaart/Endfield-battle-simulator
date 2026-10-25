// Team SP, ultimate energy, cooldowns (and combo cooldown recovery rates), the enemy's stagger.

import { Attr } from "../attributes.ts";
import type { Build } from "../build.ts";
import { skillValue } from "../damage.ts";
import { applies, type HitContext } from "../effects.ts";
import type { KitSkill, SpKind } from "../model.ts";
import type { BattleEvent } from "../events.ts";
import { type EvalContext, test, type ValueExpr, valueKeys } from "../expr.ts";
import { activeAt, type ActiveBuff, type AttrFilters, buffAttr, reaches } from "../buffs.ts";
import { skillLevel } from "../stats.ts";
import { FPS } from "../units.ts";
import type { TimelineContext, TimelineState } from "./state.ts";
import { SP } from "./rules.ts";
import { attrTotal, enemyAttr, maxPoise, panelAt, skillCosts, skillGroup } from "./context.ts";

/** SP at a later frame, with regeneration (whole frames, no fractions lost): from the state's frame, after its pause, outside its stops. */
export function spAt(state: TimelineState, frame: number): number {
  return Math.min(SP.max, state.sp + (regenFrames(state, Math.max(state.frame, state.spPausedUntil), frame) * SP.perSecond) / FPS);
}

/** The frames in [from, to) SP regenerates in: those outside the state's stops (TimelineState.spStops). */
function regenFrames(state: TimelineState, from: number, to: number): number {
  if (to <= from) return 0;
  let n = to - from;
  for (const p of state.spStops) n -= Math.max(0, Math.min(to, p.until) - Math.max(from, p.from));
  return n;
}

/** The frame by which SP has regenerated for `frames` frames from `from` (no earlier than the pause after a spend), skipping the stops. */
export function afterRegen(state: TimelineState, from: number, frames: number): number {
  let f = Math.max(from, state.spPausedUntil);
  let left = frames;
  for (const p of state.spStops) {
    if (p.until <= f) continue;
    if (p.from >= f + left) break;
    left -= Math.max(0, p.from - f);
    f = p.until;
  }
  return f + left;
}

/**
 * A skill's SP cost at a frame: its table cost plus attribute 45
 * (AtbCostAddition, default 0) of the caster's panel and active buffs, at
 * least 0 (Zhuang Fangyi's free battle skill in Empyrean: −100).
 */
export function spCostAt(ctx: TimelineContext, st: TimelineState, operator: string, costs: { readonly paysSp: boolean; readonly spCost: number }, frame: number): number {
  if (!costs.paysSp) return 0;
  const panel = panelAt(ctx, operator, frame);
  const extra = attrTotal(ctx, panel, Attr.AtbCostAddition) + buffAttr(st.buffs, operator, frame, Attr.AtbCostAddition, panel.attrs[Attr.AtbCostAddition]);
  return extra === 0 ? costs.spCost : Math.max(0, costs.spCost + extra);
}

/**
 * An operator's combo cooldown recovery rate at a frame (attribute 93,
 * ComboSkillCooldownRecoveryScalar, default 1, with its buffs): a combo
 * cooldown runs this many frames per frame.
 */
function comboRate(ctx: TimelineContext, buffs: readonly ActiveBuff[], operator: string, frame: number): number {
  const panel = panelAt(ctx, operator, frame);
  const line = panel.attrs[Attr.ComboSkillCooldownRecoveryScalar];
  const base = attrTotal(ctx, panel, Attr.ComboSkillCooldownRecoveryScalar);
  return base + buffAttr(buffs, operator, frame, Attr.ComboSkillCooldownRecoveryScalar, line ?? { base, add: 0, multiply: 1 });
}

/** The combo cooldown rate from a frame on, in constant pieces (by the rate buffs' starts and ends): each piece's first frame and rate. */
function rateSegments(ctx: TimelineContext, buffs: readonly ActiveBuff[], operator: string, from: number): { readonly start: number; readonly rate: number }[] {
  const points = new Set([from]);
  for (const b of buffs) {
    if (!b.attrs?.some((a) => a.attr === Attr.ComboSkillCooldownRecoveryScalar) || !reaches(b, operator)) continue;
    for (const p of [b.appliedAt, b.expiresAt]) if (p > from && Number.isFinite(p)) points.add(p);
  }
  return [...points].sort((a, b) => a - b).map((start) => ({ start, rate: comboRate(ctx, buffs, operator, start) }));
}

/** Cooldown frames (at rate 1) a combo cooldown recovers over [from, to) under some buffs. */
export function rateProgress(ctx: TimelineContext, buffs: readonly ActiveBuff[], operator: string, from: number, to: number): number {
  const segs = rateSegments(ctx, buffs, operator, from);
  let sum = 0;
  segs.forEach((s, i) => {
    const end = Math.min(to, segs[i + 1]?.start ?? Infinity);
    if (end > s.start) sum += Math.max(0, s.rate) * (end - s.start);
  });
  return sum;
}

/**
 * When a combo cooldown with `remaining` frames (at rate 1) left at `from`
 * ends under some buffs (Infinity if it never does): exact, so a later
 * change of rate keeps the progress made (a fraction of a frame included);
 * the skill is ready from the first whole frame at or past it.
 */
export function rateReady(ctx: TimelineContext, buffs: readonly ActiveBuff[], operator: string, from: number, remaining: number): number {
  if (remaining <= 0) return from;
  let left = remaining;
  const segs = rateSegments(ctx, buffs, operator, from);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i] as { start: number; rate: number };
    const len = (segs[i + 1]?.start ?? Infinity) - s.start;
    if (s.rate > 0 && s.rate * len >= left - 1e-9) {
      const end = s.start + left / s.rate;
      return Math.abs(end - Math.round(end)) < 1e-9 ? Math.round(end) : end;
    }
    if (s.rate > 0) left -= s.rate * len;
  }
  return Infinity;
}

/** When a cooldown of `frames` started at `from` ends: then, or for a combo skill at its operator's recovery rate (comboRate) under the buffs as they are. */
export function cooldownEnd(ctx: TimelineContext, buffs: readonly ActiveBuff[], operator: string, skill: KitSkill, from: number, frames: number): number {
  return ctx.comboRates && skill.kind === "combo" ? rateReady(ctx, buffs, operator, from, frames) : from + frames;
}

/**
 * Combo cooldowns when the buffs that set their rate change at a frame
 * (attribute 93): each running one keeps the progress it made and runs the
 * rest at the new rates. The engine calls it wherever buffs change other
 * than by running out (the expiry was already counted).
 */
export function rebaseCooldowns(ctx: TimelineContext, before: TimelineState, after: TimelineState, frame: number): TimelineState {
  if (!ctx.comboRates || before.buffs === after.buffs) return after;
  const sig = (buffs: readonly ActiveBuff[], op: string) => JSON.stringify(buffs.filter((b) => b.attrs?.some((a) => a.attr === Attr.ComboSkillCooldownRecoveryScalar) && reaches(b, op) && b.cast === undefined && !b.consumedBy).map((b) => [b.owner, b.id, b.appliedAt, b.expiresAt, b.attrs]));
  let readyAt = after.readyAt;
  for (const m of ctx.scenario.team) {
    const op = m.operator;
    if (sig(before.buffs, op) === sig(after.buffs, op)) continue;
    for (const s of ctx.kits.get(op)?.skills ?? []) {
      const r = after.readyAt[s.skillId];
      if (s.kind !== "combo" || r === undefined || r <= frame || !Number.isFinite(r)) continue;
      const next = rateReady(ctx, after.buffs, op, frame, rateProgress(ctx, before.buffs, op, frame, r));
      if (next !== r) readyAt = { ...readyAt, [s.skillId]: next };
    }
  }
  return readyAt === after.readyAt ? after : { ...after, readyAt };
}

/** Most ultimate energy an operator can hold: its kit's ultimate cost (the highest, if it has several). */
export function maxEnergy(ctx: TimelineContext, operator: string): number {
  const kit = ctx.kits.get(operator);
  const costs = (kit?.skills ?? []).filter((s) => ctx.data.operators[operator]?.skillGroups[s.skillId] === "ultimate").map((s) => skillCosts(ctx, operator, s.skillId, 0).energyCost); // energy costs don't change with time
  return costs.length ? Math.max(...costs) : 0;
}

/** How an energy grant counts (SkillData ObtainCostAction flags). */
export interface EnergyGrantOptions {
  /** ignoreUspGainScalar: not scaled by Ultimate Gain Efficiency. */
  readonly ignoreEfficiency?: boolean;
  /** useUspRecoverTag: given even while the operator's energy gain is blocked. */
  readonly ignoreBlock?: boolean;
}

export function gainEnergy(ctx: TimelineContext, st: TimelineState, operator: string, amount: number, frame: number, opts: EnergyGrantOptions = {}): TimelineState {
  const blocked = (st.energyBlockedUntil[operator] ?? -1) > frame || st.buffs.some((b) => b.blocksEnergy && b.owner === operator && activeAt(b, frame));
  if (amount <= 0 || (!opts.ignoreBlock && blocked)) return st;
  const panel = panelAt(ctx, operator, frame);
  const efficiency = opts.ignoreEfficiency ? 1 : attrTotal(ctx, panel, Attr.UltimateSpGainScalar) + buffAttr(st.buffs, operator, frame, Attr.UltimateSpGainScalar, panel.attrs[Attr.UltimateSpGainScalar]);
  const now = st.energy[operator] ?? 0;
  return { ...st, energy: { ...st.energy, [operator]: Math.min(maxEnergy(ctx, operator), now + amount * efficiency) } };
}

/** SP for the team: returned SP is spent first and gives no ultimate energy when spent; natural SP does, as regenerated SP. */
export function gainSp(st: TimelineState, amount: number, frame: number, kind: SpKind): TimelineState {
  if (amount <= 0) return st;
  const before = spAt(st, frame);
  const after = Math.min(SP.max, before + amount);
  return { ...st, sp: after, spReturned: Math.min(after, st.spReturned + (kind === "returned" ? after - before : 0)), frame: Math.max(st.frame, frame) };
}

/**
 * What the data says of an SP grant (SkillData atbGainMethod and atbSourceType): the kind and the source type of the
 * first skill key its value reads that has one (talent keys aside: no skill file says); a kind the kit gives wins,
 * and without either the grant is returned SP.
 */
export function spGrantOf(ctx: TimelineContext, skillId: string, value: ValueExpr, given?: SpKind): { kind: SpKind; sourceType?: number } {
  let kind = given;
  let sourceType: number | undefined;
  for (const k of valueKeys(value, skillId, "skipTalents")) {
    const skill = ctx.data.skills[k.skill];
    kind ??= skill?.spKinds[k.key];
    sourceType ??= skill?.spSources[k.key];
  }
  return { kind: kind ?? "returned", ...(sourceType !== undefined ? { sourceType } : {}) };
}

/** SP a skill returns (its blackboard `atb` at the operator's level, after potentials). */
export function skillSpGain(ctx: TimelineContext, operator: string, skillId: string): number {
  const build = ctx.builds.get(operator) as Build;
  const panel = panelAt(ctx, operator, 0); // skill values: a food doesn't change them
  const skill = ctx.data.skills[skillId];
  const level = skill ? skillLevel(skill, build.skillLevels[skillGroup(ctx, operator, skillId)]) : undefined;
  if (level?.blackboard["atb"] === undefined && skill?.defaults["atb"] === undefined) return 0;
  return skillValue(ctx.data, panel, build, skillId, "atb");
}

export const isStaggered = (st: TimelineState, frame: number) => st.stagger.until !== null && st.stagger.until > frame;

/**
 * Stagger damage to the enemy (docs/data-sources.md "Physical state"):
 * value × the attacker's attribute 26 × the enemy's 24. At 0 it's Staggered
 * for attribute 21 × 31 seconds, taking no more stagger, then its stagger
 * HP refills. Attribute 26 is the panel's plus what active buffs give
 * (KitBuffModifier attr 26): for a kit hit's landing (`landing`) those
 * whose filters hold for it (decorations, skill type, kind, element, `if`),
 * otherwise (Lift, Knock Down) only unfiltered ones.
 */
export function dealPoise(ctx: TimelineContext, st: TimelineState, operator: string, value: number, frame: number, landing?: { readonly hit: HitContext; readonly ec: EvalContext; readonly cast?: number }): { state: TimelineState; events: BattleEvent[] } {
  if (value <= 0 || isStaggered(st, frame)) return { state: st, events: [] };
  const panel = panelAt(ctx, operator, frame);
  const accepts = (f: AttrFilters) => {
    if (!landing) return false;
    const { elements, when, ...rest } = f;
    return (!elements || elements.includes(landing.hit.element)) && applies({ zone: "atk", value: 0, source: "", ...rest }, landing.hit) && (!when || (test(when, landing.ec) ?? false));
  };
  const scalar = attrTotal(ctx, panel, Attr.PoiseDamageOutputScalar) +
    buffAttr(st.buffs, operator, frame, Attr.PoiseDamageOutputScalar, undefined, { accepts, ...(landing?.cast !== undefined ? { cast: landing.cast } : {}) });
  const dealt = value * scalar * enemyAttr(ctx, Attr.PoiseDamageTakenScalar);
  // A stagger that has ended refilled the bar.
  const before = st.stagger.until !== null ? maxPoise(ctx) : st.stagger.poise;
  const poise = before - dealt;
  // Stagger Nodes (EnemyData poiseKnotPctList): the bar passing one, from above (once per cycle: the bar only falls until it refills).
  const max = maxPoise(ctx);
  const nodes: BattleEvent[] = ctx.enemy.staggerNodes
    .filter((n) => before > n * max && poise <= n * max)
    .map((node) => ({ type: "staggerNode", frame, operator, node }));
  if (poise > 0) return { state: { ...st, stagger: { poise, until: null, finisherUsed: false } }, events: nodes };
  const until = frame + Math.round(enemyAttr(ctx, Attr.PoiseRecTime) * enemyAttr(ctx, Attr.PoiseRecTimeScalar) * FPS);
  return { state: { ...st, stagger: { poise: 0, until, finisherUsed: false } }, events: [...nodes, { type: "staggered", frame, operator }] };
}

/** Cooldowns after a cast: the skill's own, and every member of its cooldown group on its own cooldown (`buffs`: for a combo's recovery rate). */
export function castCooldowns(ctx: TimelineContext, readyAt: TimelineState["readyAt"], operator: string, skill: KitSkill, cooldownFrames: number, frame: number, buffs: readonly ActiveBuff[]): TimelineState["readyAt"] {
  const out = { ...readyAt };
  if (cooldownFrames > 0) out[skill.skillId] = cooldownEnd(ctx, buffs, operator, skill, frame, cooldownFrames);
  if (skill.cooldownGroup) {
    for (const other of ctx.kits.get(operator)?.skills ?? []) {
      if (other.cooldownGroup !== skill.cooldownGroup || other.skillId === skill.skillId) continue;
      const cd = skillCosts(ctx, operator, other.skillId, frame).cooldownFrames;
      if (cd > 0) out[other.skillId] = Math.max(out[other.skillId] ?? 0, cooldownEnd(ctx, buffs, operator, other, frame, cd));
    }
  }
  return out;
}
