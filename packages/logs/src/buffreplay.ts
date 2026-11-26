// The kit-buff replay of a logged fight (owner, 2026-10-22: "our engine
// should not rely on the log data for activating buffs. It should activate
// them based on the events that should trigger them."). The logged casts
// (logcasts.ts: operator, skill, start) are cast again in the engine's
// timeline at their logged frames, their logged landings at the logged
// frames (timeline/drivers.ts replayCast); their hits, the enemy's statuses, SP and
// the kits' triggers then run as in a simulation, and the instances of the
// kit buffs that stand for a game buff (KitBuff.gameBuff) are read off the
// timeline's state. The log check (logcheck.ts) takes their activity instead
// of the log's listing for the buffs the replay decides, and reports where
// the two disagree (leads: a log gap, or a kit trigger that's wrong).
//
// This file: replayKitBuffs (the replay's passes and its BuffReplay answers: landing, castFacts, instances) and the
// BuffReplay interface. Its parts (split by improvement round 14, a move only): castassembly.ts the casts it makes
// (assembleCasts and its passes, replayedCasts, withLoggedCasts, loggedCastFates), replayrun.ts one run (replayOnce,
// makeCast, replayedSkill, inferredPress, missedCasts, tailCuts, landingWatch, loggedEnemyHp), holdinputs.ts what
// holds its timers to the log (loggedTick, heldTicks, loggedLaneEnds, heldToLoggedEnds, runBounds), replaycrits.ts the
// crits the log leaves out (shownCrits, layerCrits, valueCrits), replayedhits.ts what it makes of the logged hits
// (replayedHits, disagreementRuns). A doc citing "buffreplay.ts <function>" from before the split: the function's
// file is the one named here.

import {
  activeAt, advance, allActions, ENGINE_ASSUMPTIONS, LINK_FRAMES, skillCosts, spAt, spCostAt, kitHitEntries, parseReactionEvent, effectiveKit, FPS, reaches,
  type GameData, type KitHit, type LandedHit, type Modifier, type OperatorKit, type ReactionRecord, type SkillType, type TimelineScenario, type TimelineState,
} from "@efsim/engine";
import type { LogFixture, LogHit } from "./zmdlogs.ts";
import { isRecordedBurst } from "./recordedburst.ts";
import type { LoggedCast, Placement } from "./logcasts.ts";
import { loggedStagger } from "./replaysteps.ts";
import { REPLAY_EDGE_MS, type AppliedStop, type BuffTrace, type Change, type KitWindow, type StatusTrace, type TriggerTrace } from "./replayrecord.ts";
import { comboHoldSpans, placeHolds, withoutGaps, statusBounds, statusLanes, tickBounds, type ClockWhy, type HoldBound, type PlacedHolds } from "./holds.ts";
import { type ReplayedCast, assembleCasts, batchedFrame, controlledFromLog, frameOf, listedWithValues, pullingPresses, replayedCasts, replayStops } from "./castassembly.ts";
import { HIDDEN_HOLD_SHARE, type LoggedLaneEnds, type TickEvents, consumedStatuses, endFollowsTick, heldTicks, heldToLoggedEnds, loggedLaneEnds, loggedPurges, loggedTickFrames, loggedTickLandings, msOfFrame, purgedByLog, runBounds, statusInstances } from "./holdinputs.ts";
import { type CritSource, buffDecidability, critTriggers, layerCrits, shownCrits, valueCrits } from "./replaycrits.ts";
import { type CastFlag, type ConsumedBuffs, type JumpDrop, MISSED_ROUNDS, type MissedCast, type ReplayInput, type SkippedCast, TAIL_CUT_ROUNDS, loggedEnemyHp, makeCast, missedCasts, replayOnce, tailCuts } from "./replayrun.ts";
import { NO_LANDING } from "./replaykeys.ts";
import { awayWindows } from "./enginecheck.ts";

/** How far (frames) a landing a trigger made may be from a logged hit it is taken for (its trigger's own timing drifts from the log's). */
const NEAR_FRAMES = 16;
/** The same for a recorded burst (Si's Artful Intent: one per record, at most one in 20 s), whose record's end can be the replay's own. */
const RECORDED_NEAR_FRAMES = 60;

/** Whether two conditions are each other's complement: X and {not: X}, or a stack's `atLeast a` and `below a`. */
function complementary(a: unknown, b: unknown): boolean {
  const j = (x: unknown) => JSON.stringify(x);
  const not = (x: unknown) => (typeof x === "object" && x !== null && "not" in x ? (x as { not: unknown }).not : undefined);
  if (a === undefined || b === undefined) return false;
  if (j(not(a)) === j(b) || j(not(b)) === j(a)) return true;
  const range = (x: unknown) => (typeof x === "object" && x !== null && "stack" in x ? (x as { stack: unknown; atLeast?: unknown; below?: unknown }) : null);
  const [x, y] = [range(a), range(b)];
  if (!x || !y || x.stack !== y.stack || Object.keys(x).length !== 2 || Object.keys(y).length !== 2) return false;
  return (x.atLeast !== undefined && x.atLeast === y.below) || (y.atLeast !== undefined && y.atLeast === x.below);
}

/**
 * A trigger's hits whose actions are alternatives (two `hits` actions of one trigger under complementary conditions:
 * Si's Artful Intent burst through the Inksoul or as the mark, Typhoeus's arrow rain's sub1 / sub2, Last Rite's
 * phantom controlled or not), each with the events of both: one landing, by one path or the other, so a logged hit of
 * one path takes the replay's landing of the other (c779 60.37 s: the log's burst through an Inksoul the replay
 * hadn't, which landed the mark's; the damage is the record's either way).
 */
