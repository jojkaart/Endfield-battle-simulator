// Slow-downs and the clocks they stop (docs/design.md "Time"): the world's, the enemy's and each operator's.

import { Attr } from "../attributes.ts";
import type { SkillTiming } from "../model.ts";
import { type ActiveBuff, buffAttr } from "../buffs.ts";
import type { ChainStep, TimelineContext, TimelineState } from "./state.ts";
import { attrTotal, panelAt } from "./context.ts";
import { rebaseCooldowns } from "./resources.ts";

/**
 * A skill's global slow-downs (docs/design.md "Time"): the world (enemy
 * statuses and timers, every buff, combo windows, SP regen, energy blocks)
 * and every operator but the caster (its hits on the way, its current
 * action) lose the frames the slow-down takes; cooldowns run on. Where
 * slow-downs overlap the lowest scale counts, so each loses only what the
 * new one adds. Modelled as shifting everything after the slow-down's start
 * by the lost frames: exact for a stop, and for a partial slow-down after
 * it ends.
 */
export function slowDown(ctx: TimelineContext, st: TimelineState, caster: string, timing: SkillTiming, frame: number): TimelineState {
  let s: TimelineState = { ...st, slowdowns: st.slowdowns.filter((x) => x.start + x.scales.length > frame) };
  for (const d of timing.slowdowns) {
    const start = frame + d.from;
    const scaleAt = (who: string | null, f: number) => {
      let m = 1;
      for (const x of s.slowdowns) if (x.exempt !== who && f >= x.start && f < x.start + x.scales.length) m = Math.min(m, x.scales[f - x.start] as number);
      return m;
    };
    const lost = (who: string | null) => {
      if (who === caster) return 0;
      let sum = 0;
      d.scales.forEach((v, k) => (sum += Math.max(0, scaleAt(who, start + k) - v)));
      return Math.round(sum);
    };
    const world = lost(null);
    const by = new Map(ctx.scenario.team.map((b) => [b.operator, lost(b.operator)]));
    s = { ...shiftWorld(s, start, world), slowdowns: [...s.slowdowns, { start, scales: d.scales, exempt: caster }] };
    for (const [op, n] of by) s = shiftOperator(s, op, start, n);
  }
  // Cooldowns run on through it, while the buffs on the world's clock (a recovery rate's among them) last longer.
  return rebaseCooldowns(ctx, st, s, frame);
}

/** The enemy's own clock after `start` (its statuses, inflictions, Vulnerable, physical and control statuses, debuffs on it, its stagger, its actions) runs `n` frames later. */
export function shiftEnemy(st: TimelineState, start: number, n: number): TimelineState {
  if (n <= 0) return st;
  const later = (f: number) => (f > start ? f + n : f);
  const e = st.enemy;
  return {
    ...st,
    enemy: {
      vulnerable: e.vulnerable ? { ...e.vulnerable, expiresAt: later(e.vulnerable.expiresAt) } : null,
      physical: e.physical.map((x) => ({ ...x, expiresAt: later(x.expiresAt) })),
      controls: e.controls.map((x) => ({ ...x, expiresAt: later(x.expiresAt) })),
      infliction: e.infliction ? { ...e.infliction, expiresAt: later(e.infliction.expiresAt) } : null,
      statuses: e.statuses.map((x) => ({
        ...x,
        expiresAt: later(x.expiresAt),
        ...(x.nextTickAt !== undefined ? { nextTickAt: later(x.nextTickAt) } : {}),
        // Its ramp (Corrosion) doesn't advance while time stands still.
        ...(x.appliedAt <= start && x.expiresAt > start ? { appliedAt: x.appliedAt + n } : {}),
      })),
    },
    buffs: st.buffs.map((b) => (b.target === "enemy" ? shiftBuff(b, start, n) : b)),
    stagger: st.stagger.until !== null ? { ...st.stagger, until: later(st.stagger.until) } : st.stagger,
    enemyActions: st.enemyActions.map((a) => (a.frame > start ? { ...a, frame: a.frame + n } : a)),
    pendingBursts: st.pendingBursts.map((b) => (b.frame > start ? { ...b, frame: b.frame + n, event: { ...b.event, frame: b.frame + n } } : b)),
  };
}

function shiftBuff(b: ActiveBuff, start: number, n: number): ActiveBuff {
  const later = (f: number) => (f > start ? f + n : f);
  return b.expiresAt > start || (b.nextTick ?? -1) > start ? { ...b, expiresAt: later(b.expiresAt), ...(b.nextTick !== undefined ? { nextTick: later(b.nextTick) } : {}) } : b;
}

