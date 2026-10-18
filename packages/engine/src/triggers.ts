// What a logged hit does to the enemy besides damage, for log replays: its
// own kit entry's effects, and every team member's hit triggers that react
// to it with applications or gains (e.g. Laevatain's talent: the controlled
// operator's Final Strikes absorb Heat Infliction for her Melting Flame).
// The timeline runs triggers itself (timeline.ts runTriggers); this is the
// part of them a replay of logged hits can use.

import type { SkillType } from "./attributes.ts";
import { causeMatches, eventMatches, type BattleEvent } from "./events.ts";
import type { Kits, KitHit, StackGain } from "./model.ts";
import type { HitApplication } from "./status.ts";

export interface HitEffect {
  /** Whose stacks the gains go to. */
  readonly owner: string;
  readonly applies: readonly HitApplication[];
  readonly gains: readonly StackGain[];
  /** The hit's own entry (its skill values resolve forced-reaction keys), or a team member's trigger. */
  readonly own: boolean;
}

/**
 * In order: the hit's own effects, then each team member's hit triggers
 * (team order). Triggers' `if`, cooldowns and count limits aren't judged
 * (a replay has no situation to judge them in). Only the controlled operator
 * does basic attacks, so a basic hit counts as the controlled operator's.
 */
export function hitEffects(kits: Kits, team: readonly string[], hitter: string, hit: KitHit, skillId = "", kind: SkillType = hit.damageType): HitEffect[] {
  const out: HitEffect[] = [];
  if (hit.applies?.length || hit.gains?.length) out.push({ owner: hitter, applies: hit.applies ?? [], gains: hit.gains ?? [], own: true });
  const e: BattleEvent = { type: "hit", frame: 0, operator: hitter, skillId, kind, element: hit.element, finalStrike: hit.finalStrike === true, controlled: kind === "basic" };
  for (const member of team) {
    for (const t of kits.operators[member]?.triggers ?? []) {
      if (!eventMatches(t.on, e, member, {}) || !causeMatches(t.by, e, member)) continue;
      const applies = t.do.flatMap((a) => (a.kind === "apply" ? a.applies : []));
      const gains = t.do.flatMap((a) => (a.kind === "gain" ? a.gains : []));
      if (applies.length || gains.length) out.push({ owner: member, applies, gains, own: false });
    }
  }
  return out;
}
