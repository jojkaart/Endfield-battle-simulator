// Crits the log leaves out, read for the replay (buffreplay.ts replayKitBuffs): from hits shown together
// (shownCrits), from a layered buff's listed layers (layerCrits), from the hits' values (valueCrits), and the kit
// triggers whose chance the replay can't decide (critTriggers, chancePathBuff, undecidedBuff). Split from
// buffreplay.ts (improvement round 14).

import { allActions, kitHitEntries, type KitTrigger, type OperatorKit, type SkillType } from "@efsim/engine";
import type { LogEffect, LogFixture, LogHit } from "./zmdlogs.ts";
import type { Placement } from "./logcasts.ts";
import { loggedNames } from "./enginecheck.ts";

/** Trigger events a log doesn't let the replay judge: the enemy's own actions. */
const UNJUDGED_EVENTS: ReadonlySet<string> = new Set(["attacked", "perfectDodge", "enemyCharge"]);

/**
 * Why the replay can't judge a trigger (it has no rolls or enemy actions), or null. Crits it has from the log
 * (TimelineScenario.loggedCrits); where a landing's crit isn't logged, the buffs crits apply are undecided for a while
 * (critTriggers, BuffReplay.instances).
 */
function unjudged(t: KitTrigger, kit: OperatorKit): string | null {
  if (UNJUDGED_EVENTS.has(t.on.event)) return `${t.id}: on ${t.on.event}`;
  if (t.chance !== undefined) return `${t.id}: a chance`;
  // Whom a heal reaches when it heals the controlled operator: the log doesn't record who's controlled (the replay takes
  // the last to make a basic attack; 0eef2474a26f: Liino's weapon buff on her heals' targets, Typhoeus and Si in the log,
  // Arcane in the replay).
  if (t.on.event === "heal" && (t.by !== "self" || healsControlled(kit))) return `${t.id}: on heals of the controlled operator, whom the log doesn't name`;
  return null;
}

/** Whether any of a kit's heals (its hits', its triggers') heals the controlled operator. */
function healsControlled(kit: OperatorKit): boolean {
  return kitHitEntries(kit).some((e) => e.hit.heals === "controlled") || kit.triggers.some((t) => allActions(t.do).some((a) => a.kind === "heal" && a.target === "controlled"));
}

/** How close (ratio) the lowest of the hits taken for crits at one moment may be to the highest of the rest. */
const CRIT_APART = 1.4;

/**
 * Crits the log leaves out (LogHit.crit null) that a trigger on crits shows by its own logged hits, per logged hit
 * index. Every development log leaves the crit out of Rossi's ultimate stabs (and of hits during it), yet logs the
 * Seething Blood extra each crit stab fires on a Clawmarked enemy at the stab's very ms (pending/zmdlogs-489c0be3e162.json
 * 94430 ms: one stab of 16604 and one extra; 95000 ms: stabs of 16604, 16604 and 6386 and two extras): at a moment with
 * m such hits (less the logged crits that may have fired them), the m largest of the operator's hits there of the
 * trigger's kinds with no logged crit are crits, when they stand apart from the rest (crit and non-crit values of one
 * key differ by the crit zone, ×1.5 or more: CRIT_APART). Without the inference the replay's main run lands none of the extras and
 * the Wolven Blood layers those crits add.
 */
export function shownCrits(kits: readonly OperatorKit[], fx: LogFixture, placement: Placement): Map<number, boolean> {
  const out = new Map<number, boolean>();
  const index = new Map(fx.hits.map((h, i) => [h, i]));
  for (const k of kits) for (const t of k.triggers) {
    if (t.on.event !== "hit" || t.on.crit !== true || t.by !== "self") continue;
    const kinds = t.on.kinds;
    const keys = new Set(allActions(t.do).flatMap((a) => (a.kind === "hits" ? a.hits.flatMap((h) => h.events) : [])));
    if (keys.size === 0) continue;
    const byMs = new Map<number, { shown: number; known: number; open: LogHit[] }>();
    const at = (t: number) => byMs.get(t) ?? byMs.set(t, { shown: 0, known: 0, open: [] }).get(t) as { shown: number; known: number; open: LogHit[] };
    for (const h of fx.hits) {
      if (h.operator !== k.operator) continue;
      if (keys.has(h.event)) {
        at(h.t).shown++;
        continue;
      }
      const kind = placement.hits.get(h)?.cast.kind;
      if (!kind || (kinds && !kinds.includes(kind as SkillType))) continue;
      if (h.crit === true) at(h.t).known++;
      else if (h.crit === null) at(h.t).open.push(h);
    }
    for (const g of byMs.values()) {
      const m = g.shown - g.known;
      if (m <= 0 || g.open.length === 0) continue;
      const sorted = [...g.open].sort((a, b) => b.value - a.value);
      const crits = sorted.slice(0, Math.min(m, sorted.length));
      const rest = sorted.slice(crits.length);
      const lowest = crits.at(-1) as LogHit;
      if (rest.length > 0 && lowest.value < CRIT_APART * (rest[0] as LogHit).value) continue;
      for (const h of crits) out.set(index.get(h) as number, true);
    }
  }
  return out;
}

