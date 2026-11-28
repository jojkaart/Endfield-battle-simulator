// The logged facts a replay's landings didn't take (round 24, the combo-openers report point 1: re-pinning the
// openers at the press frame dropped Estella's Cryst reaction's logged crit, 9168 against the logged 13752, with no
// warning; the measure was the first signal and a `cli-ab --zones` run and a read of landing.ts found why). The engine
// gives a landing the log's crit by its pinned hit's ref, else by a logged hit of its operator and key within a frame
// (landing.ts loggedCritAt), and a reaction the log's level within a frame of the replay's landing a pass before
// (withLoggedReactionLevel, logcheck.ts loggedReactionLevels): a landing moved more than a frame takes neither, and
// nothing in the run says so. LOST decision lines (decisionsview.ts, with the fixture): a logged hit whose crit the log
// (or an inference: replaycrits.ts) gives, paired with a landing that didn't take it; a reaction level no reaction
// landing took. `zmdlogs decisions --assume` and measure's decision counts then show a rule that drops them.

import { FPS, parseReactionEvent } from "@efsim/engine";
import type { BuffReplay } from "./buffreplay.ts";
import type { LogFixture, LogHit } from "./zmdlogs.ts";

/** How far (frames) a landing may be from its logged hit and still take its frame-keyed facts (landing.ts: a frame either side). */
export const FACT_NEAR_FRAMES = 1;

/** A logged fact no landing took: a hit's crit (its landing's frame) or a reaction level (its frame, operator and element). */
export type LostFact =
  | { readonly fact: "crit"; readonly hit: LogHit; readonly source: ReturnType<BuffReplay["critSource"]>; readonly landing: number }
  | { readonly fact: "level"; readonly frame: number; readonly operator: string; readonly element: string; readonly level: number };

const frameOf = (ms: number) => Math.round((ms * FPS) / 1000);

/**
 * The logged facts the replay's landings didn't take: each logged hit with a crit the replay reads (the log's flag or an
 * inference: BuffReplay.critSource) whose landing (the check's pairing) has no logged crit (a kit hit's
 * LandedHit.loggedCrit) or, a status landing, sits more than FACT_NEAR_FRAMES from it; each reaction level the replay
 * was made with (BuffReplay.reactionLevels) with no reaction landing of its operator and element within FACT_NEAR_FRAMES.
 */
export function lostFacts(fx: Pick<LogFixture, "hits">, replay: Pick<BuffReplay, "landing" | "statusLanding" | "critSource" | "hits" | "reactionLevels">): LostFact[] {
  const out: LostFact[] = [];
  for (const h of fx.hits) {
    const source = replay.critSource(h);
    if (h.crit === null && (source === "none" || source === "log")) continue;
    const status = parseReactionEvent(h.event) !== null;
    const l = status ? replay.statusLanding(h) : replay.landing(h);
    if ("unknown" in l) continue;
    const took = status ? Math.abs(l.frame - frameOf(h.t)) <= FACT_NEAR_FRAMES : l.loggedCrit !== undefined && l.loggedCrit !== null;
    if (!took) out.push({ fact: "crit", hit: h, source: h.crit !== null ? "log" : source, landing: l.frame });
  }
  for (const v of replay.reactionLevels) {
    const near = replay.hits.some((x) => x.skillId === "reaction:reaction" && x.operator === v.operator && x.element === v.element && Math.abs(x.frame - v.frame) <= FACT_NEAR_FRAMES);
    if (!near) out.push({ fact: "level", frame: v.frame, operator: v.operator, element: v.element, level: v.level });
  }
  return out;
}
