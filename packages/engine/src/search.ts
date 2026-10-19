// Rotation search: a driver on the stepping API (docs/design.md#stepping-api)
// that generates the action list while the fight runs, instead of reading a
// recorded one. Every decision goes through the same apply / earliestStart
// as recorded rotations, so a found rotation is legal by construction and
// replays to the same numbers with `simulate`.

import type { GameData } from "./model.ts";
import {
  advance,
  apply,
  createContext,
  earliestStart,
  init,
  simulate,
  type RotationAction,
  type TimelineContext,
  type TimelineResult,
  type TimelineScenario,
  type TimelineState,
} from "./timeline.ts";

export interface Candidate {
  readonly action: RotationAction;
  /** Earliest frame it can start. */
  readonly frame: number;
}

/**
 * The basic attacks an attack input can be for an operator: the chain's
 * next step while it points at one, and the chain heads (basic attacks that
 * aren't chain steps), and finishers; not plunging attacks, which need a
 * jump the timeline doesn't have.
 */
function nextBasics(data: GameData, state: TimelineState, operator: string): string[] {
  const out = new Set<string>();
  const chain = state.chainNext[operator];
  for (const c of chain ? [chain, ...(chain.alternatives ?? [])] : []) if (c.until >= state.frame) out.add(c.skill);
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

/** Every action that can still happen, with its earliest legal start (stepping API: legal actions). */
export function candidateActions(ctx: TimelineContext, state: TimelineState): Candidate[] {
  const out: Candidate[] = [];
  const consider = (action: RotationAction) => {
    const s = earliestStart(ctx, state, action);
    if (!("error" in s) && s.frame <= ctx.scenario.durationFrames) out.push({ action, frame: s.frame });
  };
  for (const b of ctx.scenario.team) {
    const op = b.operator;
    for (const s of ctx.data.kits.operators[op]?.skills ?? []) if (s.kind !== "basic") consider({ operator: op, skill: s.skillId });
    if (op === state.controlled) for (const skill of nextBasics(ctx.data, state, op)) consider({ operator: op, skill });
    else if (hasBasics(ctx.data, op)) consider({ operator: op, skill: "swap" });
  }
  return out;
}

/**
 * The choices at the next decision point: the actions that can start
 * soonest, plus the controlled operator's next basic attack even if later
 * (taking it defers everything else).
 */
export function legalActions(ctx: TimelineContext, state: TimelineState): Candidate[] {
  const all = candidateActions(ctx, state);
  if (all.length === 0) return [];
  const soonest = Math.min(...all.map((c) => c.frame));
  const basics = new Set(nextBasics(ctx.data, state, state.controlled));
  return all.filter((c) => c.frame === soonest || (c.action.operator === state.controlled && basics.has(c.action.skill)));
}

/** Damage the state has committed within the fight: landed hits plus everything already on its way. */
export function committedDamage(ctx: TimelineContext, state: TimelineState): number {
  const end = advance(ctx, state, ctx.scenario.durationFrames);
  let total = 0;
  for (const h of end.hits) total += h.exact;
  return total;
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
    const ctx = createContext(data, { ...scenario, rotation: [], startEnergy: { ...scenario.startEnergy, [op]: "full" }, enemyActions: [] });
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

export interface SearchResult {
  readonly rotation: readonly RotationAction[];
  /** The best rotation replayed with `simulate`. */
  readonly result: TimelineResult;
  readonly expanded: number;
}

/**
 * What makes two states equivalent for the rest of the fight (not how they
 * got there): resources, positions in chains, windows, buffs, the enemy's
 * arts state and when each operator is free again. Damage already committed
 * is the score, not part of the key.
 */
function stateKey(s: TimelineState): string {
  const r = (x: number) => Math.round(x * 10) / 10;
  const last: Record<string, string> = {};
  for (const c of s.casts) last[c.operator] = c.skill;
  return JSON.stringify([
    s.frame,
    s.rng,
    s.enemyActions.length,
    s.enemyActions[0]?.frame,
    s.controlled,
    last,
    r(s.sp),
    r(s.spReturned),
    s.spPausedUntil,
    Object.entries(s.energy).map(([k, v]) => [k, r(v)]),
    s.energyBlockedUntil,
    s.acting,
    s.chainNext,
    s.readyAt,
    s.stacks,
    s.comboWindow,
    s.triggerState,
    s.buffs.map((b) => [b.owner, b.id, b.expiresAt]),
    s.enemy,
    s.pending.map((p) => [p.frame, p.operator, p.skillId, p.hitId, p.trigger?.id]),
    s.pendingEnergy,
    s.pendingActions.map((x) => [x.frame, x.owner, x.trigger]),
    s.pendingJumps,
    s.slowdowns.map((x) => [x.start, x.scales.length, x.exempt]),
    s.link,
  ]);
}

/** The best node per equivalent state, best first, at most `n`. */
function prune(nodes: readonly Node[], n: number): Node[] {
  const byKey = new Map<string, Node>();
  for (const x of nodes) {
    const k = stateKey(x.state);
    const y = byKey.get(k);
    if (!y || x.score > y.score) byKey.set(k, x);
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, n);
}

interface Node {
  readonly state: TimelineState;
  readonly rotation: readonly RotationAction[];
  /** What the beam ranks it by: committed damage, plus its resources' worth (SearchOptions.resourceWeight). */
  readonly score: number;
  readonly damage: number;
}

/**
 * Beam search over rotations for a team: at each decision point every legal
 * action is tried; per half-second bucket the best `beamWidth` states by
 * committed damage survive. Deterministic: ties keep generation order.
 */
export function searchRotation(data: GameData, scenario: Omit<TimelineScenario, "rotation">, options: SearchOptions = {}): SearchResult {
  const beam = options.beamWidth ?? 24;
  const bucketFrames = options.bucketFrames ?? 15;
  const maxExpansions = options.maxExpansions ?? 200_000;
  const ctx = createContext(data, { ...scenario, rotation: [] });
  const start = init(ctx);
  const weight = options.resourceWeight ?? 0;
  const values = weight > 0 ? resourceValues(data, scenario) : null;
  const node = (state: TimelineState, rotation: readonly RotationAction[]): Node => {
    const damage = committedDamage(ctx, state);
    if (!values) return { state, rotation, score: damage, damage };
    const left = Math.max(0, 1 - state.frame / ctx.scenario.durationFrames);
    const worth = state.sp * values.perSp + Object.entries(state.energy).reduce((t, [op, e]) => t + e * (values.perEnergy[op] ?? 0), 0);
    return { state, rotation, score: damage + weight * left * worth, damage };
  };
  const buckets = new Map<number, Node[]>();
  const push = (n: Node) => {
    const k = Math.floor(n.state.frame / bucketFrames);
    const list = buckets.get(k) ?? [];
    list.push(n);
    buckets.set(k, list);
  };
  push(node(start, []));
  let best: Node = node(start, []);
  let expanded = 0;
  while (buckets.size > 0 && expanded < maxExpansions) {
    const k = Math.min(...buckets.keys());
    let layer = buckets.get(k) as Node[];
    buckets.delete(k);
    // Children that stay in this bucket (casts at the same frame) are expanded in further rounds, under the same beam.
    while (layer.length > 0 && expanded < maxExpansions) {
      const nodes = prune(layer, beam);
      layer = [];
      for (const n of nodes) {
        expanded++;
        // A swap takes no time: never two in a row (they'd loop within a frame).
        const lastSwap = n.rotation.at(-1)?.skill === "swap";
        const choices = legalActions(ctx, n.state).filter((c) => !(lastSwap && c.action.skill === "swap"));
        if (choices.length === 0 && n.damage > best.damage) best = n;
        for (const c of choices) {
          const state = apply(ctx, n.state, c.action);
          // `at` is the frame it started, so the rotation replays exactly.
          const child = node(state, [...n.rotation, { ...c.action, at: c.frame }]);
          if (child.damage > best.damage) best = child;
          if (Math.floor(state.frame / bucketFrames) === k) layer.push(child);
          else push(child);
        }
      }
    }
  }
  return { rotation: best.rotation, result: simulate(data, { ...scenario, rotation: best.rotation }), expanded };
}
