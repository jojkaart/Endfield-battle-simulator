// The timeline's data: the scenario it runs, its context (the build stage) and its state, all plain data.

import type { Element, SkillType } from "../attributes.ts";
import type { Build } from "../build.ts";
import type { CritMode, DamageOptions, DamageTarget, HitDamage } from "../damage.ts";
import type { Modifier } from "../effects.ts";
import type { EnemyData, EventSource, GameData, KitHit, KitSkill, OperatorKit, SpKind } from "../model.ts";
import type { BattleEvent } from "../events.ts";
import type { Predicate } from "../expr.ts";
import type { ActiveBuff } from "../buffs.ts";
import type { StatPanel } from "../stats.ts";
import type { EnemyStatus, StatusEvent } from "../status.ts";
import type { ArtsElement, ReactionKind } from "../reactions.ts";

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
  /**
   * A logged fight's crits (the log check's replay only; no scenario file sets it): a kit hit of `operator` with
   * `event` among its events landing at `frame` (±1) crits as the log says, whatever `options.crit` says, and its
   * hit event says so to crit triggers. Its LandedHit records whether the log decided it (`loggedCrit`).
   */
  readonly loggedCrits?: readonly { readonly operator: string; readonly event: string; readonly frame: number; readonly crit: boolean }[];
  /**
   * A logged fight's effects no kit models (the log check's simulation of the logged casts only): a kit hit of
   * `operator` with `event` among its events landing at `frame` (±1) takes these modifiers on top of the timeline's.
   */
  readonly loggedModifiers?: readonly { readonly operator: string; readonly event: string; readonly frame: number; readonly modifiers: readonly Modifier[] }[];
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

/**
 * The clock a scheduled item runs on (docs/design.md "Time"): a slow-down or freeze that stops that clock delays it
 * (clock.ts). `world`: everything but the operators (nothing scheduled runs on it today); `enemy`: the enemy's own
 * (its actions, Arts Bursts), which a freeze stops too; an operator's: its casts' hits, delayed actions, team
 * energy and jumps.
 */
export type Clock = "world" | "enemy" | { readonly operator: string };

/** A cast: its operator and its index in the cast list (TimelineState.casts). */
export interface CastRef {
  readonly operator: string;
  readonly index: number;
}

/**
 * What every scheduled item has (TimelineState.scheduled): when it's due, on which clock, and what it belongs to, so a
 * slow-down shifts, an interrupt cancels and a jump moves every kind of item in one pass (schedule.ts).
 */
export interface ScheduledHeader {
  readonly frame: number;
  readonly clock: Clock;
  /** The cast it belongs to: ending the cast early drops it, a jump on the cast's timeline drops or moves it (castBound). */
  readonly cast?: CastRef;
  /**
   * It goes on when its cast is cut short (a projectile or entity already on its way: KitHit.detached, a detached
   * KitTrigger, a detached team-energy part), from `launchAt` on when that's set (KitHit.launch, KitTrigger.launch: the
   * cast's own until then).
   */
  readonly detached?: true;
  readonly launchAt?: number;
  /** It stays at its frame whatever its clock or cast does (a replayed landing at its logged frame: the log's time has the slow-downs and jumps in already). */
  readonly pinned?: true;
}

/** A hit on its way: it lands at its frame (landing.ts landHit). */
export interface PendingHit extends ScheduledHeader {
  readonly kind: "hit";
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
  /** A periodic hit with an ATK snapshot (KitHit.atkSnapshot): its owner's attacker-side modifiers when the ticking buff was applied. */
  readonly snapshot?: readonly Modifier[];
  /** A replayed landing's reference (replayCast `landings`): its LandedHit carries it, with the facts it was computed on. */
  readonly ref?: string;
}

/**
 * A trigger's actions due later (KitTrigger.delay), with the event that started them. Its `cast`: the cast they belong
 * to (a cast trigger's), dropped when it's cut short; a detached cast trigger's with its launch (KitTrigger.launch).
 */
