// What holds the replay's timers to the log (buffreplay.ts replayKitBuffs, replayrun.ts makeCast): a logged event
// read as a buff's tick (loggedTick, endedWithTick, heldTicks and the ticks' logged frames), each kit buff's logged
// run ends (loggedLaneEnds, heldToLoggedEnds), and the hidden holds' bounds from those runs and the enemy's statuses
// (runBounds, statusInstances, consumedStatuses; holds.ts places them). Split from buffreplay.ts (improvement round 14).

import {
  activeAt, advance, everyTarget, FPS, reaches,
  type ActiveBuff, type KitBuff, type OperatorKit, type ReactionRecord, type TimelineContext, type TimelineState,
} from "@efsim/engine";
import { TARGET_SIDE_ZONES, type LogFixture } from "./zmdlogs.ts";
import { loggedNames } from "./enginecheck.ts";
import { worldMs, type Placement, type TimeStop } from "./logcasts.ts";
import { gapsWithin, pausedBound, HOLD_BOUND_TOL_MS, notAClock, notAClockWords, refreshedIn, RUN_START_MS, type ClockWhy, type Gap, type HoldBound, type StatusInstance } from "./holds.ts";
import { type ReplayedCast, frameOf } from "./castassembly.ts";

/**
 * A logged cast event that is a tick of one of its operator's buffs (KitBuff.ticksLoggedAs) on at `f`, as the state
 * after it, or null when it's a press. Liino's battle-skill events during her Vocalist Stance are its beats (the owner,
 * who plays her; the stance's music_trigger is 3 s, and of the events of one stance only the first has projectiles
 * behind it): no cast, no SP. The tick is the log's (bdf223db8e49 lists one more layer of her weapon's heal ATK on
 * Typhoeus after each event, none between): one the replay has due within half an interval comes at the event (one
 * due earlier waited for it: heldTicks), and the next an interval after it (the replay's own ticks drift from the
 * game's: 1d9198480e75's ran 1.5 s early by 27 s).
 */
export function loggedTick(ctx: TimelineContext, st: TimelineState, c: ReplayedCast, f: number): TimelineState | null {
  if (c.landings.length > 0) return null;
  const ids = new Set((ctx.kits.get(c.operator)?.buffs ?? []).filter((d) => d.ticksLoggedAs === c.skillId).map((d) => d.id));
  const b = ids.size ? st.buffs.find((x) => ids.has(x.id) && x.owner === c.operator && x.cast === undefined && x.every !== undefined && activeAt(x, f)) : undefined;
  if (!b || b.every === undefined) return null;
  const every = b.every;
  const due = b.nextTick !== undefined && b.nextTick - f <= every / 2;
  const defs = ctx.kits.get(c.operator)?.buffs ?? [];
  const follows = defs.some((d) => d.id === b.id && d.endFollowsTick);
  const moved = movedTick(b, due ? f : f + every, follows && due);
  const next = { ...st, buffs: withChildren(st.buffs, b, moved, childrenOf(defs, b.id)) };
  return due ? advance(ctx, next, f) : next;
}

/**
 * Whether a logged cast event at `f` is the last tick of a buff of its operator's that ends at `f` with it (KitBuff
 * ticksLoggedAs and endFollowsTick; `st0` the state not yet advanced to `f`): the advance to `f` has already ticked and
 * ended it, so loggedTick no longer finds it on. A tick heldTicks brings to its logged event ends the buff at the
 * event's frame: Zhuang Fangyi's Empyrean end in d774d0ce7bd3 at 135.57 s (held 0.37 s to it) and 4bfc6f3e84b8 at
 * 179.51 s (due at that frame), which the replay made real ultimates for, a 78-frame stop each.
 */
export function endedWithTick(ctx: TimelineContext, st0: TimelineState, c: ReplayedCast, f: number): boolean {
  if (c.landings.length > 0) return false;
  const defs = ctx.kits.get(c.operator)?.buffs ?? [];
  const ids = new Set(defs.filter((d) => d.ticksLoggedAs === c.skillId && d.endFollowsTick).map((d) => d.id));
  return ids.size > 0 && st0.buffs.some((x) => ids.has(x.id) && x.owner === c.operator && x.cast === undefined && x.expiresAt === f && x.nextTick === f && activeAt(x, f - 1));
}

/** The ids of a kit's buffs that are children of `parent` (KitBuff.childOf). */
function childrenOf(defs: readonly KitBuff[], parent: string): Set<string> {
  return new Set(defs.filter((d) => d.childOf === parent).map((d) => d.id));
}

/** The buffs with `b` replaced by `moved`, and the instances of its children (`children`) that ended with it moved to its new end. */
function withChildren(buffs: readonly ActiveBuff[], b: ActiveBuff, moved: ActiveBuff, children: ReadonlySet<string>): ActiveBuff[] {
  return buffs.map((x) => (x === b ? moved : children.has(x.id) && x.owner === b.owner && x.cast === undefined && x.expiresAt === b.expiresAt ? { ...x, expiresAt: moved.expiresAt } : x));
}

