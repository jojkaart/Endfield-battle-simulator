// The timeline engine, v1: the stepping API of docs/design.md#stepping-api.
// State is plain data; every function returns a new state. Recorded
// rotations and (later) search are drivers on top of init / legalActions /
// apply / advance.
//
// v1 models animation locks and cancel windows (from SkillData), team SP,
// cooldowns, hits landing at their kit frames with the modifiers active at
// that frame, and the enemy's arts state (status.ts): inflictions, bursts,
// reactions and their statuses. What it doesn't model yet is listed in TIMELINE_ASSUMPTIONS
// and returned with every result.

import type { SkillType } from "./attributes.ts";
import type { Build } from "./build.ts";
import {
  activeModifiers,
  computeHit,
  decide,
  evalContext,
  hitAvailable,
  type Situation,
  computeReaction,
  conditionModifiers,
  roundDamage,
  skillValue,
  type CritMode,
  type DamageTarget,
  type HitDamage,
} from "./damage.ts";
import { zoneSum, type Modifier } from "./effects.ts";
import { EngineError } from "./errors.ts";
import type { ComboCondition, GameData, KitHit, KitSkill, StackGain } from "./model.ts";
import { evaluate, test, type EvalContext } from "./expr.ts";
import { hitEffects } from "./triggers.ts";
import { applyBuff, buffModifiers, resolveValue, withBuff, type ActiveBuff } from "./buffs.ts";
import { computeStats, skillLevel, skillParam, type StatPanel } from "./stats.ts";
import { Attr } from "./attributes.ts";
import { applyToEnemy, expireStatus, nextTick, NO_STATUS, statusModifiers, tickStatus, type EnemyStatus, type StatusEvent } from "./status.ts";
import { FPS } from "./units.ts";

/**
 * Team SP. Values from Endaxis's notes on the native skill settings (team SP
 * max 300, start 200, 8 per second, regen paused 1.5 s after spending);
 * Zero Sanity uses a continuous 7.69/s instead. Not yet checked against a
 * fixture.
 */
export const SP = { max: 300, start: 200, perSecond: 8, pauseAfterSpendFrames: 45 } as const;

/**
 * Ultimate energy and combo windows (Endaxis's native skill settings and
 * Zero Sanity agree; docs/data-sources.md): a battle skill gives every team
 * member 0.065 energy per natural (not returned) SP spent; combo windows stay
 * open 6 s after their trigger.
 */
export const ENERGY = { perNaturalSp: 0.065 } as const;
export const COMBO_WINDOW_FRAMES = 6 * FPS;

/** What v1 doesn't model; returned with every result so numbers aren't over-trusted. */
export const TIMELINE_ASSUMPTIONS = [
  "Ultimate energy: max = the ultimate's cost, no passive gain; battle skills give the team 0.065 per natural SP spent (at the cast); kits list their fixed grants. Grants are scaled by Ultimate Gain Efficiency.",
  "Combo skills open a 6 s window on their kit's trigger (ignored while on cooldown); kits without a trigger allow the combo whenever off cooldown.",
  "Each operator has its own animation lock; basic attacks need the operator to be the controlled one, other skills don't. A swap waits for the controlled operator to finish its action and costs no time.",
  "Projectile hits land at their launch frame (travel time isn't in the data).",
  "SP gain: a skill's blackboard value `atb` (e.g. a final strike's 20) is added when its first hit lands (unverified timing).",
  "Buffs and debuffs from skills apply only where a kit declares them (OperatorKit.buffs); always-on conditions, given modifiers and the enemy's reaction statuses apply too.",
  "Inflictions and reactions follow the Talos Wiki rules (status.ts). What a hit applies takes effect before its own damage and the reaction's initial hit (logs: Gilberta's explosion and Arcane's battle skill include the Corrosion they trigger).",
  "Physical statuses (Vulnerable, Lift, Knockdown, Crush, Breach) and Shatter aren't modelled; Solidification only records its duration.",
  "One enemy; every hit lands on it.",
  `Team SP: max ${SP.max}, start ${SP.start}, ${SP.perSecond}/s, paused ${SP.pauseAfterSpendFrames / FPS} s after spending (unverified).`,
] as const;

export interface RotationAction {
  readonly operator: string;
  /** A kit skill ID, e.g. chr_0016_laevat_attack1, or "swap" to make the operator the controlled one. */
  readonly skill: string;
  /** Earliest frame to start (the action may start later if not legal yet). */
  readonly at?: number;
}