export interface PendingAction extends ScheduledHeader {
  readonly kind: "action";
  readonly owner: string;
  readonly trigger: string;
  readonly event: BattleEvent;
  readonly origin: Origin | null;
  /** A cast waits for it (KitTrigger.awaited: timing.ts ownHitsLanded). */
  readonly awaited?: boolean;
  /** It runs after its frame's hits (KitTrigger.afterHits). */
  readonly afterHits?: boolean;
}

/** Ultimate energy given later than its cast (a battle skill's team energy at its data frames, KitSkill.teamEnergy): `if` judged for the caster at the frame. */
export interface PendingEnergy extends ScheduledHeader {
  readonly kind: "energy";
  readonly cast: CastRef;
  /** Who gains it. */
  readonly operator: string;
  readonly amount: number;
  readonly if?: Predicate;
}

/**
 * A jump (or, with `end`, the action's own end) at a real frame of an
 * operator's cast, in its skill frames; or, with `then`, a dive's next
 * part (jumpToDive): the operator casts `then` at that frame, and with
 * `landing`, its landing follows the fall (`from` and `to` are 0).
 */
export interface PendingJump extends ScheduledHeader {
  readonly kind: "jump";
  readonly cast: CastRef;
  readonly operator: string;
  readonly from: number;
  readonly to: number;
  readonly end?: true;
  readonly then?: string;
  readonly landing?: string;
}

/** An Arts Burst on its way (BattleConstants.burstDelayFrames after its infliction, on the enemy's clock): it lands, deals its damage and is a `burst` event at its frame. */
export interface PendingBurst extends ScheduledHeader {
  readonly kind: "burst";
  /** The burst, without its frame (the item's: landBurst). */
  readonly event: Omit<Extract<StatusEvent, { kind: "burst" }>, "frame">;
  /** The kind of the hit that caused it, and its cast's index (for the burst's events: not a CastRef, an interrupt doesn't stop a burst). */
  readonly fromKind: SkillType | "none";
  readonly fromCast?: number;
}

/** One of the enemy's actions (TimelineScenario.enemyActions), on its clock. */
export interface PendingEnemyAction extends ScheduledHeader {
  readonly kind: "enemyAction";
  readonly act: EnemyActionSpec["kind"];
  readonly target: string;
  readonly element: Element;
}

/** Everything due at a later frame (TimelineState.scheduled); advance.ts runs them in the order of docs/design.md "Order within a frame". */
export type Scheduled = PendingHit | PendingAction | PendingEnergy | PendingJump | PendingBurst | PendingEnemyAction;

export interface Cast {
  readonly frame: number;
  readonly operator: string;
  readonly skill: string;
  readonly spAfter: number;
  /** The caster's ultimate energy after the cast. */
  readonly energyAfter: number;
  /** Link stacks the cast used (a battle skill or ultimate; absent: none). */
  readonly link?: number;
}

export interface LandedHit extends HitDamage {
  readonly frame: number;
  readonly operator: string;
  /** Fixed DMG (KitHit.fixedDamage): recording buffs don't record it. */
  readonly fixed?: true;
  /** A replayed landing's reference (replayCast `landings` ref), and what its values read as it landed. */
  readonly ref?: string;
  readonly facts?: LandingFacts;
  /** With TimelineScenario.loggedCrits: the crit the log gives this kit hit's landing, or null when the log doesn't say (not set otherwise). */
  readonly loggedCrit?: boolean | null;
  /** With TimelineScenario.loggedCrits (a replayed fight): what its damage was computed from (landing.ts landingDamage), so the log check computes it again, with a change, through the same path. */
  readonly inputs?: LandingInputs;
}

/**
 * The damage path's arguments of a landing (LandedHit.inputs): a kit hit's (computeHit) or a status event's
 * (computeReaction, and the scale a Combustion tick or a physical status multiplies it by). `options` are the
 * timeline's own at the landing (damageOptions: its modifiers with their sources, Stagger, the situation).
 */
