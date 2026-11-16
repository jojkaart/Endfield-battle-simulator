// Skeletons as guides (docs/design.md "Payoffs and chains", phase 3, part 2): the payoff table's chains, merged with
// their setups and fillers, scheduled on the fight's timeline by value per resource, each played in the engine as
// soon as it's legal (so every skeleton is a legal rotation, repaired as it's built: a step that can't start yet waits
// for its window, SP or energy, as the loop's moved-later replay does), and handed to the beam search as guides
// (SearchHooks.guides): each keeps a place in the beam, so the search finds at least as much as the best of them.

import type { Chain, PayoffReport } from "./payoffs.ts";
import { macroTree, playMacros, type MacroNode } from "./macros.ts";
import { committedDamage, legalActions, nextBasicAttack, resourcePrices, resourceValue, VALUE_WEIGHT, type ResourcePrices } from "./search.ts";
import { apply, createContext, init, memoised, FPS, type RotationAction, type TimelineScenario, type TimelineState, type GameData } from "../core.ts";

/** A skeleton: a legal rotation of the scenario, what it deals, and which item it started with. */
export interface Skeleton {
  readonly rotation: readonly RotationAction[];
  readonly damage: number;
  readonly label: string;
}

export interface SkeletonOptions {
  /** Skeletons made (default 3): the i-th starts with the i-th best choice at the fight's start, then goes greedy. */
  readonly count?: number;
  /** The resources' weight in a state's worth (default VALUE_WEIGHT): what a cast spends is charged at the probed prices × it. */
  readonly valueWeight?: number;
}

/**
 * The items a skeleton is made of, as one prefix tree (macroTree): every chain, and each measured chain merged (its
 * setups before it, its fillers after the chain step each follows). Single casts are the search's own choices.
 */
export function skeletonItems(report: Pick<PayoffReport, "steps" | "chains">): MacroNode[] {
  const merged: Chain[] = [];
  for (const c of report.chains) {
    const m = c.merged;
    if (!m || (!m.setups.length && !m.fillers.length)) continue;
    const steps: Chain["steps"][number][] = m.setups.map((x) => ({ step: x.step, at: 0, link: "first" as const, slack: null }));
    c.steps.forEach((x, k) => {
      // A setup first makes the chain's first step a later one: "sets up", not "first".
      steps.push(k === 0 && steps.length ? { ...x, link: "sets up" } : x);
      for (const f of m.fillers.filter((y) => y.after === k)) steps.push({ step: f.step, at: 0, link: "sets up", slack: null });
    });
    merged.push({ ...c, steps });
  }
  return macroTree(report.steps, [...merged, ...report.chains]);
}

/**
 * Skeletons: greedy rollouts from the fight's start. At each decision every choice the search would have
 * (legalActions, no swaps) and every item whose first step is one of them (played as a macro, the controlled operator
 * attacking in between) is valued by what it adds to the state's worth (committed damage plus the resources at their
 * probed prices × the weight: resourceValue) per second it takes (to its last step's start, plus half a second), and
 * the best is played. The i-th skeleton takes the i-th best option at the start. Deterministic. The best first.
 */
export function skeletons(data: GameData, scenario: Omit<TimelineScenario, "rotation">, report: Pick<PayoffReport, "steps" | "chains">, options: SkeletonOptions = {}): Skeleton[] {
  const count = options.count ?? 3;
  const weight = options.valueWeight ?? VALUE_WEIGHT;
  const ctx = memoised(createContext(data, { ...scenario, rotation: [] }));
  const prices: ResourcePrices | undefined = weight > 0 ? resourcePrices(data, scenario) : undefined;
  const items = skeletonItems(report);
  const worth = (s: TimelineState) => committedDamage(ctx, s) + (prices ? resourceValue(ctx, prices, s, weight) : 0);
  const options_ = (s: TimelineState): { actions: RotationAction[]; state: TimelineState; rate: number; label: string }[] => {
    const choices = legalActions(ctx, s).filter((c) => c.action.skill !== "swap");
    const here = worth(s);
    const out: { actions: RotationAction[]; state: TimelineState; rate: number; label: string }[] = [];
    const rate = (st: TimelineState) => (worth(st) - here) / ((Math.max(0, st.frame - s.frame) + FPS / 2) / FPS);
    for (const c of choices) {
      const a = { ...c.action, at: c.frame };
      const st = apply(ctx, s, a);
      out.push({ actions: [a], state: st, rate: rate(st), label: a.skill });
    }
    for (const m of playMacros(ctx, s, items, choices, undefined, (x, before) => nextBasicAttack(ctx, x, before))) {
      out.push({ actions: [...m.actions], state: m.state, rate: rate(m.state), label: m.actions.filter((a) => ctx.kits.get(a.operator)?.skills.find((k) => k.skillId === a.skill)?.kind !== "basic").map((a) => a.skill).join(" > ") });
    }
    // Best rate first; ties by the order made (deterministic).
    return out.map((x, i) => ({ x, i })).sort((p, q) => q.x.rate - p.x.rate || p.i - q.i).map((p) => p.x);
  };
  const s0 = init(ctx);
  const first = options_(s0);
  const out: Skeleton[] = [];
  for (let j = 0; j < Math.min(count, first.length); j++) {
    const start = first[j] as (typeof first)[number];
    let s = start.state;
    const rotation = [...start.actions];
    for (;;) {
      const next = options_(s)[0];
      if (!next) break;
      rotation.push(...next.actions);
      s = next.state;
    }
    out.push({ rotation, damage: committedDamage(ctx, s), label: start.label });
  }
  return out.sort((a, b) => b.damage - a.damage);
}
