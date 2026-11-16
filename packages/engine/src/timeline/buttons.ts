// The skill buttons (docs/design.md "Rule-based rotations", the button model): what an operator's battle-skill, combo and
// ultimate button casts at a moment. A player presses a button, not a skill ID; the kits say which skills a button can
// cast (its kind's skills that aren't follow-ups: the game's skill slot, CharGrowthTable's groups plus what a
// ChangeSkillAction switches the slot to, data gameData.ts) and when each applies (its `available` condition: Si's
// battle button casts Artful Intent, Initial Stroke while Artful Intent is up, Final Stroke with Inksoul; Liino's
// becomes End Stance in her stances; Laevatain's changes in Twilight). A combo with a window of its own (Rossi's
// sequence 2) is on the button while that window is open.

import type { KitSkill } from "../model.ts";
import type { TimelineContext, TimelineState } from "./state.ts";
import { ownWindowSkills, skillAvailable, windowKey, windowOpen } from "./timing.ts";

/** The three skill buttons of an operator. */
export type SkillButton = "battle" | "combo" | "ultimate";

export const SKILL_BUTTONS: readonly SkillButton[] = ["battle", "combo", "ultimate"];

/** The skills a button can cast: its kind's kit skills that aren't follow-ups (cast only by their own skill), in kit order. */
export function buttonSkills(ctx: TimelineContext, operator: string, button: SkillButton): readonly KitSkill[] {
  return (ctx.kits.get(operator)?.skills ?? []).filter((s) => s.kind === button && !s.followUpOnly);
}

/**
 * What a button shows at a frame (the state advanced to it): the skills among buttonSkills whose kit `available`
 * holds then, and a combo with a window of its own only while that window is open. The kits make these exclusive, so
 * this is one skill or none (tests/policy.test.ts checks it at every frame of the example rule runs); several mean
 * the kits' conditions overlap there, and buttonSkill picks one.
 */
export function buttonShows(ctx: TimelineContext, state: TimelineState, operator: string, button: SkillButton, frame: number): readonly string[] {
  const own = ownWindowSkills(ctx, operator);
  return buttonSkills(ctx, operator, button)
    .filter((s) => (!own.has(s.skillId) || windowOpen(state, operator, windowKey(ctx, operator, s.skillId), frame)) && skillAvailable(ctx, state, operator, s.skillId, frame))
    .map((s) => s.skillId);
}

/**
 * The skill a button casts at a frame (the state advanced to it), or null when it shows none (greyed out). Where the
 * kits' conditions overlap (buttonShows gives several), the replacement comes first: a combo on a window of its own
 * (Rossi's sequence 2 while its window is open), then a skill with an `available` condition (Camille's Hunter Pursuit
 * while she hunts, over Heartstake Thorn, which has none), then kit order.
 */
export function buttonSkill(ctx: TimelineContext, state: TimelineState, operator: string, button: SkillButton, frame: number): string | null {
  const shows = buttonShows(ctx, state, operator, button, frame);
  if (shows.length <= 1) return shows[0] ?? null;
  const own = ownWindowSkills(ctx, operator);
  const rank = (id: string) => (own.has(id) ? 0 : ctx.kits.get(operator)?.skills.find((s) => s.skillId === id)?.available !== undefined ? 1 : 2);
  return shows.reduce((a, b) => (rank(b) < rank(a) ? b : a));
}
