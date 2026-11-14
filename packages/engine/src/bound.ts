// An upper bound on the damage a search state can still add (branch and bound: docs/design.md "Pruning the search"),
// from the payoff table (payoffs.ts): every step a team can cast, at most its ceiling each time, as often as its
// operator's time, its cooldown and the team's SP allow, plus a recording buff's share of all of it. Admissible only
// as far as the ceilings are ceilings: they're probed (the best bundle of what the team achieves, in the best
// situation), not proven, so the search counts the states on its guide's line whose bound falls short (`boundMisses`)
// and never prunes those.

import type { PayoffReport } from "./payoffs.ts";
import type { TimelineContext, TimelineState } from "./timeline.ts";
import { SP } from "./timeline/rules.ts";
import { FPS } from "./units.ts";

/** One step in the bound: what a cast deals at most, how long it holds its operator, its cooldown and the net SP it uses. */
export interface BoundItem {
  readonly step: string;
  readonly operator: string;
  /** The kit skill whose cooldown it waits for (none for a chain). */
  readonly skill?: string;
  /** Damage of one cast at most: the largest of its ceiling's measures (what it deals, every hit's difference). */
  readonly value: number;
  /** Frames it holds its operator (battle skills and chains; 0 for combos and ultimates, which may cut into other actions: only their cooldowns count). */
  readonly duration: number;
  readonly cooldown: number;
  /**
   * Frames from its start to the first thing it does in any probe (a hit, a buff, an enemy event): a cast that starts
   * later than this before the fight's end adds nothing (time stops only delay).
   */
  readonly first: number;
  /** SP a cast uses net (its cost less the most SP its probes saw it give back; negative for a chain's Final Strike). */
  readonly sp: number;
}

/** The bound's table: plain data from the payoff report. `unbounded`: why there is no bound (a damaging step without a ceiling): then it never prunes. */
export interface UpperBound {
  readonly items: readonly BoundItem[];
  /** The highest rate of a recording buff (its burst deals that share of the damage in its window): every bound × (1 + it). */
  readonly recordRate: number;
  readonly unbounded?: string;
}

/** The bound's table from a payoff report. */
export function upperBound(report: PayoffReport): UpperBound {
  const items: BoundItem[] = [];
  const missing: string[] = [];
  for (const st of report.steps) {
    const c = report.ceilings.find((x) => x.step === st.id);
    const effects = report.effects.filter((e) => e.step === st.id);
    if (!c) {
      // A step that deals nothing in any probe needs no ceiling; one never probed does.
      if (!effects.length) missing.push(st.id);
      continue;
    }
    const busy = Math.min(c.busy, ...effects.map((e) => e.busy));
    const gain = Math.max(0, ...effects.map((e) => e.sp + e.cost.sp));
    items.push({
      step: st.id,
      operator: st.operator,
      ...(st.skill ? { skill: st.skill } : {}),
      value: Math.max(c.best, c.bestAll, c.bare, c.bareAll, 0),
      duration: st.kind === "combo" || st.kind === "ultimate" ? 0 : Math.max(1, busy),
      cooldown: c.cost.cooldown,
      first: Math.max(0, Math.min(...effects.flatMap((e) => [...(e.hits ? [e.hits.first] : []), ...e.buffs.map((b) => b.offset), ...e.enemy.map((x) => x.offset)]))),
      // The probe's SP difference misses the regeneration the spend paused (SP.pauseAfterSpendFrames): given back here.
      sp: c.cost.sp - gain - (c.cost.sp > 0 ? (SP.perSecond * SP.pauseAfterSpendFrames) / FPS : 0),
    });
  }
  const recordRate = Math.max(0, ...report.effects.map((e) => e.recordRate ?? 0));
  return { items, recordRate, ...(missing.length ? { unbounded: `no ceiling for ${missing.join(", ")}` } : {}) };
}

/**
 * The most damage a state can still add by the fight's end: min over λ ≥ 0 of λ × (the SP it can have) + per operator
 * the best use of its time at values less λ × net SP (a fractional knapsack, casts capped by cooldowns), × (1 + the
 * recording rate). Any λ ≥ 0 bounds the relaxed problem (weak duality); the λ tried are 0 and each item's value per
 * net SP. Infinity when the table is unbounded.
 */
export function remainingBound(ub: UpperBound, ctx: TimelineContext, state: TimelineState): number {
  if (ub.unbounded) return Infinity;
  const end = ctx.scenario.durationFrames;
  const left = end - state.frame;
  if (left <= 0) return 0;
  // Casts each item can still make: its cooldown from when it's ready.
  // Casts each item can still make: from when it's ready, every cooldown (or its busy frames), up to its first effect
  // before the end.
  const counts = ub.items.map((it) => {
    const last = end - it.first;
    const ready = Math.max(state.frame, it.skill === undefined ? 0 : Math.ceil(state.readyAt[it.skill] ?? 0));
    if (ready > last) return 0;
    const every = Math.max(it.cooldown, it.duration);
    return every > 0 ? Math.floor((last - ready) / every) + 1 : Infinity;
  });
  const spAvailable = Math.min(SP.max, state.sp) + (SP.perSecond * left) / FPS;
  const at = (lambda: number) => {
    let total = lambda * spAvailable;
    const byOp = new Map<string, { v: number; d: number; n: number }[]>();
    ub.items.forEach((it, i) => {
      const v = it.value - lambda * it.sp;
      const n = counts[i] as number;
      if (v <= 0 || n <= 0) return;
      if (it.duration === 0) {
        // Not holding its operator: as often as its cooldown allows (a combo or ultimate without one would be unbounded).
        total += Number.isFinite(n) ? v * n : Infinity;
        return;
      }
      byOp.set(it.operator, [...(byOp.get(it.operator) ?? []), { v, d: it.duration, n }]);
    });
    for (const list of byOp.values()) {
      let time = left;
      for (const x of [...list].sort((a, b) => b.v / b.d - a.v / a.d)) {
        if (time <= 0) break;
        const casts = Math.min(x.n, time / x.d);
        total += casts * x.v;
        time -= casts * x.d;
      }
    }
    return total;
  };
  let best = at(0);
  for (const it of ub.items) if (it.sp > 0) best = Math.min(best, at(it.value / it.sp));
  return best * (1 + ub.recordRate);
}
