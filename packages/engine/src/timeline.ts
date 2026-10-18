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
import type { GameData, KitHit, KitSkill, StackGain } from "./model.ts";
import { hitEffects } from "./triggers.ts";
import { computeStats, skillLevel, type StatPanel } from "./stats.ts";
import { applyToEnemy, expireStatus, nextTick, NO_STATUS, statusModifiers, tickStatus, type EnemyStatus, type StatusEvent } from "./status.ts";
import { FPS } from "./units.ts";

/**
 * Team SP. Values from Endaxis's notes on the native skill settings (team SP
 * max 300, start 200, 8 per second, regen paused 1.5 s after spending);
 * Zero Sanity uses a continuous 7.69/s instead. Not yet checked against a
 * fixture.
 */
export const SP = { max: 300, start: 200, perSecond: 8, pauseAfterSpendFrames: 45 } as const;

/** What v1 doesn't model; returned with every result so numbers aren't over-trusted. */
export const TIMELINE_ASSUMPTIONS = [
  "Ultimate energy isn't tracked: an ultimate can be cast whenever the rotation asks for it.",
  "Combo skills ignore their trigger conditions: usable whenever off cooldown.",
  "Each operator has its own animation lock; basic attacks need the operator to be the controlled one, other skills don't.",
  "Projectile hits land at their launch frame (travel time isn't in the data).",
  "SP gain: a skill's blackboard value `atb` (e.g. a final strike's 20) is added when its first hit lands (unverified timing).",
  "Team buffs and debuffs from skills aren't applied yet; only always-on conditions, given modifiers and the enemy's reaction statuses.",
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
  /** Frame until which SP doesn't regenerate. */
  readonly spPausedUntil: number;
  readonly controlled: string;
  /** Per operator: frame from which it can act again. */
  readonly freeAt: Readonly<Record<string, number>>;
  /** Per skill ID: frame from which it's off cooldown. */
  readonly readyAt: Readonly<Record<string, number>>;
  readonly pending: readonly PendingHit[];
  readonly enemy: EnemyStatus;
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
    spPausedUntil: 0,
    controlled,
    freeAt: Object.fromEntries(ctx.scenario.team.map((b) => [b.operator, 0])),
    readyAt: {},
    pending: [],
    enemy: NO_STATUS,
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
  return {
    group,
    spCost: level.costType === 1 ? level.costValue : 0,
    cooldownFrames: Math.round(level.coolDown * FPS),
    lockFrames: timing.cancelFrame ?? timing.exclusiveFrames,
  };
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

function damageOptions(ctx: TimelineContext, operator: string, enemy: EnemyStatus, frame: number) {
  return {
    crit: ctx.scenario.options.crit,
    staggered: false,
    conditions: [],
    modifiers: [...(ctx.modifiers.get(operator) ?? []), ...statusModifiers(enemy, frame)],
  };
}

/** An operator's Arts Intensity: it sets the strength of the statuses it applies. */
function artsIntensity(ctx: TimelineContext, operator: string): number {
  const build = ctx.builds.get(operator) as Build;
  const mods = activeModifiers(ctx.data, build, ctx.panels.get(operator) as StatPanel, { crit: "never", staggered: false, conditions: [], modifiers: ctx.modifiers.get(operator) ?? [] });
  return zoneSum(mods, "artsIntensity", { element: "physical", skillType: null, staggered: false });
}

/** The damage a status event deals, if any (bursts, reactions with an initial hit, Combustion ticks). */
function eventDamage(ctx: TimelineContext, e: StatusEvent, enemy: EnemyStatus): LandedHit | null {
  if (e.kind === "consumed" || (e.kind === "reaction" && !e.initialHit)) return null;
  const reaction =
    e.kind === "burst" ? { kind: "burst" as const, element: e.element, stacks: 1 }
    : e.kind === "reaction" ? { kind: "reaction" as const, element: e.element, stacks: e.level }
    : { kind: "combustionTick" as const, element: "fire" as const, stacks: e.level };
  const build = ctx.builds.get(e.operator) as Build;
  const result = computeReaction(ctx.data, build, ctx.panels.get(e.operator) as StatPanel, ctx.scenario.target, reaction, damageOptions(ctx, e.operator, enemy, e.frame));
  const scale = e.kind === "combustionTick" ? e.damageScale : undefined;
  if (!scale) return { ...result, frame: e.frame, operator: e.operator };
  const exact = result.exact * scale.value;
  return { ...result, scaleParts: [...result.scaleParts, scale], zones: { ...result.zones, scale: result.zones.scale * scale.value }, exact, damage: roundDamage(exact), frame: e.frame, operator: e.operator };
}

type Stacks = TimelineState["stacks"];

function gainStacks(ctx: TimelineContext, stacks: Stacks, owner: string, gains: readonly StackGain[], consumed: number): Stacks {
  let out = stacks;
  for (const g of gains) {
    const def = ctx.data.kits.operators[owner]?.stacks.find((x) => x.id === g.stack);
    if (!def) throw new EngineError(`${owner} has no stack ${g.stack}`);
    const own = out[owner] ?? {};
    const amount = g.amount === "consumedInflictions" ? consumed : g.amount;
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
  const record = (events: readonly StatusEvent[], before: EnemyStatus) => {
    for (const e of events) {
      records.push(e);
      const d = eventDamage(ctx, e, before);
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
    if (hit.sp > 0) st = { ...st, sp: Math.min(SP.max, spAt(st, hit.frame) + hit.sp), frame: hit.frame };
    const build = ctx.builds.get(hit.operator) as Build;
    const skill = kitSkill(ctx, hit.operator, hit.skillId);
    const kitHit = skill.hits.find((h) => h.id === hit.hitId) as KitHit;
    enemy = expireStatus(enemy, hit.frame);
    // What the hit applies comes first: its own damage and a reaction's initial hit already see the new status.
    const events: StatusEvent[] = [];
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
      stacks = gainStacks(ctx, stacks, effect.owner, effect.gains, consumed);
    }
    const result = computeHit(ctx.data, build, ctx.panels.get(hit.operator) as StatPanel, ctx.scenario.target, skill, kitHit, damageOptions(ctx, hit.operator, enemy, hit.frame));
    landed.push({ ...result, count: 1, frame: hit.frame, operator: hit.operator });
    record(events, enemy);
  }
  return {
    ...st,
    sp: spAt(st, frame),
    frame,
    pending: st.pending.filter((h) => h.frame > frame),
    enemy: expireStatus(enemy, frame),
    stacks,
    hits: [...st.hits, ...landed],
    reactions: [...st.reactions, ...records],
  };
}

/** The earliest frame an action could start from the current state, or a reason it can't. */
export function earliestStart(ctx: TimelineContext, state: TimelineState, action: RotationAction): { frame: number } | { error: string } {
  if (!ctx.builds.has(action.operator)) return { error: `${action.operator} isn't in the team` };
  let frame = Math.max(state.frame, action.at ?? 0, state.freeAt[action.operator] ?? 0);
  if (action.skill === "swap") return { frame };
  let costs;
  try {
    kitSkill(ctx, action.operator, action.skill);
    costs = skillCosts(ctx, action.operator, action.skill);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  if (costs.group === "basic" && state.controlled !== action.operator) return { error: `${action.operator} isn't the controlled operator (swap first)` };
  frame = Math.max(frame, state.readyAt[action.skill] ?? 0);
  if (costs.spCost > SP.max) return { error: `${action.skill} costs ${costs.spCost} SP, more than the maximum` };
  // Wait for SP: regen is linear after any pause.
  const spThen = spAt(state, frame);
  if (spThen < costs.spCost) {
    const from = Math.max(frame, state.spPausedUntil);
    frame = from + Math.ceil(((costs.spCost - spAt(state, from)) * FPS) / SP.perSecond);
  }
  if (frame > ctx.scenario.durationFrames) return { error: `${action.skill} can't start before the fight ends` };
  return { frame };
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
  const met = (h: KitHit) => !h.requires || (own[h.requires.stack] ?? 0) >= h.requires.atLeast;
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
  return {
    ...s,
    sp: s.sp - costs.spCost,
    spPausedUntil: costs.spCost > 0 ? start.frame + SP.pauseAfterSpendFrames : s.spPausedUntil,
    freeAt: { ...s.freeAt, [action.operator]: start.frame + costs.lockFrames },
    readyAt: costs.cooldownFrames > 0 ? { ...s.readyAt, [action.skill]: start.frame + costs.cooldownFrames } : s.readyAt,
    pending: [...s.pending, ...pending],
    stacks,
    casts: [...s.casts, { frame: start.frame, operator: action.operator, skill: action.skill, spAfter: s.sp - costs.spCost }],
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
