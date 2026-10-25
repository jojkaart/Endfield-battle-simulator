// Rotation search: a driver on the stepping API (docs/design.md#stepping-api)
// that generates the action list while the fight runs, instead of reading a
// recorded one. Every decision goes through the same apply / earliestStart
// as recorded rotations, so a found rotation is legal by construction and
// replays to the same numbers with `simulate`.
//
// With random outcomes (trigger chances, dodge success, rolled crits) a
// rotation's damage is a distribution, not a number (owner, 2026-10-20): the
// search then plays every candidate in several seeded battles at once and
// ranks it by a statistic of their damage, and reports the found rotation's
// distribution over many more (docs/design.md#rotation-search).

import { activeAt, type ActiveBuff } from "./buffs.ts";
import { EngineError } from "./errors.ts";
import type { GameData } from "./model.ts";
import type { CritMode } from "./damage.ts";
import { allActions, type BattleEvent } from "./events.ts";
import { predicateRefs } from "./expr.ts";
import {
  advance,
  apply,
  createContext,
  earliestStart,
  exclusiveUntil,
  enemyActionsOf,
  init,
  memoised,
  simulate,
  startsNow,
  type RotationAction,
  type RunSpread,
  type TimelineContext,
  type TimelineResult,
  type TimelineScenario,
  type TimelineState,
} from "./timeline.ts";
import type { CastRef, ChainStep, Scheduled } from "./timeline/state.ts";
import { ofKind } from "./timeline/schedule.ts";
import { maxPoise } from "./timeline/context.ts";
import { windowKey } from "./timeline/timing.ts";

export interface Candidate {
  readonly action: RotationAction;
  /** Earliest frame it can start. */
  readonly frame: number;
}

/**
 * The basic attacks an attack input can be for an operator: the chain's
 * next step while it points at one, and the chain heads (basic attacks that
 * aren't chain steps), and finishers; not the dive, which is a jump
 * (actionsToJudge).
 */
function nextBasics(data: GameData, state: TimelineState, operator: string): string[] {
  const out = new Set<string>();
  const chain = state.chainNext[operator];
  for (const c of chain ? [chain, ...(chain.alternatives ?? [])] : []) if (c.until >= state.frame) out.add(c.skill);
  // What a buff maps the attack input to (KitBuff.basicAttack), while it's active.
  for (const b of state.buffs) if (b.basicAttack && b.owner === operator && b.cast === undefined && activeAt(b, state.frame)) out.add(b.basicAttack);
  for (const s of data.kits.operators[operator]?.skills ?? []) {
    // Basic attacks that start a chain, and finishers (castable only on a Staggered enemy).
    const spec = data.skills[s.skillId]?.timing?.specification;
    if (s.kind === "basic" && ((!s.chainStep && spec === 1) || spec === 8)) out.add(s.skillId);
  }
  return [...out];
}

/** Whether an operator has basic attacks at all (so swapping to it can be worth it). */
function hasBasics(data: GameData, operator: string): boolean {
  return (data.kits.operators[operator]?.skills ?? []).some((s) => s.kind === "basic");
}

/** The controlled operator's dive (its landing skill, when its kit has it: a jump, then the plunge). */
function diveOf(data: GameData, operator: string): string | undefined {
  const end = data.operators[operator]?.dive?.end;
  return end !== undefined && data.kits.operators[operator]?.skills.some((s) => s.skillId === end) ? end : undefined;
}

/**
 * Whether the operator's basic-attack chain points at a step still to come.
 * The search dives only from outside a chain (a search policy, not a game
 * rule): offered mid-chain, dives that give no SP replaced the chains'
 * SP-giving Final Strikes in the beam, which ranks by damage so far, and
 * starved the battle skills (typhoeus-gilberta: 3.76 M → 2.2–2.5 M).
 */
function midChain(state: TimelineState, operator: string): boolean {
  const c = state.chainNext[operator];
  return c !== undefined && [c, ...(c.alternatives ?? [])].some((x) => x.until >= state.frame);
}

/** The actions to judge at a state, in a fixed order: each operator's non-basic skills, then the controlled one's next basic attacks and its dive, or a swap to the others. */
function actionsToJudge(ctx: TimelineContext, state: TimelineState): RotationAction[] {
  const out: RotationAction[] = [];
  for (const b of ctx.scenario.team) {
    const op = b.operator;
    // Follow-ups (cast only by their own skill) are never legal from a rotation: earliestStart would say so, at a cost.
    for (const s of ctx.data.kits.operators[op]?.skills ?? []) if (s.kind !== "basic" && !s.followUpOnly) out.push({ operator: op, skill: s.skillId });
    if (op === state.controlled) {
      for (const skill of nextBasics(ctx.data, state, op)) out.push({ operator: op, skill });
      const dive = diveOf(ctx.data, op);
      if (dive !== undefined && !midChain(state, op)) out.push({ operator: op, skill: dive });
    } else if (hasBasics(ctx.data, op)) out.push({ operator: op, skill: "swap" });
  }
  return out;
}

/** An action's earliest legal start within the fight, or null. */
function judge(ctx: TimelineContext, state: TimelineState, action: RotationAction): Candidate | null {
  let s = earliestStart(ctx, state, action);
  // A dive only once the current skill is past its exclusive frames: the search doesn't cancel a skill with a jump, which
  // the timeline allows (a plunging attack may interrupt anything) but which isn't checked in game.
  if (!("error" in s) && action.at === undefined && action.skill === diveOf(ctx.data, action.operator)) {
    const free = exclusiveUntil(ctx, advance(ctx, state, s.frame), action.operator);
    if (free > s.frame) s = earliestStart(ctx, state, { ...action, at: free });
  }
  return !("error" in s) && s.frame <= ctx.scenario.durationFrames ? { action, frame: s.frame } : null;
}

