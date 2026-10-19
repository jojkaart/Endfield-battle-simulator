// What happens in a fight, as events, and the kit triggers that react to
// them (docs/kit-abstractions.md, "Triggers"). One mechanism for combo
// windows, team effects (Laevatain's Heat absorption), weapon and gear-set
// effects and talents: a trigger says which event it listens to, whose
// events count, when (a Predicate), how often, and what it does.

import type { Element, SkillType } from "./attributes.ts";
import type { Predicate, ValueExpr } from "./expr.ts";
import type { KitApplication, KitHit, StackGain } from "./model.ts";
import type { ArtsElement } from "./reactions.ts";
import type { PhysicalStatus, ReactionStatus, StatusEvent } from "./status.ts";

export type BattleEvent =
  /** A kit hit landed (after its damage). */
  | {
      readonly type: "hit";
      readonly frame: number;
      readonly operator: string;
      readonly skillId: string;
      readonly kind: SkillType | "none";
      readonly element: Element;
      readonly finalStrike: boolean;
      /** A finisher's landing (its skill is of skillSpecification 8: decorate-mask bit 4). */
      readonly finisher: boolean;
      /** Its damage is a reaction's or burst's (KitHit.reaction), not the skill's own. */
      readonly reaction?: boolean;
      /** Whether the hitter was the controlled operator when it landed. */
      readonly controlled: boolean;
      /** The index of the hit's cast (a triggered hit has none). */
      readonly cast?: number;
    }
  /** A skill was cast. */
  /** A skill was cast; `cast` is its index, `count` a combo's window count (ValueExpr `eventCount`). */
  | { readonly type: "cast"; readonly frame: number; readonly operator: string; readonly skillId: string; readonly kind: SkillType; readonly finisher: boolean; readonly controlled: boolean; readonly cast?: number; readonly count?: number; readonly followUp?: boolean }
  /** Something the enemy's arts state did (status.ts); `fromKind`: the kind of the hit that caused it (`none` for a trigger's or a tick's). */
  | { readonly type: "status"; readonly frame: number; readonly operator: string; readonly event: StatusEvent; readonly fromKind: SkillType | "none"; readonly cast?: number }
  /** `operator` applied one of its kit buffs; `categories`: what the buff is (BuffCategory); `fromKind`: the kind of the skill behind it. */
  | { readonly type: "buffApplied"; readonly frame: number; readonly operator: string; readonly buff: string; readonly categories: readonly BuffCategory[]; readonly fromKind?: SkillType | "none"; readonly gameBuff?: string }
  /** `remaining`: frames it had left when it ended (0 when it ran out); `recorded`: what a recording buff recorded. */
  | { readonly type: "buffEnded"; readonly frame: number; readonly operator: string; readonly buff: string; readonly remaining: number; readonly recorded?: number }
  /** A periodic tick of one of the operator's kit buffs (KitBuff.every). */
  | { readonly type: "buffTick"; readonly frame: number; readonly operator: string; readonly buff: string }
  /** `operator` healed `target` (no amounts: what matters is who, and when). */
  | { readonly type: "heal"; readonly frame: number; readonly operator: string; readonly target: string; readonly kind: SkillType | "none" }
  /** The fight starts (permanent auras, start-of-fight effects); `operator` is the controlled one. */
  | { readonly type: "fightStart"; readonly frame: number; readonly operator: string }
  /** The enemy's stagger bar passed one of its Stagger Nodes (a fraction of its stagger HP; `operator` dealt the stagger). */
  | { readonly type: "staggerNode"; readonly frame: number; readonly operator: string; readonly node: number }
  /** An operator's hit or trigger granted SP; `kind`: the skill kind behind it (a hit's, or its owner's skill behind a trigger chain; else none). */
  | { readonly type: "sp"; readonly frame: number; readonly operator: string; readonly amount: number; readonly kind: SkillType | "none" }
  /** The enemy became Staggered (`operator` dealt the last stagger). */
  | { readonly type: "staggered"; readonly frame: number; readonly operator: string }
  /** An operator's own stacks were gained or used; `changed`: those whose count changed (a gain capped at the maximum changes none). */
  | { readonly type: "stacks"; readonly frame: number; readonly operator: string; readonly changed?: readonly string[] };

