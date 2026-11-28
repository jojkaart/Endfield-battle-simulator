// How each logged hit's replay landing moved between two replays of one log (two codes, or two readings): the hit lost
// its landing (and the step that dropped it, the replay view's NOLAND text), gained one, took a landing another logged
// hit had before (a slot shift: the placement or the replay's pinned landings moved by one), or was paired with a
// landing neither side's other hits had. Round 23 (the combo-hold report point 1): every operator-clock reading measured
// neutral-to-worse because the replay pins its landings to the logged hits, so a hold moves only what isn't pinned (a
// stack whose `if` then failed); `measure --hits` and `zmdlogs hits --against` showed the changed classes, not that a
// landing went missing and the later slots shifted, nor why. These lines say it at the first measure.
import { secondsOf } from "@efsim/engine";

/**
 * A logged hit's landing as both sides record it: `<frame> <skill> <hit>` (the paired landing), `NOLAND <reason>[: <the
 * step that dropped it>]` where the replay has none, or undefined where the code can't say.
 */
export type LandingMark = string | undefined;

/** The words for one hit's landing change, and its kind for the counts. */
export interface LandingMove {
  readonly index: number;
  readonly kind: string;
  readonly words: string;
}

const isNoLand = (m: LandingMark): boolean => m !== undefined && m.startsWith("NOLAND ");
/** A NOLAND mark's reason with its JSON details folded (`KitHit.if {…} didn't hold`), for the counts' kind. */
export const noLandReason = (m: string): string => m.slice("NOLAND ".length).replace(/\{[^{}]*\}/g, "{…}");

/** A landing mark in words (`frame 1234 (41.13 s) combo_skill hit_2`, or the NOLAND reason). */
function markWords(m: string): string {
  if (isNoLand(m)) return `none (${noLandReason(m)})`;
  const [frame, skill, hit] = m.split(" ");
  const f = Number(frame);
  return `${(skill ?? "").replace(/^chr_\d+_[a-z0-9]+_/, "")} ${hit ?? ""} at ${Number.isFinite(f) ? secondsOf(f).toFixed(2) : frame} s`;
}

/**
 * Per hit (by index: both sides list the same logged hits in the same order), how its landing moved, for the hits whose
 * landing changed and both sides can say: `lost` (a landing before, none now: the kind names the reason), `gained`,
 * `took another logged hit's landing` (its landing now is one another logged hit was paired with before: a shift),
 * `paired with another landing`.
 */
export function landingMoves(before: readonly LandingMark[], after: readonly LandingMark[]): LandingMove[] {
  const owner = new Map<string, number>();
  for (const [i, m] of before.entries()) if (m !== undefined && !isNoLand(m)) owner.set(m, i);
  const out: LandingMove[] = [];
  for (let i = 0; i < Math.min(before.length, after.length); i++) {
    const [a, b] = [before[i], after[i]];
    if (a === undefined || b === undefined || a === b) continue;
    if (isNoLand(a) && isNoLand(b)) {
      out.push({ index: i, kind: `no landing, another reason: ${noLandReason(b)}`, words: `no landing: ${noLandReason(a)} → ${noLandReason(b)}` });
    } else if (isNoLand(b)) {
      out.push({ index: i, kind: `lost its landing: ${noLandReason(b).replace(/(?<![\w.])\d+(?:\.\d+)?/g, "…")}`, words: `lost its landing (${markWords(a)}): ${noLandReason(b)}` });
    } else if (isNoLand(a)) {
      out.push({ index: i, kind: "gained a landing", words: `gained a landing: ${markWords(b)} (before: ${noLandReason(a)})` });
    } else {
      const j = owner.get(b);
      out.push(j !== undefined && j !== i ? { index: i, kind: "took another logged hit's landing (a shift)", words: `took the landing logged hit #${j + 1} had (${markWords(b)}; its own was ${markWords(a)})` } : { index: i, kind: "paired with another landing", words: `landing ${markWords(a)} → ${markWords(b)}` });
    }
  }
  return out;
}

/** The moves counted by kind, largest first, as one line's tail: `lost its landing: … 3, took another logged hit's landing (a shift) 5`. */
export function landingMoveCounts(moves: readonly LandingMove[]): string {
  const n = new Map<string, number>();
  for (const m of moves) n.set(m.kind, (n.get(m.kind) ?? 0) + 1);
  return [...n].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([k, c]) => `${k} ${c}`).join("; ");
}