/** Every action that can still happen, with its earliest legal start (stepping API: legal actions). */
export function candidateActions(ctx: TimelineContext, state: TimelineState): Candidate[] {
  const out: Candidate[] = [];
  for (const a of actionsToJudge(ctx, state)) {
    const c = judge(ctx, state, a);
    if (c) out.push(c);
  }
  return out;
}

/**
 * The choices at the next decision point: the actions that can start
 * soonest, plus the controlled operator's next basic attack even if later
 * (taking it defers everything else), and the asides: its dive and the
 * swaps, which are choices whenever legal and don't count for what's
 * soonest. A jump may start as soon as the current skill is past its
 * exclusive frames and a swap nearly always at the state's own frame, so
 * either would often be soonest and crowd the other skills out of the
 * choices (review round two: with the swaps counted, skills in a team
 * started only on frames where a basic attack or swap did).
 *
 * The controlled operator's basic attacks, its dive and the swaps (kept
 * even if later, or cheap) are judged in full; of the others, first only whether
 * they can start at the state's own frame (startsNow), which is much
 * cheaper than judging how much later they could. When any of them or a
 * basic attack can start then, nothing starts sooner, and the others aren't
 * choices; only when none can are they judged in full. The same choices,
 * in the same order, as judging them all.
 */
export function legalActions(ctx: TimelineContext, state: TimelineState): Candidate[] {
  const actions = actionsToJudge(ctx, state);
  const basics = new Set(nextBasics(ctx.data, state, state.controlled));
  const dive = diveOf(ctx.data, state.controlled);
  const isDive = (a: RotationAction) => a.operator === state.controlled && a.skill === dive;
  // Swaps and the dive are choices whenever they're legal, and don't count for what's soonest (asides).
  const aside = (a: RotationAction) => a.skill === "swap" || isDive(a);
  const early = (a: RotationAction) => aside(a) || (a.operator === state.controlled && basics.has(a.skill));
  const judged: (Candidate | null | undefined)[] = actions.map((a) => (early(a) ? judge(ctx, state, a) : undefined));
  const inFight = state.frame <= ctx.scenario.durationFrames;
  // Then whether the others can start now: if any action can, the others that can't aren't choices.
  actions.forEach((a, i) => {
    if (judged[i] === undefined && inFight && startsNow(ctx, state, a)) judged[i] = { action: a, frame: state.frame };
  });
  const now = judged.some((c) => c?.frame === state.frame && !aside(c.action));
  const all: Candidate[] = [];
  actions.forEach((a, i) => {
    // Only when nothing can start now: when the others could start.
    const c = judged[i] === undefined ? (now ? null : judge(ctx, state, a)) : judged[i];
    if (c) all.push(c);
  });
  if (all.length === 0) return [];
  const soonest = Math.min(...all.filter((c) => !aside(c.action)).map((c) => c.frame));
  const out = all.filter((c) => c.frame === soonest || (c.action.operator === state.controlled && basics.has(c.action.skill)) || aside(c.action));
  // Each choice also at the start of a short timing window it reads, when one is on its way (both the hit and the missed ring).
  return out.flatMap((c) => [c, ...timingChoices(ctx, state, c)]);
}

/**
 * Short timing windows (owner, 2026-10-20: try both): when a skill's jumps,
 * conditional windows or hits read an own buff that a delayed trigger action
 * of its operator is about to apply (Rossi's perfect-timing ring, applied
 * 52 frames into sequence 1), the step at that buff's start is a choice
 * too, besides the earliest legal frame (a missed ring is a legal rotation).
 */
function timingChoices(ctx: TimelineContext, state: TimelineState, c: Candidate): Candidate[] {
  if (c.action.skill === "swap") return [];
  const kit = ctx.kits.get(c.action.operator);
  const skill = kit?.skills.find((s) => s.skillId === c.action.skill);
  if (!kit || !skill) return [];
  const read = new Set<string>();
  for (const p of [...(skill.jumps ?? []).map((j) => j.if), ...(skill.windows ?? []).flatMap((w) => (w.if ? [w.if] : [])), ...skill.hits.flatMap((h) => (h.if ? [h.if] : []))]) for (const id of predicateRefs(p).buffs) read.add(id);
  if (read.size === 0) return [];
  const frames = new Set<number>();
  for (const a of ofKind(state.scheduled, "action")) {
    if (a.owner !== c.action.operator || a.frame <= c.frame || a.frame > ctx.scenario.durationFrames) continue;
    const t = kit.triggers.find((x) => x.id === a.trigger);
    if (t && allActions(t.do).some((x) => x.kind === "buff" && read.has(x.buff))) frames.add(a.frame);
  }
  const out: Candidate[] = [];
  for (const f of [...frames].sort((x, y) => x - y)) {
    const s = earliestStart(ctx, state, { ...c.action, at: f });
    if (!("error" in s) && s.frame !== c.frame && s.frame <= ctx.scenario.durationFrames && !out.some((x) => x.frame === s.frame)) out.push({ action: c.action, frame: s.frame });
  }
  return out;
}

/**
 * Damage the state has committed within the fight: landed hits plus everything already on its way. With a context from
 * `memoised`, once per state (states are never changed in place: TimelineContext.committedMemo).
 */
export function committedDamage(ctx: TimelineContext, state: TimelineState): number {
  const known = ctx.committedMemo?.get(state);
  if (known !== undefined) return known;
  // Advanced from a copy, so a memoised context doesn't keep the fight's end (every hit to come) for as long as the state lives.
  const end = advance(ctx, { ...state }, ctx.scenario.durationFrames);
  let total = 0;
  for (const h of end.hits) total += h.exact;
  ctx.committedMemo?.set(state, total);
  return total;
}

