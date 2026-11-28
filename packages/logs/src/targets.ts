// Per-target state for a fight against several targets under one enemy id (the fixture's severalTargets), on the log
// check's side only (engine assumption several-targets `targets`; docs/design/data.md "Several targets"): the
// simulation and the replay keep one enemy, and this module says which target each logged hit is on and which of the
// replay's enemy-side instances each target carries, so the check reads a hit with its own target's debuffs. The log
// has no target per hit and lists every target's debuffs under the one id (7b54: two slugs' hits under one listing,
// ×1.198 apart), so the hits' values are the evidence, as they are for a crit the log leaves out: a target's state is
// read from its hits and then held to (an instance it got is kept to its expiry, one it was read without is never
// had later), a kill ends its target only. enginecheck.ts fightTargets builds the inputs (each hit's primary reading)
// and memoizes the assignment per replay; readingBasis drops a hit's units its target lacks, fightTotals counts a
// landing once per target, replayrun.ts and buffreplay.ts read the replay's side (kill gaps with targets left, no
// purge at a kill). The placement (logcasts.ts placeWith) reads batchTargets for which logged hits of a batch are one
// landing's twins; the assignment takes those as one landing reaching each of its targets once.

import { allActions, FPS, readingOf, type KitHit, type LandedHit, type LandingTarget, type Modifier, type OperatorKit, type TimelineState } from "@efsim/engine";
import type { LogCast, LogFixture, LogHit } from "./zmdlogs.ts";

/** Targets alive at once where the fixture doesn't say (severalTargets.atOnce): two, the least that is several. */
export const DEFAULT_AT_ONCE = 2;
/** The most subsets of a hit's open units tried (2^6); past it, none and each one alone. */
const MAX_OPEN_SUBSETS = 64;

/** Whether the check reads the fixture per target: it is marked severalTargets and several-targets reads `targets` (or a variant of it). */
export function readsTargets(fx: Pick<LogFixture, "severalTargets">, assume: Readonly<Record<string, string>> | undefined): boolean {
  return fx.severalTargets !== undefined && readingOf(assume, "several-targets") !== "one";
}

/** Whether the totals count a landing once per target its logged hits are on (several-targets `targets`, not `targets-once`). */
export function landingPerTarget(fx: Pick<LogFixture, "severalTargets">, assume: Readonly<Record<string, string>> | undefined): boolean {
  return readsTargets(fx, assume) && readingOf(assume, "several-targets") !== "targets-once";
}

/** Whether the totals count a landing for a twin on another target whose value fits no target's state (several-targets `targets-ungated`). */
export function landingPerTargetUngated(fx: Pick<LogFixture, "severalTargets">, assume: Readonly<Record<string, string>> | undefined): boolean {
  return landingPerTarget(fx, assume) && readingOf(assume, "several-targets") === "targets-ungated";
}

/** Whether the replay keeps the enemy's statuses per target (target-statuses `per-target`, in a fight read per target): a second pass (logcheck.ts logBuffReplay). */
export function statusesPerTarget(fx: Pick<LogFixture, "severalTargets">, assume: Readonly<Record<string, string>> | undefined): boolean {
  return readsTargets(fx, assume) && readingOf(assume, "target-statuses") === "per-target";
}

/**
 * What the second replay of a fight read per target takes from the first one's assignment (target-statuses
 * `per-target`; enginecheck.ts replayTargets builds it): each kit-hit landing's targets (TimelineScenario
 * .landingTargets: its logged hits' targets, its own hit's first), each logged kill's target (a death of that target:
 * targetDeaths), and the assignment itself, which the check keeps (the replay's target ids are its).
 */
export interface ReplayTargets {
  readonly landings: readonly LandingTarget[];
  readonly kills: ReadonlyMap<LogHit, number>;
  readonly assignment: TargetAssignment;
}

/** Whether a kill gap with targets left keeps the replay's enemy there (several-targets `targets`, not `targets-gaps-away`). */
export function keepsKillGaps(fx: Pick<LogFixture, "severalTargets">, assume: Readonly<Record<string, string>> | undefined): boolean {
  return readsTargets(fx, assume) && readingOf(assume, "several-targets") !== "targets-gaps-away";
}

