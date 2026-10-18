// What happens in a fight, as events, and the kit triggers that react to
// them (docs/kit-abstractions.md, "Triggers"). One mechanism for combo
// windows, team effects (Laevatain's Heat absorption), weapon and gear-set
// effects and talents: a trigger says which event it listens to, whose
// events count, when (a Predicate), how often, and what it does.

import type { Element, SkillType } from "./attributes.ts";
import type { Predicate, ValueExpr } from "./expr.ts";
import type { KitApplication, KitHit, StackGain } from "./model.ts";
import type { ArtsElement } from "./reactions.ts";
import type { ReactionStatus, StatusEvent } from "./status.ts";

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
      /** Whether the hitter was the controlled operator when it landed. */
      readonly controlled: boolean;
    }
  /** A skill was cast. */
  | { readonly type: "cast"; readonly frame: number; readonly operator: string; readonly skillId: string; readonly kind: SkillType; readonly controlled: boolean }
  /** Something the enemy's arts state did (status.ts). */
  | { readonly type: "status"; readonly frame: number; readonly operator: string; readonly event: StatusEvent }
  | { readonly type: "buffApplied"; readonly frame: number; readonly operator: string; readonly buff: string }
  | { readonly type: "buffEnded"; readonly frame: number; readonly operator: string; readonly buff: string }
  /** A periodic tick of one of the operator's kit buffs (KitBuff.every). */
  | { readonly type: "buffTick"; readonly frame: number; readonly operator: string; readonly buff: string }
  /** `operator` healed `target` (no amounts: what matters is who, and when). */
  | { readonly type: "heal"; readonly frame: number; readonly operator: string; readonly target: string }
  /** An operator's own stacks changed. */
  | { readonly type: "stacks"; readonly frame: number; readonly operator: string };

/** Which events a trigger listens to (and filters on them). */
export type TriggerOn =
  | { readonly event: "hit"; readonly kinds?: readonly (SkillType | "none")[]; readonly elements?: readonly Element[]; readonly finalStrike?: boolean }
  /** A skill is cast; `skills` narrows it to these skill IDs (a skill's own effects at frames: with the trigger's `delay`). */
  | { readonly event: "cast"; readonly kinds?: readonly SkillType[]; readonly skills?: readonly string[] }
  /** A reaction status is applied (forced ones included). */
  | { readonly event: "reaction"; readonly statuses?: readonly ReactionStatus[] }
  /** An infliction is consumed or absorbed (a reaction consumes the one it lands on, too). */
  | { readonly event: "inflictionConsumed"; readonly elements?: readonly ArtsElement[] }
  /** An infliction is applied without a reaction, leaving at least `minStacks`. */
  | { readonly event: "inflictionApplied"; readonly elements?: readonly ArtsElement[]; readonly minStacks?: number }
  | { readonly event: "burst"; readonly elements?: readonly ArtsElement[] }
  /** One of the trigger owner's own kit buffs is applied, ends, or ticks (KitBuff.every). */
  | { readonly event: "buffApplied" | "buffEnded" | "buffTick"; readonly buff: string }
  /** Someone (`by`) heals someone; `toOthers`: only heals of someone other than the healer. */
  | { readonly event: "heal"; readonly toOthers?: boolean }
  /** The owner's own stack reaches a count. */
  | { readonly event: "stackAtLeast"; readonly stack: string; readonly atLeast: number };

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
   * the operator who caused the event).
   */
  | { readonly kind: "buff"; readonly buff: string; readonly to?: "eventSubject" }
  /** Add seconds to the remaining time of one of the owner's active kit buffs (all its layers), e.g. a state a skill pauses. */
  | { readonly kind: "extendBuff"; readonly buff: string; readonly seconds: ValueExpr }
  /** Heal (an event for heal triggers; amounts aren't modelled). */
  | { readonly kind: "heal"; readonly target: HealTarget }
  /** End one of the owner's kit buffs: all of it, or its oldest `layers`. */
  | { readonly kind: "endBuff"; readonly buff: string; readonly layers?: number }
  /** Change the remaining cooldown of an operator's skills of a kind by `seconds` (negative cuts it). */
  | { readonly kind: "cooldown"; readonly who: "self" | "eventOperator" | { readonly slot: number }; readonly skills: SkillType; readonly seconds: ValueExpr }
  /** Land hits, as the owner, at frames counted from the event (values from the trigger's `skill`); each names its damage type. */
  | { readonly kind: "hits"; readonly hits: readonly KitHit[] };

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
  /** At most this many times per fight. */
  readonly maxCount?: number;
  /** Frames after the event when its actions run (its `if` is judged at the event; each action's own `if` when it runs). */
  readonly delay?: number;
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
      return e.type === "hit" && has(on.kinds, e.kind) && has(on.elements, e.element) && (on.finalStrike === undefined || on.finalStrike === e.finalStrike);
    case "cast":
      return e.type === "cast" && has(on.kinds, e.kind) && has(on.skills, e.skillId);
    case "buffApplied":
    case "buffEnded":
    case "buffTick":
      return e.type === on.event && e.operator === owner && e.buff === on.buff;
    case "heal":
      return e.type === "heal" && (!on.toOthers || e.target !== e.operator);
    case "stackAtLeast":
      return e.type === "stacks" && e.operator === owner && (ownStacks[on.stack] ?? 0) >= on.atLeast;
  }
  if (e.type !== "status") return false;
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
  }
}

/** Whether the event's cause counts for a trigger (`by`). Stack and own-buff events are the owner's. */
export function causeMatches(by: KitTrigger["by"], e: BattleEvent, owner: string): boolean {
  if (e.type === "stacks" || e.type === "buffApplied" || e.type === "buffEnded" || e.type === "buffTick") return true;
  if (by === "anyone") return true;
  if (by === "self") return e.operator === owner;
  if (by === "teammate") return e.operator !== owner;
  if (e.type === "hit" || e.type === "cast") return e.controlled;
  return false;
}
