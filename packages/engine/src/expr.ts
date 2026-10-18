// The kit format's two shared building blocks (docs/kit-abstractions.md):
// a Predicate says when something happens, a ValueExpr says how much. Every
// kit field that needs a condition or a number uses these, so a new
// situation is a new case here, not a new field on hits, buffs or triggers.

import type { AttrType, Element } from "./attributes.ts";
import type { Build } from "./build.ts";
import type { GameData } from "./model.ts";
import type { ArtsElement } from "./reactions.ts";
import type { Modifier, Zone } from "./effects.ts";
import type { EnemyStatus, PhysicalStatus, ReactionStatus } from "./status.ts";
import type { StatPanel } from "./stats.ts";

export type Predicate =
  | { readonly all: readonly Predicate[] }
  | { readonly any: readonly Predicate[] }
  | { readonly not: Predicate }
  /** One of the operator's panel attributes is at least another (Arcane: Intellect ≥ Will is INT mode). */
  | { readonly attrAtLeast: readonly [AttrType, AttrType] }
  | { readonly potentialAtLeast: number }
  /** The team member in a slot (0 = first) has this element (Si's battle skill). */
  | { readonly teamSlotElement: { readonly slot: number; readonly element: Element } }
  /** The enemy has this infliction, with at least `minStacks` (default 1). */
  | { readonly enemyInfliction: ArtsElement; readonly minStacks?: number }
  /** The enemy has this reaction status (Estella's combo on a Solidified target)… */
  | { readonly enemyStatus: ReactionStatus }
  /** …or physical status (Lifted, Breached, …). */
  | { readonly enemyPhysical: PhysicalStatus }
  /** The enemy has at least this many Vulnerable stacks. */
  | { readonly enemyVulnerable: number }
  /** The enemy is Staggered. */
  | { readonly enemyStaggered: true }
  /** The operator's own stack is at least / below a count. */
  | { readonly stack: string; readonly atLeast?: number; readonly below?: number }
  /** One of the operator's own kit buffs is active. */
  | { readonly buffActive: string }
  /** The hit itself consumed at least this many infliction stacks (default 1). */
  | { readonly consumedAtLeast: number }
  /** The operator is the controlled one (Typhoeus's 5th aerial shot is a Final Strike only then). */
  | { readonly controlled: true }
  /** The enemy has a buff from anyone with a modifier in this zone that reaches this element (an all-element one counts). */
  | { readonly enemyModifier: { readonly zone: Zone; readonly element?: Element } }
  /** The operator's element is one of these. */
  | { readonly operatorElement: readonly Element[] }
  /** The operator's profession (CharacterTable `profession`) is one of these. */
  | { readonly operatorProfession: readonly number[] }
  /** The operator is the effect's owner (false for a teammate a team buff reaches). */
  | { readonly isOwner: true }
  /** The operator has the effect owner's element. */
  | { readonly sameElementAsOwner: true }
  /** Judged for the operator who caused the event a trigger reacts to (e.g. a teammate's battle skill: its caster's element). */
  | { readonly eventOperator: Predicate };

/**
 * A number from the game data. A number is a literal; a string is a skill
 * value of the skill in context (at the build's level, after potentials).
 */
export type ValueExpr =
  | number
  | string
  | { readonly key: string; readonly skill?: string }
  | { readonly sum: readonly ValueExpr[] }
  | { readonly product: readonly ValueExpr[] }
  | { readonly min: readonly ValueExpr[] }
  | { readonly max: readonly ValueExpr[] }
  /** One of the operator's panel attributes (e.g. Will 42). */
  | { readonly attr: AttrType }
  /** Infliction stacks consumed by this hit (or by the event that triggered it). */
  | { readonly consumed: true }
  /**
   * The count of the event behind this: for a trigger, its event's stacks
   * (inflicted, consumed; a reaction's level; 1 otherwise); for a combo's
   * hits and buffs, the count of the event that opened its window (Si's
   * finisher n).
   */
  | { readonly eventCount: true }
  /** Targets the hit (or the triggering hit) reached: 1 until fights have several enemies. */
  | { readonly targetsHit: true }
  /** The operator's own stack count (e.g. the room left: max − count). */
  | { readonly stackCount: string }
  /** The enemy's Vulnerable stacks (Gilberta's Arts Susceptibility per stack). */
  | { readonly enemyVulnerableStacks: true }
  | { readonly if: Predicate; readonly then: ValueExpr; readonly else?: ValueExpr };

