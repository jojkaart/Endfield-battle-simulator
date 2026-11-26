// The fight totals' one-sided landings by kind (2026-11-23, one-sided round): every replay-only landing and every
// log-only hit of a fight's totals (enginecheck.ts fightTotals) classified by what it is (operator, skill kind, hit
// key, nature: a kit hit, a trigger's hit, a burst, a reaction, a Combustion tick, a physical status) and where it
// sits (paired with an opposite-side landing of its operator nearby, the fight's end, an away stretch's edge, its
// cast's logged hits, the replay's reason for having no landing), with flags (inside a slow-down, near a cast the
// replay made as a cut, past the operator's next logged cast). `zmdlogs totals --kinds` ranks them over the
// development logs; measure gives the hold-outs' means by kind only (never per log). The hold-outs' totals error is
// mostly one-sided (12 of 13: replay-only 7.3%, log-only 6.2%, |matched| 2.5%): this says which landings.

import { effectiveKit, FPS, parseReactionEvent, type GameData, type LandedHit } from "@efsim/engine";
import type { BuffReplay } from "./buffreplay.ts";
import type { LogFixture, LogHit } from "./zmdlogs.ts";
import { ONE_SIDED } from "./replaykeys.ts";

/** How near (ms) a replay-only landing and a log-only hit of one operator pair as twins: one hit, keyed or placed apart. */
export const TWIN_MS = 1500;
/** Twins whose values are within this factor of each other are "like" (a key or path apart), else "other" (a different hit nearby). */
const TWIN_LIKE = 1.5;
/** Landings further apart in value than this factor aren't twins (a tiny arrow can't stand for a burst). */
const TWIN_MAX = 3;
/** How near the log's last hit (ms) a one-sided landing counts as the fight's end. */
const END_MS = 1500;
/** How near an away stretch's edge (ms) a one-sided landing counts as at it. */
const AWAY_EDGE_MS = 1000;
/** How far (ms) the replay may have dealt a logged status hit its operator has no landing for (OneSided.context). */
const STATUS_NEAR_MS = 5000;
/** How far before a one-sided landing (ms) a cast the replay made as a cut of its operator's running cast counts. */
const CUT_MS = 1000;

/** What a one-sided landing is: a kit skill's hit, a trigger's hit, Fixed DMG, or a status event of the enemy's. */
export type OneSidedNature = "kit hit" | "trigger hit" | "fixed" | "burst" | "reaction" | "tick" | "physical" | "uncovered";

/** One one-sided landing of a fight's totals (TotalsComparison.oneSided). */
export interface OneSided {
  readonly side: "replay" | "log";
  readonly operator: string;
  /** ms. */
  readonly t: number;
  /** The damage it puts on its side: + a replay-only landing's, − a log-only hit's value. */
  readonly damage: number;
  /** The replay's `skillId hitId`, or the log's event. */
  readonly key: string;
  /** The kit skill's kind (basic, battle, combo, ultimate…), `status` for an enemy status's event, `trigger`, `uncovered`. */
  readonly skill: string;
  readonly nature: OneSidedNature;
  /**
   * Where it sits, the first that applies: `unread` (a logged hit whose own landing counted without it: no primary
   * reading), `twin like` / `twin other` (paired with an opposite-side landing of its operator within TWIN_MS, values
   * within TWIN_LIKE, or within TWIN_MAX), `twin uncounted (<why>)` (a log-only hit with such a landing the totals left
   * out); then a replay-only landing's cast: `no cast` (a trigger's or a status's), `cast unlogged` (none of its landings stands for a logged hit), `cast tail` (after its last logged one),
   * `cast head` (before its first), `cast gap` (between two); a log-only hit's: the replay's reason for no landing
   * (BuffReplay.landing / statusLanding), or `landed, not counted`.
   */
  readonly context: string;
  /**
   * `stop` inside a slow-down the replay applied; `cut` within CUT_MS after a cast made as a cut (CastFlag cuts / inside)
   * of its operator; `next cast` past its operator's next logged cast after its own cast began (replay only); `end`
   * within END_MS of the log's last hit; `away` within AWAY_EDGE_MS of a stretch without logged hits (or in it).
   */
  readonly flags: readonly string[];
  /** Its twin's time and key (twin contexts). */
  readonly twin?: { readonly t: number; readonly key: string; readonly damage: number };
}

/** A part of the simulated total with its landing (fightTotals' own), as the classification reads it. */
export interface CountedLanding {
  readonly landing: LandedHit;
  readonly logged?: LogHit;
  readonly damage: number;
}

const msOf = (f: number) => (f * 1000) / FPS;

