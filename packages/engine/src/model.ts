// Game data as the engine sees it. The data layer builds these from the
// tables; the engine never reads tables itself (docs/design.md#layers).

import type { AttrType, Element, SkillType } from "./attributes.ts";
import type { HitKind, Zone } from "./effects.ts";
import type { ArtsElement } from "./reactions.ts";
import type { HealTarget, KitTrigger } from "./events.ts";
import type { Predicate, ValueExpr } from "./expr.ts";
import type { HitApplication, PhysicalStatus, ReactionStatus } from "./status.ts";
import { EngineError } from "./errors.ts";

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

/**
 * When a skill lets its operator act again (SkillData; rules in
 * docs/design.md "Skill timing"), 30 FPS frames from its start.
 */
export interface SkillTiming {
  /** The whole action (durationFrame): after it, nothing is casting. */
  readonly durationFrames: number;
  /** Until here (exclusiveFrame) it can't be interrupted, except as `windows` and priorities allow. */
  readonly exclusiveFrames: number;
  /** AllowNextSkillAction: from `from` to `to` (inclusive) these skills may start. */
  readonly windows: readonly { readonly from: number; readonly to: number; readonly skills: readonly string[] }[];
  /** ChannelingCastingAction: the caster can't cast skills / can't be swapped out, from `from` to `to`. */
  readonly channels: readonly { readonly from: number; readonly to: number; readonly cantCastSkill: boolean; readonly cantSwitch: boolean }[];
  /** skillSpecification: 1 basic attack, 3 battle skill, 4 combo, 5 ultimate, 6 plunging, 8 finisher. */
  readonly specification: number;
  /** dontInterruptCombo: casting it keeps the basic-attack chain's next step. */
  readonly keepsChain: boolean;
  /**
   * Global time slow-downs the skill causes for everyone but its caster
   * (UltimateTimeAction, global-layer TimeDilationAction): from frame
   * `from`, the world's time scale for each following frame.
   */
  readonly slowdowns: readonly { readonly from: number; readonly scales: readonly number[] }[];
  /**
   * JumpToAction on the skill's own timeline (not inside a condition or an
   * event handler): at frame `at` the playhead moves forward to `to`, and the
   * frames between are skipped (their hits, windows, delayed actions; what's
   * after comes `to − at` frames sooner). `conditional`: its conditionAction
   * isn't empty; the kit says when it's taken (KitSkill.jumps).
   */
  readonly jumps: readonly { readonly at: number; readonly to: number; readonly conditional: boolean }[];
  /** InterruptCurSkillAction on its own timeline: the action ends at these frames, unless a jump skips them. */
  readonly ends: readonly number[];
  /** MarkCanInterrupt on its own timeline: once the playhead reaches it (a jump can skip it), the cast counts as past its exclusive frame. */
  readonly interruptibleFrom?: number;
}

/** SP a grant gives: natural (spent, it gives the team ultimate energy, as regenerated SP does) or returned (spent first, gives none). */
export type SpKind = "natural" | "returned";

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
  readonly timing: SkillTiming | null;
  /** Blackboard defaults from SkillData, for keys the level table doesn't set (e.g. `ratio`). */
  readonly defaults: Readonly<Record<string, number>>;
  /** The kind of SP each blackboard key grants in this skill's file (ObtainCostAction atbGainMethod); empty when not loaded. */
  readonly spKinds: Readonly<Record<string, SpKind>>;
  /** The atbSourceType of the SP each blackboard key grants in this file (ObtainCostAction: 1 basic attacks, 3 skills, 0 some extras); empty when not loaded. */
  readonly spSources: Readonly<Record<string, number>>;
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
  /** From CharacterTable charTypeId (Fire → fire, Cryst → cryst, …). */
  readonly element: Element;
  /** CharacterTable profession (the class: Guard, Caster, …), as the game's number. */
  readonly profession: number;
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
  /** SP the team gets for a finisher on it (breakingAttackedAtbObtain). */
  readonly finisherSp: number;
  /** Stagger nodes: fractions of its stagger HP that trigger a small stagger (poiseKnotPctList). */
  readonly staggerNodes: readonly number[];
}