/**
 * Where a scenario's battles can go differently from seed to seed: rolled
 * crits, a dodge chance strictly between 0 and 1 with enemy attacks to dodge,
 * kit triggers (own or worn) that fire with a chance, and kit triggers on
 * crits (`on: {event: hit, crit}`) unless crits are `never` or `always`
 * (owner, batch 3 decision 2: random results are distributions; with
 * `expected` they never fire, so search plays such a scenario with rolled
 * crits: searchCritMode). Empty: one battle is the result.
 */
export function randomOutcomes(data: GameData, scenario: Omit<TimelineScenario, "rotation">): string[] {
  const out: string[] = [];
  const o = scenario.options;
  if (o.crit === "rolled") out.push("rolled crits");
  const full = { ...scenario, rotation: [] };
  if (o.dodge && o.dodge.chance > 0 && o.dodge.chance < 1 && enemyActionsOf(full).some((a) => a.kind === "attack")) out.push(`dodge chance ${o.dodge.chance}`);
  const ctx = createContext(data, full);
  for (const b of scenario.team) {
    // A chance on the trigger, or a weighted random choice among its actions (Purrchena's giftbox).
    const chance = (ctx.kits.get(b.operator)?.triggers ?? []).filter((t) => t.chance !== undefined || allActions(t.do).some((x) => x.kind === "choose")).map((t) => t.id);
    if (chance.length) out.push(`trigger chance (${data.operators[b.operator]?.name ?? b.operator}: ${chance.join(", ")})`);
  }
  if (o.crit === "rolled" || o.crit === "expected") {
    const crits = critTriggers(data, scenario);
    if (crits.length) out.push(`crit-triggered effects (${crits.join("; ")})${o.crit === "expected" ? ": ranked with rolled crits" : ""}`);
  }
  return out;
}

/**
 * The team's kit triggers (own or worn) that listen to crits (`on: {event: hit, crit}`), as "operator: trigger IDs"
 * per operator. With expected crits no hit counts as a crit (design.md "Crit modes"), so they never fire.
 */
export function critTriggers(data: GameData, scenario: Omit<TimelineScenario, "rotation">): string[] {
  const ctx = createContext(data, { ...scenario, rotation: [] });
  return scenario.team.flatMap((b) => {
    const ids = (ctx.kits.get(b.operator)?.triggers ?? []).filter((t) => t.on.event === "hit" && t.on.crit !== undefined).map((t) => t.id);
    return ids.length ? [`${data.operators[b.operator]?.name ?? b.operator}: ${ids.join(", ")}`] : [];
  });
}

/**
 * The crit mode a search plays a scenario's battles in: its own, except `expected` with crit-triggered effects in
 * the team (critTriggers), which never fire with expected crits: then rolled, so the candidates are ranked over
 * seeded battles in which they do (batch 4 T3).
 */
export function searchCritMode(data: GameData, scenario: Omit<TimelineScenario, "rotation">): CritMode {
  const crit = scenario.options.crit;
  return crit === "expected" && critTriggers(data, scenario).length > 0 ? "rolled" : crit;
}

export interface SearchOptions {
  /** Nodes kept per time bucket (default 24). */
  readonly beamWidth?: number;
  /** Width of a time bucket in frames (default 15, half a second). */
  readonly bucketFrames?: number;
  /** Stop after expanding this many nodes (default 200,000). */
  readonly maxExpansions?: number;
  /**
   * Seeded battles each candidate is played in when the scenario has random
   * outcomes (randomOutcomes; default 4): seeds `seed`, `seed` + 1, … from
   * the scenario's seed (default 1). Without random outcomes it's always 1.
   */
  readonly seeds?: number;
  /**
   * Rank by this percentile (0–100, nearest rank) of the seeded battles'
   * damage instead of their mean: a low one (e.g. 25) prefers rotations that
   * hold up when the dice go badly.
   */
  readonly percentile?: number;
  /** Battles the found rotation is replayed in for its distribution, when the scenario has random outcomes (default 50; 0: none). */
  readonly runs?: number;
  /**
   * Whether the rotation may swap the controlled operator (default false: the owner doesn't swap in battle, 2026-10-25).
   * Without swaps the scenario's controlled operator does every basic attack and dive; teammates still cast their
   * battle skills, combos and ultimates.
   */
  readonly swaps?: boolean;
}

/**
 * A rotation's total damage over seeded battles, each with the scenario's
 * own options (crit mode included) and seed `seed` + i. A battle in which
 * an action of the rotation isn't legal (its random outcomes went
 * otherwise: no combo window, not enough energy) can't be played: it's
 * counted in `illegal`, and the statistics are over the others.
 */
export interface RotationSpread extends RunSpread {
  /** Battles in which the rotation isn't legal (not in `totals`). */
  readonly illegal: number;
}

