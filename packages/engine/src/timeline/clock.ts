// Slow-downs and the clocks they stop (docs/design/timeline.md "Time"): the world's, the enemy's and each operator's.

import type { SkillTiming } from "../model.ts";
import type { ActiveBuff } from "../buffs.ts";
import { rampElapsed, type EnemyStatus } from "../status.ts";
import type { ChainStep, TimelineContext, TimelineState } from "./state.ts";
import { rebaseCooldowns } from "./resources.ts";
import { onOperator, shiftClock } from "./schedule.ts";
import { engineReading } from "./assumptions.ts";

/**
 * A skill's global slow-downs (docs/design/timeline.md "Time"): the world (enemy
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
  // Its resets end the running slow-downs of their priority (others' and, below, its own) where they come.
  const reading = engineReading(ctx.scenario, "combo-reset");
  const resets = reading !== "none" ? (timing.resets ?? []).map((r) => ({ frame: frame + r.at, priority: r.priority })) : [];
  for (const r of resets) s = resetSlowdowns(ctx, s, r);
  // An earlier cast's resets still to come (`reaches`) end its slow-downs of their priority there too: a teammate's
  // combo pressed inside Arcane's first 9 frames runs only to her frame 9 (btl_upload_9555de54bb3d at 31.73 s: Xaihi's
  // 27-frame slow-down 7 frames after Arcane's start; her Imprisonment burst comes 1.46 s after her cast, as with no
  // teammate's combo, 81.53 s: 1.48 s; a held world puts it later), as the log tools' stop lists cut it (withResets).
  const pending = reading === "reaches" ? (s.resets ?? []).filter((r) => r.frame > frame) : [];
  if (reading === "reaches") s = { ...s, resets: [...pending, ...resets.filter((r) => r.frame > frame).map((r) => ({ ...r, by: caster }))] };
  const own = timing.slowdowns
    .map((d) => {
      const whole = { start: frame + d.from, scales: d.scales, ...(d.priority !== undefined ? { priority: d.priority } : {}) };
      const cut = cutAtResets([whole], [...pending, ...resets])[0] as typeof whole;
      // The caster of a pending reset that cuts it isn't held by it: her frame 9 comes when it ends (the reset's frame).
      const by = cut.scales.length < whole.scales.length ? pending.find((r) => r.priority === cut.priority && r.frame === cut.start + cut.scales.length)?.by : undefined;
      return { ...cut, ...(by !== undefined ? { spares: by } : {}) };
    })
    .filter((d) => d.scales.length > 0);
  for (const d of own) {
    const start = d.start;
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
      if (who === caster || who === d.spares) return { n: 0, from: start };
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
    s = { ...shiftWorld(s, start, world), slowdowns: [...s.slowdowns, { start, scales: d.scales, exempt: caster, ...(ultimate ? { ultimate: true as const } : {}), ...(d.priority !== undefined ? { priority: d.priority } : {}) }] };
    for (const [op, l] of by) s = shiftOperator(s, op, l.from, l.n);
  }
  // Cooldowns run on through it, while the buffs on the world's clock (a recovery rate's among them) last longer.
  return rebaseCooldowns(ctx, st, s, frame);
}

/**
 * A skill's slow-downs along a path (casting.ts plannedSlowdowns; the log check's stop lists, logcasts.ts skillStops):
 * the jumps taken (`from` → `to`, skill frames) and the timing's own ends (InterruptCurSkillAction) and casts of the
 * operator's next skill (recasts: Purrchena's shielded combo casts its loop at 250, so its 210 path never reaches the
 * frame-270 slow-down). One in a skipped segment or after the first end the path reaches never starts, and one after a
 * jump starts that much sooner. Rossi's
 * sequence 2 (combo_3) holds the world again at its frame 212, the start of the path its frame-0 jump takes when the
 * timing isn't perfect; the perfect path ends at 211.
 */
