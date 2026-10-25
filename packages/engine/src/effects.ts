// One representation for everything that changes a hit's damage: stat panel
// attributes, kit and equipment buffs, buffs from a battle log, and the
// timeline's buffs. All of them become Modifiers, and one function sums
// them per zone, so effects that do the same thing share one implementation
// (design principle 15).

import { Attr, ELEMENTS, SKILL_TYPES, type AttrType, type Element, type SkillType } from "./attributes.ts";
import type { Predicate } from "./expr.ts";

/**
 * Damage zones. Semantics verified against ZMDLogs, which logs every buff by
 * zone (fixtures/zmdlogs-*.json):
 * - atk: adds to ATK% before the attribute bonus;
 * - damageBonus: additive damage bonus (element, skill type, vs staggered, …);
 * - amp: 1 + Σ;
 * - susceptibility (ZMDLogs `fragile`): 1 + Σ, separate;
 * - damageTaken (ZMDLogs `vuln_taken`): 1 + Σ, separate;
 * - multiplicative (ZMDLogs `prod_vuln_taken`): each × (1 + v);
 * - ignoreResistance (ZMDLogs `res`): resistance points added back;
 * - critRate, critDamage: the crit zone's inputs;
 * - artsIntensity (ZMDLogs `arts_strength`): Arts Intensity points; acts on
 *   reactions and statuses only, not on direct hits;
 * - attribute: points of Strength, Agility, Intellect or Will (`attr`) a
 *   buff adds, or a percentage of the panel line (`percent`), which raise
 *   ATK's attribute bonus as the stat panel computes it (stats.ts
 *   atkAttributeBonus). Not a kit zone: buffs write the attribute
 *   (KitBuffModifier.attr), and buffModifiers turns it into this.
 */
export const ZONES = [
  "atk",
  "damageBonus",
  "amp",
  "susceptibility",
  "damageTaken",
  "multiplicative",
  "ignoreResistance",
  "critRate",
  "critDamage",
  "artsIntensity",
  "attribute",
] as const;
export type Zone = (typeof ZONES)[number];

/**
 * The attacker's side of the pipeline, which periodic damage with an ATK
 * snapshot (DamageAction `takeAtkSnapshot`: Combustion, Rossi's bleed) keeps
 * from when it was applied; the defender's side (Susceptibility, DMG Taken,
 * the multiplicative zone, resistance) is read at each tick. Evidence:
 * fixtures/zmdlogs-4e5e1390085e.json, Camille's Combustion (65097 ms): its
 * ticks at 66004, 67447 and 68449 ms match only with her DMG bonuses at the
 * reaction (Lustrous Carmine's Heat DMG, logged at the reaction, gone from
 * the ticks; a talent-1 layer gone by the last), while the third is ×1.3
 * the first by the Stagger that started between them;
 * fixtures/zmdlogs-40d9a3c1da37.json 18684 ms: a tick after the Arts
 * Susceptibility ended is lower by exactly that. ATK and Amp are on the same
 * side (not in those logs: in-game test 77 decides ATK); crit doesn't act on
 * ticks.
 */
export const SNAPSHOT_ZONES: ReadonlySet<Zone> = new Set(["atk", "attribute", "damageBonus", "amp", "critRate", "critDamage", "artsIntensity"]);

/** What kind of damage a hit is: its skill type, or a reaction kind for reaction damage. */
/** `none`: a hit of no skill type (some triggered hits, e.g. from weapons or gear sets). */
export type HitKind = SkillType | "none" | "burst" | "reaction" | "combustionTick" | "lift" | "knockdown" | "crush" | "breach" | "shatter";

/**
 * A landing's decorations (SkillData decorate-mask bits): a Final Strike
 * (2097152), a finisher's (4: its skill is of skillSpecification 8), a dive
 * attack's (1024). Hit triggers and buff modifiers can ask for any of them.
 */
export type HitDecoration = "finalStrike" | "finisher" | "dive";

export interface Modifier {
  readonly zone: Zone;
  readonly value: number;
  /** Only hits of this element; any element when absent. */
  readonly element?: Element;
  /** Only hits counting as this skill type; any when absent. */
  readonly skillType?: SkillType;
  /** Only against a staggered target. */
  readonly staggeredOnly?: boolean;
  /** Only hits of these kinds (the game's decorate-mask conditions, e.g. bursts only). */
  readonly onlyKinds?: readonly HitKind[];
  /** Only landings with any of these decorations (KitBuffModifier.decorations: Last Rite's Final-Strike bonus). */
  readonly decorations?: readonly HitDecoration[];
  /** Only while this holds at the hit, for the hitter (its target's state: Fluorite's DMG against Slowed enemies); judged by the damage pipeline. */
  readonly when?: Predicate;
  /** Zone `attribute`: the attribute (Strength, Agility, Intellect, Will) it adds to… */
  readonly attr?: AttrType;
  /** …as a percentage of the hitter's panel line (KitBuffModifier.percent) instead of points. */
  readonly percent?: true;
  readonly source: string;
}

