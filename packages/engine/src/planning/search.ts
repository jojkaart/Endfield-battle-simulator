// Rotation search: a driver on the stepping API (docs/design/timeline.md#stepping-api)
// that generates the action list while the fight runs, instead of reading a
// recorded one. Every decision goes through the same apply / earliestStart
// as recorded rotations, so a found rotation is legal by construction and
// replays to the same numbers with `simulate`.
//
// With random outcomes (trigger chances, dodge success, rolled crits) a
// rotation's damage is a distribution, not a number (owner, 2026-10-20): the
// search then plays every candidate in several seeded battles at once and
// ranks it by a statistic of their damage, and reports the found rotation's
// distribution over many more (docs/design/search.md#rotation-search).

import { diveOf, nextBasics, EngineError, allActions, predicateRefs, advance, apply, createContext, earliestStart, exclusiveUntil, enemyActionsOf, init, memoised, simulate, startsNow, ofKind, maxPoise, skillCosts, maxEnergy, SP, FPS, windowKey, type ActiveBuff, type GameData, type CritMode, type BattleEvent, type RotationAction, type RunSpread, type TimelineContext, type TimelineResult, type TimelineScenario, type TimelineState, type CastRef, type ChainStep, type Scheduled } from "../core.ts";
import { remainingBound, type UpperBound } from "./bound.ts";
import { playMacros, type MacroNode } from "./macros.ts";
import { setupValue, type SetupTable } from "./setupvalue.ts";

export interface Candidate {
  readonly action: RotationAction;
  /** Earliest frame it can start. */
  readonly frame: number;
}