export function pathSlowdowns(timing: SkillTiming, jumps: readonly { readonly from: number; readonly to: number }[]): SkillTiming["slowdowns"] {
  const ends = [...timing.ends, ...(timing.recasts ?? [])];
  if (jumps.length === 0 && ends.length === 0) return timing.slowdowns;
  const skips: { from: number; to: number }[] = [];
  for (const j of [...jumps].sort((a, b) => a.from - b.from)) if (!skips.some((k) => j.from > k.from && j.from < k.to)) skips.push({ from: j.from, to: j.to });
  const skipped = (x: number) => skips.some((k) => x > k.from && x < k.to);
  const end = Math.min(Infinity, ...ends.filter((e) => !skipped(e)));
  return timing.slowdowns
    .filter((d) => !skipped(d.from) && d.from < end)
    .map((d) => ({ ...d, from: d.from - skips.filter((k) => k.to <= d.from).reduce((t, k) => t + (k.to - k.from), 0) }));
}

/**
 * Slow-downs after resets (SkillTiming.resets): a reset at `frame` ends every slow-down of its priority that started
 * before it and runs past it. The game keeps one dilation per priority, the latest taking the place of the one running
 * (a reset is a dilation at scale 1; under the lowest-scale rule it would do nothing): Arcane's combo resets the combo
 * priority at its frame 9, so its own 0.6 s slow-down holds the world only those 9 frames, and a teammate's combo
 * slow-down running then ends with it (btl_upload_3f78ceb15bc3's opener: Gilberta's combo, then Si's and Arcane's;
 * Corrosion's ramp, applied at 1.33 s before them, reads a step ahead of the lowest-scale rule's at 3.06–3.18 s, the
 * replay holding 0.93 s where the steps allow 0.73 s; with the reset 0.72 s). Engine assumption combo-reset.
 */
export function cutAtResets<T extends { readonly start: number; readonly scales: readonly number[]; readonly priority?: number }>(stops: readonly T[], resets: readonly { readonly frame: number; readonly priority: number }[]): T[] {
  if (resets.length === 0) return [...stops];
  return stops.map((s) => {
    const at = resets.filter((r) => r.priority === s.priority && r.frame > s.start && r.frame < s.start + s.scales.length).reduce((m, r) => Math.min(m, r.frame), Infinity);
    return Number.isFinite(at) ? { ...s, scales: s.scales.slice(0, at - s.start) } : s;
  });
}

/**
 * The running slow-downs of a reset's priority end at its frame (cutAtResets): what they would still have taken from
 * the world's clock and each operator's after it comes back (everything there happens that much sooner), as slowDown
 * counts it: the lowest scale of the slow-downs holding a clock, none in its own ultimate's stop.
 */
function resetSlowdowns(ctx: TimelineContext, st: TimelineState, reset: { readonly frame: number; readonly priority: number }): TimelineState {
  const cut = cutAtResets(st.slowdowns, [reset]);
  if (cut.every((x, i) => x.scales.length === (st.slowdowns[i] as (typeof st.slowdowns)[number]).scales.length)) return st;
  const R = reset.frame;
  const last = Math.max(...st.slowdowns.map((x) => x.start + x.scales.length));
  const lostAfter = (list: typeof st.slowdowns, who: string | null): number => {
    let sum = 0;
    for (let f = R; f < last; f++) {
      if (who !== null && list.some((x) => x.ultimate && x.exempt === who && f >= x.start && f < x.start + x.scales.length)) continue;
      let m = 1;
      for (const x of list) if (x.exempt !== who && f >= x.start && f < x.start + x.scales.length) m = Math.min(m, x.scales[f - x.start] as number);
      sum += 1 - m;
    }
    return sum;
  };
  const back = (who: string | null) => Math.round(lostAfter(st.slowdowns, who) - lostAfter(cut, who));
  let s: TimelineState = { ...shiftWorld(st, R, -back(null)), slowdowns: cut };
  for (const b of ctx.scenario.team) s = shiftOperator(s, b.operator, R, -back(b.operator));
  return s;
}