/** How far apart (of the larger) two values of one target's alike landings at one ms may be (the log rounds each hit; at least 1). */
const SAME_TARGET_VALUE = 0.002;
/** How far (×, either way) a crit's value over a non-crit's on one target may be from the operator's crit factor. */
const SAME_TARGET_CRIT = 1.02;

/** A logged hit of a batch (one operator's key at one ms), as batchTargets reads it: its value (uncapped where capped) and crit. */
export interface BatchHit {
  readonly value: number;
  readonly crit: boolean | null;
}

/**
 * Whether two logged hits of landings alike in multiplier, at one ms, can be on one target by their values: one target's
 * state is one at one ms, so two non-crits (or two crits) on it have one value, a crit and a non-crit values the
 * operator's crit factor apart (the crit's the larger); a hit of unknown crit either.
 */
export function oneTargetByValue(a: BatchHit, b: BatchHit, critFactor: number): boolean {
  const [lo, hi] = a.value <= b.value ? [a, b] : [b, a];
  const equal = hi.value - lo.value <= Math.max(1, SAME_TARGET_VALUE * hi.value);
  const crit = lo.value > 0 && Math.abs(Math.log(hi.value / lo.value / critFactor)) <= Math.log(SAME_TARGET_CRIT);
  if (a.crit !== null && b.crit !== null) return a.crit === b.crit ? equal : crit && hi.crit === true;
  // One of unknown crit: the same state as the other, or the crit of it (the higher one the crit, unless it is the known non-crit).
  return equal || (crit && hi.crit !== false && lo.crit !== true);
}

/**
 * How many targets a batch of one operator's key at one ms stands on (the placement's twins, logcasts.ts placeWith: in a
 * fight against several targets, ZMDLogs logs each landing once per target it reached, the landings of a stop's batch
 * one after another, each with its targets in one order, 7b54 15.60 s: 6040 6569 6040 9853* … = 4 slashes × 2 slugs).
 * The batch is then `targets` hits per landing: hit i and hit i + targets of one target (oneTargetByValue) for every
 * i. `before`: the count an earlier batch of the cast's key read from its values (≥ 2); where it (or the batch's size,
 * if fewer) fits, it holds (a fewer-target batch of equal values: 7b54 47.62 s, two slugs alike in debuffs after three).
 * Else the least count that fits with each target's hits compared at least once (the batch at least two landings
 * long: `values` where above 1), up to atOnce; none fitting, one (`none fits`). A batch of a landing's length alone
 * says nothing by itself: two hits of differing values may be one target's two landings with a debuff between
 * (9c6e 76.36 s: Ardelia's attack 3, 224 and 259, then 259 and a crit 389), so it is one target unless `before` says.
 */
export function batchTargets(hits: readonly BatchHit[], critFactor: number, atOnce: number, before?: number): { readonly targets: number; readonly by: "values" | "before" | "one" | "none fits" } {
  const fits = (k: number) => hits.every((h, i) => i + k >= hits.length || oneTargetByValue(h, hits[i + k] as BatchHit, critFactor));
  if (before !== undefined && before >= 2) {
    const k = Math.min(before, hits.length);
    if (k >= 2 && fits(k)) return { targets: k, by: "before" };
  }
  for (let k = 1; k <= Math.min(atOnce, Math.floor(hits.length / 2)); k++) if (fits(k)) return { targets: k, by: k === 1 ? "one" : "values" };
  return { targets: 1, by: "none fits" };
}

/** How long before a death move's logged landing a logged kill may be and be its death (ms): 6339's and 7b54's come 0.23–0.54 s after one. */
export const MOVE_AFTER_KILL_MS = 1000;

/** A logged landing of a kit trigger's hit on a target's death (TriggerOn `targetDeath`), and the death the replay makes for it. */
export interface DeathMove {
  readonly operator: string;
  readonly trigger: string;
  /** The kit hit's id (its `hits` action's). */
  readonly hitId: string;
  readonly hit: LogHit;
  /** The logged landing's frame, where the replay pins the trigger's landing (engine targetDies `landings`). */
  readonly landing: number;
  /**
   * The death's frame: the logged kill's (a capped hit within MOVE_AFTER_KILL_MS before the landing, and at least the
   * trigger's lead before it: the projectile's travel between, which the data doesn't give), else the landing's less
   * the lead (the trigger's delay and the hit's kit frame).
   */
  readonly frame: number;
  /** The logged kill it follows, if any. */
  readonly kill?: LogHit;
}