/**
 * The instances of a game buff the log lists as starting at each ms, on an operator's hits (its effects and the
 * boundary's): per start, the entries with that `since` over the kinds of entry (zone and element) among them, the most
 * any one hit lists. Wolven Blood (buff_wpn_sword_0022_layer) is listed once per layer and element (Physical, Heat):
 * two layers from one moment are four entries.
 */
export function listedStarts(fx: LogFixture, operator: string, gameBuff: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const h of fx.hits) {
    if (h.operator !== operator) continue;
    const bySince = new Map<number, LogEffect[]>();
    for (const e of [...h.effects, ...h.boundaryEffects]) {
      if (e.buff !== gameBuff || e.since === undefined || (e.source !== undefined && e.source !== operator)) continue;
      bySince.set(e.since, [...(bySince.get(e.since) ?? []), e]);
    }
    for (const [s, es] of bySince) out.set(s, Math.max(out.get(s) ?? 0, es.length / new Set(es.map((e) => `${e.zone}|${e.element}`)).size));
  }
  return out;
}

/**
 * Crits the log leaves out (LogHit.crit null) that a trigger on crits shows by the layers it adds: a trigger on its
 * operator's crits that adds a layer of a buff the log lists with its start (LogEffect.since) adds one per crit, so n
 * layers listed from a moment are n crits there. 489c (pending/zmdlogs-489c0be3e162.json) lists Rossi's Wolven Blood
 * layers from 54406 ms, then one from 55610 ms with the max-stack final, on a power attack whose crit the log doesn't
 * give (and one from each of her next five crit-less hits); without it the replay reaches 16 layers 3.9 s later. Taken
 * after the logged crits and those `shown` (shownCrits) at the moment: n − those are crits among the rest of the
 * operator's crit-less hits there of the trigger's kinds; all of them when there are as many, else the largest when
 * they stand apart (CRIT_APART). Not a buff the replay can't decide (a chance, an enemy's action). The count can only
 * add crits: at the buff's maximum a new layer replaces one, and the listing can show fewer than were dealt.
 */
export function layerCrits(kits: readonly OperatorKit[], fx: LogFixture, placement: Placement, shown: ReadonlyMap<number, boolean> = new Map()): Map<number, boolean> {
  const out = new Map<number, boolean>();
  const index = new Map(fx.hits.map((h, i) => [h, i]));
  for (const k of kits) for (const t of k.triggers) {
    if (t.on.event !== "hit" || t.on.crit !== true || t.by !== "self" || t.chance !== undefined) continue;
    const first = t.do[0];
    const def = first?.kind === "buff" && !first.if ? k.buffs.find((d) => d.id === first.buff) : undefined;
    if (!def?.gameBuff || undecidedBuff(k, def.id)) continue;
    const kinds = t.on.kinds;
    const starts = listedStarts(fx, k.operator, def.gameBuff);
    if (starts.size === 0) continue;
    const byMs = new Map<number, LogHit[]>();
    for (const h of fx.hits) {
      if (h.operator !== k.operator || !starts.has(h.t)) continue;
      if (kinds) {
        const kind = placement.hits.get(h)?.cast.kind;
        if (!kind || !kinds.includes(kind as SkillType)) continue;
      }
      byMs.set(h.t, [...(byMs.get(h.t) ?? []), h]);
    }
    for (const [ms, hits] of byMs) {
      const crit = (h: LogHit) => h.crit ?? shown.get(index.get(h) as number) ?? out.get(index.get(h) as number) ?? null;
      const m = (starts.get(ms) as number) - hits.filter((h) => crit(h) === true).length;
      const open = hits.filter((h) => crit(h) === null).sort((a, b) => b.value - a.value);
      if (m <= 0 || open.length === 0) continue;
      const crits = open.slice(0, m);
      const rest = open.slice(crits.length);
      if (rest.length > 0 && (crits.at(-1) as LogHit).value < CRIT_APART * (rest[0] as LogHit).value) continue;
      for (const h of crits) out.set(index.get(h) as number, true);
    }
  }
  return out;
}