export interface TimelineOptions {
  readonly crit: CritMode;
  /** Conditions treated as always on (kit or weapon condition IDs, per operator). */
  readonly conditions?: Readonly<Record<string, readonly string[]>>;
  /** Extra modifiers on every hit (e.g. a fixed external buff). */
  readonly modifiers?: readonly Modifier[];
}

export interface TimelineScenario {
  readonly team: readonly Build[];
  readonly target: DamageTarget;
  readonly durationFrames: number;
  readonly rotation: readonly RotationAction[];
  readonly options: TimelineOptions;
  /** Controlled operator at the start; default the first in the team. */
  readonly controlled?: string;
  /** Ultimate energy at the start, per operator ("full" = the ultimate's cost); default 0. */
  readonly startEnergy?: Readonly<Record<string, number | "full">>;
}

interface PendingHit {
  readonly frame: number;
  readonly operator: string;
  readonly skillId: string;
  readonly hitId: string;
  /** SP this hit returns when it lands (the skill's `atb`, on its first hit). */
  readonly sp: number;
}

export interface Cast {
  readonly frame: number;
  readonly operator: string;
  readonly skill: string;
  readonly spAfter: number;
  /** The caster's ultimate energy after the cast. */
  readonly energyAfter: number;
}

export interface LandedHit extends HitDamage {
  readonly frame: number;
  readonly operator: string;
}

/** A status event with the frame it happened at; the record of what the enemy's arts state did. */
export type ReactionRecord = StatusEvent;

/** The whole simulation state: plain data, cheap to copy for branching. */
export interface TimelineState {
  readonly frame: number;
  readonly sp: number;
  /** The part of `sp` that was returned by skills; it's spent first and gives no ultimate energy. */
  readonly spReturned: number;
  /** Per operator: ultimate energy. */
  readonly energy: Readonly<Record<string, number>>;
  /** Per operator: frame until which it gains no energy (some ultimates block it). */
  readonly energyBlockedUntil: Readonly<Record<string, number>>;
  /** Per operator with a combo trigger: the open combo window, if any. */
  readonly comboWindow: Readonly<Record<string, { readonly from: number; readonly until: number }>>;
  /** Frame until which SP doesn't regenerate. */
  readonly spPausedUntil: number;
  readonly controlled: string;
  /** Per operator: frame from which it can act again. */
  readonly freeAt: Readonly<Record<string, number>>;
  /** Per skill ID: frame from which it's off cooldown. */
  readonly readyAt: Readonly<Record<string, number>>;
  readonly pending: readonly PendingHit[];
  readonly enemy: EnemyStatus;
  /** Timed buffs and debuffs from skills. */
  readonly buffs: readonly ActiveBuff[];
  /** Per operator: its kit's stacks (e.g. Melting Flame). */
  readonly stacks: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly casts: readonly Cast[];
  readonly hits: readonly LandedHit[];
  /** Bursts, reactions, consumptions and Combustion ticks, in order. */
  readonly reactions: readonly ReactionRecord[];
}

/** Precomputed per scenario: the build stage of docs/design.md#simulation-model. */
export interface TimelineContext {
  readonly data: GameData;
  readonly scenario: TimelineScenario;
  readonly builds: ReadonlyMap<string, Build>;
  readonly panels: ReadonlyMap<string, StatPanel>;
  /** Per operator: always-on condition modifiers plus the scenario's extra modifiers (not the panel's own; the damage pipeline adds those). */
  readonly modifiers: ReadonlyMap<string, readonly Modifier[]>;
}

export function createContext(data: GameData, scenario: TimelineScenario): TimelineContext {
  if (scenario.team.length === 0 || scenario.team.length > 4) throw new EngineError("a team has 1–4 operators");
  const builds = new Map(scenario.team.map((b) => [b.operator, b]));
  if (builds.size !== scenario.team.length) throw new EngineError("an operator appears twice in the team");
  const panels = new Map(scenario.team.map((b) => [b.operator, computeStats(data, b)]));
  const modifiers = new Map(
    scenario.team.map((b) => [b.operator, [...conditionModifiers(data, b, scenario.options.conditions?.[b.operator] ?? []), ...(scenario.options.modifiers ?? [])]]),
  );
  return { data, scenario, builds, panels, modifiers };
}