/**
 * A buff with its next tick at `to`; with `endFollows` (KitBuff.endFollowsTick: one game timer gives both, Arcane's
 * Imprisonment) its end moves as far as a due tick does (not past a tick it has already had).
 */
function movedTick(b: ActiveBuff, to: number, endFollows: boolean): ActiveBuff {
  const from = b.nextTick;
  if (!endFollows || from === undefined || from > b.expiresAt || !Number.isFinite(b.expiresAt)) return { ...b, nextTick: to };
  return { ...b, nextTick: to, expiresAt: b.expiresAt + (to - from) };
}

/** The frames of the logged cast events that may be ticks of a buff (KitBuff.ticksLoggedAs), per `owner|buff`. */
export function loggedTickFrames(kits: readonly OperatorKit[], casts: readonly ReplayedCast[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const k of kits) for (const d of k.buffs) {
    if (d.ticksLoggedAs === undefined) continue;
    const frames = casts.filter((c) => c.operator === k.operator && c.skillId === d.ticksLoggedAs && c.landings.length === 0).map((c) => frameOf(c.start));
    if (frames.length) out.set(`${k.operator}|${d.id}`, frames);
  }
  return out;
}

/**
 * The frames at which a buff's ticks fired a trigger's hits the log shows, per `owner|buff` (buffs with
 * KitBuff.ticksShownByHits): each placed cast of a trigger on the buff's ticks (`buffTick`), its start (its first logged
 * landing less the landing's frame). Liino's volleys: her
 * volley timer ticks every 10 s of her stance's clock, which runs slower than the replay's world time (1.0–11.7 s logged
 * between volleys without a time stop; 9090afbacec9's 10.1–11.2 s with the stops taken out), so the replay's ticks drift
 * a second or more early by the second volley.
 */
export function loggedTickLandings(kits: readonly OperatorKit[], placement: Placement): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const k of kits) for (const t of k.triggers) {
    if (t.on.event !== "buffTick" || !("buff" in t.on)) continue;
    const buff = t.on.buff;
    if (!k.buffs.some((d) => d.id === buff && d.ticksShownByHits)) continue;
    const key = `${k.operator}|${buff}`;
    const frames = placement.casts.filter((c) => c.operator === k.operator && c.group === `trigger:${t.id}`).map((c) => frameOf(c.start));
    if (frames.length) out.set(key, [...(out.get(key) ?? []), ...frames].sort((a, b) => a - b));
  }
  return out;
}

/** The logged moments of buffs' ticks: cast events (loggedTickFrames) and the starts of landings ticks fired (loggedTickLandings). */
export interface TickEvents {
  readonly events: ReadonlyMap<string, readonly number[]>;
  readonly landings: ReadonlyMap<string, readonly number[]>;
  /** The `owner|buff` keys whose end follows their tick (KitBuff.endFollowsTick), each with its children's ids (KitBuff.childOf). */
  readonly endFollows?: ReadonlyMap<string, ReadonlySet<string>>;
}

/** The `owner|buff` keys of the buffs whose end follows their tick (KitBuff.endFollowsTick), with their children's ids. */
export function endFollowsTick(kits: readonly OperatorKit[]): Map<string, Set<string>> {
  return new Map(kits.flatMap((k) => k.buffs.filter((d) => d.endFollowsTick).map((d) => [`${k.operator}|${d.id}`, childrenOf(k.buffs, d.id)] as const)));
}

/**
 * A tick the replay has due waits for a logged event of it up to half an interval later, and at least this many frames:
 * the replay's holds across time stops differ from the game's by up to ~0.7 s (btl_upload_a7a7a40c97ed: Arcane's INT
 * lasers at 48.89 s, 0.69 s after the replay's due tick, across Liino's and Si's ultimates; their interval is 41 frames).
 */
const TICK_HOLD_FRAMES = 30;

/**
 * The state with each tick due by `frame` that comes less than half an interval (TICK_HOLD_FRAMES at least) before a logged event of it (loggedTickFrames) held to that event (loggedTick).
 * With `landings` (loggedTickLandings): also a tick due less than half an interval after a logged landing's start between
 * the state's frame and `frame` brought to it (no later than the state's frame), as loggedTick does at a cast event. A
 * buff whose ticks its hits show has its end on the same clock: it moves with the tick (Liino's Cosmovoice song, 10 beats
 * on a clock of their own: 4d60e7fe92c2's second Cosmovoice, its beats 1.36 s apart, ran on to two replay-only beats
 * past its ninth logged one).
 */
