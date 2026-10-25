// The timeline's fixed rules: team SP, ultimate energy, combo windows, dives, priorities, Link, and what v1 assumes.

import { EngineError } from "../errors.ts";
import type { SkillTiming } from "../model.ts";
import { FPS } from "../units.ts";
import { DIVE_MOTION } from "../constants.ts";

/**
 * Team SP. Values from Endaxis's notes on the native skill settings (team SP
 * max 300, start 200, 8 per second, regen paused 1.5 s after spending);
 * Zero Sanity uses a continuous 7.69/s instead. Not yet checked against a
 * fixture.
 */
export const SP = { max: 300, start: 200, perSecond: 8, pauseAfterSpendFrames: 45 } as const;

/**
 * Ultimate energy and combo windows (Endaxis's native skill settings and
 * Zero Sanity agree; docs/data-sources.md): a battle skill gives every team
 * member 0.065 energy per natural (not returned) SP spent; combo windows stay
 * open 6 s after their trigger.
 */
export const ENERGY = { perNaturalSp: 0.065 } as const;
export const COMBO_WINDOW_FRAMES = 6 * FPS;

/** A dive's frames from its jump (diveFrames). */
export const DIVE = diveFrames();

/** What v1 doesn't model; returned with every result so numbers aren't over-trusted. */
export const TIMELINE_ASSUMPTIONS = [
  "Ultimate energy: max = the ultimate's cost, no passive gain; battle skills give the team 0.065 per natural SP spent (at the cast); kits list their fixed grants. Grants are scaled by Ultimate Gain Efficiency.",
  "Combo skills open a 6 s window on their kit's trigger (ignored while on cooldown); kits without a trigger allow the combo whenever off cooldown.",
  "When the next action may start comes from SkillData (windows, priorities, exclusive time, cantCastSkill channels); basic attacks need the operator to be the controlled one. A swap costs no time and waits only for a cantSwitchPosition channel.",
  `Dives: a rotation's dive (the operator's plunging_attack_end) is a jump by the controlled operator, which may interrupt its current skill as a plunging attack may; the fall (plunging_attack_start) starts ${DIVE.rise} frames later and the landing ${DIVE.fall} after that (the native movement settings as Endaxis reads them; unverified). In the air the operator neither casts nor dodges.`,
  "Projectile hits land at the frames their kit gives (travel time isn't in the data; kits read it from logs where they can).",
  "SP gain: a skill's blackboard value `atb` (e.g. a final strike's 20) is added when its first hit lands (unverified timing).",
  "Buffs and debuffs from skills apply only where a kit declares them (OperatorKit.buffs); always-on conditions, given modifiers and the enemy's reaction statuses apply too.",
  "Inflictions and reactions follow the Talos Wiki rules (status.ts). What a hit applies takes effect before its own damage and the reaction's initial hit (logs: Gilberta's explosion and Arcane's battle skill include the Corrosion they trigger), unless its kit says afterDamage; buff modifiers' conditions on the enemy see it too.",
  "Physical statuses (Vulnerable, Lift, Knock Down, Crush, Breach), Shatter and stagger follow the Talos Wiki tutorial tables (status.ts). Hit-stop and entity-layer slow-downs aren't modelled.",
  "One enemy; every hit lands on it.",
  `Team SP: max ${SP.max}, start ${SP.start}, ${SP.perSecond}/s, paused ${SP.pauseAfterSpendFrames / FPS} s after spending (unverified).`,
] as const;

/**
 * Who may interrupt whom (Endaxis's native-type priorities, docs/design.md
 * "Skill timing"): a skill of higher priority may start at any frame of the
 * current one; plunging attacks always. By SkillData skillSpecification.
 */
const PRIORITY: Readonly<Record<number, number>> = { 1: 1, 3: 2, 8: 2, 4: 5, 5: 7 };

export const priorityOf = (t: SkillTiming) => (t.specification === 6 ? Infinity : (PRIORITY[t.specification] ?? 2));

/** The current action of an operator that perfectly dodged: the perfect-dodge skill (skillSpecification 2). */
export const DODGE = "dodge";

/** The current action of an operator that jumped for a dive, until its fall (the dive's start skill) or landing replaces it (jumpToDive). */
export const JUMP = "jump";

/**
 * A dive's frames from its jump (DIVE_MOTION): `rise` until the plunge
 * starts (the first frame the operator is high enough), then `fall` until
 * the landing skill starts: the start segment, then the frames down at
 * downSpeed (in the first one the speed ramps up from rest, as the native
 * mover averages a frame's start and end speeds, so it covers half a
 * frame's distance).
 */
export function diveFrames(m: { readonly maxJumpHeight: number; readonly gravity: number; readonly minHeight: number; readonly startSeconds: number; readonly downSpeed: number } = DIVE_MOTION): { readonly rise: number; readonly fall: number } {
  if (!(m.gravity > 0 && m.downSpeed > 0 && m.minHeight > 0 && m.minHeight <= m.maxJumpHeight && m.startSeconds >= 0)) throw new EngineError("a dive needs a reachable plunge height and positive speeds");
  const v0 = Math.sqrt(2 * m.gravity * m.maxJumpHeight);
  const height = (t: number) => v0 * t - (m.gravity * t * t) / 2;
  let rise = 1;
  while (height(rise / FPS) < m.minHeight) rise++;
  const step = m.downSpeed / FPS;
  const h = height(rise / FPS);
  const down = h <= step / 2 ? 1 : 1 + Math.ceil((h - step / 2) / step);
  // The start segment ends on the frame its time reaches startSeconds (a hair under: 0.633 s is 18.99 frames).
  return { rise, fall: Math.ceil(m.startSeconds * FPS - 1e-9) + down };
}

/** How long a Link stack lasts (buff_common_affixes_combo_trigger duration 15 s). */
export const LINK_FRAMES = 15 * FPS;

/** Link's multiplier (zone multiplicative) on the hits of a battle skill or ultimate that uses n stacks (1–4): +30/45/60/75% / +20/30/40/50%. */
export function linkValue(kind: "battle" | "ultimate", n: number): number {
  return kind === "battle" ? 0.15 + 0.15 * n : 0.1 + 0.1 * n;
}

/** How long a chain survives a skill that doesn't interrupt it, after that skill's exclusive time. */
export const CHAIN_CACHE_FRAMES = 30;