export function init(ctx: TimelineContext): TimelineState {
  const controlled = ctx.scenario.controlled ?? (ctx.scenario.team[0] as Build).operator;
  if (!ctx.builds.has(controlled)) throw new EngineError(`controlled operator ${controlled} isn't in the team`);
  return {
    frame: 0,
    sp: SP.start,
    spReturned: 0,
    energy: Object.fromEntries(ctx.scenario.team.map((b) => {
      const v = ctx.scenario.startEnergy?.[b.operator] ?? 0;
      return [b.operator, v === "full" ? maxEnergy(ctx, b.operator) : Math.min(v, maxEnergy(ctx, b.operator))];
    })),
    energyBlockedUntil: {},
    comboWindow: {},
    spPausedUntil: 0,
    controlled,
    freeAt: Object.fromEntries(ctx.scenario.team.map((b) => [b.operator, 0])),
    readyAt: {},
    pending: [],
    enemy: NO_STATUS,
    buffs: [],
    stacks: Object.fromEntries(ctx.scenario.team.map((b) => [b.operator, Object.fromEntries((ctx.data.kits.operators[b.operator]?.stacks ?? []).map((x) => [x.id, 0]))])),
    casts: [],
    hits: [],
    reactions: [],
  };
}

/** SP at a later frame, with regeneration (whole frames, no fractions lost). */
function spAt(state: TimelineState, frame: number): number {
  const from = Math.max(state.frame, state.spPausedUntil);
  const regen = frame > from ? ((frame - from) * SP.perSecond) / FPS : 0;
  return Math.min(SP.max, state.sp + regen);
}

function kitSkill(ctx: TimelineContext, operator: string, skillId: string): KitSkill {
  const kit = ctx.data.kits.operators[operator];
  if (!kit) throw new EngineError(`no kit for ${operator}`);
  const s = kit.skills.find((x) => x.skillId === skillId);
  if (!s) throw new EngineError(`${operator}'s kit has no skill ${skillId}`);
  return s;
}

function skillGroup(ctx: TimelineContext, operator: string, skillId: string): SkillType {
  const g = ctx.data.operators[operator]?.skillGroups[skillId];
  if (!g) throw new EngineError(`${skillId} isn't one of ${operator}'s skills`);
  return g;
}

/** SP cost, cooldown frames and lock frames of a skill at the operator's level. */
function skillCosts(ctx: TimelineContext, operator: string, skillId: string) {
  const build = ctx.builds.get(operator) as Build;
  const skill = ctx.data.skills[skillId];
  if (!skill) throw new EngineError(`unknown skill ${skillId}`);
  const group = skillGroup(ctx, operator, skillId);
  const level = skillLevel(skill, build.skillLevels[group]);
  const timing = skill.timing;
  if (!timing) throw new EngineError(`${skillId}: SkillData isn't loaded, so its timing is unknown`);
  const panel = ctx.panels.get(operator) as StatPanel;
  const cost = skillParam(panel, skillId, "cost", level.costValue);
  return {
    group,
    /** The action's kind (KitSkill.kind), which basic-attack control and combo windows go by. */
    kind: kitSkill(ctx, operator, skillId).kind,
    spCost: level.costType === 1 ? cost : 0,
    /** costType 0: ultimate energy. */
    energyCost: level.costType === 0 ? cost : 0,
    cooldownFrames: Math.round(skillParam(panel, skillId, "cooldown", level.coolDown) * FPS),
    lockFrames: timing.cancelFrame ?? timing.exclusiveFrames,
  };
}

/** Most ultimate energy an operator can hold: its kit's ultimate cost (the highest, if it has several). */
function maxEnergy(ctx: TimelineContext, operator: string): number {
  const kit = ctx.data.kits.operators[operator];
  const costs = (kit?.skills ?? []).filter((s) => ctx.data.operators[operator]?.skillGroups[s.skillId] === "ultimate").map((s) => skillCosts(ctx, operator, s.skillId).energyCost);
  return costs.length ? Math.max(...costs) : 0;
}

/** Ultimate energy gained, scaled by the recipient's Ultimate Gain Efficiency (attribute 44), unless blocked. */
function gainEnergy(ctx: TimelineContext, st: TimelineState, operator: string, amount: number, frame: number): TimelineState {
  if (amount <= 0 || (st.energyBlockedUntil[operator] ?? -1) > frame) return st;
  const panel = ctx.panels.get(operator) as StatPanel;
  const efficiency = panel.attrs[Attr.UltimateSpGainScalar]?.total ?? ctx.data.attributeDefaults[Attr.UltimateSpGainScalar] ?? 1;
  const now = st.energy[operator] ?? 0;
  return { ...st, energy: { ...st.energy, [operator]: Math.min(maxEnergy(ctx, operator), now + amount * efficiency) } };
}

