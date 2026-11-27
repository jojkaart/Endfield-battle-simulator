// The logged status hits (Arts Bursts, reactions, Combustion ticks, physical statuses) paired with the replay's
// status landings (BuffReplay.statusLanding). A burst or a tick lands 0.55–0.85 s later in the game than in the
// replay about half the time (a stop starting 0–300 ms after the burst is due holds the game's; the replay's timing
// can't say which: scripts/probes/bursts/burst-before-stop.ts), so the nearest landing within NEAR_FRAMES, taken in
// time order, left both sides one-sided and once paired them crosswise (pending/zmdlogs-c7790d76a4f0.json 9.27–10.08 s).
// Engine assumption status-pairing: `assignment` pairs each operator's landings of one kind and element with its
// logged hits as one assignment (the most pairs, then the closest in value and time), a landing up to WIDE_FRAMES
// away paired only where its value fits the logged one; `nearest` is the old pairing.

import { landingDamage, type LandedHit } from "@efsim/engine";
import type { LogFixture, LogHit } from "./zmdlogs.ts";

/** How far (frames) a status landing may be from the logged hit it stands for, whatever its value (the old window). */
export const STATUS_NEAR_FRAMES = 16;
/** How far (frames) a status landing whose value fits the logged hit's may be from it (a burst a stop held: up to 0.85 s, and a few frames of the replay's own precision). */
export const STATUS_WIDE_FRAMES = 30;
/** A value fits within this share of the logged one (the replay's landing under the log's crit flag and the fixture's stage factor). */
export const STATUS_VALUE_FIT = 0.01;

/** A logged status hit to pair: the hit, its frame on the replay's clock, and the landings' key it pairs within (operator, kind, element). */
export interface StatusQuery {
  readonly hit: LogHit;
  readonly frame: number;
  readonly key: string;
}

/** What a pairing needs besides the two sides: a landing's key (as StatusQuery.key) and whether its value fits a logged hit's. */
export interface PairingOptions {
  readonly reading: "assignment" | "nearest";
  readonly keyOf: (landing: LandedHit) => string;
  readonly fits: (hit: LogHit, landing: LandedHit) => boolean;
  readonly near?: number;
  readonly wide?: number;
}

/**
 * The replay's status landings paired with the logged status hits (each landing once). `nearest`: per logged hit in
 * time order, the nearest free landing of its key within `near` frames. `assignment`: per key, over stretches with no
 * gap above `wide` frames, the pairing with the most pairs and then the least cost (frames apart, plus `wide` where the
 * value doesn't fit), a pair beyond `near` only where the value fits.
 */
export function pairStatusLandings(queries: readonly StatusQuery[], landings: readonly LandedHit[], o: PairingOptions): Map<LogHit, LandedHit> {
  const near = o.near ?? STATUS_NEAR_FRAMES;
  const wide = o.wide ?? STATUS_WIDE_FRAMES;
  const out = new Map<LogHit, LandedHit>();
  if (o.reading === "nearest") {
    const taken = new Set<LandedHit>();
    for (const q of [...queries].sort((a, b) => a.hit.t - b.hit.t)) {
      let best: LandedHit | null = null;
      for (const x of landings) {
        if (taken.has(x) || o.keyOf(x) !== q.key || Math.abs(x.frame - q.frame) > near) continue;
        if (!best || Math.abs(x.frame - q.frame) < Math.abs(best.frame - q.frame)) best = x;
      }
      if (best) {
        taken.add(best);
        out.set(q.hit, best);
      }
    }
    return out;
  }
  const keys = new Set(queries.map((q) => q.key));
  for (const key of keys) {
    const qs = queries.filter((q) => q.key === key);
    const ls = landings.filter((x) => o.keyOf(x) === key);
    // Stretches: items of both sides in frame order, split where the next is more than `wide` frames after the last.
    const items = [...qs.map((q) => ({ frame: q.frame, q })), ...ls.map((x) => ({ frame: x.frame, x }))].sort((a, b) => a.frame - b.frame);
    let part: typeof items = [];
    const flush = () => {
      const pq = part.flatMap((i) => ("q" in i && i.q ? [i.q] : []));
      const px = part.flatMap((i) => ("x" in i && i.x ? [i.x] : []));
      if (pq.length && px.length) for (const [q, x] of assign(pq, px, near, wide, o.fits)) out.set(q.hit, x);
      part = [];
    };
    for (const i of items) {
      if (part.length && i.frame - (part[part.length - 1] as { frame: number }).frame > wide) flush();
      part.push(i);
    }
    flush();
  }
  return out;
}