export interface BattleConstants {
  readonly atkRateOfMain: number;
  readonly atkRateOfSub: number;
  readonly efficiencyOfDEF: number;
  readonly maxUltimateSp: number;
  /** What a perfect dodge does (BuffData buff_common_dash, buff_common_dash_behit_listener); absent when not fetched. */
  readonly perfectDodge?: PerfectDodge;
  /** Frames from a same-element infliction to its Arts Burst's damage and event, per element (BuffData buff_common_<e>_<e>_triggered: its first tick); 0 when not fetched. */
  readonly burstDelayFrames?: Partial<Record<ArtsElement, number>>;
}

/** A perfect dodge (BuffData; docs/kit-batches/batch-2.md, E1). */
export interface PerfectDodge {
  /** The dash's immunity: an enemy hit landing within this many frames of its start is perfectly dodged. */
  readonly windowFrames: number;
  /** SP gained (natural: it gives ultimate energy when spent). */
  readonly sp: number;
  /** The world's time scale per frame after it, the dodger exempt; cooldowns run on. */
  readonly slowdown: readonly number[];
  /** The dodger's own time scale per frame after it (it freezes in its pose). */
  readonly dodgerSlowdown: readonly number[];
  /** Frames the perfect-dodge skill holds the dodger. */
  readonly busyFrames: number;
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
  /**
   * How many times the hit lands per use: a number, or a value judged at the cast for its caster (before a
   * `requires` uses stacks up; a triggered hit's when its action runs), e.g. one per Thunderlance on the field;
   * 0 lands nothing. Each landing is its own hit.
   */
  readonly count: ValueExpr;
  /** Event keys battle logs use for this hit (skill, projectile or ability-entity IDs). */
  readonly events: readonly string[];
  /**
   * Frame of each landing from the skill's start (30 FPS), when known; with a count that's a value, landings
   * past the list repeat its last frame, `framesEvery` frames apart.
   */
  readonly frames?: readonly number[];
  /** A count that's a value: frames between landings past `frames` (default 0: all at its last frame). */
  readonly framesEvery?: number;
  /** Which skill-type damage bonus applies (enhanced basic attacks during an ultimate are still "basic"); `none` for triggered hits of no skill type. */
  readonly damageType: SkillType | "none";
  readonly element: Element;
  /** What each landing does to the enemy's arts state (inflictions, forced reactions), in order. */
  readonly applies?: readonly KitApplication[];
  /** The hit only happens if the operator's stack is in range when the skill is cast; it may use the stack up. */
  readonly requires?: StackRequirement;
  /** Stacks the operator gains when the hit lands (after `applies`). */
  readonly gains?: readonly StackGain[];
  /** The hit's own bonuses from its skill's values, e.g. a projectile's extra damage bonus on its first target. */
  readonly bonuses?: readonly HitBonus[];
  /**
   * For this hit only, every modifier of a zone that reaches it (anyone's:
   * the panel's, buffs, the enemy's debuffs and statuses, only those reaching
   * the hit's element; an all-element one counts) × `value`, judged as it
   * lands: a damage unit's target-side InstantModifyAttribute with
   * formulaItem 8 on the zone's attribute (Last Rite's ultimate: attribute 73,
   * Cryo Susceptibility × `rate`; fixtures/zmdlogs-b7b3762d5da8.json, both
   * slashes ×1.1811 = (1 + 1.5 × 0.568) / 1.568: the whole zone, not her own
   * part).
   */
  readonly zoneScale?: readonly { readonly zone: Zone; readonly value: ValueExpr }[];
  /**
   * A periodic hit with the applier's side snapshotted (DamageAction
   * `takeAtkSnapshot`): a `buffTick` trigger's hit takes the attacker-side
   * modifiers (SNAPSHOT_ZONES: ATK, DMG bonus, Amp, crit, Arts Intensity) its
   * owner had when the ticking buff was applied, not at the tick; the
   * enemy's side is read at the tick. Combustion does the same by itself
   * (status.ts).
   */
  readonly atkSnapshot?: boolean;
  /** A Final Strike (SkillData decorate-mask bit 2097152, set by the data loader). */
  readonly finalStrike?: boolean;
  /** A literal multiplier from the skill graph (e.g. a SimpleCalcBB ÷ 2 splitting a value over two arrows). */
  readonly factor?: number;
  /** Damage computed as an arts reaction or burst (no skill-type bonus, level coefficient, Arts Intensity), times `scale`. */
  readonly reaction?: { readonly kind: "burst" | "reaction"; readonly element: ArtsElement; readonly level?: number };
  /** Extra multipliers that apply only in a situation (e.g. Typhoeus's burst ×1.3 when the enemy has a Nature infliction as the shot lands). */
  readonly extraScale?: readonly { readonly value: ValueExpr; readonly if: Predicate }[];
  /** A multiplier computed from values (e.g. `atk_scale2 + n × atk_scale2_1`), times `scale`. */
  readonly scaleValue?: ValueExpr;
  /**
   * What the hit's multiplier multiplies instead of ATK (MultiplyAttributeCalculation
   * on another attribute, e.g. 300 + 5 × DEF: Catcher's P1); every other zone as usual.
   */
  readonly base?: ValueExpr;
  /** The hit happens only in this situation, judged as it lands (before its own effects): a mode (Arcane), an enemy status (Estella's combo on a Solidified target)… */
  readonly if?: Predicate;
  /**
   * Alternatives of one landing (an IfElse in the skill graph): hits with the
   * same branch are judged together on the situation before any of them
   * lands, and only the first in kit order whose `if` holds lands, landing by
   * landing.
   */
  readonly branch?: string;
  /** Kit buffs (OperatorKit.buffs) this hit applies when it lands. */
  readonly buffs?: readonly BuffApplication[];
  /** Ultimate energy the operator gains when the hit lands (SkillData ObtainCostAction, e.g. a combo's `usp`), after its own effects. */
  readonly energy?: ValueExpr;
  /** SP the hit gives when it lands (SkillData ObtainCostAction costType 1 at this hit); then the skill's `atb` isn't added to its first hit. */
  readonly sp?: ValueExpr;
  /** Its kind; by default the skill's data says (SkillData.spKinds for a plain key), else returned. */
  readonly spKind?: SpKind;
  /** Stagger damage the hit deals (SkillData damage units of damageAttributeType 1, e.g. the skill's `poise`). */
  readonly poise?: ValueExpr;
  /** Its stagger counts only while its operator is controlled (onlyEnableForMainChar, Final Strikes). */
  readonly poiseControlledOnly?: boolean;
  /** Lands even if the skill is interrupted before it: a projectile or ability entity already on its way. */
  readonly detached?: boolean;
  /**
   * A detached hit's launch (skill frame of its LaunchProjectile or
   * SpawnAbilityEntity): until then it's the cast's own, so cutting the cast
   * or a jump over the launch drops it and a jump before it moves it; after
   * it, it lands whatever happens. Implies `detached`; without it, a detached
   * hit is on its way from the cast's frame 0.
   */
  readonly launch?: number;
  /**
   * Fixed DMG: the hit deals exactly this value (no ATK, zones, crit, DEF,
   * RES or Staggered multiplier; SkillData damageType 8), and `scale` is
   * empty. A triggered hit's value is judged when its trigger fires.
   */
  readonly fixedDamage?: ValueExpr;
  /** Whom the hit heals (an event for heal triggers; amounts aren't modelled). */
  readonly heals?: Exclude<HealTarget, "eventOperator">;
}