/**
 * What a buff is, for triggers on buffs of a kind (the game's buff tags):
 * Amp and Susceptibility by their zone, Weakness and Protection by their
 * attribute (62, 63).
 */
export type BuffCategory = "amp" | "susceptibility" | "weakness" | "protection";

/** A landing's decorations (decorate-mask bits) a hit trigger can ask for, any of them. */
export type HitDecoration = "finalStrike" | "finisher";

/** Which events a trigger listens to (and filters on them). */
export type TriggerOn =
  /** `skills`: only these skills' hits; `decorations`: only landings with any of these; `reaction`: only hits computed as a reaction or burst, or only others. */
  | { readonly event: "hit"; readonly kinds?: readonly (SkillType | "none")[]; readonly elements?: readonly Element[]; readonly finalStrike?: boolean; readonly skills?: readonly string[]; readonly decorations?: readonly HitDecoration[]; readonly reaction?: boolean }
  /**
   * A skill is cast; `skills` narrows it to these skill IDs (a skill's own
   * effects at frames: with the trigger's `delay`); `finisher`: only
   * finishers, or none; `followUp`: only casts a skill made by itself
   * (CastSkill), or only the player's.
   */
  | { readonly event: "cast"; readonly kinds?: readonly SkillType[]; readonly skills?: readonly string[]; readonly finisher?: boolean; readonly followUp?: boolean }
  | (StatusOn & {
      /** Only status events caused by hits of these kinds (CheckOriginSkillType); a trigger's applications and ticks are `none`. */
      readonly fromKinds?: readonly (SkillType | "none")[];
    })
  /** One of the trigger owner's own kit buffs is applied, ends, or ticks (KitBuff.every). */
  | { readonly event: "buffApplied" | "buffEnded" | "buffTick"; readonly buff: string }
  /** Someone (`by`) applies a kit buff of any of these categories (its own, a weapon's or a gear set's); `fromKinds`: only from skills of these kinds. */
  | { readonly event: "buffApplied"; readonly categories: readonly BuffCategory[]; readonly fromKinds?: readonly (SkillType | "none")[] }
  /** Someone (`by`) applies a kit buff standing for one of these BuffData buffs (Grand Vision: "applies Originium Crystals"). */
  | { readonly event: "buffApplied"; readonly gameBuffs: readonly string[] }
  /** Someone (`by`) heals someone; `toOthers`: only heals of someone other than the healer; `kinds`: only heals by these skill kinds (HealAction healTags). */
  | { readonly event: "heal"; readonly toOthers?: boolean; readonly kinds?: readonly (SkillType | "none")[] }
  | { readonly event: "staggered" }
  /** The enemy's stagger bar passes a Stagger Node. */
  | { readonly event: "staggerNode" }
  /** Someone (`by`) recovers SP for the team by a hit or a trigger (not regeneration); `kinds`: from skills of these kinds. */
  | { readonly event: "sp"; readonly kinds?: readonly (SkillType | "none")[] }
  | { readonly event: "fightStart" }
  /** The owner's own stack reaches a count. */
  | { readonly event: "stackAtLeast"; readonly stack: string; readonly atLeast: number };