export function heldTicks(st: TimelineState, frame: number, ticks: TickEvents): TimelineState {
  const { events, landings } = ticks;
  if (events.size === 0 && landings.size === 0) return st;
  let changed = false;
  const moves: { b: ActiveBuff; moved: ActiveBuff; children: ReadonlySet<string> }[] = [];
  const buffs0 = st.buffs.map((b) => {
    const key = `${b.owner}|${b.id}`;
    const [n, every] = [b.nextTick, b.every];
    if (n === undefined || every === undefined || b.cast !== undefined) return b;
    const shown = landings.get(key);
    const early = shown?.find((x) => x <= frame && x >= st.frame && x < n && n - x <= every / 2);
    const children = ticks.endFollows?.get(key);
    const move = (to: number) => {
      changed = true;
      const moved = movedTick(b, to, children !== undefined || shown !== undefined);
      if (children?.size) moves.push({ b, moved, children });
      return moved;
    };
    if (early !== undefined) return move(Math.max(early, st.frame));
    // The longer hold (TICK_HOLD_FRAMES) is for ticks logged as cast events (ticksLoggedAs); a tick its hits show
    // (ticksShownByHits) waits at most half an interval, or a short-interval buff's tick takes the next one's hit
    // (Rossi's bleed in 489c0be3e162).
    const held = (events.get(key) ?? []).filter((x) => x - n <= Math.max(every / 2, TICK_HOLD_FRAMES));
    const frames = [...held, ...(shown ?? []).filter((x) => x - n <= every / 2)];
    if (!frames.length || n > frame) return b;
    const e = frames.filter((x) => x > n).sort((x, y) => x - y)[0];
    if (e === undefined) return b;
    return move(e);
  });
  if (!changed) return st;
  let buffs = buffs0;
  for (const { b, moved, children } of moves) buffs = withChildren(buffs.map((x) => (x === moved ? b : x)), b, moved, children);
  return { ...st, buffs };
}

/** One run of a listed game buff (one source, start and holder): its last listed hit (loggedLaneEnds), ms. */
export interface LoggedLaneEnd {
  readonly buff: string;
  readonly source: string;
  readonly since: number;
  /** The operator whose hits list it, or "enemy" for a debuff (an enemy-side zone: TARGET_SIDE_ZONES). */
  readonly holder: string;
  readonly lastListed: number;
  /**
   * Another run of it (same source and holder) starts inside this one and this one isn't listed past it (by more than
   * REFRESH_OVERLAP_MS): the log shows a refresh. Runs listed side by side are two instances (a stackingType 1 buff:
   * 4360447193ac, Perlica's Arts DMG Taken from 92.24 s listed with the one from 104.92 s to 108.27 s).
   */
  readonly refreshed: boolean;
}

/**
 * Where the log's listing of each buff ends (hidden-holds `log`): every run of every listed game buff, by `buff|source`,
 * and the logged hits in time order with what each lists (`buff|source`), on its hitter or on the enemy.
 */
export interface LoggedLaneEnds {
  readonly runs: ReadonlyMap<string, readonly LoggedLaneEnd[]>;
  readonly hits: readonly { readonly t: number; readonly operator: string; readonly listed: ReadonlySet<string> }[];
  /** Each instance's end by the log once decided (loggedEndOf; null: the log doesn't decide it), by `owner|id|appliedAt`. */
  readonly decided: Map<string, { readonly end: number } | null>;
  /** Why loggedEndOf decided so, by the same key (`zmdlogs holds --why`: the log-end side of an instance's verdict). */
  readonly why: Map<string, string>;
}

/** The log's runs of its listed buffs and what each hit lists (LoggedLaneEnds), nothing decided yet. */
export function loggedLaneEnds(fx: Pick<LogFixture, "hits">): LoggedLaneEnds {
  const runs = new Map<string, { buff: string; source: string; since: number; holder: string; lastListed: number }>();
  const hits = [...fx.hits].sort((a, b) => a.t - b.t).map((h) => ({ t: h.t, operator: h.operator, listed: new Set([...h.effects, ...h.boundaryEffects].flatMap((e) => (e.source === undefined ? [] : [`${e.buff}|${e.source}`]))) }));
  for (const h of fx.hits) {
    // A boundary effect at the lane's start says nothing of its end; one at its end is the end itself.
    for (const e of [...h.effects, ...h.boundaryEffects.filter((x) => x.since !== h.t)]) {
      if (e.since === undefined || e.source === undefined) continue;
      const holder = TARGET_SIDE_ZONES.has(e.zone) ? "enemy" : h.operator;
      const key = `${e.buff}|${e.source}|${e.since}|${holder}`;
      const run = runs.get(key);
      if (!run) runs.set(key, { buff: e.buff, source: e.source, since: e.since, holder, lastListed: h.t });
      else if (h.t > run.lastListed) runs.set(key, { ...run, lastListed: h.t });
    }
  }
  const all = [...runs.values()];
  const out = new Map<string, LoggedLaneEnd[]>();
  for (const r of all) {
    const refreshed = refreshedIn(r, all, (a, b) => a.buff === b.buff && a.source === b.source && a.holder === b.holder);
    const key = `${r.buff}|${r.source}`;
    out.set(key, [...(out.get(key) ?? []), { ...r, refreshed }]);
  }
  return { runs: out, hits, decided: new Map(), why: new Map() };
}