/** SP a skill returns (its blackboard `atb` at the operator's level, after potentials). */
function skillSpGain(ctx: TimelineContext, operator: string, skillId: string): number {
  const build = ctx.builds.get(operator) as Build;
  const panel = ctx.panels.get(operator) as StatPanel;
  const skill = ctx.data.skills[skillId];
  const level = skill ? skillLevel(skill, build.skillLevels[skillGroup(ctx, operator, skillId)]) : undefined;
  if (level?.blackboard["atb"] === undefined && skill?.defaults["atb"] === undefined) return 0;
  return skillValue(ctx.data, panel, build, skillId, "atb");
}

function damageOptions(ctx: TimelineContext, operator: string, enemy: EnemyStatus, buffs: readonly ActiveBuff[], frame: number) {
  return {
    crit: ctx.scenario.options.crit,
    staggered: false,
    conditions: [],
    modifiers: [...(ctx.modifiers.get(operator) ?? []), ...statusModifiers(enemy, frame), ...buffModifiers(buffs, operator, frame)],
  };
}

/** Everything the timeline knows about a moment, for an operator's kit predicates and values. */
function situationAt(ctx: TimelineContext, operator: string, enemy: EnemyStatus, stacks: Stacks, buffs: readonly ActiveBuff[], frame: number, consumed?: number): Situation {
  return {
    team: ctx.scenario.team,
    enemy: expireStatus(enemy, frame),
    stacks: stacks[operator] ?? {},
    buffActive: (id) => buffs.some((b) => b.id === id && b.owner === operator && b.appliedAt <= frame && b.expiresAt > frame),
    ...(consumed !== undefined ? { consumed } : {}),
  };
}

/** An operator's Arts Intensity: it sets the strength of the statuses it applies. */
function artsIntensity(ctx: TimelineContext, operator: string): number {
  const build = ctx.builds.get(operator) as Build;
  const mods = activeModifiers(ctx.data, build, ctx.panels.get(operator) as StatPanel, { crit: "never", staggered: false, conditions: [], modifiers: ctx.modifiers.get(operator) ?? [] });
  return zoneSum(mods, "artsIntensity", { element: "physical", skillType: null, staggered: false });
}

/** The damage a status event deals, if any (bursts, reactions with an initial hit, Combustion ticks). */
function eventDamage(ctx: TimelineContext, e: StatusEvent, enemy: EnemyStatus, buffs: readonly ActiveBuff[]): LandedHit | null {
  if (e.kind === "consumed" || e.kind === "inflicted" || (e.kind === "reaction" && !e.initialHit)) return null;
  const reaction =
    e.kind === "burst" ? { kind: "burst" as const, element: e.element, stacks: 1 }
    : e.kind === "reaction" ? { kind: "reaction" as const, element: e.element, stacks: e.level }
    : { kind: "combustionTick" as const, element: "fire" as const, stacks: e.level };
  const build = ctx.builds.get(e.operator) as Build;
  const result = computeReaction(ctx.data, build, ctx.panels.get(e.operator) as StatPanel, ctx.scenario.target, reaction, damageOptions(ctx, e.operator, enemy, buffs, e.frame));
  const scale = e.kind === "combustionTick" ? e.damageScale : undefined;
  if (!scale) return { ...result, frame: e.frame, operator: e.operator };
  const exact = result.exact * scale.value;
  return { ...result, scaleParts: [...result.scaleParts, scale], zones: { ...result.zones, scale: result.zones.scale * scale.value }, exact, damage: roundDamage(exact), frame: e.frame, operator: e.operator };
}

type Stacks = TimelineState["stacks"];

function conditionMet(c: ComboCondition, events: readonly StatusEvent[], own: Readonly<Record<string, number>>): boolean {
  const has = <T,>(list: readonly T[] | undefined, x: T) => !list || list.includes(x);
  switch (c.on) {
    case "reaction":
      return events.some((e) => e.kind === "reaction" && has(c.statuses, e.status));
    case "inflictionConsumed":
      // A reaction consumes the infliction it lands on, too.
      return events.some((e) => (e.kind === "consumed" && has(c.elements, e.element)) || (e.kind === "reaction" && e.consumed !== null && has(c.elements, e.consumed)));
    case "inflictionApplied":
      return events.some((e) => e.kind === "inflicted" && has(c.elements, e.element) && e.stacks >= (c.minStacks ?? 1));
    case "burst":
      return events.some((e) => e.kind === "burst" && has(c.elements, e.element));
    case "stackAtLeast":
      return (own[c.stack] ?? 0) >= c.atLeast;
  }
}