/**
 * A frame after `start` moved `n` frames (n < 0: sooner, but not to `start` or before): the one mapping of an event time
 * under a slow-down or its reset (an expiry, a tick, a window's or freeze's end, a scheduled item), which every shift
 * function below uses. A reference a reading subtracts from is not an event and takes no floor: Corrosion's appliedAt
 * (shiftEnemy), read inside a stop only through rampElapsed, never as `frame - appliedAt` (btl_upload_4d60e7fe92c2 at
 * 73.65 s); a buff's appliedAt is its identity and never moves. Round 8 looked for other anchor readings in the engine
 * (`frame - x.appliedAt` and the like): there are none; an operator's running action moves whole (shiftOperator).
 */
function moved(start: number, n: number): (f: number) => number {
  return (f) => (f > start ? (n >= 0 ? f + n : Math.max(start + 1, f + n)) : f);
}

/**
 * The world's clock held `frames` frames from `frame` by nothing a cast places (shiftWorld: the enemy's timers, every
 * buff, combo windows, energy blocks, the triggers' cooldowns on the world's clock); the operators' clocks, skill
 * cooldowns and SP run on. The log check's replay places
 * the fight's hidden holds with it (engine assumption hidden-holds, reading `placed`: packages/logs holds.ts), where
 * the operators' timing is the log's own: holding their clocks too moved kit-timed landings off the log's (2026-11-23:
 * btl_upload_bdf223db8e49 lost Typhoeus's Nature burst at 13.14 s to one frame of hold at 12.27 s; the scoreboard's
 * verified mean |damage error| 1.9 → 3.2%, world only 1.9%). A simulation places its dodges itself (advance.ts enemyAct).
 */
export function holdWorld(st: TimelineState, frame: number, frames: number): TimelineState {
  return frames <= 0 ? st : shiftWorld(st, frame, frames);
}

/**
 * The world's frames the time stops and slow-downs running at `frame` still take from it (the lowest scale where they
 * overlap, as slowDown counts them): what a buff created at `frame` is held by, as the buffs already running were when
 * each began (engine assumption `buff-in-stop`, reading `held`; actions.ts addBuff). 0 outside every stop.
 */
export function heldFromNow(st: TimelineState, frame: number, ultimatesOnly = false): number {
  const holding = ultimatesOnly ? st.slowdowns.filter((x) => x.ultimate) : st.slowdowns;
  const running = holding.filter((x) => x.start + x.scales.length > frame && x.start <= frame);
  if (running.length === 0) return 0;
  const last = Math.max(...running.map((x) => x.start + x.scales.length));
  let held = 0;
  for (let f = frame; f < last; f++) {
    let m = 1;
    for (const x of holding) if (f >= x.start && f < x.start + x.scales.length) m = Math.min(m, x.scales[f - x.start] as number);
    held += 1 - m;
  }
  return Math.round(held);
}

/**
 * The enemy after an application at `frame`: the reaction statuses it created then (not one it left as it was) held by
 * the rest of the time stops and slow-downs running (heldFromNow), as a buff created then is (engine assumption
 * `status-in-stop`, default `held`; `runs`: as they are).
 */
