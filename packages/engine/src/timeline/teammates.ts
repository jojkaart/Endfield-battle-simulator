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
import { engineReading } from "./assumptions.ts";

/**
 * A teammate's pause after a chain it finished (frames): 6.5 s, set so a teammate attacks the share of its free time
 * the logs show while the controlled operator attacks (in-game test 101, 2026-11-16; 54 development logs, 0.5 s bins of
 * a teammate's time outside its own skills: a median 0.43 per operator-fight, quartiles 0.32–0.54, against the engine's
 * 0.59–0.66 at the old 3.5 s in the three teams' rule runs, 0.41–0.45 at 6.5 s). The logs' pauses aren't one timer:
 * after a full chain about two thirds of the next runs start within 1.5 s, the rest after a heavy-tailed wait (median
 * 3.7 s, mean 5.4 s); the share depends on the fight (the enemy: R² 0.41) and the operator (R² 0.41; ranged ones
 * higher), not on Stagger, parser version or time into the fight. 3.5 s (2026-10-28) was the median of the gaps over
 * 1.5 s alone. The steps themselves come at the chain's windows (the logs: 0.82× the steps' exclusive time). The engine
 * assumption `teammate-pause` (timeline/assumptions.ts) switches it: 6.5s (this, the default) or 3.5s.
 */
export const TEAMMATE_PAUSE_FRAMES = 195;
const OLD_PAUSE_FRAMES = 105;

/** The teammates' pause under the scenario's reading of `teammate-pause`. */
export function teammatePauseFrames(ctx: TimelineContext): number {
  return engineReading(ctx.scenario, "teammate-pause") === "3.5s" ? OLD_PAUSE_FRAMES : TEAMMATE_PAUSE_FRAMES;
}

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
  s = schedule(s, [after ? { ...x, frame: Math.max(x.frame + 1, after.from), step: "next" } : teammateStart(op, exclusiveUntil(ctx, s, op) + teammatePauseFrames(ctx))]);
  return runTriggers(ctx, s, r.events, r.origin);
}
