// Per-target state for a fight against several targets under one enemy id (the fixture's severalTargets), on the log
// check's side only (engine assumption several-targets `targets`; docs/design/data.md "Several targets"): the
// simulation and the replay keep one enemy, and this module says which target each logged hit is on and which of the
// replay's enemy-side instances each target carries, so the check reads a hit with its own target's debuffs. The log
// has no target per hit and lists every target's debuffs under the one id (7b54: two slugs' hits under one listing,
// ×1.198 apart), so the hits' values are the evidence, as they are for a crit the log leaves out: a target's state is
// read from its hits and then held to (an instance it got is kept to its expiry, one it was read without is never
// had later), a kill ends its target only. enginecheck.ts fightTargets builds the inputs (each hit's primary reading)
// and memoizes the assignment per replay; readingBasis drops a hit's units its target lacks, fightTotals counts a
// landing once per target, replayrun.ts and buffreplay.ts read the replay's side (kill gaps with targets left, no
// purge at a kill).

import { readingOf, type LandedHit, type Modifier, type TimelineState } from "@efsim/engine";
import type { LogFixture, LogHit } from "./zmdlogs.ts";

/** Targets alive at once where the fixture doesn't say (severalTargets.atOnce): two, the least that is several. */
export const DEFAULT_AT_ONCE = 2;
/** The most subsets of a hit's open units tried (2^6); past it, none and each one alone. */
const MAX_OPEN_SUBSETS = 64;

/** Whether the check reads the fixture per target: it is marked severalTargets and several-targets reads `targets` (or a variant of it). */
export function readsTargets(fx: Pick<LogFixture, "severalTargets">, assume: Readonly<Record<string, string>> | undefined): boolean {
  return fx.severalTargets !== undefined && readingOf(assume, "several-targets") !== "one";
}

/** Whether the totals count a landing once per target its logged hits are on (several-targets `targets`, not `targets-once`). */
export function landingPerTarget(fx: Pick<LogFixture, "severalTargets">, assume: Readonly<Record<string, string>> | undefined): boolean {
  return readsTargets(fx, assume) && readingOf(assume, "several-targets") !== "targets-once";
}

/** Whether a kill gap with targets left keeps the replay's enemy there (several-targets `targets`, not `targets-gaps-away`). */
export function keepsKillGaps(fx: Pick<LogFixture, "severalTargets">, assume: Readonly<Record<string, string>> | undefined): boolean {
  return readsTargets(fx, assume) && readingOf(assume, "several-targets") !== "targets-gaps-away";
}

/** The enemy statuses whose modifiers sit on a target (engine status.ts statusModifiers' sources), by kind. */
const STATUS_SOURCE = /^(Corrosion|Electrification|Breach) level /;

/**
 * A modifier's enemy-side unit, or null: a kit buff the team's kits put on the enemy (`owner:id`, its def's target
 * "enemy": Camille's Vesperwings, Si's Jade Vessel, Arcane's Doubles Susceptibility), or an enemy status
 * (`status:corrosion`, `status:electrification`, `status:breach`). The unit is on or off a target whole, its layers
 * and level the replay's.
 */
export function enemyUnit(m: Modifier, enemyKitBuffs: ReadonlySet<string>): string | null {
  if (m.kitBuff) {
    const k = `${m.kitBuff.owner}:${m.kitBuff.id}`;
    return enemyKitBuffs.has(k) ? k : null;
  }
  const s = STATUS_SOURCE.exec(m.source);
  return s ? `status:${(s[1] as string).toLowerCase()}` : null;
}

/** An enemy-side unit of a hit's reading as the replay has it at the landing: its earliest live instance's start and its latest end (frames). */
export interface TargetUnit {
  readonly key: string;
  readonly appliedAt: number;
  readonly expiresAt: number;
}

