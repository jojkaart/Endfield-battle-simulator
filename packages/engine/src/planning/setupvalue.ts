// A setup-aware value for the beam (docs/design/search.md "Payoffs and chains", phase 3, part 3): what a state holds that a
// payoff it can still cast would use. The payoff table's ceilings (payoffs.ts) say, for each damaging step, which
// pieces (a buff, a reaction or physical status, Vulnerable or Link stacks) raise it and by how much (the piece's
// worth: what the ceiling loses without it); a state that holds such a piece while that step is ready to be cast
// before the piece ends is worth that much more to the beam, × the value weight. The probed counterpart of the
// resource value (search.ts resourceValue) for what builds up outside the resources. A search heuristic: never part
// of a result.

import type { PayoffReport, PlanStep } from "./payoffs.ts";
import { skillCosts, SP, skillAvailable, windowKey, FPS, type TimelineContext, type TimelineState } from "../core.ts";

/** How a bundle's piece is found in a state (by its payoffs.ts key) and what it's worth to its payoff. */
export interface SetupPiece {
  readonly key: string;
  readonly worth: number;
}

/** A payoff whose ceiling has a bundle: its step, what it costs, its pieces, and (a combo) its bare damage, worth an open window. */
export interface SetupPayoff {
  readonly step: PlanStep;
  readonly pieces: readonly SetupPiece[];
  /** At most what the pieces add together: the ceiling less the bare cast. */
  readonly cap: number;
  /** A combo's bare damage: what its window open while it's ready is worth. */
  readonly window: number;
}

/** The value's table, from a payoff report with ceilings (plain data). */
export interface SetupTable {
  readonly payoffs: readonly SetupPayoff[];
  /** The value falls linearly to 0 over this many frames before the fight's end (as the resources' worth). */
  readonly horizon: number;
}

/** The setup value's table: each ceiling with a bundle (or a combo's window), its pieces and their worth. */
export function setupTable(report: Pick<PayoffReport, "steps" | "ceilings">): SetupTable {
  const payoffs: SetupPayoff[] = [];
  for (const c of report.ceilings) {
    const step = report.steps.find((s) => s.id === c.step);
    if (!step) continue;
    const pieces = c.bundle.filter((b) => b.worth > 0).map((b) => ({ key: b.key, worth: b.worth }));
    const window = step.kind === "combo" ? Math.max(0, c.bare) : 0;
    if (!pieces.length && !window) continue;
    payoffs.push({ step, pieces, cap: Math.max(0, c.best - c.bare), window });
  }
  return { payoffs, horizon: 10 * FPS };
}

/**
 * How much of a piece a state holds at its frame (0–1: a status of a lower level, fewer stacks count in proportion)
 * and until when.
 */
function holds(state: TimelineState, key: string): { share: number; until: number } {
  const f = state.frame;
  const [kind, a, b] = key.split(" ");
  if (kind === "buff") {
    let until = -1;
    for (const x of state.buffs) if (`${x.owner}:${x.id}` === a && x.appliedAt <= f && x.expiresAt > f && x.expiresAt > until) until = x.expiresAt;
    return until > f ? { share: 1, until } : { share: 0, until: f };
  }
  if (kind === "status" || kind === "physical") {
    const list = kind === "status" ? state.enemy.statuses : state.enemy.physical;
    let best = { share: 0, until: f };
    for (const x of list) {
      if (x.status !== a || x.appliedAt > f || x.expiresAt <= f) continue;
      const share = Math.min(1, x.level / Math.max(1, Number(b)));
      if (share > best.share) best = { share, until: x.expiresAt };
    }
    return best;
  }
  if (kind === "vulnerable") {
    const v = state.enemy.vulnerable;
    return v && v.expiresAt > f ? { share: Math.min(1, v.stacks / Math.max(1, Number(a))), until: v.expiresAt } : { share: 0, until: f };
  }
  if (kind === "link") {
    const live = state.link.filter((x) => x > f);
    return live.length ? { share: Math.min(1, live.length / Math.max(1, Number(a))), until: Math.max(...live) } : { share: 0, until: f };
  }
  return { share: 0, until: f };
}

/** Whether a payoff can be cast within `within` frames from the state, as far as its cooldown, SP, energy and availability (now) say. */
function ready(ctx: TimelineContext, state: TimelineState, step: PlanStep, within: number): boolean {
  if (step.kind === "chain" || !step.skill) return true;
  const f = state.frame;
  if (!skillAvailable(ctx, state, step.operator, step.skill, f)) return false;
  if (Math.ceil(state.readyAt[step.skill] ?? 0) > f + within) return false;
  const cost = skillCosts(ctx, step.operator, step.skill, f);
  if (cost.energyCost > 0 && (state.energy[step.operator] ?? 0) < cost.energyCost - 1e-6) return false;
  if (cost.spCost > 0 && Math.min(SP.max, state.sp + (SP.perSecond * within) / FPS) < cost.spCost - 1e-6) return false;
  return true;
}

/**
 * What the pieces a state holds are worth: each piece once, at its worth to the best payoff that can still be cast
 * while it's on (a buff of the payoff's own operator isn't counted: its own sequence, which the resource value prices
 * through its casts in progress: Laevatain's Twilight for her enhanced attacks), plus a combo's bare damage while its
 * window is open and it's ready; falling to 0 over the table's horizon before the fight's end; × `weight`.
 * Deterministic: plain reads of the state.
 */
export function setupValue(ctx: TimelineContext, table: SetupTable, state: TimelineState, weight: number): number {
  const left = ctx.scenario.durationFrames - state.frame;
  if (weight === 0 || left <= 0) return 0;
  const best = new Map<string, number>();
  const held = new Map<string, { share: number; until: number }>();
  const readiness = new Map<string, boolean>();
  let v = 0;
  for (const p of table.payoffs) {
    for (const piece of p.pieces) {
      if (piece.key.startsWith(`buff ${p.step.operator}:`)) continue;
      let h = held.get(piece.key);
      if (!h) held.set(piece.key, (h = holds(state, piece.key)));
      const worth = piece.worth * h.share;
      if (worth <= (best.get(piece.key) ?? 0)) continue;
      const rk = `${p.step.id}@${h.until}`;
      let r = readiness.get(rk);
      if (r === undefined) readiness.set(rk, (r = ready(ctx, state, p.step, h.until - state.frame)));
      if (r) best.set(piece.key, worth);
    }
    if (p.window > 0 && p.step.skill) {
      const w = state.comboWindow[windowKey(ctx, p.step.operator, p.step.skill)];
      if (w && w.from <= state.frame && w.until >= state.frame && ready(ctx, state, p.step, 0)) v += p.window;
    }
  }
  for (const x of best.values()) v += x;
  return v * Math.min(1, left / table.horizon) * weight;
}
