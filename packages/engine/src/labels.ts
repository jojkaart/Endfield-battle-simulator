// Stat lines as the game shows them: attribute names in the game's English (Intellect, not Wisd) and a gear or buff
// line's size with its unit, so reports don't each keep a label map (cli gear.ts, edge.ts; diagnose.ts and
// gearrules.ts still have their own: phase 2's to switch).

import { Attr, attrName, type AttrType } from "./attributes.ts";
import { Slot, Target } from "./model.ts";

/** The game's names of the attributes reports show; others fall back to the internal name (attrName). */
export const ATTR_LABELS: Readonly<Record<number, string>> = {
  [Attr.Str]: "Strength",
  [Attr.Agi]: "Agility",
  [Attr.Wisd]: "Intellect",
  [Attr.Will]: "Will",
  [Attr.Atk]: "ATK",
  [Attr.CriticalRate]: "Crit Rate",
  [Attr.CriticalDamageIncrease]: "Crit DMG",
  [Attr.UltimateSpGainScalar]: "Ultimate Gain Efficiency",
  [Attr.PhysicalAndSpellInflictionEnhance]: "Arts Intensity",
  [Attr.PhysicalDamageIncrease]: "Physical DMG",
  [Attr.FireDamageIncrease]: "Heat DMG",
  [Attr.PulseDamageIncrease]: "Electric DMG",
  [Attr.CrystDamageIncrease]: "Cryo DMG",
  [Attr.NaturalDamageIncrease]: "Nature DMG",
  [Attr.NormalAttackDamageIncrease]: "Basic Attack DMG",
  [Attr.NormalSkillDamageIncrease]: "Battle Skill DMG",
  [Attr.ComboSkillDamageIncrease]: "Combo Skill DMG",
  [Attr.UltimateSkillDamageIncrease]: "Ultimate DMG",
  [Attr.DamageToBrokenUnitIncrease]: "DMG to Staggered",
};

/** An attribute's name as the game shows it. */
export function attrLabel(attr: AttrType): string {
  return ATTR_LABELS[attr] ?? attrName(attr);
}

const ATTRIBUTES: readonly number[] = [Attr.Str, Attr.Agi, Attr.Wisd, Attr.Will];

/**
 * A stat line (attribute, formula slot, target, value) as the game shows it: "main attribute +32", "Arts Intensity
 * +20", "Crit Rate +5.0%". Target 1 / 2 is the operator's main / secondary attribute; slot 6 is a percentage, and an
 * added line below 1.5 of anything but an attribute or Arts Intensity is a fraction shown as one.
 */
export function statLabel(attr: AttrType, slot: number, target: number, value: number): string {
  const who = target === Target.MainAttribute ? "main attribute" : target === Target.SecondaryAttribute ? "secondary attribute" : attrLabel(attr);
  const percent = slot === Slot.Percent || (slot === Slot.Add && value < 1.5 && attr !== Attr.PhysicalAndSpellInflictionEnhance && target === Target.AsWritten && !ATTRIBUTES.includes(attr));
  return `${who} +${percent ? `${(value * 100).toFixed(1)}%` : Math.round(value)}`;
}