/** The fewest of the team's debuffs on the enemy that end at one logged moment for the log to show a purge (loggedPurges). */
export const PURGE_MIN_RUNS = 3;

/** The longest wait (ms) from a purge's moment to the log's next one (loggedPurges): a longer gap is an away stretch. */
export const PURGE_GAP_MS = 1500;

/**
 * The frames at which the log shows the enemy's debuffs cleared at once (engine assumption logged-purges, reading
 * `log`): a logged moment after which none of the team's runs on the enemy (game buffs in an enemy-side zone,
 * TARGET_SIDE_ZONES, one run per buff, source and since) listed there is ever listed again, at least PURGE_MIN_RUNS
 * debuffs (a debuff's per-element affixes count once) from at least two operators, with the next logged moment within
 * PURGE_GAP_MS. Its frame is the one after the moment's. Not pending/zmdlogs-3aa6ab93bad4.json at 25.42 s (Arcane's
 * Doubles Susceptibility, both affixes, and Perlica's Electrification: two debuffs ending together, the replay's own
 * statuses running on as the log's hits after it say). Hard 33's Woodcraft Slugs (eny_0129_slwood_hdg033, eight under
 * one enemy id) show it where one slug is killed and the next takes the hits, its debuffs gone with the dead one, not
 * a phase change (docs/open-problems.md "Hard 33's Woodcraft Slugs: eight targets under one id"): pending/zmdlogs-63398339803e.json
 * at 10.35 s (Jade Vessel, Arcane's Tactical Doubles Susceptibility and her weapon's two lines, none listed from 10.91
 * s; every hit after 11.27 s reads exactly with the log's listing and ×1.40 low with the replay's) and at 29.38 s
 * (Camille's Susceptibility, Arcane's: her Doubles one gone before Si's combo final at 29.57 s). No kit's rule ends
 * them; a purge ends every enemy-side kit buff on (purgedByLog).
 */
export function loggedPurges(fx: Pick<LogFixture, "hits" | "team">): number[] {
  const team = new Set(fx.team.map((b) => b.operator));
  const runs = new Map<string, { source: string; debuff: string; first: number; last: number }>();
  for (const h of fx.hits) {
    // A boundary effect at the run's start says nothing of its end; one at its end is the end itself (loggedLaneEnds).
    for (const e of [...h.effects, ...h.boundaryEffects.filter((x) => x.since !== h.t)]) {
      if (e.source === undefined || !team.has(e.source) || !TARGET_SIDE_ZONES.has(e.zone)) continue;
      const key = `${e.buff}|${e.source}|${e.since ?? ""}`;
      // One debuff's per-element affixes (buff_common_affixes_vulnerable_crystal and _natural from one source and
      // since: Arcane's Doubles Susceptibility) count once.
      const debuff = `${e.buff.replace(/^(buff_common_affixes_[a-z]+)_[a-z]+$/, "$1")}|${e.source}|${e.since ?? ""}`;
      const r = runs.get(key);
      runs.set(key, r ? { ...r, first: Math.min(r.first, h.t), last: Math.max(r.last, h.t) } : { source: e.source, debuff, first: h.t, last: h.t });
    }
  }
  const moments = [...new Set(fx.hits.map((h) => h.t))].sort((a, b) => a - b);
  const out: number[] = [];
  for (const [i, t] of moments.entries()) {
    const next = moments[i + 1];
    if (next === undefined || next - t > PURGE_GAP_MS) continue;
    const listed = [...runs.values()].filter((r) => r.first <= t && r.last >= t);
    if (new Set(listed.map((r) => r.debuff)).size < PURGE_MIN_RUNS || listed.some((r) => r.last > t) || new Set(listed.map((r) => r.source)).size < 2) continue;
    out.push(frameOf(t) + 1);
  }
  return out;
}

/**
 * The state with every enemy-side kit buff on at a purge the log shows (loggedPurges) inside (st.frame, `frame`]
 * ended there (pinned: the log's time holds every stop up to it). Its triggers on ending run as on any end.
 */