/** Whether an operator has basic attacks at all (so swapping to it can be worth it). */
function hasBasics(data: GameData, operator: string): boolean {
  return (data.kits.operators[operator]?.skills ?? []).some((s) => s.kind === "basic");
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

/** The controlled operator's soonest next basic attack from a state (with `at`), when it starts before a frame: a macro's filler (playMacros). */
export function nextBasicAttack(ctx: TimelineContext, state: TimelineState, before: number): RotationAction | null {
  let next: Candidate | null = null;
  for (const skill of nextBasics(ctx.data, state, state.controlled)) {
    const c = judge(ctx, state, { operator: state.controlled, skill });
    if (c && c.frame < before && (!next || c.frame < next.frame)) next = c;
  }
  return next ? { ...next.action, at: next.frame } : null;
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
 *
 * `allow` (SearchHooks.allow): actions it refuses aren't choices and don't
 * count for what's soonest.
 */
export function legalActions(ctx: TimelineContext, state: TimelineState, allow?: (action: RotationAction) => boolean): Candidate[] {
  const actions = allow ? actionsToJudge(ctx, state).filter(allow) : actionsToJudge(ctx, state);
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
 * `memoised`, once per state (states are never changed in place: TimelineContext.committedMemo). `landedBefore`: the
 * sum of hits left out of the state before its first (SearchHooks.hitsFrom), which the sum starts from, so the total is
 * the same to the bit as with them (and the same for every state of one search: memoised with it).
 */
export function committedDamage(ctx: TimelineContext, state: TimelineState, landedBefore = 0): number {
  const known = ctx.committedMemo?.get(state);
  if (known !== undefined) return known;
  // Advanced from a copy, so a memoised context doesn't keep the fight's end (every hit to come) for as long as the state lives.
  const end = advance(ctx, { ...state }, ctx.scenario.durationFrames);
  let total = landedBefore;
  for (const h of end.hits) total += h.exact;
  ctx.committedMemo?.set(state, total);
  return total;
}

/**
 * What a state's resources are worth to the beam on top of its damage (docs/design/search.md "How the beam ranks"):
 * ultimate energy at its operator's price per point, team SP at the team's, and casts still paying off. Prices come
 * from probes (resourcePrices), not tables: a search heuristic, never part of a result.
 */
export interface ResourcePrices {
  /** Damage per point of ultimate energy, per operator. */
  readonly energy: Readonly<Record<string, number>>;
  /** Damage per point of team SP. */
  readonly sp: number;
  /** Frames a probe runs; the resources' worth falls to 0 over as many before the fight's end (no time left to use them). */
  readonly horizon: number;
  /**
   * Each probed cast (operator → skill): its worth (`worth`) and what of it is still to come at each age
   * (`remaining[i]`: at i × PROBE_STEP frames after the cast; 0 from the end of the list).
   */
  readonly casts: Readonly<Record<string, Readonly<Record<string, { readonly worth: number; readonly remaining: readonly number[] }>>>>;
}

/** The probe's continuation: the controlled operator basic-attacks (its soonest next attack each time) up to `until`; every state on the way. */
function attackUntil(ctx: TimelineContext, state: TimelineState, until: number): TimelineState[] {
  const out = [state];
  for (;;) {
    const s = out.at(-1) as TimelineState;
    const op = s.controlled;
    let next: Candidate | null = null;
    for (const skill of nextBasics(ctx.data, s, op)) {
      const c = judge(ctx, s, { operator: op, skill });
      if (c && c.frame <= until && (!next || c.frame < next.frame)) next = c;
    }
    if (!next) return out;
    out.push(apply(ctx, s, { ...next.action, at: next.frame }));
  }
}

/**
 * Resource prices by probing the kits (2026-11-14): from the fight's start with every ultimate charged, each
 * operator's ultimate and battle skill is cast at once, then the controlled operator basic-attacks for `horizon`
 * frames; the cast's worth is the damage committed by then minus that of the attacks alone (so a buff that
 * strengthens later hits counts, as Laevatain's ultimate's enhanced attacks do, and a cast that deals nothing itself
 * isn't free), and how that difference grows over the probe says how much of it is still to come at each age. An
 * operator's energy price is its ultimate's worth over its cost; SP's, the mean over the operators' battle skills
 * of worth over SP cost (SP is the team's: who gets it is a choice). Deterministic: plain casts on a copy of the
 * scenario.
 */
export function resourcePrices(data: GameData, scenario: Omit<TimelineScenario, "rotation">, horizon = PROBE_FRAMES): ResourcePrices {
  const full = Object.fromEntries(scenario.team.map((b) => [b.operator, "full" as const]));
  const ctx = memoised(createContext(data, { ...scenario, rotation: [], startEnergy: full }));
  const s0 = init(ctx);
  const until = Math.min(scenario.durationFrames, horizon);
  const steps = Math.floor(until / PROBE_STEP);
  // Damage committed (within the probe) at each step after `from`: by the last state of the attacks started by then.
  const curve = (s: TimelineState, from: number): number[] => {
    const path = attackUntil(ctx, s, until);
    const committed = path.map((x) => advance(ctx, { ...x }, until).hits.reduce((a, h) => a + h.exact, 0));
    return Array.from({ length: steps + 1 }, (_, i) => {
      let j = 0;
      while (j + 1 < path.length && (path[j + 1] as TimelineState).frame <= from + i * PROBE_STEP) j++;
      return committed[j] as number;
    });
  };
  const base = curve(s0, 0);
  const energy: Record<string, number> = {};
  const casts: Record<string, Record<string, { worth: number; remaining: number[] }>> = {};
  const spPrices: number[] = [];
  for (const b of scenario.team) {
    const op = b.operator;
    const mine: Record<string, { worth: number; remaining: number[] }> = {};
    casts[op] = mine;
    let ult = 0;
    let bs = 0;
    for (const sk of ctx.kits.get(op)?.skills ?? []) {
      if (sk.followUpOnly || (sk.kind !== "ultimate" && sk.kind !== "battle")) continue;
      const start = earliestStart(ctx, s0, { operator: op, skill: sk.skillId });
      if ("error" in start || start.frame + PROBE_STEP > until) continue;
      const c = curve(apply(ctx, s0, { operator: op, skill: sk.skillId, at: start.frame }), start.frame);
      // Against the attacks alone at the same frames (those from the cast's start on).
      const gained = c.map((d, i) => d - (base[Math.min(steps, i + Math.round(start.frame / PROBE_STEP))] as number));
      const worth = Math.max(0, gained.at(-1) as number);
      const remaining: number[] = [];
      for (const g of gained) remaining.push(Math.min(remaining.at(-1) ?? worth, Math.max(0, worth - g)));
      mine[sk.skillId] = { worth, remaining };
      const cost = skillCosts(ctx, op, sk.skillId, 0);
      if (sk.kind === "ultimate" && cost.energyCost > 0) ult = Math.max(ult, worth / cost.energyCost);
      if (sk.kind === "battle" && cost.spCost > 0) bs = Math.max(bs, worth / cost.spCost);
    }
    energy[op] = maxEnergy(ctx, op) > 0 ? ult : 0;
    if (bs > 0) spPrices.push(bs);
  }
  const sp = spPrices.length ? spPrices.reduce((a, x) => a + x, 0) / spPrices.length : 0;
  return { energy, sp, horizon, casts };
}

/** How long a probe's attacks run (resourcePrices), and the taper of the resources' worth before the fight's end: 10 s (a search setting). */
const PROBE_FRAMES = 10 * FPS;
/** The probe's time step for what of a cast's worth is still to come: half a second. */
const PROBE_STEP = 15;

/**
 * What a state holds beyond its damage, × `weight`: its unspent ultimate energy and SP at the prices (falling
 * linearly to 0 over the prices' horizon before the fight's end), and what the probed casts of the last horizon
 * have still to deal by the probe (so casting turns the resources' worth into a cast's, not into nothing until its
 * damage lands: Laevatain's ultimate deals little itself, its enhanced attacks a lot).
 */
export function resourceValue(ctx: TimelineContext, prices: ResourcePrices, state: TimelineState, weight: number): number {
  const left = ctx.scenario.durationFrames - state.frame;
  if (weight === 0 || left <= 0) return 0;
  let v = Math.min(SP.max, state.sp) * prices.sp;
  for (const b of ctx.scenario.team) v += (state.energy[b.operator] ?? 0) * (prices.energy[b.operator] ?? 0);
  v *= Math.min(1, left / prices.horizon);
  for (let i = state.casts.length - 1; i >= 0; i--) {
    const c = state.casts[i] as TimelineState["casts"][number];
    const age = state.frame - c.frame;
    if (age >= prices.horizon) break;
    const r = prices.casts[c.operator]?.[c.skill]?.remaining;
    if (r) v += r[Math.floor(age / PROBE_STEP)] ?? 0;
  }
  return v * weight;
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
  if (o.crit === "rolled" || o.crit === "expected" || o.crit === "distribution") {
    const crits = critTriggers(data, scenario);
    if (crits.length) out.push(`crit-triggered effects (${crits.join("; ")})${o.crit === "expected" ? ": ranked with rolled crits" : ""}`);
  }
  return out;
}

/**
 * The team's kit triggers (own or worn) that listen to crits (`on: {event: hit, crit}`), as "operator: trigger IDs"
 * per operator. With expected crits no hit counts as a crit (design/damage.md "Crit modes"), so they never fire.
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
  /**
   * How much the beam counts a state's unspent ultimate energy and SP at their probed prices (resourceValue; default
   * VALUE_WEIGHT; 0: damage so far alone, the ranking before 2026-11-14).
   */
  readonly valueWeight?: number;
  /**
   * Drop a state another of its layer dominates (docs/design/search.md "Pruning the search"): the same in everything but SP,
   * returned SP and ultimate energy (stateKeyer `amounts`), with at least as much committed damage, SP and every
   * operator's energy and no more returned SP. One battle only (no random outcomes); never a state on the guide's line.
   */
  readonly dominance?: boolean;
  /**
   * Branch and bound: drop a state whose committed damage plus this bound on what it can still add (remainingBound)
   * can't beat the most committed damage found so far. Never a state on the guide's line, whose shortfalls are counted
   * (`boundMisses`: the bound wasn't admissible there).
   */
  readonly bound?: UpperBound;
  /**
   * Chains as macro actions (docs/design/search.md "Payoffs and chains", phase 3): where a chain's first step is among a
   * node's choices, the whole chain is one more choice, played from the node's own state at its steps' earliest
   * frames (playMacros); its child is the state after its last step. Not in a loop's rounds (SearchHooks.stopAt).
   */
  readonly macros?: readonly MacroNode[];
  /**
   * With macros or skeletons (SearchHooks.guides): nodes whose rotation played a macro or a skeleton's own action are
   * kept in a share of their own, up to this many a layer (default half the beam width) on top of the beam's
   * (prunePools), so the rest of the beam is the search without them.
   */
  readonly extraBeam?: number;
  /**
   * A setup-aware value (docs/design/search.md "Payoffs and chains", phase 3): a node's score adds what the pieces it holds
   * are worth to the payoffs it can still cast while they're on (setupValue), × `setupWeight` (default the value
   * weight, or VALUE_WEIGHT when that's 0).
   */
  readonly setup?: SetupTable;
  readonly setupWeight?: number;
  /**
   * With `setup`: the setup value ranks only the beam's extra share (prunePools; up to `extraBeam` nodes a layer that
   * the main share, ranked as without it, dropped, and their children), so the search finds at least as much as without it.
   */
  readonly setupShare?: boolean;
}

/** The extra share's children a later bucket keeps waiting, × its width (search: push). */
const EXTRA_PENDING = 4;

/** SearchOptions.valueWeight's default (measured 2026-11-14: docs/design/search.md "How the beam ranks"). */
export const VALUE_WEIGHT = 0.5;

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
  readonly counts: {
    readonly compared: number;
    readonly merged: number;
    readonly family: number;
    readonly pruned: number;
    /** Dropped for a state of its layer that dominates it (SearchOptions.dominance). */
    readonly dominated: number;
    /**
     * Children dropped by the bound (SearchOptions.bound); states on the guide's line under it while the guide's own
     * damage would still have beaten the best found (the bound wasn't admissible there: never dropped).
     */
    readonly bounded: number;
    readonly boundMisses: number;
    /** Children made by a macro (SearchOptions.macros: a chain played as one choice). */
    readonly macros: number;
  };
  /** The scenario's random outcomes (randomOutcomes); empty: deterministic, one battle is the result. */
  readonly random: readonly string[];
  /** Seeds of the battles every candidate was ranked over (one seed without random outcomes). */
  readonly seeds: readonly number[];
  /** The crit mode the battles (and `result`, `spread`) were played in: the scenario's, or rolled for crit-triggered effects (searchCritMode). */
  readonly crit: CritMode;
  /** What the beam ranked by: the mean of the seeded battles, or a percentile (SearchOptions.percentile). */
  readonly rankedBy: "mean" | { readonly percentile: number };
  /** The found rotation's damage, or with random outcomes the statistic of its seeded battles' (the beam ranks by that plus the resources' worth: resourceValue). */
  readonly score: number;
  /** With random outcomes: the found rotation's distribution over SearchOptions.runs battles (rotationSpread). */
  readonly spread?: RotationSpread;
  /** With SearchHooks.stopAt: every rotation that ended at a step it chose, with its state (the first battle's), in the order found. */
  readonly stops?: readonly { readonly rotation: readonly RotationAction[]; readonly state: TimelineState }[];
}

/** One beam width's search in searchBeams. */
export interface BeamRun {
  readonly beamWidth: number;
  /** SearchResult.score of its rotation. */
  readonly score: number;
  readonly expanded: number;
  readonly capped: boolean;
  /** SearchResult.counts. */
  readonly counts: SearchResult["counts"];
}

/** The best of several beam widths' searches (searchBeams), with what each found. */
export interface BeamsResult extends SearchResult {
  /** The beam width that found it. */
  readonly beamWidth: number;
  /** Every width's search, in the order run. */
  readonly beams: readonly BeamRun[];
  /** How far apart the widths' scores are: (best − worst) / best (0: all found the same; widths after the first are guided by the best before, so the worst is the first's). */
  readonly beamSpread: number;
}

/**
 * The search at several beam widths (e.g. w/2, w, 2w: efsim search's default), the best result and how far the others
 * fell short. A beam search's result alone isn't monotone in its width (review round two: si-laevatain moved ±4.5%
 * between widths 12 and 48), so each width after the first keeps a place for the best rotation found so far
 * (SearchHooks.guide, 2026-11-14): it finds at least as much, and the spread is how much the wider beams still found
 * on top. `onBeam` sees each width's result as it's done (the CLI times them).
 */
export function searchBeams(
  data: GameData,
  scenario: Omit<TimelineScenario, "rotation">,
  options: SearchOptions & {
    readonly beams: readonly number[];
    /**
     * More guides for every width (skeletons.ts: the payoff table's chains scheduled by value per resource), after the
     * narrower widths' best; the best of them is the bound's incumbent (with `damage`).
     */
    readonly skeletons?: readonly { readonly rotation: readonly RotationAction[]; readonly damage: number }[];
  },
  onBeam?: (r: SearchResult, beamWidth: number) => void,
): BeamsResult {
  const { beams: widths, skeletons, ...rest } = options;
  const extra = skeletons?.length ? { guides: skeletons.map((x) => x.rotation), incumbent: Math.max(...skeletons.map((x) => x.damage)) } : {};
  if (widths.length === 0) throw new EngineError("searchBeams: no beam widths");
  let best: { r: SearchResult; w: number } | undefined;
  const beams: BeamRun[] = [];
  for (const w of widths) {
    if (!Number.isInteger(w) || w < 1) throw new EngineError(`beam width must be a whole number ≥ 1, not ${w}`);
    // Guided by the best narrower width's rotation: a wider beam finds at least as much (SearchHooks.guide).
    const r = search(data, scenario, { ...rest, beamWidth: w }, { ...extra, ...(best ? { guide: best.r.rotation, guideScore: best.r.score } : {}) });
    onBeam?.(r, w);
    beams.push({ beamWidth: w, score: r.score, expanded: r.expanded, capped: r.capped, counts: r.counts });
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
  /** The dominance key (stateKeyer `amounts`, dominance): SP, returned SP and ultimate energy left out (compared as amounts). */
  readonly amounts?: boolean;
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
  cast: castRef, detached: true, launchAt: true, pinned: true, loggedMs: true,
} as const;

/** An event with a cast index in it (hit, status and cast events), from the end of the cast list. */
const eventKey = (e: BattleEvent, env: KeyEnv) => ("cast" in e && e.cast !== undefined ? { ...e, cast: env.rel(e.cast) } : e);

/** A cast's alternatives (castSkill: `<cast index>:<branch>:<n>`; a trigger's start with its owner instead). */
const branchKey = (b: string, env: KeyEnv) => b.replace(/^(\d+):/, (_, i: string) => `${env.rel(Number(i))}:`);

/** Each kind of scheduled item: everything about it decides what it does when it's due, but a replayed landing's reference. */
const SCHEDULED_KEY: { readonly [K in Scheduled["kind"]]: KeyRules<Extract<Scheduled, { kind: K }>> } = {
  hit: {
    ...HEADER_KEY, operator: true, skillId: true, hitId: true, sp: true, spKind: true, spSource: true, usesUp: true, eventCount: true, eventSource: true,
    controlledAtCast: (c, env) => (env.loose ? undefined : c), trigger: true, branch: branchKey, fixed: true, snapshot: true, firstTickOf: true, ref: "a replayed landing's reference, which no search sets",
    deferred: true, damageFrame: "a replayed landing's damage frame, which no search sets", landedOf: true,
  },
  action: { ...HEADER_KEY, owner: true, trigger: true, event: eventKey, origin: true, awaited: true, afterHits: true },
  energy: { ...HEADER_KEY, operator: true, amount: true, if: true },
  jump: { ...HEADER_KEY, operator: true, from: true, to: true, end: true, then: true, landing: true },
  burst: { ...HEADER_KEY, event: true, fromKind: true, fromCast: (i, env) => env.rel(i) },
  enemyAction: { ...HEADER_KEY, act: true, target: true, element: true },
  auto: { ...HEADER_KEY, operator: true, step: true },
};
const SCHEDULED_KINDS = Object.keys(SCHEDULED_KEY) as Scheduled["kind"][];

/**
 * The scheduled list as each kind's items, in order: the order within a kind is what advance's ties go by (the first
 * scheduled), how kinds interleave isn't (each kind has its own place in a frame: docs/design/timeline.md "Order within a frame").
 */
function scheduledKey(list: readonly Scheduled[], env: KeyEnv): Record<string, unknown> {
  return Object.fromEntries(SCHEDULED_KINDS.map((k) => [k, list.filter((x) => x.kind === k).map((x) => project(x, SCHEDULED_KEY[k] as KeyRules<typeof x>, env))]));
}

/** A timed buff: everything about it decides what it does (its layers, ticks, records, recipients, the cast it belongs to). */
const BUFF_KEY: KeyRules<ActiveBuff> = {
  id: true, stackGroup: true, owner: true, target: true, appliedAt: true, expiresAt: true, modifiers: true, attrs: true, categories: true, recipients: true,
  excluded: true, maxLayers: true, maxInstances: true, priority: true, consumedBy: true, cast: (i, env) => env.rel(i),
  // Read only while `frame < until` (buffs.ts modifiersAt) or to cut it shorter (casting.ts): over, it's as if it had none.
  whileCasting: (w, env) => (w.until > env.frame ? w : undefined),
  blocksEnergy: true, runsThroughFreeze: true, every: true, nextTick: true, noTickAtEnd: true, endsWithCast: (i, env) => env.rel(i), skipped: true, gameBuff: true, sharedTimer: true, link: true,
  basicAttack: true, records: true, snapshot: true,
  createdBy: "a record of the skill and press that made it, for analyses; nothing in the fight reads it",
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
  sp: (v, env) => (env.amounts ? undefined : round(v)),
  spReturned: (v, env) => (env.amounts ? undefined : round(v)),
  energy: (e, env) => (env.amounts ? undefined : Object.fromEntries(Object.entries(e).map(([k, v]) => [k, round(v)]))),
  // Read as "> frame" (resources.ts gainEnergy) and set anew (casting.ts).
  energyBlockedUntil: (e, env) => entries(e, (f) => f > env.frame),
  energyOverflow: "a statistic (energy lost to a full bar): nothing in the fight reads it",
  energyGained: "a statistic (energy gained by source, for the rules' diagnosis): nothing in the fight reads it",
  energySpent: "a statistic (energy taken from the bar): nothing in the fight reads it",
  spOverflow: "a statistic (SP granted past the cap): nothing in the fight reads it",
  // Read through windowOpen (`until < frame`: closed) or with `until >= frame`, but a follow-up combo's count (endedWindowsRead).
  comboWindow: (w, env) => entries(w, (x, k) => x.until >= env.frame || env.scenario.endedWindowsRead.has(k)),
  // Read by any later `element: "window"` application, however long ago it was set.
  comboTrigger: true,
  // Read as max(frame, it) (resources.ts spAt, afterRegen; timing.ts) and raised with max (casting.ts).
  spPausedUntil: deadline,
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
  enemyFrozenBy: (e, env) => entries(e, (f) => f > env.frame),
  // Staggered while `until > frame`; once it's over the bar counts as full (dealPoise); finisherUsed is read only while Staggered.
  stagger: (s, env) => (s.until !== null && s.until > env.frame ? s : { poise: s.until !== null ? env.scenario.maxPoise : s.poise }),
  // Read only from their start to their end (clock.ts slowDown, which drops the ended ones).
  slowdowns: (d, env) => d.filter((x) => x.start + x.scales.length > env.frame),
  // Who applied the infliction's stacks (Infliction.by) is a record nothing in the fight reads.
  enemy: (e) => (e.infliction?.by ? { ...e, infliction: { element: e.infliction.element, stacks: e.infliction.stacks, expiresAt: e.infliction.expiresAt } } : e),
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
export function stateKeyer(ctx: TimelineContext, loose = false, amounts = false): (s: TimelineState) => string {
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
    return canonical(project(s, STATE_KEY, { frame: s.frame, rel: (i) => n - i, live: liveCasts(s), scenario, loose, amounts }));
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
function prune(nodes: readonly Node[], n: number, counts: { merged: number; family: number; pruned: number; dominated: number }, keepsPlace: (guide: number) => boolean = () => true): Node[] {
  const byKey = new Map<string, Node>();
  for (const x of nodes) {
    const y = byKey.get(x.key);
    // A guide's place goes to an equivalent state that's kept instead (the same choices follow: SearchHooks.guides).
    const z = !y || x.score > y.score ? x : y;
    const guides = y ? mergeGuides(x.guides, y.guides) : x.guides;
    byKey.set(x.key, guides && !sameGuides(guides, z.guides) ? { ...z, guides } : z);
  }
  counts.merged += nodes.length - byKey.size;
  const undominated = dominance([...byKey.values()], counts);
  // Stable: ties keep generation order (deterministic).
  const sorted = undominated.sort((a, b) => b.score - a.score);
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
  // Each guide's line stays (in the last places, in the guides' order) when the score alone would drop it.
  let last = n - 1;
  for (const g of guideIndices(sorted)) {
    if (!keepsPlace(g) || last < 0) continue;
    const guide = sorted.find((x) => x.guides?.[g] !== undefined) as Node;
    if (!kept.includes(guide)) kept[last--] = guide;
  }
  counts.pruned += sorted.length - n;
  // Those the best n by score would have kept.
  const chosen = new Set(kept);
  counts.family += sorted.slice(0, n).filter((x) => !chosen.has(x)).length;
  return kept.sort((a, b) => b.score - a.score);
}

/**
 * Whether state `x` dominates `y` (same dominance key, stateKeyer `amounts`): at least as much committed damage, SP and every operator's
 * ultimate energy, and no more returned SP (which is spent first and gives no energy). Exact for the fight: nothing
 * reads SP or energy but the gates (enough to cast) and the energy a spend gives, and gains are capped sums, so every
 * rotation legal from b is legal from a at the same frames and deals the same from there (docs/design/search.md "Pruning the
 * search").
 */
export function dominatesState(x: TimelineState, xDamage: number, y: TimelineState, yDamage: number): boolean {
  const eps = 1e-6;
  if (xDamage < yDamage - eps || x.sp < y.sp - eps || x.spReturned > y.spReturned + eps) return false;
  for (const op of Object.keys(y.energy)) if ((x.energy[op] ?? 0) < (y.energy[op] ?? 0) - eps) return false;
  return true;
}

const dominates = (a: Node, b: Node) => dominatesState(a.states[0] as TimelineState, a.damage, b.states[0] as TimelineState, b.damage);

/** The nodes no other dominates (SearchOptions.dominance), in their order; a node on the guide's line always stays. */
function dominance(nodes: readonly Node[], counts: { dominated: number }): Node[] {
  const groups = new Map<string, Node[]>();
  for (const x of nodes) if (x.dom !== undefined) groups.set(x.dom, [...(groups.get(x.dom) ?? []), x]);
  const drop = new Set<Node>();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    for (const b of g) {
      if (b.guides !== undefined) continue;
      if (g.some((a) => a !== b && !drop.has(a) && dominates(a, b))) drop.add(b);
    }
  }
  counts.dominated += drop.size;
  return drop.size ? nodes.filter((x) => !drop.has(x)) : [...nodes];
}

interface Node {
  /** The same rotation's state in each seeded battle (the first: the scenario's own seed, which proposes the actions). */
  readonly states: readonly TimelineState[];
  readonly rotation: readonly RotationAction[];
  /** stateKey of every state. */
  readonly key: string;
  /** familyKey of the first state (prune). */
  readonly family: string;
  /** The statistic of committed damage over the battles. */
  readonly damage: number;
  /** What the beam ranks it by: the statistic of committed damage plus the resources' worth (resourceValue) over the battles. */
  readonly score: number;
  /** On guides' lines (SearchHooks.guides): per guide (its index), how many of its actions the rotation (or an equivalent state's) has played. */
  readonly guides?: Readonly<Record<number, number>>;
  /** The dominance key (stateKeyer `amounts`) of the first state, with SearchOptions.dominance. */
  readonly dom?: string;
  /**
   * Its rotation played a macro (SearchOptions.macros) or a guide's action that wasn't a choice (a skeleton's:
   * SearchHooks.guides): it's in the beam's extra share (prunePools).
   */
  readonly extra?: true;
  /** With SearchOptions.setupShare: the score with the setup value, which ranks the extra share. */
  readonly alt?: number;
}

/**
 * With macros or skeletons, a layer's nodes in two shares. The first: those whose rotation played neither a macro
 * nor a skeleton's own action, kept exactly as the search without them keeps them (only the first guide, the
 * narrower beams' best, keeping a place), so the search finds at least what it finds without them. The second, up to
 * `extra` more: the others, and those of the first on a skeleton's line it didn't keep (every guide keeps a place
 * here); a state of theirs equivalent to a kept one of the first share and no better is left out. With `alt`
 * (SearchOptions.setupShare), every node the first share drops is a candidate for the second, which ranks by the
 * score with the setup value.
 */
function prunePools(nodes: readonly Node[], n: number, extra: number, primary: number, counts: { merged: number; family: number; pruned: number; dominated: number }, alt = false): Node[] {
  const plain = prune(nodes.filter((x) => !x.extra), n, counts, (g) => g === primary);
  const kept = new Map(plain.map((x) => [x.key, x.score]));
  // Those that move to the second share stay there (their children too).
  const others = nodes
    .filter((x) => (x.extra || (!kept.has(x.key) && (alt || Object.keys(x.guides ?? {}).some((g) => Number(g) !== primary)))) && !((kept.get(x.key) ?? -Infinity) >= x.score))
    .map((x): Node => (x.extra ? x : { ...x, extra: true }))
    // With setupShare, ranked by the score with the setup value.
    .map((x) => (alt && x.alt !== undefined ? { ...x, score: x.alt } : x));
  return [...plain, ...prune(others, extra, counts)];
}

/** Two nodes' guide positions as one (an equivalent state's: the furthest along each guide). */
function mergeGuides(a: Node["guides"], b: Node["guides"]): Node["guides"] {
  if (!a) return b;
  if (!b) return a;
  const out: Record<number, number> = { ...a };
  for (const [g, p] of Object.entries(b)) out[Number(g)] = Math.max(out[Number(g)] ?? -1, p);
  return out;
}

function sameGuides(a: Node["guides"], b: Node["guides"]): boolean {
  if (!a || !b) return a === b;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((g) => a[Number(g)] === b[Number(g)]);
}

/** The guides any of the nodes is on, in the guides' order. */
function guideIndices(nodes: readonly Node[]): number[] {
  const out = new Set<number>();
  for (const x of nodes) for (const g of Object.keys(x.guides ?? {})) out.add(Number(g));
  return [...out].sort((a, b) => a - b);
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
export function searchRotation(data: GameData, scenario: Omit<TimelineScenario, "rotation">, options: SearchOptions = {}, hooks: SearchHooks = {}): SearchResult {
  return search(data, scenario, options, hooks);
}

/** What a caller adds to a search (searchBeams: the narrower widths' best; searchLoop: the rotation so far). */
export interface SearchHooks {
  /** Actions every rotation starts with, applied as recorded from the fight's start: the search goes on from there. */
  readonly prefix?: readonly RotationAction[];
  /**
   * A rotation the beam keeps a place for, so that the search finds at least as much (searchBeams: the best of the
   * narrower widths). It must be one this search can make (the same scenario and options: a found rotation).
   */
  readonly guide?: readonly RotationAction[];
  /**
   * More rotations the beam keeps a place for, each its own (after `guide`, which is the first): searchBeams' skeletons
   * (docs/design/search.md "Payoffs and chains", phase 3). Any legal rotation of the scenario: where a guide's next action
   * isn't among a node's choices it's added to them (a skeleton waits where the search's choices wouldn't).
   */
  readonly guides?: readonly (readonly RotationAction[])[];
  /** Damage some rotation is known to reach (the best skeleton's): with SearchOptions.bound, a state that can't beat it is cut from the start. */
  readonly incumbent?: number;
  /** The guide's damage (its search's score): with SearchOptions.bound, a state on its line under the bound is a miss only when this would beat what's found. */
  readonly guideScore?: number;
  /**
   * Steps after which a rotation ends (searchLoop: the boundary ultimate's next cast, or with `sync` the first step after
   * which every ultimate is ready again), given the step, the state after it (the first battle's) and the rotation up
   * to and including it: such a child isn't expanded or kept in the beam; it's returned in SearchResult.stops (and
   * still counts for the best rotation).
   */
  readonly stopAt?: (step: RotationAction, state: TimelineState, rotation: readonly RotationAction[]) => boolean;
  /**
   * Whether a rotation may take an action next, given the rotation so far (searchLoop with `sync`: a lead ultimate
   * once a round and none in the opener, so that the beam holds them for the burst instead of casting each the moment
   * it's ready): those it refuses aren't choices (legalActions).
   */
  readonly allow?: (action: RotationAction, rotation: readonly RotationAction[]) => boolean;
  /**
   * With `prefix`: the leading hits it landed before this frame are left out of every state the search makes
   * (searchLoop: a round's start), so that each node doesn't carry them; their damage still counts (committedDamage's
   * `landedBefore`): the search finds the same, to the bit. The best rotation's `result` is replayed in full.
   */
  readonly hitsFrom?: number;
}

function search(data: GameData, given: Omit<TimelineScenario, "rotation">, options: SearchOptions, hooks: SearchHooks = {}): SearchResult {
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
  const weight = options.valueWeight ?? VALUE_WEIGHT;
  const prices = weight === 0 ? undefined : resourcePrices(data, scenario);
  const setup = options.setup;
  const setupWeight = options.setupWeight ?? (weight || VALUE_WEIGHT);
  const setupShare = setup !== undefined && options.setupShare === true;
  // Dominance compares one battle's amounts (with random outcomes each node holds several: not done).
  const domKey = options.dominance && k === 1 ? stateKeyer(ctx, false, true) : undefined;
  const bound = options.bound;
  const node = (states: readonly TimelineState[], rotation: readonly RotationAction[]): Node => {
    const damages = states.map((s, i) => committedDamage(ctxs[i] as TimelineContext, s, landedBefore[i]));
    const scores = prices ? states.map((s, i) => (damages[i] as number) + resourceValue(ctxs[i] as TimelineContext, prices, s, weight)) : damages;
    // The setup value: in the score, or with setupShare only in the extra share's ranking (`alt`).
    const setups = setup ? states.map((s, i) => setupValue(ctxs[i] as TimelineContext, setup, s, setupWeight)) : undefined;
    const withSetup = setups ? scores.map((x, i) => x + (setups[i] as number)) : scores;
    return {
      states, rotation, family: familyKey(states[0] as TimelineState), key: states.map((s, i) => (keyers[i] as (s: TimelineState) => string)(s)).join("\n"), damage: statistic(damages, percentile), score: statistic(setupShare ? scores : withSetup, percentile),
      ...(setupShare ? { alt: statistic(withSetup, percentile) } : {}),
      ...(domKey ? { dom: domKey(states[0] as TimelineState) } : {}),
    };
  };
  const buckets = new Map<number, Node[]>();
  // The extra share's children waiting in a later bucket (a macro's land up to seconds ahead, many a layer): beyond
  // twice EXTRA_PENDING × its width, cut to the best EXTRA_PENDING × its width (and every guide's line), so they don't
  // fill the memory. The main share's are never cut before their bucket.
  const extraCap = EXTRA_PENDING * (options.extraBeam ?? Math.ceil(beam / 2));
  const extraPending = new Map<number, number>();
  const push = (n: Node) => {
    const b = Math.floor((n.states[0] as TimelineState).frame / bucketFrames);
    let list = buckets.get(b) ?? [];
    list.push(n);
    if (n.extra) {
      const pending = (extraPending.get(b) ?? 0) + 1;
      extraPending.set(b, pending);
      if (pending > 2 * extraCap) {
        const extras = list.filter((x) => x.extra).sort((x, y) => y.score - x.score);
        const keep = new Set(extras.filter((x, i) => i < extraCap || x.guides !== undefined));
        list = list.filter((x) => !x.extra || keep.has(x));
        extraPending.set(b, keep.size);
      }
    }
    buckets.set(b, list);
  };
  const guideList = [...(hooks.guide ? [hooks.guide] : []), ...(hooks.guides ?? [])];
  const same = (a: RotationAction | undefined, b: RotationAction) => a !== undefined && a.operator === b.operator && a.skill === b.skill && a.at === b.at;
  const prefix = hooks.prefix ?? [];
  const rootGuides: Record<number, number> = {};
  guideList.forEach((g, i) => {
    if (prefix.every((a, j) => same(g[j], a))) rootGuides[i] = prefix.length;
  });
  // Hits landed before hooks.hitsFrom (the leading run of the root's hits, in the order they landed) are dropped from the
  // root: nothing in the fight reads landed hits, and every node would otherwise carry its own copy of them all (a
  // loop's late rounds ran out of memory). Their sum, in the same order, starts each node's (committedDamage).
  const starts = ctxs.map((c) => prefix.reduce((st, a) => apply(c, st, a), init(c)));
  const cuts = starts.map((st) => (hooks.hitsFrom === undefined ? 0 : ((i) => (i < 0 ? st.hits.length : i))(st.hits.findIndex((h) => h.frame >= (hooks.hitsFrom as number)))));
  const landedBefore = starts.map((st, i) => {
    let sum = 0;
    for (let j = 0; j < (cuts[i] as number); j++) sum += (st.hits[j] as TimelineState["hits"][number]).exact;
    return sum;
  });
  const root = { ...node(starts.map((st, i) => (cuts[i] ? { ...st, hits: st.hits.slice(cuts[i]) } : st)), prefix), ...(Object.keys(rootGuides).length ? { guides: rootGuides } : {}) };
  push(root);
  let best: Node = root;
  let expanded = 0;
  const counts = { compared: 0, merged: 0, family: 0, pruned: 0, dominated: 0, bounded: 0, boundMisses: 0, macros: 0 };
  const macros = options.macros?.length ? options.macros : undefined;
  const extraBeam = options.extraBeam ?? Math.ceil(beam / 2);
  const pools = macros !== undefined || (hooks.guides?.length ?? 0) > 0 || setupShare;
  const primary = hooks.guide ? 0 : -1;
  const nextBasic = (s: TimelineState, before: number) => nextBasicAttack(ctx, s, before);
  let capped = false;
  const stopAt = hooks.stopAt;
  const allow = hooks.allow;
  const stops: { rotation: readonly RotationAction[]; state: TimelineState }[] = [];
  while (buckets.size > 0 && expanded < maxExpansions) {
    const b = Math.min(...buckets.keys());
    let layer = buckets.get(b) as Node[];
    buckets.delete(b);
    // Children that stay in this bucket (casts at the same frame) are expanded in further rounds, under the same beam.
    while (layer.length > 0 && expanded < maxExpansions) {
      counts.compared += layer.length;
      const nodes = pools ? prunePools(layer, beam, extraBeam, primary, counts, setupShare) : prune(layer, beam, counts);
      layer = [];
      for (const n of nodes) {
        expanded++;
        const first = n.states[0] as TimelineState;
        // A swap takes no time: never two in a row (they'd loop within a frame); none at all unless asked for.
        const lastSwap = n.rotation.at(-1)?.skill === "swap";
        const choices = legalActions(ctx, first, allow ? (a) => allow(a, n.rotation) : undefined).filter((c) => c.action.skill !== "swap" || (swaps && !lastSwap));
        if (choices.length === 0 && n.damage > best.damage) best = n;
        // One child per choice; with SearchOptions.macros also one per chain whose first step is a choice (playMacros).
        const plays: { steps: RotationAction[]; first?: TimelineState; forced?: true }[] = choices.map((c) => ({ steps: [{ ...c.action, at: c.frame }] }));
        // A guide's next action that isn't a choice (a skeleton's: SearchHooks.guides) is one, when it's legal at its frame.
        for (const [g, p] of Object.entries(n.guides ?? {})) {
          const next = guideList[Number(g)]?.[p];
          if (!next || plays.some((x) => same(x.steps[0], next))) continue;
          const e = earliestStart(ctx, first, next);
          if (!("error" in e) && e.frame === next.at) plays.push({ steps: [next], forced: true });
        }
        if (macros && !stopAt) {
          const firsts = choices.filter((c) => c.action.skill !== "swap");
          for (const m of playMacros(ctx, first, macros, firsts, allow ? (a, played) => allow(a, [...n.rotation, ...played]) : undefined, nextBasic)) plays.push({ steps: [...m.actions], first: m.state });
        }
        for (const play of plays) {
          // Applied as recorded, with `at` the frame each starts, so the rotation replays to exactly these states.
          const states: TimelineState[] = [];
          for (let i = 0; i < k; i++) {
            const ci = ctxs[i] as TimelineContext;
            let si = n.states[i] as TimelineState;
            if (i === 0 && play.first) {
              states.push(play.first);
              continue;
            }
            let legal = true;
            for (const step of play.steps) {
              // The proposing battle found it legal; another may not (its dice went otherwise): then the child is dropped.
              if (i > 0 && "error" in earliestStart(ci, si, step)) {
                legal = false;
                break;
              }
              si = apply(ci, si, step);
            }
            if (!legal) break;
            states.push(si);
          }
          if (states.length < k) continue;
          const step = play.steps.at(-1) as RotationAction;
          const made = node(states, [...n.rotation, ...play.steps]);
          if (play.first) counts.macros++;
          let child: Node = n.extra || play.first || play.forced ? { ...made, extra: true } : made;
          if (n.guides) {
            const on: Record<number, number> = {};
            for (const [g, p] of Object.entries(n.guides)) if (play.steps.every((x, j) => same(guideList[Number(g)]?.[p + j], x))) on[Number(g)] = p + play.steps.length;
            if (Object.keys(on).length) child = { ...child, guides: on };
          }
          if (child.damage > best.damage) best = child;
          // Branch and bound: what it has committed and can still add against the most committed so far (a rotation
          // that stops acting deals exactly its committed damage, so that's reachable). One battle's bound: the mean
          // and a percentile of several are no more than their largest.
          if (bound && child !== best) {
            const most = Math.max(...states.map((st, i) => committedDamage(ctxs[i] as TimelineContext, st, landedBefore[i]) + remainingBound(bound, ctxs[i] as TimelineContext, st)));
            if (most < Math.max(best.damage, hooks.incumbent ?? 0) - 1e-6) {
              // The guide's line always stays; it's a miss (the bound wasn't admissible) only when the guide's own
              // final damage would have beaten what's found so far.
              if (child.guides !== undefined) {
                if (hooks.guideScore !== undefined && hooks.guideScore >= best.damage - 1e-6) counts.boundMisses++;
              } else {
                counts.bounded++;
                continue;
              }
            }
          }
          if (stopAt?.(step, states[0] as TimelineState, child.rotation)) {
            stops.push({ rotation: child.rotation, state: states[0] as TimelineState });
            continue;
          }
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
    score: best.damage,
    ...(random.length > 0 && runs > 0 ? { spread: rotationSpread(data, full, runs, seed0) } : {}),
    ...(stopAt ? { stops } : {}),
  };
}