/**
 * Opens the combo window of every team member whose trigger the hit's events
 * (or its stacks) satisfy, unless its combo is on cooldown. An operator's own
 * combo hits don't trigger its combo.
 */
function openComboWindows(
  ctx: TimelineContext,
  st: TimelineState,
  events: readonly StatusEvent[],
  enemy: EnemyStatus,
  stacks: Stacks,
  buffs: readonly ActiveBuff[],
  frame: number,
  hitter: string,
  hitGroup: SkillType,
): TimelineState {
  let out = st;
  for (const b of ctx.scenario.team) {
    const m = b.operator;
    const kit = ctx.data.kits.operators[m];
    if (!kit?.comboTriggers || (m === hitter && hitGroup === "combo")) continue;
    const combos = kit.skills.filter((s) => s.kind === "combo");
    if (combos.length > 0 && combos.every((s) => (st.readyAt[s.skillId] ?? 0) > frame)) continue;
    const panel = ctx.panels.get(m) as StatPanel;
    const fires = kit.comboTriggers.some(
      (t) =>
        (!t.if || decide(t.if, evalContext(ctx.data, b, panel, kit.skills[0]?.skillId ?? "", situationAt(ctx, m, enemy, stacks, buffs, frame)))) &&
        t.any.some((c) => conditionMet(c, events, stacks[m] ?? {})),
    );
    if (fires) out = { ...out, comboWindow: { ...out.comboWindow, [m]: { from: frame, until: frame + COMBO_WINDOW_FRAMES } } };
  }
  return out;
}

function gainStacks(ctx: TimelineContext, stacks: Stacks, owner: string, gains: readonly StackGain[], ec: EvalContext): Stacks {
  let out = stacks;
  for (const g of gains) {
    const def = ctx.data.kits.operators[owner]?.stacks.find((x) => x.id === g.stack);
    if (!def) throw new EngineError(`${owner} has no stack ${g.stack}`);
    const own = out[owner] ?? {};
    const amount = evaluate(g.amount, ec);
    out = { ...out, [owner]: { ...own, [g.stack]: Math.min(def.max, (own[g.stack] ?? 0) + amount) } };
  }
  return out;
}