export function holdNewStatuses(ctx: TimelineContext, st: TimelineState, before: EnemyStatus, after: EnemyStatus, frame: number): EnemyStatus {
  if (engineReading(ctx.scenario, "status-in-stop") !== "held") return after;
  const n = heldFromNow(st, frame);
  if (n <= 0) return after;
  // Its ramp (Corrosion's appliedAt) too; a Combustion keeps its appliedAt, by which its snapshot is retaken.
  const kept = (x: EnemyStatus["statuses"][number]) => before.statuses.some((y) => y.status === x.status && y.appliedAt === x.appliedAt && y.expiresAt === x.expiresAt && y.level === x.level);
  const statuses = after.statuses.map((x) => (x.appliedAt === frame && !kept(x) ? { ...x, ...(x.status === "corrosion" ? { appliedAt: x.appliedAt + n } : {}), expiresAt: x.expiresAt + n, ...(x.nextTickAt !== undefined ? { nextTickAt: x.nextTickAt + n } : {}) } : x));
  return { ...after, statuses };
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
 * the enemy's `controlImmune` (set from the logs per enemy: packages/data/src/enemyFacts.ts). Every other enemy
 * freezes, bosses too (in-game test 104, the owner 2026-11-16: most bosses do; until then every Boss was taken as
 * immune). Rhodagn's five logs with a freezer check the same either way. The engine assumption `control-immunity`
 * (timeline/assumptions.ts) switches the rule: listed (this, the default), bosses, none, all.
 */
export function controlImmune(ctx: TimelineContext): boolean {
  if (ctx.scenario.target.controlImmune !== undefined) return ctx.scenario.target.controlImmune;
  const enemy = ctx.data.enemies[ctx.scenario.target.enemy];
  switch (engineReading(ctx.scenario, "control-immunity")) {
    case "bosses":
      return enemy?.rank === 2;
    case "none":
      return false;
    case "all":
      return true;
    default:
      return enemy?.controlImmune === true;
  }
}

/**
 * The enemy's own clock after `start` (its statuses, inflictions, Vulnerable, physical and control statuses, its
 * stagger, its actions, the end of a freeze: TimelineState.enemyFrozenUntil) runs `n` frames later. Not the debuffs
 * on it (enemy-target buffs): shiftDebuffs.
 */
export function shiftEnemy(st: TimelineState, start: number, n: number): TimelineState {
  if (n === 0) return st;
  const later = moved(start, n);
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
        // Its ramp (Corrosion) doesn't advance while time stands still: it resumes n frames later, and stands at what it
        // had reached until then (ActiveStatus.rampHeld; moving appliedAt alone set it back by the stop at its start:
        // btl_upload_4d60e7fe92c2 at 73.65 s, Arcane's hit inside Zhuang Fangyi's ultimate stop read a level-4 Corrosion
        // 2.6 s younger than the log's).
        ...(x.appliedAt <= start && x.expiresAt > start
          ? { appliedAt: x.appliedAt + n, ...(x.status === "corrosion" ? { rampHeld: { until: Math.max(start + n, x.rampHeld && x.rampHeld.until > start ? x.rampHeld.until + n : 0), elapsed: rampElapsed(x, start) } } : {}) }
          : // Sooner (a reset: resetSlowdowns): one applied inside the slow-down, whose timer and ramp start when it ends
            // (holdNewStatuses), starts that much sooner too.
            // appliedAt is the ramp's reference there, not an event: no floor.
            n < 0 && x.appliedAt > start && x.expiresAt > start
            ? { appliedAt: x.appliedAt + n, ...(x.rampHeld && x.rampHeld.until > start ? { rampHeld: { ...x.rampHeld, until: Math.max(start, x.rampHeld.until + n) } } : {}) }
            : {}),
      })),
    },
    stagger: st.stagger.until !== null ? { ...st.stagger, until: later(st.stagger.until) } : st.stagger,
    // A freeze running at `start` ends that much later (a freeze that overlaps it then counts what it adds: runTriggers).
    enemyFrozenUntil: later(st.enemyFrozenUntil),
    scheduled: shiftClock(st.scheduled, (c) => c === "enemy", start, n),
  };
}

/**
 * The enemy after a freeze held its clock (shiftEnemy from `before`), with Corrosion's ramp as it was: a freeze holds
 * the ramp's end, not its steps (engine assumption freeze-ramp, reading `runs`: actions.ts runTriggers). The log's
 * ramp steps run on across Si's Immobilization (f978430a083a 57.6 s: at most 0.51 s held of its 1.5 s, a7a7a40c97ed
 * 18.1 s 0.68 s) and Tangtang's stare (791020039384 47.8 s: about 0.7 s of 4 s), where the replay held the ramp the
 * freeze's whole length and read Ardelia's and Arcane's hits a step behind (scripts/probes/corrosion/freezeramp.ts).
 */