/** A replay landing's skill kind and nature. */
function replayKind(data: GameData, fx: LogFixture, l: LandedHit): { skill: string; nature: OneSidedNature } {
  if (l.skillId.startsWith("reaction:")) return { skill: "status", nature: natureOfReaction(l.skillId.slice("reaction:".length)) };
  const build = fx.team.find((b) => b.operator === l.operator);
  const kit = build ? effectiveKit(data, build) : undefined;
  const s = kit?.skills.find((x) => x.skillId === l.skillId);
  const nature: OneSidedNature = l.fixed ? "fixed" : l.cast === undefined ? "trigger hit" : "kit hit";
  return { skill: l.cast === undefined ? "trigger" : (s?.kind ?? "none"), nature };
}

function natureOfReaction(kind: string): OneSidedNature {
  return kind === "burst" ? "burst" : kind === "reaction" ? "reaction" : kind === "combustionTick" ? "tick" : "physical";
}

/** A logged hit's skill kind and nature (its event in its operator's kit). */
function loggedKind(data: GameData, fx: LogFixture, h: LogHit): { skill: string; nature: OneSidedNature } {
  const r = parseReactionEvent(h.event);
  if (r) return { skill: "status", nature: natureOfReaction(r.kind) };
  const build = fx.team.find((b) => b.operator === h.operator);
  const kit = build ? effectiveKit(data, build) : undefined;
  const s = kit?.skills.find((x) => x.hits.some((y) => y.events.includes(h.event)));
  if (s) return { skill: s.kind, nature: s.hits.find((y) => y.events.includes(h.event))?.fixedDamage ? "fixed" : "kit hit" };
  const t = kit?.triggers.flatMap((tr) => tr.do).find((a) => a.kind === "hits" && a.hits.some((y) => y.events.includes(h.event)));
  if (t) return { skill: "trigger", nature: "trigger hit" };
  return { skill: "uncovered", nature: "uncovered" };
}

/**
 * Every one-sided landing of a fight's totals, classified (OneSided): `counted` the simulated total's parts with their
 * landings, `uncounted` the replay's landings the totals left out and why (absent, away, after the kill, past the log's
 * end), `away` the away stretches (ms).
 */