/** The units of `keys` in the replay's state at a frame (the instances live there; a key without one is taken as applied at the frame). */
export function unitsAt(st: TimelineState | null, frame: number, keys: readonly string[]): TargetUnit[] {
  return keys.map((key) => {
    const live = key.startsWith("status:")
      ? [...(st?.enemy.statuses ?? []), ...(st?.enemy.physical ?? [])].filter((x) => x.status === key.slice("status:".length) && x.expiresAt > frame)
      : (st?.buffs ?? []).filter((x) => x.target === "enemy" && `${x.owner}:${x.id}` === key && x.expiresAt > frame);
    return { key, appliedAt: Math.min(frame, ...live.map((x) => x.appliedAt)), expiresAt: Math.max(frame + 1, ...live.map((x) => x.expiresAt)) };
  });
}

/** What the assignment reads of one logged hit. */
export interface TargetHitInput {
  readonly hit: LogHit;
  /** Its landing in the replay (twins: two logged hits it stands for at one ms are on two targets), or null: none. */
  readonly landing: LandedHit | null;
  /** Its frame (the landing's, else the logged ms's). */
  readonly frame: number;
  readonly units: readonly TargetUnit[];
  /** Whether its primary reading without these units' modifiers fits its value (±1; the uncapped value where capped). */
  readonly fits: (drop: ReadonlySet<string>) => boolean;
}

/** A logged hit's target: its index (in order of first hit), the units its reading leaves out, and how it was chosen. */
export interface HitTarget {
  readonly target: number;
  readonly drop: ReadonlySet<string>;
  /**
   * `fits`: its value fits this target's state (an open unit decided by it, or none); `none fits`: no alive target's
   * state fits it, so it is on the one hit last, read with what that target is known to lack.
   */
  readonly how: "fits" | "none fits";
  /** It killed its target (a capped hit). */
  readonly kills: boolean;
}

export interface TargetAssignment {
  readonly of: ReadonlyMap<LogHit, HitTarget>;
  /** How many targets the fight's hits were put on. */
  readonly count: number;
}

interface Target {
  readonly id: number;
  alive: boolean;
  last: number;
  /** Per unit, the latest instance it got and the frame its hit decided it. */
  readonly got: Map<string, { appliedAt: number; expiresAt: number; at: number }>;
  /** Per unit, the instances (appliedAt) a hit read it without, and the frame of that hit. */
  readonly missed: Map<string, Map<number, number>>;
}

const killed = (h: LogHit) => h.uncapped !== undefined && h.uncapped !== null && h.uncapped > h.value;

/**
 * Each logged hit's target, in time order. Two logged hits one landing stands for at one ms are on two targets while
 * there are targets for both (one landing reaches each target once); a capped hit kills its target. Otherwise a hit
 * goes to the alive target whose state its value fits: a unit its target got is on to its expiry, one its target was
 * read without (that instance) is off, an open one (an instance the target wasn't read under yet) may be either, and
 * the hit decides each open unit that is on in every fitting choice, or off in every one. The preference: a target
 * that fits with every open unit on, then one that fits by leaving some off, then a new target (while atOnce allows,
 * and with fromStart no more than atOnce in all); among equals the one hit last. Where nothing fits, the one hit last
 * (a new one if none is alive), read with what it is known to lack, decided by nothing.
 */
