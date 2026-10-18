// Game data as the engine sees it. The data layer builds these from the
// tables; the engine never reads tables itself (docs/design.md#layers).

import type { AttrType, Element, SkillType } from "./attributes.ts";
import type { HitKind, Zone } from "./effects.ts";
import type { ArtsElement } from "./reactions.ts";
import type { KitTrigger } from "./events.ts";
import type { Predicate, ValueExpr } from "./expr.ts";
import type { HitApplication } from "./status.ts";

/**
 * How a modifier combines with an attribute (the tables' `formulaItem` /
 * `modifierType`). Final value =
 *   ((base + Σ add) × (1 + Σ percent) + Σ flat) × Π multiply.
 * add and percent are verified against an in-game stat panel; flat and
 * multiply follow the data patterns (flat ATK +12, cooldown ×0.85) and
 * End-DPScope's research notes, not yet an in-game check. Slot 0 appears
 * once (sk_wpn_funnel_0011's Nature DMG) and is treated as add; to be
 * confirmed by that weapon's logged hits.
 */
export const Slot = { Add: 5, Percent: 6, Flat: 7, Multiply: 8, AddUnverified: 0 } as const;
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

/**
 * A talent, potential or equipment effect. `activeCondition` names game
 * conditions (e.g. Arcane's `lizhiyan_wisd`) that must hold for it; the
 * operator's kit maps each to a Predicate (OperatorKit.activeConditions).
 */
export type Effect = EffectBody & { readonly activeCondition?: readonly string[] };

type EffectBody =
  | { readonly kind: "attr"; readonly modifier: AttrModifier }
  /** A skill attached by a talent: its blackboard holds the talent's values at that level. */
  | { readonly kind: "skill"; readonly skillId: string; readonly blackboard: Readonly<Record<string, number>> }
  | { readonly kind: "skillValue"; readonly skillId: string; readonly key: string; readonly op: SkillValueOp; readonly value: number }
  | { readonly kind: "buff"; readonly buffId: string; readonly blackboard: Readonly<Record<string, number>> }
  | { readonly kind: "skillParam"; readonly skillId: string; readonly param: "cost" | "cooldown"; readonly op: SkillValueOp; readonly value: number }
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
  /** False when the skill's SkillData file isn't fetched; defaults, statModifiers and timing are then unknown. */
  readonly fileLoaded: boolean;
  /**
   * From SkillData: animation length, uninterruptible frames, first frame of
   * the cancel window (AllowNextSkillAction), all at 30 FPS. Null when the
   * file isn't loaded.
   */
  readonly timing: { readonly durationFrames: number; readonly exclusiveFrames: number; readonly cancelFrame: number | null } | null;
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
  /** Event keys battle logs use for this hit (skill, projectile or ability-entity IDs). */
  readonly events: readonly string[];
  /** Frame of each landing from the skill's start (30 FPS), when known. */
  readonly frames?: readonly number[];
  /** Which skill-type damage bonus applies (enhanced basic attacks during an ultimate are still "basic"); `none` for triggered hits of no skill type. */
  readonly damageType: SkillType | "none";
  readonly element: Element;
  /** What each landing does to the enemy's arts state (inflictions, forced reactions), in order. */
  readonly applies?: readonly HitApplication[];
  /** The hit only happens if the operator has these stacks when the skill is cast. */
  readonly requires?: StackRequirement;
  /** Stacks the operator gains when the hit lands (after `applies`). */
  readonly gains?: readonly StackGain[];
  /** The hit's own bonuses from its skill's values, e.g. a projectile's extra damage bonus on its first target. */
  readonly bonuses?: readonly HitBonus[];
  /** A Final Strike (SkillData decorate-mask bit 2097152, set by the data loader). */
  readonly finalStrike?: boolean;
  /** A literal multiplier from the skill graph (e.g. a SimpleCalcBB ÷ 2 splitting a value over two arrows). */
  readonly factor?: number;
  /** Damage computed as an arts reaction or burst (no skill-type bonus, level coefficient, Arts Intensity), times `scale`. */
  readonly reaction?: { readonly kind: "burst" | "reaction"; readonly element: ArtsElement; readonly level?: number };
  /** Extra multipliers that apply only in a situation (e.g. Typhoeus's burst ×1.3 when the enemy has a Nature infliction as the shot lands). */
  readonly extraScale?: readonly { readonly value: ValueExpr; readonly if: Predicate }[];
  /** The hit happens only in this situation, judged as it lands (before its own effects): a mode (Arcane), an enemy status (Estella's combo on a Solidified target)… */
  readonly if?: Predicate;
  /** Kit buffs (OperatorKit.buffs) this hit applies when it lands. */
  readonly buffs?: readonly BuffApplication[];
  /** Ultimate energy the operator gains when the hit lands (SkillData ObtainCostAction, e.g. a combo's `usp`), after its own effects. */
  readonly energy?: ValueExpr;
}