/** What a predicate or value is evaluated against. Fields left out are unknown. */
export interface EvalContext {
  readonly data: GameData;
  readonly build: Build;
  readonly panel: StatPanel;
  /** The skill whose values a plain key names. */
  readonly skillId: string;
  readonly team?: readonly Build[];
  readonly enemy?: EnemyStatus;
  readonly stacks?: Readonly<Record<string, number>>;
  readonly buffActive?: (id: string) => boolean;
  readonly consumed?: number;
  /** ValueExpr `eventCount`. */
  readonly eventCount?: number;
  /** The controlled operator. */
  readonly controlled?: string;
  /** Whether the enemy is Staggered. */
  readonly staggered?: boolean;
  /** Modifiers of the buffs on the enemy, from anyone. */
  readonly enemyModifiers?: readonly Modifier[];
  /** Whose effect is judged, when `build` is someone else (a team buff's recipient); default: `build`'s operator. */
  readonly owner?: string;
  /** The context of the operator who caused the event a trigger reacts to. */
  readonly eventOperator?: EvalContext;
  /** Skill values (injected to keep this module free of the damage code). */
  readonly skillValue: (skillId: string, key: string) => number;
}

/** True, false, or undefined when the context doesn't know (the log checker then tries both). */
export function test(p: Predicate, c: EvalContext): boolean | undefined {
  if ("all" in p) return and3(p.all.map((x) => test(x, c)));
  if ("any" in p) {
    const v = p.any.map((x) => test(x, c));
    return v.includes(true) ? true : v.includes(undefined) ? undefined : false;
  }
  if ("not" in p) {
    const v = test(p.not, c);
    return v === undefined ? undefined : !v;
  }
  if ("attrAtLeast" in p) {
    const [a, b] = p.attrAtLeast;
    return (c.panel.attrs[a]?.total ?? 0) >= (c.panel.attrs[b]?.total ?? 0);
  }
  if ("potentialAtLeast" in p) return c.build.potential >= p.potentialAtLeast;
  if ("teamSlotElement" in p) {
    if (!c.team) return undefined;
    const member = c.team[p.teamSlotElement.slot];
    return member !== undefined && c.data.operators[member.operator]?.element === p.teamSlotElement.element;
  }
  if ("enemyInfliction" in p) {
    if (!c.enemy) return undefined;
    const i = c.enemy.infliction;
    return i !== null && i.element === p.enemyInfliction && i.stacks >= (p.minStacks ?? 1);
  }
  if ("enemyStatus" in p) return c.enemy ? c.enemy.statuses.some((s) => s.status === p.enemyStatus) : undefined;
  if ("enemyPhysical" in p) return c.enemy ? c.enemy.physical.some((s) => s.status === p.enemyPhysical) : undefined;
  if ("enemyStaggered" in p) return c.staggered;
  if ("enemyVulnerable" in p) return c.enemy ? (c.enemy.vulnerable?.stacks ?? 0) >= p.enemyVulnerable : undefined;
  if ("stack" in p) {
    if (!c.stacks) return undefined;
    const n = c.stacks[p.stack] ?? 0;
    return (p.atLeast === undefined || n >= p.atLeast) && (p.below === undefined || n < p.below);
  }
  if ("buffActive" in p) return c.buffActive ? c.buffActive(p.buffActive) : undefined;
  if ("consumedAtLeast" in p) return c.consumed === undefined ? undefined : c.consumed >= p.consumedAtLeast;
  if ("controlled" in p) return c.controlled === undefined ? undefined : c.controlled === c.build.operator;
  if ("enemyModifier" in p) {
    if (!c.enemyModifiers) return undefined;
    const { zone, element } = p.enemyModifier;
    return c.enemyModifiers.some((m) => m.zone === zone && (element === undefined || m.element === undefined || m.element === element));
  }
  if ("operatorElement" in p) return p.operatorElement.includes(c.data.operators[c.build.operator]?.element as Element);
  if ("operatorProfession" in p) return p.operatorProfession.includes(c.data.operators[c.build.operator]?.profession ?? Number.NaN);
  if ("isOwner" in p) return (c.owner ?? c.build.operator) === c.build.operator;
  if ("sameElementAsOwner" in p) return c.data.operators[c.build.operator]?.element === c.data.operators[c.owner ?? c.build.operator]?.element;
  return c.eventOperator ? test(p.eventOperator, c.eventOperator) : undefined;
}