export function purgedByLog(st: TimelineState, frame: number, purges: readonly number[]): TimelineState {
  const due = purges.filter((p) => p > st.frame && p <= frame);
  if (due.length === 0) return st;
  let changed = false;
  const buffs = st.buffs.map((b) => {
    const p = due.find((x) => b.target === "enemy" && b.cast === undefined && b.appliedAt < x && b.expiresAt > x);
    if (p === undefined) return b;
    changed = true;
    return { ...b, expiresAt: p, pinned: true as const };
  });
  // Its statuses, inflictions, Vulnerable stacks and controls go with them (6339 at 29.38 s: the Heat inflictions the
  // replay had built made an Arts Burst at 29.40 s the log hasn't, and its Solemn Phalanx line on every hit after).
  const end = <T extends { readonly expiresAt: number }>(x: T): T => {
    const p = due.find((y) => x.expiresAt > y);
    if (p === undefined) return x;
    changed = true;
    return { ...x, expiresAt: p };
  };
  const e = st.enemy;
  const enemy = { ...e, vulnerable: e.vulnerable && end(e.vulnerable), infliction: e.infliction && end(e.infliction), physical: e.physical.map(end), controls: e.controls.map(end), statuses: e.statuses.map(end) };
  // An Arts Burst on its way from inflictions the purge cleared doesn't come.
  const scheduled = st.scheduled.filter((x) => !(x.kind === "burst" && due.some((p) => x.frame >= p)));
  if (scheduled.length !== st.scheduled.length) changed = true;
  return changed ? { ...st, buffs, enemy, scheduled } : st;
}

/**
 * How much of a buff's own life (frames from its application to its expiry) the hidden holds may add (hidden-holds
 * `log`). An interim bound from the development logs (scratch measurement, 2026-11-22, docs/open-problems.md "The buff
 * clock"): Si's 12 s Amp runs at most 3.8 s past its world time (489c), Forgeborn's 20 s at most 7.8 s (9c0b, ten seconds
 * with no hit); a run longer than this is a refresh the replay missed or a kit's error, which the check should show.
 */
export const HIDDEN_HOLD_SHARE = 0.4;

/** Ms of a frame. */
export function msOfFrame(f: number): number {
  return (f * 1000) / FPS;
}

/**
 * The enemy's status instances in a replay (holds.ts StatusInstance), from its status events (an application starts
 * one and replaces the one before; statusConsumed ends one early) and its states after each step (the instance's last
 * expiry there, which the stops moved).
 */
export function statusInstances(checkpoints: readonly TimelineState[], reactions: readonly ReactionRecord[], brokenAt: number | null): StatusInstance[] {
  // With the statuses per target (target-statuses `per-target`), each on its own target (ReactionRecord.target; engine everyTarget).
  const applied = reactions.flatMap((r) => (r.kind === "reaction" || (r.kind === "physical" && r.status === "breach") ? [{ status: r.status as string, operator: r.operator, frame: r.frame, target: r.target }] : []));
  const out: StatusInstance[] = [];
  for (const [i, a] of applied.entries()) {
    const next = applied.slice(i + 1).find((b) => b.status === a.status && b.target === a.target)?.frame ?? Infinity;
    const consumed = reactions.some((r) => r.kind === "statusConsumed" && r.status === a.status && r.frame >= a.frame && r.frame < next);
    let last: number | null = null;
    for (const cp of checkpoints) {
      if (cp.frame < a.frame || cp.frame >= next) continue;
      const on = everyTarget(cp)
        .filter((x) => x.target === a.target)
        .flatMap((x) => [...x.enemy.statuses, ...x.enemy.physical])
        .find((x) => x.status === a.status && x.operator === a.operator);
      if (on) last = on.expiresAt;
    }
    if (last === null) continue;
    const expired = !consumed && last <= next && (brokenAt === null || last < brokenAt) && Number.isFinite(last);
    out.push({ status: a.status, operator: a.operator, start: a.frame, end: Math.min(last, next), expired });
  }
  return out;
}

/** The enemy statuses some kit of the team consumes (a `consumeStatus` application: every status where it names none). */
export function consumedStatuses(kits: readonly OperatorKit[]): Set<string> {
  const out = new Set<string>();
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) for (const y of x) walk(y);
    else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      if (o.kind === "consumeStatus") for (const s of (o.statuses as string[] | undefined) ?? ["electrification", "corrosion", "solidification", "combustion"]) out.add(s);
      for (const v of Object.values(o)) walk(v);
    }
  };
  walk(kits);
  return out;
}

/**
 * The bounds the replay's buffs give the hidden holds (holds.ts; hidden-holds `placed`): each instance that ran out in
 * the replay without them (a timed kit buff with one game buff run per instance, as loggedEndOf takes them), against
 * the log's run of it from its application (±RUN_START_MS, not refreshed) on the same holder: its last listed hit (the
 * holds from its application to there at least its lateness over the replay's expiry, in world time: the placed stops
 * after the expiry hold it too once it lasts) and the next hit of the holder without it (at most). Not a run that ends more than 0.4 s before the replay's expiry (a refresh or cut the replay
 * doesn't make: not a clock) or past HIDDEN_HOLD_SHARE of its life.
 */