/** Processes every pending hit and status tick up to (and including) a frame, in frame order. */
export function advance(ctx: TimelineContext, state: TimelineState, frame: number): TimelineState {
  if (frame < state.frame) throw new EngineError(`can't go back from frame ${state.frame} to ${frame}`);
  const due = state.pending.filter((h) => h.frame <= frame).sort((a, b) => a.frame - b.frame || (a.operator < b.operator ? -1 : 1));
  const landed: LandedHit[] = [];
  const records: ReactionRecord[] = [];
  let st = state;
  let enemy = state.enemy;
  let stacks = state.stacks;
  let buffs = state.buffs;
  const record = (events: readonly StatusEvent[], before: EnemyStatus) => {
    for (const e of events) {
      if (e.kind === "inflicted") continue;
      records.push(e);
      const d = eventDamage(ctx, e, before, buffs);
      if (d) landed.push(d);
    }
  };
  let i = 0;
  for (;;) {
    const hit = due[i];
    const tick = nextTick(enemy);
    // Ticks of a status already on the enemy come before a hit at the same frame.
    if (tick !== null && tick <= frame && (!hit || tick <= hit.frame)) {
      const t = tickStatus(enemy, tick);
      record(t.events, enemy);
      enemy = t.state;
      continue;
    }
    if (!hit) break;
    i++;
    if (hit.sp > 0) {
      const before = spAt(st, hit.frame);
      const after = Math.min(SP.max, before + hit.sp);
      st = { ...st, sp: after, spReturned: Math.min(after, st.spReturned + (after - before)), frame: hit.frame };
    }
    const build = ctx.builds.get(hit.operator) as Build;
    const skill = kitSkill(ctx, hit.operator, hit.skillId);
    const kitHit = skill.hits.find((h) => h.id === hit.hitId) as KitHit;
    enemy = expireStatus(enemy, hit.frame);
    const panel = ctx.panels.get(hit.operator) as StatPanel;
    // Its situation as it lands, before its own effects: whether it happens (KitHit.if) and its extra scale.
    const before = situationAt(ctx, hit.operator, enemy, stacks, buffs, hit.frame);
    if (kitHit.if && !decide(kitHit.if, evalContext(ctx.data, build, panel, hit.skillId, before))) continue;
    // What the hit applies comes first: its own damage and a reaction's initial hit already see the new status.
    const events: StatusEvent[] = [];
    let consumedByHit = 0;
    for (const effect of hitEffects(ctx.data.kits, ctx.scenario.team.map((b) => b.operator), hit.operator, kitHit)) {
      let consumed = 0;
      const ai = artsIntensity(ctx, hit.operator);
      for (const app of effect.applies) {
        const values = (key: string) => {
          if (!effect.own) throw new EngineError(`${effect.owner}'s team trigger names skill value ${key}; team triggers can't use skill values yet`);
          return skillValue(ctx.data, ctx.panels.get(hit.operator) as StatPanel, build, hit.skillId, key);
        };
        const r = applyToEnemy(enemy, app, hit.frame, hit.operator, ai, values);
        enemy = r.state;
        events.push(...r.events);
        for (const e of r.events) if (e.kind === "consumed") consumed += e.stacks;
      }
      if (effect.own) consumedByHit += consumed;
      const owner = ctx.builds.get(effect.owner) as Build;
      const ownerSituation = situationAt(ctx, effect.owner, enemy, stacks, buffs, hit.frame, consumed);
      stacks = gainStacks(ctx, stacks, effect.owner, effect.gains, evalContext(ctx.data, owner, ctx.panels.get(effect.owner) as StatPanel, hit.skillId, ownerSituation));
    }
    const kitBuff = (id: string) => ctx.data.kits.operators[hit.operator]?.buffs.find((b) => b.id === id);
    const applyBuffs = (before: boolean) => {
      for (const a of kitHit.buffs ?? []) {
        if ((a.beforeDamage ?? false) !== before) continue;
        const def = kitBuff(a.buff);
        if (!def) throw new EngineError(`${hit.operator} has no buff ${a.buff}`);
        buffs = withBuff(buffs, applyBuff(ctx.data, build, panel, hit.skillId, def, hit.frame, situationAt(ctx, hit.operator, enemy, stacks, buffs, hit.frame, consumedByHit)));
      }
    };
    applyBuffs(true);
    const result = computeHit(ctx.data, build, panel, ctx.scenario.target, skill, kitHit, {
      ...damageOptions(ctx, hit.operator, enemy, buffs, hit.frame),
      situation: { ...before, consumed: consumedByHit },
    });
    landed.push({ ...result, count: 1, frame: hit.frame, operator: hit.operator });
    applyBuffs(false);
    if (kitHit.energy) {
      const amount = resolveValue(ctx.data, build, panel, hit.skillId, kitHit.energy, situationAt(ctx, hit.operator, enemy, stacks, buffs, hit.frame, consumedByHit));
      st = gainEnergy(ctx, st, hit.operator, amount, hit.frame);
    }
    st = openComboWindows(ctx, st, events, enemy, stacks, buffs, hit.frame, hit.operator, kitSkill(ctx, hit.operator, hit.skillId).kind);
    record(events, enemy);
  }
  return {
    ...st,
    sp: spAt(st, frame),
    frame,
    pending: st.pending.filter((h) => h.frame > frame),
    enemy: expireStatus(enemy, frame),
    buffs: buffs.filter((b) => b.expiresAt > frame),
    stacks,
    hits: [...st.hits, ...landed],
    reactions: [...st.reactions, ...records],
  };
}