/**
 * An application to the enemy's arts state as kits write it: it can depend
 * on the situation (`if`, judged when it happens, after earlier ones), and
 * its stacks can be values (e.g. up to the room left in a stack).
 */
export type KitApplication = (
  | Exclude<HitApplication, { readonly kind: "infliction" | "consumeInfliction" | "physicalStatus" | "forcedReaction" }>
  /**
   * `level` judged when it happens, after the hit's earlier applications:
   * `{consumed: true}` is the stacks the preceding `consumeInfliction` took
   * (ForceSpellStatusAction `consumedLayer`); 0 applies nothing. `extraSeconds`
   * is added to this application's duration only.
   */
  | (Omit<Extract<HitApplication, { readonly kind: "forcedReaction" }>, "level" | "extraSeconds"> & { readonly level?: ValueExpr; readonly extraSeconds?: ValueExpr })
  /** `status: "event"`: the physical status of the event behind it (a combo's: the one that opened its window). */
  | (Omit<Extract<HitApplication, { readonly kind: "physicalStatus" }>, "status"> & { readonly status: Extract<HitApplication, { readonly kind: "physicalStatus" }>["status"] | "event" })
  /** `element: "event"`: the infliction element of the event behind it (a combo's: the one that opened its window). */
  | (Omit<Extract<HitApplication, { readonly kind: "infliction" }>, "stacks" | "element"> & { readonly element: Extract<HitApplication, { readonly kind: "infliction" }>["element"] | "event"; readonly stacks?: ValueExpr })
  | (Omit<Extract<HitApplication, { readonly kind: "consumeInfliction" }>, "stacks"> & { readonly stacks?: ValueExpr })
) & {
  readonly if?: Predicate;
  /**
   * A hit's application that runs (and has its `if` judged) after the hit's
   * damage, for data where a FinishBuffByTag or consumption follows the
   * DamageAction (Wulfgard's extra shot keeps the Electrification it then
   * consumes). Default: before the damage, which sees it (Gilberta's and
   * Arcane's logs). Hits only.
   */
  readonly afterDamage?: boolean;
};