export function runBounds(kitInstances: ReadonlyMap<string, readonly { start: number; end: number; expired: boolean }[]>, defs: ReadonlyMap<string, KitBuff>, ends: LoggedLaneEnds, stops: readonly TimeStop[], why?: ClockWhy[], paused: readonly Gap[] = []): HoldBound[] {
  const out: HoldBound[] = [];
  const seen = new Set<string>();
  const sec = (ms: number) => (ms / 1000).toFixed(2);
  for (const [key, list] of kitInstances) {
    const [kitKey, op] = key.split("|") as [string, string];
    const def = defs.get(kitKey);
    if (!def) continue;
    const owner = kitKey.slice(0, kitKey.indexOf(":"));
    const holder = def.target === "enemy" ? "enemy" : op;
    // `zmdlogs holds --why`: each instance with the rule that made it a clock or not (ClockWhy); the bounds as before.
    const note = (x: Omit<ClockWhy, "clock" | "holder">) => why?.push({ clock: kitKey, holder, ...x });
    const skip = notAClock(def, { every: true });
    if (skip) {
      note({ instance: null, verdict: `not a clock: the kit buff has ${notAClockWords(def, skip)} (its end isn't its own timer's, or the log merges its instances)` });
      continue;
    }
    for (const w of list) {
      const instance = { start: w.start, end: w.end, expired: w.expired };
      if (!w.expired || !Number.isFinite(w.end)) {
        note({ instance, verdict: "didn't run out in the replay (a step ended or replaced it, or it was on at the end)" });
        continue;
      }
      const [S, E] = [msOfFrame(w.start), msOfFrame(w.end)];
      for (const g of loggedNames(def)) {
        const k = `${g}|${owner}`;
        let near = 0;
        for (const r of ends.runs.get(k) ?? []) {
          if (r.holder !== holder || r.since < S - RUN_START_MS || r.since > S + RUN_START_MS) continue;
          near++;
          const run = { name: g, since: r.since, lastListed: r.lastListed };
          const v = (verdict: string, ask?: number) => note({ instance, run, verdict, ...(ask !== undefined ? { ask } : {}) });
          if (r.refreshed) {
            v("refreshed in the log (another run starts inside it and it isn't listed past that: holds.ts refreshedIn)");
            continue;
          }
          // Instances (KitBuff.instances): a reapplication may refresh the log's run without a new start (Arcane's
          // will_dmg in 489c: runs from 12.0 and 14.6 s both listed to 49.4 s, over the replay's 25 s instances), so only
          // a run the log shows apart from the reapplications inside it (runApart), and only the run that starts nearest the
          // instance (489c: the run from 14.63 s isn't the 12.03 s instance's).
          if (def.instances !== undefined && !runApart(list, w, r, ends.runs.get(k) ?? [])) {
            v("an instance buff's run the log doesn't show apart from the reapplications inside it (runApart)");
            continue;
          }
          // A layer of a layered buff (its own timer: notAClock) the same: its run is the one nearest its application.
          if ((def.instances !== undefined || def.maxStacks !== undefined) && !nearestRun(r, S, ends.runs.get(k) ?? [])) {
            v("another run on its holder starts nearer the application (nearestRun)");
            continue;
          }
          const id = `${k}|${r.since}|${holder}|${w.start}`;
          if (seen.has(id)) continue;
          seen.add(id);
          const off = ends.hits.find((h) => h.t > r.lastListed && (holder === "enemy" || h.operator === holder) && !h.listed.has(k));
          // Past its expiry, the placed stops then hold it too (a stop after E didn't hold the instance that ended at E).
          const late = (t: number) => (t >= E ? worldMs(E, t, stops) : t - E);
          const [lo, hi] = [late(r.lastListed), off === undefined ? Infinity : late(off.t)];
          if (hi < -2 * HOLD_BOUND_TOL_MS) {
            v(`ends ${sec(-hi)} s before the replay's expiry (a refresh or cut the replay doesn't make: not a clock)`);
            continue;
          }
          const away = gapsWithin(S, r.lastListed, paused);
          if (lo > HIDDEN_HOLD_SHARE * (E - S) + away) {
            v(`asks ${sec(lo)} s, over HIDDEN_HOLD_SHARE (${HIDDEN_HOLD_SHARE}) of its life${paused.length ? " and the away stretches inside its run" : ""} (a refresh the replay missed, or a kit's error)`, lo / 1000);
            continue;
          }
          // An instance buff's run later than INSTANCE_LATE_MS with a reapplication on its holder inside it: a refresh in
          // place is likelier than holds. Without one nothing could have refreshed it, so it is a clock like any other.
          const refresher = def.instances !== undefined && lo > INSTANCE_LATE_MS + away ? list.find((x) => x.start > w.start && msOfFrame(x.start) <= r.lastListed) : undefined;
          if (refresher) {
            v(`an instance buff's run ${sec(lo)} s late, over INSTANCE_LATE_MS, with a reapplication inside it (${sec(msOfFrame(refresher.start))} s): a refresh in place is likelier than holds`, lo / 1000);
            continue;
          }
          const tag = `run ${g}|${owner} on ${holder} ${Math.round(S)}→${r.lastListed}${off ? `–${off.t}` : "–end"} ms over ${Math.round(E)}`;
          if (lo > -HOLD_BOUND_TOL_MS) out.push(pausedBound({ a: Math.round(S), b: r.lastListed, min: lo - HOLD_BOUND_TOL_MS, max: Infinity, kind: "run", tag, ex: lo / 1000 }, HIDDEN_HOLD_SHARE * (E - S), paused));
          if (off) out.push({ a: Math.round(S), b: off.t, min: -Infinity, max: hi + HOLD_BOUND_TOL_MS, kind: "run", tag, ex: hi / 1000 });
          v(lo > -HOLD_BOUND_TOL_MS || off ? `bound: ${tag}` : "no bound (listed only before its expiry, and no later hit of its holder without it)", lo / 1000);
        }
        if (near === 0) {
          const runs = (ends.runs.get(k) ?? []).filter((r) => r.holder === holder);
          const nearest = runs.length ? Math.min(...runs.map((r) => Math.abs(r.since - S))) : null;
          note({ instance, verdict: nearest === null ? `the log lists no run of ${g} from its owner on ${holder}` : `no run of ${g} on ${holder} starts within ${RUN_START_MS / 1000} s of the application (the nearest ${sec(nearest)} s away)` });
        }
      }
    }
  }
  return out;
}