/** The hits of a kit's targetDeath triggers, each with its trigger and the frames from the death to its landing. */
function deathHits(kit: OperatorKit): { readonly trigger: string; readonly hit: KitHit; readonly lead: number }[] {
  return kit.triggers.flatMap((t) =>
    t.on.event !== "targetDeath" ? [] : allActions(t.do).flatMap((a) => (a.kind === "hits" ? a.hits.map((hit) => ({ trigger: t.id, hit, lead: (t.delay ?? 0) + Math.min(...(hit.frames ?? [0])) })) : [])),
  );
}

/**
 * The deaths the log shows by what a kit does at them: each logged landing of a targetDeath trigger's hit (its key, its
 * operator) is one, at the logged kill before it (DeathMove.frame) or `lead` frames before it (deathHits); the replay
 * pins the landing at its logged frame. Camille's Vesperwings moving to the next target
 * (vesperwings_move: normal_skill_abilityrange, the battle skill's damage, Heat and debuff on the next slug): 6339 at
 * 19.68, 20.60, 24.56, 29.67 and 32.16 s, 7b54 at 16.59 s; five of the six 0.23–0.54 s after a logged kill (the
 * projectile's travel, which the data doesn't give), 6339's 19.68 s after none (all eight slugs' kills are logged:
 * what ended its target there, a burrow?, is open). A move onto a shielded slug deals 0 and isn't logged, so it isn't
 * read here (7b54's normal_skill event at 19.90 s, 0.31 s after the 19.59 s kill, with no hit).
 */
export function deathMoves(fx: Pick<LogFixture, "hits">, kits: readonly OperatorKit[]): DeathMove[] {
  const out: DeathMove[] = [];
  const frameOf = (ms: number) => Math.round((ms * FPS) / 1000);
  for (const kit of kits) {
    for (const d of deathHits(kit)) {
      for (const h of fx.hits) {
        if (h.operator !== kit.operator || !d.hit.events.includes(h.event)) continue;
        const landing = frameOf(h.t);
        const latest = Math.max(0, landing - d.lead);
        const kill = fx.hits.filter((k) => killed(k) && k.t >= h.t - MOVE_AFTER_KILL_MS && frameOf(k.t) <= latest).at(-1);
        out.push({ operator: kit.operator, trigger: d.trigger, hitId: d.hit.id, hit: h, landing, frame: kill ? frameOf(kill.t) : latest, ...(kill ? { kill } : {}) });
      }
    }
  }
  return out.sort((a, b) => a.frame - b.frame);
}

/** A target's death the replay makes (replayrun.ts, engine targetDies), with the triggers that don't run at it. */
export interface TargetDeath {
  readonly frame: number;
  /** For a trace: the logged kill or move it stands for. */
  readonly why: string;
  /** The death moves landing from it (their logged landings pinned). */
  readonly moves: readonly DeathMove[];
  /** Kit triggers (`owner:triggerId`) that don't run at it (TargetDeathOptions.except). */
  readonly except: ReadonlySet<string>;
  /** The dead target's statuses end with it (target-deaths `statuses`). */
  readonly endsStatuses: boolean;
  /**
   * With the statuses per target (target-statuses `per-target`, ReplayTargets.kills): the target that dies (engine
   * TargetDeathOptions.target: its triggers run on its statuses, which then end). Two kills at one ms are two deaths
   * at one frame, the second running no trigger that lands a hit.
   */
  readonly target?: number;
}

/**
 * The deaths the replay makes (replay assumption target-deaths). `moves` (or a fight not read per target): one at each
 * death move (deathMoves), as the replay made them from 2026-11-27. `kills` and `statuses`, in a fight read per target
 * (readsTargets): one at each logged kill before the log's last ms (two kills at one ms one death: the replay's one
 * enemy), and one at each move no kill is the death of (6339 19.68 s), every kit's targetDeath triggers running there
 * (Laevatain's passive_enemy absorbing the dead target's Heat as Melting Flame), but an operator whose trigger lands a
 * hit (Camille's move) runs its targetDeath triggers only at the deaths its landing is logged from: elsewhere its
 * listener was on another target, or it moved onto a shielded slug, which deals 0 and isn't logged. `statuses`: the dead
 * target's statuses end with it (6339: each Vesperwings move put Heat on a fresh slug, the replay's one enemy holding
 * the dead one's and bursting at 21.60, 25.57 and 33.17 s, which the log never shows).
 */
