// Several targets in a replayed fight (TimelineScenario.landingTargets, the log check's replay only; docs/design/data.md
// "Statuses per target"): the enemy's statuses kept per target. TimelineState.enemy is the current target's (the one
// hit last); the others wait in TimelineState.targets.others as they were when another was swapped in, until a landing,
// a burst or a status tick of theirs swaps them in: their statuses' ends are pruned then (expireStatus at the landing),
// their ticks run at their own frames (advance.ts nextDue reads every target's). The Stagger, the enemy-side kit buffs
// and the enemy's clock stay one: which target carries a buff is the log check's to read (packages/logs targets.ts).

import { type EnemyStatus, NO_STATUS, nextTick } from "../status.ts";
import type { PendingHit, TimelineContext, TimelineState } from "./state.ts";

/**
 * A landing's targets (TimelineScenario.landingTargets): its ref's entry, else the nearest entry of its operator under
 * one of its events within a frame; undefined where there is none (it lands on the target hit last) or the fight has
 * one target.
 */
export function landingTargetsOf(ctx: TimelineContext, hit: Pick<PendingHit, "operator" | "frame" | "ref">, events: readonly string[]): readonly number[] | undefined {
  const lt = ctx.landingTargets;
  if (!lt) return undefined;
  const byRef = hit.ref !== undefined ? lt.byRef.get(hit.ref) : undefined;
  if (byRef?.length) return byRef;
  const near = events.flatMap((e) => (lt.byKey.get(`${hit.operator}|${e}`) ?? []).filter((x) => Math.abs(x.frame - hit.frame) <= 1));
  near.sort((a, b) => Math.abs(a.frame - hit.frame) - Math.abs(b.frame - hit.frame));
  return near[0]?.targets.length ? near[0].targets : undefined;
}

/** The state with target `id` as the enemy (its statuses swapped in, the current one's kept); unchanged with one enemy or when `id` is current. */
export function onTarget(st: TimelineState, id: number): TimelineState {
  const t = st.targets;
  if (!t || t.current === id) return st;
  const { [id]: next, ...rest } = t.others;
  return { ...st, enemy: next ?? NO_STATUS, targets: { current: id, others: { ...rest, [t.current]: st.enemy } } };
}

/** `f` run on target `id` (onTarget), then the one current before it current again: a burst's or a tick's, which doesn't change who was hit last. */
export function withTarget(st: TimelineState, id: number | undefined, f: (st: TimelineState) => TimelineState): TimelineState {
  if (id === undefined || !st.targets || st.targets.current === id) return f(st);
  const was = st.targets.current;
  return onTarget(f(onTarget(st, id)), was);
}

/** A target's statuses as they are now: the enemy's if it is current, else as kept (NO_STATUS for one never hit). */
export function targetEnemy(st: TimelineState, id: number): EnemyStatus {
  if (!st.targets || st.targets.current === id) return st.enemy;
  return st.targets.others[id] ?? NO_STATUS;
}

/** The earliest status tick of a target other than the current one, and whose (advance.ts runs it on that target); null: none. */
export function otherTargetTick(st: TimelineState): { readonly frame: number; readonly target: number } | null {
  let out: { frame: number; target: number } | null = null;
  for (const [k, e] of Object.entries(st.targets?.others ?? {})) {
    const f = nextTick(e);
    if (f !== null && (out === null || f < out.frame)) out = { frame: f, target: Number(k) };
  }
  return out;
}

/** A target's death (drivers.ts targetDies with a target): its statuses end, with the bursts due on it. */
export function endTarget(st: TimelineState, id: number): TimelineState {
  if (!st.targets) return st;
  const scheduled = st.scheduled.filter((x) => !(x.kind === "burst" && x.target === id));
  if (st.targets.current === id) return { ...st, enemy: NO_STATUS, scheduled };
  const { [id]: _gone, ...rest } = st.targets.others;
  return { ...st, targets: { ...st.targets, others: rest }, scheduled };
}