export function assignTargets(fx: Pick<LogFixture, "severalTargets">, inputs: readonly TargetHitInput[]): TargetAssignment {
  const atOnce = fx.severalTargets?.atOnce ?? DEFAULT_AT_ONCE;
  const fromStart = fx.severalTargets?.fromStart === true;
  const targets: Target[] = [];
  const of = new Map<LogHit, HitTarget>();
  // The targets each landing's logged hits are on, per logged ms.
  const twins = new Map<LandedHit, Map<number, Set<number>>>();
  const order = inputs.map((x, i) => ({ x, i })).sort((a, b) => a.x.hit.t - b.x.hit.t || a.i - b.i);
  for (const { x } of order) {
    const { hit, landing, frame, units } = x;
    const used = landing ? (twins.get(landing)?.get(hit.t) ?? new Set<number>()) : new Set<number>();
    const alive = targets.filter((t) => t.alive).sort((a, b) => b.last - a.last);
    const canNew = alive.length < atOnce && (!fromStart || targets.length < atOnce);
    const fresh: Target = { id: targets.length, alive: true, last: -1, got: new Map(), missed: new Map() };
    const candidates = [...alive.filter((t) => !used.has(t.id)), ...(canNew ? [fresh] : [])];
    const state = (t: Target) => {
      const off: string[] = [];
      const open: string[] = [];
      for (const u of units) {
        const g = t.got.get(u.key);
        if (g && g.at < frame && (g.appliedAt === u.appliedAt || g.expiresAt > frame)) continue;
        const m = t.missed.get(u.key)?.get(u.appliedAt);
        if (m !== undefined && m < frame) off.push(u.key);
        else open.push(u.key);
      }
      return { off, open };
    };
    let chosen: { t: Target; drop: Set<string>; decided: Map<string, boolean>; cost: number } | null = null;
    for (const t of candidates) {
      const { off, open } = state(t);
      const masks = 1 << open.length <= MAX_OPEN_SUBSETS ? Array.from({ length: 1 << open.length }, (_, m) => m) : [0, ...open.map((_, i) => 1 << i)];
      const fitting = masks.map((m) => new Set([...off, ...open.filter((_, i) => m & (1 << i))])).filter((d) => x.fits(d)).sort((a, b) => a.size - b.size);
      const best = fitting[0];
      if (!best) continue;
      const decided = new Map<string, boolean>();
      for (const k of open) {
        const n = fitting.filter((d) => d.has(k)).length;
        if (n === 0) decided.set(k, true);
        else if (n === fitting.length) decided.set(k, false);
      }
      const cost = (t === fresh ? 2 : 0) + (best.size > off.length ? 1 : 0);
      if (!chosen || cost < chosen.cost) chosen = { t, drop: best, decided, cost };
    }
    let how: HitTarget["how"] = "fits";
    if (!chosen) {
      how = "none fits";
      const t = alive.find((y) => !used.has(y.id)) ?? (canNew ? fresh : (alive[0] ?? fresh));
      chosen = { t, drop: new Set(state(t).off), decided: new Map(), cost: Infinity };
    }
    const t = chosen.t;
    if (t === fresh) targets.push(fresh);
    for (const u of units) {
      const d = chosen.decided.get(u.key);
      if (d === true) {
        const g = t.got.get(u.key);
        t.got.set(u.key, g && g.appliedAt === u.appliedAt ? { ...g, expiresAt: Math.max(g.expiresAt, u.expiresAt) } : { appliedAt: u.appliedAt, expiresAt: u.expiresAt, at: frame });
      } else if (d === false) {
        const m = t.missed.get(u.key) ?? new Map<number, number>();
        if (!m.has(u.appliedAt)) m.set(u.appliedAt, frame);
        t.missed.set(u.key, m);
      }
    }
    t.last = frame;
    if (landing) {
      const byMs = twins.get(landing) ?? new Map<number, Set<number>>();
      byMs.set(hit.t, new Set([...(byMs.get(hit.t) ?? []), t.id]));
      twins.set(landing, byMs);
    }
    const kills = killed(hit);
    if (kills) t.alive = false;
    of.set(hit, { target: t.id, drop: chosen.drop, how, kills });
  }
  return { of, count: targets.length };
}

/**
 * The kill gaps (enginecheck.ts killGaps) after which targets are left: in a fight whose targets are all there from
 * its start (severalTargets.fromStart), each gap whose kills so far (capped hits up to its kill's ms, two at one ms
 * two) are fewer than atOnce. The others there were hit unlogged (Hard 33: a shielded slug's hit deals 0), so the
 * replay's enemy stays (a landing applies its debuffs: 6339 14.09 s, Camille's Susceptibility on the next slug) and
 * the totals leave its landings out (the log records every hit that deals damage).
 */
export function gapsWithTargetsLeft<G extends { readonly from: number; readonly to: number }>(fx: Pick<LogFixture, "severalTargets" | "hits">, gaps: readonly G[]): G[] {
  const s = fx.severalTargets;
  if (!s?.fromStart) return [];
  const atOnce = s.atOnce ?? DEFAULT_AT_ONCE;
  return gaps.filter((g) => fx.hits.filter((h) => h.t <= g.from && killed(h)).length < atOnce);
}