export function targetDeaths(fx: Pick<LogFixture, "hits" | "severalTargets">, kits: readonly OperatorKit[], assume: Readonly<Record<string, string>> | undefined, killTargets?: ReadonlyMap<LogHit, number>): TargetDeath[] {
  const moves = deathMoves(fx, kits);
  const moveWhy = (m: DeathMove) => `${m.trigger}: its landing logged at ${(m.hit.t / 1000).toFixed(2)} s${m.kill ? `, after the kill at ${(m.kill.t / 1000).toFixed(2)} s` : ""}`;
  const reading = readingOf(assume, "target-deaths");
  if (reading === "moves" || !readsTargets(fx, assume)) return moves.map((m) => ({ frame: m.frame, why: moveWhy(m), moves: moves.filter((x) => x.frame === m.frame), except: new Set<string>(), endsStatuses: false }));
  const frameOf = (ms: number) => Math.round((ms * FPS) / 1000);
  const lastMs = Math.max(...fx.hits.map((h) => h.t));
  const kills = new Map<number, LogHit>();
  for (const h of fx.hits) if (killed(h) && h.t < lastMs && !kills.has(frameOf(h.t))) kills.set(frameOf(h.t), h);
  const frames = [...new Set([...kills.keys(), ...moves.map((m) => m.frame)])].sort((a, b) => a - b);
  // The operators whose targetDeath triggers land a hit, and those triggers' keys.
  const movers = new Map<string, string[]>();
  for (const kit of kits) if (deathHits(kit).length) movers.set(kit.operator, kit.triggers.filter((t) => t.on.event === "targetDeath").map((t) => `${kit.operator}:${t.id}`));
  const allMovers = new Set([...movers.values()].flat());
  return frames.flatMap((frame): TargetDeath[] => {
    const here = moves.filter((m) => m.frame === frame);
    const except = new Set([...movers].flatMap(([op, keys]) => (here.some((m) => m.operator === op) ? [] : keys)));
    const kill = kills.get(frame);
    const why = [...(kill ? [`the kill at ${(kill.t / 1000).toFixed(2)} s`] : []), ...here.map(moveWhy)].join("; ");
    const death: TargetDeath = { frame, why, moves: here, except, endsStatuses: reading === "statuses" };
    // With the statuses per target: one death per target killed at this frame (its target), the moves at the last.
    const dead = killTargets ? [...new Set(fx.hits.filter((h) => killed(h) && h.t < lastMs && frameOf(h.t) === frame).flatMap((h) => (killTargets.has(h) ? [killTargets.get(h) as number] : [])))] : [];
    if (dead.length === 0) return [death];
    return dead.map((target, i) => (i === dead.length - 1 ? { ...death, target } : { ...death, moves: [], except: new Set([...except, ...allMovers]), target }));
  });
}

/**
 * Whether a logged cast event is the log's record of a death move (deathMoves), not a press: at the ms (±1) of one of
 * its operator's moves whose key is the event's skill id with a suffix (the entity's CastSkill logged under the skill:
 * ZMDLogs logs a normal_skill event at four of Camille's six moves, 6339 19.68, 24.55, 29.67 s and 7b54 16.59 s; none
 * of the battle skill's own landings, 0.5–1.0 s after their press, is logged at its event). Made as presses, each gave
 * a replay-only battle-skill landing 0.4 s on (6339 20.10, 24.97, 30.07 s) standing in for the move.
 */
export function moveEvent(moves: readonly DeathMove[], lc: Pick<LogCast, "operator" | "skill" | "t">): DeathMove | undefined {
  return moves.find((m) => m.operator === lc.operator && Math.abs(m.hit.t - lc.t) <= 1 && m.hit.event.startsWith(`${lc.skill}_`));
}

/** The enemy statuses whose modifiers sit on a target (engine status.ts statusModifiers' sources), by kind. */
const STATUS_SOURCE = /^(Corrosion|Electrification|Breach) level /;