function alternativeEvents(kit: OperatorKit): ReadonlyMap<KitHit, readonly string[]> {
  const out = new Map<KitHit, readonly string[]>();
  for (const t of kit.triggers) {
    const actions = allActions(t.do).filter((a): a is Extract<typeof a, { kind: "hits" }> => a.kind === "hits");
    for (const a of actions)
      for (const b of actions) {
        if (a === b || !complementary((a as { if?: unknown }).if, (b as { if?: unknown }).if)) continue;
        const events = [...new Set([...a.hits, ...b.hits].flatMap((h) => h.events))];
        for (const h of a.hits) out.set(h, [...new Set([...(out.get(h) ?? h.events), ...events])]);
      }
  }
  return out;
}

export interface BuffReplay {
  /** The readings of open assumptions it replayed under (ReplayOptions.assume; none: every default). */
  readonly assume: Readonly<Record<string, string>>;
  /** Game buffs the replay decides, each with the team's kit buffs that stand for it (`operator:kit buff`). */
  readonly decided: ReadonlyMap<string, readonly string[]>;
  /** Game buffs a kit defines and the log lists that the replay can't decide, and why. */
  readonly undecided: ReadonlyMap<string, string>;
  /** Logged casts the engine couldn't cast (its error). */
  readonly failed: readonly { readonly cast: ReplayedCast; readonly error: string }[];
  /**
   * Casts that hit nothing the replay added (missedCasts: an assumption the log can't show): the skill each was made as,
   * its start in ms, and the logged cast that needs it.
   */
  readonly missed: readonly MissedCast[];
  /** Replayed instances of a decided game buff reaching a logged hit's operator (or on the enemy) at it; null near a change (REPLAY_EDGE_MS). */
  instances(hit: Pick<LogHit, "t" | "operator">, gameBuff: string): number | null;
  /** What the replay knows of a logged cast (placed: logcasts.ts), or why it knows nothing. */
  castFacts(cast: Pick<LoggedCast, "operator" | "skillId" | "start" | "kind">): ReplayCastFacts | { readonly unknown: string };
  /** A logged hit's landing in the replay (its damage, modifiers and LandingFacts), or why there is none. */
  landing(hit: LogHit): LandedHit | { readonly unknown: string };
  /**
   * Why a logged hit's pinned landing never landed (landingWatch: the step that dropped it and its likeliest cause, or
   * why it was never pinned), or null: it landed, or it had no pinned landing. `landing`'s "a landing the replay didn't
   * land" stays the verdicts' reason; this is the views' (NOLAND).
   */
  droppedLanding(hit: LogHit): string | null;
  /** The logged casts the replay didn't make, and why (a tick, a slot's variant, its energy or state, …): SKIP lines. */
  readonly skipped: readonly SkippedCast[];
  /** The casts ended after their last logged landing (engine assumption unlogged-tails `cut`: tailCuts), at that frame: TAILCUT lines. */
  readonly tailCuts: readonly { readonly cast: ReplayedCast; readonly frame: number }[];
  /**
   * Presses the log shows no hit of that the replay made from the listing (engine assumption hitless-presses
   * `inferred`: inferredPress), by their index in the timeline's casts, and why: their own landings stand for no damage
   * the game dealt (the log would show it), so the totals leave them out.
   */
  readonly inferred: ReadonlyMap<number, string>;
  /**
   * Every cast the replay made (the final run, in order): the assembled cast, the frame and the skill it was made as (a
   * slot's variant, a tick's real cast, an inferred press), its index in the timeline's casts, and why an inferred press
   * was made (`inferred`, as BuffReplay.inferred): the replay's own record of each decision, which the views read
   * (EVENT, INFER, MADE lines; `zmdlogs decisions`) instead of matching again (improvement round 14).
   */
  readonly made: readonly MadeCast[];
  /**
   * Where the crit the replay gave a logged hit's landing comes from (CritSource): the log's flag, or, where the log
   * gives none, which inference made it a logged crit (shownCrits, layerCrits, valueCrits), else none (the landing
   * doesn't crit in the replay the check reads).
   */
  critSource(hit: LogHit): CritSource;
  /**
   * A logged status hit's landing (a burst, reaction, physical status or Combustion tick): the replay's status damage of
   * its operator, kind and element nearest it within NEAR_FRAMES (each landing once), or why there is none.
   */
  statusLanding(hit: LogHit): LandedHit | { readonly unknown: string };
  /**
   * Whether the replay's instances of a kit buff (`owner:id`, every kit buff of the team, KitBuff.gameBuff or not)
   * reaching a logged hit's operator change near the hit (REPLAY_EDGE_MS, and an expiry's REPLAY_EXPIRY_SLACK of its
   * life): its timing could be the replay's, not the game's.
   */
  kitBuffNearChange(hit: Pick<LogHit, "t" | "operator">, kitBuff: string): boolean;
  /**
   * The replay's instances of a kit buff (`owner:id`, not one a cast carries) reaching an operator, as windows in ms
   * (`end` Infinity: never ended; `expired`: it ran out), for the buff timing report (bufftiming.ts). The state is
   * sampled at the logged hits and REPLAY_EDGE_MS either side: an end before it ran out is at the first sample without
   * it. Empty when the replay didn't run.
   */
  kitWindows(kitBuff: string, operator: string): readonly KitWindow[];
  /** Whether the replay's Stagger starts or ends within REPLAY_EDGE_MS of a time (ms). */
  staggerNearChange(t: number): boolean;
  /** Kit buffs (`owner:id`) the replay can't judge, whatever the log lists: a trigger behind them it can't judge (undecidedBuff), and why. */
  readonly unjudgedKitBuffs: ReadonlyMap<string, string>;
  /** Every landing of the replay (its own included: hits the log may not have), for the totals' comparison. */
  readonly hits: readonly LandedHit[];
  /** The replay's status events (reactions, bursts, statuses), and the frames the enemy became Staggered. */
  readonly reactions: readonly ReactionRecord[];
  readonly staggers: readonly number[];
  /** The replay's Stagger windows (frames): where each began and ended (ran out, or ended by a refill or the log's calm hit). */
  readonly staggerSpans: readonly { readonly start: number; readonly end: number }[];
  /**
   * Where the replay held a Stagger the log lists past the engine's own (loggedStaggerSteps; frames): `engineUntil`, the
   * frame the engine's own would have ended, or null where it had none running (it ended earlier, or never began).
   */
  readonly staggerHolds: readonly { readonly frame: number; readonly engineUntil: number | null }[];
  /** Where the log's calm hit (or its bar back up) ended a Stagger the engine's own still had running (frames): `engineUntil`, the frame it would have ended. */
  readonly staggerCuts: readonly { readonly frame: number; readonly engineUntil: number }[];
  /** The frame the replay stopped at, if it couldn't go on (BuffReplay.failed says why). */
  readonly brokenAt: number | null;
  /**
   * Logged casts the replay made against the kit (CastFlag): a skill its kit says isn't available then, or one started
   * inside the operator's running action's uncuttable frames. The replay's state may be wrong from there on.
   */
  readonly castFlags: readonly CastFlag[];
  /** With ReplayOptions.trace: each change of a traced kit buff's instances (start, end moved, gone), step by step. */
  readonly traces: readonly BuffTrace[];
  /** With ReplayOptions.trace `status:<status>` (`status:*` every one): each change of an enemy status, step by step (keyed by status and applier: a hold moves appliedAt). */
  readonly statusTraces: readonly StatusTrace[];
  /** With ReplayOptions.trace `trigger:<owner:id>`: each firing of a kit trigger and each shift of its ready frame, step by step. */
  readonly triggerTraces: readonly TriggerTrace[];
  /**
   * The slow-downs the replay's timeline applied (frames; a reset's cut and a path's ends and jumps in them), beside the
   * stop lists the log tools build for its casts (replayedCastStops): where they differ, the lists aren't the engine's.
   */
  readonly appliedStops: readonly AppliedStop[];
  /** The fight's hidden holds the replay placed (engine assumption hidden-holds, reading `placed`: holds.ts), else null. */
  readonly hiddenHolds: PlacedHolds | null;
  /** With the holds placed: each replayed instance of a kit buff or enemy status, and why it is a clock of them or not (holds.ts ClockWhy; `zmdlogs holds --why`). */
  readonly holdClocks?: readonly ClockWhy[];
  /**
   * With hidden-holds `log` (and `placed`, on top): each instance that reached its expiry, whether the replay kept it to
   * the log's end (heldToLoggedEnds, loggedEndOf) and why (an instance buff, layered, ticking, no run listed past it,
   * too long): the log-end side of `zmdlogs holds --why` (round 8: Xaihi's weapon instance in 5082 fell out silently).
   */
  readonly logEnds: readonly { readonly buff: string; readonly appliedAt: number; readonly end: number | null; readonly why: string }[];
  /**
   * The SP each logged cast lacked in the replay (its cost less the team's SP then; drivers.ts replayCast raises it to the
   * cost silently: docs/open-problems.md "Team SP"), for the casts that lacked any.
   */
  readonly spTopUps: readonly { readonly frame: number; readonly operator: string; readonly skillId: string; readonly sp: number }[];
}