/** Triggers on what the enemy's arts and physical state did (status events). */
export type StatusOn =
  /** A reaction status is applied (forced ones included). */
  | { readonly event: "reaction"; readonly statuses?: readonly ReactionStatus[] }
  /** An infliction is consumed or absorbed (a reaction consumes the one it lands on, too). */
  | { readonly event: "inflictionConsumed"; readonly elements?: readonly ArtsElement[] }
  /** An infliction is applied without a reaction, leaving at least `minStacks`. */
  | { readonly event: "inflictionApplied"; readonly elements?: readonly ArtsElement[]; readonly minStacks?: number }
  | { readonly event: "burst"; readonly elements?: readonly ArtsElement[] }
  /** A physical status lands (Lift, Knock Down, Crush, Breach); `forced` narrows it to forced ones. */
  | { readonly event: "physicalStatus"; readonly statuses?: readonly PhysicalStatus[]; readonly forced?: boolean }
  /** Vulnerable stacks are added (by a physical status or directly), leaving at least `minStacks`. */
  | { readonly event: "vulnerable"; readonly minStacks?: number }
  | { readonly event: "shatter" }
  /** A control status is applied (Jade Vessel: "applies Immobilization"). */
  | { readonly event: "control"; readonly statuses?: readonly string[] }
  /** A reaction status is removed by a hit before it runs out (Liino's combo: "an Arts Reaction is consumed"). */
  | { readonly event: "statusConsumed"; readonly statuses?: readonly ReactionStatus[] };

/** The status events, the ones a trigger can run before its hit's damage (KitTrigger.beforeDamage). */
export const STATUS_EVENTS: readonly StatusOn["event"][] = ["reaction", "inflictionConsumed", "inflictionApplied", "burst", "physicalStatus", "vulnerable", "shatter", "control", "statusConsumed"];

/** What a trigger does; each action can have its own `if` (judged for the owner when it runs). */
export type TriggerAction = TriggerActionKind & { readonly if?: Predicate };

export type TriggerActionKind =
  /** Open the owner's combo window (not while its combo is on cooldown). */
  | { readonly kind: "openCombo" }
  /** Apply to the enemy, as the owner. */
  | { readonly kind: "apply"; readonly applies: readonly KitApplication[] }
  | { readonly kind: "gain"; readonly gains: readonly StackGain[] }
  /**
   * Ultimate energy for the owner: `value` points, or `value` × its maximum
   * (`percentOfMax`); `ignoreEfficiency` and `ignoreBlock` as the game's
   * ObtainCostAction flags.
   */
  | { readonly kind: "energy"; readonly value: ValueExpr; readonly percentOfMax?: boolean; readonly ignoreEfficiency?: boolean; readonly ignoreBlock?: boolean }
  /** The owner's ultimate energy drops to 0 (a state ending with clearUspOnEnd). */
  | { readonly kind: "clearEnergy" }
  /** Return SP to the team (returned SP: it gives no ultimate energy when spent). */
  | { readonly kind: "sp"; readonly value: ValueExpr }
  /**
   * Apply one of the owner's kit buffs; `to: "eventSubject"` gives a team
   * buff to the event's subject only (the healed operator of a heal, else
   * the operator who caused the event); `layers`: this many layers at once
   * (default 1; 0 applies none), e.g. one per Status Level consumed.
   */
  | { readonly kind: "buff"; readonly buff: string; readonly to?: "eventSubject"; readonly layers?: ValueExpr }
  /** Add seconds to the remaining time of one of the owner's active kit buffs (all its layers), e.g. a state a skill pauses. */
  | { readonly kind: "extendBuff"; readonly buff: string; readonly seconds: ValueExpr }
  /** Heal (an event for heal triggers; amounts aren't modelled); `healKind`: the skill kind its heal tag names (HealAction healTags), default none. */
  | { readonly kind: "heal"; readonly target: HealTarget; readonly healKind?: SkillType }
  /**
   * End the owner's current skill now (JumpToAction to its end, e.g. when a
   * stance it holds ends): its hits and delayed actions still to come are
   * dropped as if another skill had started, and the operator is free.
   */
  | { readonly kind: "endAction" }
  /** Drop the owner's hits still to land from one of its triggers (a cast ending a volley on its way: FinishBuff of its launcher). */
  | { readonly kind: "cancelHits"; readonly trigger: string }
  /** End one of the owner's kit buffs: all of it, or its oldest `layers`. */
  | { readonly kind: "endBuff"; readonly buff: string; readonly layers?: number }
  /**
   * Change the remaining cooldown of an operator's skills of a kind by
   * `seconds`, or by `fraction` of their full cooldown (SetSkillCdAtOnce
   * isPercentage; assumed, in-game test 36); negative cuts it. `set` starts
   * one of `set` seconds whether one is running or not (SetSkillCdAtOnce
   * functionType 1: End Stance's lockout on Liino's battle skill).
   */
  | ({ readonly kind: "cooldown"; readonly who: "self" | "eventOperator" | { readonly slot: number }; readonly skills: SkillType } & ({ readonly seconds: ValueExpr } | { readonly fraction: ValueExpr } | { readonly set: ValueExpr }))
  /** The owner casts one of its kit skills by itself (SkillData CastSkill: a follow-up, e.g. Typhoeus's aerial shots off-field): no control, cost or cooldown. */
  | { readonly kind: "cast"; readonly skill: string }
  /**
   * Land hits, as the owner, at frames counted from the event (values from
   * the trigger's `skill`); each names its damage type. `now`: its frame-0
   * hits land as the action runs, before the trigger's next action (a
   * DamageAction inside the game's event handler).
   */
  | { readonly kind: "hits"; readonly hits: readonly KitHit[]; readonly now?: boolean };

