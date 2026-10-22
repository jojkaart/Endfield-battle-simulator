// An operator build: everything that determines its stat panel. Plain data,
// so it can come from a JSON file, a fixture or (later) an account import.

import type { SkillType } from "./attributes.ts";

export interface GearPiece {
  readonly id: string;
  /** Artificing level 0–3 of stat lines 1–3. */
  readonly artifice: readonly [number, number, number];
}

export interface WeaponBuild {
  readonly id: string;
  readonly level: number;
  /** Levels of the weapon's skills in order (three; two for 3-star weapons; 1–9 for the stat skills). */
  readonly skillLevels: readonly number[];
}

export interface Build {
  readonly operator: string;
  readonly level: number;
  /** Promotion stage 0–4 (the tables' breakStage). */
  readonly promotion: number;
  /** Potential 0–5. */
  readonly potential: number;
  /**
   * How many attribute nodes are unlocked, in promotion order. Defaults to
   * every node available at this promotion.
   */
  readonly attributeNodes?: number;
  /** Level of each talent (index 0 = first talent). Defaults to the highest level available. */
  readonly talents?: readonly number[];
  /** Skill levels 1–12 (Rank 12 = M3). */
  readonly skillLevels: Readonly<Record<SkillType, number>>;
  readonly weapon: WeaponBuild | null;
  readonly gear: readonly GearPiece[];
  /**
   * A food buff's item ID (GameData.foods, UseItemTable), eaten before the
   * fight: its stats are panel lines for its duration from the fight's start.
   * One per operator, as in the game (every food shares one stacking key).
   */
  readonly food?: string;
}