/** A cast the replay made (BuffReplay.made). */
export interface MadeCast {
  readonly cast: ReplayedCast;
  /** The frame it was made at. */
  readonly frame: number;
  /** The skill it was made as (the cast's own skillId, or another the replay chose: replayrun.ts makeCast). */
  readonly skillId: string;
  /** Its index in the timeline's casts. */
  readonly index: number;
  /** A hitless press made from the listing (hitless-presses `inferred`): why. */
  readonly inferred?: string;
  /** The kit jumps its logged landings contradicted, which the engine dropped (JUMPDROP lines). */
  readonly dropped?: readonly JumpDrop[];
  /** The kit jumps it kept with pinned landings in the part they skip, which land beside the jumped-to path (BOTHPATHS lines). */
  readonly keptSkipped?: readonly JumpDrop[];
  /** The Link stacks it used (Cast.link; absent: none): LINK lines. */
  readonly link?: number;
  /**
   * The team's Link stacks gained from its frame to the next cast's (TimelineState.link's new expiries, each at its
   * expiry less LINK_FRAMES): where a stack came from, beside the cast that took it (totals-off report point 1: db87's
   * Link went to a phantom normal_skill, found by a scratch script over the replay's landings).
   */
  readonly linkGained?: readonly { readonly frame: number; readonly n: number }[];
}

/** The Link stacks gained between two states (new expiries in TimelineState.link, by the frame each was gained). */
export function linkGains(before: Pick<TimelineState, "link">, after: Pick<TimelineState, "link">): { frame: number; n: number }[] {
  const left = [...before.link];
  const gained = new Map<number, number>();
  for (const f of after.link) {
    const i = left.indexOf(f);
    if (i >= 0) left.splice(i, 1);
    else gained.set(f - LINK_FRAMES, (gained.get(f - LINK_FRAMES) ?? 0) + 1);
  }
  return [...gained].sort((a, b) => a[0] - b[0]).map(([frame, n]) => ({ frame, n }));
}

/** A fact the replay knows, or why it doesn't (the log check then tries alternatives, labelled with the reason). */
export type Fact<T> = { readonly value: T } | { readonly unknown: string };

/**
 * What the replay knows of one logged cast: facts the log doesn't list, which the log check reads instead of trying
 * alternatives. A fact the replay's own timing could change (a Link stack or a consumable buff starting, ending or
 * used by another cast within REPLAY_EDGE_MS of the cast, as for the kit buffs it decides) is unknown.
 */
export interface ReplayCastFacts {
  /** Its index in the replay's cast list. */
  readonly index: number;
  /** The Link stacks it used (Cast.link; 0: none). */
  readonly link: Fact<number>;
  /** A combo's window count as the replay had it open (unknown when the replay saw no window: replayCast opens one counting 1). */
  readonly windowCount: Fact<number>;
  /** The kit buffs it consumed (KitBuff.consumedBy: they act on its hits only). */
  readonly consumed: Fact<ConsumedBuffs>;
}