/** The distribution of a recorded rotation's total damage over `runs` seeded battles with the scenario's options (simulateRuns rolls crits instead). */
export function rotationSpread(data: GameData, scenario: TimelineScenario, runs: number, seed = scenario.options.seed ?? 1): RotationSpread {
  if (!Number.isInteger(runs) || runs < 1) throw new EngineError(`runs must be a whole number ≥ 1, not ${runs}`);
  const totals: number[] = [];
  let illegal = 0;
  for (let i = 0; i < runs; i++) {
    try {
      totals.push(simulate(data, { ...scenario, options: { ...scenario.options, seed: (seed + i) >>> 0 } }).total);
    } catch (e) {
      if (!(e instanceof EngineError)) throw e;
      illegal++;
    }
  }
  const n = totals.length;
  if (n === 0) throw new EngineError(`the rotation isn't legal in any of ${runs} battles (seeds ${seed}–${seed + runs - 1})`);
  const mean = totals.reduce((a, b) => a + b, 0) / n;
  const sorted = [...totals].sort((a, b) => a - b);
  const rank = (p: number) => sorted[Math.max(0, Math.ceil(p * n) - 1)] as number;
  return {
    runs, seed, totals, mean, illegal,
    sd: Math.sqrt(totals.reduce((a, t) => a + (t - mean) ** 2, 0) / n),
    min: sorted[0] as number, max: sorted[n - 1] as number,
    p5: rank(0.05), p50: rank(0.5), p95: rank(0.95),
  };
}

export interface SearchResult {
  readonly rotation: readonly RotationAction[];
  /** The best rotation replayed with `simulate`: one battle, with the scenario's own seed. */
  readonly result: TimelineResult;
  readonly expanded: number;
  /** The search stopped at SearchOptions.maxExpansions with states left to expand: the rotation is the best found by then. */
  readonly capped: boolean;
  /**
   * Nodes the beam compared (`compared`), of which equivalent to a better one (`merged`: stateKey) and, of the rest,
   * cut by the beam width (`pruned`); `family`: those the best by score alone would have kept, dropped for a better
   * one of their family (prune).
   */
  readonly counts: { readonly compared: number; readonly merged: number; readonly family: number; readonly pruned: number };
  /** The scenario's random outcomes (randomOutcomes); empty: deterministic, one battle is the result. */
  readonly random: readonly string[];
  /** Seeds of the battles every candidate was ranked over (one seed without random outcomes). */
  readonly seeds: readonly number[];
  /** The crit mode the battles (and `result`, `spread`) were played in: the scenario's, or rolled for crit-triggered effects (searchCritMode). */
  readonly crit: CritMode;
  /** What the beam ranked by: the mean of the seeded battles, or a percentile (SearchOptions.percentile). */
  readonly rankedBy: "mean" | { readonly percentile: number };
  /** What the found rotation scored as the beam ranked it: its damage, or with random outcomes the statistic of its seeded battles. */
  readonly score: number;
  /** With random outcomes: the found rotation's distribution over SearchOptions.runs battles (rotationSpread). */
  readonly spread?: RotationSpread;
}

/** One beam width's search in searchBeams. */
export interface BeamRun {
  readonly beamWidth: number;
  /** SearchResult.score of its rotation. */
  readonly score: number;
  readonly expanded: number;
  readonly capped: boolean;
}

/** The best of several beam widths' searches (searchBeams), with what each found. */
export interface BeamsResult extends SearchResult {
  /** The beam width that found it. */
  readonly beamWidth: number;
  /** Every width's search, in the order run. */
  readonly beams: readonly BeamRun[];
  /** How far apart the widths' scores are: (best − worst) / best (0: all found the same). */
  readonly beamSpread: number;
}

/**
 * The search at several beam widths (e.g. w/2, w, 2w: efsim search's default), the best result and how far the others
 * fell short. A beam search's result isn't monotone in its width (review round two: si-laevatain moved ±4.5% between
 * widths 12 and 48): the spread is how much one width's answer can be trusted to be the best this search finds.
 * `onBeam` sees each width's result as it's done (the CLI times them).
 */
export function searchBeams(data: GameData, scenario: Omit<TimelineScenario, "rotation">, options: SearchOptions & { readonly beams: readonly number[] }, onBeam?: (r: SearchResult, beamWidth: number) => void): BeamsResult {
  const { beams: widths, ...rest } = options;
  if (widths.length === 0) throw new EngineError("searchBeams: no beam widths");
  let best: { r: SearchResult; w: number } | undefined;
  const beams: BeamRun[] = [];
  for (const w of widths) {
    if (!Number.isInteger(w) || w < 1) throw new EngineError(`beam width must be a whole number ≥ 1, not ${w}`);
    const r = search(data, scenario, { ...rest, beamWidth: w });
    onBeam?.(r, w);
    beams.push({ beamWidth: w, score: r.score, expanded: r.expanded, capped: r.capped });
    if (!best || r.score > best.r.score) best = { r, w };
  }
  const b = best as { r: SearchResult; w: number };
  const worst = Math.min(...beams.map((x) => x.score));
  return { ...b.r, beamWidth: b.w, beams, beamSpread: b.r.score > 0 ? (b.r.score - worst) / b.r.score : 0 };
}

/**
 * How a field takes part in the key that says when two states are equivalent
 * for the rest of the fight (stateKey): `true`, all of it; a function, the
 * part of it that counts (given the state's KeyEnv); a string, the reason it
 * doesn't count at all. Every field of TimelineState (and of the records
 * nested in it that the key used to sample) must be classified, so a new
 * field doesn't compile until someone decides whether the search may merge
 * states that differ in it.
 */
// A function gets the value only when it is there (project skips absent fields).
type KeyRule<T> = true | string | ((v: Exclude<T, undefined>, env: KeyEnv) => unknown);
type KeyRules<T> = { readonly [K in keyof T]-?: KeyRule<T[K]> };

/**
 * What the key reads besides a field itself. Dead deadlines: everything that
 * happens after a state happens at its frame or later (advance only moves
 * forward, an action starts no sooner than the state's frame, a slow-down's
 * shift moves only what's after its start), so a deadline the engine reads
 * only as "is it later than the frame now" is the same as none once it's at
 * or before the state's frame (`frame`), whatever its value. Cast indices:
 * the engine reads them only to tell casts apart, look a cast up and number
 * the next one (`casts.length`), so they're keyed from the end (`rel`), and
 * casts nothing refers to any more (`live`) drop out.
 */