/** How far either side of a crit-less hit (ms) valueCrits looks for the lowest hit of its group. */
const VALUE_CRIT_NEAR_MS = 1000;

/** The zones a hit's listed effects scale it by, each summed (1 + Σ), the multiplicative zone's entries one by one. */
const LISTED_SUM_ZONES: ReadonlySet<string> = new Set(["atk", "damageBonus", "amp", "susceptibility", "damageTaken"]);

/**
 * The factor a logged hit's listed effects (its element's, or every element's) put on its value, crit aside: per zone
 * 1 + the sum of its entries, the multiplicative zone's (Stagger ×1.3) each its own. An approximation of the damage
 * formula's zones (no DEF, no resistance), good enough to tell a change of buffs from the crit zone (valueCrits).
 */
function listedFactor(h: LogHit): number {
  const sums = new Map<string, number>();
  let f = 1;
  for (const e of h.effects) {
    if (e.element !== null && e.element !== h.element) continue;
    if (e.zone === "multiplicative") f *= 1 + e.value;
    else if (LISTED_SUM_ZONES.has(e.zone)) sums.set(e.zone, (sums.get(e.zone) ?? 0) + e.value);
  }
  for (const s of sums.values()) f *= 1 + s;
  return f;
}

/**
 * Crits the log leaves out (LogHit.crit null) that the hits' own values show: hits of one key, skill and scale differ
 * only by the buffs that change between them and the crit zone (×1.5 or more), so a hit CRIT_APART above the lowest of
 * its group within VALUE_CRIT_NEAR_MS (a logged non-crit or another crit-less hit) is a crit. Not a group whose logged
 * non-crits stand that far apart by themselves, nor a slot that can be kit hits of two scales. 5082ceaffad1 leaves the
 * crit out of all 85 hits of Yvonne's ultimate; their values are two levels ×3.0 apart (34125 and 11375 at 45.6–46.0 s),
 * and MI Security's layers, which each of her crits refreshes, are listed on her to the fight's end: without the crits
 * the replay let them run out 0.05 s before her finisher (49.78 s, ×1.17). Cross-validated on the development logs
 * (half the logged flags hidden, two folds; scripts/probes/crits/value-xval.ts, 2026-11-23): 1132 of 1260 inferred
 * crits right over every operator (0.90; base rate 0.10), 442 of 445 for Rossi, Chen and Yvonne, whose kits have crit
 * triggers; with each hit's value from another hit of its key (negative control) 0.24; with the values over their
 * listed effects (listedFactor, 2026-11-24) 1110 of 1222 (0.908). Only for an operator whose kit
 * has a trigger on its own crits; added after the logged crits and those shownCrits and layerCrits give.
 */
export function valueCrits(kits: readonly OperatorKit[], fx: LogFixture, placement: Placement, known: ReadonlyMap<number, boolean> = new Map()): Map<number, boolean> {
  const out = new Map<number, boolean>();
  const ops = new Set(kits.filter((k) => k.triggers.some((t) => t.on.event === "hit" && t.on.crit !== undefined && t.by === "self")).map((k) => k.operator));
  const groups = new Map<string, { h: LogHit; i: number; crit: boolean | null }[]>();
  for (const [i, h] of fx.hits.entries()) {
    if (!ops.has(h.operator) || !(h.value > 0)) continue;
    const p = placement.hits.get(h);
    if (!p || p.sameAs) continue;
    const crit = h.crit ?? known.get(i) ?? null;
    if (crit === true) continue;
    // One scale for the slot: a slot that can be hits of two scales isn't a group.
    const scales = new Set(p.hits.map((x) => x.scale.join("+")));
    if (scales.size !== 1) continue;
    const key = `${h.operator}|${h.event}|${p.cast.skillId}|${[...scales][0]}`;
    groups.set(key, [...(groups.get(key) ?? []), { h, i, crit }]);
  }
  // Each value over its listed effects (listedFactor): a Stagger or a Susceptibility starting between two hits isn't a
  // crit (207fff414d82 41.03–41.47 s: Rossi's stabs of 13,441 after 6,714 at 40.39 s, ×1.3 Stagger and Arts
  // Susceptibility +0.54 listed from 41.03 s, taken for crits: their Seething Blood extras were the replay's only).
  const norm = new Map([...groups.values()].flat().map((x) => [x.h, x.h.value / listedFactor(x.h)]));
  const lowest = (g: readonly { h: LogHit; crit: boolean | null }[], h: LogHit, only: (c: boolean | null) => boolean) => {
    const near = g.filter((x) => x.h !== h && only(x.crit) && Math.abs(x.h.t - h.t) <= VALUE_CRIT_NEAR_MS);
    return near.length ? Math.min(...near.map((x) => norm.get(x.h) as number)) : null;
  };
  for (const g of groups.values()) {
    // A group whose logged non-crits stand apart by themselves splits for another reason (a kit hit the slot doesn't
    // tell apart: Purrchena's attack1, 367 and 551 both logged without a crit in 04d401ad257e).
    if (g.some((x) => x.crit === false && (norm.get(x.h) as number) >= CRIT_APART * (lowest(g, x.h, (c) => c === false) ?? Infinity))) continue;
    for (const { h, i, crit } of g) {
      if (crit !== null) continue;
      const low = lowest(g, h, () => true);
      if (low !== null && (norm.get(h) as number) >= CRIT_APART * low) out.set(i, true);
    }
  }
  return out;
}