/** What an event behind an effect was, for applications that repeat it (`element: "event"`, `status: "event"`): Antal's combo. */
export type EventSource = { readonly kind: "infliction"; readonly element: ArtsElement } | { readonly kind: "physical"; readonly status: PhysicalStatus };

/**
 * The arts-state application a kit application amounts to, with its values
 * resolved; null when it repeats the event behind it and that event isn't
 * of its kind (an infliction-opened combo window and a `status: "event"`),
 * or when it's a forced reaction of level 0 (nothing consumed).
 */
export function resolveApplication(app: KitApplication, value: (v: ValueExpr) => number, source?: EventSource): HitApplication | null {
  if (app.kind === "infliction" && app.element === "event") {
    if (source?.kind !== "infliction") return null;
    return resolveApplication({ ...app, element: source.element }, value);
  }
  if (app.kind === "physicalStatus" && app.status === "event") {
    if (source?.kind !== "physical") return null;
    return resolveApplication({ ...app, status: source.status }, value);
  }
  const { if: _if, afterDamage: _after, ...rest } = app;
  if ((rest.kind === "infliction" || rest.kind === "consumeInfliction") && rest.stacks !== undefined) return { ...rest, stacks: value(rest.stacks) } as HitApplication;
  if (rest.kind === "forcedReaction") {
    const { level, extraSeconds, ...plain } = rest;
    const n = level === undefined ? undefined : value(level);
    if (n === 0) return null;
    const extra = extraSeconds === undefined ? 0 : value(extraSeconds);
    return { ...plain, ...(n !== undefined ? { level: n } : {}), ...(extra !== 0 ? { extraSeconds: extra } : {}) };
  }
  return rest as HitApplication;
}

