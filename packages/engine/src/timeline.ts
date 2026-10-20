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

import type { Element, SkillType } from "./attributes.ts";
import type { Build } from "./build.ts";
import {
  activeModifiers,
  computeHit,
  fixedHit,
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
import { landingFrames, resolveApplication, type EventSource, type GameData, type KitBuff, type KitHit, type KitSkill, type OperatorKit, type SkillTiming, type SpKind, type StackGain, type StackRequirement } from "./model.ts";
import { effectiveKit } from "./triggers.ts";
import { allActions, causeMatches, eventMatches, triggerActionAt, triggerSkillId, type BattleEvent, type BuffCategory, type KitTrigger } from "./events.ts";
import { evaluate, test, valueKeys, type EvalContext, type Predicate, type ValueExpr } from "./expr.ts";
import { applyBuff, buffAttr, buffModifiers, endBuff, extendBuff, reaches, recordedOf, remainingOf, resolveValue, withBuff, type ActiveBuff } from "./buffs.ts";
import { computeStats, skillLevel, skillParam, type StatPanel } from "./stats.ts";
import { Attr } from "./attributes.ts";
import { applyToEnemy, expireStatus, nextTick, NO_STATUS, statusModifiers, tickStatus, type EnemyStatus, type StatusEvent, type StatusTweaks } from "./status.ts";
import { FPS } from "./units.ts";
import { FINISHER_SP_SOURCE_TYPE } from "./constants.ts";

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
  "When the next action may start comes from SkillData (windows, priorities, exclusive time, cantCastSkill channels); basic attacks need the operator to be the controlled one. A swap costs no time and waits only for a cantSwitchPosition channel. Dive attacks need jumps, which rotations don't have.",
  "Projectile hits land at the frames their kit gives (travel time isn't in the data; kits read it from logs where they can).",
  "SP gain: a skill's blackboard value `atb` (e.g. a final strike's 20) is added when its first hit lands (unverified timing).",
  "Buffs and debuffs from skills apply only where a kit declares them (OperatorKit.buffs); always-on conditions, given modifiers and the enemy's reaction statuses apply too.",
  "Inflictions and reactions follow the Talos Wiki rules (status.ts). What a hit applies takes effect before its own damage and the reaction's initial hit (logs: Gilberta's explosion and Arcane's battle skill include the Corrosion they trigger).",
  "Physical statuses (Vulnerable, Lift, Knock Down, Crush, Breach), Shatter and stagger follow the Talos Wiki tutorial tables (status.ts). Hit-stop and entity-layer slow-downs aren't modelled.",
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
  /** Seed of the battle's random draws (rolled crits, dodges); default 1. The same seed gives the same battle. */
  readonly seed?: number;
  /**
   * Dodging (owner, 2026-10-19): the controlled operator dashes at every
   * enemy attack on it, and the dash is a perfect dodge with this chance
   * (rolled on its own stream; 1: always, as a skilled player; less for a
   * less skilled one). A missed one is an ordinary hit. Absent: no dodges.
   */
  readonly dodge?: { readonly chance: number };
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
  /** Stacks at the start, per operator and stack, overriding the kit's `initial` (e.g. arrows carried over). */
  readonly startStacks?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** What the enemy does (owner, 2026-10-19: the scenario says when it attacks; default nothing). */
  readonly enemyActions?: readonly EnemyActionSpec[];
  /**
   * The enemy's HP over the fight (owner, 2026-10-20: the scenario sets it):
   * from each `from` frame, its fraction of Max HP; full before the first.
   */
  readonly enemyHp?: readonly { readonly from: number; readonly fraction: number }[];
}

/**
 * Enemy actions of one kind: at listed frames, or every `every` frames from
 * `from` (default `every`) to the fight's end. Frames are on the enemy's
 * clock: a time stop or a freeze delays what comes after it.
 */
export interface EnemyActionSpec {
  /** `attack`: it hits `target`; `charge`: it starts charging a skill (Catcher's combo trigger). */
  readonly kind: "attack" | "charge";
  readonly at?: readonly number[];
  readonly every?: number;
  readonly from?: number;
  /** Whom an attack hits: the controlled operator (default), the whole team, or one operator by ID. */
  readonly target?: string;
  /** An attack's damage element (default physical), for "when taking Arts DMG" effects. */
  readonly element?: Element;
}

/** One enemy action still to come. */
export interface EnemyAction {
  readonly frame: number;
  readonly kind: EnemyActionSpec["kind"];
  readonly target: string;
  readonly element: Element;
}

interface PendingHit {
  readonly frame: number;
  readonly operator: string;
  readonly skillId: string;
  readonly hitId: string;
  /** SP this hit gives when it lands (the skill's `atb`, on its first hit), its kind and its atbSourceType. */
  readonly sp: number;
  readonly spKind?: SpKind;
  readonly spSource?: number;
  /** Stacks this landing uses up (StackRequirement.consumeAt "hit"; Infinity: all). */
  readonly usesUp?: readonly { readonly stack: string; readonly amount: number }[];
  /** A combo's hits: the count of the event that opened its window (ValueExpr `eventCount`)… */
  readonly eventCount?: number;
  /** …and what it was (applications with `element: "event"` / `status: "event"`). */
  readonly eventSource?: EventSource;
  /** Lands even if its skill is interrupted (a projectile or entity already on its way: KitHit.detached), from `launchAt` (KitHit.launch) on. */
  readonly detached?: boolean;
  readonly launchAt?: number;
  /** The index of the hit's cast (Cast list), for buffs that cast consumed. */
  readonly cast?: number;
  /** Who was controlled when the hit's skill was cast (predicates on the hit judge `controlled` by it). */
  readonly controlledAtCast?: string;
  /**
   * A triggered hit: the owner's trigger and the index of its `hits` action (`skillId` is then the trigger's value
   * source); inside a `choose`, `nested` goes on from there (triggerActionAt).
   */
  readonly trigger?: { readonly id: string; readonly action: number; readonly nested?: readonly number[] };
  /** Alternatives of one landing (KitHit.branch): the same key for each, judged together when the first lands. */
  readonly branch?: string;
  /** A triggered Fixed DMG hit's value, judged when its trigger fired. */
  readonly fixed?: number;
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
  /** Fixed DMG (KitHit.fixedDamage): recording buffs don't record it. */
  readonly fixed?: true;
}

/** A status event with the frame it happened at; the record of what the enemy's arts state did. */
export type ReactionRecord = StatusEvent;

/** The whole simulation state: plain data, cheap to copy for branching. */
export interface TimelineState {
  readonly frame: number;
  /** The random streams' states, one per source (`crit`…), all from TimelineOptions.seed: a draw advances its own stream only. */
  readonly rng: Readonly<Record<string, number>>;
  readonly sp: number;
  /** The part of `sp` that was returned by skills; it's spent first and gives no ultimate energy. */
  readonly spReturned: number;
  /** Per operator: ultimate energy. */
  readonly energy: Readonly<Record<string, number>>;
  /** Per operator: frame until which it gains no energy (some ultimates block it). */
  readonly energyBlockedUntil: Readonly<Record<string, number>>;
  /** Per operator with a combo trigger: the open combo window, if any. */
  readonly comboWindow: Readonly<Record<string, { readonly from: number; readonly until: number; readonly count: number; readonly source?: EventSource }>>;
  /** Frame until which SP doesn't regenerate. */
  readonly spPausedUntil: number;
  readonly controlled: string;
  /** Per operator: its current (last) action, which gates its next one (actionGate); `skips`: the jumps it took (actionFrame). */
  readonly acting: Readonly<Record<string, Acting>>;
  /**
   * Per operator: the basic-attack chain's next step and when an attack input
   * resolves to it; `alternatives`, other steps by timing in later windows
   * (Fluorite's attack3: attack4 in 18–24, attack4_1 in 24–30).
   */
  readonly chainNext: Readonly<Record<string, ChainStep & { readonly alternatives?: readonly ChainStep[] }>>;
  /** Per skill ID: frame from which it's off cooldown. */
  readonly readyAt: Readonly<Record<string, number>>;
  readonly pending: readonly PendingHit[];
  /** Trigger actions due later (KitTrigger.delay), with the event that started them. */
  /** Delayed trigger actions; `cast`: the cast they belong to (a cast trigger's), dropped when it's cut short. */
  readonly pendingActions: readonly { readonly frame: number; readonly owner: string; readonly trigger: string; readonly event: BattleEvent; readonly origin: Origin | null; readonly cast?: { readonly operator: string; readonly index: number }; readonly awaited?: boolean }[];
  /** Jumps and ends on casts' timelines still to come (SkillTiming.jumps and ends; a conditional jump only if the kit's condition held at the cast). */
  readonly pendingJumps: readonly PendingJump[];
  /** The team's Link stacks (combo casts leave one each, 15 s): their expiry frames. */
  readonly link: readonly number[];
  /** Until when a control status (Si's Immobilization) freezes the enemy's own clock. */
  readonly enemyFrozenUntil: number;
  /** The enemy's actions still to come (TimelineScenario.enemyActions), in frame order, on its clock. */
  readonly enemyActions: readonly EnemyAction[];
  /** The enemy's stagger: its stagger HP left, until when it's Staggered, and whether this stagger's finisher is used. */
  readonly stagger: { readonly poise: number; readonly until: number | null; readonly finisherUsed: boolean };
  /** Global time slow-downs (an ultimate's time stop, a combo's slow-down) still running or to come: per frame from `start`, all but `exempt` (the caster). */
  readonly slowdowns: readonly { readonly start: number; readonly scales: readonly number[]; readonly exempt: string }[];
  /** Ultimate energy given later than the cast (a battle skill's team energy at its data frames, KitSkill.teamEnergy); `if` judged for the caster at the frame. */
  /** Energy grants still to come; `cast`: the cast that grants it (a skill's team energy at its data frame), dropped if it's cut short first. */
  readonly pendingEnergy: readonly { readonly frame: number; readonly operator: string; readonly amount: number; readonly cast?: { readonly operator: string; readonly index: number }; readonly if?: Predicate; readonly detached?: boolean }[];
  readonly enemy: EnemyStatus;
  /** Timed buffs and debuffs from skills. */
  readonly buffs: readonly ActiveBuff[];
  /** Per kit trigger (`operator:triggerId`): when it can fire again and how often it has. */
  readonly triggerState: Readonly<Record<string, { readonly readyAt: number; readonly count: number }>>;
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
  /** Per operator: its kit with what it wears (triggers.ts effectiveKit). */
  readonly kits: ReadonlyMap<string, OperatorKit>;
  /** Whether any kit has a trigger that acts before its hit's damage (KitTrigger.beforeDamage). */
  readonly beforeDamage: boolean;
}

export function createContext(data: GameData, scenario: TimelineScenario): TimelineContext {
  if (scenario.team.length === 0 || scenario.team.length > 4) throw new EngineError("a team has 1–4 operators");
  const builds = new Map(scenario.team.map((b) => [b.operator, b]));
  if (builds.size !== scenario.team.length) throw new EngineError("an operator appears twice in the team");
  const panels = new Map(scenario.team.map((b) => [b.operator, computeStats(data, b)]));
  const modifiers = new Map(
    scenario.team.map((b) => [b.operator, [...conditionModifiers(data, b, scenario.options.conditions?.[b.operator] ?? []), ...(scenario.options.modifiers ?? [])]]),
  );
  const kits = new Map(scenario.team.flatMap((b) => {
    const kit = effectiveKit(data, b);
    return kit ? [[b.operator, kit] as const] : [];
  }));
  const beforeDamage = [...kits.values()].some((k) => k.triggers.some((t) => t.beforeDamage));
  return { data, scenario, builds, panels, modifiers, kits, beforeDamage };
}

export function init(ctx: TimelineContext): TimelineState {
  const st = initialState(ctx);
  return runTriggers(ctx, st, [{ type: "fightStart", frame: 0, operator: st.controlled }], null);
}

