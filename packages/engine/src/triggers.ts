// What a landing hit does besides damage: its own kit entry's effects, and
// the team triggers of every operator in the team that react to it (e.g.
// Laevatain's talent: the controlled operator's Final Strikes absorb Heat
// Infliction for her Melting Flame). The timeline and the log replay both
// use this, so one hit means the same in both.

import type { Kits, KitHit, StackGain } from "./model.ts";
import type { HitApplication } from "./status.ts";

export interface HitEffect {
  /** Whose stacks the gains go to. */
  readonly owner: string;
  readonly applies: readonly HitApplication[];
  readonly gains: readonly StackGain[];
  /** The hit's own entry (its skill values resolve forced-reaction keys), or a teammate's trigger. */
  readonly own: boolean;
}

/** In order: the hit's own effects, then each team member's triggers (team order). */
export function hitEffects(kits: Kits, team: readonly string[], hitter: string, hit: KitHit): HitEffect[] {
  const out: HitEffect[] = [];
  if (hit.applies?.length || hit.gains?.length) out.push({ owner: hitter, applies: hit.applies ?? [], gains: hit.gains ?? [], own: true });
  if (!hit.finalStrike) return out;
  for (const member of team) {
    for (const t of kits.operators[member]?.teamTriggers ?? []) {
      if (t.on === "finalStrike") out.push({ owner: member, applies: t.applies, gains: t.gains ?? [], own: false });
    }
  }
  return out;
}
