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
 * aren't chain steps; not finishers or plunging attacks, which need states
 * the timeline doesn't have yet).
 */
function nextBasics(data: GameData, state: TimelineState, operator: string): string[] {
  const out = new Set<string>();
  const chain = state.chainNext[operator];
  if (chain && chain.until >= state.frame) out.add(chain.skill);
  for (const s of data.kits.operators[operator]?.skills ?? []) {
    if (s.kind === "basic" && !s.chainStep && data.skills[s.skillId]?.timing?.specification === 1) out.add(s.skillId);
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
    s.slowdowns.map((x) => [x.start, x.scales.length, x.exempt]),
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
  readonly score: number;
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
  const buckets = new Map<number, Node[]>();
  const push = (n: Node) => {
    const k = Math.floor(n.state.frame / bucketFrames);
    const list = buckets.get(k) ?? [];
    list.push(n);
    buckets.set(k, list);
  };
  push({ state: start, rotation: [], score: 0 });
  let best: Node = { state: start, rotation: [], score: committedDamage(ctx, start) };
  let expanded = 0;
  while (buckets.size > 0 && expanded < maxExpansions) {
    const k = Math.min(...buckets.keys());
    let layer = buckets.get(k) as Node[];
    buckets.delete(k);
    // Children that stay in this bucket (casts at the same frame) are expanded in further rounds, under the same beam.
    while (layer.length > 0 && expanded < maxExpansions) {
      const nodes = prune(layer, beam);
      layer = [];
      for (const node of nodes) {
        expanded++;
        // A swap takes no time: never two in a row (they'd loop within a frame).
        const lastSwap = node.rotation.at(-1)?.skill === "swap";
        const choices = legalActions(ctx, node.state).filter((c) => !(lastSwap && c.action.skill === "swap"));
        if (choices.length === 0 && node.score > best.score) best = node;
        for (const c of choices) {
          const state = apply(ctx, node.state, c.action);
          // `at` is the frame it started, so the rotation replays exactly.
          const child: Node = { state, rotation: [...node.rotation, { ...c.action, at: c.frame }], score: committedDamage(ctx, state) };
          if (child.score > best.score) best = child;
          if (Math.floor(state.frame / bucketFrames) === k) layer.push(child);
          else push(child);
        }
      }
    }
  }
  return { rotation: best.rotation, result: simulate(data, { ...scenario, rotation: best.rotation }), expanded };
}