/** Whom a heal reaches: the healer, the controlled operator, the whole team, or the operator who caused the event. */
export type HealTarget = "self" | "controlled" | "team" | "eventOperator";

export interface KitTrigger {
  /** Unique within its kit. */
  readonly id: string;
  readonly on: TriggerOn;
  /** Whose events count: the owner's, a teammate's, anyone's, or the controlled operator's. */
  readonly by: "self" | "teammate" | "anyone" | "controlled";
  /** Judged for the owner when the event happens. */
  readonly if?: Predicate;
  /** Seconds before it can fire again. */
  readonly cooldown?: ValueExpr;
  /** The cooldown counts per event subject (the healed operator of a heal, else the event's operator): Liino's weapon, per teammate. */
  readonly cooldownPer?: "eventSubject";
  /** At most this many times per fight. */
  readonly maxCount?: number;
  /** At most this many times per cast whose hits cause the events (the game's per-cast flags, e.g. is_power_attacked); events of no cast don't count. */
  readonly maxPerCast?: number;
  /** Status events only: run on a hit's own status events before that hit's damage, so a buff it applies acts on the hit (Pursuit's Lift). */
  readonly beforeDamage?: boolean;
  /**
   * Frames after the event when its actions run (its `if` is judged at the
   * event; each action's own `if` when it runs). Delayed actions of a cast
   * event are the cast's own: dropped if the caster starts another skill
   * first, unless `detached`.
   */
  readonly delay?: number;
  /** Delayed actions of a cast event happen even if the cast is cut short. */
  readonly detached?: boolean;
  /**
   * A delayed cast trigger whose actions are the skill's own effect (Fluorite's
   * kick planting her explosive): a rotation step without `at` waits for it,
   * as for the cast's own hits. Others (follow-ups the next input cuts) don't
   * hold the next step.
   */
  readonly awaited?: boolean;
  /** The skill a plain value key names (a skill of the owner, or a talent / weapon / gear-set source). */
  readonly skill?: string;
  readonly do: readonly TriggerAction[];
}

/** Where a trigger's plain value keys (and its hits' scale) come from: its `skill`, else a name of its own. */
export function triggerSkillId(owner: string, t: Pick<KitTrigger, "id" | "skill">): string {
  return t.skill ?? `${owner}.${t.id}`;
}