interface KeyEnv {
  readonly frame: number;
  readonly rel: (index: number) => number;
  /** Cast indices the state still refers to (scheduled items, actions, buffs, each operator's last cast). */
  readonly live: ReadonlySet<number>;
  readonly scenario: ScenarioKeyFacts;
  /** The family key (stateKeyer `loose`, prune): who's controlled, now and at each pending hit's cast, and the buffs' order left out. */
  readonly loose?: boolean;
}

/** What the key needs of the scenario (stateKeyer: once per search). */
interface ScenarioKeyFacts {
  /** Combo window keys a follow-up combo reads even after the window ended (castSkill reads a follow-up's window count unchecked). */
  readonly endedWindowsRead: ReadonlySet<string>;
  /** Per trigger (`owner:triggerId`): whether how often it fired is read (KitTrigger.maxCount). */
  readonly counted: ReadonlyMap<string, boolean>;
  /** The enemy's full stagger HP: a stagger that ended refilled the bar (dealPoise). */
  readonly maxPoise: number;
}

/** Rounded to 0.1: SP and energy reached by different paths differ in floating-point noise (a search policy: states this close are one). */
const round = (x: number) => Math.round(x * 10) / 10;

/** A record's entries that hold (absent: none). */
const entries = <V>(r: Readonly<Record<string, V>>, keep: (v: V, k: string) => boolean): Record<string, V> => Object.fromEntries(Object.entries(r).filter(([k, v]) => keep(v, k)));

/** A deadline read only as "later than now" (see KeyEnv): absent once past. */
const deadline = (f: number, env: KeyEnv) => (f > env.frame ? f : undefined);

/** A cast reference, from the end of the cast list. */
const castRef = (c: CastRef, env: KeyEnv) => ({ operator: c.operator, index: env.rel(c.index) });

/** A scheduled item's header (ScheduledHeader): when it's due, on which clock, what it belongs to. */
const HEADER_KEY = {
  kind: "the key groups the items by kind (scheduledKey)",
  frame: true,
  clock: "follows from the operator, the cast or the kind (the enemy's for bursts and enemy actions)",
  cast: castRef, detached: true, launchAt: true, pinned: true,
} as const;

/** An event with a cast index in it (hit, status and cast events), from the end of the cast list. */
const eventKey = (e: BattleEvent, env: KeyEnv) => ("cast" in e && e.cast !== undefined ? { ...e, cast: env.rel(e.cast) } : e);

/** A cast's alternatives (castSkill: `<cast index>:<branch>:<n>`; a trigger's start with its owner instead). */
const branchKey = (b: string, env: KeyEnv) => b.replace(/^(\d+):/, (_, i: string) => `${env.rel(Number(i))}:`);

/** Each kind of scheduled item: everything about it decides what it does when it's due, but a replayed landing's reference. */
const SCHEDULED_KEY: { readonly [K in Scheduled["kind"]]: KeyRules<Extract<Scheduled, { kind: K }>> } = {
  hit: {
    ...HEADER_KEY, operator: true, skillId: true, hitId: true, sp: true, spKind: true, spSource: true, usesUp: true, eventCount: true, eventSource: true,
    controlledAtCast: (c, env) => (env.loose ? undefined : c), trigger: true, branch: branchKey, fixed: true, snapshot: true, ref: "a replayed landing's reference, which no search sets",
  },
  action: { ...HEADER_KEY, owner: true, trigger: true, event: eventKey, origin: true, awaited: true, afterHits: true },
  energy: { ...HEADER_KEY, operator: true, amount: true, if: true },
  jump: { ...HEADER_KEY, operator: true, from: true, to: true, end: true, then: true, landing: true },
  burst: { ...HEADER_KEY, event: true, fromKind: true, fromCast: (i, env) => env.rel(i) },
  enemyAction: { ...HEADER_KEY, act: true, target: true, element: true },
};
const SCHEDULED_KINDS = Object.keys(SCHEDULED_KEY) as Scheduled["kind"][];

/**
 * The scheduled list as each kind's items, in order: the order within a kind is what advance's ties go by (the first
 * scheduled), how kinds interleave isn't (each kind has its own place in a frame: docs/design.md "Order within a frame").
 */
function scheduledKey(list: readonly Scheduled[], env: KeyEnv): Record<string, unknown> {
  return Object.fromEntries(SCHEDULED_KINDS.map((k) => [k, list.filter((x) => x.kind === k).map((x) => project(x, SCHEDULED_KEY[k] as KeyRules<typeof x>, env))]));
}

/** A timed buff: everything about it decides what it does (its layers, ticks, records, recipients, the cast it belongs to). */
const BUFF_KEY: KeyRules<ActiveBuff> = {
  id: true, stackGroup: true, owner: true, target: true, appliedAt: true, expiresAt: true, modifiers: true, attrs: true, categories: true, recipients: true,
  excluded: true, maxLayers: true, maxInstances: true, consumedBy: true, cast: (i, env) => env.rel(i),
  // Read only while `frame < until` (buffs.ts modifiersAt) or to cut it shorter (casting.ts): over, it's as if it had none.
  whileCasting: (w, env) => (w.until > env.frame ? w : undefined),
  blocksEnergy: true, every: true, nextTick: true, endsWithCast: (i, env) => env.rel(i), skipped: true, gameBuff: true, sharedTimer: true, link: true,
  basicAttack: true, records: true, snapshot: true,
};

