// The kit format's two shared building blocks (docs/kit-abstractions.md):
// a Predicate says when something happens, a ValueExpr says how much. Every
// kit field that needs a condition or a number uses these, so a new
// situation is a new case here, not a new field on hits, buffs or triggers.

import type { AttrType, Element } from "./attributes.ts";
import type { Build } from "./build.ts";
import type { GameData } from "./model.ts";
import type { ArtsElement } from "./reactions.ts";
import type { EnemyStatus, ReactionStatus } from "./status.ts";
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
  /** The enemy has this reaction status (Estella's combo on a Solidified target). */
  | { readonly enemyStatus: ReactionStatus }
  /** The operator's own stack is at least / below a count. */
  | { readonly stack: string; readonly atLeast?: number; readonly below?: number }
  /** One of the operator's own kit buffs is active. */
  | { readonly buffActive: string }
  /** The hit itself consumed at least this many infliction stacks (default 1). */
  | { readonly consumedAtLeast: number };

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
  if ("stack" in p) {
    if (!c.stacks) return undefined;
    const n = c.stacks[p.stack] ?? 0;
    return (p.atLeast === undefined || n >= p.atLeast) && (p.below === undefined || n < p.below);
  }
  if ("buffActive" in p) return c.buffActive ? c.buffActive(p.buffActive) : undefined;
  return c.consumed === undefined ? undefined : c.consumed >= p.consumedAtLeast;
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
  if ("stack" in p) return { stacks: [p.stack], buffs: [] };
  if ("buffActive" in p) return { stacks: [], buffs: [p.buffActive] };
  return { stacks: [], buffs: [] };
}