/** The facts of a trigger's hits: of no cast (timeline/actions.ts: a trigger's `hits` action lands hits without one). */
const TRIGGERED: ReplayCastFacts = { index: -1, link: { value: 0 }, windowCount: { unknown: "a trigger's hits, of no cast" }, consumed: { value: { buffs: [], modifiers: [] } } };

/** The label of a hit whose reading may rest on an enemy HP the replay doesn't know (unknownFacts). */
export const ENEMY_HP_UNKNOWN = "enemy HP unknown";

/**
 * Facts the replay doesn't know that a team member's kit reads, per operator (backlog after round 11 point 7: Chen
 * Qianyu's P1 and Alesh's P5 were off in every stage fight, read as full HP, found only through a ratio cluster): the
 * enemy's HP where loggedEnemyHp can't tell it (no kill's total, not the data's Max HP) while the operator's kit
 * (weapon and gear included) has an `enemyHpBelow` condition, which the replay then reads as full HP (situation.ts
 * enemyHpAt: 1 before the first entry). A label for the views and the hit records only: the verdicts don't take it (an
 * alternative reading would move them; the backlog keeps that step).
 */
export function unknownFacts(data: GameData, fx: LogFixture, assume: Readonly<Record<string, string>> = {}): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>();
  const hp = loggedEnemyHp(data, fx, assume["enemy-hp"] ?? ENGINE_ASSUMPTIONS.find((a) => a.id === "enemy-hp")?.default ?? "kill");
  if (hp?.length) return out;
  for (const b of fx.team) {
    const kit = effectiveKit(data, b);
    if (kit && JSON.stringify(kit).includes('"enemyHpBelow"')) out.set(b.operator, [`${ENEMY_HP_UNKNOWN}: the replay reads full HP for its kit's enemyHpBelow conditions (no kill's total, not the data's Max HP: loggedEnemyHp)`]);
  }
  return out;
}

export interface ReplayOptions {
  /**
   * Modifiers a logged hit's landing takes on top of the timeline's (TimelineScenario.loggedModifiers): the log's effects
   * no kit models, for the simulation of the logged casts (logcheck.ts simulateLog). Absent: the kits' alone.
   */
  readonly loggedModifiers?: (hit: LogHit) => readonly Modifier[];
  /**
   * Arts reaction levels the log shows where the replay's differ (TimelineScenario.loggedReactionLevels: logcheck.ts
   * loggedReactionLevels finds them), at the replay's own landings of those reactions. Absent: the replay's own.
   */
  readonly reactionLevels?: TimelineScenario["loggedReactionLevels"];
  /**
   * Readings of open assumptions to replay under (TimelineOptions.assume): the kits' and the engine's own
   * (timeline/assumptions.ts, e.g. control-immunity), for measuring a reading on the logs. Absent: the defaults.
   */
  readonly assume?: Readonly<Record<string, string>>;
  /**
   * Kit buffs (`owner:id`) whose instances' expiries to trace step by step (BuffReplay.traces; `zmdlogs replay
   * --trace-buff`), and enemy statuses (`status:<status>`, `status:*`: BuffReplay.statusTraces).
   */
  readonly trace?: readonly string[];
  /**
   * More bounds on the hidden holds (hidden-holds `placed`/`holds`), beside the replay's own clocks: clocks only a reading
   * of the hits' damage shows (logcheck.ts logBuffReplay: Corrosion's ramp steps, rampsteps.ts rampBounds).
   */
  readonly holdBounds?: readonly HoldBound[];
}