/** What a modifier is matched against. */
export interface HitContext {
  readonly element: Element;
  /** Null for damage that isn't a skill's, e.g. reactions: skill-type bonuses don't apply. */
  readonly skillType: SkillType | null;
  readonly staggered: boolean;
  /** Unknown when absent: kind-limited modifiers then don't apply. */
  readonly kind?: HitKind;
  /** The landing's decorations; none when absent (decoration-limited modifiers then don't apply). */
  readonly decorations?: readonly HitDecoration[];
}

type Mapping = Omit<Modifier, "value" | "source">;

/** Which zone each damage-relevant attribute feeds. Attributes not listed don't affect a hit directly. */
const ATTR_ZONES = new Map<AttrType, Mapping>([
  [Attr.CriticalRate, { zone: "critRate" }],
  [Attr.CriticalDamageIncrease, { zone: "critDamage" }],
  [Attr.PhysicalAndSpellInflictionEnhance, { zone: "artsIntensity" }],
  [Attr.NormalAttackDamageIncrease, { zone: "damageBonus", skillType: "basic" }],
  [Attr.NormalSkillDamageIncrease, { zone: "damageBonus", skillType: "battle" }],
  [Attr.ComboSkillDamageIncrease, { zone: "damageBonus", skillType: "combo" }],
  [Attr.UltimateSkillDamageIncrease, { zone: "damageBonus", skillType: "ultimate" }],
  [Attr.DamageToBrokenUnitIncrease, { zone: "damageBonus", staggeredOnly: true }],
  ...ELEMENTS.flatMap((element, i): [AttrType, Mapping][] => [
    [Attr.PhysicalDamageIncrease + i, { zone: "damageBonus", element }],
    [Attr.PhysicalEnhancedDmgIncrease + i, { zone: "amp", element }],
    [Attr.PhysicalVulnerableDmgIncrease + i, { zone: "susceptibility", element }],
  ]),
]);

/**
 * Attributes a kit buff may carry that don't act on hits directly: the
 * engine reads them where the game does (Haste 92, Ultimate Gain Efficiency
 * 44, SP cost 45, combo cooldown recovery 93). Anything else would load and do nothing (ATK 2 is the `atk` zone).
 */
export const READ_ATTRS: ReadonlySet<AttrType> = new Set([
  Attr.KeywordSpeedUpScalar,
  Attr.UltimateSpGainScalar,
  // SP cost of the owner's skills (added at the cast) and its combo cooldown's recovery rate (over time): the timeline.
  Attr.AtbCostAddition,
  Attr.ComboSkillCooldownRecoveryScalar,
  // Read by `attr` values and `attrAtLeast`; the four attributes also raise ATK through its attribute bonus (zone `attribute`).
  Attr.Def,
  Attr.Str,
  Attr.Agi,
  Attr.Wisd,
  Attr.Will,
  // Read by the timeline's buff categories (Weakness, Protection) for buffApplied triggers; no damage effect (enemy damage isn't simulated).
  Attr.WeaknessDmgScalar,
  Attr.ShelterDmgScalar,
  // Stagger efficiency (PoiseDamageOutputScalar): the timeline's Stagger reads it per landing, with the modifier's filters (batch 4 C3).
  Attr.PoiseDamageOutputScalar,
]);

/** Whether a kit buff's attribute does something: it feeds a damage zone, or the engine reads it. */
export function buffAttrHasEffect(attr: AttrType): boolean {
  return ATTR_ZONES.has(attr) || READ_ATTRS.has(attr);
}

/** Whether an attribute feeds a damage zone (its buff value is a zone value, so it has no panel percentage: KitBuffModifier.percent). */
export function attrFeedsZone(attr: AttrType): boolean {
  return ATTR_ZONES.has(attr);
}

/** The modifier an attribute value amounts to, or null when the attribute doesn't act on hits directly. */
export function attrModifier(attr: AttrType, value: number, source: string): Modifier | null {
  const m = ATTR_ZONES.get(attr);
  return m ? { ...m, value, source } : null;
}

export function applies(m: Modifier, hit: HitContext): boolean {
  return (m.element === undefined || m.element === hit.element) &&
    (m.skillType === undefined || m.skillType === hit.skillType) &&
    (!m.staggeredOnly || hit.staggered) &&
    (!m.onlyKinds || (hit.kind !== undefined && m.onlyKinds.includes(hit.kind))) &&
    (!m.decorations || m.decorations.some((d) => hit.decorations?.includes(d) === true));
}

/** Sum of a zone's modifiers that apply to the hit. */
export function zoneSum(mods: readonly Modifier[], zone: Zone, hit: HitContext): number {
  let sum = 0;
  for (const m of mods) if (m.zone === zone && applies(m, hit)) sum += m.value;
  return sum;
}

/** Product of (1 + v) over a zone's modifiers that apply to the hit. */
export function zoneProduct(mods: readonly Modifier[], zone: Zone, hit: HitContext): number {
  let p = 1;
  for (const m of mods) if (m.zone === zone && applies(m, hit)) p *= 1 + m.value;
  return p;
}

// Sanity: ELEMENTS order must match the attribute blocks (50–55, 64–69, 70–75).
if (Attr.PhysicalDamageIncrease + ELEMENTS.indexOf("ether") !== Attr.EtherDamageIncrease || SKILL_TYPES.length !== 4) {
  throw new Error("attribute blocks and ELEMENTS are out of order");
}