/**
 * The triggers on crits behind one of a kit's buffs: those that apply it on a crit, and those behind a buff a trigger
 * that applies it listens to (to a depth of a few links). Whose hits each listens to (KitTrigger.by).
 */
export function critTriggers(kit: OperatorKit, buffId: string, depth = 0): KitTrigger[] {
  if (depth > 4) return [];
  return kit.triggers.flatMap((t) => {
    if (!allActions(t.do).some((a) => a.kind === "buff" && a.buff === buffId)) return [];
    return [...(t.on.event === "hit" && t.on.crit !== undefined ? [t] : []), ...("buff" in t.on && t.on.buff !== buffId ? critTriggers(kit, t.on.buff, depth + 1) : [])];
  });
}

/**
 * Why the replay can't decide a buff a kit hit applies, or null: the hit lands only on the path a chance jump takes
 * (every frame of it at or after the jump's target), which the replay rolls on its own stream and the log doesn't
 * give. ad7f5ee2c91c: the replay rolled Alesh's Rare Fin at 13.8 s (his logged slam fits the normal one, ×0.85 as all
 * his hits), so his P3 team ATK, which only the Rare Fin's slam applies, stood on 10 s of everyone's hits the log
 * lists it on none of (Arcane's 30 basic attacks ×0.904, Si's ×0.929). Not one of `shown` (game buffs whose chance
 * path the listing decided in every cast, castassembly.ts listedPathBuffs): the replay takes the path its listing
 * shows (listedPaths, 2026-11-26: her P3 is listed from exactly the Rare Fin slam's ms in every development log).
 */
function chancePathBuff(kit: OperatorKit, buffId: string, shown: ReadonlySet<string>): string | null {
  const def = kit.buffs.find((d) => d.id === buffId);
  if (def && loggedNames(def).some((g) => shown.has(g))) return null;
  for (const t of kit.triggers) {
    if (t.chance === undefined) continue;
    for (const a of allActions(t.do)) {
      if (a.kind !== "jump") continue;
      const skill = kit.skills.find((s) => s.skillId === a.skill);
      for (const h of skill?.hits ?? []) {
        if (!(h.buffs ?? []).some((b) => b.buff === buffId)) continue;
        if (h.frames?.length && h.frames.every((f) => f >= a.to)) return `${t.id}: a chance (${h.id} lands only on the path it jumps to)`;
      }
    }
  }
  return null;
}

/**
 * Why the replay can't decide one of a kit's buffs, or null: a trigger that
 * applies it can't be judged, or listens to a buff that can't (to a depth of
 * a few such links). `shown`: the game buffs whose chance paths the listing decided (chancePathBuff).
 */
export function undecidedBuff(kit: OperatorKit, buffId: string, depth = 0, shown: ReadonlySet<string> = new Set()): string | null {
  if (depth > 4) return null;
  const byChance = chancePathBuff(kit, buffId, shown);
  if (byChance) return byChance;
  for (const t of kit.triggers) {
    if (!allActions(t.do).some((a) => a.kind === "buff" && a.buff === buffId)) continue;
    const own = unjudged(t, kit);
    if (own) return own;
    if ("buff" in t.on && t.on.buff !== buffId) {
      const via = undecidedBuff(kit, t.on.buff, depth + 1, shown);
      if (via) return `${t.id} via ${via}`;
    }
  }
  return null;
}

/**
 * Where a logged hit's crit in the replay comes from (BuffReplay.critSource): `log` its flag; `shown` a trigger on crits
 * its logged hits show (shownCrits); `layers` the layers such a trigger adds (layerCrits); `values` the hits' values
 * (valueCrits); `none` nothing: the replay the check reads lands it without a crit.
 */
export type CritSource = "log" | "shown" | "layers" | "values" | "none";
