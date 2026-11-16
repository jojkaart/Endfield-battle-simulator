// When a state can next read differently to a driver that steps over frames (the rule driver's event stepping, policy.ts;
// docs/design/rules.md "Rule-based rotations"), with nothing pressed in between.

import { FPS } from "../units.ts";
import type { TimelineContext, TimelineState } from "./state.ts";
import { SP } from "./rules.ts";
import { skillCosts, timingOf } from "./context.ts";
import { spAt, spCostAt } from "./resources.ts";
import { actionFrame } from "./timing.ts";
import { nextEventAfter } from "./advance.ts";
import { castBound } from "./schedule.ts";
import { buttonSkills, SKILL_BUTTONS } from "./buttons.ts";

/**
 * The first frame after `frame` (the state's own, after its presses) from which anything a cue or startsNow's gates
 * read may differ, at most `until`. The state changes only as something scheduled comes due (hits, actions, the
 * enemy's, teammates' own attacks, buffs' ticks and ends: nextEventAfter; one still due at `frame` runs at the next);
 * between those, what is read changes with time alone, at times the state holds: buffs' starts and ends, the enemy's
 * states' ends, Stagger's end, cooldowns, combo and chain windows, the current actions' frames (end, exclusive frame,
 * marks, windows, channels), a detached hit's launch, the SP pause, and SP reaching one of `spLevels` or a team
 * skill's cost (from the frame before: a state advanced another way may round SP a hair differently). Early is
 * harmless; a missed frame would change a driver's run (policy.ts checks the stepping against every frame).
 */
export function nextChangeAfter(ctx: TimelineContext, st: TimelineState, frame: number, until: number, spLevels: Iterable<number> = []): number {
  let w = until;
  // A frame from which something may differ (a time in the past changes nothing more).
  const mark = (g: number | null | undefined) => {
    if (g === null || g === undefined || !Number.isFinite(g)) return;
    const c = Math.ceil(g);
    if (c > frame && c < w) w = c;
  };
  for (const x of st.scheduled) {
    mark(Math.max(frame + 1, x.frame));
    mark(castBound(x));
  }
  if (w === frame + 1) return w;
  mark(nextEventAfter(st, frame));
  for (const b of st.buffs) {
    mark(b.appliedAt);
    mark(b.expiresAt);
  }
  const e = st.enemy;
  mark(e.infliction?.expiresAt);
  mark(e.vulnerable?.expiresAt);
  for (const x of e.statuses) mark(x.expiresAt);
  for (const x of e.physical) mark(x.expiresAt);
  if (st.stagger.until !== null) {
    mark(st.stagger.until);
    mark(st.stagger.until + 1);
  }
  for (const v of Object.values(st.readyAt)) mark(v);
  for (const v of Object.values(st.comboWindow)) {
    mark(v.from);
    mark(v.until + 1);
  }
  for (const c of Object.values(st.chainNext)) {
    for (const x of [c, ...(c.alternatives ?? [])]) {
      mark(x.from);
      mark(x.until + 1);
    }
  }
  for (const cur of Object.values(st.acting)) {
    const t = timingOf(ctx, cur.skill);
    const at = (x: number) => mark(actionFrame(cur, x));
    at(t.durationFrames);
    at(t.exclusiveFrames);
    for (const m of t.interruptibleFrom ?? []) at(m);
    for (const x of t.windows) {
      at(x.from);
      at(x.to + 1);
    }
    for (const x of t.channels) {
      at(x.from);
      at(x.to);
    }
  }
  mark(st.spPausedUntil);
  const sp = spAt(st, frame);
  if (sp < SP.max) {
    const levels = new Set(spLevels);
    for (const b of ctx.scenario.team) for (const k of SKILL_BUTTONS) for (const x of buttonSkills(ctx, b.operator, k)) levels.add(spCostAt(ctx, st, b.operator, skillCosts(ctx, b.operator, x.skillId, frame), frame));
    for (const level of levels) {
      if (sp >= level || level > SP.max) continue;
      mark(Math.max(frame + 1, Math.max(frame, st.spPausedUntil) + Math.floor(((level - sp) * FPS) / SP.perSecond) - 1));
    }
  }
  return w;
}