export function rampRunsOn(before: TimelineState, after: TimelineState): TimelineState {
  const was = before.enemy.statuses;
  if (!was.some((x) => x.status === "corrosion")) return after;
  const statuses = after.enemy.statuses.map((x, i) => {
    const y = was[i];
    if (x.status !== "corrosion" || !y || y.status !== "corrosion") return x;
    const { rampHeld: _, ...rest } = x;
    return { ...rest, appliedAt: y.appliedAt, ...(y.rampHeld ? { rampHeld: y.rampHeld } : {}) };
  });
  return { ...after, enemy: { ...after.enemy, statuses } };
}

/**
 * The debuffs on the enemy (enemy-target buffs) after `start`, all or only `owner`'s, end `n` frames later (a freeze:
 * not those that run through one, KitBuff.runsThroughFreeze). Every buff has an owner (the operator whose kit, weapon
 * or gear set applied it: buffs.ts ActiveBuff.owner), so none is left undecided.
 */
export function shiftDebuffs(st: TimelineState, start: number, n: number, owner?: string): TimelineState {
  if (n <= 0) return st;
  return { ...st, buffs: st.buffs.map((b) => (b.target === "enemy" && !b.runsThroughFreeze && (owner === undefined || b.owner === owner) ? shiftBuff(b, start, n) : b)) };
}

function shiftBuff(b: ActiveBuff, start: number, n: number): ActiveBuff {
  const later = moved(start, n);
  // An expiry taken from the log already holds every stop up to it (ActiveBuff.pinned).
  return b.expiresAt > start || (b.nextTick ?? -1) > start ? { ...b, expiresAt: b.pinned ? b.expiresAt : later(b.expiresAt), ...(b.nextTick !== undefined ? { nextTick: later(b.nextTick) } : {}) } : b;
}

/** The triggers' cooldowns on the world's clock (their `world` flag: KitTrigger.cooldownClock) running past `start` end `n` frames later. */
function shiftTriggerCooldowns(ts: TimelineState["triggerState"], start: number, n: number): TimelineState["triggerState"] {
  if (n === 0 || !Object.values(ts).some((x) => x.world && x.readyAt > start)) return ts;
  const later = moved(start, n);
  return Object.fromEntries(Object.entries(ts).map(([k, x]) => [k, x.world && x.readyAt > start ? { ...x, readyAt: later(x.readyAt) } : x]));
}

/** Everything on the world's clock after `start` happens `n` frames later: the enemy's, every buff, combo windows, energy blocks. */
function shiftWorld(st: TimelineState, start: number, n: number): TimelineState {
  if (n === 0) return st;
  const later = moved(start, n);
  const e = shiftEnemy(st, start, n);
  return {
    ...e,
    buffs: e.buffs.map((b) => shiftBuff(b, start, n)),
    enemyFrozenBy: Object.fromEntries(Object.entries(st.enemyFrozenBy).map(([k, f]) => [k, later(f)])),
    scheduled: shiftClock(e.scheduled, (c) => c === "world", start, n),
    comboWindow: Object.fromEntries(Object.entries(st.comboWindow).map(([k, w]) => [k, { ...w, until: later(w.until) }])),
    energyBlockedUntil: Object.fromEntries(Object.entries(st.energyBlockedUntil).map(([k, f]) => [k, later(f)])),
    link: st.link.map(later),
    triggerState: shiftTriggerCooldowns(st.triggerState, start, n),
    // SP isn't on it: regen and its pause after a spend run on raw time, as cooldowns do (rules.ts SP).
  };
}

/**
 * An operator's own timeline after `start` (what's scheduled on its clock: its hits on the way, delayed actions, its
 * casts' team energy and jumps; its current action) happens `n` frames later. What belongs to a cast is on the cast's
 * operator's clock (as endCurrentSkill and takeJump treat it); a delayed action of no cast on its trigger's owner's.
 */
export function shiftOperator(st: TimelineState, operator: string, start: number, n: number, bursts = true): TimelineState {
  if (n === 0) return st;
  const later = moved(start, n);
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