/** A chain step's window, read only while the attack input's frame is within it (timing.ts actionGate, chainAfter; search nextBasics). */
const stepLive = (c: ChainStep, env: KeyEnv) => c.until >= env.frame;

/**
 * Per kit trigger: when it can fire again, read only as "later than the event" (actions.ts runTriggers); how often it
 * has, read only against its maxCount; per cast (`…@<cast>`), how often for that cast, read only for events of that
 * cast. Entries left with nothing that's read drop out; one of a trigger the key doesn't know is kept whole.
 */
function triggerStateKey(ts: TimelineState["triggerState"], env: KeyEnv): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(ts)) {
    const perCast = /^(.*)@(\d+)$/.exec(key);
    if (perCast) {
      const cast = Number(perCast[2]);
      if (env.live.has(cast)) out[`${perCast[1]}@${env.rel(cast)}`] = v.count;
      continue;
    }
    // `owner:trigger`, or `owner:trigger:subject` (KitTrigger.cooldownPer eventSubject).
    const [owner, trigger] = key.split(":");
    const counted = env.scenario.counted.get(`${owner}:${trigger}`);
    if (counted === undefined) {
      out[key] = v;
      continue;
    }
    const kept = { readyAt: deadline(v.readyAt, env), count: counted ? v.count : undefined };
    if (kept.readyAt !== undefined || kept.count !== undefined) out[key] = kept;
  }
  return out;
}

const STATE_KEY: KeyRules<TimelineState> = {
  frame: true,
  rng: true,
  sp: round,
  spReturned: round,
  energy: (e) => Object.fromEntries(Object.entries(e).map(([k, v]) => [k, round(v)])),
  // Read as "> frame" (resources.ts gainEnergy) and set anew (casting.ts).
  energyBlockedUntil: (e, env) => entries(e, (f) => f > env.frame),
  // Read through windowOpen (`until < frame`: closed) or with `until >= frame`, but a follow-up combo's count (endedWindowsRead).
  comboWindow: (w, env) => entries(w, (x, k) => x.until >= env.frame || env.scenario.endedWindowsRead.has(k)),
  // Read as max(frame, it) (resources.ts spAt, afterRegen; timing.ts) and raised with max (casting.ts).
  spPausedUntil: deadline,
  spStops: true,
  controlled: (c, env) => (env.loose ? undefined : c),
  acting: (a, env) => Object.fromEntries(Object.entries(a).map(([op, x]) => [op, x.cast !== undefined ? { ...x, cast: env.rel(x.cast) } : x])),
  chainNext: (c, env) => {
    const out: Record<string, unknown> = {};
    for (const [op, x] of Object.entries(c)) {
      const { alternatives, ...main } = x;
      const alts = (alternatives ?? []).filter((y) => stepLive(y, env));
      // The step that was next is kept by a skill that doesn't interrupt the chain only while it's live (chainAfter): a dead one isn't promoted.
      if (stepLive(main, env) || alts.length) out[op] = { main: stepLive(main, env) ? main : null, alts };
    }
    return out;
  },
  // Read as `> frame` or max(frame, ⌈it⌉) (timing.ts startFrom, drivers.ts startsNow; resources.ts, actions.ts skip ended ones).
  readyAt: (r, env) => entries(r, (f) => Math.ceil(f) > env.frame),
  scheduled: scheduledKey,
  // Read only as `> frame` (casting.ts Link use, actions.ts link gain).
  link: (l, env) => l.filter((f) => f > env.frame),
  // Read as max(event frame, it) (actions.ts freeze).
  enemyFrozenUntil: deadline,
  // Staggered while `until > frame`; once it's over the bar counts as full (dealPoise); finisherUsed is read only while Staggered.
  stagger: (s, env) => (s.until !== null && s.until > env.frame ? s : { poise: s.until !== null ? env.scenario.maxPoise : s.poise }),
  // Read only from their start to their end (clock.ts slowDown, which drops the ended ones).
  slowdowns: (d, env) => d.filter((x) => x.start + x.scales.length > env.frame),
  enemy: true,
  // In order (the engine reads the first of several matches in places); a family (loose) doesn't care which came first.
  buffs: (b, env) => {
    const out = b.map((x) => project(x, BUFF_KEY, env));
    return env.loose ? out.map(canonical).sort() : out;
  },
  triggerState: triggerStateKey,
  stacks: true,
  // What the engine reads back of the cast list: each operator's last cast (an action without one falls back to it) and
  // the Link stacks a cast used (castLink, read by its hits and events); the next cast's index follows from the former.
  casts: (casts, env) => {
    const last: Record<string, [number, string]> = {};
    casts.forEach((c, i) => (last[c.operator] = [env.rel(i), c.skill]));
    return { last, link: casts.flatMap((c, i) => (c.link !== undefined && env.live.has(i) ? [[env.rel(i), c.link]] : [])) };
  },
  hits: "what has landed is the score (committedDamage), not what comes next; recording buffs keep their own totals (ActiveBuff.records)",
  reactions: "the record of what the enemy's arts state did; nothing reads it back",
};

/** The parts of a record its rules say count (KeyRules), by field name. */
function project<T extends object>(v: T, rules: KeyRules<T>, env: KeyEnv): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(rules) as (keyof T & string)[]) {
    const rule = rules[k] as KeyRule<T[keyof T]>;
    if (typeof rule === "string" || v[k] === undefined) continue;
    out[k] = rule === true ? v[k] : rule(v[k] as Exclude<T[keyof T], undefined>, env);
  }
  return out;
}

/**
 * A value as text that two values share exactly when they're equal as data: object keys sorted (the order a path
 * built a record in doesn't matter), non-finite numbers kept (JSON would make Infinity null), absent fields absent.
 */