/** How far apart (ms) the ends of two overlapping runs must be to show them as two instances (runApart). */
const APART_MS = 1000;

/**
 * How late (ms, world time past the replay's expiry) an instance buff's run may be and still be a clock where the replay
 * reapplies the buff to its holder inside the run: about two perfect dodges. Arcane's will_dmg / will_atk runs, refreshed
 * in place by her later bursts with their start kept, ask 2–8 s (b6aa15281db4 from 2.1 s, 4d60e7fe92c2 from 10.8 s:
 * 7.7 s); Perlica's Arts DMG Taken in 4360447193ac 0.74 s. A run with no reapplication inside it can't have been
 * refreshed, and is a clock up to HIDDEN_HOLD_SHARE as other buffs' runs are (5082ceaffad1: Xaihi's weapon team ATK
 * from 27.37 s, its last instance, listed on Yvonne and Arcane 1.67 s past its expiry).
 */
const INSTANCE_LATE_MS = 1000;

/**
 * Whether the log shows a run `r` of an instance buff as an instance of its own: each of the replay's applications
 * (`list`) after `w` and inside the run has a run of its own in the log, some run overlaps `r` (a lone run may be one
 * the game refreshed in place: b6aa15281db4, Arcane's will_atk from 2.1 s listed to 31.8 s), and every run overlapping it ends at
 * least APART_MS from it (two runs ending together: a reapplication that refreshed both; 9c0bb09daff2, Arcane's will_dmg
 * from 31.5 and 34.3 s both listed to 70.2 s). 4360447193ac: Perlica's Arts DMG Taken from 92.24 s ends at 108.27 s
 * beside the one from 104.92 s, listed to 119.2 s.
 */
function runApart(list: readonly { start: number }[], w: { start: number }, r: LoggedLaneEnd, runs: readonly LoggedLaneEnd[]): boolean {
  const on = runs.filter((o) => o !== r && o.holder === r.holder);
  const later = list.filter((x) => x.start > w.start && msOfFrame(x.start) <= r.lastListed);
  if (!later.every((x) => on.some((o) => Math.abs(o.since - msOfFrame(x.start)) <= RUN_START_MS))) return false;
  const overlaps = (o: LoggedLaneEnd) => o.since <= r.lastListed && r.since <= o.lastListed;
  return on.some(overlaps) && on.every((o) => !overlaps(o) || Math.abs(o.lastListed - r.lastListed) >= APART_MS);
}

/** Whether `r` is the run on its holder whose start is nearest `S` (ms): the one an instance applied at S stands for. */
function nearestRun(r: LoggedLaneEnd, S: number, runs: readonly LoggedLaneEnd[]): boolean {
  return runs.every((o) => o === r || o.holder !== r.holder || Math.abs(o.since - S) >= Math.abs(r.since - S));
}

/**
 * The state with each buff due to expire by `frame` kept on while the log still lists it (engine assumption
 * hidden-holds, reading `log`): the world held it in ways no logged cast shows (perfect dodges: a 0.512 s world
 * slow-down each, the dodger exempt; docs/open-problems.md "The buff clock"). Only a timed buff of a kit with one game
 * buff run per instance: not consumed, ended with a cast, layered on one timer, ticking, or on a clock the replay already takes from
 * the log (ticksShownByHits, ticksLoggedAs, endFollowsTick). The run must have started within RUN_START_MS of the
 * instance's application, be listed past its own expiry on a holder the instance reaches, not be refreshed in the log,
 * and end within HIDDEN_HOLD_SHARE of the instance's life past it. Its end (loggedEndOf) is a frame after the last
 * listed hit before any hit past the expiry that doesn't list it on a holder the instance reaches (one instance stands
 * for every holder's run: where one holder's ends first, its hits' damage follows that end: btl_upload_b6aa15281db4 at
 * 43.9 s). The instance's expiry is set to that end once and pinned (ActiveBuff.pinned: the clock's shifts leave it,
 * timeline/clock.ts shiftBuff): the log's time already holds every stop up to it, which the replay's later stops mustn't
 * hold again. (Until 2026-11-23 it was kept a step at a time, to the step's frame and one more, and clamped at the end
 * where a stop held it past: the same ends, measured on every log, one hold-out entry "other", none better or worse.)
 */