/** The earliest frame an action could start from the current state, or a reason it can't. */
export function earliestStart(ctx: TimelineContext, state: TimelineState, action: RotationAction): { frame: number } | { error: string } {
  if (!ctx.builds.has(action.operator)) return { error: `${action.operator} isn't in the team` };
  let frame = Math.max(state.frame, action.at ?? 0, state.freeAt[action.operator] ?? 0);
  if (action.skill === "swap") {
    if (action.operator === state.controlled) return { error: `${action.operator} is already the controlled operator` };
    // The controlled operator finishes its current action first (no cancelling by swapping, assumed).
    return { frame: Math.max(frame, state.freeAt[state.controlled] ?? 0) };
  }
  let costs;
  try {
    kitSkill(ctx, action.operator, action.skill);
    costs = skillCosts(ctx, action.operator, action.skill);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  if (costs.kind === "basic" && state.controlled !== action.operator) return { error: `${action.operator} isn't the controlled operator (swap first)` };
  frame = Math.max(frame, state.readyAt[action.skill] ?? 0);
  if (costs.spCost > SP.max) return { error: `${action.skill} costs ${costs.spCost} SP, more than the maximum` };
  // Wait for SP: regen is linear after any pause.
  const spThen = spAt(state, frame);
  if (spThen < costs.spCost) {
    const from = Math.max(frame, state.spPausedUntil);
    frame = from + Math.ceil(((costs.spCost - spAt(state, from)) * FPS) / SP.perSecond);
  }
  if (frame > ctx.scenario.durationFrames) return { error: `${action.skill} can't start before the fight ends` };
  // Energy, combo windows and states change only as hits land, so check them as they'll be at the start frame.
  const skill = kitSkill(ctx, action.operator, action.skill);
  if (skill.availableWhile || skill.unavailableWhile) {
    const then = advance(ctx, state, frame);
    const active = (id: string) => then.buffs.some((x) => x.id === id && x.owner === action.operator && x.appliedAt <= frame && x.expiresAt > frame);
    if (skill.availableWhile && !active(skill.availableWhile)) return { error: `${action.skill} needs ${skill.availableWhile} active` };
    if (skill.unavailableWhile && active(skill.unavailableWhile)) return { error: `${action.skill} isn't available during ${skill.unavailableWhile}` };
  }
  if (costs.energyCost > 0 || (costs.kind === "combo" && hasComboTrigger(ctx, action.operator))) {
    const then = advance(ctx, state, frame);
    if (costs.energyCost > 0 && (then.energy[action.operator] ?? 0) < costs.energyCost - 1e-9) {
      return { error: `${action.skill} needs ${costs.energyCost} ultimate energy, ${(then.energy[action.operator] ?? 0).toFixed(1)} at frame ${frame}` };
    }
    if (costs.kind === "combo" && hasComboTrigger(ctx, action.operator)) {
      const w = then.comboWindow[action.operator];
      if (!w || w.until < frame) {
        // Not open yet: wait for a hit already on its way to open it (a recorded rotation's combo follows its trigger).
        const later = [...new Set(state.pending.map((h) => h.frame).filter((f) => f > frame))].sort((a, b) => a - b);
        const opens = later.find((f) => {
          const x = advance(ctx, state, f).comboWindow[action.operator];
          return x !== undefined && x.until >= f;
        });
        if (opens === undefined || opens > ctx.scenario.durationFrames) return { error: `${action.skill}: its combo trigger hasn't happened (no open window at frame ${frame})` };
        frame = opens;
      }
    }
  }
  return { frame };
}

function hasComboTrigger(ctx: TimelineContext, operator: string): boolean {
  const panel = ctx.panels.get(operator) as StatPanel;
  const build = ctx.builds.get(operator) as Build;
  return (ctx.data.kits.operators[operator]?.comboTriggers ?? []).some((t) => !t.if || test(t.if, evalContext(ctx.data, build, panel, "", { team: ctx.scenario.team })) !== false);
}

/** Applies one rotation action at its earliest legal frame. Throws if it can't happen. */
export function apply(ctx: TimelineContext, state: TimelineState, action: RotationAction): TimelineState {
  const start = earliestStart(ctx, state, action);
  if ("error" in start) throw new EngineError(`frame ${state.frame}: ${action.operator} ${action.skill}: ${start.error}`);
  const s = advance(ctx, state, start.frame);
  if (action.skill === "swap") return { ...s, controlled: action.operator };
  const skill = kitSkill(ctx, action.operator, action.skill);
  const costs = skillCosts(ctx, action.operator, action.skill);
  // Hits that need stacks happen only if the stacks are there at the cast; meeting a consuming requirement uses the stack up.
  const own = s.stacks[action.operator] ?? {};
  const panel = ctx.panels.get(action.operator) as StatPanel;
  const castSituation: Situation = { team: ctx.scenario.team, stacks: own, buffActive: (id) => s.buffs.some((b) => b.id === id && b.owner === action.operator && b.appliedAt <= start.frame && b.expiresAt > start.frame) };
  const met = (h: KitHit) => hitAvailable(ctx.data, ctx.builds.get(action.operator) as Build, panel, skill.skillId, h, castSituation) && (!h.requires || (own[h.requires.stack] ?? 0) >= h.requires.atLeast);
  const used = new Set(skill.hits.filter((h) => h.requires?.consume && met(h)).map((h) => h.requires?.stack as string));
  const stacks = used.size ? { ...s.stacks, [action.operator]: { ...own, ...Object.fromEntries([...used].map((id) => [id, 0])) } } : s.stacks;
  const pending: PendingHit[] = [];
  for (const h of skill.hits.filter(met)) {
    const frames = h.frames ?? Array.from({ length: h.count }, () => 0);
    for (const f of frames) pending.push({ frame: start.frame + f, operator: action.operator, skillId: skill.skillId, hitId: h.id, sp: 0 });
  }
  const spGain = skillSpGain(ctx, action.operator, action.skill);
  if (spGain > 0 && pending.length > 0) {
    const first = pending.reduce((a, b) => (b.frame < a.frame ? b : a));
    pending[pending.indexOf(first)] = { ...first, sp: spGain };
  }
  // Returned SP is spent first; only the natural part gives the team ultimate energy.
  const natural = Math.max(0, costs.spCost - s.spReturned);
  let next: TimelineState = { ...s, spReturned: Math.max(0, s.spReturned - costs.spCost) };
  if (natural > 0) for (const b of ctx.scenario.team) next = gainEnergy(ctx, next, b.operator, natural * ENERGY.perNaturalSp, start.frame);
  if (costs.energyCost > 0) next = { ...next, energy: { ...next.energy, [action.operator]: Math.max(0, (next.energy[action.operator] ?? 0) - costs.energyCost) } };
  if (skill.energyBlockSeconds) next = { ...next, energyBlockedUntil: { ...next.energyBlockedUntil, [action.operator]: start.frame + Math.round(skill.energyBlockSeconds * FPS) } };
  if (costs.kind === "combo" && next.comboWindow[action.operator]) {
    const { [action.operator]: _used, ...rest } = next.comboWindow;
    next = { ...next, comboWindow: rest };
  }
  return {
    ...next,
    sp: s.sp - costs.spCost,
    spPausedUntil: costs.spCost > 0 ? start.frame + SP.pauseAfterSpendFrames : s.spPausedUntil,
    freeAt: { ...s.freeAt, [action.operator]: start.frame + costs.lockFrames },
    readyAt: costs.cooldownFrames > 0 ? { ...s.readyAt, [action.skill]: start.frame + costs.cooldownFrames } : s.readyAt,
    pending: [...s.pending, ...pending],
    stacks,
    casts: [...s.casts, { frame: start.frame, operator: action.operator, skill: action.skill, spAfter: s.sp - costs.spCost, energyAfter: next.energy[action.operator] ?? 0 }],
  };
}

export interface TimelineResult {
  readonly total: number;
  /** Total damage per second over the time to the last hit. */
  readonly dps: number;
  readonly lastHitFrame: number;
  readonly perOperator: Readonly<Record<string, number>>;
  readonly casts: readonly Cast[];
  readonly hits: readonly LandedHit[];
  readonly reactions: readonly ReactionRecord[];
  readonly assumptions: readonly string[];
}

/** Runs a recorded rotation: the simplest driver on the stepping API. */
export function simulate(data: GameData, scenario: TimelineScenario): TimelineResult {
  const ctx = createContext(data, scenario);
  let state = init(ctx);
  for (const action of scenario.rotation) state = apply(ctx, state, action);
  state = advance(ctx, state, scenario.durationFrames);
  const perOperator: Record<string, number> = Object.fromEntries(scenario.team.map((b) => [b.operator, 0]));
  let total = 0;
  for (const h of state.hits) {
    perOperator[h.operator] = (perOperator[h.operator] ?? 0) + h.exact;
    total += h.exact;
  }
  const lastHitFrame = state.hits.reduce((m, h) => Math.max(m, h.frame), 0);
  const missingFrames = state.hits.some((h) => {
    const s = data.kits.operators[h.operator]?.skills.find((x) => x.skillId === h.skillId);
    return s !== undefined && !s.hits.find((x) => x.id === h.hitId)?.frames;
  });
  return {
    total,
    dps: lastHitFrame > 0 ? total / (lastHitFrame / FPS) : 0,
    lastHitFrame,
    perOperator,
    casts: state.casts,
    hits: state.hits,
    reactions: state.reactions,
    assumptions: [...TIMELINE_ASSUMPTIONS, ...(missingFrames ? ["Some hits have no frames in their kit and land at the skill's start."] : [])],
  };
}
