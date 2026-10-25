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
import { allActions } from "./events.ts";
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
import type { Scheduled } from "./timeline/state.ts";
import { ofKind } from "./timeline/schedule.ts";

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
 * (taking it defers everything else), and its dive, which doesn't count
 * for what's soonest: a jump may start as soon as the current skill is
 * past its exclusive frames, so it would often be soonest and crowd the
 * other skills out of the choices.
 *
 * The controlled operator's basic attacks, its dive and the swaps (kept
 * even if later, or cheap) are judged in full; of the others, first only whether
 * they can start at the state's own frame (startsNow), which is much
 * cheaper than judging how much later they could. When any action can
 * start then, nothing starts sooner, and the others aren't choices; only
 * when none can are they judged in full. The same choices, in the same
 * order, as judging them all.
 */
export function legalActions(ctx: TimelineContext, state: TimelineState): Candidate[] {
  const actions = actionsToJudge(ctx, state);
  const basics = new Set(nextBasics(ctx.data, state, state.controlled));
  const dive = diveOf(ctx.data, state.controlled);
  const isDive = (a: RotationAction) => a.operator === state.controlled && a.skill === dive;
  const early = (a: RotationAction) => a.skill === "swap" || (a.operator === state.controlled && basics.has(a.skill)) || isDive(a);
  const judged: (Candidate | null | undefined)[] = actions.map((a) => (early(a) ? judge(ctx, state, a) : undefined));
  const inFight = state.frame <= ctx.scenario.durationFrames;
  // Then whether the others can start now: if any action can, the others that can't aren't choices.
  actions.forEach((a, i) => {
    if (judged[i] === undefined && inFight && startsNow(ctx, state, a)) judged[i] = { action: a, frame: state.frame };
  });
  const now = judged.some((c) => c?.frame === state.frame && !isDive(c.action));
  const all: Candidate[] = [];
  actions.forEach((a, i) => {
    // Only when nothing can start now: when the others could start.
    const c = judged[i] === undefined ? (now ? null : judge(ctx, state, a)) : judged[i];
    if (c) all.push(c);
  });
  if (all.length === 0) return [];
  const soonest = Math.min(...all.filter((c) => !isDive(c.action)).map((c) => c.frame));
  const out = all.filter((c) => c.frame === soonest || (c.action.operator === state.controlled && basics.has(c.action.skill)) || isDive(c.action));
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

/** Per state: its committed damage (states are never changed in place, so it's computed once per context). */
const committed = new WeakMap<TimelineState, { readonly ctx: TimelineContext; readonly total: number }>();

/** Damage the state has committed within the fight: landed hits plus everything already on its way. */
export function committedDamage(ctx: TimelineContext, state: TimelineState): number {
  const known = committed.get(state);
  if (known?.ctx === ctx) return known.total;
  // Advanced from a copy, so a memoised context doesn't keep the fight's end (every hit to come) for as long as the state lives.
  const end = advance(ctx, { ...state }, ctx.scenario.durationFrames);
  let total = 0;
  for (const h of end.hits) total += h.exact;
  committed.set(state, { ctx, total });
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
   * How much unspent SP and ultimate energy count when the beam compares
   * states (0: committed damage only). Each point is worth what the team's
   * own skills deal per point (resourceValues), fading out toward the
   * fight's end; the result is still ranked by damage alone.
   */
  readonly resourceWeight?: number;
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
}

/**
 * What a point of team SP and of each operator's ultimate energy is worth:
 * the best damage per point of a battle skill / ultimate cast alone at the
 * start. An ultimate whose worth is what it enables (Laevatain's Twilight)
 * deals little itself, so its energy is priced low.
 */
export function resourceValues(data: GameData, scenario: Omit<TimelineScenario, "rotation">): { readonly perSp: number; readonly perEnergy: Readonly<Record<string, number>> } {
  let perSp = 0;
  const perEnergy: Record<string, number> = {};
  for (const b of scenario.team) {
    const op = b.operator;
    const ctx = memoised(createContext(data, { ...scenario, rotation: [], startEnergy: { ...scenario.startEnergy, [op]: "full" }, enemyActions: [] }));
    const s0 = init(ctx);
    const base = committedDamage(ctx, s0);
    for (const skill of data.kits.operators[op]?.skills ?? []) {
      if ((skill.kind !== "battle" && skill.kind !== "ultimate") || skill.followUpOnly) continue;
      const action: RotationAction = { operator: op, skill: skill.skillId };
      if ("error" in earliestStart(ctx, s0, action)) continue;
      const s1 = apply(ctx, s0, action);
      const cast = s1.casts.at(-1);
      if (!cast) continue;
      const dealt = committedDamage(ctx, s1) - base;
      if (skill.kind === "battle") {
        const spent = s0.sp - cast.spAfter;
        if (spent > 0) perSp = Math.max(perSp, dealt / spent);
      } else {
        const spent = (s0.energy[op] ?? 0) - cast.energyAfter;
        if (spent > 0) perEnergy[op] = Math.max(perEnergy[op] ?? 0, dealt / spent);
      }
    }
  }
  return { perSp, perEnergy };
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
  /** The scenario's random outcomes (randomOutcomes); empty: deterministic, one battle is the result. */
  readonly random: readonly string[];
  /** Seeds of the battles every candidate was ranked over (one seed without random outcomes). */
  readonly seeds: readonly number[];
  /** The crit mode the battles (and `result`, `spread`) were played in: the scenario's, or rolled for crit-triggered effects (searchCritMode). */
  readonly crit: CritMode;
  /** What the beam ranked by: the mean of the seeded battles, or a percentile (SearchOptions.percentile). */
  readonly rankedBy: "mean" | { readonly percentile: number };
  /** With random outcomes: the found rotation's distribution over SearchOptions.runs battles (rotationSpread). */
  readonly spread?: RotationSpread;
}

/**
 * How a field takes part in the key that says when two states are equivalent
 * for the rest of the fight (stateKey): `true`, all of it; a function, the
 * part of it that counts; a string, the reason it doesn't count at all.
 * Every field of TimelineState (and of the records nested in it that the key
 * used to sample) must be classified, so a new field doesn't compile until
 * someone decides whether the search may merge states that differ in it.
 */
type KeyRule<T> = true | string | ((v: T) => unknown);
type KeyRules<T> = { readonly [K in keyof T]-?: KeyRule<T[K]> };

/** Rounded to 0.1: SP and energy reached by different paths differ in floating-point noise (a search policy: states this close are one). */
const round = (x: number) => Math.round(x * 10) / 10;

/** A scheduled item's header (ScheduledHeader): when it's due, on which clock, what it belongs to. */
const HEADER_KEY = { kind: true, frame: true, clock: true, cast: true, detached: true, launchAt: true, pinned: true } as const;

/** Each kind of scheduled item: everything about it decides what it does when it's due, but a replayed landing's reference. */
const SCHEDULED_KEY: { readonly [K in Scheduled["kind"]]: KeyRules<Extract<Scheduled, { kind: K }>> } = {
  hit: {
    ...HEADER_KEY, operator: true, skillId: true, hitId: true, sp: true, spKind: true, spSource: true, usesUp: true, eventCount: true, eventSource: true,
    controlledAtCast: true, trigger: true, branch: true, fixed: true, snapshot: true, ref: "a replayed landing's reference, which no search sets",
  },
  action: { ...HEADER_KEY, owner: true, trigger: true, event: true, origin: true, awaited: true, afterHits: true },
  energy: { ...HEADER_KEY, operator: true, amount: true, if: true },
  jump: { ...HEADER_KEY, operator: true, from: true, to: true, end: true, then: true, landing: true },
  burst: { ...HEADER_KEY, event: true, fromKind: true, fromCast: true },
  enemyAction: { ...HEADER_KEY, act: true, target: true, element: true },
};
const SCHEDULED_KINDS = Object.keys(SCHEDULED_KEY) as Scheduled["kind"][];

/**
 * The scheduled list as each kind's items, in order: the order within a kind is what advance's ties go by (the first
 * scheduled), how kinds interleave isn't (each kind has its own place in a frame: docs/design.md "Order within a frame").
 */
function scheduledKey(list: readonly Scheduled[]): Record<string, unknown> {
  return Object.fromEntries(SCHEDULED_KINDS.map((k) => [k, list.filter((x) => x.kind === k).map((x) => project(x, SCHEDULED_KEY[k] as KeyRules<typeof x>))]));
}

/** A timed buff: everything about it decides what it does (its layers, ticks, records, recipients, the cast it belongs to). */
const BUFF_KEY: KeyRules<ActiveBuff> = {
  id: true, stackGroup: true, owner: true, target: true, appliedAt: true, expiresAt: true, modifiers: true, attrs: true, categories: true, recipients: true,
  excluded: true, maxLayers: true, maxInstances: true, consumedBy: true, cast: true, whileCasting: true, blocksEnergy: true, every: true, nextTick: true,
  endsWithCast: true, skipped: true, gameBuff: true, sharedTimer: true, link: true, basicAttack: true, records: true, snapshot: true,
};

const STATE_KEY: KeyRules<TimelineState> = {
  frame: true,
  rng: true,
  sp: round,
  spReturned: round,
  energy: (e) => Object.fromEntries(Object.entries(e).map(([k, v]) => [k, round(v)])),
  energyBlockedUntil: true,
  comboWindow: true,
  spPausedUntil: true,
  spStops: true,
  controlled: true,
  acting: true,
  chainNext: true,
  readyAt: true,
  scheduled: scheduledKey,
  link: true,
  enemyFrozenUntil: true,
  stagger: true,
  slowdowns: true,
  enemy: true,
  buffs: (b) => b.map((x) => project(x, BUFF_KEY)),
  triggerState: true,
  stacks: true,
  // What the engine reads back of the cast list: each operator's last cast (an action without one falls back to it) and
  // the Link stacks a cast used (castLink, read by its hits and events); the next cast's index follows from the former.
  casts: (casts) => {
    const last: Record<string, [number, string]> = {};
    casts.forEach((c, i) => (last[c.operator] = [i, c.skill]));
    return { last, link: casts.flatMap((c, i) => (c.link !== undefined ? [[i, c.link]] : [])) };
  },
  hits: "what has landed is the score (committedDamage), not what comes next; recording buffs keep their own totals (ActiveBuff.records)",
  reactions: "the record of what the enemy's arts state did; nothing reads it back",
};

/** The parts of a record its rules say count (KeyRules), by field name. */
function project<T extends object>(v: T, rules: KeyRules<T>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(rules) as (keyof T & string)[]) {
    const rule = rules[k] as KeyRule<T[keyof T]>;
    if (typeof rule === "string" || v[k] === undefined) continue;
    out[k] = rule === true ? v[k] : rule(v[k]);
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

/**
 * What makes two states equivalent for the rest of the fight (not how they
 * got there): every field of the state that what comes next reads
 * (STATE_KEY). Damage already committed is the score, not part of the key.
 */
export function stateKey(s: TimelineState): string {
  return canonical(project(s, STATE_KEY));
}

/** The best node per equivalent state (in every seeded battle), best first, at most `n`. */
function prune(nodes: readonly Node[], n: number): Node[] {
  const byKey = new Map<string, Node>();
  for (const x of nodes) {
    const y = byKey.get(x.key);
    if (!y || x.score > y.score) byKey.set(x.key, x);
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, n);
}

interface Node {
  /** The same rotation's state in each seeded battle (the first: the scenario's own seed, which proposes the actions). */
  readonly states: readonly TimelineState[];
  readonly rotation: readonly RotationAction[];
  /** stateKey of every state. */
  readonly key: string;
  /** What the beam ranks it by: the statistic of committed damage plus resources' worth (SearchOptions.resourceWeight) over the battles. */
  readonly score: number;
  /** The statistic of committed damage over the battles. */
  readonly damage: number;
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
  const weight = options.resourceWeight ?? 0;
  const values = weight > 0 ? resourceValues(data, scenario) : null;
  const scoreOf = (c: TimelineContext, state: TimelineState, damage: number): number => {
    if (!values) return damage;
    const left = Math.max(0, 1 - state.frame / c.scenario.durationFrames);
    const worth = state.sp * values.perSp + Object.entries(state.energy).reduce((t, [op, e]) => t + e * (values.perEnergy[op] ?? 0), 0);
    return damage + weight * left * worth;
  };
  const node = (states: readonly TimelineState[], rotation: readonly RotationAction[]): Node => {
    const damages = states.map((s, i) => committedDamage(ctxs[i] as TimelineContext, s));
    const scores = values ? states.map((s, i) => scoreOf(ctxs[i] as TimelineContext, s, damages[i] as number)) : damages;
    return { states, rotation, key: states.map(stateKey).join("\n"), score: statistic(scores, percentile), damage: statistic(damages, percentile) };
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
  while (buckets.size > 0 && expanded < maxExpansions) {
    const b = Math.min(...buckets.keys());
    let layer = buckets.get(b) as Node[];
    buckets.delete(b);
    // Children that stay in this bucket (casts at the same frame) are expanded in further rounds, under the same beam.
    while (layer.length > 0 && expanded < maxExpansions) {
      const nodes = prune(layer, beam);
      layer = [];
      for (const n of nodes) {
        expanded++;
        const first = n.states[0] as TimelineState;
        // A swap takes no time: never two in a row (they'd loop within a frame).
        const lastSwap = n.rotation.at(-1)?.skill === "swap";
        const choices = legalActions(ctx, first).filter((c) => !(lastSwap && c.action.skill === "swap"));
        if (choices.length === 0 && n.damage > best.damage) best = n;
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
          if (child.damage > best.damage) best = child;
          if (Math.floor((states[0] as TimelineState).frame / bucketFrames) === b) layer.push(child);
          else push(child);
        }
      }
    }
  }
  const full: TimelineScenario = { ...scenario, rotation: best.rotation };
  const runs = options.runs ?? 50;
  return {
    rotation: best.rotation,
    result: simulate(data, full),
    expanded,
    random,
    seeds,
    crit,
    rankedBy: percentile === undefined ? "mean" : { percentile },
    ...(random.length > 0 && runs > 0 ? { spread: rotationSpread(data, full, runs, seed0) } : {}),
  };
}
