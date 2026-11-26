// What the replay makes of the logged hits (logcheck.ts reads it): each hit's replayed instances of the decided game
// buffs against the log's listing (replayedHits, atLayers), and the runs where the two disagree (disagreementRuns).
// Split from buffreplay.ts (improvement round 14).

import { isBuffFileListed, readBuffFile } from "@efsim/data";
import type { LogEffect, LogFixture, LogHit } from "./zmdlogs.ts";
import type { BuffReplay } from "./buffreplay.ts";

/** Where the replay and the log disagree about a kit buff at a logged hit: one has it on and the other off, or both on with other instance counts. */
export interface BuffDisagreement {
  readonly buff: string;
  readonly operator: string;
  readonly t: number;
  /** Instances the log lists at the hit (inside it, not at its boundary; an unquantified listing counts as one). */
  readonly log: number;
  readonly replay: number;
}

const layeredCache = new Map<string, boolean>();
/** Whether ZMDLogs lists a buff once whatever its layers (BuffData stackingType 8: layers on one timer). */
export function listedOnce(buff: string): boolean {
  if (!layeredCache.has(buff)) layeredCache.set(buff, isBuffFileListed(buff) && readBuffFile(buff)?.stacking.type === 8);
  return layeredCache.get(buff) as boolean;
}

/** One instance's logged effects of a buff: per zone and element, the strongest value at that listing. */
function oneInstance(effects: readonly LogEffect[]): LogEffect[] {
  const best = new Map<string, LogEffect>();
  for (const e of effects) {
    const k = `${e.zone}|${e.element}`;
    const cur = best.get(k);
    if (!cur || e.value > cur.value) best.set(k, e);
  }
  return [...best.values()];
}

/** Instances of a buff a logged listing has: its most repeated zone and element. */
function listedInstances(effects: readonly LogEffect[]): number {
  const n = new Map<string, number>();
  for (const e of effects) n.set(`${e.zone}|${e.element}`, (n.get(`${e.zone}|${e.element}`) ?? 0) + 1);
  return Math.max(0, ...n.values());
}

/** A logged hit with some buffs' entries (each listed once) at a number of layers. */
export function atLayers(hit: LogHit, layers: ReadonlyMap<string, number>): LogHit {
  if (layers.size === 0) return hit;
  const scale = (e: LogEffect): LogEffect => {
    const n = layers.get(e.buff);
    return n === undefined ? e : { ...e, value: e.value * n };
  };
  return { ...hit, effects: hit.effects.map(scale), boundaryEffects: hit.boundaryEffects.map(scale) };
}

/** The logged hits as the replay decides their kit buffs (replayedHits), with the disagreements found. */
export interface ReplayedHits {
  /** Each logged hit with its decided buffs' effects as the replay has them; a hit the replay doesn't change is itself. */
  readonly hits: ReadonlyMap<LogHit, LogHit>;
  /** Per hit, the game buffs whose entries the replay set (added or took away). */
  readonly decidedAt: ReadonlyMap<LogHit, ReadonlySet<string>>;
  /** Per hit, the game buffs the replay judged there (it decides them: not near one of its changes). */
  readonly judgedAt: ReadonlyMap<LogHit, ReadonlySet<string>>;
  /**
   * Per hit, the layers the replay gives a buff the log lists once whatever its layers (stackingType 8) and both have
   * on: the hit's entries are at that many layers (in `hits`, and for the log's listing too: logcheck.ts).
   */
  readonly layersAt: ReadonlyMap<LogHit, ReadonlyMap<string, number>>;
  readonly disagreements: readonly BuffDisagreement[];
}

/**
 * Each logged hit with the replay's activity of its decided buffs in place of
 * the log's listing, where the replay is sure (BuffReplay.instances): a buff
 * the replay has off loses its entries (effects, boundary effects,
 * unquantified); one it has on that the log lists inside the hit keeps the
 * log's entries (their instances and values: the log's gaps are buffs it
 * stops listing, not miscounted layers; a different count is reported); one
 * it has on that the log doesn't list, or lists only at the hit's boundary
 * or without values, gets the replay's instances, with the values the log
 * gives the buff elsewhere (one instance's, from the nearest hit of the same
 * operator that lists it, else of anyone's; a buff the log lists once
 * whatever its layers, stackingType 8, as one entry at the layers' total).
 * Near a change, the log's listing stands.
 */
