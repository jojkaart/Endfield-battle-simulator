// Game data as the engine sees it. The data layer builds these from the
// tables; the engine never reads tables itself (docs/design.md#layers).

import type { AttrType, Element, SkillType } from "./attributes.ts";

/**
 * How a modifier combines with an attribute (the tables' `formulaItem` /
 * `modifierType`). Final value =
 *   ((base + Σ add) × (1 + Σ percent) + Σ flat) × Π multiply.
 * add and percent are verified against an in-game stat panel; flat and
 * multiply follow the data patterns (flat ATK +12, cooldown ×0.85) and
 * End-DPScope's research notes, not yet an in-game check.
 */
export const Slot = { Add: 5, Percent: 6, Flat: 7, Multiply: 8 } as const;
export type SlotId = number;

/** Which attribute a modifier targets: as written, or the operator's main / secondary attribute. */
export const Target = { AsWritten: 0, MainAttribute: 1, SecondaryAttribute: 2 } as const;

export interface AttrModifier {
  readonly attr: AttrType;
  readonly slot: SlotId;
  readonly target: number;
  readonly value: number;
}

/** A modifier whose value comes from a skill's blackboard key (or a literal). */
export interface SkillAttrModifier {
  readonly attr: AttrType;
  readonly slot: SlotId;
  readonly target: number;
  readonly key: string | null;
  readonly literal: number;
}

export type SkillValueOp = "add" | "multiply" | "set";

export type Effect =
  | { readonly kind: "attr"; readonly modifier: AttrModifier }
  | { readonly kind: "skillValue"; readonly skillId: string; readonly key: string; readonly op: SkillValueOp; readonly value: number }
  | { readonly kind: "buff"; readonly buffId: string; readonly blackboard: Readonly<Record<string, number>> }
  | { readonly kind: "other"; readonly modifyType: number };

export interface SkillLevelData {
  readonly level: number;
  readonly blackboard: Readonly<Record<string, number>>;
  readonly coolDown: number;
  readonly costType: number;
  readonly costValue: number;
}

export interface SkillData {
  readonly id: string;
  readonly levels: readonly SkillLevelData[];
  /** False when the skill's SkillData file isn't fetched; defaults and statModifiers are then unknown. */
  readonly fileLoaded: boolean;
  /** Blackboard defaults from SkillData, for keys the level table doesn't set (e.g. `ratio`). */
  readonly defaults: Readonly<Record<string, number>>;
  /** Permanent stat effects (`cardAttributeModifier`), e.g. weapon and gear set stats. */
  readonly statModifiers: readonly SkillAttrModifier[];
}

export interface OperatorLevelRow {
  readonly breakStage: number;
  readonly level: number;
  readonly attrs: Readonly<Record<number, number>>;
}

export interface AttributeNode {
  readonly nodeId: string;
  readonly breakStage: number;
  readonly modifiers: readonly AttrModifier[];
}

export interface TalentNode {
  readonly nodeId: string;
  /** Which talent (0 = first) and the level this node unlocks. */
  readonly index: number;
  readonly level: number;
  readonly effects: readonly Effect[];
}

export interface OperatorData {
  readonly id: string;
  readonly name: string;
  readonly rarity: number;
  readonly element: string;
  readonly weaponType: number;
  readonly mainAttr: AttrType;
  readonly subAttr: AttrType;
  readonly levelRows: readonly OperatorLevelRow[];
  /** Which skill level applies to each of the operator's skills. */
  readonly skillGroups: Readonly<Record<string, SkillType>>;
  readonly attributeNodes: readonly AttributeNode[];
  readonly talentNodes: readonly TalentNode[];
  /** Effects per potential level; index 0 is P1. */
  readonly potentials: readonly (readonly Effect[])[];
}

export interface WeaponData {
  readonly id: string;
  readonly name: string;
  readonly rarity: number;
  readonly weaponType: number;
  readonly maxLevel: number;
  /** Base ATK by weapon level; index 0 is level 1. */
  readonly baseAtk: readonly number[];
  /** The weapon's three skills: two stat skills and its unique skill. */
  readonly skills: readonly string[];
}