export function replayKitBuffs(data: GameData, fx: LogFixture, placement: Placement, opts: ReplayOptions = {}): BuffReplay {
  const listed = listedWithValues(fx);
  const kits = fx.team.flatMap((b) => {
    const k = effectiveKit(data, b);
    return k ? [k] : [];
  });
  // Which kit buffs the replay decides, and why not the others (replaycrits.ts buffDecidability: one place for a reason).
  const { decided, undecided, unjudgedKitBuffs } = buffDecidability(kits, fx, listed);
  const failed: { cast: ReplayedCast; error: string }[] = [];
  const edge = frameOf(REPLAY_EDGE_MS);
  const team = fx.team.map((b) => b.operator);
  // What the replay knows of each cast and logged landing (the log check reads them: castFacts, landing).
  const facts = new Map<ReplayedCast, ReplayCastFacts>();
  const failedCasts = new Set<ReplayedCast>();
  const landed = new Map<string, LandedHit>();
  const kitIds = [...decided].flatMap(([g, defs]) => defs.map((d) => ({ g, owner: d.split(":", 2)[0] as string, id: d.split(":", 2)[1] as string })));
  // Game buffs a trigger on crits is behind (critTriggers): where a landing's crit isn't logged, the replay bounds them.
  const critDependent = new Set(kitIds.filter(({ owner, id }) => critTriggers(kits.find((k) => k.operator === owner) as OperatorKit, id).length > 0).map((x) => x.g));
  const assembled = assembleCasts(data, fx, placement, kits, opts.assume);
  const control = controlledFromLog(placement, assembled);
  const stagger = loggedStagger(fx);
  const logged = control?.casts ?? assembled;
  // With the casts that hit nothing the log needs (missedCasts), added below.
  let casts: readonly ReplayedCast[] = logged;
  // Engine assumption hidden-holds: with `log`, the buffs the log lists past their expiry run on to its end (heldToLoggedEnds).
  const holdsReading = opts.assume?.["hidden-holds"] ?? ENGINE_ASSUMPTIONS.find((a) => a.id === "hidden-holds")?.default;
  const hiddenHolds = holdsReading === "log" || holdsReading === "placed";
  // With `placed` (and `holds`, the placed holds alone), the world holds placed once for every timer (holds.ts), from a first replay without them.
  const placing = holdsReading === "placed" || holdsReading === "holds";
  let worldHolds: readonly { readonly frame: number; readonly frames: number }[] = [];
  let placedHolds: PlacedHolds | null = null;
  // Why each replayed instance is or isn't a clock of the placement (BuffReplay.holdClocks).
  const holdClocks: ClockWhy[] = [];
  const noEnds = (): LoggedLaneEnds => ({ runs: new Map(), hits: [], decided: new Map(), why: new Map() });
  // Placing, the first replay keeps no buff to the log's end: its expiries are the clocks' (runBounds).
  let laneEnds: LoggedLaneEnds = hiddenHolds && !placing ? loggedLaneEnds(fx) : noEnds();
  const clockEnds: LoggedLaneEnds = placing ? loggedLaneEnds(fx) : laneEnds;
  const kitDefs = new Map(kits.flatMap((k) => k.buffs.map((d) => [`${k.operator}:${d.id}`, d] as const)));
  // Engine assumption logged-purges: with `log`, the enemy-side kit buffs end where the log shows the enemy shedding the team's debuffs (purgedByLog).
  const purges = (opts.assume?.["logged-purges"] ?? ENGINE_ASSUMPTIONS.find((a) => a.id === "logged-purges")?.default) === "log" ? loggedPurges(fx) : [];
  const held = (st: TimelineState, frame: number) => purgedByLog(heldToLoggedEnds(heldTicks(st, frame, tickEvents), frame, laneEnds, kitDefs), frame, purges);
  const tickEvents: TickEvents = { events: loggedTickFrames(kits, logged), landings: loggedTickLandings(kits, placement), endFollows: endFollowsTick(kits) };
  const shownByHits = shownCrits(kits, fx, placement);
  const byLayers = new Map([...shownByHits, ...layerCrits(kits, fx, placement, shownByHits)]);
  const byValues = valueCrits(kits, fx, placement, byLayers);
  const shown = new Map([...byLayers, ...byValues]);
  const sampleFrames = [...new Set(fx.hits.flatMap((h) => [frameOf(h.t) - edge, frameOf(h.t), frameOf(h.t) + edge]))].filter((f) => f >= 0).sort((a, b) => a - b);
  const input: ReplayInput = { data, fx, opts, control, kitIds, team, edge, sampleFrames, crits: shown, stagger, hitsInOrder: [...fx.hits].sort((a, b) => a.t - b.t) };
  /** A replay of the casts (by default the logged ones with the missed casts found so far), the holds as placed so far. */
  const run = (crit: "never" | "always", list: readonly ReplayedCast[] = casts) => replayOnce(input, { crit, casts: list, worldHolds, held });
  let main = kits.length > 0 ? run("never") : null;
  // Hitless presses the first replay made from the listing (inferredPress): marked, so the press after one is the
  // variant it pulls (pullingPresses: Si's Initial Stroke after an inferred battle skill), and the replay made again.
  const inferredPresses = new Set(main?.made.filter((m) => m.inferred !== undefined).map((m) => m.c) ?? []);
  if (main && inferredPresses.size) {
    casts = pullingPresses(kits, placement, casts.map((c) => (inferredPresses.has(c) ? { ...c, inferred: true as const } : c)));
    main = run("never");
  }
  // Engine assumption unlogged-tails: with `cut`, a cast whose later landings the log has none of ends after its last
  // logged one (tailCuts), and the replay is made again.
  // The earliest first, the replay made again after each (a cut changes what follows: 0c14's Rossi at 35.40 s takes the
  // Vulnerable stack that her 52.04 s battle skill's follow-up needed), at most TAIL_CUT_ROUNDS.
  const tailsReading = opts.assume?.["unlogged-tails"] ?? ENGINE_ASSUMPTIONS.find((a) => a.id === "unlogged-tails")?.default ?? "kept";
  const cuts = new Map<ReplayedCast, number>();
  for (let round = 0; main && round < TAIL_CUT_ROUNDS; round++) {
    const next = [...tailCuts(main, fx, placement, tailsReading)].sort((a, b) => a[1] - b[1])[0];
    if (!next) break;
    const [cast, frame] = next;
    const cut = { ...cast, cutAt: frame };
    cuts.set(cut, frame);
    casts = casts.map((c) => (c === cast ? cut : c));
    main = run("never");
  }
  if (main && placing) {
    // The holds from the replay without them (its buffs' expiries against the log's runs, the enemy's ticks), then the replay with them.
    // On the replay's own casts' stops, the views' list too (castassembly.ts replayStops): the placed casts' miss an
    // ultimate placed from its cast event. Not a logged event the replay read as a buff's tick (KitBuff.ticksLoggedAs;
    // no cast made): 4d60e7fe92c2's late ultimate_skill events, the end of Zhuang Fangyi's Empyrean 30–35 s after her
    // ultimate, held the world 78 frames each in the hold placement.
    const { stops } = replayStops(data, kits, assembled, main.made.map((m) => m.c));
    const statuses = statusBounds(statusInstances(main.checkpoints, main.st.reactions, main.brokenAt), statusLanes(fx), stops, consumedStatuses(kits), HIDDEN_HOLD_SHARE, holdClocks);
    // Engine assumption stagger-holds: inside the Stagger, holds only at the combos' stops (holds.ts comboHoldSpans).
    const staggerHolds = opts.assume?.["stagger-holds"] ?? ENGINE_ASSUMPTIONS.find((a) => a.id === "stagger-holds")?.default;
    const comboShare = staggerHolds === "combos" ? 0.5 : staggerHolds === "combos-full" ? 1 : 0;
    // Engine assumption pause-holds: with `away`, the away stretches aren't still though a Stagger covers them (holds.ts withoutGaps).
    const pauseHolds = opts.assume?.["pause-holds"] ?? ENGINE_ASSUMPTIONS.find((a) => a.id === "pause-holds")?.default;
    const staggerStill = main.staggerWindows.map((w) => [msOfFrame(w.start), msOfFrame(Number.isFinite(w.end) ? w.end : frameOf(Math.max(0, ...fx.hits.map((h) => h.t))))] as const);
    placedHolds = placeHolds([...runBounds(main.kitInstances, kitDefs, clockEnds, stops, holdClocks), ...statuses, ...tickBounds(fx, stops), ...(opts.holdBounds ?? [])], {
      end: Math.max(0, ...fx.hits.map((h) => h.t)),
      still: pauseHolds === "away" ? withoutGaps(staggerStill, awayWindows(fx)) : staggerStill,
      ...(comboShare > 0 ? { slow: comboHoldSpans(stops, comboShare) } : {}),
    });
    worldHolds = placedHolds.holds;
    if (hiddenHolds) laneEnds = loggedLaneEnds(fx);
    if (worldHolds.length || hiddenHolds) main = run("never");
  }
  // Casts that hit nothing before logged casts the kit allows only after them (missedCasts): the earliest need first, the
  // replay made again with its casts, until no need is left that such casts meet.
  const tried = new Set<ReplayedCast>();
  for (let added = 0; main && added < MISSED_ROUNDS; ) {
    const r = main;
    const need = r.needs.find((n) => !tried.has(n.c));
    if (!need) break;
    tried.add(need.c);
    const shots = missedCasts(r, need, (st, c, f) => makeCast(r.ctx, st, c, f, [...casts, c]), held, fx.hits);
    if (!shots.length) continue;
    casts = [...casts, ...shots].sort((a, b) => a.start - b.start);
    main = run("never");
    added++;
  }
  // The bound for buffs a trigger on crits is behind: only needed where some landing's crit isn't logged.
  // …and for every kit buff a trigger on crits is behind (BuffReplay.kitBuffNearChange: the log check's engine readings).
  const anyCritTrigger = kits.some((k) => k.triggers.some((t) => t.on.event === "hit" && t.on.crit !== undefined));
  const bound = main && (critDependent.size > 0 || anyCritTrigger) && main.st.hits.some((h) => h.loggedCrit === null) ? run("always") : null;
  const brokenAt = main ? (bound?.brokenAt !== null && bound?.brokenAt !== undefined ? Math.min(main.brokenAt ?? Infinity, bound.brokenAt) : main.brokenAt) : null;
  if (main) {
    const { ctx, st, made, checkpoints } = main;
    for (const e of main.castErrors) {
      failed.push(e);
      if (!e.error.startsWith("the replay stops")) failedCasts.add(e.cast);
    }
    for (const h of st.hits) if (h.ref !== undefined) landed.set(h.ref, h);
    // Landings a trigger made (not pinned): each logged hit without a pinned landing takes the nearest of its operator's
    // with its event, within NEAR_FRAMES, in time order (each landing once).
    // A trigger's hit takes its alternatives' events too (alternativeEvents: one landing by one path or the other).
    const eventsOf = new Map(kits.flatMap((k) => {
      const alternatives = alternativeEvents(k);
      return kitHitEntries(k).map((e): [string, readonly string[]] => [`${k.operator}|${e.skillId}|${e.hit.id}`, alternatives.get(e.hit) ?? e.hit.events]);
    }));
    // A recorded burst (Si's Artful Intent) is one landing per record, whatever its path: the replay's record may end
    // later or sooner than the game's (4e36: the log's burst 0.9 s after the replay's), so it looks further.
    const recorded = new Set<string>(kits.flatMap((k) => kitHitEntries(k).filter((e) => isRecordedBurst(e.hit)).map((e) => `${k.operator}|${e.skillId}|${e.hit.id}`)));
    const free = st.hits.filter((h) => h.ref === undefined && (h.facts || recorded.has(`${h.operator}|${h.skillId}|${h.hitId}`)));
    const taken = new Set<LandedHit>();
    for (const [i, h] of [...fx.hits.entries()].sort((a, b) => a[1].t - b[1].t)) {
      if (landed.has(String(i))) continue;
      const f = batchedFrame(casts, h) ?? frameOf(h.t);
      let best: LandedHit | null = null;
      for (const x of free) {
        const k = `${x.operator}|${x.skillId}|${x.hitId}`;
        if (taken.has(x) || x.operator !== h.operator || Math.abs(x.frame - f) > (recorded.has(k) ? RECORDED_NEAR_FRAMES : NEAR_FRAMES) || !eventsOf.get(k)?.includes(h.event)) continue;
        if (!best || Math.abs(x.frame - f) < Math.abs(best.frame - f)) best = x;
      }
      if (best) {
        taken.add(best);
        landed.set(String(i), best);
      }
    }
    /** The replay's state at a frame: its latest step at or before it, advanced (pure). */
    const stateAt = (frame: number): TimelineState => {
      let cp = checkpoints[0] as TimelineState;
      for (const x of checkpoints) if (x.frame <= frame) cp = x;
      return cp.frame === frame ? cp : advance(ctx, cp, frame);
    };
    const linkLive = (x: TimelineState, op: string, frame: number) =>
      x.link.filter((e) => e > frame).length + x.buffs.filter((b) => b.link && b.cast === undefined && reaches(b, op) && activeAt(b, frame)).length;
    const consumable = (x: TimelineState, op: string, kind: SkillType | "none", frame: number) =>
      kind === "none" ? [] : x.buffs.filter((b) => b.cast === undefined && b.consumedBy?.includes(kind) && reaches(b, op) && activeAt(b, frame)).map((b) => b.id).sort();
    /** Whether a cast of this kind consumes a buff of the operator's (own or worn) without a duration (KitBuff.duration absent). */
    const preLogLayers = (op: string, kind: SkillType | "none") =>
      kind !== "none" && kits.some((k) => k.operator === op && k.buffs.some((b) => b.consumedBy?.includes(kind) && b.duration === undefined));
    for (const m of made) {
      const kind = m.c.kind ?? "none";
      const [a, b] = [Math.max(0, m.f - edge), m.f + edge];
      let link: Fact<number> = { value: m.link };
      let consumed: Fact<ConsumedBuffs> = { value: m.consumed };
      if (main.brokenAt !== null && b >= main.brokenAt) [link, consumed] = [{ unknown: NO_LANDING.afterStop }, { unknown: NO_LANDING.afterStop }];
      else {
        // What the cast found is the same REPLAY_EDGE_MS either side of it on the timeline without it (its own time
        // stop would hold back a teammate's delayed grant: 4e5e1390085e, Camille's Link 23 ms after Rossi's ultimate),
        // and no other cast that would use the same uses it meanwhile.
        const [before, after] = [stateAt(a), advance(ctx, m.pre, b)];
        const others = made.filter((o) => o !== m && Math.abs(o.f - m.f) <= edge);
        if (kind === "battle" || kind === "ultimate") {
          const live = [linkLive(before, m.c.operator, a), linkLive(m.pre, m.c.operator, m.f), linkLive(after, m.c.operator, b)].map((n) => Math.min(4, n));
          const rival = others.some((o) => o.c.kind === "battle" || o.c.kind === "ultimate");
          if (live.some((n) => n !== m.link) || (rival && m.link > 0)) link = { unknown: `Link stacks change within ${REPLAY_EDGE_MS} ms of the cast` };
        }
        const ids = JSON.stringify(m.consumed.buffs);
        const sameAround = [consumable(before, m.c.operator, kind, a), consumable(after, m.c.operator, kind, b)].every((x) => JSON.stringify(x) === ids);
        if (!sameAround || (m.consumed.buffs.length > 0 && others.some((o) => o.c.kind === m.c.kind))) consumed = { unknown: `buffs a cast consumes change within ${REPLAY_EDGE_MS} ms of it` };
        // Layers without a duration that the operator's first such cast consumes may come from casts before the log's start
        // (fixtures/zmdlogs-b7b3762d5da8.json: Si's first combo carries three Yinglung's Edge layers, the logged battle skills
        // before it two).
        else if (preLogLayers(m.c.operator, kind) && !made.some((o) => o.f < m.f && o.c.operator === m.c.operator && o.c.kind === m.c.kind)) {
          consumed = { unknown: "layers without a duration casts before the log may have built" };
        }
      }
      facts.set(m.c, { index: m.index, link, consumed, windowCount: m.windowCount !== null ? { value: m.windowCount } : { unknown: "a combo window the replay didn't see open" } });
    }
  }
  const hitIndex = new Map(fx.hits.map((h, i) => [h, i]));
  const broken = (ms: number) => brokenAt !== null && frameOf(ms) >= brokenAt - edge;
  const replayedCast = (c: Pick<LoggedCast, "operator" | "skillId" | "start">) => casts.find((d) => !d.missed && d.operator === c.operator && d.skillId === c.skillId && Math.abs(d.start - c.start) <= 1000);
  const castFacts = (c: Pick<LoggedCast, "operator" | "skillId" | "start" | "kind">): ReplayCastFacts | { unknown: string } => {
    if (kits.length === 0) return { unknown: NO_LANDING.noKit };
    // A trigger's hits (a placed group of kind null) belong to no cast in the timeline: no Link, no consumed buffs.
    if (c.kind === null) return TRIGGERED;
    const d = replayedCast(c);
    if (!d) return { unknown: NO_LANDING.notMade };
    if (failedCasts.has(d)) return { unknown: NO_LANDING.couldNotMake };
    if (broken(d.start)) return { unknown: NO_LANDING.afterStop };
    return facts.get(d) ?? { unknown: NO_LANDING.notReached };
  };
  /** A run's instances of a game buff at an operator at a frame, or null near one of its changes. */
  const countIn = (r: NonNullable<typeof main>, key: string, f: number): number | null => {
    if ((r.changes.get(key) ?? []).some((c) => Math.abs(c.frame - f) <= c.slack)) return null;
    return (r.instances.get(key) ?? []).filter((i) => i.start <= f && f < i.end).length;
  };
  // Status landings matched to the log's status hits: per logged hit, its operator's status damage of its kind and element nearest it.
  const statusLanded = new Map<LogHit, LandedHit>();
  if (main) {
    const free = main.st.hits.filter((h) => h.skillId.startsWith("reaction:"));
    const taken = new Set<LandedHit>();
    for (const h of [...fx.hits].sort((a, b) => a.t - b.t)) {
      const r = parseReactionEvent(h.event);
      if (!r) continue;
      const f = batchedFrame(casts, h) ?? frameOf(h.t);
      let best: LandedHit | null = null;
      for (const x of free) {
        if (taken.has(x) || x.operator !== h.operator || x.skillId !== `reaction:${r.kind}` || x.element !== r.element || Math.abs(x.frame - f) > NEAR_FRAMES) continue;
        if (!best || Math.abs(x.frame - f) < Math.abs(best.frame - f)) best = x;
      }
      if (best) {
        taken.add(best);
        statusLanded.set(h, best);
      }
    }
  }
  const nearIn = (changes: ReadonlyMap<string, readonly Change[]>, key: string, f: number) => (changes.get(key) ?? []).some((c) => Math.abs(c.frame - f) <= c.slack);
  // Why a placed hit has no pinned landing (replayedCasts), made on the first question (droppedLanding).
  let unpinned: Map<string, string> | undefined;
  return {
    assume: opts.assume ?? {},
    decided,
    undecided,
    failed,
    unjudgedKitBuffs,
    missed: (main?.made ?? []).flatMap((m) => (m.c.missed ? [{ operator: m.c.operator, skillId: m.skillId, start: m.c.start, need: { skillId: m.c.missed.skill, start: m.c.missed.at } }] : [])),
    hits: main?.st.hits ?? [],
    reactions: main?.st.reactions ?? [],
    staggers: main ? main.staggerWindows.map((w) => w.start) : [],
    staggerSpans: main ? main.staggerWindows.map((w) => ({ start: w.start, end: w.end })) : [],
    staggerHolds: main?.staggerHolds ?? [],
    staggerCuts: main?.staggerCuts ?? [],
    castFlags: main?.flags ?? [],
    skipped: main?.skipped ?? [],
    tailCuts: [...cuts].map(([cast, frame]) => ({ cast, frame })),
    inferred: new Map((main?.made ?? []).flatMap((m) => (m.inferred !== undefined ? [[m.index, m.inferred] as const] : []))),
    made: (main?.made ?? []).map((m, k, all) => {
      // Gained at the cast and in the advance to the next one (the last one's: to its post state).
      const next = all[k + 1];
      const gained = [...linkGains(m.pre, m.post), ...(next ? linkGains(m.post, next.pre) : [])];
      return { cast: m.c, frame: m.f, skillId: m.skillId, index: m.index, ...(m.inferred !== undefined ? { inferred: m.inferred } : {}), ...(m.dropped ? { dropped: m.dropped } : {}), ...(m.keptSkipped ? { keptSkipped: m.keptSkipped } : {}), ...(m.link > 0 ? { link: m.link } : {}), ...(gained.length ? { linkGained: gained } : {}) };
    }),
    droppedLanding(hit) {
      const i = hitIndex.get(hit);
      if (i === undefined || landed.has(String(i)) || !main) return null;
      const own = main.dropped.get(String(i));
      if (own !== undefined) return own;
      if (!unpinned) replayedCasts(placement, fx, (unpinned = new Map()));
      const why = unpinned.get(String(i));
      return why === undefined ? null : `${why}, and none of the replay's unpinned landings of its event lies within ${NEAR_FRAMES} frames`;
    },
    traces: main?.traces ?? [],
    statusTraces: main?.statusTraces ?? [],
    triggerTraces: main?.triggerTraces ?? [],
    appliedStops: main?.appliedStops ?? [],
    hiddenHolds: placedHolds,
    holdClocks,
    logEnds: [...laneEnds.why].map(([k, why]) => {
      const [owner, id, at] = k.split("|") as [string, string, string];
      return { buff: `${owner}:${id}`, appliedAt: Number(at), end: laneEnds.decided.get(k)?.end ?? null, why };
    }),
    spTopUps: main ? main.made.flatMap((m) => {
      const lack = spCostAt(main.ctx, m.pre, m.c.operator, skillCosts(main.ctx, m.c.operator, m.skillId, m.f), m.f) - spAt(m.pre, m.f);
      return lack > 1e-6 ? [{ frame: m.f, operator: m.c.operator, skillId: m.skillId, sp: lack }] : [];
    }) : [],
    brokenAt,
    statusLanding(hit) {
      const found = statusLanded.get(hit);
      if (found) return found;
      if (kits.length === 0) return { unknown: NO_LANDING.noKit };
      if (broken(hit.t)) return { unknown: NO_LANDING.afterStop };
      return { unknown: NO_LANDING.noStatus };
    },
    kitBuffNearChange(hit, kitBuff) {
      if (!main) return false;
      const f = frameOf(hit.t);
      const key = `${kitBuff}|${hit.operator}`;
      if (nearIn(main.kitChanges, key, f)) return true;
      // Where the landings whose crit the log doesn't give matter (the replay with them critting has other instances), it isn't sure either.
      if (!bound) return false;
      const count = (r: NonNullable<typeof main>) => (r.kitInstances.get(key) ?? []).filter((i) => i.start <= f && f < i.end).length;
      return nearIn(bound.kitChanges, key, f) || count(bound) !== count(main);
    },
    kitWindows(kitBuff, operator) {
      const ms = (f: number) => (Number.isFinite(f) ? (f * 1000) / FPS : f);
      return (main?.kitInstances.get(`${kitBuff}|${operator}`) ?? []).map((i) => ({ start: ms(i.start), end: ms(i.end), expired: i.expired, appliedAt: i.start, ...(i.replaces !== undefined ? { replaces: ms(i.replaces) } : {}) })).sort((x, y) => x.start - y.start);
    },
    staggerNearChange(t) {
      if (!main) return false;
      const f = frameOf(t);
      return main.staggerWindows.some((w) => Math.abs(w.start - f) <= edge || (Number.isFinite(w.end) && Math.abs(w.end - f) <= edge));
    },
    instances(hit, gameBuff) {
      if (!decided.has(gameBuff) || !main) return null;
      const f = frameOf(hit.t);
      if (brokenAt !== null && f >= brokenAt - edge) return null;
      const key = `${gameBuff}|${hit.operator}`;
      const n = countIn(main, key, f);
      // A buff a trigger on crits is behind: decided only where the landings whose crit the log doesn't give don't matter.
      if (n !== null && bound && critDependent.has(gameBuff) && countIn(bound, key, f) !== n) return null;
      return n;
    },
    castFacts,
    critSource(hit) {
      if (hit.crit !== null) return "log";
      const i = hitIndex.get(hit) as number;
      return shownByHits.has(i) ? "shown" : byLayers.has(i) ? "layers" : byValues.has(i) ? "values" : "none";
    },
    landing(hit) {
      const found = landed.get(String(hitIndex.get(hit)));
      if (found) return found;
      if (kits.length === 0) return { unknown: NO_LANDING.noKit };
      if (broken(hit.t)) return { unknown: NO_LANDING.afterStop };
      const p = placement.hits.get(hit);
      if (!p) return { unknown: NO_LANDING.notPlaced };
      const shared = p.sameAs ? landed.get(String(hitIndex.get(p.sameAs))) : undefined;
      if (shared) return shared;
      const c = castFacts(p.cast);
      if ("unknown" in c) return c;
      if (p.frame === undefined) return { unknown: NO_LANDING.noOrder };
      return { unknown: NO_LANDING.notLanded };
    },
  };
}