/** Whether a modifier is an enemy status's (statusModifiers': Corrosion, Electrification, Breach), not a kit buff's. */
export function isStatusModifier(m: Modifier): boolean {
  return !m.kitBuff && STATUS_SOURCE.test(m.source);
}

/**
 * A modifier's enemy-side unit, or null: a kit buff the team's kits put on the enemy (`owner:id`, its def's target
 * "enemy": Camille's Vesperwings, Si's Jade Vessel, Arcane's Doubles Susceptibility), or an enemy status
 * (`status:corrosion`, `status:electrification`, `status:breach`). The unit is on or off a target whole, its layers
 * and level the replay's.
 */
export function enemyUnit(m: Modifier, enemyKitBuffs: ReadonlySet<string>): string | null {
  if (m.kitBuff) {
    const k = `${m.kitBuff.owner}:${m.kitBuff.id}`;
    return enemyKitBuffs.has(k) ? k : null;
  }
  const s = STATUS_SOURCE.exec(m.source);
  return s ? `status:${(s[1] as string).toLowerCase()}` : null;
}

/** An enemy-side unit of a hit's reading as the replay has it at the landing: its earliest live instance's start and its latest end (frames). */
export interface TargetUnit {
  readonly key: string;
  readonly appliedAt: number;
  readonly expiresAt: number;
}

/** The units of `keys` in the replay's state at a frame (the instances live there; a key without one is taken as applied at the frame). */
export function unitsAt(st: TimelineState | null, frame: number, keys: readonly string[]): TargetUnit[] {
  return keys.map((key) => {
    const live = key.startsWith("status:")
      ? [...(st?.enemy.statuses ?? []), ...(st?.enemy.physical ?? [])].filter((x) => x.status === key.slice("status:".length) && x.expiresAt > frame)
      : (st?.buffs ?? []).filter((x) => x.target === "enemy" && `${x.owner}:${x.id}` === key && x.expiresAt > frame);
    return { key, appliedAt: Math.min(frame, ...live.map((x) => x.appliedAt)), expiresAt: Math.max(frame + 1, ...live.map((x) => x.expiresAt)) };
  });
}

/** What the assignment reads of one logged hit. */
export interface TargetHitInput {
  readonly hit: LogHit;
  /** Its landing in the replay (twins: two logged hits it stands for at one ms are on two targets), or null: none. */
  readonly landing: LandedHit | null;
  /** Its frame (the landing's, else the logged ms's). */
  readonly frame: number;
  readonly units: readonly TargetUnit[];
  /**
   * Whether its primary reading without these units' modifiers fits its value (±1; the uncapped value where capped), on
   * target `target` (the second replay of the statuses per target reads each candidate at its own statuses).
   */
  readonly fits: (drop: ReadonlySet<string>, target: number) => boolean;
}

/** A logged hit's target: its index (in order of first hit), the units its reading leaves out, and how it was chosen. */
export interface HitTarget {
  readonly target: number;
  readonly drop: ReadonlySet<string>;
  /**
   * `fits`: its value fits this target's state (an open unit decided by it, or none); `none fits`: no alive target's
   * state fits it, so it is on the one hit last, read with what that target is known to lack.
   */
  readonly how: "fits" | "none fits";
  /** It killed its target (a capped hit). */
  readonly kills: boolean;
}

export interface TargetAssignment {
  readonly of: ReadonlyMap<LogHit, HitTarget>;
  /** How many targets the fight's hits were put on. */
  readonly count: number;
}

interface Target {
  readonly id: number;
  alive: boolean;
  last: number;
  /** Per unit, the latest instance it got and the frame its hit decided it. */
  readonly got: Map<string, { appliedAt: number; expiresAt: number; at: number }>;
  /** Per unit, the instances (appliedAt) a hit read it without, and the frame of that hit. */
  readonly missed: Map<string, Map<number, number>>;
}

const killed = (h: LogHit) => h.uncapped !== undefined && h.uncapped !== null && h.uncapped > h.value;

