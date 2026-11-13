// Slow-downs and the clocks they stop (docs/design.md "Time"): the world's, the enemy's and each operator's.

import { Attr } from "../attributes.ts";
import type { SkillTiming } from "../model.ts";
import { type ActiveBuff, buffAttr } from "../buffs.ts";
import type { ChainStep, TimelineContext, TimelineState } from "./state.ts";
import { attrTotal, panelAt } from "./context.ts";
import { rebaseCooldowns } from "./resources.ts";
import { clampAttr } from "../stats.ts";
import { onOperator, shiftClock } from "./schedule.ts";

/**
 * A skill's global slow-downs (docs/design.md "Time"): the world (enemy
 * statuses and timers, every buff, combo windows, SP regen, energy blocks)
 * and every operator but the caster (its hits on the way, its current
 * action) lose the frames the slow-down takes; cooldowns run on. Where
 * slow-downs overlap the lowest scale counts, so each loses only what the
 * new one adds. An ultimate's time stop doesn't hold an operator whose own
 * ultimate's time stop covers that frame (an interim from one log:
 * e82d45c46040, Arcane's ultimate at 5455 ms inside Si's from 5096 ms; Si's
 * slashes land at her kit's frames, unheld, and her stop's ignoreTargets
 * name the "dazhao" group; in-game test 18). Modelled as shifting
 * everything after the slow-down's start by the lost frames: exact for a
 * stop, and for a partial slow-down after it ends.
 */
export function slowDown(ctx: TimelineContext, st: TimelineState, caster: string, timing: SkillTiming, frame: number): TimelineState {
  let s: TimelineState = { ...st, slowdowns: st.slowdowns.filter((x) => x.start + x.scales.length > frame) };
  const ultimate = timing.specification === 5;
  for (const d of timing.slowdowns) {
    const start = frame + d.from;
    const scaleAt = (who: string | null, f: number) => {
      let m = 1;
      for (const x of s.slowdowns) if (x.exempt !== who && f >= x.start && f < x.start + x.scales.length) m = Math.min(m, x.scales[f - x.start] as number);
      return m;
    };
    // Frames of its own ultimate's time stop, which another's stop or slow-down doesn't take from it (9a8097fcf351: Si's
    // combo slow-down from 1034 inside Rossi's stop, 992 to 1049, held her ultimate's crit buff, due at its frame 58, to
    // 1066, while the log has her stabs from 1055 crit at ×2.9 with it).
    const ownStop = (who: string | null, f: number) => who !== null && s.slowdowns.some((x) => x.ultimate && x.exempt === who && f >= x.start && f < x.start + x.scales.length);
    // The frames it takes from one, and the first it takes: an operator its own ultimate's stop still covers is held only
    // from that stop's end, so what's due right then comes on time (dbaee23b801d: Liino's Cosmovoice at her ultimate's
    // frame 77, the end of its stop, with Xaihi's ultimate stop from 7606 ms running on: at 8258 ms, as logged).
    const lost = (who: string | null): { n: number; from: number } => {
      if (who === caster) return { n: 0, from: start };
      let sum = 0;
      let from: number | null = null;
      d.scales.forEach((v, k) => {
        const held = ownStop(who, start + k) ? 0 : Math.max(0, scaleAt(who, start + k) - v);
        if (held > 0 && from === null) from = start + k;
        sum += held;
      });
      return { n: Math.round(sum), from: from ?? start };
    };
    const world = lost(null).n;
    const by = new Map(ctx.scenario.team.map((b) => [b.operator, lost(b.operator)]));
    s = { ...shiftWorld(s, start, world), slowdowns: [...s.slowdowns, { start, scales: d.scales, exempt: caster, ...(ultimate ? { ultimate: true as const } : {}) }] };
    for (const [op, l] of by) s = shiftOperator(s, op, l.from, l.n);
  }
  // Cooldowns run on through it, while the buffs on the world's clock (a recovery rate's among them) last longer.
  return rebaseCooldowns(ctx, st, s, frame);
}

/**
 * When an operator's clock, from `from`, has run `delay` frames: through the slow-downs already under way or to come
 * that hold it (TimelineState.slowdowns, all but its own; slowDown shifted what was scheduled when each began, not what
 * comes later). An Arts Burst runs on its operator's clock: it waits out the rest of another's time stop or slow-down
 * (dbaee23b801d: Arcane's touch at 8501 ms inside Xaihi's ultimate stop, then Typhoeus's combo; her Nature burst logged
 * at 10341 ms, at 9.9 s 1 s after the touch), not its own operator's (0eef2474a26f: her Cryo burst 1 s after her touch
 * inside her own combo's slow-down).
 */
export function operatorClockDue(st: TimelineState, operator: string, from: number, delay: number): number {
  const holding = st.slowdowns.filter((x) => x.exempt !== operator);
  const last = holding.reduce((m, x) => Math.max(m, x.start + x.scales.length), from);
  if (last <= from) return from + delay;
  let f = from;
  let run = 0;
  for (; run < delay && f < last; f++) {
    let rate = 1;
    for (const x of holding) if (f >= x.start && f < x.start + x.scales.length) rate = Math.min(rate, x.scales[f - x.start] as number);
    run += rate;
  }
  return f + Math.max(0, Math.round(delay - run));
}