/**
 * The frames of a hit's `n` landings (KitHit.count, resolved): its `frames` in order, landings past them at
 * the last one plus `framesEvery` per landing; frame 0 without frames.
 */
export function landingFrames(hit: Pick<KitHit, "id" | "frames" | "framesEvery">, n: number): number[] {
  if (!Number.isInteger(n) || n < 0) throw new EngineError(`hit ${hit.id} lands ${n} times: a count is a whole number ≥ 0`);
  const frames = hit.frames ?? [];
  const last = frames.length ? (frames[frames.length - 1] as number) : 0;
  return Array.from({ length: n }, (_, i) => (i < frames.length ? (frames[i] as number) : last + (i - Math.max(0, frames.length - 1)) * (hit.framesEvery ?? 0)));
}

/** How an operator's kit changes the statuses it applies (Arcane's talent: Corrosion lasts longer and shreds more). */
export interface StatusTweak {
  readonly status: ReactionStatus;
  /** Seconds added to the status's duration. */
  readonly extraSeconds?: ValueExpr;
  /** Multiplier on its strength cap (Corrosion's shred cap). */
  readonly capScale?: ValueExpr;
  /** Where plain value keys come from. */
  readonly skill?: string;
}

export interface BuffApplication {
  readonly buff: string;
  /** Only in this situation (judged when the hit lands, after its applications). */
  readonly if?: Predicate;
  /** Whether the buff already acts on this hit (default: it doesn't; logs differ by skill). */
  readonly beforeDamage?: boolean;
  /** This application's seconds instead of the buff's (the CreateBuffAction's assigned duration; trigger action `buff` has it too). */
  readonly duration?: ValueExpr;
}

/** Kept for the kit loader's error messages; values are ValueExprs (expr.ts). */
export type ValueSpec = ValueExpr;

