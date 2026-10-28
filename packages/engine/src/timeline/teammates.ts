// Teammates' own basic attacks (accuracy plan B0; the owner, 2026-10-26: "the non-controlled operators do basic attacks
// on the enemies, though not quite at the pace the controlled operator does"): an operator that isn't controlled runs
// its basic-attack chain whenever its own action is over, and its own skills cut it at once (TimelineOptions.teammateAttacks).

import { activeAt } from "../buffs.ts";
import type { PendingAuto, TimelineContext, TimelineState } from "./state.ts";
import { timingOf } from "./context.ts";
import { exclusiveUntil, ownHitsLanded } from "./timing.ts";
import { runTriggers } from "./actions.ts";
import { castSkill } from "./casting.ts";
import { schedule } from "./schedule.ts";

/**
 * A teammate's pause after a chain it finished (frames): the median gap between the runs of teammates' basic casts in
 * 28 logged fights (3.5 s; quartiles 2.1 and 6.8 s, 235 gaps; 2026-10-28). With it a teammate attacks about 40% of its
 * free time, as the logs' median (39%, 64 operator-fights) against the controlled operator's 60–80%. The steps themselves
 * come at the chain's windows (the logs: 0.82× the steps' exclusive time, the windows' pace).
 */
export const TEAMMATE_PAUSE_FRAMES = 105;

/** A teammate's chain starting at `frame` (its first step, or a pause's end). */
export function teammateStart(operator: string, frame: number): PendingAuto {
  return { kind: "auto", frame, clock: { operator }, operator, step: "start" };
}

/** The chain's first step: what a buff maps the basic-attack input to, else the operator's attack 1. */
function chainHead(ctx: TimelineContext, st: TimelineState, operator: string, frame: number): string | undefined {
  const mapped = st.buffs.find((b) => b.basicAttack !== undefined && b.owner === operator && b.cast === undefined && activeAt(b, frame))?.basicAttack;
  if (mapped) return mapped;
  const heads = (ctx.kits.get(operator)?.skills ?? []).filter((s) => s.kind === "basic" && !s.chainStep && !s.followUpOnly && timingOf(ctx, s.skillId).specification === 1);
  return (heads.find((s) => s.skillId === `${operator}_attack1`) ?? heads[0])?.skillId;
}

/**
 * A teammate's next basic attack (a scheduled `auto`): none while it's controlled (a swap away starts it again); after its
 * own action (its exclusive time and its own hits); the chain's next step at its window, else, after a full chain and a
 * pause, its first step. Its hits are a teammate's (`controlledAtCast` someone else's: no Final Strike Stagger, no SP the
 * data gives only the controlled operator, the kits' not-controlled paths).
 */
export function teammateAttack(ctx: TimelineContext, st: TimelineState, x: PendingAuto): TimelineState {
  const op = x.operator;
  if (op === st.controlled) return st;
  const cur = st.acting[op];
  if (cur && !cur.auto) {
    const free = Math.max(exclusiveUntil(ctx, st, op), ownHitsLanded(st, op));
    if (free > x.frame) return schedule(st, [teammateStart(op, free)]);
  }
  const chain = st.chainNext[op];
  const next = cur?.auto && x.step === "next" && chain && chain.until >= x.frame ? chain : null;
  if (next && next.from > x.frame) return schedule(st, [{ ...x, frame: next.from }]);
  const skill = next?.skill ?? chainHead(ctx, st, op, x.frame);
  if (!skill) return st;
  const r = castSkill(ctx, st, op, skill, x.frame, false);
  const acting = r.state.acting[op];
  const cast = r.state.casts.at(-1);
  let s: TimelineState = {
    ...r.state,
    ...(acting ? { acting: { ...r.state.acting, [op]: { ...acting, auto: true as const } } } : {}),
    ...(cast?.operator === op ? { casts: [...r.state.casts.slice(0, -1), { ...cast, teammate: true as const }] } : {}),
  };
  const after = s.chainNext[op];
  s = schedule(s, [after ? { ...x, frame: Math.max(x.frame + 1, after.from), step: "next" } : teammateStart(op, exclusiveUntil(ctx, s, op) + TEAMMATE_PAUSE_FRAMES)]);
  return runTriggers(ctx, s, r.events, r.origin);
}
