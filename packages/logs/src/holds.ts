// The fight's hidden holds placed from its clocks (docs/open-problems.md "The buff clock"; engine assumption
// hidden-holds, reading `placed`): one hidden clock per fight that the operators' buffs and the enemy's timers share,
// held where no logged cast stops it (perfect dodges: a 0.512 s world slow-down each, unlogged; pauses). Every clock the
// log shows bounds it: a listed buff's run against the replay's own expiry, an enemy tick series against its period.
// The replay (buffreplay.ts) then holds the world there once, for every timer.

import { FPS } from "@efsim/engine";
import type { LogFixture } from "./zmdlogs.ts";
import { worldMs, type TimeStop } from "./logcasts.ts";

/**
 * One clock's bound on the hidden holds P (ms of world hold no placed stop explains, P(0) = 0): `min` ≤ P(b) − P(a) ≤
 * `max` (ms; ±Infinity: no bound that side). `ex` is the hold it asks (s), which ranks it when clocks conflict.
 */
export interface HoldBound {
  readonly a: number;
  readonly b: number;
  readonly min: number;
  readonly max: number;
  readonly kind: "run" | "tick";
  readonly tag: string;
  readonly ex: number;
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
}

type Edge = { readonly u: number; readonly v: number; readonly w: number; readonly c?: HoldBound };

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
  const dist = new Array<number>(n).fill(Infinity);
  dist[s] = 0;
  for (let it = 0; it < n; it++) {
    let changed = false;
    for (const e of edges) {
      if ((dist[e.u] as number) + e.w < (dist[e.v] as number) - 1e-9) {
        dist[e.v] = (dist[e.u] as number) + e.w;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return dist;
}

/**
 * The hidden holds from the clocks' bounds: P nondecreasing, rising no faster than real time, flat inside `still` (ms
 * spans where nothing holds: the enemy Staggered doesn't attack, so nothing is dodged), every kept bound met (difference
 * constraints; a bound in a negative cycle dropped until none is left). The least total hold H that the bounds allow
 * (P(end) at its least), then under P(end) = H the earliest and the latest P at every node, and their midpoint.
 */
export function placeHolds(bounds: readonly HoldBound[], opts: { readonly end: number; readonly still?: readonly (readonly [number, number])[] }): PlacedHolds {
  const still = opts.still ?? [];
  const end = Math.max(opts.end, ...bounds.map((b) => b.b));
  const build = (list: readonly HoldBound[]) => {
    const times = [...new Set([0, end, ...list.flatMap((c) => [c.a, c.b]), ...still.flat().filter((t) => t > 0 && t < end)])].sort((x, y) => x - y);
    const idx = new Map(times.map((t, i) => [t, i]));
    const edges: Edge[] = [];
    for (let i = 0; i + 1 < times.length; i++) {
      const [a, b] = [times[i] as number, times[i + 1] as number];
      const held = still.some(([x, y]) => x <= a && b <= y);
      edges.push({ u: i + 1, v: i, w: 0 });
      edges.push({ u: i, v: i + 1, w: held ? 0 : b - a });
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
  const rank = (c: HoldBound) => (c.kind === "tick" ? 0.5 : 1) * Math.abs(c.ex);
  for (;;) {
    const { times, edges } = build(kept);
    const cycle = negativeCycle(times.length, edges);
    if (!cycle) break;
    const worst = [...cycle].sort((x, y) => rank(y) - rank(x))[0] as HoldBound;
    dropped.push(worst);
    kept = kept.filter((c) => c !== worst);
  }
  const { times, edges } = build(kept);
  const n = times.length;
  const last = n - 1;
  const reversed = (es: readonly Edge[]) => es.map((e) => ({ u: e.v, v: e.u, w: e.w }));
  const total = Math.max(0, -(distances(n, reversed(edges), 0)[last] as number));
  const fixed = [...edges, { u: 0, v: last, w: total }, { u: last, v: 0, w: -total }];
  const early = distances(n, fixed, 0);
  const late = distances(n, reversed(fixed), 0).map((d) => -d);
  const mid = early.map((x, i) => (x + (late[i] as number)) / 2);
  return { total, times, early, late, mid, holds: holdFrames(times, mid), kept, dropped };
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