/**
 * How assignTargets numbers and pins targets. `fixed`: each hit's target given (the first assignment's). `ids`:
 * `order` (the default), a new target numbered in order of first hit; `landings` (the second replay of the statuses
 * per target, whose landings carry the first assignment's target ids: LandedHit.target and otherTargets), a new target
 * one of the targets its first hit's landing reached that no target has yet (the first that fits, in the landing's
 * order), else an id past every one a landing names: the second assignment's ids are then the replay's, which
 * enginecheck.ts atItsTarget reads a candidate's statuses at (7b54: numbered in order, 147 of 210 hits with both had a
 * target their landing wasn't on, read at another slug's statuses).
 */
export interface AssignOptions {
  readonly fixed?: ReadonlyMap<LogHit, number>;
  readonly ids?: "order" | "landings";
}

/** The targets a landing reached in a replay with the statuses per target (its own first), or none. */
export function landingIds(l: Pick<LandedHit, "target" | "otherTargets"> | null): number[] {
  if (!l || l.target === undefined) return [];
  return [l.target, ...(l.otherTargets ?? []).map((x) => x.target).filter((t) => t !== l.target)];
}

/**
 * Each logged hit's target, in time order. Two logged hits one landing stands for at one ms are on two targets while
 * there are targets for both (one landing reaches each target once); a capped hit kills its target. Otherwise a hit
 * goes to the alive target whose state its value fits: a unit its target got is on to its expiry, one its target was
 * read without (that instance) is off, an open one (an instance the target wasn't read under yet) may be either, and
 * the hit decides each open unit that is on in every fitting choice, or off in every one. The preference: a target
 * that fits with every open unit on, then one that fits by leaving some off, then a new target (while atOnce allows,
 * and with fromStart no more than atOnce in all); among equals the one hit last. Where nothing fits, the one hit last
 * (a new one if none is alive), read with what it is known to lack, decided by nothing. With `fixed` (the second replay
 * of the statuses per target: the first assignment's target of each hit, whose ids the replay's targets have), each hit
 * goes to that target, its units decided there as above, `none fits` where no choice of them fits. With ids `landings`
 * (the second replay's assignment, free), a new target takes the id of a target its landing reached in the replay
 * (AssignOptions.ids), so a candidate's id is the replay's target its statuses are read at.
 */
