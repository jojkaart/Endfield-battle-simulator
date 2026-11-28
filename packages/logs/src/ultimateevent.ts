// Where in its stop a hitless ultimate's cast event lies (press or stop's end): the one reading the cast assembly
// (castassembly.ts loggedCastStart), the placement's stop list of unplaced cast events (logcasts.ts unplacedCastStops)
// and the replay view's EVENT line share. Split from castassembly.ts so that logcasts.ts, which castassembly.ts imports,
// can read it too.

import { FPS, type GameData, type SkillType } from "@efsim/engine";
import type { LogHit } from "./zmdlogs.ts";
import type { TimeStop } from "./logcasts.ts";

/**
 * The one reading of where in its stop a hitless ultimate's cast event lies (round 23, the break-combo report point 2:
 * "press or stop's end" was decided by three rules in two files): the start the cast assembly gives the cast
 * (loggedCastStart) and the rule that gave it, in words. The replay view's EVENT line prints the rule beside
 * query.ts castEventPlace's gaps; the placement's stop list of unplaced cast events (logcasts.ts unplacedCastStops)
 * starts each hitless ultimate's stop where it says.
 */
export function ultimateEventRead(data: GameData | undefined, lc: { readonly t: number; readonly operator: string; readonly skill: string }, kind: SkillType, hits: readonly LogHit[], stops: readonly TimeStop[]): { readonly start: number; readonly rule: string } {
  const at = (rule: string) => ({ start: lc.t, rule });
  if (!data || kind !== "ultimate") return at("not an ultimate: its event is its press");
  const stop = data.skills[lc.skill]?.timing?.slowdowns.find((d) => d.from === 0 && Math.min(...d.scales) === 0);
  if (!stop) return at("no time stop from its frame 0: its event is its press");
  const length = (stop.scales.length * 1000) / FPS;
  const [from, to] = [lc.t - length, lc.t];
  if (hits.some((h) => h.t > from + EDGE_MS && h.t < to - EDGE_MS)) return at("a logged hit inside the stop's length before it: its event is its press");
  // What waited out a time stop lands as it ends: another's hit at the event's own time (b6aa15281db4: Arcane's attack
  // 2 at 31027 ms) says the stop ended there (not the caster's own: d774d0ce7bd3, Zhuang Fangyi's sword at her ultimate),
  // and so does another's hit soon after it (RESUME_MS), which a stop starting at the event would have held: Laevatain's
  // ultimate, logged at its stop's end in every log (the last hit before it 2.0–2.9 s earlier, her stop 2.03 s), the team
  // resuming 83–356 ms after it in 012ae1c80ae6, c83c75d02a85, db8711232de9, e9896c8d02be, f8793bc8aea2, 2b013866dfa3.
  // Without one (e82d45c46040: Xaihi's at 3896 ms after 2315 ms, her Amp not yet on Arcane's hit at 7022 ms) the event is
  // the cast.
  // Another's hit inside the stop a start at the event would make says the same (458b03609665: Akekuri's at 84.37 s, the
  // team's next hits 1.20 s after it, inside the 1.83 s such a stop would hold; from the event her combo at 87.47 s, placed
  // from its landings, would come 44 frames inside the ultimate's uncuttable frames).
  if (!hits.some((h) => h.operator !== lc.operator && h.t >= lc.t - FLUSH_MS && h.t <= lc.t + Math.max(RESUME_MS, length - EDGE_MS))) return at("no other operator's hit at it or inside the stop a start there would make: its event is its press");
  const covering = stops.filter((x) => {
    if (x.operator === lc.operator) return false;
    const [a, b] = [(x.start * 1000) / FPS, ((x.start + x.scales.length) * 1000) / FPS];
    return Math.min(b, to) - Math.max(a, from) >= length / 2;
  });
  if (covering.length === 0) return { start: Math.round(from), rule: `at its stop's end (no hit in the ${(length / 1000).toFixed(2)} s before it, another's at it or inside the stop a start there would make): started ${(length / 1000).toFixed(2)} s before` };
  // Logged at the very end of the stop that covers it (within EDGE_MS), it waited for that stop's end to be logged, as a
  // press during a stop is: it was pressed inside that stop and ran beside it, its own stop overlapping (4d60e7fe92c2:
  // Zhuang Fangyi's at 157421 ms, Liino's stop ending at 157.47 s; her Empyrean basic attacks land from 158379 ms and
  // Liino's song beats at 158.66 and 160.03 s, which a stop of 2.6 s from the event would have held). It starts a frame
  // after the covering stop does, so that one's caster runs on to its own stop's end (clock.ts slowDown).
  const atEnd = covering.find((x) => Math.abs(((x.start + x.scales.length) * 1000) / FPS - lc.t) <= EDGE_MS);
  return atEnd ? { start: Math.max(Math.round(from), Math.round(((atEnd.start + 1) * 1000) / FPS)), rule: `at the end of ${atEnd.operator}'s ${atEnd.skillId} stop, which covers its own: pressed inside it, started a frame after it` } : at("inside another operator's stop that covers half of its own: its event is its press");
}

/** How close to a window's edges a logged hit may be and still not count as inside it (ms; loggedCastStart). */
const EDGE_MS = 100;
/** How close to a cast event a logged hit is at it (ms; loggedCastStart). */
const FLUSH_MS = 15;
/** How soon after an ultimate's cast event another's hit says the team resumed from its stop (ms; loggedCastStart). */
const RESUME_MS = 500;
