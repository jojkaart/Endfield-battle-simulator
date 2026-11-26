// The fight's hidden holds placed from its clocks (docs/open-problems.md "The buff clock"; engine assumption
// hidden-holds, reading `placed`): one hidden clock per fight that the operators' buffs and the enemy's timers share,
// held where no logged cast stops it (perfect dodges: a 0.512 s world slow-down each, unlogged; pauses). Every clock the
// log shows bounds it: a listed buff's run against the replay's own expiry, an enemy tick series against its period.
// The replay (buffreplay.ts) then holds the world there once, for every timer.

import { FPS, type KitBuff } from "@efsim/engine";
import type { LogFixture } from "./zmdlogs.ts";
import { worldMs, type TimeStop } from "./logcasts.ts";

/**
 * Why a replayed instance is or isn't a clock of the hidden holds (`zmdlogs holds --why`, rossi-gilberta report point
 * 2: the rules were spread over three silent filters): the clock (`owner:id`, or `status:<status>` for an enemy status),
 * its holder (an operator or "enemy"; a status's applier), the instance (frames; null: the kit buff as a whole), the log's
 * run it was paired with (ms), and the verdict ("bound", or the rule that skipped it), with the hold a bound asks (s).
 */
export interface ClockWhy {
  readonly clock: string;
  readonly holder: string;
  readonly instance: { readonly start: number; readonly end: number; readonly expired: boolean } | null;
  readonly run?: { readonly name: string; readonly since: number; readonly lastListed: number };
  readonly verdict: string;
  readonly ask?: number;
}

/**
 * The kit fields that make a buff no clock of the holds (its end follows something other than its own timer, or the log
 * shows its instances merged), for runBounds and for buffreplay.ts loggedEndOf (`every`: a ticking buff, runBounds only;
 * loggedEndOf reads it off the active buff).
 */
const NOT_A_CLOCK = ["consumedBy", "link", "endsWithCast", "maxStacks", "sharedTimer", "ticksShownByHits", "ticksLoggedAs", "endFollowsTick", "childOf"] as const;

/** The first field that makes `def` no clock (NOT_A_CLOCK; `every` too with `opts.every`), or null. */
export function notAClock(def: KitBuff, opts: { readonly every?: boolean } = {}): string | null {
  if (opts.every && def.every !== undefined) return "every";
  for (const k of NOT_A_CLOCK) if (k === "maxStacks" ? def.maxStacks !== undefined : Boolean(def[k])) return k;
  return null;
}

/**
 * Whether the log shows run `r` refreshed: another run of the same lane (`same`) starts inside it and `r` isn't listed
 * past that start by more than REFRESH_OVERLAP_MS (runs listed side by side longer are two instances). The one rule for
 * buff runs (buffreplay.ts loggedLaneEnds) and the enemy's statuses (statusLanes).
 */
export function refreshedIn<T extends { readonly since: number; readonly lastListed: number }>(r: T, all: readonly T[], same: (a: T, b: T) => boolean): boolean {
  return all.some((o) => o !== r && same(o, r) && o.since > r.since && o.since <= r.lastListed && r.lastListed - o.since <= REFRESH_OVERLAP_MS);
}

/**
 * One clock's bound on the hidden holds P (ms of world hold no placed stop explains, P(0) = 0): `min` ≤ P(b) − P(a) ≤
 * `max` (ms; ±Infinity: no bound that side). `ex` is the hold it asks (s), which ranks it when clocks conflict.
 */
export interface HoldBound {
  readonly a: number;
  readonly b: number;
  readonly min: number;
  readonly max: number;
  /** A listed buff's run, an enemy tick series, a listed enemy status's run, Corrosion's ramp steps. */
  readonly kind: "run" | "tick" | "status" | "ramp";
  readonly tag: string;
  readonly ex: number;
}

/** How far a run's logged end may miss the bound it gives the hidden holds (ms): its brackets' and the frame grid's slack. */
export const HOLD_BOUND_TOL_MS = 200;