function canonical(v: unknown): string {
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : `"${String(v)}"`;
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (Object.getPrototypeOf(v) !== Object.prototype) throw new EngineError(`stateKey: a state holds a ${Object.prototype.toString.call(v)}, which isn't plain data`);
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}

/** The cast indices a state still refers to: what's scheduled, the operators' actions, buffs, each operator's last cast. */
function liveCasts(s: TimelineState): Set<number> {
  const live = new Set<number>();
  for (const x of s.scheduled) {
    if (x.cast) live.add(x.cast.index);
    if (x.kind === "burst" && x.fromCast !== undefined) live.add(x.fromCast);
    if (x.kind === "action" && "cast" in x.event && x.event.cast !== undefined) live.add(x.event.cast);
    if (x.kind === "hit" && x.branch) {
      const m = /^(\d+):/.exec(x.branch);
      if (m) live.add(Number(m[1]));
    }
  }
  for (const a of Object.values(s.acting)) if (a.cast !== undefined) live.add(a.cast);
  for (const b of s.buffs) {
    if (b.cast !== undefined) live.add(b.cast);
    if (b.endsWithCast !== undefined) live.add(b.endsWithCast);
  }
  const last = new Map<string, number>();
  s.casts.forEach((c, i) => last.set(c.operator, i));
  for (const i of last.values()) live.add(i);
  return live;
}

/**
 * What the key needs of a scenario: computed once, then each state's key (stateKey) is cheap. `loose`: the family
 * key instead (prune), which leaves out who's controlled, now and at each pending hit's cast, and the buffs' order.
 */
export function stateKeyer(ctx: TimelineContext, loose = false): (s: TimelineState) => string {
  const endedWindowsRead = new Set<string>();
  const counted = new Map<string, boolean>();
  for (const b of ctx.scenario.team) {
    const op = b.operator;
    for (const t of ctx.kits.get(op)?.triggers ?? []) {
      counted.set(`${op}:${t.id}`, (counted.get(`${op}:${t.id}`) ?? false) || t.maxCount !== undefined);
      for (const a of allActions(t.do)) {
        if (a.kind !== "cast") continue;
        const skill = ctx.kits.get(op)?.skills.find((s) => s.skillId === a.skill);
        if (skill?.kind === "combo" && skill.comboWindow !== false) endedWindowsRead.add(windowKey(ctx, op, a.skill));
      }
    }
  }
  const scenario: ScenarioKeyFacts = { endedWindowsRead, counted, maxPoise: maxPoise(ctx) };
  return (s) => {
    const n = s.casts.length;
    return canonical(project(s, STATE_KEY, { frame: s.frame, rel: (i) => n - i, live: liveCasts(s), scenario, loose }));
  };
}

/**
 * What makes two states equivalent for the rest of the fight (not how they
 * got there): every field of the state that what comes next reads
 * (STATE_KEY), less deadlines already past and casts nothing refers to
 * (KeyEnv). Damage already committed is the score, not part of the key.
 */
export function stateKey(ctx: TimelineContext, s: TimelineState): string {
  return stateKeyer(ctx)(s);
}

/**
 * The nodes a layer keeps, best first, at most `n`: the best of each set of equivalent states (stateKey: in every
 * seeded battle), then the best of each family (familyKey) in score order, then, if there's room, the best of the
 * rest. A family is the states that differ only in who's controlled (now, and when each hit on its way was cast):
 * a swap is free and takes no time, so each state comes in up to one variant per team member, all with one score,
 * and in a team they filled the beam (si-laevatain: half the beam; the 4-operator example: 12 of 12 nodes at one
 * point, all 671,349, and the best rotation was dropped). A search policy, not an exact merge: the others are
 * reached by swapping later.
 */
function prune(nodes: readonly Node[], n: number, counts: { merged: number; family: number; pruned: number }): Node[] {
  const byKey = new Map<string, Node>();
  for (const x of nodes) {
    const y = byKey.get(x.key);
    if (!y || x.score > y.score) byKey.set(x.key, x);
  }
  counts.merged += nodes.length - byKey.size;
  // Stable: ties keep generation order (deterministic).
  const sorted = [...byKey.values()].sort((a, b) => b.score - a.score);
  if (sorted.length <= n) return sorted;
  const kept: Node[] = [];
  const rest: Node[] = [];
  const families = new Set<string>();
  for (const x of sorted) {
    if (kept.length < n && !families.has(x.family)) {
      kept.push(x);
      families.add(x.family);
    } else rest.push(x);
  }
  for (const x of rest) if (kept.length < n) kept.push(x);
  counts.pruned += sorted.length - n;
  // Those the best n by score would have kept.
  const chosen = new Set(kept);
  counts.family += sorted.slice(0, n).filter((x) => !chosen.has(x)).length;
  return kept.sort((a, b) => b.score - a.score);
}

interface Node {
  /** The same rotation's state in each seeded battle (the first: the scenario's own seed, which proposes the actions). */
  readonly states: readonly TimelineState[];
  readonly rotation: readonly RotationAction[];
  /** stateKey of every state. */
  readonly key: string;
  /** familyKey of the first state (prune). */
  readonly family: string;
  /** What the beam ranks it by: the statistic of committed damage over the battles. */
  readonly score: number;
}

/** The mean of the values, or their percentile (0–100, nearest rank). One value is itself either way. */
function statistic(values: readonly number[], percentile: number | undefined): number {
  if (values.length === 1) return values[0] as number;
  if (percentile === undefined) return values.reduce((a, b) => a + b, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1)] as number;
}