export function replayedHits(fx: LogFixture, replay: BuffReplay): ReplayedHits {
  const listings = new Map<string, { t: number; operator: string; effects: LogEffect[] }[]>();
  for (const h of fx.hits) {
    for (const buff of new Set([...h.effects, ...h.boundaryEffects].map((e) => e.buff))) {
      if (!replay.decided.has(buff)) continue;
      const inside = h.effects.filter((e) => e.buff === buff);
      const effects = inside.length ? inside : h.boundaryEffects.filter((e) => e.buff === buff);
      listings.set(buff, [...(listings.get(buff) ?? []), { t: h.t, operator: h.operator, effects }]);
    }
  }
  const template = (buff: string, hit: LogHit): LogEffect[] => {
    let best: { d: number; effects: LogEffect[] } | null = null;
    for (const l of listings.get(buff) ?? []) {
      // The same operator's listings first (a buff's values may differ by recipient), then the nearest in time.
      const d = Math.abs(l.t - hit.t) + (l.operator === hit.operator ? 0 : 1e9);
      if (!best || d < best.d) best = { d, effects: l.effects };
    }
    return best ? oneInstance(best.effects) : [];
  };
  const hits = new Map<LogHit, LogHit>();
  const decidedAt = new Map<LogHit, Set<string>>();
  const judgedAt = new Map<LogHit, Set<string>>();
  const layersAt = new Map<LogHit, Map<string, number>>();
  const disagreements: BuffDisagreement[] = [];
  for (const hit of fx.hits) {
    const judged = new Set<string>();
    const set = new Set<string>();
    const layers = new Map<string, number>();
    const added: LogEffect[] = [];
    for (const buff of replay.decided.keys()) {
      const n = replay.instances(hit, buff);
      if (n === null) continue;
      judged.add(buff);
      const inside = hit.effects.filter((e) => e.buff === buff);
      const atBoundary = hit.boundaryEffects.some((e) => e.buff === buff);
      const logged = inside.length ? listedInstances(inside) : hit.unquantified.some((u) => u.buff === buff) ? 1 : 0;
      // The log's boundary listing says nothing either way.
      if (!(inside.length === 0 && atBoundary && logged === 0)) {
        const count = !listedOnce(buff) && logged > 0 && n > 0 && logged !== n;
        if ((logged > 0) !== (n > 0) || count) disagreements.push({ buff, operator: hit.operator, t: hit.t, log: logged, replay: n });
      }
      // The log's entries stand; a buff the log lists once whatever its layers (stackingType 8) at the replay's layers.
      if (n > 0 && inside.length) {
        if (listedOnce(buff) && n > 1 && listedInstances(inside) === 1) layers.set(buff, n);
        continue;
      }
      if (n === 0 && !inside.length && !atBoundary && !hit.unquantified.some((u) => u.buff === buff)) continue; // nothing to change
      set.add(buff);
      if (n === 0) continue;
      const one = inside.length ? oneInstance(inside) : template(buff, hit);
      if (listedOnce(buff)) added.push(...one.map((e) => ({ ...e, value: e.value * n })));
      else for (let i = 0; i < n; i++) added.push(...one);
    }
    if (judged.size) judgedAt.set(hit, judged);
    if (layers.size) layersAt.set(hit, layers);
    const layered = atLayers(hit, layers);
    if (set.size === 0) {
      hits.set(hit, layered);
      continue;
    }
    decidedAt.set(hit, set);
    hits.set(hit, {
      ...layered,
      effects: [...layered.effects.filter((e) => !set.has(e.buff)), ...added],
      boundaryEffects: layered.boundaryEffects.filter((e) => !set.has(e.buff)),
      unquantified: layered.unquantified.filter((u) => !set.has(u.buff)),
    });
  }
  return { hits, decidedAt, judgedAt, layersAt, disagreements };
}

/** A run of disagreeing hits of one buff and operator, one way. */
export interface DisagreementRun {
  readonly buff: string;
  readonly operator: string;
  /** "replay": the replay has it on, the log doesn't list it; "log": the reverse; "count": both on, with other instance counts. */
  readonly on: "replay" | "log" | "count";
  readonly from: number;
  readonly to: number;
  readonly hits: number;
  /** For "count": the instance counts seen (log / replay). */
  readonly counts?: readonly string[];
}

/** Disagreements grouped into runs: consecutive judged hits of an operator that disagree the same way. */
export function disagreementRuns(fx: LogFixture, r: ReplayedHits): DisagreementRun[] {
  const byHit = new Map<LogHit, Map<string, BuffDisagreement>>();
  const hitOf = new Map<string, LogHit[]>();
  for (const h of fx.hits) hitOf.set(`${h.operator}|${h.t}`, [...(hitOf.get(`${h.operator}|${h.t}`) ?? []), h]);
  for (const d of r.disagreements) for (const h of hitOf.get(`${d.operator}|${d.t}`) ?? []) byHit.set(h, new Map([...(byHit.get(h) ?? []), [d.buff, d]]));
  const out: DisagreementRun[] = [];
  const sorted = [...fx.hits].sort((a, b) => a.t - b.t);
  const buffs = [...new Set(r.disagreements.map((d) => d.buff))].sort();
  for (const buff of buffs) {
    for (const operator of fx.team.map((b) => b.operator)) {
      let cur: { on: DisagreementRun["on"]; from: number; to: number; hits: number; counts: Set<string> } | null = null;
      const flush = () => {
        if (cur) out.push({ buff, operator, on: cur.on, from: cur.from, to: cur.to, hits: cur.hits, ...(cur.on === "count" ? { counts: [...cur.counts] } : {}) });
      };
      for (const h of sorted) {
        if (h.operator !== operator || !r.judgedAt.get(h)?.has(buff)) continue;
        const d = byHit.get(h)?.get(buff);
        const on: DisagreementRun["on"] | null = d ? (d.log > 0 && d.replay > 0 ? "count" : d.replay > 0 ? "replay" : "log") : null;
        if (cur && on === cur.on) {
          cur.to = h.t;
          cur.hits++;
          if (d) cur.counts.add(`${d.log}/${d.replay}`);
          continue;
        }
        flush();
        cur = on && d ? { on, from: h.t, to: h.t, hits: 1, counts: new Set([`${d.log}/${d.replay}`]) } : null;
      }
      flush();
    }
  }
  return out;
}
