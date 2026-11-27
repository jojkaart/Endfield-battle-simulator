// The replay's kit landings paired with the logged hits they stand for (round 21, the tail-cut report point 1: the
// pairing lived inside buffreplay.ts replayKitBuffs as closures over its locals, so tailCuts' `needed` check wrote a
// looser copy, replayrun.ts loggedShown). One function of a run's landings: buffreplay.ts reads it for
// BuffReplay.landing, a counterfactual replay (`zmdlogs decisions --why-kept`) for what a cut tail's replay loses.
// The status landings' pairing stays in buffreplay.ts (statuspairs.ts): it needs the check's value fits.
//
// Moved from buffreplay.ts (a move: the same rule, the same constants).

import { allActions, kitHitEntries, type KitHit, type LandedHit, type OperatorKit } from "@efsim/engine";
import { batchedFrame, frameOf, type ReplayedCast } from "./castassembly.ts";
import { isRecordedBurst } from "./recordedburst.ts";
import type { LogFixture } from "./zmdlogs.ts";

/** How far (frames) a landing a trigger made may be from a logged hit it is taken for (its trigger's own timing drifts from the log's). */
export const LANDING_NEAR_FRAMES = 16;
/** The same for a recorded burst (Si's Artful Intent: one per record, at most one in 20 s), whose record's end can be the replay's own. */
export const RECORDED_NEAR_FRAMES = 60;

/** Whether two conditions are each other's complement: X and {not: X}, or a stack's `atLeast a` and `below a`. */
function complementary(a: unknown, b: unknown): boolean {
  const j = (x: unknown) => JSON.stringify(x);
  const not = (x: unknown) => (typeof x === "object" && x !== null && "not" in x ? (x as { not: unknown }).not : undefined);
  if (a === undefined || b === undefined) return false;
  if (j(not(a)) === j(b) || j(not(b)) === j(a)) return true;
  const range = (x: unknown) => (typeof x === "object" && x !== null && "stack" in x ? (x as { stack: unknown; atLeast?: unknown; below?: unknown }) : null);
  const [x, y] = [range(a), range(b)];
  if (!x || !y || x.stack !== y.stack || Object.keys(x).length !== 2 || Object.keys(y).length !== 2) return false;
  return (x.atLeast !== undefined && x.atLeast === y.below) || (y.atLeast !== undefined && y.atLeast === x.below);
}

/**
 * A trigger's hits whose actions are alternatives (two `hits` actions of one trigger under complementary conditions:
 * Si's Artful Intent burst through the Inksoul or as the mark, Typhoeus's arrow rain's sub1 / sub2, Last Rite's
 * phantom controlled or not), each with the events of both: one landing, by one path or the other, so a logged hit of
 * one path takes the replay's landing of the other (c779 60.37 s: the log's burst through an Inksoul the replay
 * hadn't, which landed the mark's; the damage is the record's either way).
 */
export function alternativeEvents(kit: OperatorKit): ReadonlyMap<KitHit, readonly string[]> {
  const out = new Map<KitHit, readonly string[]>();
  for (const t of kit.triggers) {
    const actions = allActions(t.do).filter((a): a is Extract<typeof a, { kind: "hits" }> => a.kind === "hits");
    for (const a of actions)
      for (const b of actions) {
        if (a === b || !complementary((a as { if?: unknown }).if, (b as { if?: unknown }).if)) continue;
        const events = [...new Set([...a.hits, ...b.hits].flatMap((h) => h.events))];
        for (const h of a.hits) out.set(h, [...new Set([...(out.get(h) ?? h.events), ...events])]);
      }
  }
  return out;
}

/**
 * Each logged hit's kit landing in a run (keyed by the hit's index in fx.hits): its pinned landing (LandedHit.ref);
 * else, for landings a trigger made (not pinned), the nearest of its operator's with its event within LANDING_NEAR_FRAMES
 * (a recorded burst: RECORDED_NEAR_FRAMES), the logged hits in time order, each landing once. A trigger's hit takes
 * its alternatives' events too (alternativeEvents). A logged hit's frame is its batch's (castassembly.ts batchedFrame)
 * where its cast batched it. Status landings aren't paired here (buffreplay.ts, statuspairs.ts).
 */
export function pairKitLandings(hits: readonly LandedHit[], fx: Pick<LogFixture, "hits">, kits: readonly OperatorKit[], casts: readonly ReplayedCast[]): Map<number, LandedHit> {
  const landed = new Map<number, LandedHit>();
  // A ref is a logged hit's index, or another landing's own (`listed:<n>`: a cast made from a hit's listed buff).
  for (const h of hits) if (h.ref !== undefined && /^\d+$/.test(h.ref)) landed.set(Number(h.ref), h);
  const eventsOf = new Map(kits.flatMap((k) => {
    const alternatives = alternativeEvents(k);
    return kitHitEntries(k).map((e): [string, readonly string[]] => [`${k.operator}|${e.skillId}|${e.hit.id}`, alternatives.get(e.hit) ?? e.hit.events]);
  }));
  // A recorded burst (Si's Artful Intent) is one landing per record, whatever its path: the replay's record may end
  // later or sooner than the game's (4e36: the log's burst 0.9 s after the replay's), so it looks further.
  const recorded = new Set<string>(kits.flatMap((k) => kitHitEntries(k).filter((e) => isRecordedBurst(e.hit)).map((e) => `${k.operator}|${e.skillId}|${e.hit.id}`)));
  const free = hits.filter((h) => h.ref === undefined && (h.facts || recorded.has(`${h.operator}|${h.skillId}|${h.hitId}`)));
  const taken = new Set<LandedHit>();
  for (const [i, h] of [...fx.hits.entries()].sort((a, b) => a[1].t - b[1].t)) {
    if (landed.has(i)) continue;
    const f = batchedFrame(casts, h) ?? frameOf(h.t);
    let best: LandedHit | null = null;
    for (const x of free) {
      const k = `${x.operator}|${x.skillId}|${x.hitId}`;
      if (taken.has(x) || x.operator !== h.operator || Math.abs(x.frame - f) > (recorded.has(k) ? RECORDED_NEAR_FRAMES : LANDING_NEAR_FRAMES) || !eventsOf.get(k)?.includes(h.event)) continue;
      if (!best || Math.abs(x.frame - f) < Math.abs(best.frame - f)) best = x;
    }
    if (best) {
      taken.add(best);
      landed.set(i, best);
    }
  }
  return landed;
}