/**
 * How far from an instance's application the log's run of it may start and still be its run, ms: the log starts a run
 * when its lane opens, which for a buff created inside a time stop is at the stop's end or later
 * (btl_upload_9c0bb09daff2: Si's Amp, created at her ultimate's frame 62, listed from 9515 ms, 2.5 s after her
 * ultimate's cast event).
 */
export const RUN_START_MS = 3000;

/**
 * How long (ms) a run may still be listed past another's start and be refreshed by it: the refreshing hit's batch.
 * Runs listed side by side longer are two instances (buffreplay.ts loggedLaneEnds; statusLanes for the enemy's statuses).
 */
export const REFRESH_OVERLAP_MS = 200;

/**
 * The log's names of the enemy's statuses (their status buffs, on the enemy's side of every hit whatever its element:
 * Electrification's Arts DMG Taken on Nature hits, Breach's on Heat ones). Combustion isn't listed (only its ticks).
 * Corrosion's is listed without a value (unquantified): logeffects.ts isCorrosionBuff.
 */
export const STATUS_LOG_NAMES: Readonly<Record<string, RegExp>> = {
  electrification: /^buff_common_pulse_(fire|natural|cryst)_triggered$|^buff_common_pulse_pulse_conduct_triggered_do$/,
  corrosion: /^buff_common_natural_natural_corrupt_do$|^buff_common_natural_(fire|pulse|cryst)_triggered$/,
  solidification: /^buff_common_cryst_(fire|natural|pulse)_triggered$/,
  breach: /^buff_physical_do_fracture$/,
};

/**
 * How far a status's last listed hit may come after the replay's end of it with no hold between (ms): the frame grid's
 * two frames. Tighter than a buff run's HOLD_BOUND_TOL_MS: a status is on the enemy's side of every hit (no holder's
 * hits to bracket it), and a consumed one's last listing is its consuming hit (d774 at 97443 ms: the strike that takes
 * Perlica's Electrification needs it on at that frame).
 */
const STATUS_END_TOL_MS = 70;

/** The enemy status a logged buff stands for (STATUS_LOG_NAMES), or null. */
export function statusOfLogged(buff: string): string | null {
  for (const [status, re] of Object.entries(STATUS_LOG_NAMES)) if (re.test(buff)) return status;
  return null;
}

/** One replayed instance of an enemy status (frames): its applier, application, and end (ran out, or replaced or consumed first). */
export interface StatusInstance {
  readonly status: string;
  readonly operator: string;
  readonly start: number;
  readonly end: number;
  readonly expired: boolean;
}

/** The log's runs of the enemy's statuses (by `status|applier`), and what each hit lists of them. */
export interface StatusLanes {
  readonly runs: ReadonlyMap<string, readonly { readonly since: number; readonly lastListed: number; readonly refreshed: boolean }[]>;
  readonly hits: readonly { readonly t: number; readonly listed: ReadonlySet<string> }[];
}

/** The log's status runs (StatusLanes) from every hit's effects, boundary effects (not at their own start) and unquantified entries. */
export function statusLanes(fx: Pick<LogFixture, "hits">): StatusLanes {
  const runs = new Map<string, { key: string; since: number; lastListed: number }>();
  const sorted = [...fx.hits].sort((a, b) => a.t - b.t);
  const hits = sorted.map((h) => {
    const listed = new Set<string>();
    for (const e of [...h.effects, ...h.boundaryEffects.filter((x) => x.since !== h.t), ...h.unquantified]) {
      const status = statusOfLogged(e.buff);
      if (!status || e.source === undefined || e.since === undefined) continue;
      const key = `${status}|${e.source}`;
      listed.add(key);
      const id = `${key}|${e.since}`;
      const r = runs.get(id);
      if (!r) runs.set(id, { key, since: e.since, lastListed: h.t });
      else if (h.t > r.lastListed) r.lastListed = h.t;
    }
    // A boundary effect at its own start still says the status is on.
    for (const e of h.boundaryEffects) {
      const status = statusOfLogged(e.buff);
      if (status && e.source !== undefined) listed.add(`${status}|${e.source}`);
    }
    return { t: h.t, listed };
  });
  const out = new Map<string, { since: number; lastListed: number; refreshed: boolean }[]>();
  const all = [...runs.values()];
  for (const r of all) {
    const refreshed = refreshedIn(r, all, (a, b) => a.key === b.key);
    out.set(r.key, [...(out.get(r.key) ?? []), { since: r.since, lastListed: r.lastListed, refreshed }]);
  }
  return { runs: out, hits };
}

