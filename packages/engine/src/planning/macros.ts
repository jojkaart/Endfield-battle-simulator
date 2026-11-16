// Chains as macro actions (docs/design.md "Payoffs and chains", phase 3): a chain the payoff table found (payoffs.ts
// findChains: each step opens or sets up the next) is offered to the beam search as one more choice where its first
// step is among a node's choices, played from that node's own state, each step at its earliest. The child is the
// state after the chain's last step, so the beam ranks the state after the payoff rather than after the setup (whose
// first steps deal little: Akekuri's battle skill 9,133 against the owner's chain's 315,557). The rotation stays a
// plain list of actions, each with the frame it starts, so `simulate` replays it to the same numbers.

import type { Chain, PlanStep } from "./payoffs.ts";
import { runStep } from "./payoffs.ts";
import { advance, apply, earliestStart, COMBO_WINDOW_FRAMES, windowKey, FPS, type RotationAction, type TimelineContext, type TimelineState } from "../core.ts";

/** A node of the chains' prefix tree: a step, how it's tied to the chain so far, whether a found chain ends here. */
export interface MacroNode {
  readonly step: PlanStep;
  /** A combo cast in a window an earlier step of the chain opened (Chain step link `opens`). */
  readonly opens: boolean;
  /** A found chain ends at this step (the macro is offered with every step up to it). */
  readonly end: boolean;
  readonly next: readonly MacroNode[];
}

/** The chains as a prefix tree of their steps (chains sharing their first steps share those nodes): the roots. */
export function macroTree(steps: readonly PlanStep[], chains: readonly Chain[]): MacroNode[] {
  interface Mutable { step: PlanStep; opens: boolean; end: boolean; next: Mutable[] }
  const roots: Mutable[] = [];
  const byId = new Map(steps.map((s) => [s.id, s]));
  for (const c of chains) {
    let level = roots;
    c.steps.forEach((x, i) => {
      const step = byId.get(x.step);
      if (!step) return;
      let n = level.find((y) => y.step.id === step.id);
      if (!n) level.push((n = { step, opens: x.link === "opens", end: false, next: [] }));
      if (i === c.steps.length - 1) n.end = true;
      level = n.next;
    });
  }
  return roots;
}

/** How long a later step of a macro may wait for its start: a combo for the window an earlier step opened (6 s), another step 3 s (as the chain search). */
const SETUP_WAIT = 3 * FPS;

/** A macro played from a state: its actions (each with the frame it starts) and the state after the last. */
export interface MacroPlay {
  readonly actions: readonly RotationAction[];
  readonly state: TimelineState;
}

/**
 * Every macro whose first step is one of the choices (`first`: the actions that can start soonest and their frames),
 * played from `state`: the first step at its choice's frame, each later one at its earliest (runStep), a combo tied by
 * `opens` only in a window opened since the macro's start. A macro is offered at each node of the tree where a found
 * chain ends, once two steps or more are played; a step that can't start (within its wait, in the fight, as `allow`
 * says) ends that branch. With `basic` (the controlled operator's next basic attack from a state, if it can start
 * before a frame), the controlled operator basic-attacks before each later step as long as that doesn't move the
 * step's start (an idle operator otherwise: the search's own lines attack between casts). Deterministic: the tree's
 * order.
 */
export function playMacros(
  ctx: TimelineContext,
  state: TimelineState,
  roots: readonly MacroNode[],
  first: readonly { readonly action: RotationAction; readonly frame: number }[],
  allow?: (action: RotationAction, played: readonly RotationAction[]) => boolean,
  basic?: (state: TimelineState, before: number) => RotationAction | null,
): MacroPlay[] {
  const out: MacroPlay[] = [];
  const end = ctx.scenario.durationFrames;
  const ok = (acts: readonly RotationAction[], before: readonly RotationAction[]) => acts.every((a, i) => (a.at ?? 0) <= end && (!allow || allow(a, [...before, ...acts.slice(0, i)])));
  const visit = (node: MacroNode, s: TimelineState, played: readonly RotationAction[], start: number, depth: number) => {
    // A copy: what the steps after it advanced the state to is memoised on the state object (memoised), and a beam
    // node holding it would keep all of that alive.
    if (node.end && depth >= 2) out.push({ actions: played, state: { ...s } });
    for (const child of node.next) {
      const op = child.step.operator;
      if (child.step.kind === "chain" && op !== s.controlled) continue;
      const wait = child.opens ? COMBO_WINDOW_FRAMES : SETUP_WAIT;
      let r = runStep(ctx, s, child.step, wait);
      if ("error" in r) continue;
      // Basic attacks first (a teammate's step: the controlled operator's attacks don't hold it), as long as they don't
      // move the step's start: judged once for all of them (none when they would).
      let from = s;
      let before = played;
      if (basic && op !== s.controlled) {
        let f = s;
        const extra: RotationAction[] = [];
        for (let i = 0; i < 8; i++) {
          const a = basic(f, r.start);
          if (!a || !ok([a], [...played, ...extra])) break;
          f = apply(ctx, f, a);
          extra.push(a);
        }
        const r2 = extra.length ? runStep(ctx, f, child.step, wait) : r;
        if (extra.length && !("error" in r2) && r2.start <= r.start) {
          from = f;
          before = [...played, ...extra];
          r = r2;
        }
      }
      if (!ok(r.actions, before)) continue;
      if (child.opens && child.step.skill) {
        // Still tied: the window it's cast in opened since the macro's first step, not before (another source's).
        const w = advance(ctx, from, r.start).comboWindow[windowKey(ctx, op, child.step.skill)];
        if (!w || w.from < start) continue;
      }
      visit(child, r.state, [...before, ...r.actions], start, depth + 1);
    }
  };
  for (const root of roots) {
    const st = root.step;
    if (st.kind === "chain") {
      if (st.operator !== state.controlled) continue;
      // The controlled operator's basic chain: when one of its basic attacks is a choice, from that choice's frame.
      const c = first.find((x) => x.action.operator === st.operator && x.action.skill !== "swap" && ctx.kits.get(st.operator)?.skills.find((k) => k.skillId === x.action.skill)?.kind === "basic");
      if (!c) continue;
      const r = runStep(ctx, state, st, 0, c.frame);
      if ("error" in r || !ok(r.actions, [])) continue;
      visit(root, r.state, r.actions, r.start, 1);
      continue;
    }
    const c = first.find((x) => x.action.operator === st.operator && x.action.skill === st.skill);
    if (!c) continue;
    const act = { operator: st.operator, skill: st.skill as string, at: c.frame };
    if (!ok([act], []) || "error" in earliestStart(ctx, state, act)) continue;
    visit(root, apply(ctx, state, act), [act], c.frame, 1);
  }
  return out;
}