function initialState(ctx: TimelineContext): TimelineState {
  const controlled = ctx.scenario.controlled ?? (ctx.scenario.team[0] as Build).operator;
  if (!ctx.builds.has(controlled)) throw new EngineError(`controlled operator ${controlled} isn't in the team`);
  return {
    frame: 0,
    rng: {},
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
    acting: {},
    chainNext: {},
    pendingJumps: [],
    readyAt: {},
    pending: [],
    pendingEnergy: [],
    pendingActions: [],
    slowdowns: [],
    stagger: { poise: maxPoise(ctx), until: null, finisherUsed: false },
    enemyFrozenUntil: 0,
    enemyActions: enemyActionsOf(ctx.scenario),
    link: [],
    enemy: NO_STATUS,
    buffs: [],
    triggerState: {},
    stacks: Object.fromEntries(ctx.scenario.team.map((b) => [b.operator, startStacks(ctx, b)])),
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

/** An operator's stacks at the start: the scenario's, else the kit's `initial` (0 when absent), within each stack's maximum. */
function startStacks(ctx: TimelineContext, b: Build): Record<string, number> {
  const panel = ctx.panels.get(b.operator) as StatPanel;
  const given = ctx.scenario.startStacks?.[b.operator] ?? {};
  const out: Record<string, number> = {};
  for (const x of ctx.kits.get(b.operator)?.stacks ?? []) {
    const v = given[x.id] ?? (x.initial === undefined ? 0 : evaluate(x.initial, evalContext(ctx.data, b, panel, "", { team: ctx.scenario.team })));
    out[x.id] = Math.max(0, Math.min(x.max, v));
  }
  for (const id of Object.keys(given)) if (!(id in out)) throw new EngineError(`startStacks: ${b.operator} has no stack ${id}`);
  return out;
}

function kitSkill(ctx: TimelineContext, operator: string, skillId: string): KitSkill {
  const kit = ctx.kits.get(operator);
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

/** SP cost and cooldown frames of a skill at the operator's level, and its timing. */
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
  const kind = kitSkill(ctx, operator, skillId).kind;
  // Combo cooldowns scale with attribute 47 (ComboSkillCooldownScalar: Frontiers, Qingbo ×0.85).
  const scalar = kind === "combo" ? (panel.attrs[Attr.ComboSkillCooldownScalar]?.total ?? ctx.data.attributeDefaults[Attr.ComboSkillCooldownScalar] ?? 1) : 1;
  return {
    group,
    /** The action's kind (KitSkill.kind), which basic-attack control and combo windows go by. */
    kind,
    spCost: level.costType === 1 ? cost : 0,
    /** costType 0: ultimate energy. */
    energyCost: level.costType === 0 ? cost : 0,
    cooldownFrames: Math.round(skillParam(panel, skillId, "cooldown", level.coolDown) * scalar * FPS),
    timing,
  };
}

/**
 * Who may interrupt whom (Endaxis's native-type priorities, docs/design.md
 * "Skill timing"): a skill of higher priority may start at any frame of the
 * current one; plunging attacks always. By SkillData skillSpecification.
 */
const PRIORITY: Readonly<Record<number, number>> = { 1: 1, 3: 2, 8: 2, 4: 5, 5: 7 };
const priorityOf = (t: SkillTiming) => (t.specification === 6 ? Infinity : (PRIORITY[t.specification] ?? 2));

/** The current action of an operator that perfectly dodged: the perfect-dodge skill (skillSpecification 2). */
export const DODGE = "dodge";

function timingOf(ctx: TimelineContext, skillId: string): SkillTiming {
  if (skillId === DODGE) {
    const n = ctx.data.constants.perfectDodge?.busyFrames ?? 0;
    return { durationFrames: n, exclusiveFrames: n, windows: [], channels: [], specification: 2, keepsChain: true, slowdowns: [], jumps: [], ends: [] };
  }
  const t = ctx.data.skills[skillId]?.timing;
  if (!t) throw new EngineError(`${skillId}: SkillData isn't loaded, so its timing is unknown`);
  return t;
}

/**
 * The earliest frame from `base` at which an operator may start a skill,
 * given its current action: once that's over, inside a window of it that
 * lists the skill, at once if it has no windows or the skill outranks it,
 * else from its exclusive frame. A basic-attack chain step only while the
 * chain points at it; another basic attack not while the chain points
 * elsewhere (the input would resolve to the step).
 */
/** An operator's current action. */
export interface Acting {
  readonly skill: string;
  readonly frame: number;
  readonly speed?: number;
  readonly cast?: number;
  /** Jumps it took: from skill frame `from` to `to`, at real frame `at`, `length` real frames skipped. */
  readonly skips?: readonly { readonly from: number; readonly to: number; readonly at: number; readonly length: number }[];
}

/** A jump (or, with `end`, the action's own end) at a real frame of an operator's cast, in its skill frames. */
interface PendingJump {
  readonly frame: number;
  readonly operator: string;
  readonly cast: number;
  readonly from: number;
  readonly to: number;
  readonly end?: true;
}

/** The real frame of an action's skill frame `x`: from its start at its speed, less what its jumps skipped (a skipped frame is its jump's). */
function actionFrame(cur: Acting, x: number): number {
  let f = cur.frame + (cur.speed ? Math.round(x / cur.speed) : x);
  for (const j of cur.skips ?? []) {
    if (x <= j.from) continue;
    if (x < j.to) return j.at;
    f -= j.length;
  }
  return f;
}

/** A basic-attack chain step and the frames in which an attack input resolves to it. */
export interface ChainStep {
  readonly skill: string;
  readonly from: number;
  readonly until: number;
}

/** The chain's steps for an operator: the next one, then its alternatives. */
function chainSteps(st: TimelineState, operator: string): readonly ChainStep[] {
  const c = st.chainNext[operator];
  return c ? [c, ...(c.alternatives ?? [])] : [];
}

function actionGate(ctx: TimelineContext, st: TimelineState, operator: string, skillId: string, base: number): { frame: number } | { error: string } {
  const next = kitSkill(ctx, operator, skillId);
  const nt = timingOf(ctx, skillId);
  const steps = chainSteps(st, operator);
  let frame = base;
  const cur = st.acting[operator];
  if (cur) {
    const ct = timingOf(ctx, cur.skill);
    const at = (x: number) => actionFrame(cur, x);
    // MarkCanInterrupt: past it (unless a jump skipped it), the cast counts as past its exclusive frame.
    const mark = ct.interruptibleFrom !== undefined && !(cur.skips ?? []).some((k) => (ct.interruptibleFrom as number) > k.from && (ct.interruptibleFrom as number) < k.to) ? ct.interruptibleFrom : undefined;
    const exclusive = mark !== undefined ? Math.min(ct.exclusiveFrames, mark) : ct.exclusiveFrames;
    const options = [Math.max(frame, at(ct.durationFrames)), Math.max(frame, at(exclusive))];
    if (priorityOf(nt) > priorityOf(ct)) options.push(frame);
    for (const w of ct.windows) if (w.skills.includes(skillId) && Math.max(frame, at(w.from)) <= at(w.to)) options.push(Math.max(frame, at(w.from)));
    frame = Math.min(...options);
  }
  if (next.kind === "basic" && nt.specification === 1) {
    if (next.chainStep) {
      const own = steps.filter((c) => c.skill === skillId);
      if (!own.length) return { error: `${skillId} is a basic-attack chain step, and the chain isn't at it` };
      // The first of its windows still open.
      const open = own.find((c) => Math.max(frame, c.from) <= c.until);
      if (!open) return { error: `${skillId}: the chain's window for it closes at frame ${Math.max(...own.map((c) => c.until))}` };
      frame = Math.max(frame, open.from);
    } else {
      // An attack input in one of the chain's windows becomes that window's step.
      const inWindow = steps.find((c) => c.skill !== skillId && c.from <= frame && frame <= c.until);
      if (inWindow) return actionGate(ctx, st, operator, skillId, inWindow.until + 1);
    }
  }
  return { frame };
}

/** The chain's next step after a cast: a basic attack's window that lists a basic attack; kept for a moment by skills that don't interrupt the chain, cleared by others. */
function chainAfter(ctx: TimelineContext, st: TimelineState, operator: string, skill: KitSkill, frame: number, speed = 1): TimelineState["chainNext"] {
  const t = timingOf(ctx, skill.skillId);
  const at = (x: number) => frame + Math.round(x / speed);
  const { [operator]: prev, ...rest } = st.chainNext;
  if (skill.kind === "basic" && t.specification === 1) {
    const kit = ctx.kits.get(operator);
    const steps: ChainStep[] = [];
    for (const w of t.windows) {
      // Only a chain step (attack2…) continues the chain; a window listing the skill itself or another chain head doesn't.
      const step = w.skills.find((id) => kit?.skills.some((s) => s.skillId === id && s.kind === "basic" && s.chainStep));
      if (step) steps.push({ skill: step, from: at(w.from), until: at(w.to) });
    }
    const [first, ...alternatives] = steps;
    return first ? { ...rest, [operator]: { ...first, ...(alternatives.length ? { alternatives } : {}) } } : rest;
  }
  // dontInterruptCombo: the next attack still continues the chain up to 1 s after this skill's exclusive time (Endaxis: OffsetCacheTime).
  // The step that was next is kept (not its alternatives by timing: the timing is gone).
  if (t.keepsChain && prev && prev.until >= frame) return { ...rest, [operator]: { skill: prev.skill, from: frame, until: at(t.exclusiveFrames) + CHAIN_CACHE_FRAMES } };
  return rest;
}

/** The frame by which an operator's current cast has landed its hits, and run its awaited delayed actions, that an interrupt would cancel. */
function ownHitsLanded(st: TimelineState, operator: string): number {
  const cast = st.acting[operator]?.cast ?? st.casts.findLastIndex((c) => c.operator === operator);
  let last = 0;
  // A detached hit is the cast's own until its launch: interrupting before it would cancel it.
  for (const h of st.pending) if (h.operator === operator && h.cast === cast) last = Math.max(last, h.detached ? (h.launchAt ?? 0) : h.frame);
  for (const a of st.pendingActions) if (a.awaited && a.cast && a.cast.operator === operator && a.cast.index === cast && a.frame > last) last = a.frame;
  return last;
}

/**
 * A skill's global slow-downs (docs/design.md "Time"): the world (enemy
 * statuses and timers, every buff, combo windows, SP regen, energy blocks)
 * and every operator but the caster (its hits on the way, its current
 * action) lose the frames the slow-down takes; cooldowns run on. Where
 * slow-downs overlap the lowest scale counts, so each loses only what the
 * new one adds. Modelled as shifting everything after the slow-down's start
 * by the lost frames: exact for a stop, and for a partial slow-down after
 * it ends.
 */
function slowDown(ctx: TimelineContext, st: TimelineState, caster: string, timing: SkillTiming, frame: number): TimelineState {
  let s: TimelineState = { ...st, slowdowns: st.slowdowns.filter((x) => x.start + x.scales.length > frame) };
  for (const d of timing.slowdowns) {
    const start = frame + d.from;
    const scaleAt = (who: string | null, f: number) => {
      let m = 1;
      for (const x of s.slowdowns) if (x.exempt !== who && f >= x.start && f < x.start + x.scales.length) m = Math.min(m, x.scales[f - x.start] as number);
      return m;
    };
    const lost = (who: string | null) => {
      if (who === caster) return 0;
      let sum = 0;
      d.scales.forEach((v, k) => (sum += Math.max(0, scaleAt(who, start + k) - v)));
      return Math.round(sum);
    };
    const world = lost(null);
    const by = new Map(ctx.scenario.team.map((b) => [b.operator, lost(b.operator)]));
    s = { ...shiftWorld(s, start, world), slowdowns: [...s.slowdowns, { start, scales: d.scales, exempt: caster }] };
    for (const [op, n] of by) s = shiftOperator(s, op, start, n);
  }
  return s;
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

/** The enemy's own clock after `start` (its statuses, inflictions, Vulnerable, physical and control statuses, debuffs on it, its stagger, its actions) runs `n` frames later. */
function shiftEnemy(st: TimelineState, start: number, n: number): TimelineState {
  if (n <= 0) return st;
  const later = (f: number) => (f > start ? f + n : f);
  const e = st.enemy;
  return {
    ...st,
    enemy: {
      vulnerable: e.vulnerable ? { ...e.vulnerable, expiresAt: later(e.vulnerable.expiresAt) } : null,
      physical: e.physical.map((x) => ({ ...x, expiresAt: later(x.expiresAt) })),
      controls: e.controls.map((x) => ({ ...x, expiresAt: later(x.expiresAt) })),
      infliction: e.infliction ? { ...e.infliction, expiresAt: later(e.infliction.expiresAt) } : null,
      statuses: e.statuses.map((x) => ({
        ...x,
        expiresAt: later(x.expiresAt),
        ...(x.nextTickAt !== undefined ? { nextTickAt: later(x.nextTickAt) } : {}),
        // Its ramp (Corrosion) doesn't advance while time stands still.
        ...(x.appliedAt <= start && x.expiresAt > start ? { appliedAt: x.appliedAt + n } : {}),
      })),
    },
    buffs: st.buffs.map((b) => (b.target === "enemy" ? shiftBuff(b, start, n) : b)),
    stagger: st.stagger.until !== null ? { ...st.stagger, until: later(st.stagger.until) } : st.stagger,
    enemyActions: st.enemyActions.map((a) => (a.frame > start ? { ...a, frame: a.frame + n } : a)),
  };
}

function shiftBuff(b: ActiveBuff, start: number, n: number): ActiveBuff {
  const later = (f: number) => (f > start ? f + n : f);
  return b.expiresAt > start || (b.nextTick ?? -1) > start ? { ...b, expiresAt: later(b.expiresAt), ...(b.nextTick !== undefined ? { nextTick: later(b.nextTick) } : {}) } : b;
}

/** Everything on the world's clock after `start` happens `n` frames later: the enemy's, every buff, combo windows, energy blocks, SP regen. */
function shiftWorld(st: TimelineState, start: number, n: number): TimelineState {
  if (n <= 0) return st;
  const later = (f: number) => (f > start ? f + n : f);
  const e = shiftEnemy(st, start, n);
  return {
    ...e,
    buffs: e.buffs.map((b) => (b.target === "enemy" ? b : shiftBuff(b, start, n))),
    comboWindow: Object.fromEntries(Object.entries(st.comboWindow).map(([k, w]) => [k, { ...w, until: later(w.until) }])),
    energyBlockedUntil: Object.fromEntries(Object.entries(st.energyBlockedUntil).map(([k, f]) => [k, later(f)])),
    link: st.link.map(later),
    // SP doesn't regenerate meanwhile (taken from the current frame: slow-downs start at their cast or soon after).
    sp: spAt(st, st.frame),
    spPausedUntil: st.spPausedUntil > start ? st.spPausedUntil + n : start + n,
  };
}

/** An operator's own timeline after `start` (its hits on the way, delayed actions, current action) happens `n` frames later. */
function shiftOperator(st: TimelineState, operator: string, start: number, n: number): TimelineState {
  if (n <= 0) return st;
  const later = (f: number) => (f > start ? f + n : f);
  const shift = (c: ChainStep): ChainStep => ({ skill: c.skill, from: later(c.from), until: later(c.until) });
  const cur = st.acting[operator];
  const chain = st.chainNext[operator];
  return {
    ...st,
    pending: st.pending.map((h) => (h.operator === operator && h.frame > start ? { ...h, frame: h.frame + n } : h)),
    pendingActions: st.pendingActions.map((a) => (a.owner === operator && a.frame > start ? { ...a, frame: a.frame + n } : a)),
    pendingJumps: st.pendingJumps.map((j) => (j.operator === operator && j.frame > start ? { ...j, frame: j.frame + n } : j)),
    ...(cur ? { acting: { ...st.acting, [operator]: { ...cur, frame: cur.frame + n, ...(cur.skips ? { skips: cur.skips.map((k) => ({ ...k, at: k.at + n })) } : {}) } } } : {}),
    ...(chain ? { chainNext: { ...st.chainNext, [operator]: { ...shift(chain), ...(chain.alternatives ? { alternatives: chain.alternatives.map(shift) } : {}) } } } : {}),
  };
}

/** An operator's action speed: attribute 92 (KeywordSpeedUpScalar, default 1) plus haste buffs, within 0.1–1.3. */
function actionSpeed(ctx: TimelineContext, st: TimelineState, operator: string, frame: number): number {
  const panel = ctx.panels.get(operator) as StatPanel;
  const base = panel.attrs[Attr.KeywordSpeedUpScalar]?.total ?? ctx.data.attributeDefaults[Attr.KeywordSpeedUpScalar] ?? 1;
  return Math.max(0.1, Math.min(1.3, base + buffAttr(st.buffs, operator, frame, Attr.KeywordSpeedUpScalar)));
}

/** How long a Link stack lasts (buff_common_affixes_combo_trigger duration 15 s). */
const LINK_FRAMES = 15 * FPS;

/** How long a chain survives a skill that doesn't interrupt it, after that skill's exclusive time. */
const CHAIN_CACHE_FRAMES = 30;

/** Most ultimate energy an operator can hold: its kit's ultimate cost (the highest, if it has several). */
function maxEnergy(ctx: TimelineContext, operator: string): number {
  const kit = ctx.kits.get(operator);
  const costs = (kit?.skills ?? []).filter((s) => ctx.data.operators[operator]?.skillGroups[s.skillId] === "ultimate").map((s) => skillCosts(ctx, operator, s.skillId).energyCost);
  return costs.length ? Math.max(...costs) : 0;
}

/** How an energy grant counts (SkillData ObtainCostAction flags). */
export interface EnergyGrantOptions {
  /** ignoreUspGainScalar: not scaled by Ultimate Gain Efficiency. */
  readonly ignoreEfficiency?: boolean;
  /** useUspRecoverTag: given even while the operator's energy gain is blocked. */
  readonly ignoreBlock?: boolean;
}

function gainEnergy(ctx: TimelineContext, st: TimelineState, operator: string, amount: number, frame: number, opts: EnergyGrantOptions = {}): TimelineState {
  const blocked = (st.energyBlockedUntil[operator] ?? -1) > frame || st.buffs.some((b) => b.blocksEnergy && b.owner === operator && b.appliedAt <= frame && b.expiresAt > frame);
  if (amount <= 0 || (!opts.ignoreBlock && blocked)) return st;
  const panel = ctx.panels.get(operator) as StatPanel;
  const efficiency = opts.ignoreEfficiency ? 1 : (panel.attrs[Attr.UltimateSpGainScalar]?.total ?? ctx.data.attributeDefaults[Attr.UltimateSpGainScalar] ?? 1) + buffAttr(st.buffs, operator, frame, Attr.UltimateSpGainScalar);
  const now = st.energy[operator] ?? 0;
  return { ...st, energy: { ...st.energy, [operator]: Math.min(maxEnergy(ctx, operator), now + amount * efficiency) } };
}

/** SP for the team: returned SP is spent first and gives no ultimate energy when spent; natural SP does, as regenerated SP. */
function gainSp(st: TimelineState, amount: number, frame: number, kind: SpKind): TimelineState {
  if (amount <= 0) return st;
  const before = spAt(st, frame);
  const after = Math.min(SP.max, before + amount);
  return { ...st, sp: after, spReturned: Math.min(after, st.spReturned + (kind === "returned" ? after - before : 0)), frame: Math.max(st.frame, frame) };
}

/** A grant's SP kind: the kit's, else what the data says for the first skill key its value reads (talent keys aside), else returned. */
function spKindOf(ctx: TimelineContext, skillId: string, value: ValueExpr, given?: SpKind): SpKind {
  if (given) return given;
  let keys: { skill: string; key: string }[] = [];
  try {
    keys = valueKeys(value, skillId);
  } catch {
    // A talent value: no skill file to say.
  }
  for (const k of keys) {
    const kind = ctx.data.skills[k.skill]?.spKinds[k.key];
    if (kind) return kind;
  }
  return "returned";
}

/** A grant's atbSourceType: what the data says for the first skill key its value reads that has one (talent keys aside), else none. */
function spSourceOf(ctx: TimelineContext, skillId: string, value: ValueExpr): { sourceType?: number } {
  let keys: { skill: string; key: string }[] = [];
  try {
    keys = valueKeys(value, skillId);
  } catch {
    // A talent value: no skill file to say.
  }
  for (const k of keys) {
    const type = ctx.data.skills[k.skill]?.spSources[k.key];
    if (type !== undefined) return { sourceType: type };
  }
  return {};
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

/** `cast`: the hit's cast, for buffs a cast consumed (they act on its hits only). */
function damageOptions(ctx: TimelineContext, st: TimelineState, operator: string, enemy: EnemyStatus, frame: number, cast?: number) {
  const staggered = isStaggered(st, frame);
  return {
    crit: ctx.scenario.options.crit,
    staggered,
    conditions: [],
    // What modifiers that hold only in a situation judge (KitBuffModifier.if); a hit passes its own.
    situation: situationAt(ctx, operator, { ...st, enemy }, frame),
    modifiers: [
      ...(ctx.modifiers.get(operator) ?? []),
      ...statusModifiers(enemy, frame),
      ...buffModifiers(st.buffs, operator, frame, cast),
      // buff_common_poise_break_damage_taken_scale: defender ProdCalcZone ×1.3 while Staggered.
      ...(staggered ? [{ zone: "multiplicative" as const, value: 0.3, source: "Staggered" }] : []),
    ],
  };
}

/** An enemy attribute from its level-independent ones, else the attribute's default. */
function enemyAttr(ctx: TimelineContext, attr: number): number {
  return ctx.data.enemies[ctx.scenario.target.enemy]?.staticAttrs[attr] ?? ctx.data.attributeDefaults[attr] ?? 0;
}

/** The enemy's stagger HP (attribute 20); an enemy without one can't be staggered. */
function maxPoise(ctx: TimelineContext): number {
  const v = enemyAttr(ctx, Attr.MaxPoise);
  return v > 0 ? v : Infinity;
}

const isStaggered = (st: TimelineState, frame: number) => st.stagger.until !== null && st.stagger.until > frame;

/**
 * Stagger damage to the enemy (docs/data-sources.md "Physical state"):
 * value × the attacker's attribute 26 × the enemy's 24. At 0 it's Staggered
 * for attribute 21 × 31 seconds, taking no more stagger, then its stagger
 * HP refills.
 */
function dealPoise(ctx: TimelineContext, st: TimelineState, operator: string, value: number, frame: number): { state: TimelineState; events: BattleEvent[] } {
  if (value <= 0 || isStaggered(st, frame)) return { state: st, events: [] };
  const panel = ctx.panels.get(operator) as StatPanel;
  const dealt = value * (panel.attrs[Attr.PoiseDamageOutputScalar]?.total ?? ctx.data.attributeDefaults[Attr.PoiseDamageOutputScalar] ?? 1) * enemyAttr(ctx, Attr.PoiseDamageTakenScalar);
  // A stagger that has ended refilled the bar.
  const before = st.stagger.until !== null ? maxPoise(ctx) : st.stagger.poise;
  const poise = before - dealt;
  // Stagger Nodes (EnemyData poiseKnotPctList): the bar passing one, from above (once per cycle: the bar only falls until it refills).
  const max = maxPoise(ctx);
  const nodes: BattleEvent[] = (ctx.data.enemies[ctx.scenario.target.enemy]?.staggerNodes ?? [])
    .filter((n) => before > n * max && poise <= n * max)
    .map((node) => ({ type: "staggerNode", frame, operator, node }));
  if (poise > 0) return { state: { ...st, stagger: { poise, until: null, finisherUsed: false } }, events: nodes };
  const until = frame + Math.round(enemyAttr(ctx, Attr.PoiseRecTime) * enemyAttr(ctx, Attr.PoiseRecTimeScalar) * FPS);
  return { state: { ...st, stagger: { poise: 0, until, finisherUsed: false } }, events: [...nodes, { type: "staggered", frame, operator }] };
}

/** What kit predicates and values see for an operator at a frame. */
function situationAt(ctx: TimelineContext, operator: string, st: TimelineState, frame: number, consumed?: number): Situation {
  const active = (b: ActiveBuff) => b.appliedAt <= frame && b.expiresAt > frame;
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
    attrBonus: (attr) => buffAttr(st.buffs, operator, frame, attr),
    enemyGameBuffs: new Set(st.buffs.filter((b) => b.target === "enemy" && b.gameBuff && active(b)).map((b) => b.gameBuff as string)),
    operatorModifiers: st.buffs.filter((b) => b.target !== "enemy" && b.cast === undefined && reaches(b, operator) && active(b)).flatMap((b) => b.modifiers),
    ...(consumed !== undefined ? { consumed } : {}),
  };
}

/** The enemy's HP fraction at a frame (TimelineScenario.enemyHp; 1 before the first entry). */
export function enemyHpAt(scenario: TimelineScenario, frame: number): number {
  let hp = 1;
  for (const e of [...(scenario.enemyHp ?? [])].sort((a, b) => a.from - b.from)) if (e.from <= frame) hp = e.fraction;
  return hp;
}

/** An operator's Arts Intensity at a frame (panel, conditions and active buffs): it sets the strength of the statuses it applies. */
function artsIntensity(ctx: TimelineContext, st: TimelineState, operator: string, frame: number): number {
  const build = ctx.builds.get(operator) as Build;
  const mods = activeModifiers(ctx.data, build, ctx.panels.get(operator) as StatPanel, { crit: "never", staggered: false, conditions: [], modifiers: [...(ctx.modifiers.get(operator) ?? []), ...buffModifiers(st.buffs, operator, frame)] });
  return zoneSum(mods, "artsIntensity", { element: "physical", skillType: null, staggered: false });
}

/** Heal events from a healer: to itself, the controlled operator, the team, or named operators. */
function healEvents(ctx: TimelineContext, st: TimelineState, healer: string, target: "self" | "controlled" | "team" | readonly string[], frame: number, kind: SkillType | "none"): BattleEvent[] {
  const targets = target === "self" ? [healer] : target === "controlled" ? [st.controlled] : target === "team" ? ctx.scenario.team.map((b) => b.operator) : target;
  return targets.map((t) => ({ type: "heal", frame, operator: healer, target: t, kind }));
}

/** What a kit buff is, for triggers on buff categories: by the zones and attributes of its modifiers. */
function buffCategories(def: KitBuff): BuffCategory[] {
  const out = new Set<BuffCategory>();
  for (const m of def.modifiers) {
    if (m.zone === "amp" || m.zone === "susceptibility") out.add(m.zone);
    if (m.attr === Attr.WeaknessDmgScalar) out.add("weakness");
    if (m.attr === Attr.ShelterDmgScalar) out.add("protection");
  }
  return [...out];
}

const buffAppliedEvent = (frame: number, operator: string, def: KitBuff, fromKind: SkillType | "none"): BattleEvent => ({ type: "buffApplied", frame, operator, buff: def.id, categories: buffCategories(def), fromKind, ...(def.gameBuff ? { gameBuff: def.gameBuff } : {}) });

/**
 * Applies one of an owner's kit buffs (values for `skillId`); a filtered
 * team buff reaches the members its `recipients` holds for. Returns the
 * state and whether it was applied (a 0 s buff isn't).
 */
function addBuff(ctx: TimelineContext, st: TimelineState, owner: string, skillId: string, def: KitBuff, frame: number, situation: Situation, only?: readonly string[]): { state: TimelineState; applied: boolean } {
  const build = ctx.builds.get(owner) as Build;
  const panel = ctx.panels.get(owner) as StatPanel;
  let recipients: readonly string[] | undefined = only;
  if (only && def.target !== "team") throw new EngineError(`${owner} buff ${def.id}: only a team buff can go to one operator`);
  if (def.recipients && def.target === "team") {
    const filter = def.recipients;
    recipients = ctx.scenario.team
      .filter((m) => !only || only.includes(m.operator))
      .filter((m) => decide(filter, evalContext(ctx.data, m, ctx.panels.get(m.operator) as StatPanel, skillId, { ...situationAt(ctx, m.operator, st, frame), owner })))
      .map((m) => m.operator);
  }
  let b = applyBuff(ctx.data, build, panel, skillId, def, frame, situation, recipients);
  if (b && def.endsWithCast) {
    // It ends with its owner's current skill: at the skill's end, or earlier if the owner starts another.
    const cur = st.acting[owner];
    const index = st.casts.findLastIndex((c) => c.operator === owner);
    const end = cur ? actionFrame(cur, timingOf(ctx, cur.skill).durationFrames) : -1;
    b = cur && index >= 0 && end > frame ? { ...b, expiresAt: Math.min(b.expiresAt, end), endsWithCast: index } : null;
  }
  return { state: b ? { ...st, buffs: withBuff(st.buffs, b) } : st, applied: b !== null };
}

/** How an operator's kit changes the statuses it applies, resolved at a frame (OperatorKit.statusTweaks). */
function statusTweaks(ctx: TimelineContext, st: TimelineState, operator: string, frame: number): StatusTweaks {
  const tweaks = ctx.kits.get(operator)?.statusTweaks;
  if (!tweaks?.length) return {};
  const build = ctx.builds.get(operator) as Build;
  const panel = ctx.panels.get(operator) as StatPanel;
  const out: Record<string, { extraFrames: number; capScale: number }> = {};
  for (const t of tweaks) {
    const ec = evalContext(ctx.data, build, panel, t.skill ?? "", situationAt(ctx, operator, st, frame));
    out[t.status] = { extraFrames: t.extraSeconds === undefined ? 0 : Math.round(evaluate(t.extraSeconds, ec) * FPS), capScale: t.capScale === undefined ? 1 : evaluate(t.capScale, ec) };
  }
  return out;
}

/** The damage a status event deals, if any (bursts, reactions with an initial hit, Combustion ticks). */
/** Whether a status event deals damage (bursts, reactions with an initial hit, physical statuses, Shatter, Combustion ticks). */
const dealsDamage = (e: StatusEvent): e is Extract<StatusEvent, { kind: "burst" | "reaction" | "physical" | "shatter" | "combustionTick" }> => !(e.kind === "consumed" || e.kind === "inflicted" || e.kind === "statusConsumed" || e.kind === "vulnerable" || e.kind === "control" || (e.kind === "reaction" && !e.initialHit));

function eventDamage(ctx: TimelineContext, e: StatusEvent, enemy: EnemyStatus, st: TimelineState, critRoll?: number): LandedHit | null {
  if (!dealsDamage(e)) return null;
  const reaction =
    e.kind === "burst" ? { kind: "burst" as const, element: e.element, stacks: 1 }
    : e.kind === "reaction" ? { kind: "reaction" as const, element: e.element, stacks: e.level }
    : e.kind === "physical" ? { kind: e.status, element: "physical" as const, stacks: e.level }
    : e.kind === "shatter" ? { kind: "shatter" as const, element: "physical" as const, stacks: e.level }
    : { kind: "combustionTick" as const, element: "fire" as const, stacks: e.level };
  const build = ctx.builds.get(e.operator) as Build;
  const result = computeReaction(ctx.data, build, ctx.panels.get(e.operator) as StatPanel, ctx.scenario.target, reaction, { ...damageOptions(ctx, st, e.operator, enemy, e.frame), ...(critRoll !== undefined ? { critRoll } : {}) });
  const scale = e.kind === "combustionTick" ? e.damageScale : e.kind === "physical" && e.multiplier !== undefined ? { key: "multiplier", value: e.multiplier } : undefined;
  if (!scale) return { ...result, frame: e.frame, operator: e.operator };
  const exact = result.exact * scale.value;
  return { ...result, scaleParts: [...result.scaleParts, scale], zones: { ...result.zones, scale: result.zones.scale * scale.value }, exact, damage: roundDamage(exact), frame: e.frame, operator: e.operator };
}

type Stacks = TimelineState["stacks"];

/** The stacks whose count differs between two snapshots of an operator's stacks. */
function changedStacks(was: Readonly<Record<string, number>>, now: Readonly<Record<string, number>>): string[] {
  return [...new Set([...Object.keys(was), ...Object.keys(now)])].filter((k) => (was[k] ?? 0) !== (now[k] ?? 0));
}

function gainStacks(ctx: TimelineContext, stacks: Stacks, owner: string, gains: readonly StackGain[], ec: EvalContext): Stacks {
  let out = stacks;
  for (const g of gains) {
    if (g.if && !decide(g.if, ec)) continue;
    const def = ctx.kits.get(owner)?.stacks.find((x) => x.id === g.stack);
    if (!def) throw new EngineError(`${owner} has no stack ${g.stack}`);
    const own = out[owner] ?? {};
    const amount = evaluate(g.amount, ec);
    // Negative gains use stacks up, down to 0.
    out = { ...out, [owner]: { ...own, [g.stack]: Math.max(0, Math.min(def.max, (own[g.stack] ?? 0) + amount)) } };
  }
  return out;
}

/** Landed hits, and what the recording buffs active at their frames record of them (KitBuff.records; not Fixed DMG). */
function addHits(st: TimelineState, landed: readonly LandedHit[]): TimelineState {
  if (landed.length === 0) return st;
  const buffs = st.buffs.some((b) => b.records)
    ? st.buffs.map((b) => {
        if (!b.records) return b;
        let total = b.records.total;
        for (const h of landed) if (!h.fixed && b.appliedAt <= h.frame && h.frame < b.expiresAt) total += b.records.rate * h.exact;
        return total === b.records.total ? b : { ...b, records: { ...b.records, total } };
      })
    : st.buffs;
  return { ...st, buffs, hits: [...st.hits, ...landed] };
}

/** Status events: recorded, and the damage they deal (bursts, reactions, ticks) lands. */
/** `enemy` is the state their damage sees: after a hit's own applications, before a tick's change. */
function recordStatus(ctx: TimelineContext, st: TimelineState, events: readonly StatusEvent[], enemy: EnemyStatus): TimelineState {
  const records: ReactionRecord[] = [];
  const landed: LandedHit[] = [];
  let next = st;
  for (const e of events) {
    if (e.kind === "inflicted") continue;
    records.push(e);
    // Every damaging event draws its crit roll (a tick that can't crit too: the stream doesn't depend on what crits).
    let roll: number | undefined;
    if (ctx.scenario.options.crit === "rolled" && dealsDamage(e)) ({ value: roll, state: next } = draw(ctx, next, "crit"));
    const d = eventDamage(ctx, e, enemy, st, roll);
    if (d) landed.push(d);
  }
  return records.length ? addHits({ ...next, reactions: [...next.reactions, ...records] }, landed) : st;
}

/** The next draw of the battle's random stream (mulberry32): a uniform value in [0, 1) and the stream's new state. */
export function nextRandom(seed: number): { readonly value: number; readonly seed: number } {
  const s = (seed + 0x6d2b79f5) >>> 0;
  let t = Math.imul(s ^ (s >>> 15), s | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: s };
}

/** A draw from one of the battle's random streams; each starts from the scenario's seed mixed with the stream's name. */
function draw(ctx: TimelineContext, st: TimelineState, stream: string): { value: number; state: TimelineState } {
  let start = st.rng[stream];
  if (start === undefined) {
    // FNV-1a of the name, mixed into the seed.
    let h = 0x811c9dc5;
    for (const c of stream) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
    start = ((ctx.scenario.options.seed ?? 1) ^ h) >>> 0;
  }
  const r = nextRandom(start);
  return { value: r.value, state: { ...st, rng: { ...st.rng, [stream]: r.seed } } };
}

/** Status events as battle events, with the kind of the hit that caused them (and its cast). */
const asEvents = (events: readonly StatusEvent[], fromKind: SkillType | "none", cast?: number): BattleEvent[] =>
  events.map((e) => ({ type: "status", frame: e.frame, operator: e.operator, event: e, fromKind, ...(cast !== undefined ? { cast } : {}) }));

/** What started a chain of events: an operator's own combo hits don't open its own combo window. */
interface Origin {
  readonly operator: string;
  readonly kind: SkillType | "none";
}

/** At most this many events in one chain of triggers (a loop in kit data is an error, not a hang). */
const MAX_CHAIN = 500;

/** What a trigger's predicates and values see: its owner's situation, and the context of the operator who caused the event. */
function triggerSituation(ctx: TimelineContext, owner: string, st: TimelineState, e: BattleEvent, consumed?: number): Situation {
  const cause = ctx.builds.get(e.operator);
  const eventOperator = cause ? evalContext(ctx.data, cause, ctx.panels.get(e.operator) as StatPanel, "", situationAt(ctx, e.operator, st, e.frame)) : undefined;
  return { ...situationAt(ctx, owner, st, e.frame, consumed), eventCount: eventCountOf(e), ...(e.type === "buffEnded" ? { eventRemaining: e.remaining / FPS, ...(e.recorded !== undefined ? { eventRecorded: e.recorded } : {}) } : {}), ...(eventOperator ? { eventOperator } : {}) };
}

/** What an event was, for applications that repeat it: an infliction applied, consumed or burst, or a physical status. */
function eventSourceOf(e: BattleEvent): EventSource | undefined {
  if (e.type !== "status") return undefined;
  const s = e.event;
  if (s.kind === "inflicted" || s.kind === "consumed" || s.kind === "burst") return { kind: "infliction", element: s.element };
  if (s.kind === "reaction" && s.consumed) return { kind: "infliction", element: s.consumed };
  if (s.kind === "physical") return { kind: "physical", status: s.status };
  return undefined;
}

/** An event's count (ValueExpr `eventCount`): stacks inflicted or consumed, a reaction's level, a combo cast's window count, else 1. */
function eventCountOf(e: BattleEvent): number {
  if (e.type === "cast") return e.count ?? 1;
  if (e.type !== "status") return 1;
  const s = e.event;
  return s.kind === "inflicted" || s.kind === "consumed" || s.kind === "vulnerable" ? s.stacks : s.kind === "reaction" || s.kind === "statusConsumed" || s.kind === "physical" || s.kind === "shatter" ? s.level : 1;
}

/**
 * Runs every team member's triggers on a chain of events, in order; what
 * they do can add events to the chain. `only` limits which triggers the
 * initial events run (a hit's own status events: KitTrigger.beforeDamage);
 * `reactOnInitial: false` leaves the engine's own reactions to them
 * (freezes, Lift stagger) to a later run.
 */
function runTriggers(ctx: TimelineContext, state: TimelineState, initial: readonly BattleEvent[], origin: Origin | null, only?: (t: KitTrigger) => boolean, reactOnInitial = true): TimelineState {
  let st = state;
  const queue = [...initial];
  const first = new Set(initial);
  for (let n = 0; queue.length > 0; n++) {
    if (n > MAX_CHAIN) throw new EngineError(`more than ${MAX_CHAIN} chained events at frame ${queue[0]?.frame}: a trigger loop in the kits?`);
    const e = queue.shift() as BattleEvent;
    // The engine's own reactions to an event (freezes, Lift stagger) happen once: for a hit's own status events
    // after its damage, not in the before-damage run, so buffs the hit applies are frozen with the enemy too.
    const engine = reactOnInitial || !first.has(e);
    // A control status that freezes the enemy stops its clock (overlapping freezes count once).
    if (engine && e.type === "status" && e.event.kind === "control" && e.event.freezes && !ctx.scenario.target.controlImmune) {
      const end = e.frame + e.event.frames;
      const lost = Math.max(0, end - Math.max(e.frame, st.enemyFrozenUntil));
      st = { ...shiftEnemy(st, e.frame, lost), enemyFrozenUntil: Math.max(st.enemyFrozenUntil, end) };
    }
    // Lift and Knock Down stagger: 10 × (1 + AI/200) of the applier.
    if (engine && e.type === "status" && e.event.kind === "physical" && (e.event.status === "lift" || e.event.status === "knockdown") && ctx.builds.has(e.operator)) {
      const r = dealPoise(ctx, st, e.operator, 10 * (1 + artsIntensity(ctx, st, e.operator, e.frame) / 200), e.frame);
      st = r.state;
      queue.push(...r.events);
    }
    // Every trigger on this event judges its condition on the situation at the event, before any of them acts
    // (the game raises the event for all its listeners at once: an equipment set still sees what its owner's trigger consumes).
    const atEvent = st;
    for (const b of ctx.scenario.team) {
      const owner = b.operator;
      for (const t of ctx.kits.get(owner)?.triggers ?? []) {
        if (only && first.has(e) && !only(t)) continue;
        if (!eventMatches(t.on, e, owner, st.stacks[owner] ?? {}) || !causeMatches(t.by, e, owner, t.on)) continue;
        const subject = e.type === "heal" ? e.target : e.operator;
        const key = t.cooldownPer === "eventSubject" ? `${owner}:${t.id}:${subject}` : `${owner}:${t.id}`;
        const ts = st.triggerState[key];
        if (ts && ((ts.readyAt ?? 0) > e.frame || (t.maxCount !== undefined && ts.count >= t.maxCount))) continue;
        // Per cast: counted for the cast whose hit caused the event.
        const cast = e.type === "hit" || e.type === "status" ? e.cast : undefined;
        const castKey = t.maxPerCast !== undefined && cast !== undefined ? `${owner}:${t.id}@${cast}` : undefined;
        if (castKey && (st.triggerState[castKey]?.count ?? 0) >= (t.maxPerCast as number)) continue;
        const panel = ctx.panels.get(owner) as StatPanel;
        const ec = evalContext(ctx.data, b, panel, triggerSkillId(owner, t), triggerSituation(ctx, owner, atEvent, e));
        if (t.if && !decide(t.if, ec)) continue;
        if (t.chance !== undefined) {
          const roll = draw(ctx, st, "chance");
          st = roll.state;
          if (roll.value >= evaluate(t.chance, ec)) continue;
        }
        const cooldown = t.cooldown === undefined ? 0 : Math.round(evaluate(t.cooldown, ec) * FPS);
        st = { ...st, triggerState: { ...st.triggerState, [key]: { readyAt: e.frame + cooldown, count: (ts?.count ?? 0) + 1 } } };
        if (castKey) st = { ...st, triggerState: { ...st.triggerState, [castKey]: { readyAt: 0, count: (st.triggerState[castKey]?.count ?? 0) + 1 } } };
        if (t.delay) {
          const cast = e.type === "cast" && e.cast !== undefined && !t.detached ? { cast: { operator: e.operator, index: e.cast } } : {};
          // A cast's own effects at frames play at its speed, as its hits do (Haste).
          const acting = e.type === "cast" ? st.acting[e.operator] : undefined;
          const delay = acting && acting.frame === e.frame && acting.speed ? Math.round(t.delay / acting.speed) : t.delay;
          st = { ...st, pendingActions: [...st.pendingActions, { frame: e.frame + delay, owner, trigger: t.id, event: e, origin, ...cast, ...(t.awaited ? { awaited: true } : {}) }] };
          continue;
        }
        const r = runActions(ctx, st, t, owner, e, origin, atEvent);
        st = r.state;
        queue.push(...r.events);
      }
    }
  }
  return st;
}

/** Does what a trigger says, as its owner, at the event's frame. Returns the events it caused. */
/**
 * A trigger's actions, in order. `atEvent`: the state at its event, before
 * any trigger on it acted: a buff takes its values from it, as the
 * trigger's `if` does (Grizzled Edge sees the crystals its owner's Crush
 * consumes); delayed actions read the state when they run.
 */
function runActions(ctx: TimelineContext, state: TimelineState, t: KitTrigger, owner: string, e: BattleEvent, origin: Origin | null, atEvent?: TimelineState): { state: TimelineState; events: BattleEvent[] } {
  let st = state;
  const events: BattleEvent[] = [];
  const frame = e.frame;
  const build = ctx.builds.get(owner) as Build;
  const panel = ctx.panels.get(owner) as StatPanel;
  let consumed = 0;
  const ec = () => evalContext(ctx.data, build, panel, triggerSkillId(owner, t), triggerSituation(ctx, owner, st, e, consumed));
  // Each action with its place in the trigger (triggerActionAt): a chosen option's actions run next, in place.
  const work = t.do.map((a, i) => ({ a, place: [i] }));
  for (let next = work.shift(); next; next = work.shift()) {
    const { a, place } = next;
    if (a.if && !decide(a.if, ec())) continue;
    switch (a.kind) {
      case "openCombo": {
        if (origin && origin.operator === owner && origin.kind === "combo") break;
        const combos = (ctx.kits.get(owner)?.skills ?? []).filter((s) => s.kind === "combo");
        if (combos.length > 0 && combos.every((s) => (st.readyAt[s.skillId] ?? 0) > frame)) break;
        // The window keeps the largest count of the events that opened it (Si's finisher reads it).
        const open = st.comboWindow[owner];
        const count = Math.max(eventCountOf(e), open && open.until >= frame ? open.count : 0);
        // …and what the latest event that opened or refreshed it was (Antal's combo repeats it: assumed, the data overwrites it).
        const source = eventSourceOf(e) ?? (open && open.until >= frame ? open.source : undefined);
        st = { ...st, comboWindow: { ...st.comboWindow, [owner]: { from: frame, until: frame + COMBO_WINDOW_FRAMES, count, ...(source ? { source } : {}) } } };
        break;
      }
      case "apply": {
        const ai = artsIntensity(ctx, st, owner, frame);
        for (const app of a.applies) {
          if (app.if && !decide(app.if, ec())) continue;
          const resolved = resolveApplication(app, (v) => evaluate(v, ec()), eventSourceOf(e));
          if (!resolved) continue;
          const r = applyToEnemy(expireStatus(st.enemy, frame), resolved, frame, owner, ai, (key) => skillValue(ctx.data, panel, build, triggerSkillId(owner, t), key), statusTweaks(ctx, st, owner, frame));
          st = recordStatus(ctx, { ...st, enemy: r.state }, r.events, r.state);
          for (const x of r.events) if (x.kind === "consumed") consumed += x.stacks;
          events.push(...asEvents(r.events, origin && origin.operator === owner ? origin.kind : "none"));
        }
        break;
      }
      case "gain":
      {
        const was = st.stacks[owner] ?? {};
        st = { ...st, stacks: gainStacks(ctx, st.stacks, owner, a.gains, ec()) };
        events.push({ type: "stacks", frame, operator: owner, changed: changedStacks(was, st.stacks[owner] ?? {}) });
      }
        break;
      case "energy": {
        const v = evaluate(a.value, ec());
        st = gainEnergy(ctx, st, owner, a.percentOfMax ? v * maxEnergy(ctx, owner) : v, frame, a);
        break;
      }
      case "clearEnergy":
        st = { ...st, energy: { ...st.energy, [owner]: 0 } };
        break;
      case "sp":
        {
          const amount = evaluate(a.value, ec());
          const spKind = spKindOf(ctx, triggerSkillId(owner, t), a.value, a.spKind);
          st = gainSp(st, amount, frame, spKind);
          if (amount > 0) events.push({ type: "sp", frame, operator: owner, amount, kind: origin && origin.operator === owner ? origin.kind : "none", natural: spKind === "natural", ...spSourceOf(ctx, triggerSkillId(owner, t), a.value) });
        }
        break;
      case "buff": {
        const def = ctx.kits.get(owner)?.buffs.find((x) => x.id === a.buff);
        if (!def) throw new EngineError(`${owner} has no buff ${a.buff}`);
        const subject = a.to === "eventSubject" ? [e.type === "heal" ? e.target : e.operator] : undefined;
        const layers = a.layers === undefined ? 1 : Math.max(0, Math.round(evaluate(a.layers, ec())));
        let applied = false;
        for (let i = 0; i < layers; i++) {
          const r = addBuff(ctx, st, owner, triggerSkillId(owner, t), def, frame, triggerSituation(ctx, owner, atEvent ?? st, e, consumed), subject);
          st = r.state;
          applied ||= r.applied;
        }
        if (applied) events.push(buffAppliedEvent(frame, owner, def, origin && origin.operator === owner ? origin.kind : "none"));
        break;
      }
      case "extendBuff": {
        const buffs = extendBuff(st.buffs, a.buff, owner, frame, Math.round(evaluate(a.seconds, ec()) * FPS));
        if (buffs) st = { ...st, buffs };
        break;
      }
      case "heal":
        events.push(...healEvents(ctx, st, owner, a.target === "eventOperator" ? [e.operator] : a.target, frame, a.healKind ?? "none"));
        break;
      case "endBuff": {
        const r = endBuff(st.buffs, a.buff, owner, frame, a.layers);
        if (r.ended) {
          st = { ...st, buffs: r.buffs };
          const gameBuff = ctx.kits.get(owner)?.buffs.find((x) => x.id === a.buff)?.gameBuff;
          events.push({ type: "buffEnded", frame, operator: owner, buff: a.buff, remaining: r.remaining, ...(r.recorded !== undefined ? { recorded: r.recorded } : {}), consumed: true, ...(gameBuff ? { gameBuff } : {}) });
        }
        break;
      }
      case "endAction": {
        const r = endCurrentSkill(st, owner, frame);
        st = { ...r.state, acting: Object.fromEntries(Object.entries(r.state.acting).filter(([k]) => k !== owner)) };
        events.push(...r.events);
        break;
      }
      case "jump": {
        const cur = st.acting[owner];
        if (!cur || cur.skill !== a.skill || cur.cast === undefined) break;
        // The playhead: real frames since the start, plus what jumps skipped, in skill frames.
        const playhead = playheadOf(cur, frame);
        if (playhead < a.from || playhead >= a.until || a.to <= playhead) break;
        const r = takeJump(st, { frame, operator: owner, cast: cur.cast, from: playhead, to: a.to });
        st = r.state;
        events.push(...r.events);
        break;
      }
      case "cancelHits":
        st = { ...st, pending: st.pending.filter((h) => !(h.operator === owner && h.trigger?.id === a.trigger)) };
        break;
      case "cooldown": {
        const who = a.who === "self" ? owner : a.who === "eventOperator" ? e.operator : ctx.scenario.team[a.who.slot]?.operator;
        if (!who) break;
        const v = evaluate("seconds" in a ? a.seconds : "fraction" in a ? a.fraction : a.set, ec());
        const readyAt = { ...st.readyAt };
        for (const s of ctx.kits.get(who)?.skills ?? []) {
          if (s.kind !== a.skills) continue;
          // Setting starts a cooldown whether one runs or not; changes apply only to a running one.
          if ("set" in a) {
            readyAt[s.skillId] = frame + Math.round(v * FPS);
            continue;
          }
          if ((readyAt[s.skillId] ?? 0) <= frame) continue;
          // A fraction is of the skill's full cooldown (assumed; in-game test 36).
          const change = Math.round("seconds" in a ? v * FPS : v * skillCosts(ctx, who, s.skillId).cooldownFrames);
          readyAt[s.skillId] = Math.max(frame, (readyAt[s.skillId] ?? 0) + change);
        }
        st = { ...st, readyAt };
        break;
      }
      case "cast": {
        // A follow-up the owner casts by itself (CastSkill): no control, cost or cooldown; it ends the owner's current skill.
        const r = castSkill(ctx, st, owner, a.skill, frame, true);
        st = r.state;
        events.push(...r.events);
        break;
      }
      case "hits": {
        const [index, ...nested] = place as [number, ...number[]];
        const pending: PendingHit[] = [];
        // `now`: its frame-0 hits land as the action runs, before the trigger's next action (a DamageAction inside an event handler).
        const landNow: PendingHit[] = [];
        for (const h of a.hits) {
          // A count that's a value is judged as the action runs.
          (typeof h.count === "number" ? (h.frames ?? Array.from({ length: h.count }, () => 0)) : landingFrames(h, evaluate(h.count, ec()))).forEach((f, i) => {
            const p: PendingHit = {
              frame: frame + f, operator: owner, skillId: triggerSkillId(owner, t), hitId: h.id, sp: 0, trigger: { id: t.id, action: index, ...(nested.length ? { nested } : {}) },
              ...(h.branch ? { branch: `${owner}:${t.id}:${frame}:${h.branch}:${i}` } : {}), ...(h.fixedDamage !== undefined ? { fixed: evaluate(h.fixedDamage, ec()) } : {}),
            };
            (a.now && f === 0 ? landNow : pending).push(p);
          });
        }
        st = { ...st, pending: [...st.pending, ...pending] };
        for (const p of landNow) st = landHit(ctx, st, p);
        break;
      }
      case "choose": {
        // One roll whatever the weights, so the stream doesn't depend on them.
        const weights = a.options.map((o) => evaluate(o.weight, ec()));
        if (weights.some((w) => !(w >= 0))) throw new EngineError(`${owner} trigger ${t.id}: choose weights must be ≥ 0 (${weights.join(", ")})`);
        const roll = draw(ctx, st, "chance");
        st = roll.state;
        const total = weights.reduce((x, w) => x + w, 0);
        if (total === 0) break;
        // Option i covers [Σ_{<i} w, Σ_{≤i} w) of the roll × Σ w (rounding past the end: the last positive one).
        const r = roll.value * total;
        let chosen = -1;
        for (let i = 0, sum = 0; i < weights.length; i++) {
          const w = weights[i] as number;
          if (w === 0) continue;
          chosen = i;
          sum += w;
          if (r < sum) break;
        }
        work.unshift(...(a.options[chosen]?.do ?? []).map((x, j) => ({ a: x, place: [...place, chosen, j] })));
        break;
      }
    }
  }
  return { state: st, events };
}

/** The earliest periodic tick of an active buff at or before `frame` (one that ends at that frame doesn't tick). */
function nextBuffTick(buffs: readonly ActiveBuff[], frame: number): { b: ActiveBuff; frame: number } | null {
  let next: { b: ActiveBuff; frame: number } | null = null;
  for (const b of buffs) {
    const t = b.nextTick;
    if (t !== undefined && t <= frame && t < b.expiresAt && (next === null || t < next.frame)) next = { b, frame: t };
  }
  return next;
}

/** Earliest frame at or before `frame` when an active buff ends, or null. */
function nextExpiry(buffs: readonly ActiveBuff[], frame: number): number | null {
  let next: number | null = null;
  for (const b of buffs) if (b.expiresAt <= frame && (next === null || b.expiresAt < next)) next = b.expiresAt;
  return next;
}

/** A pending hit's kit entry, the skill its values come from and its kind. */
function pendingHitDef(ctx: TimelineContext, hit: PendingHit): { skill: Pick<KitSkill, "skillId">; kind: SkillType | "none"; kitHit: KitHit } {
  if (!hit.trigger) {
    const skill = kitSkill(ctx, hit.operator, hit.skillId);
    return { skill, kind: skill.kind, kitHit: skill.hits.find((h) => h.id === hit.hitId) as KitHit };
  }
  const { id, action, nested } = hit.trigger;
  const t = ctx.kits.get(hit.operator)?.triggers.find((x) => x.id === id);
  const a = t && triggerActionAt(t, action, nested);
  const kitHit = a?.kind === "hits" ? a.hits.find((h) => h.id === hit.hitId) : undefined;
  if (!kitHit) throw new EngineError(`${hit.operator} trigger ${id} has no hit ${hit.hitId}`);
  return { skill: { skillId: hit.skillId }, kind: kitHit.damageType, kitHit };
}

/** A pending hit's position in its kit list (skill hits, or its trigger action's hits): alternatives are judged in this order. */
function hitOrder(ctx: TimelineContext, hit: PendingHit): number {
  if (!hit.trigger) return kitSkill(ctx, hit.operator, hit.skillId).hits.findIndex((h) => h.id === hit.hitId);
  const { id, action, nested } = hit.trigger;
  const t = ctx.kits.get(hit.operator)?.triggers.find((x) => x.id === id);
  const a = t && triggerActionAt(t, action, nested);
  return a?.kind === "hits" ? a.hits.findIndex((h) => h.id === hit.hitId) : 0;
}

/** Lands one pending hit: its own effects, its damage, then the triggers its events start. */
function landHit(ctx: TimelineContext, state: TimelineState, hit: PendingHit): TimelineState {
  let st = state;
  const { skill, kind, kitHit } = pendingHitDef(ctx, hit);
  const spEvents: BattleEvent[] = [];
  if (hit.sp > 0) {
    const spKind = hit.spKind ?? "returned";
    st = gainSp(st, hit.sp, hit.frame, spKind);
    spEvents.push({ type: "sp", frame: hit.frame, operator: hit.operator, amount: hit.sp, kind, natural: spKind === "natural", ...(hit.spSource !== undefined ? { sourceType: hit.spSource } : {}) });
  }
  const build = ctx.builds.get(hit.operator) as Build;
  st = { ...st, enemy: expireStatus(st.enemy, hit.frame) };
  const panel = ctx.panels.get(hit.operator) as StatPanel;
  // Its situation as it lands, before its own effects: whether it happens (KitHit.if) and its extra scale.
  // Who counts as controlled is who was when its skill was cast.
  const controlled = hit.controlledAtCast ?? st.controlled;
  const at = (consumedSoFar?: number): Situation => ({ ...situationAt(ctx, hit.operator, st, hit.frame, consumedSoFar), controlled, ...(hit.eventCount !== undefined ? { eventCount: hit.eventCount } : {}) });
  const before = at();
  const happens = (h: PendingHit) => {
    const def = h === hit ? kitHit : pendingHitDef(ctx, h).kitHit;
    return !def.if || decide(def.if, evalContext(ctx.data, build, panel, hit.skillId, before));
  };
  // Alternatives of one landing are judged together, on the situation before any of them: the first in kit order that happens lands.
  if (hit.branch) {
    const members = [hit, ...st.pending.filter((p) => p.branch === hit.branch)].sort((a, b) => hitOrder(ctx, a) - hitOrder(ctx, b));
    const chosen = members.find(happens);
    st = { ...st, pending: st.pending.filter((p) => p.branch !== hit.branch || p === chosen) };
    if (chosen !== hit) return st;
  } else if (!happens(hit)) return st;
  // What the hit applies comes first: its own damage and a reaction's initial hit already see the new status.
  const statusEvents: StatusEvent[] = [];
  let consumed = 0;
  if (kitHit.applies?.length) {
    const ai = artsIntensity(ctx, st, hit.operator, hit.frame);
    for (const app of kitHit.applies) {
      if (app.if && !decide(app.if, evalContext(ctx.data, build, panel, hit.skillId, at(consumed)))) continue;
      const resolved = resolveApplication(app, (v) => evaluate(v, evalContext(ctx.data, build, panel, hit.skillId, at(consumed))), hit.eventSource);
      if (!resolved) continue;
      const r = applyToEnemy(st.enemy, resolved, hit.frame, hit.operator, ai, (key) => skillValue(ctx.data, panel, build, hit.skillId, key), statusTweaks(ctx, st, hit.operator, hit.frame));
      st = { ...st, enemy: r.state };
      statusEvents.push(...r.events);
      for (const x of r.events) if (x.kind === "consumed") consumed += x.stacks;
    }
  }
  // A hit computed as a burst is one for triggers too (its damage is the hit's own).
  const burst: StatusEvent[] = kitHit.reaction?.kind === "burst" ? [{ kind: "burst", frame: hit.frame, operator: hit.operator, element: kitHit.reaction.element }] : [];
  // Triggers that act before the hit's damage on its own status events (a buff they apply already counts for it).
  if ((statusEvents.length || burst.length) && ctx.beforeDamage) st = runTriggers(ctx, st, asEvents([...statusEvents, ...burst], kind, hit.cast), { operator: hit.operator, kind }, (t) => t.beforeDamage === true, false);
  let stacksChanged: string[] = [];
  const events: BattleEvent[] = [];
  if (kitHit.gains?.length) {
    const was = st.stacks[hit.operator] ?? {};
    st = { ...st, stacks: gainStacks(ctx, st.stacks, hit.operator, kitHit.gains, evalContext(ctx.data, build, panel, hit.skillId, at(consumed))) };
    stacksChanged = changedStacks(was, st.stacks[hit.operator] ?? {});
  }
  const kitBuff = (id: string) => ctx.kits.get(hit.operator)?.buffs.find((b) => b.id === id);
  // Buffs applied before the damage: their buffApplied triggers run before it too (what they apply acts on the hit).
  const applyBuffs = (beforeDamage: boolean) => {
    const into = beforeDamage ? [] : events;
    for (const a of kitHit.buffs ?? []) {
      if ((a.beforeDamage ?? false) !== beforeDamage) continue;
      const def = kitBuff(a.buff);
      if (!def) throw new EngineError(`${hit.operator} has no buff ${a.buff}`);
      if (a.if && !decide(a.if, evalContext(ctx.data, build, panel, hit.skillId, at(consumed)))) continue;
      const r = addBuff(ctx, st, hit.operator, hit.skillId, def, hit.frame, at(consumed));
      st = r.state;
      if (r.applied) into.push(buffAppliedEvent(hit.frame, hit.operator, def, kind));
    }
    if (beforeDamage && into.length) st = runTriggers(ctx, st, into, { operator: hit.operator, kind });
  };
  applyBuffs(true);
  // A finisher (skillSpecification 8) is multiplied by the enemy's finisher multiplier (attribute 27).
  const finisher = !hit.trigger && ctx.data.skills[hit.skillId]?.timing?.specification === 8;
  let roll: number | undefined;
  if (ctx.scenario.options.crit === "rolled" && hit.fixed === undefined) ({ value: roll, state: st } = draw(ctx, st, "crit"));
  const result = hit.fixed !== undefined ? fixedHit(skill.skillId, kitHit, hit.fixed) : computeHit(ctx.data, build, panel, ctx.scenario.target, skill, kitHit, {
    ...damageOptions(ctx, st, hit.operator, st.enemy, hit.frame, hit.cast),
    ...(roll !== undefined ? { critRoll: roll } : {}),
    ...(finisher ? { modifiers: [...damageOptions(ctx, st, hit.operator, st.enemy, hit.frame, hit.cast).modifiers, { zone: "multiplicative" as const, value: enemyAttr(ctx, Attr.BreakingAttackDamageTakenScalar) - 1, source: "Finisher" }] } : {}),
    situation: { ...before, consumed },
  });
  st = addHits(st, [{ ...result, count: 1, frame: hit.frame, operator: hit.operator, ...(kitHit.fixedDamage !== undefined ? { fixed: true as const } : {}) }]);
  applyBuffs(false);
  if (hit.usesUp) {
    const own = st.stacks[hit.operator] ?? {};
    st = { ...st, stacks: { ...st.stacks, [hit.operator]: { ...own, ...Object.fromEntries(hit.usesUp.map((u) => [u.stack, Math.max(0, (own[u.stack] ?? 0) - u.amount)])) } } };
  }
  if (kitHit.sp !== undefined) {
    const amount = resolveValue(ctx.data, build, panel, hit.skillId, kitHit.sp, at(consumed));
    const spKind = spKindOf(ctx, hit.skillId, kitHit.sp, kitHit.spKind);
    st = gainSp(st, amount, hit.frame, spKind);
    if (amount > 0) spEvents.push({ type: "sp", frame: hit.frame, operator: hit.operator, amount, kind, natural: spKind === "natural", ...spSourceOf(ctx, hit.skillId, kitHit.sp) });
  }
  if (kitHit.energy) {
    const amount = resolveValue(ctx.data, build, panel, hit.skillId, kitHit.energy, at(consumed));
    st = gainEnergy(ctx, st, hit.operator, amount, hit.frame);
  }
  st = recordStatus(ctx, st, statusEvents, st.enemy);
  // Stagger: Final Strikes' only while their operator is controlled (onlyEnableForMainChar).
  const poiseEvents: BattleEvent[] = [];
  if (kitHit.poise !== undefined && (!kitHit.poiseControlledOnly || controlled === hit.operator)) {
    const r = dealPoise(ctx, st, hit.operator, resolveValue(ctx.data, build, panel, hit.skillId, kitHit.poise, at(consumed)), hit.frame);
    st = r.state;
    poiseEvents.push(...r.events);
  }
  const hitEvent: BattleEvent = {
    type: "hit", frame: hit.frame, operator: hit.operator, skillId: hit.skillId, kind,
    element: kitHit.reaction?.element ?? kitHit.element, finalStrike: kitHit.finalStrike ?? false, finisher, controlled: st.controlled === hit.operator,
    ...(kitHit.reaction ? { reaction: true } : {}),
    ...(hit.cast !== undefined ? { cast: hit.cast } : {}),
    ...((ctx.scenario.options.crit === "always" && hit.fixed === undefined) || result.crit ? { crit: true } : {}),
  };
  const all: BattleEvent[] = [
    hitEvent, ...asEvents(statusEvents, kind, hit.cast), ...asEvents(burst, kind, hit.cast), ...poiseEvents, ...events, ...spEvents,
    ...(kitHit.heals ? healEvents(ctx, st, hit.operator, kitHit.heals, hit.frame, kind) : []),
    ...(kitHit.gains?.length ? [{ type: "stacks" as const, frame: hit.frame, operator: hit.operator, changed: stacksChanged }] : []),
  ];
  return runTriggers(ctx, st, all, { operator: hit.operator, kind }, ctx.beforeDamage ? (t) => !t.beforeDamage : undefined);
}

/** A cast's jumps and ends: the unconditional ones, and conditional ones whose kit condition holds at the cast. */
function castJumps(timing: SkillTiming, skill: KitSkill, ec: EvalContext, operator: string, cast: number, frame: number, scaled: (f: number) => number): PendingJump[] {
  const taken = timing.jumps.filter((j) => !j.conditional || skill.jumps?.some((k) => k.at === j.at && (k.to === undefined || k.to === j.to) && decide(k.if, ec)));
  return [
    ...taken.map((j) => ({ frame: frame + scaled(j.at), operator, cast, from: j.at, to: j.to })),
    ...timing.ends.map((e) => ({ frame: frame + scaled(e), operator, cast, from: e, to: e, end: true as const })),
  ];
}

/**
 * A cast's slow-downs along the path its jumps decided at the cast take: one
 * in a skipped segment or after the action's own end never starts, and one
 * after a jump starts that much sooner (skill frames). Event-driven jumps
 * (a trigger's `jump`) can't be foreseen here.
 */
function plannedSlowdowns(timing: SkillTiming, planned: readonly PendingJump[]): SkillTiming["slowdowns"] {
  if (planned.length === 0) return timing.slowdowns;
  const skips: { from: number; to: number }[] = [];
  for (const j of [...planned].filter((x) => !x.end).sort((a, b) => a.from - b.from)) if (!skips.some((k) => j.from > k.from && j.from < k.to)) skips.push({ from: j.from, to: j.to });
  const skipped = (x: number) => skips.some((k) => x > k.from && x < k.to);
  const end = Math.min(Infinity, ...planned.filter((x) => x.end && !skipped(x.from)).map((x) => x.from));
  return timing.slowdowns
    .filter((d) => !skipped(d.from) && d.from < end)
    .map((d) => ({ ...d, from: d.from - skips.filter((k) => k.to <= d.from).reduce((t, k) => t + (k.to - k.from), 0) }));
}

/**
 * A jump on an operator's current cast at its frame: what the cast has
 * still to do in the skipped frames doesn't happen (its own hits, delayed
 * actions, team energy, jumps; detached hits go on), what's after comes
 * that much sooner, and a buff that ends with the cast and would end in the
 * skipped frames ends now.
 */
function takeJump(st: TimelineState, j: PendingJump): { state: TimelineState; events: BattleEvent[] } {
  const cur = st.acting[j.operator] as Acting;
  const at = j.frame;
  const length = cur.speed ? Math.round((j.to - j.from) / cur.speed) : j.to - j.from;
  const mine = (x: { readonly operator: string; readonly index: number } | undefined) => x !== undefined && x.operator === j.operator && x.index === j.cast;
  // Each list: drop what falls in the skipped frames, pull the rest in.
  const skip = <T extends { readonly frame: number }>(list: readonly T[], ownedBy: (x: T) => boolean): T[] =>
    list.flatMap((x) => (!ownedBy(x) || x.frame <= at ? [x] : x.frame < at + length ? [] : [{ ...x, frame: x.frame - length }]));
  const ending = st.buffs.filter((b) => b.owner === j.operator && b.endsWithCast === j.cast && b.expiresAt > at && b.expiresAt < at + length);
  const events: BattleEvent[] = [...new Map(ending.map((b) => [b.id, { type: "buffEnded" as const, frame: at, operator: j.operator, buff: b.id, remaining: remainingOf(ending.filter((x) => x.id === b.id), at), ...(b.gameBuff ? { gameBuff: b.gameBuff } : {}) }])).values()];
  return {
    state: {
      ...st,
      pending: [
        ...skip(st.pending.filter((h) => !h.detached || h.launchAt === undefined), (h) => h.operator === j.operator && h.cast === j.cast && !h.detached),
        // A detached hit not launched yet moves with its launch: dropped if the jump skips it, sooner if it comes after.
        ...st.pending
          .filter((h) => h.detached && h.launchAt !== undefined)
          .flatMap((h) => (h.operator !== j.operator || h.cast !== j.cast || (h.launchAt as number) <= at ? [h] : (h.launchAt as number) < at + length ? [] : [{ ...h, frame: h.frame - length, launchAt: (h.launchAt as number) - length }])),
      ],
      pendingActions: skip(st.pendingActions, (x) => mine(x.cast)),
      pendingEnergy: skip(st.pendingEnergy, (x) => mine(x.cast) && !x.detached),
      pendingJumps: skip(st.pendingJumps, (x) => x.operator === j.operator && x.cast === j.cast),
      buffs: st.buffs.flatMap((b) => (ending.includes(b) ? [] : b.owner === j.operator && b.endsWithCast === j.cast && b.expiresAt >= at + length ? [{ ...b, expiresAt: b.expiresAt - length, skipped: (b.skipped ?? 0) + length }] : [b])),
      acting: { ...st.acting, [j.operator]: { ...cur, skips: [...(cur.skips ?? []), { from: j.from, to: j.to, at, length }] } },
    },
    events,
  };
}

/**
 * An enemy action and what it sets off. With dodging on, the controlled
 * operator dashes at an attack on it (not during an ultimate's exclusive
 * frames): perfect with the scenario's chance. A perfect dodge ends its
 * current action, gives SP, slows the world (not cooldowns) while the
 * dodger is exempt, freezes the dodger for its own while, and replaces the
 * attack on it with a perfectDodge event.
 */
function enemyAct(ctx: TimelineContext, state: TimelineState, a: EnemyAction): TimelineState {
  const events = enemyActionEvents(ctx, state, a);
  const dodge = ctx.scenario.options.dodge;
  const pd = ctx.data.constants.perfectDodge;
  const op = state.controlled;
  if (!dodge || !pd || !events.some((e) => e.type === "attacked" && e.operator === op)) return runTriggers(ctx, state, events, null);
  const cur = state.acting[op];
  if (cur) {
    const t = timingOf(ctx, cur.skill);
    if (t.specification === 5 && a.frame < actionFrame(cur, t.exclusiveFrames)) return runTriggers(ctx, state, events, null);
  }
  // No dash at an attack the current skill would counter (a kit's `attacked` trigger that jumps this skill from where its playhead is).
  if (cur && counters(ctx, op, cur, a.frame)) return runTriggers(ctx, state, events, null);
  const roll = draw(ctx, state, "dodge");
  if (roll.value >= dodge.chance) return runTriggers(ctx, roll.state, events, null);
  const ended = endCurrentSkill(roll.state, op, a.frame);
  // It's in the cast list as the skill "dodge" (no cast event: nothing listens to the perfect-dodge skill's cast).
  const sp = Math.min(SP.max, spAt(ended.state, a.frame) + pd.sp);
  const cast: Cast = { frame: a.frame, operator: op, skill: DODGE, spAfter: sp, energyAfter: ended.state.energy[op] ?? 0 };
  let st: TimelineState = { ...ended.state, sp, frame: Math.max(ended.state.frame, a.frame), acting: { ...ended.state.acting, [op]: { skill: DODGE, frame: a.frame, cast: ended.state.casts.length } }, casts: [...ended.state.casts, cast] };
  st = slowDown(ctx, st, op, { ...timingOf(ctx, DODGE), slowdowns: [{ from: 0, scales: pd.slowdown }] }, a.frame);
  st = shiftOperator(st, op, a.frame, Math.round(pd.dodgerSlowdown.reduce((t, x) => t + (1 - x), 0)));
  const others = events.filter((e) => !(e.type === "attacked" && e.operator === op));
  return runTriggers(ctx, st, [...ended.events, { type: "perfectDodge", frame: a.frame, operator: op }, ...others], null);
}

/** An action's playhead at a real frame, in skill frames: real frames since its start plus what its jumps skipped, at its speed. */
function playheadOf(cur: Acting, frame: number): number {
  return Math.round((frame - cur.frame + (cur.skips ?? []).filter((k) => k.at <= frame).reduce((t, k) => t + k.length, 0)) * (cur.speed ?? 1));
}

/** Whether an attack on the operator now would set off its current skill's counter (an `attacked` trigger with a `jump` of this skill in range). */
function counters(ctx: TimelineContext, operator: string, cur: Acting, frame: number): boolean {
  const p = playheadOf(cur, frame);
  return (ctx.kits.get(operator)?.triggers ?? []).some(
    (t) => t.on.event === "attacked" && t.by === "self" && t.do.some((x) => x.kind === "jump" && x.skill === cur.skill && p >= x.from && p < x.until),
  );
}

/** The events an enemy action makes: an attack on each operator it hits, or the start of a charge. */
function enemyActionEvents(ctx: TimelineContext, st: TimelineState, a: EnemyAction): BattleEvent[] {
  if (a.kind === "charge") return [{ type: "enemyCharge", frame: a.frame, operator: st.controlled }];
  const targets = a.target === "controlled" ? [st.controlled] : a.target === "team" ? ctx.scenario.team.map((b) => b.operator) : [a.target];
  return targets.map((operator) => ({ type: "attacked", frame: a.frame, operator, element: a.element, controlled: operator === st.controlled }));
}

/** Processes every pending hit, status tick and buff expiry up to (and including) a frame, in frame order. */
export function advance(ctx: TimelineContext, state: TimelineState, frame: number): TimelineState {
  if (frame < state.frame) throw new EngineError(`can't go back from frame ${state.frame} to ${frame}`);
  let st = state;
  for (;;) {
    // The next pending hit (triggers can add hits while this runs).
    let hit: PendingHit | null = null;
    for (const h of st.pending) if (h.frame <= frame && (!hit || h.frame < hit.frame || (h.frame === hit.frame && h.operator < hit.operator))) hit = h;
    const tick = nextTick(st.enemy);
    const expiry = nextExpiry(st.buffs, frame);
    const tickDue = tick !== null && tick <= frame ? tick : null;
    const buffTick = nextBuffTick(st.buffs, frame);
    const due = st.pendingActions.reduce<TimelineState["pendingActions"][number] | null>((a, x) => (x.frame <= frame && (!a || x.frame < a.frame) ? x : a), null);
    const grant = st.pendingEnergy.reduce<TimelineState["pendingEnergy"][number] | null>((a, g) => (g.frame <= frame && (!a || g.frame < a.frame) ? g : a), null);
    const enemyAction = st.enemyActions[0] !== undefined && st.enemyActions[0].frame <= frame ? st.enemyActions[0] : null;
    // At one frame: ticks of a status already on the enemy, then buffs ending, then delayed trigger actions, energy grants,
    // the enemy's actions, buffs' periodic ticks, then hits. Each kind waits for everything earlier.
    const first = (x: number | null, ...later: (number | null)[]) => x !== null && later.every((y) => y === null || x <= y);
    const hitFrame = hit ? hit.frame : null;
    const dueFrame = due?.frame ?? null;
    const grantFrame = grant?.frame ?? null;
    const enemyFrame = enemyAction?.frame ?? null;
    // A jump comes after everything else at its frame (what's at its skill frame still happens).
    const jump = st.pendingJumps.reduce<PendingJump | null>((a, x) => (x.frame <= frame && (!a || x.frame < a.frame) ? x : a), null);
    const jumpFrame = jump?.frame ?? null;
    if (first(tickDue, expiry, dueFrame, grantFrame, enemyFrame, buffTick?.frame ?? null, hitFrame, jumpFrame)) {
      const tickFrame = tickDue as number;
      const before = st.enemy;
      const t = tickStatus(st.enemy, tickFrame);
      st = recordStatus(ctx, { ...st, enemy: t.state }, t.events, before);
      st = runTriggers(ctx, st, asEvents(t.events, "none"), null);
      continue;
    }
    if (first(expiry, dueFrame, grantFrame, enemyFrame, buffTick?.frame ?? null, hitFrame, jumpFrame)) {
      const at = expiry as number;
      // A buff a cast consumed already ended when it was consumed.
      const ended = st.buffs.filter((b) => b.expiresAt === at && b.cast === undefined);
      st = { ...st, buffs: st.buffs.filter((b) => b.expiresAt !== at) };
      // Run out: nothing left, but what its cast's jumps took from it.
      st = runTriggers(ctx, st, ended.map((b) => ({ type: "buffEnded" as const, frame: at, operator: b.owner, buff: b.id, remaining: b.skipped ?? 0, ...(b.records ? { recorded: b.records.total } : {}), ...(b.gameBuff ? { gameBuff: b.gameBuff } : {}) })), null);
      continue;
    }
    if (due && first(due.frame, grantFrame, enemyFrame, buffTick?.frame ?? null, hitFrame, jumpFrame)) {
      const t = ctx.kits.get(due.owner)?.triggers.find((x) => x.id === due.trigger);
      if (!t) throw new EngineError(`${due.owner} has no trigger ${due.trigger}`);
      st = { ...st, pendingActions: st.pendingActions.filter((x) => x !== due) };
      const r = runActions(ctx, st, t, due.owner, { ...due.event, frame: due.frame }, due.origin);
      st = runTriggers(ctx, r.state, r.events, due.origin);
      continue;
    }
    if (grant && first(grant.frame, enemyFrame, buffTick?.frame ?? null, hitFrame, jumpFrame)) {
      st = { ...st, pendingEnergy: st.pendingEnergy.filter((g) => g !== grant) };
      const caster = grant.cast?.operator ?? grant.operator;
      const holds = !grant.if || decide(grant.if, evalContext(ctx.data, ctx.builds.get(caster) as Build, ctx.panels.get(caster) as StatPanel, "", situationAt(ctx, caster, st, grant.frame)));
      if (holds) st = gainEnergy(ctx, st, grant.operator, grant.amount, grant.frame);
      continue;
    }
    if (enemyAction && first(enemyAction.frame, buffTick?.frame ?? null, hitFrame, jumpFrame)) {
      st = enemyAct(ctx, { ...st, enemyActions: st.enemyActions.slice(1) }, enemyAction);
      continue;
    }
    if (buffTick && first(buffTick.frame, hitFrame, jumpFrame)) {
      const { b, frame: at } = buffTick;
      const every = b.every as number;
      st = { ...st, buffs: st.buffs.map((x) => (x === b ? { ...b, nextTick: at + every } : x)) };
      st = runTriggers(ctx, st, [{ type: "buffTick", frame: at, operator: b.owner, buff: b.id }], null);
      continue;
    }
    if (jump && (hitFrame === null || jump.frame < hitFrame)) {
      st = { ...st, pendingJumps: st.pendingJumps.filter((x) => x !== jump) };
      // Only while that cast is still the operator's current action.
      if (st.acting[jump.operator]?.cast !== jump.cast) continue;
      if (jump.end) {
        const r = endCurrentSkill(st, jump.operator, jump.frame);
        st = { ...r.state, acting: Object.fromEntries(Object.entries(r.state.acting).filter(([k]) => k !== jump.operator)) };
        st = runTriggers(ctx, st, r.events, null);
      } else {
        const r = takeJump(st, jump);
        st = runTriggers(ctx, r.state, r.events, null);
      }
      continue;
    }
    if (!hit) break;
    const h = hit;
    st = landHit(ctx, { ...st, pending: st.pending.filter((x) => x !== h) }, h);
  }
  return {
    ...st,
    sp: spAt(st, frame),
    frame,
    enemy: expireStatus(st.enemy, frame),
  };
}

/** The first frame at or after `frame` outside the operator's current skill's cantCastSkill channels. */
function afterCantCast(ctx: TimelineContext, state: TimelineState, operator: string, frame: number): number {
  const cur = state.acting[operator];
  if (!cur) return frame;
  let f = frame;
  // Channels are in skill frames; a hasted cast plays them faster.
  const at = (x: number) => actionFrame(cur, x);
  for (const c of [...timingOf(ctx, cur.skill).channels].sort((a, b) => a.from - b.from)) if (c.cantCastSkill && at(c.from) <= f && f < at(c.to)) f = at(c.to);
  return f;
}

/**
 * The earliest frame an action could start from the current state, or a
 * reason it can't. When the operator's kit can end its own action
 * (`endAction`), the action the gate waits on may end sooner: then it's
 * judged from the frame that happens.
 */
export function earliestStart(ctx: TimelineContext, state: TimelineState, action: RotationAction): { frame: number } | { error: string } {
  const r = startFrom(ctx, state, action);
  const cur = state.acting[action.operator];
  // Its action may end sooner: a kit's endAction, a jump or end on its timeline, a perfect dodge.
  const ends =
    ctx.kits.get(action.operator)?.triggers.some((t) => allActions(t.do).some((a) => a.kind === "endAction")) ||
    state.pendingJumps.some((j) => j.operator === action.operator) ||
    (ctx.scenario.options.dodge !== undefined && state.enemyActions.some((a) => a.kind === "attack"));
  if (!cur || ("frame" in r && r.frame <= state.frame) || !ends) return r;
  const t = timingOf(ctx, cur.skill);
  const horizon = Math.min(ctx.scenario.durationFrames, "frame" in r ? r.frame : actionFrame(cur, t.durationFrames));
  // Over, replaced, or moved on by a jump.
  const same = (x: TimelineState) => x.acting[action.operator]?.frame === cur.frame && x.acting[action.operator]?.skill === cur.skill && (x.acting[action.operator]?.skips?.length ?? 0) === (cur.skips?.length ?? 0);
  if (horizon <= state.frame || same(advance(ctx, state, horizon))) return r;
  // The first frame its action is over or replaced: everything before it is as the plain judgement saw it.
  let lo = state.frame;
  let hi = horizon;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (same(advance(ctx, state, mid))) lo = mid;
    else hi = mid;
  }
  // Judged again from there: the action that follows may end sooner too (Catcher's counter jumps, then ends at 194). Each round moves forward.
  return earliestStart(ctx, advance(ctx, state, hi), action);
}

function startFrom(ctx: TimelineContext, state: TimelineState, action: RotationAction): { frame: number } | { error: string } {
  if (!ctx.builds.has(action.operator)) return { error: `${action.operator} isn't in the team` };
  let frame = Math.max(state.frame, action.at ?? 0);
  if (action.skill === "swap") {
    if (action.operator === state.controlled) return { error: `${action.operator} is already the controlled operator` };
    // Swapping doesn't stop the current action, but a channel that forbids switching does stop the swap.
    const cur = state.acting[state.controlled];
    if (cur) for (const c of timingOf(ctx, cur.skill).channels) if (c.cantSwitch && actionFrame(cur, c.from) <= frame && frame < actionFrame(cur, c.to)) frame = actionFrame(cur, c.to);
    return { frame };
  }
  let costs;
  try {
    if (kitSkill(ctx, action.operator, action.skill).followUpOnly) return { error: `${action.skill} is cast only by its own skill (a follow-up), not by a rotation` };
    costs = skillCosts(ctx, action.operator, action.skill);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  if (costs.kind === "basic" && state.controlled !== action.operator) return { error: `${action.operator} isn't the controlled operator (swap first)` };
  // A dive attack (skillSpecification 6) needs the operator in mid-air, and rotations have no jumps yet.
  if (costs.timing.specification === 6) return { error: `${action.skill} is a dive attack: it needs mid-air, and rotations have no jumps` };
  frame = Math.max(frame, state.readyAt[action.skill] ?? 0);
  // Without a time, an action waits for the current skill's own hits (interrupting would cancel them); with one, it may
  // interrupt. A skill that runs beside the current one cancels nothing, so it doesn't wait.
  const beside = ((s) => s.beside !== undefined && decide(s.beside, evalContext(ctx.data, ctx.builds.get(action.operator) as Build, ctx.panels.get(action.operator) as StatPanel, s.skillId, situationAt(ctx, action.operator, state, frame))))(kitSkill(ctx, action.operator, action.skill));
  if (action.at === undefined && !beside) frame = Math.max(frame, ownHitsLanded(state, action.operator));
  const gate = actionGate(ctx, state, action.operator, action.skill, frame);
  if ("error" in gate) return gate;
  frame = gate.frame;
  // A channel that forbids casting (cantCastSkill, a finisher's disable-cast buff) holds every cast of its operator, whatever its priority.
  frame = afterCantCast(ctx, state, action.operator, frame);
  // A finisher only on a Staggered enemy, once per stagger.
  if (costs.timing.specification === 8 && ((then) => !isStaggered(then, frame) || then.stagger.finisherUsed)(advance(ctx, state, frame))) return { error: `${action.skill} is a finisher: the enemy isn't Staggered (or this stagger's finisher is used) at frame ${frame}` };
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
  if (skill.available) {
    const then = advance(ctx, state, frame);
    const build = ctx.builds.get(action.operator) as Build;
    const ok = decide(skill.available, evalContext(ctx.data, build, ctx.panels.get(action.operator) as StatPanel, skill.skillId, situationAt(ctx, action.operator, then, frame)));
    if (!ok) return { error: `${action.skill} isn't available at frame ${frame} (${JSON.stringify(skill.available)})` };
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

/** Whether the operator's combo needs a window: some trigger of its kit opens one (for this build's modes). */
function hasComboTrigger(ctx: TimelineContext, operator: string): boolean {
  const panel = ctx.panels.get(operator) as StatPanel;
  const build = ctx.builds.get(operator) as Build;
  return (ctx.kits.get(operator)?.triggers ?? []).some(
    (t) => allActions(t.do).some((a) => a.kind === "openCombo") && (!t.if || test(t.if, evalContext(ctx.data, build, panel, triggerSkillId(operator, t), { team: ctx.scenario.team })) !== false),
  );
}

/** Cooldowns after a cast: the skill's own, and every member of its cooldown group on its own cooldown. */
function castCooldowns(ctx: TimelineContext, readyAt: TimelineState["readyAt"], operator: string, skill: KitSkill, cooldownFrames: number, frame: number): TimelineState["readyAt"] {
  const out = { ...readyAt };
  if (cooldownFrames > 0) out[skill.skillId] = frame + cooldownFrames;
  if (skill.cooldownGroup) {
    for (const other of ctx.kits.get(operator)?.skills ?? []) {
      if (other.cooldownGroup !== skill.cooldownGroup || other.skillId === skill.skillId) continue;
      const cd = skillCosts(ctx, operator, other.skillId).cooldownFrames;
      if (cd > 0) out[other.skillId] = Math.max(out[other.skillId] ?? 0, frame + cd);
    }
  }
  return out;
}

/** Applies one rotation action at its earliest legal frame. Throws if it can't happen. */
export function apply(ctx: TimelineContext, state: TimelineState, action: RotationAction): TimelineState {
  const start = earliestStart(ctx, state, action);
  if ("error" in start) throw new EngineError(`frame ${state.frame}: ${action.operator} ${action.skill}: ${start.error}`);
  const advanced = advance(ctx, state, start.frame);
  if (action.skill === "swap") return { ...advanced, controlled: action.operator };
  const r = castSkill(ctx, advanced, action.operator, action.skill, start.frame, false);
  return runTriggers(ctx, r.state, r.events, r.origin);
}

/**
 * Ends an operator's current skill at a frame: its hits still to land are
 * cancelled, unless already on their way (detached), and so are its
 * delayed cast-trigger actions; the buffs that end with it end (their
 * `buffEnded` events are returned).
 */
function endCurrentSkill(advanced: TimelineState, operator: string, frame: number): { state: TimelineState; events: BattleEvent[] } {
  // The current skill's cast (a skill cast beside it isn't the current one).
  const prevCast = advanced.acting[operator]?.cast ?? advanced.casts.findLastIndex((c) => c.operator === operator);
  const endsNow = advanced.buffs.filter((b) => b.owner === operator && b.endsWithCast !== undefined && b.endsWithCast === prevCast && b.expiresAt > frame);
  const state = {
    ...advanced,
    pending: advanced.pending.filter((h) => !(h.operator === operator && h.cast === prevCast && h.frame > frame && (!h.detached || (h.launchAt !== undefined && h.launchAt > frame)))),
    pendingActions: advanced.pendingActions.filter((x) => !(x.cast && x.cast.operator === operator && x.cast.index === prevCast && x.frame > frame)),
    pendingEnergy: advanced.pendingEnergy.filter((x) => !(x.cast && !x.detached && x.cast.operator === operator && x.cast.index === prevCast && x.frame > frame)),
    pendingJumps: advanced.pendingJumps.filter((x) => !(x.operator === operator && x.cast === prevCast)),
    buffs: advanced.buffs.filter((b) => !endsNow.includes(b)),
  };
  const events: BattleEvent[] = [...new Map(endsNow.map((b) => {
    const same = endsNow.filter((x) => x.id === b.id);
    const recorded = recordedOf(same);
    return [b.id, { type: "buffEnded" as const, frame, operator, buff: b.id, remaining: remainingOf(same, frame), ...(recorded !== undefined ? { recorded } : {}), ...(b.gameBuff ? { gameBuff: b.gameBuff } : {}) }];
  })).values()];
  return { state, events };
}

/**
 * Casts a skill at a frame (the state already advanced to it): ends the
 * operator's current skill, schedules the hits, spends and grants
 * resources, and returns the cast's events for the triggers. A follow-up
 * cast (`followUp`: a skill casting another, CastSkill) costs nothing and
 * starts no cooldown.
 */
function castSkill(ctx: TimelineContext, advanced: TimelineState, operator: string, skillId: string, frame: number, followUp: boolean): { state: TimelineState; events: BattleEvent[]; origin: Origin } {
  const skill = kitSkill(ctx, operator, skillId);
  // Starting a skill ends the operator's current one, unless it runs beside it (KitSkill.beside).
  const beside = skill.beside !== undefined && decide(skill.beside, evalContext(ctx.data, ctx.builds.get(operator) as Build, ctx.panels.get(operator) as StatPanel, skillId, situationAt(ctx, operator, advanced, frame)));
  const ended = beside ? { state: advanced, events: [] } : endCurrentSkill(advanced, operator, frame);
  const s = ended.state;
  const endsNowEvents = ended.events;
  const full = skillCosts(ctx, operator, skillId);
  const costs = followUp ? { ...full, spCost: 0, energyCost: 0, cooldownFrames: 0 } : full;
  // Hits that need stacks happen only if the stacks are there at the cast; meeting a consuming requirement uses the stack up.
  const own = s.stacks[operator] ?? {};
  const panel = ctx.panels.get(operator) as StatPanel;
  const castSituation: Situation = {
    team: ctx.scenario.team, controlled: s.controlled, stacks: own, buffActive: (id) => s.buffs.some((b) => b.id === id && b.owner === operator && b.cast === undefined && b.appliedAt <= frame && b.expiresAt > frame),
    buffLayers: (id) => s.buffs.filter((b) => b.id === id && b.owner === operator && b.cast === undefined && b.appliedAt <= frame && b.expiresAt > frame).length,
  };
  const castIndex = s.casts.length;
  // Haste (attribute 92, KeywordSpeedUpScalar, default 1, at most 1.3): the cast plays faster (assumed; in-game test 19).
  const speed = actionSpeed(ctx, s, operator, frame);
  const scaled = (f: number) => (speed === 1 ? f : Math.round(f / speed));
  const windowCount = costs.kind === "combo" ? s.comboWindow[operator]?.count : undefined;
  const windowSource = costs.kind === "combo" ? s.comboWindow[operator]?.source : undefined;
  const inRange = (r: StackRequirement) => {
    const n = own[r.stack] ?? 0;
    return (r.atLeast === undefined || n >= r.atLeast) && (r.below === undefined || n < r.below);
  };
  const met = (h: KitHit) => hitAvailable(ctx.data, ctx.builds.get(operator) as Build, panel, skill.skillId, h, castSituation) && (!h.requires || inRange(h.requires));
  // What the happening hits use up, per stack: all of it, or the largest amount named; at the cast, or at the requiring hit.
  const castEc = evalContext(ctx.data, ctx.builds.get(operator) as Build, panel, skill.skillId, castSituation);
  const usage = new Map<string, { amount: number; atHit: string | null }>();
  for (const h of skill.hits.filter(met)) {
    const r = h.requires;
    if (!r?.consume) continue;
    const amount = r.consume === true ? Infinity : evaluate(r.consume, castEc);
    const cur = usage.get(r.stack);
    usage.set(r.stack, { amount: Math.max(cur?.amount ?? 0, amount), atHit: r.consumeAt === "hit" ? (cur?.atHit ?? h.id) : null });
  }
  const atCast = [...usage].filter(([, u]) => u.atHit === null);
  const stacks = atCast.length ? { ...s.stacks, [operator]: { ...own, ...Object.fromEntries(atCast.map(([id, u]) => [id, Math.max(0, (own[id] ?? 0) - u.amount)])) } } : s.stacks;
  const usesAtHit = (hitId: string) => [...usage].filter(([, u]) => u.atHit === hitId).map(([stack, u]) => ({ stack, amount: u.amount }));
  const pending: PendingHit[] = [];
  // A hit's `if` is judged as it lands (it may depend on what the skill itself does first); only its stack requirement is the cast's.
  // A count that's a value is judged here, before the cast uses stacks up.
  const countEc = () => evalContext(ctx.data, ctx.builds.get(operator) as Build, panel, skill.skillId, { ...situationAt(ctx, operator, s, frame), ...castSituation });
  for (const h of skill.hits.filter((x) => !x.requires || inRange(x.requires))) {
    const frames = typeof h.count === "number" ? (h.frames ?? Array.from({ length: h.count }, () => 0)) : landingFrames(h, evaluate(h.count, countEc()));
    frames.forEach((f, i) =>
      pending.push({
        frame: frame + scaled(f), operator, skillId: skill.skillId, hitId: h.id, sp: 0, controlledAtCast: s.controlled, cast: castIndex,
        ...(usesAtHit(h.id).length && i === 0 ? { usesUp: usesAtHit(h.id) } : {}), ...(h.detached || h.launch !== undefined ? { detached: true } : {}),
        ...(h.launch !== undefined ? { launchAt: frame + scaled(h.launch) } : {}),
        ...(windowCount !== undefined ? { eventCount: windowCount } : {}), ...(windowSource ? { eventSource: windowSource } : {}), ...(h.branch ? { branch: `${castIndex}:${h.branch}:${i}` } : {}),
      }),
    );
  }
  // A skill whose kit names the hit that returns SP gets it there, not on its first hit; a finisher also gets the enemy's finisher SP (GainBreakingAttackAtb).
  const finisherSp = full.timing.specification === 8 && !followUp ? (ctx.data.enemies[ctx.scenario.target.enemy]?.finisherSp ?? 0) : 0;
  const ownGain = skill.hits.some((h) => h.sp !== undefined) ? 0 : skillSpGain(ctx, operator, skillId);
  const spGain = ownGain + finisherSp;
  if (spGain > 0 && pending.length > 0) {
    const first = pending.reduce((a, b) => (b.frame < a.frame ? b : a));
    // The skill's `atb` is of the kind its data gives; a finisher's SP (GainBreakingAttackAtb, atbGainMethod 0) is natural.
    const spKind = ownGain > 0 ? spKindOf(ctx, skillId, "atb") : "natural";
    // Its atbSourceType likewise: the `atb` key's, a finisher's 0.
    const spSource = ownGain > 0 ? spSourceOf(ctx, skillId, "atb").sourceType : FINISHER_SP_SOURCE_TYPE;
    pending[pending.indexOf(first)] = { ...first, sp: spGain, spKind, ...(spSource !== undefined ? { spSource } : {}) };
  }
  // Returned SP is spent first; only the natural part gives the team ultimate energy.
  const natural = Math.max(0, costs.spCost - s.spReturned);
  let next: TimelineState = { ...s, spReturned: Math.max(0, s.spReturned - costs.spCost) };
  if (natural > 0) {
    if (skill.teamEnergy === undefined) for (const b of ctx.scenario.team) next = gainEnergy(ctx, next, b.operator, natural * ENERGY.perNaturalSp, frame);
    else
      for (const part of skill.teamEnergy) {
        const at = frame + scaled(part.frame);
        const grants = ctx.scenario.team.map((b) => ({ frame: at, operator: b.operator, amount: natural * ENERGY.perNaturalSp * part.ratio, cast: { operator, index: castIndex }, ...(part.detached ? { detached: true } : {}), ...(part.if ? { if: part.if } : {}) }));
        next = { ...next, pendingEnergy: [...next.pendingEnergy, ...grants] };
      }
  }
  if (costs.energyCost > 0) next = { ...next, energy: { ...next.energy, [operator]: Math.max(0, (next.energy[operator] ?? 0) - costs.energyCost) } };
  if (skill.energyBlockSeconds) next = { ...next, energyBlockedUntil: { ...next.energyBlockedUntil, [operator]: frame + Math.round(skill.energyBlockSeconds * FPS) } };
  if (!followUp && costs.kind === "combo" && next.comboWindow[operator]) {
    const { [operator]: _used, ...rest } = next.comboWindow;
    next = { ...next, comboWindow: rest };
  }
  // Link (buff_common_affixes_combo_trigger → skillimbue_atk): a combo leaves the team a stack for 15 s; the next battle
  // skill or ultimate, by anyone, uses all of them (at most 4) for its own hits: +30/45/60/75% / +20/30/40/50%.
  const linkEnded: BattleEvent[] = [];
  if (!followUp) {
    const live = next.link.filter((f) => f > frame);
    // Kit buffs that count as a Link stack (KitBuff.link) for the caster, used up with the combo stacks.
    const linkBuffs = next.buffs.filter((b) => b.link && b.cast === undefined && reaches(b, operator) && b.appliedAt <= frame && b.expiresAt > frame);
    if (costs.kind === "combo") next = { ...next, link: [...live, frame + LINK_FRAMES] };
    else if ((costs.kind === "battle" || costs.kind === "ultimate") && live.length + linkBuffs.length > 0) {
      const n = Math.min(4, live.length + linkBuffs.length);
      if (linkBuffs.length) {
        next = { ...next, buffs: next.buffs.filter((b) => !linkBuffs.includes(b)) };
        linkEnded.push(...new Map(linkBuffs.map((b) => [`${b.owner}:${b.id}`, { type: "buffEnded" as const, frame, operator: b.owner, buff: b.id, remaining: remainingOf([b], frame), consumed: true, ...(b.gameBuff ? { gameBuff: b.gameBuff } : {}) }])).values());
      }
      const value = costs.kind === "battle" ? 0.15 + 0.15 * n : 0.1 + 0.1 * n;
      const lastHit = Math.max(frame, ...pending.map((h) => h.frame));
      const link: ActiveBuff = { id: "link", owner: operator, target: "self", appliedAt: frame, expiresAt: lastHit + 1, cast: castIndex, modifiers: [{ zone: "multiplicative", value, source: `Link (${n})` }] };
      next = { ...next, link: [], buffs: [...next.buffs, link] };
    } else if (live.length !== next.link.length) next = { ...next, link: live };
  }
  // Buffs this cast consumes (Jade Vessel's, …) now act on its hits only, until its last hit.
  const consumedBuffs = next.buffs.filter((b) => b.cast === undefined && b.consumedBy?.includes(costs.kind) && reaches(b, operator) && b.appliedAt <= frame && b.expiresAt > frame);
  if (consumedBuffs.length) {
    const lastHit = Math.max(frame, ...pending.map((h) => h.frame));
    next = { ...next, buffs: [...next.buffs.filter((b) => !consumedBuffs.includes(b)), ...consumedBuffs.map((b) => ({ ...b, cast: castIndex, appliedAt: frame, expiresAt: lastHit + 1 }))] };
  }
  // A conditional jump reads the situation at the cast, the enemy's state included (Arclight's battle skill on an Electrified target).
  const planned = castJumps(full.timing, skill, evalContext(ctx.data, ctx.builds.get(operator) as Build, panel, skill.skillId, { ...situationAt(ctx, operator, s, frame), ...castSituation }), operator, castIndex, frame, scaled);
  const cast: TimelineState = {
    ...next,
    sp: s.sp - costs.spCost,
    spPausedUntil: costs.spCost > 0 ? frame + SP.pauseAfterSpendFrames : s.spPausedUntil,
    acting: beside ? s.acting : { ...s.acting, [operator]: { skill: skillId, frame, cast: castIndex, ...(speed !== 1 ? { speed } : {}) } },
    pendingJumps: beside ? next.pendingJumps : [...next.pendingJumps, ...planned],
    ...(full.timing.specification === 8 ? { stagger: { ...s.stagger, finisherUsed: true } } : {}),
    chainNext: beside ? next.chainNext : chainAfter(ctx, next, operator, skill, frame, speed),
    readyAt: castCooldowns(ctx, next.readyAt, operator, skill, costs.cooldownFrames, frame),
    ...(skill.takesControl ? { controlled: operator } : {}),
    pending: [...s.pending, ...pending],
    stacks,
    casts: [...s.casts, { frame, operator, skill: skillId, spAfter: s.sp - costs.spCost, energyAfter: next.energy[operator] ?? 0 }],
  };
  const castEvent: BattleEvent = {
    type: "cast", frame, operator, skillId, kind: costs.kind, finisher: full.timing.specification === 8, controlled: s.controlled === operator, cast: castIndex,
    ...(windowCount !== undefined ? { count: windowCount } : {}), ...(followUp ? { followUp: true } : {}),
  };
  const endedEvents: BattleEvent[] = [...new Map(consumedBuffs.map((b) => [`${b.owner}:${b.id}`, { type: "buffEnded" as const, frame, operator: b.owner, buff: b.id, remaining: remainingOf([b], frame), consumed: true, ...(b.gameBuff ? { gameBuff: b.gameBuff } : {}) }])).values()];
  return { state: slowDown(ctx, cast, operator, { ...costs.timing, slowdowns: plannedSlowdowns(costs.timing, planned) }, frame), events: [...endsNowEvents, castEvent, ...endedEvents, ...linkEnded], origin: { operator, kind: costs.kind } };
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

/** How a rotation's total damage varies over battles with rolled crits. */
export interface RunSpread {
  readonly runs: number;
  /** The first run's seed; run i has seed + i. */
  readonly seed: number;
  readonly totals: readonly number[];
  readonly mean: number;
  /** Standard deviation of the totals (over the runs, not an estimate of the population's). */
  readonly sd: number;
  readonly min: number;
  readonly max: number;
  /** Nearest-rank percentiles of the totals. */
  readonly p5: number;
  readonly p50: number;
  readonly p95: number;
}

/** Runs a recorded rotation `runs` times with rolled crits, each with its own seed, for the spread of its damage. */
export function simulateRuns(data: GameData, scenario: TimelineScenario, runs: number, seed = scenario.options.seed ?? 1): RunSpread {
  if (!Number.isInteger(runs) || runs < 1) throw new EngineError(`runs must be a whole number ≥ 1, not ${runs}`);
  const totals = Array.from({ length: runs }, (_, i) => simulate(data, { ...scenario, options: { ...scenario.options, crit: "rolled", seed: (seed + i) >>> 0 } }).total);
  const mean = totals.reduce((a, b) => a + b, 0) / runs;
  const sorted = [...totals].sort((a, b) => a - b);
  const rank = (p: number) => sorted[Math.max(0, Math.ceil(p * runs) - 1)] as number;
  return {
    runs, seed, totals, mean,
    sd: Math.sqrt(totals.reduce((a, t) => a + (t - mean) ** 2, 0) / runs),
    min: sorted[0] as number, max: sorted[runs - 1] as number,
    p5: rank(0.05), p50: rank(0.5), p95: rank(0.95),
  };
}