/**
 * The bounds the replay's enemy statuses give the hidden holds (as buffreplay.ts runBounds does for buffs): each instance
 * that ran out in the replay without the holds, against the log's run of it (the same status from the same applier,
 * starting within RUN_START_MS of the application, not refreshed): its last listed hit at least its lateness over the
 * replay's expiry (world time past the expiry: the placed stops after it hold it once it lasts), and the next hit that
 * doesn't list it at most, but only for a status no kit of the team consumes (`consumable`: a consumed status ends early
 * in the log, which says nothing of its clock: d774's Electrification, taken by Zhuang Fangyi's battle skill at 97.44 s).
 */
export function statusBounds(instances: readonly StatusInstance[], lanes: StatusLanes, stops: readonly TimeStop[], consumable: ReadonlySet<string>, share: number, why?: ClockWhy[]): HoldBound[] {
  const out: HoldBound[] = [];
  const ms = (f: number) => (f * 1000) / FPS;
  for (const w of instances) {
    const instance = { start: w.start, end: w.end, expired: w.expired };
    const note = (verdict: string, run?: ClockWhy["run"], ask?: number) => why?.push({ clock: `status:${w.status}`, holder: w.operator, instance, ...(run ? { run } : {}), verdict, ...(ask !== undefined ? { ask } : {}) });
    if (!w.expired) {
      note("didn't run out in the replay (replaced, consumed, or on at the fight's end)");
      continue;
    }
    const [S, E] = [ms(w.start), ms(w.end)];
    const key = `${w.status}|${w.operator}`;
    let near = 0;
    for (const r of lanes.runs.get(key) ?? []) {
      if (r.since < S - RUN_START_MS || r.since > S + RUN_START_MS) continue;
      near++;
      const run = { name: w.status, since: r.since, lastListed: r.lastListed };
      if (r.refreshed) {
        note("refreshed in the log (another run starts inside it; holds.ts refreshedIn)", run);
        continue;
      }
      const late = (t: number) => (t >= E ? worldMs(E, t, stops) : t - E);
      const off = consumable.has(w.status) ? undefined : lanes.hits.find((h) => h.t > r.lastListed && !h.listed.has(key));
      const [lo, hi] = [late(r.lastListed), off === undefined ? Infinity : late(off.t)];
      if (hi < -2 * HOLD_BOUND_TOL_MS) {
        note(`ends ${(-hi / 1000).toFixed(2)} s before the replay's expiry (a cut the replay doesn't make: not a clock)`, run);
        continue;
      }
      if (lo > share * (E - S)) {
        note(`asks ${(lo / 1000).toFixed(2)} s, over ${share} of its life (a refresh the replay missed, or a kit's error)`, run, lo / 1000);
        continue;
      }
      const tag = `status ${key} ${Math.round(S)}→${r.lastListed}${off ? `–${off.t}` : consumable.has(w.status) ? "–(consumable)" : "–end"} ms over ${Math.round(E)}`;
      if (lo > -STATUS_END_TOL_MS) out.push({ a: Math.round(S), b: r.lastListed, min: lo - STATUS_END_TOL_MS, max: Infinity, kind: "status", tag, ex: lo / 1000 });
      if (off) out.push({ a: Math.round(S), b: off.t, min: -Infinity, max: hi + HOLD_BOUND_TOL_MS, kind: "status", tag, ex: hi / 1000 });
      note(lo > -STATUS_END_TOL_MS || off ? `bound: ${tag}` : "no bound (listed only before its expiry, and no later hit without it: consumable or the fight's end)", run, lo / 1000);
    }
    if (near === 0) {
      const runs = lanes.runs.get(key) ?? [];
      const nearest = runs.length ? Math.min(...runs.map((r) => Math.abs(r.since - S))) : null;
      note(nearest === null ? `the log lists no run of it from ${w.operator}` : `no run of it starts within ${RUN_START_MS / 1000} s of the application (the nearest ${(nearest / 1000).toFixed(2)} s away)`);
    }
  }
  return out;
}