function and3(v: readonly (boolean | undefined)[]): boolean | undefined {
  return v.includes(false) ? false : v.includes(undefined) ? undefined : true;
}

/** A value; throws when it depends on something the context doesn't know. */
export function evaluate(v: ValueExpr, c: EvalContext): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return c.skillValue(c.skillId, v);
  if ("key" in v) return c.skillValue(v.skill ?? c.skillId, v.key);
  if ("sum" in v) return v.sum.reduce((s: number, x) => s + evaluate(x, c), 0);
  if ("product" in v) return v.product.reduce((s: number, x) => s * evaluate(x, c), 1);
  if ("min" in v) return Math.min(...v.min.map((x) => evaluate(x, c)));
  if ("max" in v) return Math.max(...v.max.map((x) => evaluate(x, c)));
  if ("attr" in v) return c.panel.attrs[v.attr]?.total ?? c.data.attributeDefaults[v.attr] ?? 0;
  if ("consumed" in v) {
    if (c.consumed === undefined) throw new Error("value needs the consumed infliction stacks, which aren't known here");
    return c.consumed;
  }
  if ("eventCount" in v) {
    if (c.eventCount === undefined) throw new Error("value needs the count of the event behind it, which isn't known here");
    return c.eventCount;
  }
  if ("targetsHit" in v) return 1;
  if ("enemyVulnerableStacks" in v) {
    if (!c.enemy) throw new Error("value needs the enemy's Vulnerable stacks, which aren't known here");
    return c.enemy.vulnerable?.stacks ?? 0;
  }
  if ("stackCount" in v) {
    if (!c.stacks) throw new Error(`value needs stack ${v.stackCount}, which isn't known here`);
    return c.stacks[v.stackCount] ?? 0;
  }
  const t = test(v.if, c);
  if (t === undefined) throw new Error("value depends on a condition that isn't known here");
  return t ? evaluate(v.then, c) : v.else === undefined ? 0 : evaluate(v.else, c);
}

/** Every skill key a value or predicate names, with its skill (default: the one in context), for the loader to check. */
export function valueKeys(v: ValueExpr, skillId: string): { skill: string; key: string }[] {
  if (typeof v === "number") return [];
  if (typeof v === "string") return [{ skill: skillId, key: v }];
  if ("key" in v) return [{ skill: v.skill ?? skillId, key: v.key }];
  const parts = "sum" in v ? v.sum : "product" in v ? v.product : "min" in v ? v.min : "max" in v ? v.max : "if" in v ? [v.then, ...(v.else !== undefined ? [v.else] : [])] : [];
  return parts.flatMap((x) => valueKeys(x, skillId));
}

/** Own stacks and buffs a predicate names, for the loader to check. */
export function predicateRefs(p: Predicate): { stacks: string[]; buffs: string[] } {
  if ("all" in p || "any" in p) {
    const list = "all" in p ? p.all : p.any;
    const parts = list.map(predicateRefs);
    return { stacks: parts.flatMap((x) => x.stacks), buffs: parts.flatMap((x) => x.buffs) };
  }
  if ("not" in p) return predicateRefs(p.not);
  // An eventOperator predicate names the event operator's stacks and buffs, not the kit's own.
  if ("stack" in p) return { stacks: [p.stack], buffs: [] };
  if ("buffActive" in p) return { stacks: [], buffs: [p.buffActive] };
  return { stacks: [], buffs: [] };
}