/** Above any pair's cost: a logged hit left unpaired. */
const UNPAIRED = 1e6;
/** A pair not allowed. */
const BARRED = 1e9;

/** The min-cost pairing of one stretch (Hungarian method, rows the logged hits, columns the landings and one "none" per row). */
function assign(qs: readonly StatusQuery[], xs: readonly LandedHit[], near: number, wide: number, fits: PairingOptions["fits"]): [StatusQuery, LandedHit][] {
  const n = qs.length;
  const m = xs.length + n;
  const cost = (i: number, j: number): number => {
    const q = qs[i] as StatusQuery;
    if (j >= xs.length) return j - xs.length === i ? UNPAIRED : BARRED;
    const x = xs[j] as LandedHit;
    const d = Math.abs(x.frame - q.frame);
    if (d > wide) return BARRED;
    const fit = fits(q.hit, x);
    if (d > near && !fit) return BARRED;
    return d + (fit ? 0 : wide);
  };
  // e-maxx's Hungarian method, 1-based, n rows ≤ m columns.
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(m + 1).fill(0);
  const p = new Array<number>(m + 1).fill(0);
  const way = new Array<number>(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(m + 1).fill(Infinity);
    const used = new Array<boolean>(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0] as number;
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost(i0 - 1, j - 1) - (u[i0] as number) - (v[j] as number);
        if (cur < (minv[j] as number)) {
          minv[j] = cur;
          way[j] = j0;
        }
        if ((minv[j] as number) < delta) {
          delta = minv[j] as number;
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j] as number] = (u[p[j] as number] as number) + delta;
          v[j] = (v[j] as number) - delta;
        } else minv[j] = (minv[j] as number) - delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0] as number;
      p[j0] = p[j1] as number;
      j0 = j1;
    } while (j0);
  }
  const out: [StatusQuery, LandedHit][] = [];
  for (let j = 1; j <= xs.length; j++) {
    const i = p[j] as number;
    if (i > 0 && cost(i - 1, j - 1) < UNPAIRED) out.push([qs[i - 1] as StatusQuery, xs[j - 1] as LandedHit]);
  }
  return out;
}

/**
 * Whether a replay status landing's value fits a logged hit's (within STATUS_VALUE_FIT): the landing's damage again
 * from its inputs under the log's crit flag (either, where the log doesn't say), times the fixture's stage factor at
 * the hit, against the logged value before the damage cap. A landing without its inputs never fits.
 */
export function statusValueFits(data: Parameters<typeof landingDamage>[0], fx: Pick<LogFixture, "enemy" | "stageFactors">, hit: LogHit, x: LandedHit, tol = STATUS_VALUE_FIT): boolean {
  const inputs = x.inputs;
  if (!inputs) return false;
  const target = { enemy: fx.enemy.id, level: fx.enemy.level };
  const stage = fx.stageFactors?.find((w) => hit.t >= w.from && hit.t < w.to)?.factor ?? 1;
  const logged = hit.uncapped ?? hit.value;
  const crits = hit.crit === null ? (["never", "always"] as const) : hit.crit ? (["always"] as const) : (["never"] as const);
  return crits.some((crit) => {
    const d = landingDamage(data, target, inputs, { ...inputs.options, crit }).exact * stage;
    return d > 0 && Math.abs(logged / d - 1) <= tol;
  });
}