export interface GearLine {
  /** 0 is the base stat (DEF); 1–3 are the stat lines artificing raises. */
  readonly line: number;
  readonly attr: AttrType;
  readonly slot: SlotId;
  readonly target: number;
  /** Value by artificing level 0–3. */
  readonly values: readonly number[];
}

export interface GearData {
  readonly id: string;
  readonly name: string;
  /** 0 armour, 1 gloves, 2 kit. */
  readonly part: number;
  readonly setId: string | null;
  readonly lines: readonly GearLine[];
}

export interface GearSetData {
  readonly id: string;
  readonly name: string;
  readonly piecesRequired: number;
  readonly skillId: string;
  readonly skillLevel: number;
}

export interface EnemyData {
  readonly id: string;
  readonly name: string;
  /** Attributes by level; index 0 is level 1. */
  readonly levels: readonly Readonly<Record<number, number>>[];
  readonly staticAttrs: Readonly<Record<number, number>>;
  /** Resistance points by element (100 = immune). */
  readonly resistance: Readonly<Record<Element, number>>;
}

export interface BattleConstants {
  readonly atkRateOfMain: number;
  readonly atkRateOfSub: number;
  readonly efficiencyOfDEF: number;
  readonly maxUltimateSp: number;
}

export interface GameData {
  readonly provenance: { readonly sources: readonly { readonly name: string; readonly commit: string }[] };
  readonly constants: BattleConstants;
  /** Default value per attribute type (AttributeMetaTable), used where a level row has none (e.g. crit DMG 0.5). */
  readonly attributeDefaults: Readonly<Record<number, number>>;
  readonly operators: Readonly<Record<string, OperatorData>>;
  readonly skills: Readonly<Record<string, SkillData>>;
  readonly weapons: Readonly<Record<string, WeaponData>>;
  readonly gear: Readonly<Record<string, GearData>>;
  readonly gearSets: Readonly<Record<string, GearSetData>>;
  readonly enemies: Readonly<Record<string, EnemyData>>;
  readonly kits: Kits;
}

// ── Kits: hand-written hit structure (docs/design.md#skills-and-buffs-from-skilldata--buffdata) ──

/** One kind of hit of a skill. Its multiplier is the product of the named blackboard values. */
export interface KitHit {
  readonly id: string;
  readonly label: string;
  readonly scale: readonly string[];
  /** How many times the hit lands per use. */
  readonly count: number;
  /** Which skill-type damage bonus applies (enhanced basic attacks during an ultimate are still "basic"). */
  readonly damageType: SkillType;
  readonly element: Element;
}

export interface KitSkill {
  readonly skillId: string;
  readonly label: string;
  readonly hits: readonly KitHit[];
}

/** Where a condition's value comes from, so it follows the build's levels. */
export type ConditionSource =
  | { readonly kind: "talent"; readonly index: number; readonly buffId: string; readonly key: string; readonly scale: number }
  | { readonly kind: "weaponSkill"; readonly skill: number; readonly key: string; readonly scale: number };

export type ConditionEffect =
  | { readonly kind: "attr"; readonly attr: AttrType }
  | { readonly kind: "ignoreResistance"; readonly element: Element };

/** A state the user (later: the timeline) switches on, e.g. a talent buff at full stacks. */
export interface Condition {
  /** Globally unique: `<operator or weapon ID>.<name>`. */
  readonly id: string;
  readonly label: string;
  readonly source: ConditionSource;
  readonly effect: ConditionEffect;
}

export interface OperatorKit {
  readonly operator: string;
  readonly skills: readonly KitSkill[];
  readonly conditions: readonly Condition[];
}

export interface Kits {
  readonly operators: Readonly<Record<string, OperatorKit>>;
  /** Conditions of weapons, by weapon ID. */
  readonly weapons: Readonly<Record<string, readonly Condition[]>>;
}