export interface KitBuffModifier {
  /** A damage zone… */
  readonly zone?: Zone;
  /** …or an attribute (mapped to its zone like any stat; one that doesn't act on hits, e.g. Ultimate Gain Efficiency 44, is read where the game reads it). One of the two. */
  readonly attr?: AttrType;
  readonly value: ValueExpr;
  /** One modifier per listed element; any element when absent (zones only). */
  readonly elements?: readonly Element[];
  readonly skillType?: SkillType;
  readonly onlyKinds?: readonly HitKind[];
  /** Only while this holds at each hit (judged per hit for the hitter: `enemyControl`, `enemyStatus`, …). */
  readonly if?: Predicate;
  /**
   * An attribute's percentage (BuffData formulaItem 6; the loader takes it
   * from the game buff): while active it adds value × (base + Σ add) of the
   * receiver's panel line (× its Π multiply), the panel formula's percent
   * slot, summed with the panel's percentages, not compounded with them.
   * Only for attributes read where the game reads them (DEF, Strength, …),
   * not those feeding a zone. A main attribute's percentage doesn't reach
   * ATK through the attribute bonus (not modelled, as for flat ones).
   */
  readonly percent?: boolean;
}
export interface KitBuff {
  /** Unique within the kit. Reapplying replaces the active instance and resets its duration. */
  readonly id: string;
  readonly label: string;
  readonly target: "self" | "team" | "enemy";
  /** Seconds (0: not applied, e.g. below the potential that unlocks it); absent: until something ends it. */
  readonly duration?: ValueExpr;
  /** Layered: up to this many instances from one owner, each with its own duration (BuffData stackingType 2 / 11); at the maximum a new one replaces the oldest. */
  readonly maxStacks?: ValueExpr;
  /** Layers share one timer that each new layer refreshes (BuffData stackingType 8 or 10; the loader sets it from the game buff). */
  readonly sharedTimer?: boolean;
  /**
   * A team buff that counts as one Link stack while active: the next battle
   * skill or ultimate that uses Link uses it too, and that ends it
   * (Akekuri's talent 2: global_buff_combo_trigger).
   */
  readonly link?: boolean;
  /** A team buff reaches only the members this holds for (judged per member at application, the applier as owner: `isOwner`, `operatorProfession`, …). */
  readonly recipients?: Predicate;
  /**
   * Consumed by the next cast of these kinds by someone it reaches (Link,
   * Jade Vessel's combo bonus): it then acts on that cast's hits only, and
   * on no others (or as `consumedScope` says).
   */
  readonly consumedBy?: readonly SkillType[];
  /**
   * What a consumed buff acts on: `cast` (default), the consuming cast's own
   * hits only (a damage modifier that checks the cast ID, CheckSkillCastId:
   * Jade Vessel, Bonekrusha, Type 50 Yinglung); `whileCasting`, every hit of
   * the consuming caster from the cast until it ends (cut short or run out)
   * and the cast's own hits after (a buff the game attaches to the cast,
   * CreateBuffAttachingSkill: Grand Vision's Physical DMG also on the
   * Endministrator's Crush and crystal hit, fixtures/pending/zmdlogs-7e19489ae503.json
   * t=33734). The loader sets it from the data where it can tell.
   */
  readonly consumedScope?: "cast" | "whileCasting";
  /** While active, its owner gains no ultimate energy (SkillData / BuffData RefrainObtainUsp, e.g. for as long as an ultimate's state lasts). */
  readonly blocksEnergy?: boolean;
  /** Periodic: a `buffTick` event every this many seconds while active (Liino's soundwave every 3 s), for triggers. */
  readonly every?: ValueExpr;
  /** The first tick comes when it's applied (default: one interval later). */
  readonly tickOnApply?: boolean;
  /**
   * Ends with the action that applied it (CreateBuffAction autoFinishByAction):
   * when its owner's current skill ends or the owner starts another one.
   * Applied while its owner isn't in a skill, it isn't applied.
   */
  readonly endsWithCast?: boolean;
  /**
   * An enemy buff that records `rate` × the damage of every hit on its
   * target while active, from anyone (reactions and ticks included, Fixed
   * DMG hits not); `buffEnded` triggers read the total as
   * `{eventRecorded: true}`. Si's Artful Intent (unique: kit-unique.md).
   */
  readonly records?: { readonly rate: ValueExpr };
  /**
   * Instances in the same group don't add up, whoever applied them: only the
   * strongest of each modifier counts. Set by the data loader from the game
   * buff the kit buff stands for (BuffData stackingType 1, "effects of the
   * same name don't stack"), e.g. Arts Susceptibility from two operators.
   */
  readonly stackGroup?: string;
  /**
   * Instances of one buff with a priority (BuffData stackingType 1 with a
   * priority key; the loader sets it from the game buff, `maxStackCnt` or
   * the applying skill's `maxStackCntKey`): a reapplication by the same owner
   * keeps up to this many instances (0: no limit), each with its own
   * duration, and only the strongest acts (its `stackGroup`); a weaker one
   * doesn't replace a stronger one. At the limit the weakest instance goes
   * (ties: the oldest), the new one included: an interim, as the data
   * doesn't say which (batch 3 B1). Its `buffEnded` comes with the last one.
   */
  readonly instances?: ValueExpr;
  /** The BuffData buff it stands for (kits name it; predicates and triggers by game buff read it). */
  readonly gameBuff?: string;
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
  /** At the start of a fight (default 0), e.g. from a talent's attached buff: `{ key, skill }`. */
  readonly initial?: ValueExpr;
}

export interface StackRequirement {
  readonly stack: string;
  /** Judged at the cast, before the cast uses anything up. */
  readonly atLeast?: number;
  readonly below?: number;
  /**
   * What the hit uses up: all of the stack (true), or this many (a value).
   * A cast uses a stack up once, by the largest amount its happening hits
   * name (two hit entries of one Power Shot use one arrow).
   */
  readonly consume?: boolean | ValueExpr;
  /** When it's used up: at the cast (default), or when the requiring hit lands (Laevatain's Melting Flame, after earlier hits added to it). */
  readonly consumeAt?: "cast" | "hit";
}