/**
 * Enemy-side periodic series the log records as hits, with their period and how far a tick's logged ms strays (ms): a
 * pair's world gap (placed stops out) less the period is the hold between them. The tolerances are the free pairs'
 * spread (scratch census over the development logs, 2026-11-23: residual median 0, p10–p90 within ±0.1 s, the holds
 * apart at +0.4–0.6 s; Typhoeus's combo field ticks every 10 frames, its gaps stray to +0.14 s).
 */
export const HOLD_SERIES: Readonly<Record<string, { readonly period: number; readonly tol: number }>> = {
  buff_common_burning_status: { period: 1000, tol: 150 },
  buff_chr_0028_wulfa_normal_bleed: { period: 1000, tol: 150 },
  buff_chr_0014_aurora_ultimate_skill_dmg: { period: 500, tol: 120 },
  chr_0034_typhoea_combo_persistentdamage: { period: 1000 / 3, tol: 150 },
};

/** How much a tick series' gap may exceed its period and still be the next tick (a hold, not a new status), ms. */
const TICK_GAP_MS = 1500;

/**
 * The bounds an enemy tick series gives (HOLD_SERIES): its chains of consecutive ticks (a gap of half a period to a
 * period and TICK_GAP_MS), each pair's hold and each tick's against its chain's first (a tick's jitter doesn't add up
 * along a chain).
 */
export function tickBounds(fx: Pick<LogFixture, "hits">, stops: readonly TimeStop[]): HoldBound[] {
  const series = new Map<string, number[]>();
  for (const h of fx.hits) {
    if (!HOLD_SERIES[h.event]) continue;
    const k = `${h.event}|${h.operator}|${h.target ?? ""}`;
    series.set(k, [...(series.get(k) ?? []), h.t]);
  }
  const out: HoldBound[] = [];
  for (const [k, ts0] of series) {
    const event = k.split("|")[0] as string;
    const { period, tol } = HOLD_SERIES[event] as { period: number; tol: number };
    const chains: number[][] = [];
    for (const t of [...new Set(ts0)].sort((a, b) => a - b)) {
      const c = chains.at(-1);
      const prev = c?.at(-1);
      if (c && prev !== undefined && t - prev >= 0.5 * period && t - prev <= period + TICK_GAP_MS) c.push(t);
      else chains.push([t]);
    }
    const label = event.replace(/^buff_/, "");
    for (const c of chains) {
      for (let i = 1; i < c.length; i++) {
        const [a, b] = [c[i - 1] as number, c[i] as number];
        const h = worldMs(a, b, stops) - period;
        out.push({ a, b, min: h - tol, max: h + tol, kind: "tick", tag: `tick ${label} ${a}→${b} ms`, ex: h / 1000 });
        if (i < 2) continue;
        const a0 = c[0] as number;
        const h0 = worldMs(a0, b, stops) - i * period;
        out.push({ a: a0, b, min: h0 - tol, max: h0 + tol, kind: "tick", tag: `ticks ${label} ${a0}⇒${b} ms`, ex: h0 / 1000 });
      }
    }
  }
  return out;
}