/** Everything on the world's clock after `start` happens `n` frames later: the enemy's, every buff, combo windows, energy blocks, SP regen. */
function shiftWorld(st: TimelineState, start: number, n: number): TimelineState {
  if (n <= 0) return st;
  const later = (f: number) => (f > start ? f + n : f);
  const e = shiftEnemy(st, start, n);
  return {
    ...e,
    buffs: e.buffs.map((b) => (b.target === "enemy" ? b : shiftBuff(b, start, n))),
    comboWindow: Object.fromEntries(Object.entries(st.comboWindow).map(([k, w]) => [k, { ...w, until: later(w.until) }])),
    energyBlockedUntil: Object.fromEntries(Object.entries(st.energyBlockedUntil).map(([k, f]) => [k, later(f)])),
    link: st.link.map(later),
    // SP doesn't regenerate meanwhile: it does until `start` (which may be later than the state's frame: a slow-down
    // some frames into its cast, or one cast by a trigger while an advance runs), then not for `n` frames.
    spPausedUntil: later(st.spPausedUntil),
    spStops: stopSp(st.spStops, start, n),
  };
}

/** SP stops after a slow-down from `start` adds `n` frames: what comes after it, `n` later, and [start, start + n) (merged). */
function stopSp(stops: TimelineState["spStops"], start: number, n: number): TimelineState["spStops"] {
  const later = (f: number) => (f > start ? f + n : f);
  const all = [...stops.map((p) => ({ from: later(p.from), until: later(p.until) })), { from: start, until: start + n }].sort((a, b) => a.from - b.from);
  const out: { from: number; until: number }[] = [];
  for (const p of all) {
    const last = out.at(-1);
    if (last && p.from <= last.until) last.until = Math.max(last.until, p.until);
    else out.push({ ...p });
  }
  return out;
}

/**
 * An operator's own timeline after `start` (its hits on the way, delayed actions, its casts' team energy, current
 * action) happens `n` frames later. What belongs to a cast goes with the cast's operator (as endCurrentSkill and
 * takeJump treat it); a delayed action of no cast goes with its trigger's owner.
 */
export function shiftOperator(st: TimelineState, operator: string, start: number, n: number): TimelineState {
  if (n <= 0) return st;
  const later = (f: number) => (f > start ? f + n : f);
  const shift = (c: ChainStep): ChainStep => ({ skill: c.skill, from: later(c.from), until: later(c.until) });
  const cur = st.acting[operator];
  const chain = st.chainNext[operator];
  return {
    ...st,
    pending: st.pending.map((h) => (h.operator === operator && h.frame > start && !h.pinned ? { ...h, frame: h.frame + n, ...(h.launchAt !== undefined ? { launchAt: later(h.launchAt) } : {}) } : h)),
    pendingActions: st.pendingActions.map((a) => ((a.cast?.operator ?? a.owner) === operator && a.frame > start ? { ...a, frame: a.frame + n, ...(a.launchAt !== undefined ? { launchAt: later(a.launchAt) } : {}) } : a)),
    pendingEnergy: st.pendingEnergy.map((x) => (x.cast?.operator === operator && x.frame > start ? { ...x, frame: x.frame + n } : x)),
    pendingJumps: st.pendingJumps.map((j) => (j.operator === operator && j.frame > start ? { ...j, frame: j.frame + n } : j)),
    ...(cur ? { acting: { ...st.acting, [operator]: { ...cur, frame: cur.frame + n, ...(cur.skips ? { skips: cur.skips.map((k) => ({ ...k, at: k.at + n })) } : {}) } } } : {}),
    ...(chain ? { chainNext: { ...st.chainNext, [operator]: { ...shift(chain), ...(chain.alternatives ? { alternatives: chain.alternatives.map(shift) } : {}) } } } : {}),
  };
}

/** An operator's action speed: attribute 92 (KeywordSpeedUpScalar, default 1) plus haste buffs, within 0.1–1.3. */
export function actionSpeed(ctx: TimelineContext, st: TimelineState, operator: string, frame: number): number {
  const panel = panelAt(ctx, operator, frame);
  const base = attrTotal(ctx, panel, Attr.KeywordSpeedUpScalar);
  return Math.max(0.1, Math.min(1.3, base + buffAttr(st.buffs, operator, frame, Attr.KeywordSpeedUpScalar, panel.attrs[Attr.KeywordSpeedUpScalar])));
}