/**
 * Whether the enemy's control-immune (the game's tag 188749032, which skips a control status's freeze: Tangtang's
 * OLDEN STARE, Si's Immobilization; the freezing operator's own debuffs on it are still held: actions.ts runTriggers).
 * No table gives the tag (only Tangtang's and Si's buff files carry it, no enemy): the scenario's target says, or else
 * a Boss (rank 2, EnemyTemplateDisplayInfoTable displayType) is. 4a64e58e75ad (eny_0134): Si's freeze holding Arcane's
 * debuffs halves Arcane's plain matches (64 → 32); b7b3762d5da8 (Rhodagn, Tangtang's stare) is the same either way
 * since Arts Bursts run on their operator's clock. In-game tests 37 and 104.
 */
export function controlImmune(ctx: TimelineContext): boolean {
  return ctx.scenario.target.controlImmune ?? ctx.data.enemies[ctx.scenario.target.enemy]?.rank === 2;
}

/**
 * The enemy's own clock after `start` (its statuses, inflictions, Vulnerable, physical and control statuses, its
 * stagger, its actions, the end of a freeze: TimelineState.enemyFrozenUntil) runs `n` frames later. Not the debuffs
 * on it (enemy-target buffs): shiftDebuffs.
 */
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
    stagger: st.stagger.until !== null ? { ...st.stagger, until: later(st.stagger.until) } : st.stagger,
    // A freeze running at `start` ends that much later (a freeze that overlaps it then counts what it adds: runTriggers).
    enemyFrozenUntil: later(st.enemyFrozenUntil),
    scheduled: shiftClock(st.scheduled, (c) => c === "enemy", start, n),
  };
}

/**
 * The debuffs on the enemy (enemy-target buffs) after `start`, all or only `owner`'s, end `n` frames later. Every buff
 * has an owner (the operator whose kit, weapon or gear set applied it: buffs.ts ActiveBuff.owner), so none is left
 * undecided.
 */
export function shiftDebuffs(st: TimelineState, start: number, n: number, owner?: string): TimelineState {
  if (n <= 0) return st;
  return { ...st, buffs: st.buffs.map((b) => (b.target === "enemy" && (owner === undefined || b.owner === owner) ? shiftBuff(b, start, n) : b)) };
}

function shiftBuff(b: ActiveBuff, start: number, n: number): ActiveBuff {
  const later = (f: number) => (f > start ? f + n : f);
  return b.expiresAt > start || (b.nextTick ?? -1) > start ? { ...b, expiresAt: later(b.expiresAt), ...(b.nextTick !== undefined ? { nextTick: later(b.nextTick) } : {}) } : b;
}

/** Everything on the world's clock after `start` happens `n` frames later: the enemy's, every buff, combo windows, energy blocks. */
function shiftWorld(st: TimelineState, start: number, n: number): TimelineState {
  if (n <= 0) return st;
  const later = (f: number) => (f > start ? f + n : f);
  const e = shiftEnemy(st, start, n);
  return {
    ...e,
    buffs: e.buffs.map((b) => shiftBuff(b, start, n)),
    enemyFrozenBy: Object.fromEntries(Object.entries(st.enemyFrozenBy).map(([k, f]) => [k, later(f)])),
    scheduled: shiftClock(e.scheduled, (c) => c === "world", start, n),
    comboWindow: Object.fromEntries(Object.entries(st.comboWindow).map(([k, w]) => [k, { ...w, until: later(w.until) }])),
    energyBlockedUntil: Object.fromEntries(Object.entries(st.energyBlockedUntil).map(([k, f]) => [k, later(f)])),
    link: st.link.map(later),
    // SP isn't on it: regen and its pause after a spend run on raw time, as cooldowns do (rules.ts SP).
  };
}

/**
 * An operator's own timeline after `start` (what's scheduled on its clock: its hits on the way, delayed actions, its
 * casts' team energy and jumps; its current action) happens `n` frames later. What belongs to a cast is on the cast's
 * operator's clock (as endCurrentSkill and takeJump treat it); a delayed action of no cast on its trigger's owner's.
 */
export function shiftOperator(st: TimelineState, operator: string, start: number, n: number, bursts = true): TimelineState {
  if (n <= 0) return st;
  const later = (f: number) => (f > start ? f + n : f);
  const shift = (c: ChainStep): ChainStep => ({ skill: c.skill, from: later(c.from), until: later(c.until) });
  const cur = st.acting[operator];
  const chain = st.chainNext[operator];
  return {
    ...st,
    scheduled: shiftClock(st.scheduled, (c, x) => onOperator(c, operator) && (bursts || x.kind !== "burst"), start, n),
    ...(cur ? { acting: { ...st.acting, [operator]: { ...cur, frame: cur.frame + n, ...(cur.skips ? { skips: cur.skips.map((k) => ({ ...k, at: k.at + n })) } : {}) } } } : {}),
    ...(chain ? { chainNext: { ...st.chainNext, [operator]: { ...shift(chain), ...(chain.alternatives ? { alternatives: chain.alternatives.map(shift) } : {}) } } } : {}),
  };
}

/** An operator's action speed: attribute 92 (KeywordSpeedUpScalar, default 1) plus haste buffs, within its limits (0.1–1.3, AttributeMetaTable). */
export function actionSpeed(ctx: TimelineContext, st: TimelineState, operator: string, frame: number): number {
  const panel = panelAt(ctx, operator, frame);
  const base = attrTotal(ctx, panel, Attr.KeywordSpeedUpScalar);
  return clampAttr(ctx.data, Attr.KeywordSpeedUpScalar, base + buffAttr(st.buffs, operator, frame, Attr.KeywordSpeedUpScalar, panel.attrs[Attr.KeywordSpeedUpScalar]));
}