/** The holds placed (placeHolds): the clock at its nodes and the world holds the replay makes. */
export interface PlacedHolds {
  /** The least total hold every kept bound allows (ms). */
  readonly total: number;
  /** The clock's nodes (ms) and P at each: the earliest placement (`early`, every hold as soon as it can be), the latest, and their midpoint (the estimate, feasible: the bounds are convex). */
  readonly times: readonly number[];
  readonly early: readonly number[];
  readonly late: readonly number[];
  readonly mid: readonly number[];
  /** The world holds: at `frame`, `frames` frames (the midpoint, a frame at a time where it rises). */
  readonly holds: readonly { readonly frame: number; readonly frames: number }[];
  readonly kept: readonly HoldBound[];
  /** Bounds that conflict with the rest (in a negative cycle; the largest ask first, a tick's counting half). */
  readonly dropped: readonly HoldBound[];
  /**
   * Per dropped bound (same order), the other bounds of the cycle it was dropped from: what it conflicted with
   * (remaining-leads report point 1: a stop's move made 489c's ramp bounds conflict, and nothing said with which).
   */
  readonly conflicts: readonly (readonly HoldBound[])[];
  /**
   * What sets each node's earliest (`early`: the most P there can be) and latest (`late`: the least) placement: the
   * edge into it on its shortest path (holdPins walks them), so a unit's move names the bounds that hold it.
   */
  readonly earlyFrom: readonly (HoldStep | null)[];
  readonly lateFrom: readonly (HoldStep | null)[];
}

/** One step of a node's shortest path (PlacedHolds.earlyFrom / lateFrom): the node before, and the bound or the least total on the edge. */
export interface HoldStep {
  readonly node: number;
  readonly bound?: HoldBound;
  readonly total?: true;
}

/**
 * The bounds that set a node's earliest (`early`: the most hold P can have reached there) or latest (`late`: the least
 * it must have) placement: the kept bounds on its shortest path, nearest first, and whether the least total is one of
 * them (the rest of the path is P's own rules: nondecreasing, no faster than real time, flat where nothing holds).
 */
export function holdPins(h: Pick<PlacedHolds, "earlyFrom" | "lateFrom">, node: number, side: "early" | "late"): { readonly bounds: readonly HoldBound[]; readonly total: boolean } {
  const from = side === "early" ? h.earlyFrom : h.lateFrom;
  const bounds: HoldBound[] = [];
  let total = false;
  let v = node;
  for (let i = 0; i <= from.length; i++) {
    const step = from[v];
    if (!step) break;
    if (step.bound && !bounds.includes(step.bound)) bounds.push(step.bound);
    if (step.total) total = true;
    v = step.node;
  }
  return { bounds, total };
}

type Edge = { readonly u: number; readonly v: number; readonly w: number; readonly c?: HoldBound; readonly total?: true };

/** A negative cycle's bounds (Bellman-Ford from a virtual source), or null when the bounds are feasible. */
function negativeCycle(n: number, edges: readonly Edge[]): HoldBound[] | null {
  const dist = new Array<number>(n).fill(0);
  const pred = new Array<number>(n).fill(-1);
  let last = -1;
  for (let it = 0; it <= n; it++) {
    last = -1;
    for (const [k, e] of edges.entries()) {
      if ((dist[e.u] as number) + e.w < (dist[e.v] as number) - 1e-6) {
        dist[e.v] = (dist[e.u] as number) + e.w;
        pred[e.v] = k;
        last = e.v;
      }
    }
    if (last === -1) return null;
  }
  let v = last;
  for (let i = 0; i < n; i++) v = (edges[pred[v] as number] as Edge).u;
  const out: HoldBound[] = [];
  const start = v;
  do {
    const e = edges[pred[v] as number] as Edge;
    if (e.c && !out.includes(e.c)) out.push(e.c);
    v = e.u;
  } while (v !== start);
  return out;
}