export interface StackGain {
  readonly stack: string;
  /** Only in this situation (judged when it happens). */
  readonly if?: Predicate;
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
  /**
   * When the team's energy for the SP it spends comes, in parts (SkillData
   * CreateBuff buff_common_obtain_ultimate_sp, each with its `ratio`): frames
   * from the cast; a part the cast is cut short before, or whose `if` (for
   * the caster) doesn't hold at its frame, gives nothing; a `detached` part
   * comes from something the skill left behind (an ability entity), so a cut
   * or a jump doesn't drop it. All at the cast when absent.
   */
  readonly teamEnergy?: readonly { readonly frame: number; readonly ratio: number; readonly if?: Predicate; readonly detached?: boolean }[];
  /**
   * When the skill's conditional jumps (SkillTiming.jumps, by their frame
   * `at`) are taken: `if` judged for the caster at the cast (the data's
   * conditions read state the skill sets up as it starts, e.g. Laevatain's
   * has_max_energy at frame 3). A conditional jump not listed isn't taken;
   * `to` tells apart two jumps from the same frame (an IfElse's branches).
   */
  readonly jumps?: readonly { readonly at: number; readonly to?: number; readonly if: Predicate }[];
  /** The operator gains no ultimate energy for this long after the cast (SkillData RefrainObtainUsp, e.g. Laevatain's ultimate). */
  readonly energyBlockSeconds?: number;
  /** Castable only when this holds for the operator at the start frame (a state: `buffActive`; replaced by a stance: `not`). */
  readonly available?: Predicate;
  /** Only a skill's own cast action (CastSkill, a trigger's `cast`) starts it; rotations can't (Typhoeus's hover idle and end, Liino's resumed stance). */
  readonly followUpOnly?: boolean;
  /** The caster becomes the controlled operator at the cast (an ultimate's "becomes the controlled operator"). */
  readonly takesControl?: boolean;
  /**
   * When this holds at the cast, the skill runs beside the operator's
   * current action instead of ending it (SkillData switchToBuffConfig with
   * asSkillCast: Liino's combo during Cosmovoice): the current skill keeps
   * its hits, lock and chain.
   */
  readonly beside?: Predicate;
  /** A basic-attack chain step (attack2…): castable only while the chain points at it (the previous step's window lists it). The loader sets it from the data. */
  readonly chainStep?: boolean;
  /** Skills of one group share a cooldown: casting one puts every member on its own cooldown (Typhoeus's two combos). */
  readonly cooldownGroup?: string;
  /** Hits may be none: a skill that only changes state (Laevatain's ultimate, Liino's End Stance) does it with triggers on its cast. */
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
  /** How the statuses this operator applies differ from the standard ones. */
  readonly statusTweaks?: readonly StatusTweak[];
  readonly skills: readonly KitSkill[];
  readonly conditions: readonly Condition[];
}

/**
 * A weapon's or gear set's kit (docs/kit-process.md, "Equipment is
 * generic"): it acts for whoever wears it, so its triggers and buffs are
 * the wearer's. Its stack, buff and trigger IDs start with `<id>.`; its
 * values come from its own skills.
 */
export interface EquipmentKit {
  /** Weapon or gear-set ID. */
  readonly id: string;
  readonly stacks: readonly StackDef[];
  readonly buffs: readonly KitBuff[];
  readonly triggers: readonly KitTrigger[];
  readonly conditions: readonly Condition[];
}

export interface Kits {
  readonly operators: Readonly<Record<string, OperatorKit>>;
  /** Weapon and gear-set kits, by weapon or gear-set ID. */
  readonly equipment: Readonly<Record<string, EquipmentKit>>;
}