export function oneSidedLandings(
  data: GameData,
  fx: LogFixture,
  replay: BuffReplay,
  counted: readonly CountedLanding[],
  away: readonly { readonly from: number; readonly to: number }[],
  uncounted: ReadonlyMap<LandedHit, string>,
): OneSided[] {
  const standsFor = new Set(counted.flatMap((p) => (p.logged ? [p.logged] : [])));
  const byLanding = new Map(counted.map((p) => [p.landing, p]));
  const lastLogged = fx.hits.reduce((m, h) => Math.max(m, h.t), 0);
  // The casts' landings standing for logged hits (frames), to place a replay-only landing in its cast.
  const castLogged = new Map<number, number[]>();
  const castFirst = new Map<number, number>();
  for (const p of counted) {
    const k = p.landing.cast;
    if (k === undefined) continue;
    castFirst.set(k, Math.min(castFirst.get(k) ?? Infinity, p.landing.frame));
    if (p.logged) castLogged.set(k, [...(castLogged.get(k) ?? []), p.landing.frame]);
  }
  for (const l of replay.hits) if (l.cast !== undefined) castFirst.set(l.cast, Math.min(castFirst.get(l.cast) ?? Infinity, l.frame));
  const logCasts = fx.casts ?? [];
  const stops = replay.appliedStops;
  const inStop = (t: number) => stops.some((s) => msOf(s.start) <= t && t < msOf(s.start + s.scales.length) && s.scales.some((x) => x < 1));
  const nearCut = (op: string, t: number) => replay.castFlags.some((x) => x.kind !== "forced" && x.cast.operator === op && msOf(x.frame) <= t && t - msOf(x.frame) <= CUT_MS);
  const items: { side: "replay" | "log"; operator: string; t: number; damage: number; key: string; skill: string; nature: OneSidedNature; context?: string; flags: string[]; twin?: OneSided["twin"]; landing?: LandedHit; hit?: LogHit }[] = [];
  for (const p of counted) {
    if (p.logged) continue;
    const l = p.landing;
    const t = msOf(l.frame);
    const flags: string[] = [];
    if (inStop(t)) flags.push("stop");
    if (nearCut(l.operator, t)) flags.push("cut");
    const first = l.cast !== undefined ? castFirst.get(l.cast) : undefined;
    if (first !== undefined && logCasts.some((c) => c.operator === l.operator && c.t > msOf(first) + 100 && c.t <= t)) flags.push("next cast");
    items.push({ side: "replay", operator: l.operator, t, damage: p.damage, key: `${l.skillId} ${l.hitId}`, ...replayKind(data, fx, l), flags, landing: l });
  }
  for (const h of fx.hits) {
    if (standsFor.has(h)) continue;
    const flags: string[] = [];
    if (inStop(h.t)) flags.push("stop");
    if (nearCut(h.operator, h.t)) flags.push("cut");
    items.push({ side: "log", operator: h.operator, t: h.t, damage: -h.value, key: h.event, ...loggedKind(data, fx, h), flags, hit: h });
  }
  // A logged hit whose own landing counted without it (no primary reading): both sides are one hit.
  for (const x of items) {
    if (x.side !== "log" || !x.hit) continue;
    const l = parseReactionEvent(x.hit.event) ? replay.statusLanding(x.hit) : replay.landing(x.hit);
    if ("unknown" in l) {
      x.context = `${ONE_SIDED.noLandingPrefix}${l.unknown}`;
      // A status the replay didn't deal near the hit: whether it dealt it later or sooner (its operator's, within
      // STATUS_NEAR_MS), by another operator near the hit, or not at all.
      const r = parseReactionEvent(x.hit.event);
      if (r) {
        const t = x.hit.t;
        const same = replay.hits.filter((y) => y.skillId === `reaction:${r.kind}` && Math.abs(msOf(y.frame) - t) <= STATUS_NEAR_MS);
        x.context += same.some((y) => y.operator === x.operator) ? ` (dealt within ${STATUS_NEAR_MS / 1000} s)` : same.some((y) => Math.abs(msOf(y.frame) - t) <= TWIN_MS) ? " (dealt by another operator)" : ` (none within ${STATUS_NEAR_MS / 1000} s)`;
      }
      continue;
    }
    const part = byLanding.get(l);
    if (part && !part.logged) {
      x.context = ONE_SIDED.unread;
      const r = items.find((y) => y.side === "replay" && y.landing === l);
      if (r) {
        r.context = ONE_SIDED.unread;
        r.twin = { t: x.t, key: x.key, damage: x.damage };
        x.twin = { t: r.t, key: r.key, damage: r.damage };
      }
    } else x.context = part ? ONE_SIDED.teammate : `landed, not counted${uncounted.has(l) ? ` (${uncounted.get(l)})` : ""}`;
  }
  // Twins: one to one, like values first, then nearest.
  const pairs: { r: (typeof items)[number]; h: (typeof items)[number]; like: boolean; dt: number }[] = [];
  for (const r of items)
    if (r.side === "replay" && r.context !== ONE_SIDED.unread)
      for (const h of items)
        if (h.side === "log" && h.context !== ONE_SIDED.unread && h.operator === r.operator && Math.abs(h.t - r.t) <= TWIN_MS) {
          const ratio = r.damage / -h.damage;
          if (ratio > TWIN_MAX || ratio < 1 / TWIN_MAX) continue;
          pairs.push({ r, h, like: ratio <= TWIN_LIKE && ratio >= 1 / TWIN_LIKE, dt: Math.abs(h.t - r.t) });
        }
  pairs.sort((a, b) => Number(b.like) - Number(a.like) || a.dt - b.dt);
  const paired = new Set<object>();
  for (const p of pairs) {
    if (paired.has(p.r) || paired.has(p.h)) continue;
    paired.add(p.r);
    paired.add(p.h);
    const ctx = p.like ? ONE_SIDED.twinLike : ONE_SIDED.twinOther;
    p.r.context = ctx;
    p.h.context = ctx;
    p.r.twin = { t: p.h.t, key: p.h.key, damage: p.h.damage };
    p.h.twin = { t: p.r.t, key: p.r.key, damage: p.r.damage };
  }
  // A log-only hit with no twin among the counted landings may have one the totals left out (after the kill, away):
  // `twin uncounted (<why>)`, the nearest of its operator's within TWIN_MS and TWIN_MAX.
  const spare = [...uncounted].filter(([l]) => l.exact > 0);
  const usedSpare = new Set<LandedHit>();
  for (const h of items) {
    if (h.side !== "log" || h.context === ONE_SIDED.unread || h.context?.startsWith("twin") || h.context?.startsWith("landed")) continue;
    let best: [LandedHit, string] | undefined;
    for (const [l, why] of spare) {
      if (usedSpare.has(l) || l.operator !== h.operator || Math.abs(msOf(l.frame) - h.t) > TWIN_MS) continue;
      const ratio = l.exact / -h.damage;
      if (ratio > TWIN_MAX || ratio < 1 / TWIN_MAX) continue;
      if (!best || Math.abs(msOf(l.frame) - h.t) < Math.abs(msOf(best[0].frame) - h.t)) best = [l, why];
    }
    if (!best) continue;
    usedSpare.add(best[0]);
    h.context = `twin uncounted (${best[1]})`;
    h.twin = { t: msOf(best[0].frame), key: `${best[0].skillId} ${best[0].hitId}`, damage: best[0].exact };
  }
  for (const x of items) {
    if (x.t >= lastLogged - END_MS) x.flags.push("end");
    if (away.some((w) => Math.abs(x.t - w.from) <= AWAY_EDGE_MS || Math.abs(x.t - w.to) <= AWAY_EDGE_MS || (x.t > w.from && x.t < w.to))) x.flags.push("away");
    if (x.context === ONE_SIDED.unread || x.context?.startsWith("twin")) continue;
    if (x.side === "replay" && x.landing) {
      const l = x.landing;
      const logged = l.cast !== undefined ? (castLogged.get(l.cast) ?? []) : [];
      x.context =
        l.cast === undefined ? ONE_SIDED.noCast
        : logged.length === 0 ? ONE_SIDED.castUnlogged
        : logged.every((f) => f < l.frame) ? ONE_SIDED.castTail
        : logged.every((f) => f > l.frame) ? ONE_SIDED.castHead
        : ONE_SIDED.castGap;
    }
  }
  return items.map(({ landing: _l, hit: _h, context, twin, ...x }) => ({ ...x, context: context ?? "?", ...(twin ? { twin } : {}) }));
}