export function heldToLoggedEnds(st: TimelineState, frame: number, ends: LoggedLaneEnds, defs: ReadonlyMap<string, KitBuff>): TimelineState {
  if (ends.runs.size === 0) return st;
  let changed = false;
  const buffs = st.buffs.map((b) => {
    if (b.cast !== undefined || b.pinned || !Number.isFinite(b.expiresAt) || b.expiresAt <= st.frame || b.expiresAt > frame) return b;
    const kept = loggedEndOf(b, ends, defs);
    if (kept === null || kept.end <= b.expiresAt) return b;
    changed = true;
    // Pinned: the log's end already holds every stop up to it, which the replay's later stops mustn't hold again.
    return { ...b, expiresAt: kept.end, pinned: true as const };
  });
  return changed ? { ...st, buffs } : st;
}

/**
 * The frame an instance ends at by the log (heldToLoggedEnds), or null where the log doesn't decide it; fixed per
 * instance at its own first expiry (LoggedLaneEnds.decided), so the steps that keep it don't move it.
 */
function loggedEndOf(b: ActiveBuff, ends: LoggedLaneEnds, defs: ReadonlyMap<string, KitBuff>): { readonly end: number } | null {
  const key = `${b.owner}|${b.id}|${b.appliedAt}`;
  const known = ends.decided.get(key);
  if (known !== undefined) return known;
  const decide = (end: number | null, why: string) => {
    const v = end === null ? null : { end };
    ends.decided.set(key, v);
    ends.why.set(key, why);
    return v;
  };
  if (b.every !== undefined) return decide(null, "not taken: a ticking buff (its end is its ticks')");
  if (b.maxInstances !== undefined) return decide(null, "not taken: an instance buff (KitBuff.instances, or stackingType 1: the log may merge its instances)");
  const def = defs.get(`${b.owner}:${b.id}`);
  if (!def) return decide(null, "not taken: no kit buff of that id");
  const skip = notAClock(def);
  if (skip !== null) return decide(null, `not taken: the kit buff has ${notAClockWords(def, skip)}`);
  // The run began with this instance (within RUN_START_MS of its application), not a later one the replay missed.
  const [from, latest, until] = [((b.appliedAt * 1000) / FPS) - RUN_START_MS, ((b.appliedAt * 1000) / FPS) + RUN_START_MS, (b.expiresAt * 1000) / FPS];
  const names = loggedNames(def);
  const holds = (holder: string) => (def.target === "enemy" ? holder === "enemy" : holder !== "enemy" && reaches(b, holder));
  const lasts: number[] = [];
  for (const g of names) {
    const runs = ends.runs.get(`${g}|${b.owner}`) ?? [];
    for (const r of runs) {
      if (r.refreshed || r.since < from || r.since > latest || r.since >= until || r.lastListed <= until || !holds(r.holder)) continue;
      // A layer (its own timer: notAClock; a sharedTimer one isn't taken) stands for the run nearest its application.
      if (b.maxLayers !== undefined && !nearestRun(r, (b.appliedAt * 1000) / FPS, runs)) continue;
      lasts.push(r.lastListed);
    }
  }
  // The first hit after the expiry on a holder it reaches that lists none of its game buffs from its owner.
  const keys = names.map((g) => `${g}|${b.owner}`);
  const off = lasts.length ? ends.hits.find((h) => h.t > until && (def.target === "enemy" || holds(h.operator)) && !keys.some((k) => h.listed.has(k))) : undefined;
  const before = lasts.filter((t) => off === undefined || t < off.t);
  if (before.length === 0) return decide(null, lasts.length ? "not taken: listed past its expiry only after a hit of its holder without it" : "not taken: no run of it from its application (not refreshed) listed past its expiry");
  const end = frameOf(Math.max(...before)) + 1;
  const sec = (f: number) => ((f * 1000) / FPS / 1000).toFixed(2);
  return end - b.expiresAt > HIDDEN_HOLD_SHARE * (b.expiresAt - b.appliedAt)
    ? decide(null, `not taken: the log's end ${sec(end)} s is past HIDDEN_HOLD_SHARE of its life`)
    : decide(end, `kept to the log's end, ${sec(end)} s (its expiry ${sec(b.expiresAt)} s)`);
}
