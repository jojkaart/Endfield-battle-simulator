// Arts reactions and their statuses: one implementation for every operator
// (design principle 15). Values aren't in the tables rmxlinux has (the
// buff files assign them at runtime), so they live here with their sources,
// each verified against logged hits (fixtures/zmdlogs-*.json).

import type { Element } from "./attributes.ts";
import type { Modifier } from "./effects.ts";

export type ArtsElement = Exclude<Element, "physical" | "ether">;

export type ReactionKind =
  /** Two inflictions of the same element. */
  | "burst"
  /** An infliction meeting a different element: Combustion (Heat), Electrification (Electric), Solidification (Cryo), Corrosion (Nature). */
  | "reaction"
  /** A tick of Combustion's burning. */
  | "combustionTick";

/**
 * Base multipliers. Talos Wiki, GameKee, 666bj agree; verified on
 * btl_upload_40d9a3c1da37: burst 160% (Laevatain and Camille), Heat + Nature
 * reaction at 1 stack 160%, burning tick at level 1 24%.
 */
export function reactionBase(kind: ReactionKind, stacks: number): number {
  if (kind === "burst") return 1.6;
  if (kind === "reaction") return 0.8 + 0.8 * stacks;
  return 0.12 + 0.12 * stacks;
}

/** Operator level scaling of arts reactions and bursts: 1 + (Lv − 1) / 196 (verified: Lv90 → 1.4541). */
export function artsLevelCoefficient(level: number): number {
  return 1 + (level - 1) / 196;
}

/** Arts Intensity on reaction and burst damage: × (1 + AI / 100). */
export function artsIntensityDamage(ai: number): number {
  return 1 + ai / 100;
}

/** Arts Intensity on Corrosion, Breach and Electrification strength: × (1 + 2·AI / (AI + 300)), approaching ×3. */
export function artsIntensityEffect(ai: number): number {
  return 1 + (2 * ai) / (ai + 300);
}

/**
 * Corrosion's resistance shred t ms after it was applied, by level 1–4:
 * initial 3.6 / 4.8 / 6 / 7.2, +0.84 / 1.12 / 1.4 / 1.68 per full second, up
 * to 12 / 16 / 20 / 24 points, all × artsIntensityEffect(applier's AI).
 * Source: formula research (docs/data-sources.md#consensus) from BuffData
 * keys and the Talos Wiki. Tick timing (whole seconds) is an assumption the
 * log fixtures check.
 */
export function corrosionShred(level: number, elapsedMs: number, applierAi: number): number {
  const i = level - 1;
  const initial = [3.6, 4.8, 6, 7.2][i];
  const perSecond = [0.84, 1.12, 1.4, 1.68][i];
  const max = [12, 16, 20, 24][i];
  if (initial === undefined || perSecond === undefined || max === undefined) throw new RangeError(`Corrosion level ${level}`);
  const base = Math.min(max, initial + perSecond * Math.floor(Math.max(0, elapsedMs) / 1000));
  return base * artsIntensityEffect(applierAi);
}

/** Corrosion as a modifier: its shred adds back resistance points for every element (Physical included). */
export function corrosionModifier(level: number, elapsedMs: number, applierAi: number): Modifier {
  return { zone: "ignoreResistance", value: corrosionShred(level, elapsedMs, applierAi), source: `Corrosion level ${level}` };
}

/**
 * Reaction damage element and kind from a log event key like
 * buff_common_fire_natural_triggered (burst when both are the same). Newer
 * logs also have buff_common_<element>_triggered (Arcane's Nature onto Cryo,
 * btl_upload_bdf223db8e49), but its damage is ×1.42–1.43 of a level I
 * reaction in both logs seen, so it isn't treated as one until explained.
 */
export function parseReactionEvent(event: string): { kind: ReactionKind; element: ArtsElement } | null {
  if (event === "buff_common_burning_status") return { kind: "combustionTick", element: "fire" };
  const m = /^buff_common_(fire|natural|pulse|cryst)_(fire|natural|pulse|cryst)_triggered$/.exec(event);
  if (!m) return null;
  const [, a, b] = m as unknown as [string, ArtsElement, ArtsElement];
  return { kind: a === b ? "burst" : "reaction", element: a };
}