/**
 * Beam search over rotations for a team: at each decision point every legal
 * action is tried; per half-second bucket the best `beamWidth` states by
 * committed damage survive. Deterministic: ties keep generation order.
 *
 * With random outcomes each node holds K seeded battles (SearchOptions.seeds)
 * advanced by the same actions: the first battle (the scenario's seed)
 * proposes the legal actions and their frames; each step is applied with
 * `at` that frame in every battle (in the others it starts at their own
 * earliest legal frame from there, as `simulate` replays it), and a child
 * whose step isn't legal in some battle is dropped. Its score is the mean
 * (or SearchOptions.percentile) of the K battles' values.
 */
export function searchRotation(data: GameData, scenario: Omit<TimelineScenario, "rotation">, options: SearchOptions = {}): SearchResult {
  return search(data, scenario, options);
}

function search(data: GameData, given: Omit<TimelineScenario, "rotation">, options: SearchOptions): SearchResult {
  const beam = options.beamWidth ?? 24;
  const swaps = options.swaps ?? false;
  const bucketFrames = options.bucketFrames ?? 15;
  const maxExpansions = options.maxExpansions ?? 200_000;
  const percentile = options.percentile;
  if (percentile !== undefined && !(percentile >= 0 && percentile <= 100)) throw new EngineError(`percentile must be 0–100, not ${percentile}`);
  const random = randomOutcomes(data, given);
  // Expected crits with crit-triggered effects: the battles roll crits, or those effects would never fire (searchCritMode).
  const crit = searchCritMode(data, given);
  const scenario = crit === given.options.crit ? given : { ...given, options: { ...given.options, crit } };
  const k = random.length === 0 ? 1 : (options.seeds ?? 4);
  if (!Number.isInteger(k) || k < 1) throw new EngineError(`seeds must be a whole number ≥ 1, not ${options.seeds}`);
  const seed0 = scenario.options.seed ?? 1;
  const seeds = Array.from({ length: k }, (_, i) => (seed0 + i) >>> 0);
  // One battle: the scenario as given (bit for bit the search without seeds). More: the same with seed + i.
  // Judging the candidates of one state advances it to the same frames over and over: memoised (exact, states are plain data).
  const ctxs = (k === 1 ? [createContext(data, { ...scenario, rotation: [] })] : seeds.map((seed) => createContext(data, { ...scenario, rotation: [], options: { ...scenario.options, seed } }))).map(memoised);
  const ctx = ctxs[0] as TimelineContext;
  const keyers = ctxs.map((c) => stateKeyer(c));
  // Families by the proposing battle (the others played the same actions).
  const familyKey = stateKeyer(ctx, true);
  const node = (states: readonly TimelineState[], rotation: readonly RotationAction[]): Node => {
    const damages = states.map((s, i) => committedDamage(ctxs[i] as TimelineContext, s));
    return { states, rotation, family: familyKey(states[0] as TimelineState), key: states.map((s, i) => (keyers[i] as (s: TimelineState) => string)(s)).join("\n"), score: statistic(damages, percentile) };
  };
  const buckets = new Map<number, Node[]>();
  const push = (n: Node) => {
    const b = Math.floor((n.states[0] as TimelineState).frame / bucketFrames);
    const list = buckets.get(b) ?? [];
    list.push(n);
    buckets.set(b, list);
  };
  const root = node(ctxs.map((c) => init(c)), []);
  push(root);
  let best: Node = root;
  let expanded = 0;
  const counts = { compared: 0, merged: 0, family: 0, pruned: 0 };
  let capped = false;
  while (buckets.size > 0 && expanded < maxExpansions) {
    const b = Math.min(...buckets.keys());
    let layer = buckets.get(b) as Node[];
    buckets.delete(b);
    // Children that stay in this bucket (casts at the same frame) are expanded in further rounds, under the same beam.
    while (layer.length > 0 && expanded < maxExpansions) {
      counts.compared += layer.length;
      const nodes = prune(layer, beam, counts);
      layer = [];
      for (const n of nodes) {
        expanded++;
        const first = n.states[0] as TimelineState;
        // A swap takes no time: never two in a row (they'd loop within a frame); none at all unless asked for.
        const lastSwap = n.rotation.at(-1)?.skill === "swap";
        const choices = legalActions(ctx, first).filter((c) => c.action.skill !== "swap" || (swaps && !lastSwap));
        if (choices.length === 0 && n.score > best.score) best = n;
        for (const c of choices) {
          // Applied as recorded, with `at` the frame it starts, so the rotation replays to exactly these states.
          const step = { ...c.action, at: c.frame };
          const states: TimelineState[] = [];
          for (let i = 0; i < k; i++) {
            const ci = ctxs[i] as TimelineContext;
            const si = n.states[i] as TimelineState;
            // The proposing battle found it legal; another may not (its dice went otherwise): then the child is dropped.
            if (i > 0 && "error" in earliestStart(ci, si, step)) break;
            states.push(apply(ci, si, step));
          }
          if (states.length < k) continue;
          const child = node(states, [...n.rotation, step]);
          if (child.score > best.score) best = child;
          if (Math.floor((states[0] as TimelineState).frame / bucketFrames) === b) layer.push(child);
          else push(child);
        }
      }
    }
    if (layer.length > 0) capped = true;
  }
  if (buckets.size > 0) capped = true;
  const full: TimelineScenario = { ...scenario, rotation: best.rotation };
  const runs = options.runs ?? 50;
  return {
    rotation: best.rotation,
    result: simulate(data, full),
    expanded,
    capped,
    counts,
    random,
    seeds,
    crit,
    rankedBy: percentile === undefined ? "mean" : { percentile },
    score: best.score,
    ...(random.length > 0 && runs > 0 ? { spread: rotationSpread(data, full, runs, seed0) } : {}),
  };
}