/** One kind's share of a fight's logged total (TotalsShares.kinds): replay-only (+), log-only (−), and the landings. */
export interface KindShare {
  readonly context: string;
  readonly nature: OneSidedNature;
  readonly skill: string;
  readonly replay: number;
  readonly log: number;
  readonly n: number;
  /** Of them with each flag (OneSided.flags), as shares too: `stop`, `cut`, `next cast`. */
  readonly flagged: Readonly<Record<string, number>>;
}

/** One operator's key's share of a fight's logged total (TotalsShares.keys: development logs' views only). */
export interface KeyShare {
  readonly operator: string;
  readonly side: "replay" | "log";
  readonly key: string;
  readonly context: string;
  readonly share: number;
  readonly n: number;
}

/** A fight's one-sided landings summed by kind (context, nature, skill kind) and by operator and key, as % of `logged`. */
export function kindShares(items: readonly OneSided[], logged: number): { readonly kinds: KindShare[]; readonly keys: KeyShare[] } {
  const pct = (x: number) => (logged === 0 ? 0 : (100 * x) / logged);
  const kinds = new Map<string, { context: string; nature: OneSidedNature; skill: string; replay: number; log: number; n: number; flagged: Record<string, number> }>();
  const keys = new Map<string, { operator: string; side: "replay" | "log"; key: string; context: string; share: number; n: number }>();
  for (const x of items) {
    const k = `${x.context}|${x.nature}|${x.skill}`;
    const a = kinds.get(k) ?? { context: x.context, nature: x.nature, skill: x.skill, replay: 0, log: 0, n: 0, flagged: {} };
    kinds.set(k, a);
    if (x.side === "replay") a.replay += pct(x.damage);
    else a.log += pct(x.damage);
    a.n++;
    for (const f of x.flags) a.flagged[f] = (a.flagged[f] ?? 0) + pct(Math.abs(x.damage));
    const kk = `${x.operator}|${x.side}|${x.key}|${x.context}`;
    const b = keys.get(kk) ?? { operator: x.operator, side: x.side, key: x.key, context: x.context, share: 0, n: 0 };
    keys.set(kk, b);
    b.share += pct(x.damage);
    b.n++;
  }
  return { kinds: [...kinds.values()], keys: [...keys.values()] };
}

/**
 * Kinds over several fights: each kind's mean share per fight (summed over the fights, ÷ their count), largest gross
 * (replay-only + |log-only|) first, and in how many fights it occurs. The hold-outs' only view (measure): no log named.
 */
export function kindsAggregate(fights: readonly (readonly KindShare[])[], by: (k: KindShare) => string = (k) => `${k.context} · ${k.nature} · ${k.skill}`): { readonly kind: string; readonly replay: number; readonly log: number; readonly fights: number; readonly flagged: Readonly<Record<string, number>> }[] {
  const n = fights.length || 1;
  const out = new Map<string, { kind: string; replay: number; log: number; fights: number; flagged: Record<string, number> }>();
  for (const f of fights) {
    const seen = new Set<string>();
    for (const k of f) {
      const key = by(k);
      const a = out.get(key) ?? { kind: key, replay: 0, log: 0, fights: 0, flagged: {} };
      out.set(key, a);
      a.replay += k.replay / n;
      a.log += k.log / n;
      for (const [fl, v] of Object.entries(k.flagged)) a.flagged[fl] = (a.flagged[fl] ?? 0) + v / n;
      if (!seen.has(key)) a.fights++;
      seen.add(key);
    }
  }
  return [...out.values()].sort((a, b) => b.replay - b.log - (a.replay - a.log));
}