export function assignTargets(fx: Pick<LogFixture, "severalTargets">, inputs: readonly TargetHitInput[], opts: AssignOptions = {}): TargetAssignment {
  const { fixed, ids } = opts;
  const atOnce = fx.severalTargets?.atOnce ?? DEFAULT_AT_ONCE;
  const fromStart = fx.severalTargets?.fromStart === true;
  const targets: Target[] = [];
  const of = new Map<LogHit, HitTarget>();
  // The targets each landing's logged hits are on, per logged ms.
  const twins = new Map<LandedHit, Map<number, Set<number>>>();
  const order = inputs.map((x, i) => ({ x, i })).sort((a, b) => a.x.hit.t - b.x.hit.t || a.i - b.i);
  // With ids `landings`: past every id a landing names (the replay's targets), for a new target none of its landing's ids is free for.
  let unnamed = ids === "landings" ? Math.max(-1, ...inputs.flatMap((x) => landingIds(x.landing))) + 1 : 0;
  for (const { x } of order) {
    const { hit, landing, frame, units } = x;
    const used = landing ? (twins.get(landing)?.get(hit.t) ?? new Set<number>()) : new Set<number>();
    const alive = targets.filter((t) => t.alive).sort((a, b) => b.last - a.last);
    const canNew = alive.length < atOnce && (!fromStart || targets.length < atOnce);
    const pinned = fixed?.get(hit);
    const newTarget = (id: number): Target => ({ id, alive: true, last: -1, got: new Map(), missed: new Map() });
    // A new target: in order of first hit; with ids `landings`, one per id of its landing's targets no target has yet
    // (each a candidate, read at that target's statuses), else an id no landing names (a target the replay never hit).
    const held = new Set(targets.map((t) => t.id));
    const named = ids === "landings" ? landingIds(landing).filter((id) => !held.has(id)) : [];
    const freshOnes = pinned !== undefined ? [newTarget(pinned)] : ids === "landings" ? (named.length ? named : [unnamed]).map(newTarget) : [newTarget(targets.length)];
    const fresh = freshOnes[0] as Target;
    const own = pinned !== undefined ? targets.find((t) => t.id === pinned) : undefined;
    const candidates = pinned !== undefined ? [own ?? fresh] : [...alive.filter((t) => !used.has(t.id)), ...(canNew ? freshOnes : [])];
    const state = (t: Target) => {
      const off: string[] = [];
      const open: string[] = [];
      for (const u of units) {
        const g = t.got.get(u.key);
        if (g && g.at < frame && (g.appliedAt === u.appliedAt || g.expiresAt > frame)) continue;
        const m = t.missed.get(u.key)?.get(u.appliedAt);
        if (m !== undefined && m < frame) off.push(u.key);
        else open.push(u.key);
      }
      return { off, open };
    };
    let chosen: { t: Target; drop: Set<string>; decided: Map<string, boolean>; cost: number } | null = null;
    for (const t of candidates) {
      const { off, open } = state(t);
      const masks = 1 << open.length <= MAX_OPEN_SUBSETS ? Array.from({ length: 1 << open.length }, (_, m) => m) : [0, ...open.map((_, i) => 1 << i)];
      const fitting = masks.map((m) => new Set([...off, ...open.filter((_, i) => m & (1 << i))])).filter((d) => x.fits(d, t.id)).sort((a, b) => a.size - b.size);
      const best = fitting[0];
      if (!best) continue;
      const decided = new Map<string, boolean>();
      for (const k of open) {
        const n = fitting.filter((d) => d.has(k)).length;
        if (n === 0) decided.set(k, true);
        else if (n === fitting.length) decided.set(k, false);
      }
      const cost = (freshOnes.includes(t) ? 2 : 0) + (best.size > off.length ? 1 : 0);
      if (!chosen || cost < chosen.cost) chosen = { t, drop: best, decided, cost };
    }
    let how: HitTarget["how"] = "fits";
    if (!chosen) {
      how = "none fits";
      const t = candidates.length === 1 && pinned !== undefined ? (candidates[0] as Target) : (alive.find((y) => !used.has(y.id)) ?? (canNew ? fresh : (alive[0] ?? fresh)));
      chosen = { t, drop: new Set(state(t).off), decided: new Map(), cost: Infinity };
    }
    const t = chosen.t;
    if (freshOnes.includes(t)) {
      targets.push(t);
      if (t.id === unnamed) unnamed++;
    }
    for (const u of units) {
      const d = chosen.decided.get(u.key);
      if (d === true) {
        const g = t.got.get(u.key);
        t.got.set(u.key, g && g.appliedAt === u.appliedAt ? { ...g, expiresAt: Math.max(g.expiresAt, u.expiresAt) } : { appliedAt: u.appliedAt, expiresAt: u.expiresAt, at: frame });
      } else if (d === false) {
        const m = t.missed.get(u.key) ?? new Map<number, number>();
        if (!m.has(u.appliedAt)) m.set(u.appliedAt, frame);
        t.missed.set(u.key, m);
      }
    }
    t.last = frame;
    if (landing) {
      const byMs = twins.get(landing) ?? new Map<number, Set<number>>();
      byMs.set(hit.t, new Set([...(byMs.get(hit.t) ?? []), t.id]));
      twins.set(landing, byMs);
    }
    const kills = killed(hit);
    if (kills) t.alive = false;
    of.set(hit, { target: t.id, drop: chosen.drop, how, kills });
  }
  return { of, count: new Set(targets.map((t) => t.id)).size };
}

/**
 * The kill gaps (enginecheck.ts killGaps) after which targets are left: in a fight whose targets are all there from
 * its start (severalTargets.fromStart), each gap whose kills so far (capped hits up to its kill's ms, two at one ms
 * two) are fewer than atOnce. The others there were hit unlogged (Hard 33: a shielded slug's hit deals 0), so the
 * replay's enemy stays (a landing applies its debuffs: 6339 14.09 s, Camille's Susceptibility on the next slug) and
 * the totals leave its landings out (the log records every hit that deals damage).
 */
export function gapsWithTargetsLeft<G extends { readonly from: number; readonly to: number }>(fx: Pick<LogFixture, "severalTargets" | "hits">, gaps: readonly G[]): G[] {
  const s = fx.severalTargets;
  if (!s?.fromStart) return [];
  const atOnce = s.atOnce ?? DEFAULT_AT_ONCE;
  return gaps.filter((g) => fx.hits.filter((h) => h.t <= g.from && killed(h)).length < atOnce);
}