/** Shortest distances from node `s` (no negative cycle). */
function distances(n: number, edges: readonly Edge[], s: number): number[] {
  return shortestPaths(n, edges, s).dist;
}

/** Shortest distances from node `s` (no negative cycle), and each node's last edge on its path (index into `edges`; -1: none). */
function shortestPaths(n: number, edges: readonly Edge[], s: number): { dist: number[]; pred: number[] } {
  const dist = new Array<number>(n).fill(Infinity);
  const pred = new Array<number>(n).fill(-1);
  dist[s] = 0;
  for (let it = 0; it < n; it++) {
    let changed = false;
    for (const [k, e] of edges.entries()) {
      if ((dist[e.u] as number) + e.w < (dist[e.v] as number) - 1e-9) {
        dist[e.v] = (dist[e.u] as number) + e.w;
        pred[e.v] = k;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { dist, pred };
}

/** A span (ms) where the hidden holds may rise at most `rate` ms per ms, though a still span covers it (placeHolds `slow`). */
export interface HoldSpan {
  readonly a: number;
  readonly b: number;
  readonly rate: number;
}

/**
 * The combo slow-downs' spans where the hidden holds may rise inside the Stagger (engine assumption stagger-holds,
 * reading `combos`): the enemy's tick chains inside the log's Stagger run on their period where no combo's stop falls
 * (30 pairs, 0.02 s in all) and late by about a fifth of the time a combo's stop holds where one does (87 pairs, 3.43 s
 * over 15.36 s held; outside the Stagger the same, 0.24; scripts/probes/combo-hold/tick-chains.ts), which no dodge
 * explains in a Stagger. A longer ComboSkill curve (skillData.ts NAMED_CURVES) measured worse everywhere
 * (docs/tried/2026-11-26-combo-curve-flat.diff), so the excess is placed as holds here instead, where the clocks ask
 * for it. Each combo stop allows up to `share` of its own hold (Σ 1 − scale) there, spread over its frames. Not the
 * default: development plain 69.0 → 69.2%, but a verified log worse (docs/open-problems.md "The enemy's clock").
 */
export function comboHoldSpans(stops: readonly TimeStop[], share: number): HoldSpan[] {
  return stops
    .filter((s) => s.kind === "combo" && s.scales.length > 0)
    .map((s) => ({ a: (s.start * 1000) / FPS, b: ((s.start + s.scales.length) * 1000) / FPS, rate: (share * s.scales.reduce((t, x) => t + (1 - x), 0)) / s.scales.length }));
}

/**
 * The hidden holds from the clocks' bounds: P nondecreasing, rising no faster than real time, flat inside `still` (ms
 * spans where nothing holds: the enemy Staggered doesn't attack, so nothing is dodged), every kept bound met (difference
 * constraints; a bound in a negative cycle dropped until none is left). The least total hold H that the bounds allow
 * (P(end) at its least), then under P(end) = H the earliest and the latest P at every node, and their midpoint.
 */
export function placeHolds(bounds: readonly HoldBound[], opts: { readonly end: number; readonly still?: readonly (readonly [number, number])[]; readonly slow?: readonly HoldSpan[] }): PlacedHolds {
  const still = opts.still ?? [];
  const slow = opts.slow ?? [];
  const end = Math.max(opts.end, ...bounds.map((b) => b.b));
  const build = (list: readonly HoldBound[]) => {
    const times = [...new Set([0, end, ...list.flatMap((c) => [c.a, c.b]), ...[...still, ...slow.map((s) => [s.a, s.b] as const)].flat().filter((t) => t > 0 && t < end)])].sort((x, y) => x - y);
    const idx = new Map(times.map((t, i) => [t, i]));
    const edges: Edge[] = [];
    for (let i = 0; i + 1 < times.length; i++) {
      const [a, b] = [times[i] as number, times[i + 1] as number];
      const held = still.some(([x, y]) => x <= a && b <= y);
      // Inside a still span, P may still rise inside a slow span (its rate: the most hold per ms there).
      const rate = held ? Math.max(0, ...slow.filter((s) => s.a <= a && b <= s.b).map((s) => s.rate)) : 1;
      edges.push({ u: i + 1, v: i, w: 0 });
      edges.push({ u: i, v: i + 1, w: rate * (b - a) });
    }
    for (const c of list) {
      const [a, b] = [idx.get(c.a) as number, idx.get(c.b) as number];
      if (Number.isFinite(c.max)) edges.push({ u: a, v: b, w: c.max, c });
      if (Number.isFinite(c.min)) edges.push({ u: b, v: a, w: -c.min, c });
    }
    return { times, edges };
  };
  let kept = bounds.filter((c) => c.b > c.a);
  const dropped: HoldBound[] = [];
  const conflicts: HoldBound[][] = [];
  const rank = (c: HoldBound) => (c.kind === "tick" || c.kind === "ramp" ? 0.5 : 1) * Math.abs(c.ex);
  for (;;) {
    const { times, edges } = build(kept);
    const cycle = negativeCycle(times.length, edges);
    if (!cycle) break;
    const worst = [...cycle].sort((x, y) => rank(y) - rank(x))[0] as HoldBound;
    dropped.push(worst);
    conflicts.push(cycle.filter((c) => c !== worst));
    kept = kept.filter((c) => c !== worst);
  }
  const { times, edges } = build(kept);
  const n = times.length;
  const last = n - 1;
  const reversed = (es: readonly Edge[]): Edge[] => es.map((e) => ({ u: e.v, v: e.u, w: e.w, ...(e.c ? { c: e.c } : {}), ...(e.total ? { total: e.total } : {}) }));
  const total = Math.max(0, -(distances(n, reversed(edges), 0)[last] as number));
  const fixed: Edge[] = [...edges, { u: 0, v: last, w: total, total: true }, { u: last, v: 0, w: -total, total: true }];
  const e = shortestPaths(n, fixed, 0);
  const rev = reversed(fixed);
  const l = shortestPaths(n, rev, 0);
  const early = e.dist;
  const late = l.dist.map((d) => -d);
  const mid = early.map((x, i) => (x + (late[i] as number)) / 2);
  const steps = (pred: readonly number[], es: readonly Edge[]) =>
    pred.map((k): HoldStep | null => {
      const x = es[k];
      return x ? { node: x.u, ...(x.c ? { bound: x.c } : {}), ...(x.total ? { total: true as const } : {}) } : null;
    });
  return { total, times, early, late, mid, holds: holdFrames(times, mid), kept, dropped, conflicts, earlyFrom: steps(e.pred, fixed), lateFrom: steps(l.pred, rev) };
}

/** The clock's rises as world holds a frame at a time: P (ms) at each frame's start, in whole frames. */
function holdFrames(times: readonly number[], P: readonly number[]): { frame: number; frames: number }[] {
  // Called at rising ms: the segment only moves on.
  let i = 1;
  const at = (ms: number) => {
    while (i < times.length - 1 && (times[i] as number) < ms) i++;
    const [t0, t1, p0, p1] = [times[i - 1] as number, times[i] as number, P[i - 1] as number, P[i] as number];
    return t1 === t0 ? p1 : p0 + ((p1 - p0) * Math.max(0, Math.min(1, (ms - t0) / (t1 - t0))));
  };
  const out: { frame: number; frames: number }[] = [];
  const lastFrame = Math.ceil(((times.at(-1) ?? 0) * FPS) / 1000);
  let before = 0;
  for (let f = 0; f <= lastFrame; f++) {
    const now = Math.round((at(((f + 1) * 1000) / FPS) * FPS) / 1000);
    if (now > before) out.push({ frame: f, frames: now - before });
    before = Math.max(before, now);
  }
  return out;
}