export interface BuffApplication {
  readonly buff: string;
  /** Whether the buff already acts on this hit (default: it doesn't; logs differ by skill). */
  readonly beforeDamage?: boolean;
}

/** Kept for the kit loader's error messages; values are ValueExprs (expr.ts). */
export type ValueSpec = ValueExpr;

export interface KitBuffModifier {
  readonly zone: Zone;
  readonly value: ValueExpr;
  /** One modifier per listed element; any element when absent. */
  readonly elements?: readonly Element[];
  readonly skillType?: SkillType;
  readonly onlyKinds?: readonly HitKind[];
}

/** A timed buff or debuff an operator's hits apply: on themselves, the whole team, or the enemy (then it acts on every team member's hits). */
export interface KitBuff {
  /** Unique within the kit. Reapplying replaces the active instance and resets its duration. */
  readonly id: string;
  readonly label: string;
  readonly target: "self" | "team" | "enemy";
  /** Seconds. */
  readonly duration: ValueExpr;
  /**
   * Instances in the same group don't add up, whoever applied them: only the
   * strongest of each modifier counts. Set by the data loader from the game
   * buff the kit buff stands for (BuffData stackingType 1, "effects of the
   * same name don't stack"), e.g. Arts Susceptibility from two operators.
   */
  readonly stackGroup?: string;
  readonly modifiers: readonly KitBuffModifier[];
}

export interface HitBonus {
  readonly zone: Zone;
  /** Blackboard key of the hit's skill, at the build's level, after potentials. */
  readonly key: string;
}

/** An operator's own counter, e.g. Laevatain's Melting Flame. */
export interface StackDef {
  readonly id: string;
  readonly label: string;
  readonly max: number;
}

export interface StackRequirement {
  readonly stack: string;
  readonly atLeast: number;
  /** Consume all of the stack when the skill is cast with the requirement met. */
  readonly consume: boolean;
}

export interface StackGain {
  readonly stack: string;
  /** How many, e.g. 1, or `{ consumed: true }` for the infliction stacks this hit consumed. */
  readonly amount: ValueExpr;
}

export interface KitSkill {
  readonly skillId: string;
  readonly label: string;
  /**
   * What kind of action casting it is (basic attacks need the operator to be
   * controlled; combos need their window). Not always the skill's level group:
   * Laevatain's enhanced attacks level with her ultimate but are basic attacks.
   */
  readonly kind: SkillType;
  /** How long the skill locks the operator (30 FPS frames), when known. */
  readonly durationFrames?: number;
  /** The operator gains no ultimate energy for this long after the cast (SkillData RefrainObtainUsp, e.g. Laevatain's ultimate). */
  readonly energyBlockSeconds?: number;
  /** Castable only while the operator's own kit buff is active (e.g. enhanced attacks during an ultimate)… */
  readonly availableWhile?: string;
  /** …or only while it isn't (the plain attacks they replace). */
  readonly unavailableWhile?: string;
  readonly hits: readonly KitHit[];
}

/** Where a condition's value comes from, so it follows the build's levels. */
export type ConditionSource =
  | { readonly kind: "talent"; readonly index: number; readonly buffId: string; readonly key: string; readonly scale: number }
  | { readonly kind: "weaponSkill"; readonly skill: number; readonly key: string; readonly scale: number }
  /** A value of one of the operator's own skills at the build's skill level, after potentials. */
  | { readonly kind: "skill"; readonly skillId: string; readonly key: string; readonly scale: number };

/**
 * What a condition does: change an attribute (mapped to its zone like any
 * stat, see effects.ts), or add directly to a damage zone with optional
 * element and skill-type filters.
 */
export type ConditionEffect =
  | { readonly kind: "attr"; readonly attr: AttrType }
  | { readonly kind: "zone"; readonly zone: Zone; readonly element?: Element; readonly skillType?: SkillType };

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
  readonly stacks: readonly StackDef[];
  readonly buffs: readonly KitBuff[];
  /** What the game's condition IDs on this operator's talent and potential effects mean (e.g. Arcane's `lizhiyan_wisd`). */
  readonly activeConditions?: Readonly<Record<string, Predicate>>;
  /**
   * What the kit does when things happen in the fight (events.ts): combo
   * windows, team effects, talents. Without an `openCombo` trigger the
   * combo skill can be cast whenever it's off cooldown.
   */
  readonly triggers: readonly KitTrigger[];
  readonly skills: readonly KitSkill[];
  readonly conditions: readonly Condition[];
}

export interface Kits {
  readonly operators: Readonly<Record<string, OperatorKit>>;
  /** Conditions of weapons, by weapon ID. */
  readonly weapons: Readonly<Record<string, readonly Condition[]>>;
}