export type LandingInputs =
  | { readonly kind: "hit"; readonly operator: string; readonly build: Build; readonly panel: StatPanel; readonly skill: Pick<KitSkill, "skillId">; readonly hit: KitHit; readonly options: DamageOptions }
  | {
      readonly kind: "status";
      readonly operator: string;
      readonly build: Build;
      readonly panel: StatPanel;
      readonly reaction: { readonly kind: ReactionKind; readonly element: Element; readonly stacks: number };
      readonly options: DamageOptions;
      readonly scale?: { readonly key: string; readonly value: number };
    };

/**
 * What a landing's values and conditions read (the situation its damage was computed on), as data: its operator's
 * stacks and the enemy's state before its own applications, the infliction stacks those consumed, its combo
 * window's event count, the Link stacks its cast used, who was controlled at its cast, the layers of its operator's
 * own active buffs (by kit buff), whether the enemy was Staggered and its HP fraction. Recorded for replayed landings
 * (the log check reads them instead of trying every count: cli logcheck.ts).
 */
export interface LandingFacts {
  readonly stacks: Readonly<Record<string, number>>;
  readonly enemy: EnemyStatus;
  readonly consumed: number;
  readonly eventCount?: number;
  readonly castLink: number;
  readonly controlled: string;
  readonly buffLayers: Readonly<Record<string, number>>;
  readonly staggered: boolean;
  readonly enemyHp: number;
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
  /**
   * Per operator with a combo trigger: the open combo window, if any; a
   * window of its own skills (an `openCombo` with `skills`) is under
   * `<operator>>skillId` (windowKey). `whileBuff`: open only while that
   * buff of the operator is active.
   */
  readonly comboWindow: Readonly<Record<string, { readonly from: number; readonly until: number; readonly count: number; readonly source?: EventSource; readonly whileBuff?: string }>>;
  /** Frame until which SP doesn't regenerate (after a spend: SP.pauseAfterSpendFrames). */
  readonly spPausedUntil: number;
  /**
   * Frames [from, until) in which SP doesn't regenerate either: the world's clock stands still (slow-downs, shiftWorld).
   * Disjoint and in order; those over by the state's frame are dropped as it advances.
   */
  readonly spStops: readonly { readonly from: number; readonly until: number }[];
  readonly controlled: string;
  /** Per operator: its current (last) action, which gates its next one (actionGate); `skips`: the jumps it took (actionFrame). */
  readonly acting: Readonly<Record<string, Acting>>;
  /**
   * Per operator: the basic-attack chain's next step and when an attack input
   * resolves to it; `alternatives`, other steps by timing in later windows
   * (Fluorite's attack3: attack4 in 18–24, attack4_1 in 24–30).
   */
  readonly chainNext: Readonly<Record<string, ChainStep & { readonly alternatives?: readonly ChainStep[] }>>;
  /** Per skill ID: frame from which it's off cooldown (a combo cooldown run at a recovery rate may end within a frame: ready from the next whole one). */
  readonly readyAt: Readonly<Record<string, number>>;
  /**
   * Everything due later, in the order it was scheduled (Scheduled: hits on their way, delayed trigger actions, team
   * energy, jumps on casts' timelines, Arts Bursts, the enemy's actions); advance runs them in the order of
   * docs/design.md "Order within a frame".
   */
  readonly scheduled: readonly Scheduled[];
  /** The team's Link stacks (combo casts leave one each, 15 s): their expiry frames. */
  readonly link: readonly number[];
  /** Until when a control status (Si's Immobilization) freezes the enemy's own clock. */
  readonly enemyFrozenUntil: number;
  /** The enemy's stagger: its stagger HP left, until when it's Staggered, and whether this stagger's finisher is used. */
  readonly stagger: { readonly poise: number; readonly until: number | null; readonly finisherUsed: boolean };
  /** Global time slow-downs (an ultimate's time stop, a combo's slow-down) still running or to come: per frame from `start`, all but `exempt` (the caster). */
  readonly slowdowns: readonly { readonly start: number; readonly scales: readonly number[]; readonly exempt: string }[];
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
  /** Per operator: its stat panel at the fight's start (with its food buff: Build.food); panelAt gives the one at a frame. */
  readonly panels: ReadonlyMap<string, StatPanel>;
  /** Per operator with a food buff: the frame it ends (its duration from the fight's start), and the panel without it from then on. */
  readonly foodEnds?: ReadonlyMap<string, { readonly frame: number; readonly panel: StatPanel }>;
  /** Per operator: the scenario's extra modifiers (not the panel's own; the damage pipeline adds those). */
  readonly modifiers: ReadonlyMap<string, readonly Modifier[]>;
  /** Per operator: its kit with what it wears (triggers.ts effectiveKit). */
  readonly kits: ReadonlyMap<string, OperatorKit>;
  /** Whether any kit has a trigger that acts before its hit's damage (KitTrigger.beforeDamage). */
  readonly beforeDamage: boolean;
  /** Whether any kit buff changes a combo cooldown's recovery rate (attribute 93), so cooldowns follow buffs over time. */
  readonly comboRates?: boolean;
  /** Whether any kit buff changes skills' SP cost (attribute 45), so costs are judged on the buffs at the start frame. */
  readonly costBuffs?: boolean;
  /** Whether any kit buff maps the basic-attack input (KitBuff.basicAttack). */
  readonly inputBuffs?: boolean;
  /** The scenario's enemy (TimelineScenario.target). */
  readonly enemy: EnemyData;
  /** Per arts element: frames from an infliction to its Arts Burst (BattleConstants.burstDelayFrames). */
  readonly burstDelayFrames: Readonly<Record<ArtsElement, number>>;
  /** Per operator: the combo-kind skills an `openCombo` with `skills` names, each using only a window of its own (timing.ts windowKey). */
  readonly ownWindows: ReadonlyMap<string, ReadonlySet<string>>;
  /** With `memoised`: `advance`'s results per state object and frame (exact: advance is pure and states are never changed in place). */
  readonly advanceMemo?: WeakMap<TimelineState, Map<number, TimelineState>>;
  /** With `memoised`: each state's committed damage (search.ts committedDamage), on the same grounds. */
  readonly committedMemo?: WeakMap<TimelineState, number>;
  /** TimelineScenario.loggedCrits by `operator|event`: the logged landings' frames and crits. */
  readonly loggedCrits?: ReadonlyMap<string, readonly { readonly frame: number; readonly crit: boolean }[]>;
  /** TimelineScenario.loggedModifiers by `operator|event`. */
  readonly loggedModifiers?: ReadonlyMap<string, readonly { readonly frame: number; readonly modifiers: readonly Modifier[] }[]>;
}

/** An operator's current action. */
export interface Acting {
  readonly skill: string;
  readonly frame: number;
  readonly speed?: number;
  readonly cast?: number;
  /** Jumps it took: from skill frame `from` to `to`, at real frame `at`, `length` real frames skipped. */
  readonly skips?: readonly { readonly from: number; readonly to: number; readonly at: number; readonly length: number }[];
  /** Its conditional windows (indexes in SkillTiming.windows) whose kit condition held at the cast (KitSkill.windows). */
  readonly windows?: readonly number[];
}

/** A basic-attack chain step and the frames in which an attack input resolves to it. */
export interface ChainStep {
  readonly skill: string;
  readonly from: number;
  readonly until: number;
}

export type Stacks = TimelineState["stacks"];

/** What started a chain of events: an operator's own combo hits don't open its own combo window. */
export interface Origin {
  readonly operator: string;
  readonly kind: SkillType | "none";
}
