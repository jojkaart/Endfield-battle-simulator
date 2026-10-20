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
  | "combustionTick"
  /** Physical statuses' hits (Physical; level = Vulnerable stacks consumed for Crush and Breach). */
  | "lift"
  | "knockdown"
  | "crush"
  | "breach"
  /** Solidification shattered by a physical status (Physical; level = Solidification's). */
  | "shatter";

/**
 * Base multipliers. Talos Wiki, GameKee, 666bj agree; verified on
 * btl_upload_40d9a3c1da37: burst 160% (Laevatain and Camille), Heat + Nature
 * reaction at 1 stack 160%, burning tick at level 1 24%.
 */
export function reactionBase(kind: ReactionKind, stacks: number): number {
  if (kind === "burst") return 1.6;
  if (kind === "reaction") return 0.8 + 0.8 * stacks;
  if (kind === "combustionTick") return 0.12 + 0.12 * stacks;
  // Physical statuses (docs/data-sources.md "Consensus"; the in-game tutorial's tables, below).
  if (kind === "lift" || kind === "knockdown") return 1.2;
  const table = kind === "crush" ? CRUSH : kind === "breach" ? BREACH : SHATTER;
  const v = table[stacks - 1];
  if (v === undefined) throw new RangeError(`${kind} level ${stacks}`);
  return v;
}

/** By level 1–4: Crush 150% + 150% per Vulnerable stack, Breach 50% + 50%, Shatter 120% + 120% per Solidification level. */
const CRUSH = [3, 4.5, 6, 7.5] as const;
const BREACH = [1, 1.5, 2, 2.5] as const;
const SHATTER = [2.4, 3.6, 4.8, 6] as const;

/** Physical statuses' hits scale with operator level by 1 + (Lv − 1) / 392; Shatter, like arts reactions, by / 196. */
export function levelCoefficientOf(kind: ReactionKind, level: number): number {
  return kind === "lift" || kind === "knockdown" || kind === "crush" || kind === "breach" ? 1 + (level - 1) / 392 : artsLevelCoefficient(level);
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
 * log fixtures check. `capScale` raises the cap (an applier's talent, e.g.
 * Arcane's `corrupt_rate`); `scale` multiplies the whole shred (start, per
 * second and cap: a forced Corrosion's `extra_scaling`,
 * buff_common_natural_natural_corrupt_triggered).
 */
export function corrosionShred(level: number, elapsedMs: number, applierAi: number, capScale = 1, scale = 1): number {
  const i = level - 1;
  const initial = [3.6, 4.8, 6, 7.2][i];
  const perSecond = [0.84, 1.12, 1.4, 1.68][i];
  const max = [12, 16, 20, 24][i];
  if (initial === undefined || perSecond === undefined || max === undefined) throw new RangeError(`Corrosion level ${level}`);
  const base = Math.min(max * capScale, initial + perSecond * Math.floor(Math.max(0, elapsedMs) / 1000));
  return base * scale * artsIntensityEffect(applierAi);
}

/** Corrosion as a modifier: its shred adds back resistance points for every element (Physical included). */
export function corrosionModifier(level: number, elapsedMs: number, applierAi: number, capScale = 1, scale = 1): Modifier {
  return { zone: "ignoreResistance", value: corrosionShred(level, elapsedMs, applierAi, capScale, scale), source: `Corrosion level ${level}` };
}

/** Log keys of physical-status hits and Shatter (the BuffData files holding their damage). */
const PHYSICAL_EVENT_KINDS: Readonly<Record<string, ReactionKind>> = {
  buff_physical_airborne: "lift",
  buff_physical_knockdown: "knockdown",
  buff_physical_do_crushed: "crush",
  // Logs name Crush's hits after the status buff (the Endministrator's log 7e19489ae503).
  buff_physical_crushed: "crush",
  buff_physical_do_fracture: "breach",
  buff_common_cryst_triggered_physical_break: "shatter",
};

/**
 * Reaction damage element and kind from a log event key like
 * buff_common_fire_natural_triggered (burst when both are the same). Newer
 * logs also have buff_common_<element>_triggered (Arcane's Nature onto Cryo,
 * btl_upload_bdf223db8e49), but its damage is ×1.42–1.43 of a level I
 * reaction in both logs seen, so it isn't treated as one until explained.
 */
export function parseReactionEvent(event: string): { kind: ReactionKind; element: Element } | null {
  if (event === "buff_common_burning_status") return { kind: "combustionTick", element: "fire" };
  const physical = PHYSICAL_EVENT_KINDS[event];
  if (physical) return { kind: physical, element: "physical" };
  const m = /^buff_common_(fire|natural|pulse|cryst)_(fire|natural|pulse|cryst)_triggered$/.exec(event);
  if (!m) return null;
  const [, a, b] = m as unknown as [string, ArtsElement, ArtsElement];
  return { kind: a === b ? "burst" : "reaction", element: a };
}