/** Whether an event is one a trigger listens to (not who caused it, nor its `if`). */
export function eventMatches(on: TriggerOn, e: BattleEvent, owner: string, ownStacks: Readonly<Record<string, number>>): boolean {
  const has = <T>(list: readonly T[] | undefined, x: T) => !list || list.includes(x);
  switch (on.event) {
    case "hit":
      return (
        e.type === "hit" && has(on.kinds, e.kind) && has(on.elements, e.element) && has(on.skills, e.skillId) && (on.finalStrike === undefined || on.finalStrike === e.finalStrike) &&
        (!on.decorations || on.decorations.some((d) => (d === "finisher" ? e.finisher : e.finalStrike))) && (on.reaction === undefined || on.reaction === (e.reaction ?? false))
      );
    case "cast":
      return e.type === "cast" && has(on.kinds, e.kind) && has(on.skills, e.skillId) && (on.finisher === undefined || on.finisher === e.finisher) && (on.followUp === undefined || on.followUp === (e.followUp ?? false));
    case "buffApplied":
      if ("categories" in on) return e.type === "buffApplied" && e.categories.some((c) => on.categories.includes(c)) && has(on.fromKinds, e.fromKind ?? "none");
      if ("gameBuffs" in on) return e.type === "buffApplied" && e.gameBuff !== undefined && on.gameBuffs.includes(e.gameBuff);
      return e.type === on.event && e.operator === owner && e.buff === on.buff;
    case "buffEnded":
    case "buffTick":
      return e.type === on.event && e.operator === owner && e.buff === on.buff;
    case "heal":
      return e.type === "heal" && (!on.toOthers || e.target !== e.operator) && has(on.kinds, e.kind);
    case "stackAtLeast":
      return e.type === "stacks" && e.operator === owner && (e.changed === undefined || e.changed.includes(on.stack)) && (ownStacks[on.stack] ?? 0) >= on.atLeast;
    case "staggered":
      return e.type === "staggered";
    case "staggerNode":
      return e.type === "staggerNode";
    case "sp":
      return e.type === "sp" && has(on.kinds, e.kind);
    case "fightStart":
      return e.type === "fightStart";
  }
  if (e.type !== "status" || !has(on.fromKinds, e.fromKind)) return false;
  const s = e.event;
  switch (on.event) {
    case "reaction":
      return s.kind === "reaction" && has(on.statuses, s.status);
    case "inflictionConsumed":
      return (s.kind === "consumed" && has(on.elements, s.element)) || (s.kind === "reaction" && s.consumed !== null && has(on.elements, s.consumed));
    case "inflictionApplied":
      return s.kind === "inflicted" && has(on.elements, s.element) && s.stacks >= (on.minStacks ?? 1);
    case "burst":
      return s.kind === "burst" && has(on.elements, s.element);
    case "statusConsumed":
      return s.kind === "statusConsumed" && has(on.statuses, s.status);
    case "physicalStatus":
      return s.kind === "physical" && has(on.statuses, s.status) && (on.forced === undefined || on.forced === s.forced);
    case "vulnerable":
      return s.kind === "vulnerable" && s.stacks >= (on.minStacks ?? 1);
    case "shatter":
      return s.kind === "shatter";
    case "control":
      return s.kind === "control" && has(on.statuses, s.status);
  }
}

/** Whether the event's cause counts for a trigger (`by`). Stack and own-buff events are the owner's (a buff category's aren't). */
export function causeMatches(by: KitTrigger["by"], e: BattleEvent, owner: string, on?: TriggerOn): boolean {
  const ownBuff = (e.type === "buffApplied" && !(on && ("categories" in on || "gameBuffs" in on))) || e.type === "buffEnded" || e.type === "buffTick";
  if (e.type === "stacks" || ownBuff || e.type === "fightStart") return true;
  if (by === "anyone") return true;
  if (by === "self") return e.operator === owner;
  if (by === "teammate") return e.operator !== owner;
  if (e.type === "hit" || e.type === "cast") return e.controlled;
  return false;
}
